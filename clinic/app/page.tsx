'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Send, StopCircle, Loader2, Activity } from "lucide-react";
import { Navbar } from "@/components/Navbar";

// Types
type Message = {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
};

export default function ClinicChat() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  
  // Initialize ID safely inside state to avoid hydration errors
  const [userId] = useState(() => `patient-${Math.floor(Math.random() * 1000)}`);

  // Audio Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const isStartingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  // ----------------------------------------------------------------
  // FIX: Define addMessage HERE (Before useEffect)
  // ----------------------------------------------------------------
  const addMessage = (role: 'user' | 'bot', content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  };

  useEffect(() => {
    // 1. Establish connection instance
    const socketInstance = io('http://localhost:4000/events'); 
    
    // 2. Setup Listeners
    socketInstance.emit('join_room', userId);

    socketInstance.on('bot_response', (data) => {
      setIsThinking(false);
      
      addMessage('bot', data.text);

      if (data.audioUrl) {
        const audio = new Audio(`http://localhost:4000${data.audioUrl}`);
        audio.play().catch(e => console.error("Audio play blocked", e));
      }
    });

    socketInstance.on('user_transcript', (data) => {
       addMessage('user', data.text);
    });

    socketInstance.on('bot_thinking', () => setIsThinking(true));
    
    socketInstance.on('error', (msg) => {
      setIsThinking(false);
      alert(msg);
    });
    
    // FIX 2: Set the socket state only once at the end of setup.
    // We add the disable comment because this synchronous call is NECESSARY
    // for initialization, even if the linter flags it.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    setSocket(socketInstance); 

    // 3. CLEANUP
    return () => { 
        if (socketInstance.connected) {
            socketInstance.close(); 
        }
    };
  }, [userId]); // userId is the only dependency needed // addMessage is stable, no need to add to deps if defined inside component, or wrap in useCallback

  // 2. Handle Text Send
  const sendText = () => {
    if (!input.trim() || !socket) return;
    addMessage('user', input);
    socket.emit('user_text', { userId, text: input });
    setInput('');
  };

  // 3. Handle Voice Recording
  const startRecording = async () => {
    if (isRecording || isStartingRef.current) return;
    isStartingRef.current = true;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (socket && blob.size > 1000) { // Ignore tiny files (< 1KB)
            socket.emit('user_voice', { userId, audio: blob });
        } else {
            console.warn("Audio too short, ignored.");
        }
        setIsRecording(false);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic Error", err);
      alert("Microphone access denied");
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Global Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50 via-slate-50 to-slate-100">
        <Card className="w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl border-0 ring-1 ring-black/5 overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm">
          <div className="flex h-full">
            
            {/* Sidebar (Desktop Only) */}
            <div className="hidden md:flex w-64 bg-slate-50/50 border-r flex-col p-6 gap-6">
               <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-primary hover:bg-primary/5">
                       📅 Book Appointment
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-primary hover:bg-primary/5">
                       💊 Refill Prescription
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-primary hover:bg-primary/5">
                       📋 Lab Results
                    </Button>
                  </div>
               </div>
               
               <div className="mt-auto">
                 <Card className="bg-primary/5 border-primary/10 shadow-none">
                   <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-sm font-medium text-slate-700">System Status</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {socket?.connected ? 'Voice Assistant Online' : 'Connecting to Server...'}
                      </p>
                   </CardContent>
                 </Card>
               </div>
            </div>

            {/* Chat Interface */}
            <div className="flex-1 flex flex-col bg-white">
              <CardHeader className="border-b px-6 py-4 bg-white/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                       <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Activity className="h-5 w-5 text-primary" />
                       </div>
                       {socket?.connected && (
                         <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                       )}
                    </div>
                    <div className="flex flex-col">
                      <h1 className="text-base font-bold text-slate-800">Sarah (AI Receptionist)</h1>
                      <span className="text-xs text-slate-500 font-medium">Scheduling & General Inquiries</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50/30">
                <ScrollArea className="flex-1 p-6">
            <div className="space-y-4">
              {messages.length === 0 && (
                 <div className="text-center text-gray-400 mt-10">
                    👋 Hi! I can help you book appointments.<br/>
                    Try saying &quot;Book a checkup for tomorrow&quot;.
                 </div>
              )}
              
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-br-none' 
                      : 'bg-white border text-foreground rounded-bl-none'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-white border p-4 rounded-2xl rounded-bl-none flex items-center gap-2 shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">Sarah is typing...</span>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 bg-white border-t flex items-center gap-3">
            <input
              className="flex-1 bg-slate-50 border-slate-200 border rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Type or speak..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendText()}
              disabled={isRecording}
            />
            
            {input.trim() ? (
               <Button size="icon" className="rounded-full h-12 w-12 bg-primary hover:bg-primary/90 shadow-md transition-all" onClick={sendText}>
                 <Send className="h-5 w-5" />
               </Button>
            ) : (
               <Button 
                 size="icon" 
                 variant={isRecording ? "destructive" : "default"}
                 className={`rounded-full h-12 w-12 transition-all shadow-md ${
                    isRecording 
                    ? "animate-pulse ring-4 ring-destructive/30 scale-110" 
                    : "bg-primary hover:bg-primary/90"
                 }`}
                 onMouseDown={startRecording}
                 onMouseUp={stopRecording}
                 onTouchStart={startRecording}
                 onTouchEnd={stopRecording}
               >
                 {isRecording ? <StopCircle className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
               </Button>
            )}
          </div>
              </CardContent>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}