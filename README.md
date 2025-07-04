# Email Assistant

A server-side email assistant that provides daily schedule reminders and work summaries with AI-powered insights.

## Features

- **Morning Reminders**: Daily schedule notifications with AI-generated productivity suggestions
- **Evening Summaries**: Work report processing and intelligent summaries
- **Context Management**: Automatic context compression to maintain conversation history
- **Flexible Scheduling**: Configurable reminder times
- **Email Integration**: SMTP support for various email providers

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Configure your settings in `.env`:
   - Email SMTP settings
   - OpenAI API key
   - Reminder times
   - Other preferences

## Configuration

Edit the `.env` file with your settings:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# User Email
USER_EMAIL=your-email@gmail.com
USER_NAME=Your Name

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Schedule Configuration
MORNING_REMINDER_TIME=08:00
EVENING_REMINDER_TIME=20:00
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Testing Email Features
```bash
# Test morning reminder
curl -X POST http://localhost:3000/test/morning-reminder

# Test evening reminder
curl -X POST http://localhost:3000/test/evening-reminder
```

### Submit Work Report
```bash
curl -X POST http://localhost:3000/work-report \
  -H "Content-Type: application/json" \
  -d '{"report": "Today I completed the project setup and implemented the core features..."}'
```

## API Endpoints

- `GET /health` - Health check
- `POST /work-report` - Submit daily work report
- `POST /test/morning-reminder` - Test morning reminder
- `POST /test/evening-reminder` - Test evening reminder

## Schedule Management

The assistant can work with schedule data stored in `data/schedule.json`. Example format:

```json
[
  {
    "date": "2024-01-15",
    "events": [
      {
        "time": "09:00",
        "title": "Team Meeting",
        "description": "Weekly team sync",
        "location": "Conference Room A"
      },
      {
        "time": "14:00",
        "title": "Project Review",
        "description": "Review project progress"
      }
    ]
  }
]
```

## Data Storage

- `data/context.json` - Conversation history and context
- `data/schedule.json` - Schedule data
- `logs/` - Application logs

## Scripts

- `npm run build` - Build TypeScript
- `npm run dev` - Development mode with hot reload
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run typecheck` - Type check

## Email Provider Setup

### Gmail
1. Enable 2-factor authentication
2. Generate an app password
3. Use the app password in `SMTP_PASS`

### Other Providers
Configure SMTP settings according to your provider's documentation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License