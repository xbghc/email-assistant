import fs from 'fs/promises';
import path from 'path';
import { DailySchedule, ScheduleEvent } from '../../models/index';
import logger from '../../utils/logger';

class ScheduleService {
  private scheduleFile: string;

  constructor() {
    this.scheduleFile = path.join(process.cwd(), 'data', 'schedule.json');
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureDataDirectory();
      logger.info('Schedule service initialized');
    } catch (error) {
      logger.error('Failed to initialize schedule service:', error);
      throw error;
    }
  }

  async getTodaySchedule(): Promise<DailySchedule | null> {
    const today = new Date().toISOString().split('T')[0];
    if (!today) {
      return null;
    }
    return this.getScheduleForDate(today);
  }

  async getScheduleForDate(date: string): Promise<DailySchedule | null> {
    try {
      const data = await fs.readFile(this.scheduleFile, 'utf-8');
      const schedules: DailySchedule[] = JSON.parse(data);
      
      return schedules.find(schedule => schedule.date === date) || null;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      logger.error('Failed to load schedule:', error);
      throw error;
    }
  }

  async addSchedule(schedule: DailySchedule): Promise<void> {
    try {
      let schedules: DailySchedule[] = [];
      
      try {
        const data = await fs.readFile(this.scheduleFile, 'utf-8');
        schedules = JSON.parse(data);
      } catch (error) {
        if ((error as any).code !== 'ENOENT') {
          throw error;
        }
      }

      const existingIndex = schedules.findIndex(s => s.date === schedule.date);
      if (existingIndex >= 0) {
        schedules[existingIndex] = schedule;
      } else {
        schedules.push(schedule);
      }

      schedules.sort((a, b) => a.date.localeCompare(b.date));
      
      await fs.writeFile(this.scheduleFile, JSON.stringify(schedules, null, 2));
      logger.info(`Schedule added/updated for ${schedule.date}`);
    } catch (error) {
      logger.error('Failed to save schedule:', error);
      throw error;
    }
  }

  async updateScheduleEvent(date: string, eventIndex: number, event: ScheduleEvent): Promise<void> {
    const schedule = await this.getScheduleForDate(date);
    if (!schedule) {
      throw new Error(`No schedule found for date: ${date}`);
    }

    if (eventIndex < 0 || eventIndex >= schedule.events.length) {
      throw new Error(`Invalid event index: ${eventIndex}`);
    }

    schedule.events[eventIndex] = event;
    await this.addSchedule(schedule);
  }

  async deleteScheduleEvent(date: string, eventIndex: number): Promise<void> {
    const schedule = await this.getScheduleForDate(date);
    if (!schedule) {
      throw new Error(`No schedule found for date: ${date}`);
    }

    if (eventIndex < 0 || eventIndex >= schedule.events.length) {
      throw new Error(`Invalid event index: ${eventIndex}`);
    }

    schedule.events.splice(eventIndex, 1);
    await this.addSchedule(schedule);
  }

  async getUpcomingEvents(days: number = 7): Promise<DailySchedule[]> {
    try {
      const data = await fs.readFile(this.scheduleFile, 'utf-8');
      const schedules: DailySchedule[] = JSON.parse(data);
      
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const endDate = futureDate.toISOString().split('T')[0];
      
      if (!today || !endDate) {
        return [];
      }
      
      return schedules
        .filter(schedule => schedule.date >= today && schedule.date <= endDate)
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      logger.error('Failed to load upcoming events:', error);
      throw error;
    }
  }

  formatScheduleText(schedule: DailySchedule): string {
    if (!schedule || schedule.events.length === 0) {
      return 'No scheduled events for today.';
    }

    const header = `Schedule for ${new Date(schedule.date).toLocaleDateString()}:\n`;
    const events = schedule.events
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(event => {
        let text = `• ${event.time} - ${event.title}`;
        if (event.location) {
          text += ` (${event.location})`;
        }
        if (event.description) {
          text += `\n  ${event.description}`;
        }
        return text;
      })
      .join('\n');
    
    return header + events;
  }

  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.dirname(this.scheduleFile);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }
}

export default ScheduleService;