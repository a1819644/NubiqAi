import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Mic, Download, Eye, Copy, Check, Square, Pencil, FileText, X, AlertCircle, UploadCloud } from "lucide-react";
import { Button } from "./ui/button";
import Textarea from "react-textarea-autosize"; // Use auto-sizing textarea
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatHistory as Chat, ChatMessage as Message, User } from "../types"; // UPDATED: Use centralized types
import { apiService, handleApiError } from "../services/api";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogHeader,
  DialogFooter,
} from "./ui/dialog";
import { copyToClipboard, isClipboardAvailable } from "../utils/clipboard";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { Badge } from "./ui/badge";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { cn } from "./ui/utils";
import { imageStorageService } from "../services/imageStorageService";
import { Progress } from "./ui/progress";

// Define AttachmentPreview interface
interface AttachmentPreview {
  id: string;
  file: File;
  progress: number;
  previewUrl?: string;
  error?: string;
}

// Using a placeholder for image icon
const imageIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjY2NjYiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIvPgo8cGF0aCBkPSJNMiAxMkw2IDhMOCAxMEwxMiA2TDE0IDhWMTJIMloiIGZpbGw9IiM2NjY2NjYiLz4KPC9zdmc+';

const IMAGE_STOP_WORDS = new Set([
  "generate",
  "generating",
  "create",
  "creating",
  "draw",
  "drawing",
  "make",
  "making",
  "produce",
  "producing",
  "render",
  "rendering",
  "design",
  "designing",
  "show",
  "showing",
  "give",
  "giving",
  "send",
  "sending",
  "want",
  "needs",
  "need",
  "like",
  "please",
  "can",
  "could",
  "would",
  "you",
  "me",
  "an",
  "a",
  "the",
  "some",
  "any",
  "another",
  "more",
  "again",
  "one",
  "something",
  "anything",
  "image",
  "images",
  "picture",
  "pictures",
  "photo",
  "photos",
  "drawing",
  "drawings",
  "illustration",
  "illustrations",
  "art",
  "artwork",
  "sketch",
  "sketches",
  "logo",
  "logos",
  "icon",
  "icons",
  "of",
  "for",
  "to",
]);

const GENERIC_IMAGE_PATTERNS = [
  /^generate( me)?( an?| the)? (image|picture|photo|drawing|illustration|art|artwork|sketch|logo|icon)s?\.?$/i,
  /^create( me)?( an?| the)? (image|picture|photo|drawing|illustration|art|artwork|sketch|logo|icon)s?\.?$/i,
  /^make( me)?( an?| the)? (image|picture|photo|drawing|illustration|art|artwork|sketch|logo|icon)s?\.?$/i,
  /^draw( me)?( an?| the)? (image|picture|photo|drawing|illustration|art|artwork|sketch|logo|icon)s?\.?$/i,
  /^i (need|want|would like)( an?| the)? (image|picture|photo|drawing|illustration|art|artwork|sketch|logo|icon)s?\.?$/i,
  /^can you (generate|create|make|draw)( me)?( an?| the)? (image|picture|photo|drawing|illustration|art|artwork|sketch|logo|icon)s?\.?$/i,
];

const analyzeImageIntent = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { wantsImage: false, needsDetails: false, isImagineCommand: false };
  }

  const lower = trimmed.toLowerCase();
  const isImagineCommand = lower.startsWith('/imagine');
  const hasImageWord = /(image|picture|photo|drawing|illustration|art|artwork|sketch|logo|icon)/.test(lower);
  const hasVerb = /(generate|create|draw|make|produce|design|render|show|give|send|need|want|would like)/.test(lower);
  const wantsImage = isImagineCommand || (hasImageWord && hasVerb);

  if (!wantsImage) {
    return { wantsImage: false, needsDetails: false, isImagineCommand };
  }

  const isGeneric = GENERIC_IMAGE_PATTERNS.some((pattern) => pattern.test(lower));

  const tokens = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const descriptiveTokens = tokens.filter((token) => !IMAGE_STOP_WORDS.has(token));
  const hasSubject = descriptiveTokens.length > 0;
  const needsDetails = !isImagineCommand && (isGeneric || !hasSubject);

  return { wantsImage: true, needsDetails, isImagineCommand };
};

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
  const [attachedFiles, setAttachedFiles] = useState<AttachmentPreview[]>([]);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 4MB
  const MAX_PREVIEW_LENGTH = 800; // chars before truncation
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false); // 🌊 NEW: Track streaming state
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isImageModeActive, setIsImageModeActive] = useState(false);
  const [pendingImagePrompt, setPendingImagePrompt] = useState<string | null>(null);
  // State for message editing
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [imageStatus, setImageStatus] = useState<Record<string, 'loading' | 'success' | 'error'>>({});
  const [imageRetryTokens, setImageRetryTokens] = useState<Record<string, number>>({});
  // State untuk header auto-hide
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null); // State for lightbox
  const [imageActionSrc, setImageActionSrc] = useState<string | null>(null); // State for the new action dialog
  const [imageActionAlt, setImageActionAlt] = useState<string | null>(null);
  const dragCounter = useRef(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const composerHeight = useResizeObserver(composerRef);

  // Create a stable reference to avoid issues with null activeChat
  const chat = activeChat || {
    id: 'temp',
    title: 'New Chat',
    messages: [],
    createdAt: new Date(), // Should be overwritten by real chat
    updatedAt: new Date(), // Should be overwritten by real chat
  };

  // Smart sticky header logic
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    const SCROLL_UP_THRESHOLD = 60;
    const SCROLL_DOWN_THRESHOLD = 120;

    // Always show header if near the top
    if (currentScrollY < SCROLL_UP_THRESHOLD) {
      setIsHeaderVisible(true);
      setLastScrollY(currentScrollY);
      return;
    }

    // Hide header when scrolling down past the threshold
    if (currentScrollY > lastScrollY && currentScrollY > SCROLL_DOWN_THRESHOLD) {
      setIsHeaderVisible(false);
    } 
    // Show header when scrolling up
    else if (currentScrollY < lastScrollY) {
      setIsHeaderVisible(true);
    }

    setLastScrollY(currentScrollY <= 0 ? 0 : currentScrollY); // For Mobile or negative scrolling
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const processFiles = (filesToProcess: FileList | null) => {
    if (!filesToProcess) return;

    const newFiles = Array.from(filesToProcess);
    const accepted: AttachmentPreview[] = [];
    const rejected: string[] = [];
    const unsupported: string[] = [];

    // Define supported file types
    const SUPPORTED_TYPES = [
      'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
      'text/plain', 'text/markdown', 'text/csv',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
    ];

    for (const f of newFiles) {
      // Check file type first
      if (!SUPPORTED_TYPES.includes(f.type)) {
        unsupported.push(f.name);
        continue;
      }
      
      // Check file size
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(f.name);
        continue;
      }

      const newAttachment: AttachmentPreview = {
        id: `${f.name}-${f.size}-${f.lastModified}`,
        file: f,
        progress: 0, // Will be updated during upload
      };

      // Create a local URL for image thumbnails
      if (f.type.startsWith('image/')) {
        newAttachment.previewUrl = URL.createObjectURL(f);
      }

      accepted.push(newAttachment);
    }

    if (accepted.length > 0) {
      // TODO: Implement actual file upload logic here and update progress.
      setAttachedFiles((prev) => [...prev, ...accepted]);
      toast.success(`${accepted.length} file(s) attached`);
    }

    if (unsupported.length > 0) {
      toast.error(`Unsupported file type(s): ${unsupported.join(', ')}\nSupported: PDF, DOCX, DOC, TXT, MD, CSV, JSON, XLSX, Images`);
    }

    if (rejected.length > 0) {
      toast.error(`Skipped ${rejected.length} file(s) exceeding ${Math.round(MAX_FILE_SIZE / (1024*1024))}MB: ${rejected.join(', ')}`);
    }
  };

  const handleFileAttach = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    processFiles(event.dataTransfer.files);
  };

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
              const hasFirebaseUrl = msg.attachments.some(att => {
                if (typeof att !== 'string') return false;
                // Support multiple storage hostnames and signed URLs
                return (
                  att.startsWith('https://firebasestorage.googleapis.com') ||
                  att.startsWith('https://storage.googleapis.com') ||
                  att.includes('/o/') // Firebases signed URL pattern
                );
              });
              
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

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeChat && activeChat.messages.length > 0 && user) {
        const chatId = `initial-${activeChat.id}`;
        const userId = user.id; // Use actual user ID from auth
        
        // Use navigator.sendBeacon for reliable sending during page unload
        const data = JSON.stringify({ userId, chatId });
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon('http://localhost:8000/api/end-chat', blob);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeChat, user]);

  const removeFile = (id: string) => {
    const fileToRemove = attachedFiles.find(f => f.id === id);
    if (fileToRemove?.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl); // Clean up memory
    }
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getAttachmentId = (messageId: string | undefined, timestamp: Date, index: number) => {
    const baseId = messageId ?? `${timestamp.getTime()}`;
    return `${baseId}-${index}`;
  };

  const buildImageSrc = (original: string, attachmentId: string) => {
    if (original.startsWith('data:')) {
      return original;
    }
    const retryToken = imageRetryTokens[attachmentId];
    if (!retryToken) {
      return original;
    }
    const separator = original.includes('?') ? '&' : '?';
    return `${original}${separator}retry=${retryToken}`;
  };

  const handleRetryImage = (attachmentId: string) => {
    setImageStatus((prev) => ({ ...prev, [attachmentId]: 'loading' }));
    setImageRetryTokens((prev) => ({ ...prev, [attachmentId]: Date.now() }));
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
      const wasImageEdit = (abortControllerRef.current as any).isImageEdit;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      toast.info("AI response stopped.");
      // Remove any pending loading indicators from the chat
      if (activeChat) {
        if (wasImageEdit) setIsEditing(false); // Immediately reset editing state on cancel
        onUpdateChat({ ...activeChat, messages: activeChat.messages.filter(m => !m.attachments?.includes('__processing_file__') && !m.attachments?.includes('__generating_image__') && !m.attachments?.includes('__editing_image__')) });
      }
      // If the aborted request was an image edit, reopen the viewer
      if (wasImageEdit) {
        setViewerOpen(true);
      }
    }
  };

  const handleSendMessage = async (
    text: string = input,
    files: AttachmentPreview[] = attachedFiles,
    isVoice: boolean = false,
    isContinuation: boolean = false, // NEW PARAMETER FOR PREVENT DUPLICATIONS
    skipConfirmation: boolean = false, // NEW: Skip image confirmation check
    continuationChat?: Chat // Optional chat state for continuations
  ) => {
    if (!activeChat) return;
    if (isLoading && !isContinuation) {
      toast.info('Hold on—finish the current response before asking something new.');
      return;
    }
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
        attachments: files.map((f) => f.file.name),
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
      const intent = analyzeImageIntent(text);
      const shouldHandleNaturalImage = intent.wantsImage && !intent.isImagineCommand && !isImageModeActive && !skipConfirmation;

      if (shouldHandleNaturalImage) {
        if (intent.needsDetails) {
          const clarificationMessage: Message = {
            id: `clarify-${Date.now()}`,
            content: 'I can definitely generate something for you! What would you like the image to show?',
            role: 'assistant',
            timestamp: new Date(),
          };

          const chatWithClarification = {
            ...updatedChat,
            messages: [...updatedChat.messages, clarificationMessage],
            updatedAt: new Date(),
          };

          safeUpdateChat(() => chatWithClarification);
          setIsLoading(false);
          controller.abort();
          abortControllerRef.current = null;
          toast.info('Tell me what you want the image to depict.');
          return;
        }

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

        // Build conversation history from this chat only - limit to last 2 exchanges (4 messages)
        const contextMessages = updatedChat.messages
          .slice(0, Math.max(updatedChat.messages.length - 1, 0)) // Exclude the current prompt
          .filter(m => m.role === 'user' || m.role === 'assistant');

        const historyWindow = contextMessages.slice(-4); // Up to two user/assistant pairs
        const history = historyWindow.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }));

        if (history.length > 0) {
          console.log(`💡 Image context: Using last ${history.length} message(s) from chat ${targetChatId}`);
        } else {
          console.log(`💡 Image context: No prior history in chat ${targetChatId}; using prompt only`);
        }

        // Call backend image generation with user context AND conversation history
        const imgResp = await apiService.generateImage(
          text,
          user?.id,
          targetChatId,
          user?.name,
          history.length > 0 ? history : undefined // 🎯 Pass context only when we have prior chat history
        );

        console.log('📥 Image generation response:', {
          success: imgResp.success,
          hasImageBase64: !!imgResp.imageBase64,
          hasImageUri: !!imgResp.imageUri,
        });

        if (imgResp.success && (imgResp.imageBase64 || imgResp.imageUri)) {
          // 🖼️ Create a displayable URL (prefer base64 for instant view)
          const displayUrl = imgResp.imageBase64
            ? `data:image/png;base64,${imgResp.imageBase64}`
            : imgResp.imageUri!;

          // Store image in IndexedDB for persistence
          const imageUrl = imgResp.imageUri || (imgResp.imageBase64 ? `data:image/png;base64,${imgResp.imageBase64}` : '');
          // Use the SAME message ID for cache and chat message so preload can map them
          const messageId = `img-${Date.now()}`;

          try {
            await imageStorageService.storeImage(
              messageId,
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

          // Create the actual image message with metadata
          const imageMessage: Message = {
            id: messageId,
            content: imgResp.altText || text,
            role: 'assistant',
            timestamp: new Date(),
            // ✅ CRITICAL FIX: Store BOTH the display URL and the permanent Firebase URL.
            // The base64 (displayUrl) will be stripped on save, but the Firebase URL will remain.
            attachments: [displayUrl, imgResp.imageUri].filter(Boolean) as string[],
            metadata: imgResp.metadata ? {
              tokens: imgResp.metadata.tokens,
              duration: imgResp.metadata.duration,
            } : undefined,
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
        
        // Ensure global loading is active for image generation
        setIsLoading(true);

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
          
          // 💾 Store image in IndexedDB for instant loading on page reload
          const messageId = (Date.now() + 2).toString();
          try {
            if (user?.id && imageUrl) {
              // 💾 Store in IndexedDB with both display URL (base64) and permanent Firebase URL
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
            // ✅ CRITICAL FIX: Store BOTH the display URL and the permanent Firebase URL.
            // The base64 (imageUrl) will be stripped on save, but the Firebase URL will remain.
            attachments: [imageUrl, imgResp.imageUri].filter(Boolean) as string[],
            metadata: imgResp.metadata ? {
              tokens: imgResp.metadata.tokens,
              duration: imgResp.metadata.duration,
            } : undefined,
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
          // If the request was aborted while we were processing, the controller would be null.
          // We should stop here to prevent further execution.
          if (!abortControllerRef.current) {
            return;
          }
          return;
        } else {
          throw new Error(imgResp.error || 'Image generation failed');
        }
      } else {
        // This block handles regular text messages
      }

      // Find image file if any
      const imageFile = files.find(att => att.file.type.startsWith('image/'))?.file;
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

      // � Pre-process any attached documents before calling the model
      const nonImageFiles = files.map(att => att.file).filter(f => !f.type.startsWith('image/'));
      if (nonImageFiles.length > 0) {
        const fileToBase64 = async (file: File) => {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return btoa(binary);
        };

        for (const file of nonImageFiles) {
          const alreadyProcessed = targetChatSnapshot.messages.some((msg) => {
            const meta = (msg.metadata as any) || {};
            return meta.isDocumentContext && meta.documentName === file.name && meta.documentSize === file.size;
          });
          if (alreadyProcessed) {
            console.log(`ℹ️ Skipping previously processed document: ${file.name}`);
            continue;
          }

          console.log(`📄 Processing document before AI call: ${file.name}`);

          try {
            const base64 = await fileToBase64(file);
            const procResp = await apiService.processDocument({
              fileBase64: base64,
              mimeType: file.type,
              userId: user?.id,
              storeInMemory: true,
            });

            if (!procResp.success || !procResp.extractedText) {
              throw new Error(procResp.error || 'Document processing failed');
            }

            console.log(`✅ Document processed: ${file.name} (${procResp.extractedText.length} characters)`);

            const contextMessage: Message = {
              id: `doc-context-${Date.now()}`,
              content: `[Document: ${file.name}]
${procResp.extractedText}`,
              role: 'system',
              timestamp: new Date(),
              metadata: {
                documentName: file.name,
                documentType: file.type,
                documentSize: file.size,
                isDocumentContext: true,
              } as any,
            };

            safeUpdateChat((chat) => ({
              ...chat,
              messages: [...chat.messages, contextMessage],
            }));

            // Keep local references in sync with the snapshot updates
            updatedChat = { ...targetChatSnapshot };

            toast.success(`📄 ${file.name} processed and ready for questions`);
          } catch (err) {
            if ((err as Error).name === 'AbortError') {
              console.log(`⚠️ Document processing aborted for ${file.name}`);
              return;
            }

            const errorMessage = handleApiError(err);
            let friendly = `Failed to process ${file.name}: ${errorMessage}`;

            if (errorMessage.includes("don't have the capability")) {
              friendly = errorMessage;
            } else if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out')) {
              friendly += ' — Try a smaller file (under 10MB).';
            } else if (errorMessage.toLowerCase().includes('too large') || errorMessage.toLowerCase().includes('size')) {
              friendly = `${file.name} is too large. Please use files under 10MB.`;
            }

            toast.error(friendly);
            console.error('❌ Document processing failed:', err);
          }
        }
      }

      // �📝 Smart conversation history: Last 5 messages + summary of older ones
      const RECENT_MESSAGE_LIMIT = 5;
      const totalMessages = targetChatSnapshot.messages.length;
      
      let conversationHistory;
      let conversationSummary = '';
      
      if (totalMessages <= RECENT_MESSAGE_LIMIT) {
        // Short conversation: send all messages
        conversationHistory = targetChatSnapshot.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      } else {
        // Long conversation: send last 20 + summary of older messages
        const olderMessages = targetChatSnapshot.messages.slice(0, totalMessages - RECENT_MESSAGE_LIMIT);
        const recentMessages = targetChatSnapshot.messages.slice(-RECENT_MESSAGE_LIMIT);
        
        // Create summary of older messages
        const olderMessagesPreview = olderMessages
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .slice(-10) // Look at last 10 of the older messages for summary
          .map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content.substring(0, 100)}...`)
          .join('\n');
        
        conversationSummary = `[Earlier conversation summary: ${olderMessages.length} messages from the start of this chat. Most recent older topics: ${olderMessagesPreview}]`;
        
        conversationHistory = recentMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        
        console.log(`💡 Optimized context: Sending ${conversationHistory.length} recent messages + summary of ${olderMessages.length} older messages`);
      }
      
      // 🌊 STREAMING MODE: Use streaming for text-only requests
      const useStreaming = !imageFile; // Stream only for text (not images)
      
      if (useStreaming) {
        // 🌊 Create placeholder message that will update as chunks arrive
        const placeholderMessageId = (Date.now() + 1).toString();
        const placeholderMessage: Message = {
          id: placeholderMessageId,
          content: '',
          role: 'assistant',
          timestamp: new Date(),
        };
        
        // Add placeholder immediately so user sees response starting
        const chatWithPlaceholder = {
          ...updatedChat,
          messages: [...updatedChat.messages, placeholderMessage],
          title: isFirstMessage
            ? (text || "New Chat").slice(0, 40) + (text.length > 40 ? "..." : "")
            : updatedChat.title,
        };
        
        safeUpdateChat(() => chatWithPlaceholder);
        setIsStreaming(true);
        
        let accumulatedText = '';
        
        try {
          await apiService.askAIStream({
            message: text,
            userId: user?.id,
            userName: user?.name,
            chatId: targetChatId,
            messageCount: targetChatSnapshot.messages.length,
            conversationHistory,
            conversationSummary,
            useMemory: true,
            onChunk: (chunk, isCached) => {
              // Accumulate text as chunks arrive
              accumulatedText += chunk;
              
              // Update the placeholder message with accumulated text
              safeUpdateChat(chat => {
                if (!chat) return chat;
                return {
                  ...chat,
                  messages: chat.messages.map(m =>
                    m.id === placeholderMessageId
                      ? { ...m, content: accumulatedText }
                      : m
                  )
                };
              });
            },
            onComplete: (metadata) => {
              console.log(`✅ Streaming complete in ${metadata.duration}s${metadata.cached ? ' (cached)' : ''}`);
              
              // Add final metadata to message
              safeUpdateChat(chat => {
                if (!chat) return chat;
                return {
                  ...chat,
                  messages: chat.messages.map(m =>
                    m.id === placeholderMessageId
                      ? {
                          ...m,
                          metadata: {
                            duration: metadata.duration,
                            cached: metadata.cached,
                            streaming: true
                          }
                        }
                      : m
                  )
                };
              });
              
              setIsStreaming(false);
              setIsLoading(false);
            },
            onError: (error) => {
              console.error('❌ Streaming error:', error);
              toast.error(`Streaming error: ${error}`);
              
              // Replace placeholder with error message
              safeUpdateChat(chat => {
                if (!chat) return chat;
                return {
                  ...chat,
                  messages: chat.messages.map(m =>
                    m.id === placeholderMessageId
                      ? {
                          ...m,
                          content: `Sorry, I encountered an error: ${error}. Please try again.`
                        }
                      : m
                  )
                };
              });
              
              setIsStreaming(false);
              setIsLoading(false);
            },
            signal: controller.signal
          });
          
          return; // Exit after streaming completes
          
        } catch (error) {
          // Handle abort or other errors
          if ((error as Error).name === 'AbortError' && (signal as any).aborted && (controller as any).wasAborted) {
            return; // User stopped generation
          }
          
          const errorMessage = handleApiError(error);
          toast.error(errorMessage);
          
          safeUpdateChat(chat => {
            if (!chat) return chat;
            return {
              ...chat,
              messages: chat.messages.map(m =>
                m.id === placeholderMessageId
                  ? {
                      ...m,
                      content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`
                    }
                  : m
              )
            };
          });
          
          setIsStreaming(false);
          setIsLoading(false);
          return;
        }
      }
      
      // 📦 NON-STREAMING MODE: For image requests, use traditional approach
      const response = await apiService.askAI({
        message: text,
        image: imageFile,
        chatId: targetChatId,                          // 🎯 NEW! For chat-scoped memory
        messageCount: targetChatSnapshot.messages.length, // 🎯 NEW! Detect new vs continuing chat
        conversationHistory,                           // 🎯 Last 20 messages
        conversationSummary,                           // 🎯 Summary of older messages (if any)
        userId: user?.id,                              // 🎯 NEW! Pass actual user ID from auth
        userName: user?.name,                          // 🎯 NEW! Pass user name for auto-profile creation
        useMemory: true
      });

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
            metadata: response.metadata ? {
              tokens: response.metadata.tokens,
              duration: response.metadata.duration,
            } : undefined,
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
          metadata: response.metadata ? {
            tokens: response.metadata.tokens,
            duration: response.metadata.duration,
          } : undefined,
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
          return;
        }
      } else {
        throw new Error('Failed to get AI response');
      }
      
    } catch (error) {
      // Check if the error is due to the request being aborted
      // Also check our custom flag to ensure it was a user-initiated stop
      if ((error as Error).name === 'AbortError' && (signal as any).aborted && (controller as any).wasAborted) {
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

      onUpdateChat(finalChat);
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
  const [isEditMode, setIsEditMode] = useState(false); // State to control edit UI visibility
  const [editPrompt, setEditPrompt] = useState('');
  const [maskFile, setMaskFile] = useState<File | null>(null);
  // Mask drawing state
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskImgRef = useRef<HTMLImageElement | null>(null);
  const [isDrawingMask, setIsDrawingMask] = useState(false);
  const [brushSize, setBrushSize] = useState(24);
  const [maskDirty, setMaskDirty] = useState(false);
  const [showMaskPreview, setShowMaskPreview] = useState(true);
  const maskFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  const openImageViewer = (src: string, alt?: string, editMode: boolean = false) => {
    setViewerSrc(src);
    setViewerAlt(alt || null);
    setViewerOpen(true);
    setIsEditMode(editMode); // Set the mode
  };

  // Ensure mask canvas matches image dimensions when viewer opens
  useEffect(() => {
    if (!viewerSrc || !maskCanvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = maskCanvasRef.current;
      const imgEl = maskImgRef.current;
      if (!canvas || !imgEl) return;

      // --- PIXEL-PERFECT ALIGNMENT LOGIC ---
      const dpr = window.devicePixelRatio || 1;
      const rect = imgEl.getBoundingClientRect();

      // Set canvas internal resolution to match the image's natural size, scaled by DPR for sharpness
      canvas.width = img.naturalWidth * dpr;
      canvas.height = img.naturalHeight * dpr;

      // Set canvas display size to match the image's rendered size on screen
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Scale the drawing context to match the DPR
      ctx.scale(dpr, dpr);

      // Clear and initialize
      ctx.clearRect(0,0,canvas.width, canvas.height);
      // initialize transparent background
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0,0,canvas.width, canvas.height);
      setMaskDirty(false);
      if (maskFadeTimeoutRef.current) clearTimeout(maskFadeTimeoutRef.current);
    };
    img.src = viewerSrc;
  }, [viewerSrc]);

  // Keep canvas CSS size in sync with the displayed image so overlay coordinates match
  useEffect(() => {
    const sync = () => {
      const canvas = maskCanvasRef.current;
      const img = maskImgRef.current;
      if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = img.getBoundingClientRect();

      // Update internal resolution
      canvas.width = img.naturalWidth * dpr;
      canvas.height = img.naturalHeight * dpr;

      // Update display size
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      canvas.getContext('2d')?.scale(dpr, dpr);
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
    setIsLoading(true); // Show the main stop button
    setIsEditing(true);

    // Create and store a new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    // Add a flag to identify this as an image edit cancellation
    (abortControllerRef.current as any).isImageEdit = true;
    const signal = controller.signal;

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
        setIsLoading(false);
        (abortControllerRef.current as any).isImageEdit = false;
        abortControllerRef.current = null;
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
      content: editPrompt, // Store only the prompt, not the status text
      role: 'assistant',
      timestamp: new Date(),
      attachments: ['__editing_image__']
    };

    // Check if this request is still the active one before updating UI
    if (abortControllerRef.current !== controller) return;

    if (activeChat) {
      onUpdateChat({ ...activeChat, messages: [...activeChat.messages, placeholderMsg] });
    }

    try {
      let editResp;
      // Check if the request was aborted before making the API call
      if (signal.aborted) {
        throw new Error('AbortError');
      }

      if (maskBase64) {
        editResp = await apiService.editImageWithMask({ imageBase64, maskBase64, editPrompt, signal });
      } else {
        editResp = await apiService.editImage({ imageBase64, editPrompt, signal });
      }

      if (editResp.success && (editResp.imageBase64 || editResp.imageUri)) {
        const newUrl = editResp.imageBase64 ? `data:image/png;base64,${editResp.imageBase64}` : editResp.imageUri!;

        // Replace placeholder in activeChat
        if (activeChat) {
          // Check if this request is still the active one before updating UI
          if (abortControllerRef.current !== controller) return;

          const filtered = activeChat.messages.filter(m => !(m.attachments && m.attachments.includes('__editing_image__')));
          const newMsg: Message = {
                  id: (Date.now() + 1).toString(),
                  content: editPrompt, // SELALU gunakan prompt asli pengguna
                  role: 'assistant',
                  timestamp: new Date(),
                  attachments: [newUrl],
                  metadata: { altText: editResp.altText } 
                };
          onUpdateChat({ ...activeChat, messages: [...filtered, newMsg] });
        }

        setViewerSrc(newUrl);
        setEditPrompt(''); // Clear prompt for next edit
        toast.success('Image edited');
      } else {
        throw new Error(editResp.error || 'Image edit failed');
      }
    } catch (err: any) {
      if ((err as Error).name === 'AbortError') {
        // The handleStopGeneration function will show a toast and clean up the placeholder
        return;
      }

      const msg = handleApiError(err);
      toast.error(`Edit failed: ${msg}`);
      // remove placeholder and leave original viewer
      if (activeChat) {
        // Check if this request is still the active one before updating UI
        if (abortControllerRef.current !== controller) return;
        const filtered = activeChat.messages.filter(m => !(m.attachments && m.attachments.includes('__editing_image__')));
        onUpdateChat({ ...activeChat, messages: filtered });
      }
      if (closeOnSubmit) {
        setViewerOpen(true);
      }
    } finally {
      setIsEditing(false);
      setIsLoading(false); // Hide the main stop button
      setMaskFile(null);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null; // Clean up controller only if it's still the same one
      }
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
    if (isImageModeActive && pendingImagePrompt && activeChat) {
      // Use isContinuation: true to prevent duplicating the user's message.
      // The original message that triggered the confirmation is already in the chat.
      // Pass the most recent activeChat state to avoid stale closures.
      handleSendMessage(pendingImagePrompt, [], false, true, false, activeChat);
      setPendingImagePrompt(null); // Clear the prompt after sending.
    }
  }, [isImageModeActive, pendingImagePrompt, activeChat]); // Add activeChat to dependencies

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

  // New Image Action Dialog
  const ImageActionDialog = () => {
    if (!imageActionSrc) return null;

    const handleEdit = () => {
      setImageActionSrc(null);
      openImageViewer(imageActionSrc, imageActionAlt || undefined, true);
    };

    const handleDownload = () => {
      downloadImage(imageActionSrc);
      setImageActionSrc(null);
    };

    return (
      <Dialog open={!!imageActionSrc} onOpenChange={() => setImageActionSrc(null)}>
        <DialogContent className="sm:max-w-2xl p-0">
          <div className="p-4">
            <img
              src={imageActionSrc}
              alt={imageActionAlt || 'Image action preview'}
              className="max-w-full max-h-[70vh] object-contain rounded-lg mx-auto"
            />
          </div>
          <DialogFooter className="p-4 border-t bg-muted/50">
            <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4" /> Download</Button>
            <Button onClick={handleEdit}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Simple Lightbox Component for "Open" functionality
  const Lightbox = ({ src, onClose }: { src: string | null; onClose: () => void }) => {
    if (!src) return null;

    return (
      <div
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in cursor-pointer"
        onClick={onClose}
      >
        <button
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          onClick={onClose}
          aria-label="Close image viewer"
        >
          <X className="h-8 w-8" />
        </button>
        <img
          src={src}
          alt="Lightbox preview"
          className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl rounded-lg cursor-default"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
        />
      </div>
    );
  };
  // If no active chat, show a placeholder
  if (!activeChat) {
    return (
      <div className="flex flex-col h-full bg-background text-foreground items-center justify-center">
        <p className="text-muted-foreground">No active chat. Click "New Chat" to start.</p>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-full bg-background text-foreground relative"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        // Prevent browser from opening the file
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          setIsDragging(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
          setIsDragging(false);
        }
      }}
    >
      {/* Render the lightbox */}
      <ImageActionDialog />

      {/* Render the lightbox (kept for now, can be removed if "Open" button is removed) */}
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

      {/* Messages Area */}
      <div
        className="flex-1 overflow-auto relative"
        onScroll={handleScroll}
        style={{ paddingBottom: composerHeight ? `${composerHeight}px` : '96px' }} // Fallback height
      >
        {/* Sticky Header inside the scroll container */}
        <div
          className={cn(
            "sticky top-0 z-10 px-6 py-5 bg-background/80 backdrop-blur-sm border-b border-black/5 dark:border-white/[.08] shadow-sm",
            "transition-all duration-200 ease-in-out motion-reduce:transition-none",
            isHeaderVisible
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0 pointer-events-none"
          )}
        >
          <h1 className="text-lg font-semibold text-foreground truncate">
            {chat.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {chat.messages.length} messages
          </p>
        </div>

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
              <div data-tour-id="welcome-quick-actions" className="space-y-2 rounded-lg">
                <div className="flex gap-2">
                  <button data-tour-id="welcome-chat-with-ai" className="flex-1 h-10 px-3 bg-muted hover:bg-accent border border-border rounded-md flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground transition-colors">
                    💬 Chat with AI
                  </button>
                  <button data-tour-id="welcome-upload-files" onClick={() => fileInputRef.current?.click()} className="flex-1 h-10 px-3 bg-muted hover:bg-accent border border-border rounded-md flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground transition-colors">
                    📁 Upload Files
                  </button>
                </div>
                <div className="flex gap-2">
                  <button data-tour-id="welcome-voice-recording" onClick={startRecording} className="flex-1 h-10 px-3 bg-muted hover:bg-accent border border-border rounded-md flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground transition-colors">
                    🎤 Voice Recording
                  </button>
                  <button data-tour-id="welcome-create-image" onClick={handleImageClick} className="flex-1 h-10 px-3 bg-muted hover:bg-accent border border-border rounded-md flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground transition-colors">
                    🎨 Create Image
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 pb-3 space-y-6 max-w-4xl mx-auto">
            {chat.messages
              .filter(message => message.role !== 'system') // Hide system messages (document context)
              .map((message, messageIndex) => {
                const attachmentId = getAttachmentId(message.id, message.timestamp, messageIndex);
                return (
              <div 
                key={message.id ?? `${message.timestamp.getTime()}-${message.role}-${messageIndex}`}
                className={`group flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                } items-start gap-3 animate-fade-in`}
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
                  <div className="w-full flex flex-col gap-4">
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full min-h-[44px] max-h-[240px] resize-none p-3 text-sm
                                 bg-background text-foreground placeholder:text-muted-foreground
                                 border border-gray-300 dark:border-zinc-700 rounded-lg
                                 focus-visible:outline-none focus-visible:border-blue-500
                                 focus-visible:ring-2 focus-visible:ring-blue-500/20
                                 transition-all duration-200 ease-in-out"
                      placeholder="Edit your prompt..."
                      autoFocus
                      rows={1}
                      onKeyDown={(e) => {
                        // Submit on Enter (but not Shift+Enter)
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleEditMessage(message.id);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingMessageId(null);
                        }
                      }}
                    />
                    <div className="flex justify-end gap-4">
                      <Button size="sm" variant="ghost" onClick={() => setEditingMessageId(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" className="hover:bg-primary/90" onClick={() => handleEditMessage(message.id)}>
                        Save & Submit
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Original message rendering logic
                  <div className={`flex flex-col w-full max-w-2xl ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`relative`}>
                        <div
                          className={`rounded-xl px-4 py-2.5 shadow-sm transition-colors ${ 
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/50 dark:bg-zinc-800/50"
                          }`}
                        >
                          {/* Attachment handling */}
                          {!(message.attachments && message.attachments.some(f => {
                            if (typeof f !== 'string') return false;
                            
                            // JANGAN render konten di sini jika itu adalah placeholder edit (yang merender kontennya sendiri)
                            if (f === '__editing_image__') return true; 
                            
                            // JANGAN render konten di sini jika itu adalah kartu gambar final (yang merender kontennya sendiri)
                            return (
                              f.startsWith('data:image') || 
                              f.startsWith('https://firebasestorage.googleapis.com') || 
                              f.startsWith('https://storage.googleapis.com') || 
                              f.includes('.firebasestorage.app') || 
                              f.includes('/o/')
                            );
                          })) && (
                            <div className="prose dark:prose-invert max-w-none text-sm break-words">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  // Custom styling for markdown elements
                                  h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2 break-words" {...props} />,
                                  h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-3 mb-2 break-words" {...props} />,
                                  h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-2 mb-1 break-words" {...props} />,
                                  code: ({ node, inline, className, children, ...props }: any) => {
                                    if (inline) {
                                      return (
                                        <code className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-1.5 py-0.5 rounded text-xs font-mono break-all" {...props}>
                                          {children}
                                        </code>
                                      );
                                    }
                                    // Block code
                                    return (
                                      <code className="text-zinc-900 dark:text-zinc-100 text-xs font-mono block whitespace-pre-wrap break-words" {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                  pre: ({ node, children, ...props }) => (
                                    <pre className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg my-3 border border-zinc-200 dark:border-zinc-700 overflow-hidden max-w-full" {...props}>
                                      {children}
                                    </pre>
                                  ),
                                  ul: ({ node, ...props }) => <ul className="list-disc list-inside my-2 space-y-1 break-words" {...props} />,
                                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside my-2 space-y-1 break-words" {...props} />,
                                  blockquote: ({ node, ...props }) => (
                                    <blockquote className="border-l-4 border-primary pl-4 italic my-2 text-muted-foreground break-words" {...props} />
                                  ),
                                  p: ({ node, ...props }) => <p className="whitespace-pre-wrap my-1 break-words" {...props} />,
                                  strong: ({ node, ...props }) => <strong className="font-bold break-words" {...props} />,
                                  em: ({ node, ...props }) => <em className="italic break-words" {...props} />,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          )}
                          {message.attachments && message.attachments.length > 0 && editingMessageId !== message.id && (
                            <div className="mt-2 space-y-1">
                              {message.attachments.map((file, idx) => (
                                <React.Fragment key={idx}>
                                  {typeof file === 'string' && (file === '__generating_image__') ? (  
                                    <div className="w-64 h-40 bg-muted rounded-lg animate-pulse flex items-center justify-center">
                                      <p className="text-sm text-muted-foreground">Generating image...</p>
                                    </div>
                                  ) : typeof file === 'string' && file === '__editing_image__' ? (
                                    <div className="bg-muted/50 rounded-xl border border-border/20 shadow-sm overflow-hidden w-full max-w-md">
                                      <div className="bg-muted p-2">
                                        <div className="w-full aspect-video bg-muted-foreground/10 rounded-lg animate-pulse flex items-center justify-center">
                                          <p className="text-sm text-muted-foreground">Editing image...</p>
                                        </div>
                                      </div>
                                      <div className="p-4 pt-2">
                                        <p className="text-sm text-muted-foreground line-clamp-2">{message.content}</p>
                                      </div>
                                    </div>
                                  ) : typeof file === 'string' && (file.startsWith('data:image') || file.startsWith('https://firebasestorage.googleapis.com') || file.startsWith('https://storage.googleapis.com') || file.includes('.firebasestorage.app') || file.includes('/o/')) ? (  
                                    // --- Redesigned Image Card ---
                                    <div className="w-full max-w-md bg-transparent">
                                      {/* Image Preview */}
                                      <div>
                                        <img
                                          src={file} // Use the direct file URL here
                                          alt={message.content || `generated-${idx}`}
                                          className="w-full h-auto object-contain rounded-xl shadow-md cursor-pointer transition-opacity hover:opacity-90"
                                          onClick={() => { setImageActionSrc(file); setImageActionAlt(message.content); }}
                                          onLoad={() => setImageStatus((prev) => ({ ...prev, [attachmentId]: 'success' }))}
                                          onError={() => {
                                            console.error('Failed to load image:', file);
                                            setImageStatus((prev) => ({ ...prev, [attachmentId]: 'error' }));
                                          }}
                                        />
                                      </div>
                                      {/* Prompt and Actions */}
                                      <div className="text-center mt-2">
                                        <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-2">{message.content}</p>
                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-accent" onClick={() => { setImageActionSrc(file); setImageActionAlt(message.content); }}>
                                            <Eye className="mr-1.5 h-4 w-4" /> Open
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-accent" onClick={() => openImageViewer(file, message.content, true)}>
                                            <Pencil className="mr-1.5 h-4 w-4" /> Edit
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-accent" onClick={() => downloadImage(file)}>
                                            <Download className="mr-1.5 h-4 w-4" /> Download
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs opacity-80">📎 {file}</div>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          )}
                          {/* Document content preview */}
                          {message.role === 'assistant' && message.content?.startsWith('Extracted from') && (
                            <div className="mt-2 p-3 bg-background/50 rounded-lg border border-border/50">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <Badge variant="secondary">Document Content</Badge>
                              </div>
                              <ExpandableText text={message.content} maxLength={MAX_PREVIEW_LENGTH} />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/70 mt-1.5 px-1">
                          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                          {/* Metadata display */}
                          {message.role === 'assistant' && message.metadata && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/50 text-xs">
                              {message.metadata.tokens && (
                                <span className="flex items-center gap-0.5">
                                  <span className="font-mono">{message.metadata.tokens.toLocaleString()}</span>
                                  <span className="text-muted-foreground/70">tokens</span>
                                </span>
                              )}
                              {message.metadata.duration && (
                                <>
                                  {message.metadata.tokens && <span className="text-muted-foreground/50">•</span>}
                                  <span className="flex items-center gap-0.5">
                                    <span className="font-mono">{message.metadata.duration.toFixed(2)}</span>
                                    <span className="text-muted-foreground/70">s</span>
                                  </span>
                                </>
                              )}
                            </span>
                          )}
                          {/* Action Buttons */}
                          {(message.content && message.content.trim()) && (
                            <div className="flex items-center">
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
                              </Button></div>
                            
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
                          )}                      </div>
                    </div>
                )}
              </div>
                );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex flex-col items-start animate-fade-in">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      {isStreaming && (
                        <span className="text-xs text-gray-500 ml-2">✨ Streaming...</span>
                      )}
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
      <div
        ref={composerRef}
        className="bg-transparent p-4 pt-2 sticky bottom-0 z-10"
      >
        {/* Attachment Preview Bar */}
        {attachedFiles.length > 0 && (
          <div className="max-w-4xl mx-auto mb-3 p-2 bg-muted/50 border border-border/50 rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {attachedFiles.map((att) => (
                <div key={att.id} className="relative group bg-background border rounded-lg shadow-sm overflow-hidden aspect-square">
                  {att.previewUrl ? (
                    // Image Preview
                    <img
                      src={att.previewUrl}
                      alt={att.file.name}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => openImageViewer(att.previewUrl!, att.file.name)}
                    />
                  ) : (
                    // Document Preview
                    <div className="flex flex-col items-center justify-center h-full p-2 text-center">
                      <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-xs font-medium text-foreground truncate w-full">{att.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(att.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  )}
                  {/* Remove Button */}
                  <button
                    onClick={() => removeFile(att.id)}
                    className="absolute top-1 right-1 h-5 w-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {/* Progress/Error Overlay */}
                  {att.progress > 0 && att.progress < 100 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Progress value={att.progress} className="w-3/4 h-1.5" />
                    </div>
                  )}
                  {att.error && (
                    <div className="absolute inset-0 bg-destructive/80 flex flex-col items-center justify-center p-2 text-center">
                      <AlertCircle className="w-6 h-6 text-destructive-foreground mb-1" />
                      <p className="text-xs text-destructive-foreground font-medium">{att.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          data-tour-id="prompt-input-area"
          className="flex items-center gap-4 max-w-4xl mx-auto px-5 py-3 border border-gray-200 dark:border-zinc-800 rounded-[14px] bg-background shadow-[0_1px_6px_rgba(0,0,0,0.03)] focus-within:ring-1 focus-within:ring-ring transition-all"
        >
          {/* The form itself is now the main container */}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              placeholder={isLoading ? 'Please wait for the current response to finish…' : 'Give a prompt'}
              className="flex-1 bg-transparent resize-none border-none focus:ring-0 focus:outline-none placeholder:text-[#9CA3AF] py-1.5"
              maxRows={8}
              rows={1}
            />
            {/* Icons inside the input container */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-[#9CA3AF] hover:bg-accent hover:text-accent-foreground"
                data-tour-id="attach-file-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach file"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`h-8 w-8 p-0 text-[#9CA3AF] hover:bg-accent flex-shrink-0 ${ 
                  isImageModeActive ? 'bg-blue-100 hover:bg-blue-200' : ''
                }`}
                data-tour-id="image-icon-button"
                onClick={handleImageClick}
                disabled={isLoading}
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
                className={`h-8 w-8 p-0 text-[#9CA3AF] hover:bg-accent hover:text-accent-foreground ${ 
                  isRecording ? "bg-red-100 hover:bg-red-200" : "" 
                }`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading && !isRecording}
                title="Record voice"
              >
                <Mic
                  className={`h-4 w-4 text-muted-foreground ${ 
                    isRecording ? "text-red-600 animate-pulse" : "text-inherit"
                  }`}
                />
              </Button>
            </div>
          {/* Send/Stop button outside the main input container */}
          {isLoading ? (
            <Button
              data-tour-id="stop-button"
              type="button"
              onClick={handleStopGeneration}
              className="h-8 w-8 p-0 bg-destructive hover:bg-destructive/90 rounded-lg"
              title="Stop generating"
            >
              <Square className="h-5 w-5 text-white" />
            </Button>
          ) : (
            <Button data-tour-id="send-button" type="submit" disabled={isLoading || (!input.trim() && attachedFiles.length === 0)} className="h-8 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary-foreground dark:text-primary dark:hover:bg-primary-foreground/90 rounded-lg transition-all hover:scale-105">
              <Send className="h-5 w-5" />
            </Button>
          )}
        </form>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileAttach}
          accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json,.xlsx"
        />
      </div>
      {/* Drag and Drop Overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 z-20 bg-primary/10 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-primary/50 rounded-2xl transition-all"
          onDrop={handleFileDrop}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
        >
          <UploadCloud className="w-16 h-16 text-primary/80 mb-4" />
          <p className="text-lg font-semibold text-primary">Drop files here to attach</p>
        </div>
      )}
      {/* Image viewer modal */}
      <Dialog open={viewerOpen} onOpenChange={(open) => setViewerOpen(open)}>
        <DialogContent className={cn("max-h-[95vh] flex flex-col p-0 transition-all duration-300", isEditMode ? "sm:max-w-4xl" : "sm:max-w-2xl")}>
          <DialogHeader>
            <DialogTitle className="text-lg font-medium p-6 pb-2">Image Preview</DialogTitle>
            <DialogDescription className="px-6 text-sm text-muted-foreground/80 truncate">{viewerAlt}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {viewerSrc ? (
              <div 
                className="relative bg-muted/50 rounded-lg flex justify-center items-center overflow-hidden border shadow-inner touch-none"
                style={{ cursor: 'crosshair' }}
                onPointerDown={(e) => {
                  const canvas = maskCanvasRef.current;
                  if (!canvas || !e.isPrimary) return;
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); // Tetap gunakan currentTarget
                  
                  const rect = canvas.getBoundingClientRect();
                  const scaleX = canvas.width / rect.width;
                  const scaleY = canvas.height / rect.height;
                  const x = (e.clientX - rect.left) * scaleX;
                  const y = (e.clientY - rect.top) * scaleY;
                  const dpr = window.devicePixelRatio || 1;
                  const naturalBrushSize = brushSize * (scaleX / dpr); // Ukuran kuas dalam piksel natural

                  const ctx = canvas.getContext('2d')!;
                  ctx.globalCompositeOperation = 'source-over';
                  ctx.strokeStyle = 'rgba(255,0,0,0.5)';
                  ctx.fillStyle = 'rgba(255,0,0,0.5)'; // Juga atur fillStyle untuk titik awal
                  ctx.lineWidth = naturalBrushSize; // Atur ketebalan garis
                  ctx.lineCap = 'round'; // Ujung garis bulat
                  ctx.lineJoin = 'round'; // Sambungan garis bulat

                  const currentX = x / dpr;
                  const currentY = y / dpr;

                  // Mulai path baru dan gambar titik awal
                  ctx.beginPath();
                  ctx.arc(currentX, currentY, naturalBrushSize / 2, 0, Math.PI * 2);
                  ctx.fill(); // Isi lingkaran titik awal

                  // Mulai path garis (meskipun belum ada garis)
                  ctx.beginPath();
                  ctx.moveTo(currentX, currentY); // Pindahkan "pena" ke posisi saat ini

                  setLastPoint({ x: currentX, y: currentY }); // Simpan titik saat ini
                  setMaskDirty(true);
                  if (maskFadeTimeoutRef.current) clearTimeout(maskFadeTimeoutRef.current);
                  canvas.style.opacity = '0.9';
                  setIsDrawingMask(true);
                }}
                onPointerMove={(e) => {
                  if (!isDrawingMask || !e.isPrimary || !lastPoint) return; // Hanya jika sedang menggambar & ada titik terakhir
                  const canvas = maskCanvasRef.current;
                  if (!canvas) return;
                  e.preventDefault();

                  const rect = canvas.getBoundingClientRect();
                  const scaleX = canvas.width / rect.width;
                  const scaleY = canvas.height / rect.height;
                  const x = (e.clientX - rect.left) * scaleX;
                  const y = (e.clientY - rect.top) * scaleY;
                  const dpr = window.devicePixelRatio || 1;

                  const currentX = x / dpr;
                  const currentY = y / dpr;

                  const ctx = canvas.getContext('2d')!;
                  // Tidak perlu set style lagi karena sudah di onPointerDown

                  // Lanjutkan path dari titik terakhir
                  ctx.lineTo(currentX, currentY); // Gambar garis ke posisi baru
                  ctx.stroke(); // Terapkan goresan garis
                  
                  // Update titik terakhir untuk goresan berikutnya
                  setLastPoint({ x: currentX, y: currentY });
                }}
                onPointerUp={(e) => {
                  if (!e.isPrimary) return;
                  setIsDrawingMask(false);
                  setLastPoint(null); // <-- Reset titik terakhir
                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); // Tetap gunakan currentTarget
                  if (maskFadeTimeoutRef.current) clearTimeout(maskFadeTimeoutRef.current);
                  maskFadeTimeoutRef.current = setTimeout(() => {
                    if (maskCanvasRef.current) {
                      maskCanvasRef.current.style.opacity = '0';
                    }
                  }, 1500);
                }}
              >
                <img ref={maskImgRef} src={viewerSrc} alt={viewerAlt || 'preview'} className="max-w-full h-auto w-full object-contain rounded-md" />
                <canvas
                  ref={(el) => (maskCanvasRef.current = el)}
                  className="absolute top-0 left-0 rounded-md pointer-events-none transition-opacity duration-300"
                  style={{ top: 0, left: 0, zIndex: 20, opacity: showMaskPreview ? 0.9 : 0 }}
                />
              </div>
            ) : (
              <div>No image</div>
            )}
            {/* Controls Column - Conditionally rendered */}
            {isEditMode && (
              <div className="flex flex-col h-full space-y-6 pt-2 md:pl-8 md:border-l border-border">
                <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
                  <label className="text-sm font-medium">Edit Prompt</label>
                  <Textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)} // This is a standard textarea, not the autosize one
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && editPrompt && !isEditing) {
                        e.preventDefault();
                        performImageEdit(true);
                      }
                    }}
                    placeholder="e.g., 'make the background a sunset'"
                    className="w-full flex-1 resize-none text-sm p-2 bg-background border border-gray-300 dark:border-gray-600 rounded-md placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    rows={3}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium">Brush Size</label>
                  <div className="flex items-center gap-4">
                    <input type="range" min={4} max={64} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="flex-1" />
                    <span className="text-sm font-mono w-8 text-center">{brushSize}px</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => {
                    if (maskCanvasRef.current) {
                      const ctx = maskCanvasRef.current.getContext('2d')!;
                      ctx.clearRect(0,0,maskCanvasRef.current.width, maskCanvasRef.current.height);
                      setMaskDirty(false);
                    }
                  }}>Clear Mask</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowMaskPreview(s => !s)}>{showMaskPreview ? 'Hide' : 'Show'} Mask</Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 mt-6 bg-muted/50 border-t flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            {isEditMode && (
              <Button onClick={() => performImageEdit(true)} disabled={!editPrompt || isEditing}>
                {isEditing ? 'Editing...' : 'Apply Edit'}
              </Button>
            )}
            <Button onClick={() => downloadImage(viewerSrc)}>Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
