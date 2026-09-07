# Clinic Flow Agent

**Realtime AI receptionist for appointment-driven businesses, demonstrated with a clinic scheduling workflow.**

Clinic Flow Agent turns text and voice conversations into structured scheduling actions. A visitor can ask for availability, provide the required details, book or cancel an appointment, receive confirmation, and continue the conversation over a realtime WebSocket connection.

The project is intentionally more than a chatbot demo: it demonstrates encrypted customer data, idempotent booking, concurrency protection, Google Calendar synchronization, email confirmation, voice transcription/synthesis, audit logs, health checks, Dockerized deployment and CI quality gates.

## Business use case

The reference implementation is a clinic receptionist, but the engineering pattern maps directly to Upwork automation work for:

- clinics and dental practices
- salons and spas
- home-service businesses
- consultants and professional services
- any business that turns inbound conversations into booked time slots

The assistant is designed for reception and scheduling workflows. It is **not** a medical-diagnosis system and this repository does **not** claim regulatory or HIPAA certification. Compliance for a production healthcare deployment depends on infrastructure, vendors, contracts, operational controls and organization-specific requirements beyond application code.

## Architecture

```text
                         ┌─────────────────────┐
Text / microphone ─────► │ Next.js receptionist│
                         └──────────┬──────────┘
                                    │ Socket.IO / HTTP
                                    ▼
                         ┌─────────────────────┐
                         │ NestJS API + gateway │
                         └──────────┬──────────┘
                                    │
                     ┌──────────────┼───────────────┐
                     ▼              ▼               ▼
               Agent Service   Voice Service   Scheduling Service
               OpenAI tools    STT + TTS       availability/book/cancel
                     │                              │
                     │                  ┌───────────┼───────────┐
                     ▼                  ▼           ▼           ▼
                PostgreSQL       Google Calendar  Email       Audit log
                encrypted PII
```

## What works

### Conversational receptionist

- realtime Socket.IO text conversation
- microphone recording from the browser
- speech-to-text and generated audio responses
- structured OpenAI tool calling
- conversation history persisted per patient/session
- visible connection, working and offline states in the UI
- automatic reconnection instead of silent socket failure

### Scheduling

- future availability lookup
- Google Calendar busy-slot awareness
- database busy-slot awareness
- multiple service durations
- booking and cancellation tools
- Prisma transaction using `Serializable` isolation
- overlap checks before persistence
- database-backed unique idempotency keys
- Google Calendar event creation/deletion
- email confirmation with calendar invite support
- booking/cancellation audit records

### Security and reliability

- AES-256-GCM encryption for stored patient contact fields
- normalized phone hash for lookup/deduplication
- request validation and size limits
- privacy-safer realtime/API logs that avoid echoing conversation content
- deployment-specific CORS allowlist rather than wildcard-with-credentials
- health endpoint with database/integration readiness
- Dockerized API, UI and PostgreSQL
- GitHub Actions for backend lint/test/build and frontend lint/build

## Tech stack

**Backend:** NestJS, TypeScript, Prisma, PostgreSQL, Socket.IO, OpenAI, Google APIs, Nodemailer

**Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn-style components, Socket.IO client

**Delivery:** Docker, Docker Compose, GitHub Actions

## Quick start

### Prerequisites

- Docker + Docker Compose, or Node.js 22 with pnpm/npm
- an OpenAI API key for real agent/voice behavior
- optional Google Calendar service-account credentials
- optional SMTP credentials for confirmation emails

### One-command full-stack path

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

At minimum, set a valid 32-character `ENCRYPTION_SECRET_KEY`. Add `OPENAI_API_KEY` for real AI behavior.

Then run:

```bash
docker compose up --build
```

Open:

- Receptionist UI: `http://localhost:3000`
- Health: `http://localhost:4000/api/v1/health`
- Swagger: `http://localhost:4000/api/docs`

The Compose stack runs PostgreSQL, applies committed Prisma migrations, starts the NestJS API and serves the standalone Next.js application.

## Local development

### Backend

```bash
cd backend
cp .env.example .env
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:migrate
pnpm start:dev
```

### Frontend

```bash
cd clinic
cp .env.example .env.local
npm ci
npm run dev
```

`NEXT_PUBLIC_BACKEND_URL` controls both the Socket.IO endpoint and generated audio origin, so the frontend is not tied to localhost when deployed.

## Configuration

Important backend variables are documented in [`backend/.env.example`](backend/.env.example):

- `DATABASE_URL`
- `ENCRYPTION_SECRET_KEY`
- `CORS_ORIGINS`
- `OPENAI_API_KEY` / `OPENAI_MODEL`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `CLINIC_CALENDAR_ID`
- SMTP settings

Frontend:

```dotenv
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

For deployment, use the public API origin and include the frontend origin in backend `CORS_ORIGINS`.

## API and realtime surface

### HTTP

- `GET /api/v1/health` — runtime/database/integration readiness
- `POST /api/v1/messaging/chat` — validated text interaction
- voice endpoints under `/api/v1/voice`
- Swagger at `/api/docs`

### WebSocket namespace

```text
/events
```

Client events include text and voice input. Server events communicate processing status, transcript, assistant response and safe error messages.

## Booking integrity

Two reliability problems are explicitly addressed.

### Duplicate retries

Every appointment has an `idempotencyKey` with a database unique constraint. The scheduling service checks for an existing non-cancelled appointment before creating another one, while the database constraint provides the final race-condition guard.

### Same-slot races

The booking path performs availability checks and writes inside a Prisma transaction configured with `Serializable` isolation. Overlap checks occur before the appointment is committed, so simultaneous requests cannot intentionally create duplicate reservations through the normal workflow.

## Data handling

Patient contact information is not stored as normal plaintext fields. The application stores encrypted name/phone/email values and a deterministic hash of the normalized phone number for lookup.

This is an application-security measure, not a compliance certification. A real healthcare deployment would still need appropriate hosting, access control, secrets management, retention policy, monitoring, vendor agreements/BAAs where applicable, incident processes and regulatory review.

## Quality gate

Backend:

```bash
cd backend
pnpm lint
pnpm test
pnpm build
```

Frontend:

```bash
cd clinic
npm run lint
npm run build
```

The same checks run automatically in GitHub Actions on pull requests and pushes to `main`.

## Manual acceptance testing

Use [`docs/MANUAL_TESTING.md`](docs/MANUAL_TESTING.md) after CI is green. It covers:

- text/socket behavior and reconnection
- availability
- booking and cancellation
- idempotency and concurrent booking attempts
- Google Calendar
- email confirmation
- voice recording/transcription/playback
- API validation
- encrypted data smoke tests
- deployment against a non-local backend URL

## Upwork demo flow

A useful client-facing demo takes about five minutes:

1. Show the green CI checks and `/api/v1/health`.
2. Open the receptionist UI and ask for tomorrow's availability.
3. Complete a booking conversationally.
4. Show the resulting database/audit record.
5. Show the Google Calendar event and confirmation email when configured.
6. Explain the Serializable transaction and unique idempotency key.
7. Use the microphone for a second request.
8. Cancel the appointment conversationally.
9. Briefly show encrypted patient fields and privacy-safer logs.

The commercial message is simple: **inbound conversations become safely scheduled appointments without requiring a human to handle every routine interaction.**

---

Built by **Edet Asuquo** as a Backend + AI Automation portfolio project.
