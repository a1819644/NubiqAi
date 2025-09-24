import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, MicOff } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { cn } from './ui/utils';
import type { Chat, Message } from '../App';

interface ChatInterfaceProps {
  activeChat: Chat | null;
  onUpdateChat: (chat: Chat) => void;
}

export function ChatInterface({ activeChat, onUpdateChat }: ChatInterfaceProps) {
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileAttach = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
    toast.success(`${files.length} file(s) attached`);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    toast.success('Recording started');
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    
    const voiceMessage = `Voice recording (${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')})`;
    handleSendMessage(voiceMessage, [], true);
    setRecordingTime(0);
    toast.success('Voice message sent');
  };

  const handleSendMessage = async (text: string = message, files: File[] = attachedFiles, isVoice: boolean = false) => {
    if (!activeChat) return;
    if (!text.trim() && files.length === 0 && !isVoice) return;
    
    // --- PERBAIKAN LOGIKA 1 ---
    const isFirstMessage = activeChat.messages.length === 0;
    // --- AKHIR PERBAIKAN 1 ---

    const newMessage: Message = {
      id: Date.now().toString(),
      content: text || (files.length > 0 ? `Sent ${files.length} file(s)` : ''),
      sender: 'user',
      timestamp: new Date(),
      attachments: files.map(f => f.name),
    };

    const updatedChat = {
      ...activeChat,
      messages: [...activeChat.messages, newMessage],
      updatedAt: new Date(),
    };

    onUpdateChat(updatedChat);
    setMessage('');
    setAttachedFiles([]);
    setIsLoading(true);

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: isVoice 
          ? "I received your voice message. How can I help you with what you've shared?"
          : files.length > 0 
            ? `I can see your files. How can I help you with ${files.map(f => f.name).join(', ')}?`
            : `I understand you're asking about: "${text}". Here's how I can help...`,
        sender: 'ai',
        timestamp: new Date(),
      };

      // --- PERBAIKAN LOGIKA 2 ---
      const finalChat = {
        ...updatedChat,
        messages: [...updatedChat.messages, aiMessage],
        title: isFirstMessage ? text.slice(0, 40) + (text.length > 40 ? '...' : '') : updatedChat.title,
      };
      // --- AKHIR PERBAIKAN 2 ---

      onUpdateChat(finalChat);
      setIsLoading(false);
    }, 1000 + Math.random() * 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">Welcome to AI Portal</h3>
          <p className="text-muted-foreground">Start a new chat to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b p-4">
        <h2 className="font-medium">{activeChat.title}</h2>
        <p className="text-sm text-muted-foreground">
          {activeChat.messages.length} messages
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {activeChat.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-lg p-3",
                  msg.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.attachments.map((attachment, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {attachment}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs opacity-70 mt-1 text-right">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      <div className="border-t p-4">
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => removeFile(index)}
              >
                {file.name} ×
              </Badge>
            ))}
          </div>
        )}

        {isRecording && (
          <div className="mb-3 flex items-center gap-2 text-sm text-destructive">
            <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
            Recording: {formatTime(recordingTime)}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Give a prompt"
              className="min-h-[40px] max-h-[120px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
          </div>
          
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(isRecording && "text-destructive hover:text-destructive")}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            
            <Button
              onClick={() => handleSendMessage()}
              disabled={(!message.trim() && attachedFiles.length === 0) || isLoading}
              size="sm"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileAttach}
        />
      </div>
    </div>
  );
}