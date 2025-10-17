import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Mic, Download, Eye, Copy, Check, Square, Pencil } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import type { ChatHistory as Chat, ChatMessage as Message, User } from "../types"; // UPDATED: Use centralized types
import { apiService, handleApiError } from "../services/api";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./ui/dialog";
import { copyToClipboard, isClipboardAvailable } from "../utils/clipboard";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { imageStorageService } from "../services/imageStorageService";

// Using a placeholder for image icon
const imageIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjY2NjYiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIvPgo8cGF0aCBkPSJNMiAxMkw2IDhMOCAxMEwxMiA2TDE0IDhWMTJIMloiIGZpbGw9IiM2NjY2NjYiLz4KPC9zdmc+';

interface ChatInterfaceProps {
  activeChat: Chat | null;
  user: User | null;
  onUpdateChat: (chat: Chat) => void;
}

export function ChatInterface({
  activeChat,
  user,
  onUpdateChat,
}: ChatInterfaceProps) {
  // Small inline helper to show truncated text with Show more/less
  const ExpandableText = ({ text, maxLength }: { text: string; maxLength: number }) => {
    const [expanded, setExpanded] = useState(false);
    if (text.length <= maxLength) return <pre className="whitespace-pre-wrap text-xs">{text}</pre>;
    return (
      <div>
        <pre className="whitespace-pre-wrap text-xs">{expanded ? text : text.slice(0, maxLength) + '...'}</pre>
        <Button size="sm" variant="ghost" onClick={() => setExpanded((s) => !s)}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      </div>
    );
  };
  
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
  const MAX_PREVIEW_LENGTH = 800; // chars before truncation
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isImageModeActive, setIsImageModeActive] = useState(false);
  const [pendingImagePrompt, setPendingImagePrompt] = useState<string | null>(null);
  // State for message editing
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Create a stable reference to avoid issues with null activeChat
  const chat = activeChat || {
    id: 'temp',
    title: 'New Chat',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // --- FIXING ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  // 💾 Preload images from IndexedDB when chat loads
  useEffect(() => {
    const preloadChatImages = async () => {
      if (!activeChat?.id || !user?.id) return;

      try {
        console.log(`🔍 Checking IndexedDB for cached images in chat ${activeChat.id}...`);
        const cachedImages = await imageStorageService.getChatImages(activeChat.id);
        
        if (cachedImages.length > 0) {
          console.log(`✅ Found ${cachedImages.length} cached images in IndexedDB`);
          
          // Update messages with cached images (if they're not already loaded)
          const updatedMessages = activeChat.messages.map(msg => {
            const cachedImage = cachedImages.find(img => img.id === msg.id);
            
            if (cachedImage && msg.attachments) {
              // Replace Firebase URL with cached base64 for instant loading
              const hasFirebaseUrl = msg.attachments.some(att => 
                typeof att === 'string' && att.startsWith('https://storage.googleapis.com')
              );
              
              if (hasFirebaseUrl) {
                return {
                  ...msg,
                  attachments: [cachedImage.imageData] // Use cached base64
                };
              }
            }
            
            return msg;
          });
          
          // Only update if we actually replaced some URLs
          const hasChanges = updatedMessages.some((msg, idx) => 
            msg.attachments !== activeChat.messages[idx].attachments
          );
          
          if (hasChanges) {
            onUpdateChat({ ...activeChat, messages: updatedMessages });
            console.log('✅ Loaded images from IndexedDB cache (instant)');
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to preload images from IndexedDB:', error);
      }
    };

    preloadChatImages();
  }, [activeChat?.id, user?.id]);

  // 🎯 OPTIMIZATION: Persist chat when window closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeChat && activeChat.messages.length > 0 && user) {
        const chatId = `initial-${activeChat.id}`;
        const userId = user.id; // Use actual user ID from auth
        
        // Use navigator.sendBeacon for reliable sending during page unload
        const data = JSON.stringify({ userId, chatId });
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon('http://localhost:8000/api/end-chat', blob);
        
        console.log(`✅ Chat ${chatId} will be persisted (window closing)`);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeChat, user]);

  const handleFileAttach = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(f.name);
        continue;
      }
      accepted.push(f);
    }

    if (accepted.length > 0) {
      setAttachedFiles((prev) => [...prev, ...accepted]);
      toast.success(`${accepted.length} file(s) attached`);
    }

    if (rejected.length > 0) {
      toast.error(`Skipped ${rejected.length} file(s) exceeding ${Math.round(MAX_FILE_SIZE / (1024*1024))}MB: ${rejected.join(', ')}`);
    }
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

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      // Set a flag on the controller to indicate it was an intentional stop
      (abortControllerRef.current as any).wasAborted = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      toast.info("AI response stopped.");
      // Remove any pending loading indicators from the chat
      if (activeChat) {
        onUpdateChat({ ...activeChat, messages: activeChat.messages.filter(m => !m.attachments?.includes('__processing_file__') && !m.attachments?.includes('__generating_image__')) });
      }
    }
  };

  const handleSendMessage = async (
    text: string = input,
    files: File[] = attachedFiles,
    isVoice: boolean = false,
    isContinuation: boolean = false, // NEW PARAMETER FOR PREVENT DUPLICATIONS
    skipConfirmation: boolean = false, // NEW: Skip image confirmation check
    continuationChat?: Chat // Optional chat state for continuations
  ) => {
    if (!activeChat) return;
    if (!text.trim() && files.length === 0 && !isVoice) return;

    // 🔒 CAPTURE THE CHAT ID AND STATE AT THE TIME OF SENDING
    // This ensures responses go to the correct chat even if user switches chats
    const targetChatId = activeChat.id;
    const targetChatSnapshot = { ...activeChat };
    
    // Helper function to safely update the target chat, even if activeChat has changed
    const safeUpdateChat = (chatUpdater: (chat: Chat) => Chat) => {
      const updatedTargetChat = chatUpdater(targetChatSnapshot);
      // Update the snapshot for next call
      Object.assign(targetChatSnapshot, updatedTargetChat);
      // Always update using the snapshot with the captured ID
      onUpdateChat(updatedTargetChat);
    };
    
    let updatedChat = { ...targetChatSnapshot };
    let isFirstMessage = false;

    // Use the provided chat state for continuations (like message edits)
    if (!isContinuation) {
      isFirstMessage = targetChatSnapshot.messages.filter((m) => m.role === "user").length === 0;

      const newMessage: Message = {
        id: Date.now().toString(),
        content: text || (files.length > 0 ? `Sent ${files.length} file(s)` : ""),
        role: "user",
        timestamp: new Date(),
        attachments: files.map((f) => f.name),
      };

      updatedChat = {
        ...targetChatSnapshot,
        messages: [...targetChatSnapshot.messages, newMessage],
        updatedAt: new Date(),
      };

      safeUpdateChat(() => updatedChat);
      setInput("");
      setAttachedFiles([]);
    } else if (continuationChat) {
      updatedChat = continuationChat;
    }

    setIsLoading(true);
    // Create and store a new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    try {
      // --- LOGIC CONFIRMATION IMAGE---
      // More precise image generation detection - require explicit image-related phrases
      const imageKeywords = [
        'generate image', 'generate an image', 'generate a picture',
        'create image', 'create an image', 'create a picture',
        'draw image', 'draw an image', 'draw a picture', 'draw me',
        'make image', 'make an image', 'make a picture',
        'gambar', 'buatkan gambar'
      ];
      const textLower = text.toLowerCase();
      const containsImageKeyword = imageKeywords.some(keyword => textLower.includes(keyword));
      const isImagineCommand = text.trim().startsWith('/imagine');

      // 🎨 Direct image generation without confirmation
      if (containsImageKeyword && !isImagineCommand && !isImageModeActive && !skipConfirmation) {
        console.log('🎨 Detected image generation request - processing directly!');
        console.log('🖼️ Generating image with prompt:', text);
        
        // Insert a placeholder AI message to show a skeleton while image generates
        const placeholderMessage: Message = {
          id: `gen-${Date.now()}`,
          content: 'Generating your image...',
          role: 'assistant',
          timestamp: new Date(),
          attachments: ['__generating_image__'],
        };

        const chatWithPlaceholder = {
          ...updatedChat,
          messages: [...updatedChat.messages, placeholderMessage],
        };

        safeUpdateChat(() => chatWithPlaceholder);

        // Build conversation history from current chat for context
        const history = updatedChat.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-10) // Last 10 messages for context
          .map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          }));

        // Call backend image generation with user context AND conversation history
        const imgResp = await apiService.generateImage(
          text,
          user?.id,
          targetChatId,
          user?.name,
          history // 🎯 Pass conversation context!
        );

        console.log('📥 Image generation response:', {
          success: imgResp.success,
          hasImageBase64: !!imgResp.imageBase64,
          hasImageUri: !!imgResp.imageUri,
        });

        if (imgResp.success && (imgResp.imageBase64 || imgResp.imageUri)) {
          // Store image in IndexedDB for persistence
          const imageUrl = imgResp.imageUri || imgResp.imageBase64!;
          const imageId = `${user?.id}_${targetChatId}_${Date.now()}`;

          try {
            await imageStorageService.storeImage(
              imageId,
              user?.id || 'anonymous',
              targetChatId,
              imageUrl,
              text,
              imgResp.imageUri || undefined
            );
            console.log('💾 Image cached in IndexedDB for instant loading');
          } catch (cacheError) {
            console.warn('⚠️ Failed to cache image in IndexedDB:', cacheError);
          }

          // Create the actual image message
          const imageMessage: Message = {
            id: `img-${Date.now()}`,
            content: imgResp.altText || text,
            role: 'assistant',
            timestamp: new Date(),
            attachments: [imageUrl],
          };

          const finalChat = {
            ...chatWithPlaceholder,
            messages: [
              ...chatWithPlaceholder.messages.filter(m => m.id !== placeholderMessage.id),
              imageMessage
            ]
          };

          safeUpdateChat(() => finalChat);
          setIsLoading(false);
          toast.success('✨ Image generated successfully!');
          return;
        } else {
          // Image generation failed
          const errorMessage: Message = {
            id: `err-${Date.now()}`,
            content: imgResp.error || 'Failed to generate image. Please try again.',
            role: 'assistant',
            timestamp: new Date(),
          };

          const errorChat = {
            ...chatWithPlaceholder,
            messages: [
              ...chatWithPlaceholder.messages.filter(m => m.id !== placeholderMessage.id),
              errorMessage
            ]
          };

          safeUpdateChat(() => errorChat);
          setIsLoading(false);
          toast.error('Failed to generate image');
          return;
        }
      }

      // Check if this request is still the active one before updating UI
      if (abortControllerRef.current !== controller) return;

      // Check for /imagine command at the start of the message
      const imagineMatch = text.trim().match(/^\/imagine\s+(.+)$/i);
      if (imagineMatch || isImageModeActive) {
        const prompt = imagineMatch ? imagineMatch[1].trim() : text.trim();

        // Insert a placeholder AI message to show a skeleton while image generates
        const placeholderMessage: Message = {
          id: `gen-${Date.now()}`,
          content: 'Generating image...',
          role: 'assistant',
          timestamp: new Date(),
          attachments: ['__generating_image__'],
        };

        const chatWithPlaceholder = {
          ...updatedChat,
          messages: [...updatedChat.messages, placeholderMessage],
        };

        // Check if this request is still the active one before updating UI
        if (abortControllerRef.current !== controller) return;

        safeUpdateChat(() => chatWithPlaceholder);

        // Call backend image generation with user context
        const imgResp = await apiService.generateImage(
          prompt,
          user?.id,
          targetChatId,
          user?.name
        );

        console.log('📥 Image generation response:', {
          success: imgResp.success,
          hasImageBase64: !!imgResp.imageBase64,
          imageBase64Length: imgResp.imageBase64?.length || 0,
          hasImageUri: !!imgResp.imageUri,
          imageUri: imgResp.imageUri,
          altText: imgResp.altText
        });

        if (imgResp.success && (imgResp.imageBase64 || imgResp.imageUri)) {
          const imageUrl = imgResp.imageBase64
            ? `data:image/png;base64,${imgResp.imageBase64}`
            : imgResp.imageUri!;

          console.log('🖼️ Creating image URL:', imageUrl.substring(0, 100) + '...');

          // 💾 Store image in IndexedDB for instant loading on page reload
          const messageId = (Date.now() + 2).toString();
          try {
            if (user?.id && imageUrl) {
              await imageStorageService.storeImage(
                messageId,
                user.id,
                targetChatId,
                imageUrl,
                prompt,
                imgResp.imageUri || undefined // Firebase Storage URL
              );
              console.log('💾 Image cached in IndexedDB for instant loading');
            }
          } catch (cacheError) {
            console.warn('⚠️ Failed to cache image in IndexedDB (non-critical):', cacheError);
          }

          const aiImageMessage: Message = {
            id: messageId,
            content: imgResp.altText || `Image generated for: ${prompt}`,
            role: 'assistant',
            timestamp: new Date(),
            attachments: [imageUrl],
          };

          console.log('✅ Image message created, updating chat...');

          // Replace placeholder with actual image message
          const finalMessages = chatWithPlaceholder.messages
            .filter((m) => !(m.attachments && m.attachments.includes('__generating_image__')))
            .concat(aiImageMessage);

          const finalChat = {
            ...chatWithPlaceholder,
            messages: finalMessages,
            title: isFirstMessage
              ? (prompt || 'New Chat').slice(0, 40) + (prompt.length > 40 ? '...' : '')
              : chatWithPlaceholder.title,
          };

          // Check if this request is still the active one before updating UI
          if (abortControllerRef.current !== controller) return;

          safeUpdateChat(() => finalChat);
          setIsImageModeActive(false); // Deactivate image mode after sending
          setIsLoading(false);
          // If the request was aborted while we were processing, the controller would be null.
          // We should stop here to prevent further execution.
          if (!abortControllerRef.current) {
            console.log("Image generation was stopped by user.");
            return;
          }
          return;
        } else {
          throw new Error(imgResp.error || 'Image generation failed');
        }
      }

      // Find image file if any
      const imageFile = files.find(file => file.type.startsWith('image/'));
      
      // 🧠 MEMORY SYSTEM LOGGING
      console.group('🧠 Memory System - Request');
      console.log('📤 Sending to AI:', {
        chatId: targetChatId,
        messageCount: targetChatSnapshot.messages.length,
        isNewChat: targetChatSnapshot.messages.length === 0,
        useMemory: true,
        promptPreview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
      });
      console.groupEnd();
      
      // 📝 Prepare conversation history (previous messages for context)
      const conversationHistory = targetChatSnapshot.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Call the backend API with chat-scoped memory
      const response = await apiService.askAI({
        message: text,
        image: imageFile,
        chatId: targetChatId,                          // 🎯 NEW! For chat-scoped memory
        messageCount: targetChatSnapshot.messages.length, // 🎯 NEW! Detect new vs continuing chat
        conversationHistory,                           // 🎯 NEW! Send previous messages for context
        userId: user?.id,                              // 🎯 NEW! Pass actual user ID from auth
        userName: user?.name,                          // 🎯 NEW! Pass user name for auto-profile creation
        useMemory: true
      });

      // 🧠 MEMORY SYSTEM LOGGING
      console.group('🧠 Memory System - Response');
      console.log('✅ Response received:', {
        success: response.success,
        textLength: response.text?.length || 0,
        chatId: targetChatId,
        messageCount: targetChatSnapshot.messages.length + 1
      });
      console.groupEnd();

      if (response.success && response.text) {
        // Check if response includes an image (AI detected image request)
        const hasImage = (response as any).isImageGeneration && 
                        ((response as any).imageBase64 || (response as any).imageUri);
        
        if (hasImage) {
          console.log('🖼️ AI response includes generated image!');
          
          // Create image URL
          const imageUrl = (response as any).imageBase64
            ? `data:image/png;base64,${(response as any).imageBase64}`
            : (response as any).imageUri!;
          
          const messageId = (Date.now() + 1).toString();
          
          // 💾 Store image in IndexedDB for instant loading on page reload
          try {
            if (user?.id && imageUrl) {
              await imageStorageService.storeImage(
                messageId,
                user.id,
                targetChatId,
                imageUrl,
                text, // Original user prompt
                (response as any).imageUri || undefined
              );
              console.log('💾 Image cached in IndexedDB for instant loading');
            }
          } catch (cacheError) {
            console.warn('⚠️ Failed to cache image in IndexedDB (non-critical):', cacheError);
          }
          
          const aiMessage: Message = {
            id: messageId,
            content: response.text,
            role: "assistant",
            timestamp: new Date(),
            attachments: [imageUrl], // Include the image as attachment
          };

          const finalChat = {
            ...updatedChat,
            messages: [...updatedChat.messages, aiMessage],
            title: isFirstMessage
              ? (text || "New Chat").slice(0, 40) + (text.length > 40 ? "..." : "")
              : updatedChat.title,
          };

          // Check if this request is still the active one before updating UI
          if (abortControllerRef.current !== controller) return;

          safeUpdateChat(() => finalChat);
          setIsLoading(false);
          return;
        }
        
        // Regular text response (no image)
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response.text,
          role: "assistant",
          timestamp: new Date(),
        };

        const finalChat = {
          ...updatedChat,
          messages: [...updatedChat.messages, aiMessage],
          title: isFirstMessage
            ? (text || "New Chat").slice(0, 40) + (text.length > 40 ? "..." : "")
            : updatedChat.title,
        };

        // Check if this request is still the active one before updating UI
        if (abortControllerRef.current !== controller) return;

        safeUpdateChat(() => finalChat);
        // If the request was aborted while we were processing, the controller would be null.
        // We should stop here to prevent further execution.
        if (!abortControllerRef.current) {
          console.log("AI response generation was stopped by user.");
          return;
        }
      } else {
        throw new Error('Failed to get AI response');
      }
      
      // If there are non-image files attached, process them using processDocument
      const nonImageFiles = files.filter(f => !f.type.startsWith('image/'));
      for (const file of nonImageFiles) {
        // create placeholder
        const placeholder: Message = {
          id: `proc-${Date.now()}`,
          content: `Processing file: ${file.name}`,
          role: 'assistant',
          timestamp: new Date(),
          attachments: ['__processing_file__']
        };

        const withPlaceholder = {
          ...updatedChat,
          messages: [...updatedChat.messages, placeholder],
        };

        // Check if this request is still the active one before updating UI
        if (abortControllerRef.current !== controller) return;

        safeUpdateChat(() => withPlaceholder);

        // convert file to base64
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        try {
          const procResp = await apiService.processDocument({ fileBase64: base64, mimeType: file.type });
          if (procResp.success && procResp.extractedText) {
            const resultMessage: Message = {
              id: (Date.now() + 3).toString(),
              content: `Extracted from ${file.name}:\n\n${procResp.extractedText}`,
              role: 'assistant',
              timestamp: new Date(),
            };

            const replacedMessages = withPlaceholder.messages
              .filter(m => !(m.attachments && m.attachments.includes('__processing_file__')))
              .concat(resultMessage);

            // Check if this request is still the active one before updating UI
            if (abortControllerRef.current !== controller) return;

            safeUpdateChat((chat) => ({ ...chat, messages: replacedMessages }));
            // If the request was aborted while we were processing, the controller would be null.
            // We should stop here to prevent further execution.
            if (!abortControllerRef.current) {
              console.log("File processing was stopped by user.");
              return;
            }
          } else {
            throw new Error(procResp.error || 'Document processing failed');
          }
        } catch (err) {
          // Check if the error is due to the request being aborted
          if ((err as Error).name === 'AbortError') {
            // Don't add an error message to the chat if the user cancelled it.
            // The handleStopGeneration function will show a toast.
            return;
          }
          const errorMessage = handleApiError(err);
          // Provide a more helpful message if it's a timeout
          let friendly = `Failed to process ${file.name}: ${errorMessage}`;
          if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out')) {
            friendly += ' — processing timed out. Try a smaller file (under 4MB), or try again later.';
          }

          const errorMsg: Message = {
            id: (Date.now() + 4).toString(),
            content: friendly,
            role: 'assistant',
            timestamp: new Date(),
          };

          const replacedMessages = withPlaceholder.messages
            .filter(m => !(m.attachments && m.attachments.includes('__processing_file__')))
            .concat(errorMsg);

          // Check if this request is still the active one before updating UI
          if (abortControllerRef.current !== controller) return;

          safeUpdateChat((chat) => ({ ...chat, messages: replacedMessages }));
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Check if the error is due to the request being aborted
      // Also check our custom flag to ensure it was a user-initiated stop
      if ((error as Error).name === 'AbortError' && (signal as any).aborted && (controller as any).wasAborted) {
        console.log('Request was aborted by the user.');
        // The handleStopGeneration function already shows a toast
        return; // Exit without showing a generic error
      }

      const errorMessage = handleApiError(error);
      
      // Add error message to chat
      const errorAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        role: "assistant",
        timestamp: new Date(),
      };

      const finalChat = {
        ...updatedChat,
        messages: [...updatedChat.messages, errorAiMessage],
        title: isFirstMessage
          ? (text || "New Chat").slice(0, 40) + (text.length > 40 ? "..." : "")
          : updatedChat.title,
      };

      // Check if this request is still the active one before updating UI
      if (abortControllerRef.current !== controller) return;

      safeUpdateChat(() => finalChat);
      toast.error(`Failed to send message: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setIsImageModeActive(false); // 🔧 FIX: Always reset image mode, even on error
      abortControllerRef.current = null; // Clean up controller
    }
  };

  // Image viewer modal state & helpers
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerAlt, setViewerAlt] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [maskFile, setMaskFile] = useState<File | null>(null);
  // Mask drawing state
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskImgRef = useRef<HTMLImageElement | null>(null);
  const [isDrawingMask, setIsDrawingMask] = useState(false);
  const [brushSize, setBrushSize] = useState(24);
  const [maskDirty, setMaskDirty] = useState(false);
  const [showMaskPreview, setShowMaskPreview] = useState(true);

  const openImageViewer = (src: string, alt?: string) => {
    setViewerSrc(src);
    setViewerAlt(alt || null);
    setViewerOpen(true);
  };

  // Ensure mask canvas matches image dimensions when viewer opens
  useEffect(() => {
    if (!viewerSrc || !maskCanvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = maskCanvasRef.current!;
      // use intrinsic image pixels for canvas internal resolution
      const naturalW = img.naturalWidth || img.width || 1;
      const naturalH = img.naturalHeight || img.height || 1;
      canvas.width = naturalW;
      canvas.height = naturalH;

      // ensure the canvas CSS size matches the displayed image size so overlay aligns
      const displayedW = maskImgRef.current?.clientWidth ?? naturalW;
      const displayedH = maskImgRef.current?.clientHeight ?? naturalH;
      canvas.style.width = `${displayedW}px`;
      canvas.style.height = `${displayedH}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0,0,canvas.width, canvas.height);
      // initialize transparent background
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0,0,canvas.width, canvas.height);
      setMaskDirty(false);
    };
    img.src = viewerSrc;
  }, [viewerSrc]);

  // Keep canvas CSS size in sync with the displayed image so overlay coordinates match
  useEffect(() => {
    const sync = () => {
      const canvas = maskCanvasRef.current;
      const img = maskImgRef.current;
      if (!canvas || !img) return;
      const w = img.clientWidth || canvas.width;
      const h = img.clientHeight || canvas.height;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    // initial sync
    sync();

    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(sync);
      if (maskImgRef.current) ro.observe(maskImgRef.current);
    } catch (err) {
      window.addEventListener('resize', sync);
    }

    return () => {
      if (ro && maskImgRef.current) ro.unobserve(maskImgRef.current);
      window.removeEventListener('resize', sync);
    };
  }, [viewerSrc]);

  const downloadImage = (src: string | null, filename?: string) => {
    if (!src) return;
    try {
      const link = document.createElement('a');
      link.href = src;
      link.download = filename || `image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download failed', err);
      toast.error('Download failed');
    }
  };

  const handleMaskSelect = (f: File | null) => {
    setMaskFile(f);
    // if user selects a mask file, load it into canvas
    if (f && maskCanvasRef.current) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = maskCanvasRef.current!;
          // keep canvas internal resolution, but draw the uploaded mask scaled to it
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // draw image scaled to canvas resolution so mask aligns with original image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setMaskDirty(true);
        };
        if (typeof reader.result === 'string') img.src = reader.result;
      };
      reader.readAsDataURL(f);
    }
  };

  const performImageEdit = async (closeOnSubmit: boolean = false) => {
    if (!viewerSrc) return;
    if (closeOnSubmit) setViewerOpen(false);
    setIsEditing(true);

    // Ensure we have base64 data
    let imageBase64 = '';
    if (viewerSrc.startsWith('data:')) {
      imageBase64 = viewerSrc.split(',')[1];
    } else {
      // fetch image and convert to base64
      try {
        const r = await fetch(viewerSrc);
        const blob = await r.blob();
        const buffer = await blob.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        imageBase64 = btoa(binary);
      } catch (err) {
        toast.error('Failed to load image for editing');
        setIsEditing(false);
        return;
      }
    }

    // If a drawn mask exists use the canvas; otherwise fall back to maskFile
    let maskBase64: string | null = null;
    if (maskDirty && maskCanvasRef.current) {
      try {
        const canvas = maskCanvasRef.current;
        // Create a temporary canvas to produce a clean binary mask (white where painted)
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width;
        tmp.height = canvas.height;
        const tctx = tmp.getContext('2d')!;

        // Get source pixels from the user's mask canvas
        const sctx = canvas.getContext('2d')!;
        const src = sctx.getImageData(0,0,canvas.width, canvas.height);
        const out = tctx.createImageData(canvas.width, canvas.height);

        // Convert any non-transparent pixel (or red channel strong) to white opaque in mask
        for (let i = 0; i < src.data.length; i += 4) {
          const r = src.data[i];
          const a = src.data[i+3];
          const painted = a > 10 || r > 50; // threshold
          if (painted) {
            out.data[i] = 255;
            out.data[i+1] = 255;
            out.data[i+2] = 255;
            out.data[i+3] = 255;
          } else {
            out.data[i] = 0;
            out.data[i+1] = 0;
            out.data[i+2] = 0;
            out.data[i+3] = 0;
          }
        }

        tctx.putImageData(out, 0, 0);
        const dataUrl = tmp.toDataURL('image/png');
        maskBase64 = dataUrl.split(',')[1];
      } catch (err) {
        console.error('Failed to read mask canvas', err);
        // continue to try maskFile if available
      }
    }

    if (!maskBase64 && maskFile) {
      const buf = await maskFile.arrayBuffer();
      let bstr = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) bstr += String.fromCharCode(bytes[i]);
      maskBase64 = btoa(bstr);
    }

    // show a placeholder in the chat for edited image
    const placeholderId = `edit-${Date.now()}`;
    const placeholderMsg: Message = {
      id: placeholderId,
      content: `Editing image... ${editPrompt}`,
      role: 'assistant',
      timestamp: new Date(),
      attachments: ['__editing_image__']
    };

    if (activeChat) {
      onUpdateChat({ ...activeChat, messages: [...activeChat.messages, placeholderMsg] });
    }

    try {
      let editResp;
      if (maskBase64) {
        editResp = await apiService.editImageWithMask({ imageBase64, maskBase64, editPrompt });
      } else {
        editResp = await apiService.editImage({ imageBase64, editPrompt });
      }

      if (editResp.success && (editResp.imageBase64 || editResp.imageUri)) {
        const newUrl = editResp.imageBase64 ? `data:image/png;base64,${editResp.imageBase64}` : editResp.imageUri!;

        // Replace placeholder in activeChat
        if (activeChat) {
          const filtered = activeChat.messages.filter(m => !(m.attachments && m.attachments.includes('__editing_image__')));
          const newMsg: Message = {
            id: (Date.now() + 1).toString(),
            content: editResp.altText || `Edited image: ${editPrompt}`,
            role: 'assistant',
            timestamp: new Date(),
            attachments: [newUrl]
          };
          onUpdateChat({ ...activeChat, messages: [...filtered, newMsg] });
        }

        setViewerSrc(newUrl);
        // Dialog sudah ditutup di awal jika closeOnSubmit true
        toast.success('Image edited');
      } else {
        throw new Error(editResp.error || 'Image edit failed');
      }
    } catch (err) {
      const msg = handleApiError(err);
      toast.error(`Edit failed: ${msg}`);
      // remove placeholder and leave original viewer
      if (activeChat) {
        const filtered = activeChat.messages.filter(m => !(m.attachments && m.attachments.includes('__editing_image__')));
        onUpdateChat({ ...activeChat, messages: filtered });
      }
      // Jika gagal, buka kembali dialognya agar pengguna bisa mencoba lagi
      if (closeOnSubmit) {
        setViewerOpen(true);
      }
    } finally {
      setIsEditing(false);
      setMaskFile(null);
    }
  };

  const handleEditMessage = (messageId: string) => {
    if (!activeChat) return;

    const messageIndex = activeChat.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Create a new message history up to the point of the edited message
    const newMessages = activeChat.messages.slice(0, messageIndex);

    // Create the updated user message
    const updatedUserMessage: Message = {
      ...activeChat.messages[messageIndex],
      content: editedContent,
      timestamp: new Date(), // Optionally update timestamp
    };
    newMessages.push(updatedUserMessage);

    // Update the chat state to reflect the edit immediately
    const updatedChat = { ...activeChat, messages: newMessages };
    onUpdateChat(updatedChat);

    // Resend the message to the AI for a new response
    handleSendMessage(editedContent, [], false, true, false, updatedChat); // Pass the truncated chat state
    setEditingMessageId(null); // Exit editing mode
  };

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      const success = await copyToClipboard(content);
      
      if (success) {
        setCopiedMessageId(messageId);
        toast.success('Message copied to clipboard');
        
        // Reset the copied state after 2 seconds
        setTimeout(() => {
          setCopiedMessageId(null);
        }, 2000);
      } else {
        toast.error('Copy failed. Please select this text manually:', {
          description: content.length > 100 ? content.substring(0, 100) + '...' : content,
          duration: 10000,
        });
      }
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleImageClick = () => {
    if (isImageModeActive) {
      // Deactivate image mode
      setIsImageModeActive(false);
      toast.error('Image generation mode deactivated');
    } else {
      // Activate image mode
      setIsImageModeActive(true);
      toast.success('Image generation mode activated');
    }
  };

  const handleConfirmation = (confirmationId: string, confirmed: boolean) => {
    const chatWithoutConfirmation = { ...activeChat!, messages: activeChat!.messages.filter(m => m.id !== confirmationId) };
    onUpdateChat(chatWithoutConfirmation);

    if (confirmed) {
      if (pendingImagePrompt) {
        // Set image mode to true. The useEffect will then trigger the send.
        // This decouples confirmation from sending and prevents race conditions.
        setIsImageModeActive(true);
        toast.success("Starting image generation...");
      }
    } else {
      // If ‘No’ is clicked, also clear the saved prompt and provide a notification.
      if (pendingImagePrompt) {
        const promptToSend = pendingImagePrompt;
        setPendingImagePrompt(null); // Clear the saved prompt
        setIsLoading(false); // Ensure loading state is reset
        setIsImageModeActive(false); // Make sure image mode is off
        toast.info("Sending as regular chat message...");
        
        // Send the original prompt as a normal chat message (skipConfirmation=true to avoid infinite loop)
        handleSendMessage(promptToSend, [], false, false, true);
      }
    }
  };

  // This effect handles sending a message after image mode is confirmed and activated.
  useEffect(() => {
    // Only run if image mode is active and there's a prompt waiting.
    if (isImageModeActive && pendingImagePrompt) {
      // Use isContinuation: true to prevent duplicating the user's message.
      // The original message that triggered the confirmation is already in the chat.
      handleSendMessage(pendingImagePrompt, [], false, true, false, chat);
      setPendingImagePrompt(null); // Clear the prompt after sending.
    }
  }, [isImageModeActive, pendingImagePrompt]); // Dependencies are correct

  // Effect to handle 'Enter' key for confirmation dialog globally
  useEffect(() => {
    const lastMessage = activeChat?.messages[activeChat.messages.length - 1];
    const isConfirmationPending = lastMessage?.type === 'confirmation' && lastMessage.confirmationId;

    if (!isConfirmationPending) {
      return; // Do nothing if no confirmation is active
    }

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleConfirmation(lastMessage.confirmationId!, true);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);

    // Cleanup the event listener when the component unmounts or dependencies change
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeChat?.messages]); // Rerun when messages change

  // If no active chat, show a placeholder
  if (!activeChat) {
    return (
      <div className="flex flex-col h-full bg-background text-foreground items-center justify-center">
        <p className="text-muted-foreground">No active chat. Click "New Chat" to start.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h1 className="text-xl font-medium">{chat.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {chat.messages.length} messages
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-auto">
        {chat.messages.length === 0 ? (
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
                  <button className="flex-1 h-10 px-3 bg-muted hover:bg-accent border border-border rounded-md flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground transition-colors">
                    💬 Chat with AI
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 h-10 px-3 bg-muted hover:bg-accent border border-border rounded-md flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground transition-colors">
                    📁 Upload Files
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={startRecording} className="flex-1 h-10 px-3 bg-muted hover:bg-accent border border-border rounded-md flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground transition-colors">
                    🎤 Voice Recording
                  </button>
                  <button className="flex-1 h-10 px-3 bg-muted hover:bg-accent border border-border rounded-md flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground transition-colors">
                    📝 Add Notes
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {chat.messages.map((message) => (
              <div
                key={message.id}
                className={`group flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {/* Handle confirmation messages */}
                {message.type === 'confirmation' && message.confirmationId ? (
                  <ConfirmationDialog
                    key={message.id}
                    message={message.content || 'Confirm action?'}
                    onConfirm={() => handleConfirmation(message.confirmationId!, true)}
                    onCancel={() => handleConfirmation(message.confirmationId!, false)}
                  />
                ) : editingMessageId === message.id ? (
                  // WIDER EDITING UI
                  <div className="w-full flex flex-col gap-2">
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="bg-background text-foreground text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleEditMessage(message.id);
                        } else if (e.key === 'Escape') {
                          setEditingMessageId(null);
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditingMessageId(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleEditMessage(message.id)}>
                        Save & Submit
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Original message rendering logic
                  <div className="flex flex-col max-w-lg items-end">
                      <div className={`relative`}>
                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        > 
                            <p className="whitespace-pre-wrap text-sm">
                              {message.content}
                            </p>

                          {/* Attachment handling */}
                          {message.attachments && message.attachments.length > 0 && editingMessageId !== message.id && (
                            <div className="mt-2 space-y-1">
                              {message.attachments.map((file, idx) => (
                                <React.Fragment key={idx}>
                                  {typeof file === 'string' && file === '__generating_image__' ? (
                                    <div className="w-64 h-40 bg-gray-100 rounded-md animate-pulse flex items-center justify-center">
                                      <div className="text-sm text-muted-foreground">Generating image...</div>
                                    </div>
                                  ) : typeof file === 'string' && file.startsWith('data:image') ? (
                                    <div className="flex flex-col gap-2">
                                      <img
                                        src={file}
                                        alt={`generated-${idx}`}
                                        className="max-w-xs rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => openImageViewer(file, message.content)}
                                      />
                                      <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => openImageViewer(file, message.content)}>
                                          <Eye className="mr-2 h-4 w-4" /> Open
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => downloadImage(file)}>
                                          <Download className="mr-2 h-4 w-4" /> Download
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs opacity-80">📎 {file}</div>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 px-1">
                          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                          {/* Action Buttons */}
                          {(message.content && message.content.trim()) && (
                            <div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleCopyMessage(message.id, message.content || '')}
                                title={isClipboardAvailable() ? 'Copy message' : 'Copy not available'}
                              >
                                {copiedMessageId === message.id ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                          {/* Edit Button for user messages */}
                          {message.role === 'user' && !editingMessageId && (
                            <div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => { setEditingMessageId(message.id); setEditedContent(message.content || ''); }}
                                title="Edit message"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                      </div>
                    </div>
                )}
                {/* This block is kept for extracted text, but image rendering is moved */}
                {/*
                  {message.content?.startsWith?.('Extracted from') && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-md border border-border">
                      {message.content.length > MAX_PREVIEW_LENGTH ? (
                        <ExpandableText text={message.content} maxLength={MAX_PREVIEW_LENGTH} />
                      ) : (
                        <pre className="whitespace-pre-wrap text-xs">{message.content}</pre>
                      )}
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => { navigator.clipboard.writeText(message.content); toast.success('Copied'); }}>
                          Copy
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => {
                          // Download as .txt
                          const blob = new Blob([message.content], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          downloadImage(url, `${message.id || 'extracted'}.txt`);
                          URL.revokeObjectURL(url);
                        }}>
                          Download
                        </Button>
                      </div>
                    </div>
                  )}
                */}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex flex-col">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
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
          <div className="max-w-4xl mx-auto mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <Button
                key={index}
                variant="secondary"
                className="cursor-pointer h-auto py-1 px-2"
                onClick={() => removeFile(index)}
              >
                <span className="text-xs">{file.name}</span>
                <span className="ml-2 font-bold">×</span>
              </Button>
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
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();

                  // --- PERUBAHAN DIMULAI DI SINI ---
                  // Cek apakah ada pesan konfirmasi yang aktif
                  const lastMessage = activeChat?.messages[activeChat.messages.length - 1];
                  const isConfirmationPending = lastMessage?.type === 'confirmation' && lastMessage.confirmationId;

                  if (isConfirmationPending) {
                    // Jika ada, 'Enter' akan langsung menyetujui konfirmasi
                    handleConfirmation(lastMessage.confirmationId!, true);
                    return; // Hentikan eksekusi lebih lanjut
                  }
                  // --- PERUBAHAN SELESAI DI SINI ---

                  handleSendMessage();
                }
              }}
              placeholder="Give a prompt"
              className="min-h-[44px] max-h-32 pr-28 resize-none border-input focus:border-ring focus:ring-1 focus:ring-ring"
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
                className={`h-8 w-8 p-0 hover:bg-gray-100 flex-shrink-0 ${
                  isImageModeActive ? 'bg-blue-100 hover:bg-blue-200' : ''
                }`}
                onClick={handleImageClick}
                title="Toggle Image Generation Mode"
              >
                <img 
                  src={imageIcon} 
                  alt="Generate Image" 
                  className={`h-4 w-4 object-contain ${
                    isImageModeActive ? 'opacity-100' : 'opacity-70'
                  }`}
                />
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
          {isLoading ? (
            <Button
              type="button"
              onClick={handleStopGeneration}
              className="h-11 w-11 p-0 bg-destructive hover:bg-destructive/90 rounded-lg"
              title="Stop generating"
            >
              <Square className="h-4 w-4 text-white" />
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim() && attachedFiles.length === 0} className="h-11 w-11 p-0 bg-black hover:bg-gray-800 rounded-lg">
              <Send className="h-4 w-4 text-white" />
            </Button>
          )}
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
      {/* Image viewer modal */}
      <Dialog open={viewerOpen} onOpenChange={(open) => setViewerOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Image Preview</DialogTitle>
          <DialogDescription>{viewerAlt}</DialogDescription>
          <div className="mt-4">
            {viewerSrc ? (
              <div className="relative">
                <img ref={maskImgRef} src={viewerSrc} alt={viewerAlt || 'preview'} className="w-full h-auto rounded-md block" />
                <canvas
                  ref={(el) => (maskCanvasRef.current = el)}
                  className="absolute top-0 left-0 rounded-md pointer-events-auto"
                  style={{ top: 0, left: 0, zIndex: 20, cursor: 'crosshair' as any, opacity: showMaskPreview ? 0.9 : 0 }}
                  onPointerDown={(e) => {
                    const canvas = maskCanvasRef.current;
                    const imgEl = maskImgRef.current;
                    if (!canvas || !imgEl) return;
                    const rect = imgEl.getBoundingClientRect();
                    const ctx = canvas.getContext('2d')!;
                    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                    ctx.globalCompositeOperation = 'source-over';
                    // draw visible semi-transparent red for user feedback
                    ctx.fillStyle = 'rgba(255,0,0,0.5)';
                    ctx.beginPath();
                    ctx.arc(x, y, brushSize/2, 0, Math.PI * 2);
                    ctx.fill();
                    setMaskDirty(true);
                    // ensure pointer capture on the canvas element
                    try { canvas.setPointerCapture(e.pointerId); } catch {}
                    setIsDrawingMask(true);
                  }}
                  onPointerMove={(e) => {
                    const canvas = maskCanvasRef.current;
                    const imgEl = maskImgRef.current;
                    if (!canvas || !imgEl || !isDrawingMask) return;
                    const rect = imgEl.getBoundingClientRect();
                    const ctx = canvas.getContext('2d')!;
                    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                    ctx.beginPath();
                    ctx.arc(x, y, brushSize/2, 0, Math.PI * 2);
                    ctx.fill();
                  }}
                  onPointerUp={(e) => {
                    setIsDrawingMask(false);
                    try { maskCanvasRef.current?.releasePointerCapture?.(e.pointerId); } catch {}
                  }}
                />
              </div>
            ) : (
              <div>No image</div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-sm">Brush</label>
            <input type="range" min={4} max={64} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
            <Button size="sm" variant="outline" onClick={() => {
              if (maskCanvasRef.current) {
                const ctx = maskCanvasRef.current.getContext('2d')!;
                ctx.clearRect(0,0,maskCanvasRef.current.width, maskCanvasRef.current.height);
                setMaskDirty(false);
              }
            }}>Clear Mask</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowMaskPreview(s => !s)}>{showMaskPreview ? 'Hide' : 'Show'} Mask</Button>
          </div>
          <div className="mt-4">
            <div className="mb-2">
              <label className="text-sm font-medium">Edit prompt</label>
              <input
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editPrompt && !isEditing) {
                    e.preventDefault();
                    // Menambahkan parameter untuk menutup dialog setelah submit
                    performImageEdit(true);
                  }
                }}
                placeholder="Describe the edit (e.g. change background to sunset)"
                className="w-full mt-1 p-2 border rounded-md"
              />
            </div>
            <div className="mb-2">
              <label className="text-sm font-medium">Optional mask (PNG)</label>
              <input type="file" accept="image/png" onChange={(e) => handleMaskSelect(e.target.files?.[0] ?? null)} className="mt-1" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => performImageEdit(true)} disabled={!editPrompt || isEditing}>
                {isEditing ? 'Editing...' : 'Edit'}
              </Button>
              <Button onClick={() => downloadImage(viewerSrc)}>Download</Button>
              <DialogClose asChild>
                <Button variant="ghost">Close</Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

