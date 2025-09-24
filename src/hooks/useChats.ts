import { useState, useCallback } from 'react';
import type { Chat, Message } from '../App';

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  isLoading: boolean;
  error: string | null;
}

// Define initial chats separately to avoid repetition
const initialChats: Chat[] = [
  {
    id: '1',
    title: 'Getting Started with AI',
    messages: [
      {
        id: '1',
        content: 'Hello! How can I help you today?',
        sender: 'ai',
        timestamp: new Date(Date.now() - 3600000),
      }
    ],
    updatedAt: new Date(Date.now() - 3600000),
    archived: false,
  },
];

export function useChats() {
  const [chatState, setChatState] = useState<ChatState>({
    chats: initialChats,
    // --- FIX IS HERE ---
    // Set the first chat as the active one on initial load
    activeChat: initialChats[0] || null,
    // --- END OF FIX ---
    isLoading: false,
    error: null,
  });

  const createChat = useCallback((title?: string) => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: title || 'New Chat',
      messages: [],
      updatedAt: new Date(),
      archived: false,
    };

    setChatState(prev => ({
      ...prev,
      chats: [newChat, ...prev.chats],
      activeChat: newChat,
    }));

    return newChat;
  }, []);

  const updateChat = useCallback((chatId: string, updates: Partial<Chat>) => {
    setChatState(prev => ({
      ...prev,
      chats: prev.chats.map(chat =>
        chat.id === chatId ? { ...chat, ...updates, updatedAt: new Date() } : chat
      ),
      activeChat: prev.activeChat?.id === chatId 
        ? { ...prev.activeChat, ...updates, updatedAt: new Date() }
        : prev.activeChat,
    }));
  }, []);

  const addMessage = useCallback((chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    setChatState(prev => ({
      ...prev,
      chats: prev.chats.map(chat =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, newMessage],
              updatedAt: new Date(),
              title: chat.messages.length === 0 && message.sender === 'user'
                ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
                : chat.title,
            }
          : chat
      ),
      activeChat: prev.activeChat?.id === chatId
        ? {
            ...prev.activeChat,
            messages: [...prev.activeChat.messages, newMessage],
            updatedAt: new Date(),
            title: prev.activeChat.messages.length === 0 && message.sender === 'user'
              ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
              : prev.activeChat.title,
          }
        : prev.activeChat,
    }));

    return newMessage;
  }, []);

  const deleteChat = useCallback((chatId: string) => {
    setChatState(prev => ({
      ...prev,
      chats: prev.chats.filter(chat => chat.id !== chatId),
      activeChat: prev.activeChat?.id === chatId ? null : prev.activeChat,
    }));
  }, []);

  const archiveChat = useCallback((chatId: string) => {
    setChatState(prev => ({
      ...prev,
      chats: prev.chats.map(chat =>
        chat.id === chatId ? { ...chat, archived: !chat.archived } : chat
      ),
    }));
  }, []);

  const setActiveChat = useCallback((chat: Chat | null) => {
    setChatState(prev => ({
      ...prev,
      activeChat: chat,
    }));
  }, []);

  const sendMessage = useCallback(async (
    chatId: string,
    content: string,
    attachments?: string[]
  ) => {
    // Add user message
    addMessage(chatId, {
      content,
      sender: 'user',
      attachments,
    });

    setChatState(prev => ({ ...prev, isLoading: true }));

    try {
      // Simulate AI response
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const aiResponse = generateAIResponse(content, attachments);
      
      addMessage(chatId, {
        content: aiResponse,
        sender: 'ai',
      });

      setChatState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to send message',
      }));
    }
  }, [addMessage]);

  return {
    ...chatState,
    createChat,
    updateChat,
    addMessage,
    deleteChat,
    archiveChat,
    setActiveChat,
    sendMessage,
  };
}

function generateAIResponse(content: string, attachments?: string[]): string {
  const responses = [
    "I understand your question. Let me help you with that.",
    "That's an interesting point. Here's what I think...",
    "Based on what you've shared, I can suggest...",
    "I see what you're looking for. Here's my recommendation...",
    "Great question! Let me break this down for you...",
  ];

  if (attachments && attachments.length > 0) {
    return `I can see you've shared ${attachments.length} file(s): ${attachments.join(', ')}. How can I help you with these files?`;
  }

  if (content.toLowerCase().includes('voice recording')) {
    return "I received your voice message. How can I help you with what you've shared?";
  }

  return responses[Math.floor(Math.random() * responses.length)];
}