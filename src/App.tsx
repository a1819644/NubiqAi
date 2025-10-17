// import { useState } from "react";
// import { Header } from "./components/Header";
// import { Sidebar } from "./components/Sidebar";
// import { ChatInterface } from "./components/ChatInterface";
// // import { History } from "./components/History";
// // import { Workspace } from "./components/Workspace";
// // import { Settings } from "./components/Settings";
// import { Toaster } from "sonner";
// import { toast } from "sonner";
// import { useDarkMode } from "./hooks/useDarkMode";
// import { useAuth } from "./hooks/useAuth";
// import { ChatHistory, ChatMessage, NavigationSection, User } from "./types";

// export default function App() {
//   const { isDarkMode, toggleDarkMode } = useDarkMode();
//   const { user, signIn, signOut } = useAuth();

//   const [activeSection, setActiveSection] = useState<NavigationSection>("home");

//   const [chats, setChats] = useState<ChatHistory[]>([
//     {
//       id: "1",
//       title: "Getting Started with AI",
//       messages: [
//         {
//           id: "1",
//           content: "Hello! How can I help you today?",
//           role: "assistant",
//           timestamp: new Date(Date.now() - 3600000),
//         },
//       ],
//       createdAt: new Date(Date.now() - 3600000),
//       updatedAt: new Date(Date.now() - 3600000),
//     },
//     {
//       id: "2",
//       title: "Project Planning Discussion",
//       messages: [
//         {
//           id: "2",
//           content: "I need help with project planning",
//           role: "user",
//           timestamp: new Date(Date.now() - 7200000),
//         },
//         {
//           id: "3",
//           content:
//             "I'd be happy to help you with project planning! What kind of project are you working on?",
//           role: "assistant",
//           timestamp: new Date(Date.now() - 7150000),
//         },
//       ],
//       createdAt: new Date(Date.now() - 7200000),
//       updatedAt: new Date(Date.now() - 7200000),
//     },
//   ]);

//   const [activeChat, setActiveChat] = useState<ChatHistory | null>(chats[0]);

//   const handleSignIn = (userData: Omit<User, "isAuthenticated">) => {
//     signIn(userData);
//   };

//   const handleSignOut = async () => {
//     try {
//       await signOut();
//       // User state will be cleared by the useEffect
//     } catch (error) {
//       console.error('Sign out error:', error);
//     }
//   };

//   const handleNewChat = () => {
//     const newChat: ChatHistory = {
//       id: Date.now().toString(),
//       title: "New Chat",
//       messages: [],
//       createdAt: new Date(),
//       updatedAt: new Date(),
//     };
//     setChats((prev) => [newChat, ...prev]);
//     setActiveChat(newChat);
//     setActiveSection("home");
//     toast.success("New chat created");
//   };

//   const renderMainContent = () => {
//     switch (activeSection) {
//       case "home":
//         return (
//           <ChatInterface
//             activeChat={activeChat}
//             user={user} 
//             onUpdateChat={(updatedChat) => {
//               setActiveChat(updatedChat);
//               setChats((prev) =>
//                 prev.map((chat) =>
//                   chat.id === updatedChat.id ? updatedChat : chat
//                 )
//               );
//             }}
//           />
//         );
//       // case "history":
//       //   return (
//       //     <History
//       //       chats={chats}
//       //       onSelectChat={(chat) => {
//       //         setActiveChat(chat);
//       //         setActiveSection("chat");
//       //       }}
//       //       onDeleteChat={(chatId) => {
//       //         // --- PERBAIKAN LOGIKA ADA DI SINI ---
//       //         setChats((prev) => {
//       //           const newChats = prev.filter((chat) => chat.id !== chatId);
//       //           if (activeChat?.id === chatId) {
//       //             setActiveChat(newChats[0] || null);
//       //           }
//       //           return newChats;
//       //         });
//       //         // --- AKHIR PERBAIKAN ---
//       //       }}
//       //       onArchiveChat={(chatId) => {
//       //         setChats((prev) =>
//       //           prev.map((chat) =>
//       //             chat.id === chatId
//       //               ? { ...chat, archived: !chat.archived }
//       //               : chat
//       //           )
//       //         );
//       //       }}
//       //     />
//       //   );
//       // case "workspace-overview":
//       // case "workspace-projects":
//       // case "workspace-team":
//       // case "workspace-ai-tools":
//       // case "workspace-files":
//       // case "workspace-analytics":
//       //   return (
//       //     <Workspace section={activeSection.replace("workspace-", "") as any} />
//       //   );
//       // case "settings-account":
//       // case "settings-workspace":
//       // case "settings-subscription":
//       // case "settings-preferences":
//       //   return (
//       //     <Settings
//       //       section={activeSection.replace("settings-", "") as any}
//       //       user={user}
//       //       onUpdateUser={setUser}
//       //       isDarkMode={isDarkMode}
//       //       onToggleDarkMode={toggleDarkMode}
//       //     />
//       //   );
//       default:
//         return (
//           <ChatInterface activeChat={activeChat} onUpdateChat={() => {}} />
//         );
//     }
//   };

//   // Show loading screen while checking authentication
//   return (
//     <div className="h-screen flex flex-col bg-background text-foreground">
//       <Header
//         user={(user as User) || {
//           id: "",
//           name: "",
//           email: "",
//           avatar: "",
//           isAuthenticated: false,
//           subscription: "free",
//         }}
//         onSignIn={handleSignIn}
//         onSignOut={handleSignOut}
//         isDarkMode={isDarkMode}
//         onToggleDarkMode={toggleDarkMode}
//       />
//       <div className="flex flex-1 overflow-hidden">
//         <div className="w-64 bg-sidebar transition-colors">
//           <Sidebar
//             activeSection={activeSection}
//             onSectionChange={setActiveSection}
//             onNewChat={handleNewChat}
//           />
//         </div>
//         <main className="flex-1 overflow-hidden">{renderMainContent()}</main>
//       </div>
//       <Toaster richColors />
//     </div>
//   );
// }

import { useState, useEffect } from "react";
import { Header } from "./components/Header"; // Assuming Header.tsx is created
import { AuthDialog } from "./components/AuthDialog";
import { Sidebar } from "./components/Sidebar";
import { History } from "./components/History";
import { ChatInterface } from "./components/ChatInterface";
import { apiService } from "./services/api";
import { imageStorageService } from "./services/imageStorageService";
import { imageRehydrationService } from "./services/imageRehydrationService";
// import { History } from "./components/History";
// import { Workspace } from "./components/Workspace";
// import { Settings } from "./components/Settings";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { useDarkMode } from "./hooks/useDarkMode";
import { useAuth } from "./hooks/useAuth";
import { ChatHistory, ChatMessage, NavigationSection, User } from "./types";

export default function App() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { user, signInWithGoogle, signOut, isLoading } = useAuth();
  const [isAuthDialogOpen, setAuthDialogOpen] = useState(false);

  const [activeSection, setActiveSection] = useState<NavigationSection>("home");

  // Start with empty chats array - will be loaded from localStorage/Pinecone on auth
  const [chats, setChats] = useState<ChatHistory[]>([]);

  // Create a new, empty chat on initial load to show the welcome screen.
  const createInitialChat = (): ChatHistory => ({
    id: `initial-${Date.now()}`,
    title: "New Chat",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [activeChat, setActiveChat] = useState<ChatHistory | null>(createInitialChat());

  // Helper function to remove duplicate chats (by id)
  const deduplicateChats = (chats: ChatHistory[]): ChatHistory[] => {
    const seen = new Set<string>();
    return chats.filter(chat => {
      if (seen.has(chat.id)) {
        return false;
      }
      seen.add(chat.id);
      return true;
    });
  };

  // Clean up duplicates whenever chats array changes
  useEffect(() => {
    setChats((prev) => {
      const deduplicated = deduplicateChats(prev);
      // Only update if there were actually duplicates
      if (deduplicated.length !== prev.length) {
        console.log(`🧹 Removed ${prev.length - deduplicated.length} duplicate chat(s)`);
        return deduplicated;
      }
      return prev;
    });
  }, [chats.length]); // Run when the number of chats changes

  // 💾 Auto-save chats to localStorage whenever they change
  // But strip large base64 images to avoid quota exceeded errors
  useEffect(() => {
    if (user && chats.length > 0) {
      const localStorageKey = `chat_history_${user.id}`;
      
      try {
        // Strip base64 images from attachments to save space
        const chatsForStorage = chats.map(chat => ({
          ...chat,
          messages: chat.messages.map(msg => ({
            ...msg,
            attachments: msg.attachments?.map(att => {
              // Keep only non-base64 attachments (URLs, file names, etc)
              // Remove data:image/... base64 to save localStorage space
              if (typeof att === 'string' && att.startsWith('data:image')) {
                return '__image_removed__'; // Placeholder
              }
              return att;
            })
          }))
        }));
        
        localStorage.setItem(localStorageKey, JSON.stringify(chatsForStorage));
        console.log(`💾 Auto-saved ${chats.length} chat(s) to localStorage (images excluded)`);
      } catch (error: any) {
        if (error.name === 'QuotaExceededError') {
          console.error('❌ localStorage quota exceeded! Clearing old data...');
          // Try to save without any attachments at all
          const chatsWithoutAttachments = chats.map(chat => ({
            ...chat,
            messages: chat.messages.map(msg => ({
              ...msg,
              attachments: undefined
            }))
          }));
          try {
            localStorage.setItem(localStorageKey, JSON.stringify(chatsWithoutAttachments));
            console.log(`💾 Saved ${chats.length} chat(s) without attachments`);
          } catch (e) {
            console.error('❌ Still failed, clearing localStorage...');
            localStorage.removeItem(localStorageKey);
          }
        } else {
          console.error('❌ Failed to save to localStorage:', error);
        }
      }
    }
  }, [chats, user]);

  // 🔄 Load chat history when user is authenticated (on page reload or initial sign-in)
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!user || isLoading) return;

      console.log('🔄 User authenticated, loading chat history...');
      
      // 🚀 PHASE 1: Load from localStorage immediately for instant UX
      const localStorageKey = `chat_history_${user.id}`;
      const savedChats = localStorage.getItem(localStorageKey);
      
      if (savedChats) {
        try {
          const parsedChats = JSON.parse(savedChats);
          // Convert date strings back to Date objects
          const restoredChats = parsedChats.map((chat: any) => ({
            ...chat,
            createdAt: new Date(chat.createdAt),
            updatedAt: new Date(chat.updatedAt),
            messages: chat.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
          }));
          
          if (restoredChats.length > 0) {
            setChats(restoredChats);
            console.log(`✅ PHASE 1: Loaded ${restoredChats.length} chat(s) from localStorage`);
          }
        } catch (error) {
          console.error('Failed to parse saved chats:', error);
        }
      }
      
      // 🔥 PHASE 2: Load from server's local memory (fast - no DB delay)
      try {
        console.log('⚡ PHASE 2: Loading from server memory (instant)...');
        const response = await apiService.getChats(user.id, 'local');
        
        if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
          // Convert dates from server response
          const serverChats = response.data.map((chat: any) => ({
            ...chat,
            createdAt: new Date(chat.timestamp),
            updatedAt: new Date(chat.timestamp),
            messages: chat.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
          }));
          
          // 🖼️ Rehydrate images from Firebase URLs back into IndexedDB
          const rehydratedChats = await imageRehydrationService.rehydrateChats(serverChats, user.id);
          setChats(rehydratedChats);
          console.log(`✅ PHASE 2: Loaded ${rehydratedChats.length} chat(s) from server memory with image rehydration`);
          
          // Update localStorage with server data
          try {
            const chatsForStorage = rehydratedChats.map((chat: any) => ({
              ...chat,
              messages: chat.messages.map((msg: any) => ({
                ...msg,
                attachments: msg.attachments?.map((att: any) => 
                  typeof att === 'string' && att.startsWith('data:image') ? '__image_removed__' : att
                )
              }))
            }));
            localStorage.setItem(localStorageKey, JSON.stringify(chatsForStorage));
          } catch (e) {
            console.warn('⚠️ Could not save to localStorage, continuing anyway...');
          }
        }
      } catch (error) {
        console.warn('Phase 2 failed (non-critical):', error);
      }
      
      // 🌐 PHASE 3: Load from Pinecone in background (slower - full history)
      // Only load if we don't have much local data
      if (chats.length < 5) {
        setTimeout(async () => {
          try {
            console.log('🔍 PHASE 3: Checking Pinecone for older history...');
            const pineconeResponse = await apiService.getChats(user.id, 'pinecone');
            
            if (pineconeResponse?.data && Array.isArray(pineconeResponse.data) && pineconeResponse.data.length > 0) {
              const olderChats = pineconeResponse.data.map((chat: any) => ({
                ...chat,
                createdAt: new Date(chat.timestamp),
                updatedAt: new Date(chat.timestamp),
                messages: chat.messages.map((msg: any) => ({
                  ...msg,
                  timestamp: new Date(msg.timestamp)
                }))
              }));
              
              // 🖼️ Rehydrate images from Firebase URLs
              const rehydratedOlderChats = await imageRehydrationService.rehydrateChats(olderChats, user.id);
              
              // Merge with existing chats (avoid duplicates)
              setChats(prevChats => {
                const existingIds = new Set(prevChats.map(c => c.id));
                const newChats = rehydratedOlderChats.filter(c => !existingIds.has(c.id));
                
                if (newChats.length > 0) {
                  console.log(`✅ PHASE 3: Added ${newChats.length} older chat(s) from Pinecone with image rehydration`);
                  // Sort by timestamp (ascending - oldest first)
                  return [...prevChats, ...newChats].sort((a, b) => 
                    a.createdAt.getTime() - b.createdAt.getTime()
                  );
                }
                return prevChats;
              });
            }
          } catch (error) {
            console.warn('Phase 3 failed (non-critical):', error);
          }
        }, 1000); // Delay 1 second to not block initial load
      }
    };

    loadChatHistory();
  }, [user, isLoading]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      setAuthDialogOpen(false);
      toast.success("Signed in successfully!");
      // Chat history will be loaded by the useEffect hook
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google");
    }
  };

  const handleSignOut = async () => {
    try {
      // 💾 Save to localStorage before signing out (strip images to avoid quota)
      if (user && chats.length > 0) {
        const localStorageKey = `chat_history_${user.id}`;
        try {
          const chatsForStorage = chats.map((chat: any) => ({
            ...chat,
            messages: chat.messages.map((msg: any) => ({
              ...msg,
              attachments: msg.attachments?.map((att: any) => 
                typeof att === 'string' && att.startsWith('data:image') ? '__image_removed__' : att
              )
            }))
          }));
          localStorage.setItem(localStorageKey, JSON.stringify(chatsForStorage));
          console.log(`💾 Saved ${chats.length} chats to localStorage (images excluded)`);
        } catch (e) {
          console.warn('⚠️ Could not save to localStorage on sign out');
        }
        
        // 🌐 Persist all chats to Pinecone for cross-device sync (batch operation)
        const chatIdsWithMessages = chats
          .filter(chat => chat.messages.length > 0)
          .map(chat => chat.id);
        
        if (chatIdsWithMessages.length > 0) {
          console.log(`🚀 Saving ${chatIdsWithMessages.length} chats to Pinecone (batch)...`);
          try {
            await apiService.saveAllChats({ 
              userId: user.id, 
              chatIds: chatIdsWithMessages 
            });
            console.log(`✅ All ${chatIdsWithMessages.length} chats queued for Pinecone save`);
          } catch (saveError) {
            console.error('⚠️ Failed to queue chats for Pinecone:', saveError);
            // Don't block sign-out if Pinecone save fails
          }
        }
        
        // 🗑️ Clear IndexedDB image cache for privacy (shared device security)
        try {
          await imageStorageService.clearAll();
          console.log('✅ Cleared IndexedDB image cache');
        } catch (e) {
          console.warn('⚠️ Failed to clear IndexedDB cache (non-critical):', e);
        }
      }
      
      // Clear local state
      setChats([]);
      setActiveChat(null);
      
      await signOut();
      
      // Show welcome screen (component will render automatically when user is null)
      // The welcome screen has a "Sign In to Get Started" button
      toast.success("Signed out successfully");
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleNewChat = () => {
    console.log('🆕 Creating new chat...');
    
    // 🎯 Persist previous chat before creating new one
    if (activeChat && activeChat.messages.length > 0 && user) {
      const previousChatId = activeChat.id;
      const userId = user.id;
      
      // Call endChat API in background (don't block UI)
      apiService.endChat({ userId, chatId: previousChatId })
        .then(() => {
          console.log(`✅ Previous chat ${previousChatId} will be persisted to Pinecone`);
        })
        .catch((error) => {
          console.warn('⚠️ Failed to persist previous chat:', error);
        });
    }
    
    const newChat: ChatHistory = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // Only add the current active chat to history if it has messages AND isn't already in the array
    if (activeChat && activeChat.messages.length > 0) {
      setChats((prev) => {
        // Check if this chat is already in the array (prevent duplicates)
        const exists = prev.some(chat => chat.id === activeChat.id);
        if (!exists) {
          return [activeChat, ...prev];
        }
        return prev;
      });
    }
    setActiveChat(newChat);
    setActiveSection("home");
    console.log('✅ New chat created:', newChat.id, '| Active section:', 'home');
    toast.success("New chat created");
  };

  const handleLogoClick = () => {
    // If the current chat is empty, just stay. Otherwise, create a new one.
    if (activeChat && activeChat.messages.length > 0) {
      handleNewChat();
    } else {
      setActiveChat(createInitialChat());
    }
    setActiveSection("home");
  };

  const handleSelectChat = (chat: ChatHistory) => {
    // 🎯 Persist previous chat before switching
    if (activeChat && activeChat.id !== chat.id && activeChat.messages.length > 0 && user) {
      const previousChatId = activeChat.id;
      const userId = user.id;
      
      // Call endChat API in background (don't block UI)
      apiService.endChat({ userId, chatId: previousChatId })
        .then(() => {
          console.log(`✅ Previous chat ${previousChatId} will be persisted to Pinecone`);
        })
        .catch((error) => {
          console.warn('⚠️ Failed to persist previous chat:', error);
        });
    }
    
    setActiveChat(chat);
    setActiveSection("home");
  };

  const handleDeleteChat = (chatId: string) => {
    setChats((prev) => {
      const newChats = prev.filter((chat) => chat.id !== chatId);
      if (activeChat?.id === chatId) {
        // If the active chat is deleted, switch to a new empty chat
        setActiveChat(createInitialChat());
        setActiveSection("home");
      }
      return newChats;
    });
    toast.success("Chat deleted");
  };

  const handleArchiveChat = (chatId: string, archive: boolean) => {
    setChats(prev =>
      prev.map(chat =>
        chat.id === chatId ? { ...chat, archived: archive } : chat
      )
    );
    toast.success(archive ? "Chat archived" : "Chat restored");
    if (archive && activeChat?.id === chatId) {
      setActiveChat(createInitialChat());
      setActiveSection("home");
    }
  };

  const handleTriggerSignIn = () => {
    setAuthDialogOpen(true);
  };

  const handleTriggerSignUp = () => {
    setAuthDialogOpen(true);
  };

  const renderMainContent = () => {
    console.log(`📄 Rendering main content | Section: ${activeSection} | Active chat:`, activeChat?.id);
    switch (activeSection) {
      case "home":
        return (
          <ChatInterface
            activeChat={activeChat}
            user={user}
            onUpdateChat={(updatedChat) => {
              setActiveChat(updatedChat);
              setChats((prev) => {
                // Check if this chat already exists in the array
                const existingIndex = prev.findIndex(chat => chat.id === updatedChat.id);
                if (existingIndex >= 0) {
                  // Update existing chat
                  return prev.map((chat) =>
                    chat.id === updatedChat.id ? updatedChat : chat
                  );
                } else {
                  // Add new chat to the beginning of the array (if it has messages)
                  if (updatedChat.messages.length > 0) {
                    return [updatedChat, ...prev];
                  }
                  return prev;
                }
              });
            }}
          />
        );
      case "history":
        return (
          <History
            chats={chats}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
            onArchiveChat={handleArchiveChat}
          />
        );
      // case "workspace-overview":
      // case "workspace-projects":
      // case "workspace-team":
      // case "workspace-ai-tools":
      // case "workspace-files":
      // case "workspace-analytics":
      //   return (
      //     <Workspace section={activeSection.replace("workspace-", "") as any} />
      //   );
      // case "settings-account":
      // case "settings-workspace":
      // case "settings-subscription":
      // case "settings-preferences":
      //   return (
      //     <Settings
      //       section={activeSection.replace("settings-", "") as any}
      //       user={user}
      //       onUpdateUser={setUser}
      //       isDarkMode={isDarkMode}
      //       onToggleDarkMode={toggleDarkMode}
      //     />
      //   );
      default:
        return (
          <ChatInterface activeChat={activeChat} user={user} onUpdateChat={() => {}} />
        );
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show welcome screen with sign-in prompt when not authenticated
  if (!user) {
    return (
      <div className="h-screen flex flex-col bg-background text-foreground">
        <Header
          user={{
            id: "",
            name: "",
            email: "",
            avatar: "",
            isAuthenticated: false,
            subscription: "free",
          }}
          onTriggerSignIn={handleTriggerSignIn}
          onTriggerSignUp={handleTriggerSignUp}
          onSignOut={handleSignOut}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onLogoClick={handleLogoClick}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight">Welcome to NubiqAI ✨</h1>
              <p className="text-xl text-muted-foreground">
                Your intelligent AI assistant with persistent memory
              </p>
            </div>
            
            <div className="space-y-6 pt-8">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-left">
                  <span className="text-2xl">💬</span>
                  <div>
                    <p className="font-semibold">Smart Conversations</p>
                    <p className="text-sm text-muted-foreground">Natural, context-aware responses</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-left">
                  <span className="text-2xl">🧠</span>
                  <div>
                    <p className="font-semibold">Persistent Memory</p>
                    <p className="text-sm text-muted-foreground">Remembers your conversations</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-left">
                  <span className="text-2xl">🎨</span>
                  <div>
                    <p className="font-semibold">Image Generation</p>
                    <p className="text-sm text-muted-foreground">Create stunning visuals with AI</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleTriggerSignIn}
                className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-lg"
              >
                Sign In to Get Started
              </button>
              
              <p className="text-sm text-muted-foreground">
                Sign in with your Google account to start chatting
              </p>
            </div>
          </div>
        </div>
        <Toaster richColors />
        <AuthDialog
          open={isAuthDialogOpen}
          onOpenChange={setAuthDialogOpen}
          onSignIn={handleSignIn}
        />
      </div>
    );
  }

  // Main app interface for authenticated users
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Header
        user={user}
        onTriggerSignIn={handleTriggerSignIn}
        onTriggerSignUp={handleTriggerSignUp}
        onSignOut={handleSignOut}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onLogoClick={handleLogoClick}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-sidebar transition-colors">
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            onNewChat={handleNewChat}
            recentChats={deduplicateChats(chats)
              .filter(c => !c.archived)
              .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            }
            onSelectChat={handleSelectChat}
            activeChatId={activeChat?.id || null}
          />
        </div>
        <main className="flex-1 overflow-hidden">{renderMainContent()}</main>
      </div>
      <Toaster richColors />
      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={setAuthDialogOpen}
        onSignIn={handleSignIn}
      />
    </div>
  );
}

