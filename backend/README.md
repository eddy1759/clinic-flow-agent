# **Backend: Core Scheduling Engine**

This directory contains the NestJS application responsible for the core business logic, database management, and external API integrations.

---
### **Key Services:**

  * **`ChatGateway`**: Unified WebSocket endpoint (`/events`) handling all user input (text/voice).
  * **`AgentService`**: The LLM core; manages conversation history, token streaming (conceptual), and tool calling logic (Booking, Availability, PII update).
  * **`SchedulingService`**: Handles atomic database locking (Postgres `SERIALIZABLE` isolation level) and synchronization with external services (Google Calendar, Nodemailer).
  * **`VoiceService`**: Manages Speech-to-Text (Whisper) and Text-to-Speech (TTS) functionalities and handles audio file caching.
---
## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```
### **Deployment**

Refer to the [Root README](https://www.google.com/search?q=%23-architectural-overview) for the full stack deployment strategy.
