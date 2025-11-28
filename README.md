
# CLINIC Flow Agent

### **Value Proposition**

This project delivers a **robust, production-grade conversational AI platform** designed to automate missed calls and transform text/voice inquiries into confirmed, scheduled appointments in real-time. It is built to meet the high demands of the healthcare sector, emphasizing security, concurrency, and performance.

---

## Architectural Overview

The system utilizes a modern, **Event-Driven Architecture (EDA)** based on WebSockets to handle all communication modalities (Text and Voice) through a single, unified gateway. This prevents the latency and connection overhead associated with traditional HTTP polling, which is essential for low-latency conversational AI.

### 1. High-Level System Diagram

This diagram visualizes the primary components and the synchronous data flow.

```mermaid
graph TD
    subgraph Frontend
        UI[User Interface]
    end

    subgraph Backend
        A[Chat Gateway]
        B[Voice Service]
        C[Text Service]
        D[Agent Service]
        E[Scheduling Service]
    end
    
    subgraph External
        F[(Database)]
        G[Google Calendar API]
        H[Email Service]
    end
    
    UI <-->|WebSocket| A
    
    A --> B
    A --> C
    
    B --> D
    C --> D
    
    D --> E
    
    E --> F
    E --> G
    E --> H
````

### 2\. Conversational Data Flow (Concurrency and Booking)

This sequence highlights the critical steps taken by the system to ensure a robust, receptionist-like interaction that is safe from double-booking.

| Step | Component | Action | Critical Engineering Goal |
| :--- | :--- | :--- | :--- |
| **Input** | Frontend | `socket.emit('user_voice/text')` | **Unified Input:** Handle all modalities via one persistent channel. |
| **STT** | Gateway -\> VoiceService | `transcribeBuffer()` | Low-latency audio-to-text conversion (Whisper). |
| **Agent Logic** | AgentService (GPT-4o) | **Strict Funnel Enforcement** | Forces clarification and final confirmation before booking (Receptionist Persona). |
| **Tool Call** | AgentService | `book_appointment(time, service)` | Requests scheduling action. |
| **Concurrency Guard** | SchedulingService | `$transaction({Serializable})` | **Prevents Race Conditions:** Acquires an atomic lock on the time slot in PostgreSQL before checking Google. |
| **External Sync** | SchedulingService | `GCal API` | Checks and creates the event in Google Calendar. |
| **Notification** | SchedulingService -\> EmailService | `sendConfirmation()` | Delivers custom email with **.ics calendar invite** (avoids Google DWD error). |
| **TTS & Output** | VoiceService -\> Gateway | `generateAudio()` | Sends final text and streaming audio URL back for real-time playback. |

-----

## 🛠️ Getting Started

This project is structured into two main directories: `backend` (NestJS) and `clinic` (Next.js).

### **Prerequisites**

  * Node.js (v18+)
  * pnpm (Recommended, as seen in package locks) or npm
  * PostgreSQL running locally (via Docker or native)
  * API Keys for OpenAI and Google Service Account credentials (`.env` setup).

### **1. Backend Setup (`backend` folder)**

The backend serves the API and the WebSocket gateway.

```bash
    # 1. Navigate to the backend folder
    $ cd backend

    # 2. Install dependencies
    $ pnpm install

    # 3. Setup database (Update DATABASE_URL in .env first)
    $ pnpm run prisma:migrate

    # 4. Start the server (HTTP/WebSocket Gateway on port 4000)
    $ pnpm run start:dev
```
```
### **2. Frontend Setup (`clinic` folder)**

The frontend provides the unified chat interface using React/Next.js.

```bash
# 1. Navigate to the frontend folder
$ cd clinic

# 2. Install dependencies (including shadcn components dependencies)
$ pnpm install

# 3. Start the Next.js development server
$ pnpm run dev
```

Access the application at `http://localhost:3000`.


