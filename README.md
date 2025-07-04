# Email Assistant

A server-side email assistant that provides daily schedule reminders and work summaries with AI-powered insights.

## Features

- **Morning Reminders**: Daily schedule notifications with AI-generated productivity suggestions
- **Evening Summaries**: Work report processing and intelligent summaries
- **Context Management**: Automatic context compression to maintain conversation history
- **Flexible Scheduling**: Configurable reminder times
- **Email Integration**: SMTP and IMAP support for various email providers
- **Email Reply Processing**: Automatic processing of user email replies for work reports and feedback
- **Multi-AI Support**: Compatible with OpenAI, DeepSeek, Google Gemini, Anthropic Claude, and Azure OpenAI

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
   - Email SMTP settings (for sending)
   - Email IMAP settings (for receiving replies)
   - AI provider and API key
   - Reminder times
   - Other preferences

## Configuration

Edit the `.env` file with your settings:

```env
# Email Configuration (SMTP for sending)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Email Configuration (IMAP for receiving)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password
IMAP_TLS=true
EMAIL_CHECK_INTERVAL_MS=30000

# User Email
USER_EMAIL=your-email@gmail.com
USER_NAME=Your Name

# AI Configuration
AI_PROVIDER=openai  # Choose: openai, deepseek, google, anthropic, azure-openai

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo

# DeepSeek Configuration
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-chat

# Google AI Configuration
GOOGLE_API_KEY=your-google-api-key
GOOGLE_MODEL=gemini-pro

# Anthropic Configuration
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=your-deployment-name

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
- `GET /api/schedule/today` - Get today's schedule
- `GET /api/schedule/:date` - Get schedule for specific date
- `POST /api/schedule` - Add/update schedule
- `GET /api/schedule/upcoming/:days` - Get upcoming events

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
Configure SMTP and IMAP settings according to your provider's documentation.

## Email Interaction Flow

The assistant communicates with users through email in the following ways:

### 1. Morning Reminders
- Sent automatically at the configured time
- Contains today's schedule and AI-generated productivity suggestions
- Users can reply with feedback or questions

### 2. Evening Work Report Requests
- Sent automatically at the configured time
- Asks users to reply with their daily work summary
- Users reply via email with their accomplishments, challenges, and plans

### 3. Automatic Reply Processing
The assistant automatically processes email replies and categorizes them as:

- **Work Reports**: User responses to evening reminders containing work summaries
- **Schedule Feedback**: User responses to morning reminders with feedback or questions
- **General Inquiries**: Any other email communication

### 4. Response Generation
Based on the reply type, the assistant:
- Generates AI-powered work summaries for work reports
- Provides additional suggestions for schedule feedback
- Answers general questions using conversation context

## AI Provider Setup

### OpenAI
1. Create an account at https://platform.openai.com/
2. Generate an API key
3. Set `AI_PROVIDER=openai` and `OPENAI_API_KEY=your-key`

### DeepSeek
1. Create an account at https://platform.deepseek.com/
2. Generate an API key
3. Set `AI_PROVIDER=deepseek` and `DEEPSEEK_API_KEY=your-key`

### Google Gemini
1. Create an account at https://ai.google.dev/
2. Generate an API key
3. Set `AI_PROVIDER=google` and `GOOGLE_API_KEY=your-key`

### Anthropic Claude
1. Create an account at https://console.anthropic.com/
2. Generate an API key
3. Set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=your-key`

### Azure OpenAI
1. Create an Azure OpenAI resource
2. Deploy a model
3. Set `AI_PROVIDER=azure-openai` and configure the Azure-specific settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License