'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Send, StopCircle, Activity, Sparkles } from "lucide-react";

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
    
    setSocket(socketInstance); 

    // 3. CLEANUP
    return () => { 
        if (socketInstance.connected) {
            socketInstance.close(); 
        }
    };
  }, [userId]);

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
     
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl border-0 ring-1 ring-black/5 overflow-hidden rounded-3xl bg-white/90 backdrop-blur-xl">
          
          {/* Header */}
          <CardHeader className="border-b px-8 py-5 bg-white/60 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                   <div className="w-12 h-12 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Sparkles className="h-6 w-6 text-white" />
                   </div>
                   {socket?.connected && (
                     <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm"></span>
                   )}
                </div>
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight">Sarah</h1>
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">AI Receptionist</span>
                </div>
              </div>
              
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">
                  {socket?.connected ? 'System Online' : 'Connecting...'}
                </span>
              </div>
            </div>
          </CardHeader>
          
          {/* Chat Area */}
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50/50 relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
            
            <ScrollArea className="flex-1 p-6 md:p-8">
              <div className="space-y-6 max-w-3xl mx-auto">
                {messages.length === 0 && (
                   <div className="flex flex-col items-center justify-center text-center mt-20 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border flex items-center justify-center mb-2">
                        <Sparkles className="h-8 w-8 text-emerald-500/80" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-700">How can I help you today?</h3>
                      <p className="text-slate-400 max-w-xs text-sm leading-relaxed">
                        I can help you book appointments, refill prescriptions, or answer general inquiries.
                      </p>
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" className="text-xs rounded-full bg-white/50 hover:bg-white" onClick={() => setInput("Book a checkup")}>
                          "Book a checkup"
                        </Button>
                        <Button variant="outline" className="text-xs rounded-full bg-white/50 hover:bg-white" onClick={() => setInput("Clinic hours?")}>
                          "Clinic hours?"
                        </Button>
                      </div>
                   </div>
                )}
                
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[85%] md:max-w-[75%] p-4 md:p-5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                      m.role === 'user' 
                        ? 'bg-slate-900 text-white rounded-br-none shadow-slate-900/10' 
                        : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-sm'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}

                {isThinking && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-bl-none flex items-center gap-3 shadow-sm">
                      <div className="flex space-x-1.5">
                        <div className="w-2 h-2 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-emerald-500/60 rounded-full animate-bounce"></div>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">Sarah is typing...</span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-5 md:p-6 bg-white border-t border-slate-100/80 backdrop-blur-sm z-10">
              <div className="max-w-3xl mx-auto flex items-center gap-3 relative">
                <input
                  className="flex-1 bg-slate-50 border-slate-200 border rounded-full pl-6 pr-14 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner placeholder:text-slate-400"
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendText()}
                  disabled={isRecording}
                />
                
                <div className="absolute right-2 flex items-center gap-1">
                   {input.trim() ? (
                      <Button 
                        size="icon" 
                        className="rounded-full h-10 w-10 bg-slate-900 hover:bg-slate-800 shadow-md transition-all duration-300" 
                        onClick={sendText}
                      >
                        <Send className="h-4 w-4 text-white" />
                      </Button>
                   ) : (
                      <Button 
                        size="icon" 
                        variant={isRecording ? "destructive" : "ghost"}
                        className={`rounded-full h-10 w-10 transition-all duration-300 ${
                           isRecording 
                           ? "bg-red-500 hover:bg-red-600 animate-pulse ring-4 ring-red-500/20" 
                           : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5"
                        }`}
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
              <div className="text-center mt-3">
                 <p className="text-[10px] text-slate-400">
                    Press and hold the microphone to speak
                 </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}