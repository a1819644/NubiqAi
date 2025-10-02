import React, { useState } from "react";
import { MessageSquare, Trash2, Archive, Search, Filter } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "./ui/utils";
import { toast } from "sonner";
import type { Chat } from "../App";

interface HistoryProps {
  chats: Chat[];
  onSelectChat: (chat: Chat) => void;
  onDeleteChat: (chatId: string) => void;
  onArchiveChat: (chatId: string) => void;
}

export function History({
  chats,
  onSelectChat,
  onDeleteChat,
  onArchiveChat,
}: HistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "active" | "archived">(
    "all"
  );

  const filteredChats = chats.filter((chat) => {
    const matchesSearch =
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.messages.some((msg) =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesFilter =
      filterType === "all" ||
      (filterType === "active" && !chat.archived) ||
      (filterType === "archived" && chat.archived);

    return matchesSearch && matchesFilter;
  });

  const handleDeleteChat = (chatId: string, chatTitle: string) => {
    onDeleteChat(chatId);
    toast.success(`Deleted "${chatTitle}"`);
  };

  const handleArchiveChat = (
    chatId: string,
    chatTitle: string,
    isArchived: boolean
  ) => {
    onArchiveChat(chatId);
    toast.success(`${isArchived ? "Unarchived" : "Archived"} "${chatTitle}"`);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Chat History</h2>
          <Badge variant="secondary">
            {filteredChats.length}{" "}
            {filteredChats.length === 1 ? "chat" : "chats"}
          </Badge>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilterType("all")}>
                All Chats
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType("active")}>
                Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType("archived")}>
                Archived
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1 h-0">
        <div className="p-4 space-y-2">
          {filteredChats.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">No chats found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search terms"
                  : "Start a new chat to see it here"}
              </p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "group p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors",
                  chat.archived && "opacity-60"
                )}
                onClick={() => onSelectChat(chat)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{chat.title}</h3>
                      {chat.archived && (
                        <Badge variant="secondary" className="text-xs">
                          Archived
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {chat.messages.length > 0
                        ? chat.messages[chat.messages.length - 1].content
                        : "No messages"}
                    </p>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(chat.updatedAt)}</span>
                      <span>{chat.messages.length} messages</span>
                    </div>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="sr-only">More options</span>
                          <div className="w-1 h-1 bg-current rounded-full" />
                          <div className="w-1 h-1 bg-current rounded-full" />
                          <div className="w-1 h-1 bg-current rounded-full" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveChat(
                              chat.id,
                              chat.title,
                              chat.archived
                            );
                          }}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          {chat.archived ? "Unarchive" : "Archive"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(chat.id, chat.title);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
