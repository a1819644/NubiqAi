import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Mic } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import type { Chat, Message } from "../App";

interface ChatInterfaceProps {
  activeChat: Chat | null;
  onUpdateChat: (chat: Chat) => void;
}

export function ChatInterface({
  activeChat,
  onUpdateChat,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- PERBAIKAN UTAMA DI SINI ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages]); // Diganti ';' dengan ')' dan ditambah dependency array

  const handleFileAttach = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
    toast.success(`${files.length} file(s) attached`);
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
    toast.success("Recording started");
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    const voiceMessage = `Voice recording (${Math.floor(recordingTime / 60)}:${(
      recordingTime % 60
    )
      .toString()
      .padStart(2, "0")})`;
    handleSendMessage(voiceMessage, [], true);
    setRecordingTime(0);
    toast.success("Voice message sent");
  };

  const handleSendMessage = async (
    text: string = input,
    files: File[] = attachedFiles,
    isVoice: boolean = false
  ) => {
    if (!activeChat) return;
    if (!text.trim() && files.length === 0 && !isVoice) return;

    const isFirstMessage =
      activeChat.messages.filter((m) => m.sender === "user").length === 0;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: text || (files.length > 0 ? `Sent ${files.length} file(s)` : ""),
      sender: "user",
      timestamp: new Date(),
      attachments: files.map((f) => f.name),
    };

    const updatedChat = {
      ...activeChat,
      messages: [...activeChat.messages, newMessage],
      updatedAt: new Date(),
    };

    onUpdateChat(updatedChat);
    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: isVoice
          ? "I received your voice message. How can I help you with what you've shared?"
          : files.length > 0
          ? `I can see your files. How can I help you with ${files
              .map((f) => f.name)
              .join(", ")}?`
          : `I understand you're asking about: "${text}". Here's how I can help...`,
        sender: "ai",
        timestamp: new Date(),
      };

      const finalChat = {
        ...updatedChat,
        messages: [...updatedChat.messages, aiMessage],
        title: isFirstMessage
          ? (text || "New Chat").slice(0, 40) + (text.length > 40 ? "..." : "")
          : updatedChat.title,
      };

      onUpdateChat(finalChat);
      setIsLoading(false);
    }, 1000 + Math.random() * 2000);
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
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h1 className="text-xl font-medium">{activeChat.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activeChat.messages.length} messages
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-auto">
        {activeChat.messages.length === 0 && !isLoading ? (
          <div className="h-full flex items-center justify-center bg-background">
            <div className="text-center max-w-md px-6">
              <div className="mb-6">
                <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                  <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center">
                    <span className="text-white text-xs font-bold">AI</span>
                  </div>
                </div>
              </div>
              <div className="mb-6">
                <h2 className="text-lg font-medium text-foreground mb-2">
                  Welcome to AI Dashboard Portal
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Start a conversation, upload files, or record voice messages
                  <br />
                  to begin your AI-powered journey.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 justify-center text-xs font-medium"
                  >
                    💬 Chat with AI
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 justify-center text-xs font-medium"
                  >
                    📁 Upload Files
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={startRecording}
                    className="flex-1 justify-center text-xs font-medium"
                  >
                    🎤 Voice Recording
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 justify-center text-xs font-medium"
                  >
                    📝 Add Notes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 max-w-4xl mx-auto">
            {activeChat.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === "user"
                      ? "bg-black text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </p>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.attachments.map((file, idx) => (
                        <div key={idx} className="text-xs opacity-80">
                          📎 {file}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-3 max-w-4xl mx-auto"
        >
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Give a prompt"
              className="min-h-[44px] max-h-32 pr-20 resize-none border-input focus:border-ring focus:ring-1 focus:ring-ring"
              rows={1}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 text-gray-500" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`h-8 w-8 p-0 text-muted-foreground hover:bg-accent ${
                  isRecording ? "bg-red-100 hover:bg-red-200" : ""
                }`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                <Mic
                  className={`h-4 w-4 text-muted-foreground ${
                    isRecording ? "text-red-600 animate-pulse" : "text-gray-500"
                  }`}
                />
              </Button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={
              (!input.trim() && attachedFiles.length === 0) || isLoading
            }
            className="h-11 w-11 p-0 bg-black hover:bg-gray-800 rounded-lg"
          >
            <Send className="h-4 w-4 text-white" />
          </Button>
        </form>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileAttach}
          accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json"
        />
      </div>
    </div>
  );
}
