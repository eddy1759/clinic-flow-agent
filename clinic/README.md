# **Frontend: Conversational Interface**

This directory contains the Next.js application that provides the modern, responsive interface for the user to interact with the scheduling agent.

### **Key Components:**

  * **`app/page.tsx`**: The main client component implementing the WebSocket connection and managing chat state.
  * **`socket.io-client`**: Handles the real-time, bidirectional communication with the NestJS Gateway.
  * **Styling**: Uses **Tailwind CSS** utility classes and **Shadcn UI** components (Button, Card, ScrollArea) for a professional, clean user experience.

### **Project setup**

```bash
$ npm install
```

### **Run the project**

```bash
$ npm run dev
```