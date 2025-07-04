export interface DailySchedule {
  date: string;
  events: ScheduleEvent[];
}

export interface ScheduleEvent {
  time: string;
  title: string;
  description?: string;
  location?: string;
}

export interface WorkSummary {
  date: string;
  tasks: CompletedTask[];
  achievements: string[];
  challenges: string[];
  nextDayPlans: string[];
}

export interface CompletedTask {
  title: string;
  description?: string;
  timeSpent?: number;
  priority?: 'high' | 'medium' | 'low';
}

export interface ContextEntry {
  id: string;
  timestamp: Date;
  type: 'schedule' | 'work_summary' | 'feedback' | 'conversation';
  content: string;
  metadata?: Record<string, any>;
}

export interface UserInteraction {
  prompt: string;
  response: string;
  timestamp: Date;
  type: 'morning_reminder' | 'evening_summary' | 'general';
}