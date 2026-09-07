# Clinic Flow Agent manual acceptance test

This checklist is the final human verification pass after GitHub Actions is green. It covers the workflows most useful in an Upwork demo: realtime text, voice, appointment availability, race-safe booking, cancellation, calendar sync, email confirmation and recovery behavior.

## 1. Configure the project

Backend:

```bash
cp backend/.env.example backend/.env
```

Set a real `OPENAI_API_KEY` before testing AI/voice behavior. For Google Calendar and email tests, also configure the corresponding credentials in `backend/.env`.

Frontend, when running outside the root Docker Compose setup:

```bash
cp clinic/.env.example clinic/.env.local
```

## 2. Start the full stack

Recommended portfolio path:

```bash
docker compose up --build
```

Open:

- UI: `http://localhost:3000`
- health: `http://localhost:4000/api/v1/health`
- Swagger: `http://localhost:4000/api/docs`

Expected health response:

- `status` is `ok`
- `database` is `up`
- integration booleans reflect which credentials you supplied

## 3. Realtime text conversation

Open the UI and confirm the header changes from **Connecting** to **System online**.

Send:

> I would like to book a general consultation.

Expected:

- your message appears immediately
- the UI displays a working/thinking state
- Sarah replies through the WebSocket connection
- disconnecting/restarting the backend changes the UI to **Backend offline** instead of silently failing
- reconnecting the backend allows the socket to recover

## 4. Availability lookup

Ask for appointment availability on a future date.

Expected:

- agent invokes availability tooling
- past slots are not returned
- internally booked slots are excluded
- when Google Calendar is configured, external busy events are also excluded

## 5. Booking happy path

Complete the information requested by the receptionist and explicitly confirm a slot.

Expected:

- one appointment row is created in PostgreSQL
- appointment has an idempotency key
- audit log records the booking
- when Google Calendar is configured, an event is created and its ID is saved
- when SMTP is configured, the confirmation email and calendar invite are sent

## 6. Idempotency test

Repeat the same booking action using the same idempotency key through the scheduling flow/API path used by your test harness.

Expected:

- the existing appointment is returned/used
- no duplicate appointment is created
- the database unique constraint prevents concurrent duplicate idempotency keys

## 7. Double-booking / concurrency test

Use two browser windows or two API clients and attempt to reserve the same slot at nearly the same time.

Expected:

- only one appointment succeeds
- the other request receives an unavailable/conflict response
- no overlapping confirmed appointment pair is persisted for the same scheduling resource

## 8. Cancellation

Ask Sarah to find/cancel an existing appointment, or call the cancellation tool through the supported flow.

Expected:

- appointment becomes `CANCELLED`
- audit log records cancellation
- configured Google Calendar event is removed
- cancelling an already-cancelled appointment is idempotent

## 9. Voice path

Use Chrome/Edge and grant microphone permission.

1. Press and hold the microphone button.
2. Say a scheduling request clearly.
3. Release the button.

Expected:

- UI enters transcription/working state
- transcript is displayed once
- agent processes the transcript
- voice response is generated and played when browser autoplay permits it
- very short/empty audio is ignored
- microphone denial falls back cleanly to typed conversation

## 10. HTTP messaging API

From Swagger or cURL, call:

```text
POST /api/v1/messaging/chat
```

Use a valid `userId`, message and `WEB` channel.

Expected:

- input validation rejects oversized/invalid requests
- successful calls return status, reply and timestamp
- internal exception details are not returned to the client

## 11. Data-protection smoke test

Inspect the `patients` table after creating a patient.

Expected:

- name, phone and email are not stored as plaintext
- phone lookup uses a deterministic hash
- application logs do not print complete chat text or patient identifiers in the realtime gateway

## 12. Deployment configuration test

Run the frontend with a non-local backend URL by setting:

```dotenv
NEXT_PUBLIC_BACKEND_URL=https://your-api.example.com
```

Set the same frontend origin in backend `CORS_ORIGINS`.

Expected:

- WebSocket connection uses the configured backend
- generated audio URLs use the configured backend
- CORS does not use a wildcard with credentials

## Upwork demo script

A concise 5–7 minute demonstration:

1. Show `/api/v1/health` and the GitHub Actions checks.
2. Open the polished receptionist UI and point out text + voice support.
3. Ask for tomorrow's availability.
4. Book a slot and show the agent collecting only the fields it needs.
5. Show the PostgreSQL appointment/audit record.
6. Show the Google Calendar event and confirmation email if configured.
7. Explain the Serializable transaction, idempotency key and conflict protection.
8. Demonstrate cancellation.
9. Briefly show encrypted patient fields and privacy-safe logging.
10. Explain that the project automates reception/scheduling; it does not diagnose medical conditions and is not presented as a compliance certification.

## Acceptance criteria

The portfolio build is ready to show clients when:

- GitHub Actions passes backend lint/test/build and frontend lint/build
- Docker Compose boots the full stack from a clean checkout
- health reports database up
- text chat works and reconnects
- availability, booking and cancellation work
- repeat/concurrent booking does not create duplicates
- voice works with real OpenAI credentials
- Google Calendar and email work when their credentials are configured
- the UI works against a configurable non-local backend URL
