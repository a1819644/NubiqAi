import React, { useState } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ChatInterface } from "./components/ChatInterface";
import { History } from "./components/History";
import { Workspace } from "./components/Workspace";
import { Settings } from "./components/Settings";
import { Toaster } from "./components/ui/sonner";
import { useDarkMode } from "./hooks/useDarkMode";

export type User = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  dob: string;
  profilePicture: string;
  isAuthenticated: boolean;
};

export type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  attachments?: string[];
  notes?: string;
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
  archived: boolean;
};

export type ActiveSection =
  | "chat"
  | "history"
  | "workspace-overview"
  | "workspace-projects"
  | "workspace-team"
  | "workspace-ai-tools"
  | "workspace-files"
  | "workspace-analytics"
  | "settings-account"
  | "settings-workspace"
  | "settings-subscription"
  | "settings-preferences";

export default function App() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const [activeSection, setActiveSection] = useState<ActiveSection>("chat");
  const [user, setUser] = useState<User>({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    dob: "",
    profilePicture: "",
    isAuthenticated: false,
  });

  const [chats, setChats] = useState<Chat[]>([
    {
      id: "1",
      title: "Getting Started with AI",
      messages: [
        {
          id: "1",
          content: "Hello! How can I help you today?",
          sender: "ai",
          timestamp: new Date(Date.now() - 3600000),
        },
      ],
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
          sender: "user",
          timestamp: new Date(Date.now() - 7200000),
        },
        {
          id: "3",
          content:
            "I'd be happy to help you with project planning! What kind of project are you working on?",
          sender: "ai",
          timestamp: new Date(Date.now() - 7150000),
        },
      ],
      updatedAt: new Date(Date.now() - 7200000),
      archived: false,
    },
  ]);

  const [activeChat, setActiveChat] = useState<Chat | null>(chats[0]);

  const handleSignIn = (userData: Omit<User, "isAuthenticated">) => {
    setUser({ ...userData, isAuthenticated: true });
  };

  const handleSignOut = () => {
    setUser({
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      dob: "",
      profilePicture: "",
      isAuthenticated: false,
    });
  };

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      updatedAt: new Date(),
      archived: false,
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChat(newChat);
    setActiveSection("chat");
  };

  const renderMainContent = () => {
    switch (activeSection) {
      case "chat":
        return (
          <ChatInterface
            activeChat={activeChat}
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
      case "history":
        return (
          <History
            chats={chats}
            onSelectChat={(chat) => {
              setActiveChat(chat);
              setActiveSection("chat");
            }}
            onDeleteChat={(chatId) => {
              // --- PERBAIKAN LOGIKA ADA DI SINI ---
              setChats((prev) => {
                const newChats = prev.filter((chat) => chat.id !== chatId);
                if (activeChat?.id === chatId) {
                  setActiveChat(newChats[0] || null);
                }
                return newChats;
              });
              // --- AKHIR PERBAIKAN ---
            }}
            onArchiveChat={(chatId) => {
              setChats((prev) =>
                prev.map((chat) =>
                  chat.id === chatId
                    ? { ...chat, archived: !chat.archived }
                    : chat
                )
              );
            }}
          />
        );
      case "workspace-overview":
      case "workspace-projects":
      case "workspace-team":
      case "workspace-ai-tools":
      case "workspace-files":
      case "workspace-analytics":
        return (
          <Workspace section={activeSection.replace("workspace-", "") as any} />
        );
      case "settings-account":
      case "settings-workspace":
      case "settings-subscription":
      case "settings-preferences":
        return (
          <Settings
            section={activeSection.replace("settings-", "") as any}
            user={user}
            onUpdateUser={setUser}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        );
      default:
        return (
          <ChatInterface activeChat={activeChat} onUpdateChat={() => {}} />
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Header
        user={user}
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
      <Toaster />
    </div>
  );
}
