import express from 'express';
import config from './config';
import logger from './utils/logger';
import SchedulerService from './services/schedulerService';
import scheduleRoutes from './routes/schedule';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let schedulerService: SchedulerService;

async function startServer(): Promise<void> {
  try {
    schedulerService = new SchedulerService();
    await schedulerService.initialize();

    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    app.use('/api/schedule', scheduleRoutes);

    app.post('/work-report', async (req, res) => {
      try {
        const { report } = req.body;
        if (!report) {
          return res.status(400).json({ error: 'Work report is required' });
        }

        await schedulerService.processWorkReport(report);
        res.json({ message: 'Work report processed successfully' });
      } catch (error) {
        logger.error('Failed to process work report:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/morning-reminder', async (req, res) => {
      try {
        await schedulerService.testMorningReminder();
        res.json({ message: 'Morning reminder test sent successfully' });
      } catch (error) {
        logger.error('Failed to test morning reminder:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/evening-reminder', async (req, res) => {
      try {
        await schedulerService.testEveningReminder();
        res.json({ message: 'Evening reminder test sent successfully' });
      } catch (error) {
        logger.error('Failed to test evening reminder:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.listen(port, () => {
      logger.info(`Email assistant server running on port ${port}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  if (schedulerService) {
    schedulerService.destroy();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  if (schedulerService) {
    schedulerService.destroy();
  }
  process.exit(0);
});

startServer().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});