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

  const [chats, setChats] = useState<ChatHistory[]>([
    {
      id: "1",
      title: "Getting Started with AI",
      messages: [
        {
          id: "1",
          content: "Hello! How can I help you today?",
          role: "assistant",
          timestamp: new Date(Date.now() - 3600000),
        },
      ],
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3600000),
      archived: false,
    },
    {
      id: "2",
      title: "Project Planning Discussion",
      messages: [
        {
          id: "2",
          content: "I need help with project planning",
          role: "user",
          timestamp: new Date(Date.now() - 7200000),
        },
        {
          id: "3",
          content:
            "I'd be happy to help you with project planning! What kind of project are you working on?",
          role: "assistant",
          timestamp: new Date(Date.now() - 7150000),
        },
      ],
      createdAt: new Date(Date.now() - 7200000),
      updatedAt: new Date(Date.now() - 7200000),
      archived: false,
    },
  ]);

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

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      setAuthDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // User state will be cleared by the useEffect
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleNewChat = () => {
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
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Header
        user={user || {
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

