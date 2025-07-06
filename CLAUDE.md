# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

### Building and Running
```bash
npm run build          # Build TypeScript to dist/
npm run dev            # Development mode with hot reload
npm start              # Start production server
npm run validate       # Run typecheck, lint, and tests together
```

### Testing and Quality Assurance
```bash
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues automatically
npm run typecheck      # TypeScript type checking without emit
```

### Email Service Debugging
```bash
node debug-email-config.js  # Test SMTP/IMAP connections and diagnose issues
```

## High-Level Architecture

### Core Service Architecture
The application follows a service-oriented architecture where **SchedulerService** acts as the central orchestrator:

- **SchedulerService**: Main coordinator that manages all scheduled tasks (morning/evening reminders, weekly reports)
- **EmailService**: Handles SMTP sending with circuit breaker pattern, connection pooling, and retry queue
- **EmailReceiveService**: Manages IMAP connections for processing incoming email replies
- **AIService**: Abstraction layer supporting multiple AI providers (OpenAI, DeepSeek, Google, Anthropic, Azure)
- **ContextService**: Maintains conversation history with automatic compression when limits are reached
- **UserService**: Manages user accounts with role-based access control

### Service Instance Management Pattern
The application uses a **singleton pattern for service instances** to prevent initialization issues:
- Global services are initialized in `src/index.ts` during startup
- Services are exported via `getSchedulerService()` and `getHealthService()` functions
- **Never create new service instances in routes** - always use the global instances via these getters

### Email Processing Pipeline
1. **Outbound**: SchedulerService → EmailService → SMTP (with circuit breaker and retry queue)
2. **Inbound**: IMAP → EmailReceiveService → EmailReplyHandler → AIService → Response
3. **Status Tracking**: ReminderTrackingService maintains state of all reminder deliveries

### Authentication & Security
- JWT-based authentication with bcrypt password hashing
- Role-based access control (Admin/User roles)
- Rate limiting on authentication endpoints
- Helmet.js security headers with CSP configuration
- Environment-based CORS configuration

### Data Flow for Reminders
1. Cron triggers morning/evening reminder in SchedulerService
2. SchedulerService checks ReminderTrackingService for today's status
3. If not sent, generates content via AIService and sends via EmailService
4. EmailService uses circuit breaker pattern - on failure, emails are queued for retry
5. ReminderTrackingService updates status regardless of email success/failure

## Critical Configuration Requirements

### Production Environment Setup
Always use real email credentials in production:
```bash
# Use .env.production.example as template
SMTP_HOST=smtp.gmail.com  # NOT localhost
SMTP_PORT=587
SMTP_USER=real-email@gmail.com
SMTP_PASS=app-password    # Gmail app password, not regular password
```

### Service Initialization Order
Services must be initialized in this order:
1. Configuration validation
2. Core services (EmailService, AIService, etc.)
3. SchedulerService (which depends on all others)
4. Start cron jobs and web server

### Email Service Circuit Breaker
The EmailService implements a circuit breaker pattern:
- Fails fast after 3 consecutive failures
- Resets after 1 minute timeout
- Queues failed emails for retry with exponential backoff
- Status can be checked via `emailService.getServiceStatus()`

## Common Debugging Patterns

### "Checking Status" Issue
When reminders show "checking" status instead of sending:
1. Check if services are using global instances (`getSchedulerService()`)
2. Verify email configuration with `debug-email-config.js`
3. Check SchedulerService initialization in logs
4. Verify ReminderTrackingService has been initialized

### Email Configuration Problems
Most email issues stem from:
- Using localhost instead of real SMTP/IMAP hosts
- Missing or incorrect Gmail app passwords
- Firewall blocking SMTP/IMAP ports (587, 993)

### Service Dependencies
Key dependency chains to understand:
- Web routes → Global service instances (via getters)
- SchedulerService → EmailService → SMTP/Circuit Breaker
- EmailReceiveService → EmailReplyHandler → AIService
- All services → Configuration validation on startup

## Multi-AI Provider Support

The AIService supports multiple providers through a unified interface:
- Provider switching via `AI_PROVIDER` environment variable
- Each provider has specific configuration requirements
- Mock provider available for testing (`AI_PROVIDER=mock`)
- Function calling capabilities vary by provider

## Data Storage Patterns

The application uses JSON file-based storage:
- `data/users.json`: User accounts and configurations
- `data/context.json`: Conversation history with auto-compression
- `data/schedule.json`: Schedule data
- `data/reminders.json`: Reminder delivery tracking
- `logs/`: Structured logging with rotation

## Security Notes

- JWT secrets must be 32+ characters in production
- Default secrets trigger startup errors in production mode
- All authentication endpoints have rate limiting
- CORS origins must be explicitly configured for production
- User passwords are hashed with bcrypt (12 rounds)