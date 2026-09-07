'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Mic, Send, Sparkles, StopCircle } from 'lucide-react';

type Message = {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
};

type ConnectionState = 'connecting' | 'online' | 'offline';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export default function ClinicChat() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [userId] = useState(() => `patient-${crypto.randomUUID()}`);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const isStartingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const addMessage = (role: Message['role'], content: string) => {
    setMessages((previous) => [...previous, { role, content, timestamp: new Date() }]);
  };

  useEffect(() => {
    const socketInstance = io(`${BACKEND_URL}/events`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      timeout: 8000,
    });

    socketInstance.on('connect', () => {
      setConnectionState('online');
      socketInstance.emit('join_room', userId);
    });
    socketInstance.on('disconnect', () => setConnectionState('offline'));
    socketInstance.on('connect_error', () => setConnectionState('offline'));

    socketInstance.on('bot_response', (data: { text?: string; audioUrl?: string }) => {
      setIsThinking(false);
      if (data.text) addMessage('bot', data.text);
      if (data.audioUrl) {
        const audio = new Audio(`${BACKEND_URL}${data.audioUrl}`);
        audio.play().catch(() => undefined);
      }
    });

    socketInstance.on('user_transcript', (data: { text?: string }) => {
      if (data.text) addMessage('user', data.text);
    });

    socketInstance.on('bot_status', (data: { status?: string }) => {
      setIsThinking(data.status === 'thinking' || data.status === 'transcribing');
    });

    socketInstance.on('error_message', (data: { message?: string }) => {
      setIsThinking(false);
      addMessage('bot', data.message ?? 'I hit a temporary problem. Please try again.');
    });

    setSocket(socketInstance);
    return () => socketInstance.close();
  }, [userId]);

  const sendText = () => {
    const text = input.trim();
    if (!text) return;
    if (!socket?.connected) {
      addMessage('bot', 'The receptionist service is offline right now. Start the backend or check NEXT_PUBLIC_BACKEND_URL, then try again.');
      return;
    }
    addMessage('user', text);
    socket.emit('user_text', { userId, text });
    setInput('');
  };

  const startRecording = async () => {
    if (isRecording || isStartingRef.current) return;
    if (!socket?.connected) {
      addMessage('bot', 'Voice is unavailable while the receptionist service is offline.');
      return;
    }
    isStartingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (socket.connected && blob.size > 1000) {
          socket.emit('user_voice', { userId, audio: blob });
        }
        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      addMessage('bot', 'Microphone access was blocked. You can continue by typing instead.');
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecording) return;
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <main className="flex flex-1 items-center justify-center p-4 md:p-8">
        <Card className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border-0 bg-white/95 shadow-2xl ring-1 ring-black/5">
          <CardHeader className="sticky top-0 z-10 border-b bg-white/80 px-6 py-5 backdrop-blur-md md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/20">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${connectionState === 'online' ? 'bg-green-500' : connectionState === 'connecting' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-800">Sarah</h1>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">AI Clinic Receptionist</span>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">
                  {connectionState === 'online' ? 'System online' : connectionState === 'connecting' ? 'Connecting…' : 'Backend offline'}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative flex flex-1 flex-col overflow-hidden bg-slate-50/60 p-0">
            <ScrollArea className="flex-1 p-6 md:p-8">
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.length === 0 && (
                  <div className="mt-16 flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-white shadow-sm">
                      <Sparkles className="h-8 w-8 text-emerald-500/80" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-700">How can I help you today?</h2>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                        Check appointment availability, book or cancel a visit, or ask a general clinic question using text or voice.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="outline" className="rounded-full bg-white/70 text-xs" onClick={() => setInput('I would like to book a general consultation')}>Book a consultation</Button>
                      <Button variant="outline" className="rounded-full bg-white/70 text-xs" onClick={() => setInput('What appointment times are available tomorrow?')}>Check availability</Button>
                    </div>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div key={`${message.timestamp.getTime()}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-4 text-[15px] leading-relaxed shadow-sm md:max-w-[75%] md:p-5 ${message.role === 'user' ? 'rounded-br-none bg-slate-900 text-white' : 'rounded-bl-none border border-slate-100 bg-white text-slate-700'}`}>
                      {message.content}
                    </div>
                  </div>
                ))}

                {isThinking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-3 rounded-2xl rounded-bl-none border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex space-x-1.5">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500/60 [animation-delay:-0.3s]" />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500/60 [animation-delay:-0.15s]" />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-500/60" />
                      </div>
                      <span className="text-xs font-medium text-slate-400">Sarah is working on that…</span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <div className="z-10 border-t border-slate-100/80 bg-white p-5 md:p-6">
              <div className="relative mx-auto flex max-w-3xl items-center gap-3">
                <input
                  className="flex-1 rounded-full border border-slate-200 bg-slate-50 py-4 pl-6 pr-14 text-[15px] shadow-inner transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder={connectionState === 'online' ? 'Type your message…' : 'Backend offline — you can still view the demo UI'}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && sendText()}
                  disabled={isRecording}
                />

                <div className="absolute right-2 flex items-center gap-1">
                  {input.trim() ? (
                    <Button size="icon" className="h-10 w-10 rounded-full bg-slate-900 shadow-md hover:bg-slate-800" onClick={sendText}>
                      <Send className="h-4 w-4 text-white" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant={isRecording ? 'destructive' : 'ghost'}
                      className={`h-10 w-10 rounded-full transition-all ${isRecording ? 'animate-pulse bg-red-500 ring-4 ring-red-500/20 hover:bg-red-600' : 'bg-emerald-500 text-white shadow-md hover:bg-emerald-600'}`}
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                    >
                      {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-3 text-center text-[10px] text-slate-400">Press and hold the microphone to speak. This demo handles scheduling workflows, not medical diagnosis or emergencies.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
