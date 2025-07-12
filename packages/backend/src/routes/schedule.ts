import express, { Router } from 'express';
import ScheduleService from '../services/schedule/scheduleService';
import logger from '../utils/logger';

const router: Router = express.Router();
const scheduleService = new ScheduleService();

router.get('/today', async (req, res) => {
  try {
    const schedule = await scheduleService.getTodaySchedule();
    res.json(schedule);
  } catch (error) {
    logger.error('Failed to get today\'s schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const schedule = await scheduleService.getScheduleForDate(date);
    res.json(schedule);
  } catch (error) {
    logger.error('Failed to get schedule for date:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const schedule = req.body;
    await scheduleService.addSchedule(schedule);
    res.json({ message: 'Schedule added successfully' });
  } catch (error) {
    logger.error('Failed to add schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/upcoming/:days', async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 7;
    const schedules = await scheduleService.getUpcomingEvents(days);
    res.json(schedules);
  } catch (error) {
    logger.error('Failed to get upcoming events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;