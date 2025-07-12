# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Installation
```bash
pnpm install                    # Install all dependencies
```

### Development
```bash
pnpm dev                       # Start both frontend and backend in development mode
pnpm dev:backend              # Start only backend development server
pnpm dev:frontend             # Start only frontend development server
```

### Building
```bash
pnpm build                    # Build all packages (shared → backend → frontend)
pnpm build:shared             # Build shared types package
pnpm build:backend            # Build backend only
pnpm build:frontend           # Build frontend only
```

### Testing
```bash
pnpm test                     # Run all tests across packages
pnpm test:watch               # Run backend tests in watch mode
pnpm test:coverage            # Run backend tests with coverage report
pnpm test:ci                  # Run tests in CI mode (no watch)
```

### Code Quality
```bash
pnpm lint                     # Lint all packages
pnpm lint:fix                 # Auto-fix linting issues
pnpm typecheck                # TypeScript type checking for all packages
pnpm validate                 # Run typecheck + lint + test:ci
```

### Production
```bash
pnpm start                    # Start production server
pnpm clean                    # Clean all build artifacts
```

## Architecture Overview

This is a **PNPM monorepo** with three packages organized around modern TypeScript architecture:

### Package Structure
- **`@email-assistant/shared`** - Common types, interfaces, and utilities shared between frontend and backend
- **`@email-assistant/backend`** - Express.js server with dependency injection architecture
- **`@email-assistant/frontend`** - Vue 3 + Vite frontend with TypeScript

### Backend Architecture (`packages/backend/`)

The backend uses a **service-oriented architecture with dependency injection**:

#### Core Services Layer
- **`SchedulerService`** - Central task scheduling coordinator using node-cron
- **`SystemHealthService`** - System monitoring and health checks
- **`SystemStartupService`** - Application bootstrap and dependency resolution

#### Business Logic Services
- **`EmailService`** - SMTP/IMAP email handling with circuit breaker patterns
- **`AIService`** - Multi-provider AI abstraction (OpenAI, DeepSeek, Google, Anthropic, Azure)
- **`UserService`** - User management with JWT authentication and role-based access
- **`ContextService`** - Conversation context management with automatic compression
- **`ScheduleService`** - Reminder scheduling and execution logic

#### Utility Services
- **`ConfigService`** - Environment configuration management
- **`SecurityService`** - Security utilities and validation
- **`PerformanceMonitorService`** - Performance metrics collection
- **`LogReaderService`** - Log file management and rotation

#### Key Patterns
- **Dependency Injection**: Services are injected via constructor parameters
- **Circuit Breaker**: Email service includes failure handling and retry logic
- **Health Monitoring**: Comprehensive system health endpoints at `/health` and `/api/system/status`
- **JWT Authentication**: Role-based access control for admin vs user operations

### Frontend Architecture (`packages/frontend/`)

Modern Vue 3 application with:
- **Vite** for build tooling and hot module replacement
- **Vue Router** for client-side routing
- **TypeScript** throughout for type safety
- **Composables** pattern for reusable logic
- **Centralized API client** with error handling

#### Key Frontend Files
- `src/utils/api.ts` - Centralized API client with type-safe requests
- `src/utils/auth.ts` - Authentication state management
- `src/utils/state.ts` - Application state management
- `src/router/index.ts` - Route definitions with auth guards

### Shared Package (`packages/shared/`)

Common TypeScript definitions used across frontend and backend:
- Interface definitions for API requests/responses
- Shared data models and types
- Common utility functions

## Important Development Notes

### Email Configuration
- Uses SMTP for sending, IMAP for receiving
- Supports multiple email providers (Gmail, etc.)
- Circuit breaker pattern prevents email service failures from crashing the app
- Debug email connectivity with: `node packages/backend/debug-email-config.js`

### AI Provider Support
The system supports multiple AI providers through a unified interface:
- OpenAI (GPT models)
- DeepSeek
- Google Gemini
- Anthropic Claude
- Azure OpenAI

Configure via `AI_PROVIDER` environment variable.

### Authentication & Security
- JWT-based authentication with configurable expiration
- Role-based access (admin vs user)
- Security middleware with Helmet.js
- Admin operations restricted via `adminOnly` middleware

### Database & Persistence
- File-based persistence using JSON files in `packages/backend/data/`
- Context management with automatic compression
- Performance metrics tracking
- Email records and reminder tracking

### Development Workflow
1. Always run `pnpm validate` before committing (typecheck + lint + test)
2. Use `pnpm dev` for full-stack development
3. The shared package must be built before backend/frontend when types change
4. Frontend connects to backend on port 3000 by default

### Debugging & Monitoring
- Structured logging with Winston to `packages/backend/logs/`
- Health check endpoints for monitoring
- Performance metrics collection
- System startup timing and dependency resolution tracking