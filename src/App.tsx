import { useState } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
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
  const { user, signIn, signOut } = useAuth();

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
    },
  ]);

  const [activeChat, setActiveChat] = useState<ChatHistory | null>(chats[0]);

  const handleSignIn = (userData: Omit<User, "isAuthenticated">) => {
    signIn(userData);
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
    setChats((prev) => [newChat, ...prev]);
    setActiveChat(newChat);
    setActiveSection("home");
    toast.success("New chat created");
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
              setChats((prev) =>
                prev.map((chat) =>
                  chat.id === updatedChat.id ? updatedChat : chat
                )
              );
            }}
          />
        );
      // case "history":
      //   return (
      //     <History
      //       chats={chats}
      //       onSelectChat={(chat) => {
      //         setActiveChat(chat);
      //         setActiveSection("chat");
      //       }}
      //       onDeleteChat={(chatId) => {
      //         // --- PERBAIKAN LOGIKA ADA DI SINI ---
      //         setChats((prev) => {
      //           const newChats = prev.filter((chat) => chat.id !== chatId);
      //           if (activeChat?.id === chatId) {
      //             setActiveChat(newChats[0] || null);
      //           }
      //           return newChats;
      //         });
      //         // --- AKHIR PERBAIKAN ---
      //       }}
      //       onArchiveChat={(chatId) => {
      //         setChats((prev) =>
      //           prev.map((chat) =>
      //             chat.id === chatId
      //               ? { ...chat, archived: !chat.archived }
      //               : chat
      //           )
      //         );
      //       }}
      //     />
      //   );
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
          <ChatInterface activeChat={activeChat} onUpdateChat={() => {}} />
        );
    }
  };

  // Show loading screen while checking authentication
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Header
        user={(user as User) || {
          id: "",
          name: "",
          email: "",
          avatar: "",
          isAuthenticated: false,
          subscription: "free",
        }}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-sidebar transition-colors">
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            onNewChat={handleNewChat}
          />
        </div>
        <main className="flex-1 overflow-hidden">{renderMainContent()}</main>
      </div>
      <Toaster richColors />
    </div>
  );
}
