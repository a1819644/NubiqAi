import {
  MessageSquare,
  Plus,
  History,
  Users,
  FolderOpen,
  BarChart3,
  Settings,
  ChevronRight,
  Bot,
  FileText,
  Home,
  CreditCard,
  User,
  Palette,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { ChatHistory, NavigationSection } from "../types";

interface SidebarProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  onNewChat: () => void;
  recentChats: ChatHistory[];
  onSelectChat: (chat: ChatHistory) => void;
  activeChatId: string | null;
}

// Assuming ActiveSection is NavigationSection from types
type ActiveSection = NavigationSection;

export function Sidebar({
  activeSection,
  onSectionChange,
  onNewChat,
  recentChats,
  onSelectChat,
  activeChatId,
}: SidebarProps) {
  const isWorkspaceExpanded = activeSection.startsWith("workspace");
  const isSettingsExpanded = activeSection.startsWith("settings");

  const mainSidebarItems = [
    {
      type: "button" as const,
      icon: Plus,
      label: "New Chat",
      onClick: onNewChat,
      variant: "default" as const,
    },
    {
      type: "item" as const,
      icon: History,
      label: "History",
      section: "history" as ActiveSection,
    },
    {
      type: "expandable" as const,
      icon: FolderOpen,
      label: "Workspace",
      isExpanded: isWorkspaceExpanded,
      items: [
        {
          icon: Home,
          label: "Overview",
          section: "workspace-overview" as ActiveSection,
        },
        {
          icon: FolderOpen,
          label: "Projects",
          section: "workspace-projects" as ActiveSection,
        },
        {
          icon: Users,
          label: "Team",
          section: "workspace-team" as ActiveSection,
        },
        {
          icon: Bot,
          label: "AI Tools",
          section: "workspace-ai-tools" as ActiveSection,
        },
        {
          icon: FileText,
          label: "Files",
          section: "workspace-files" as ActiveSection,
        },
        {
          icon: BarChart3,
          label: "Analytics",
          section: "workspace-analytics" as ActiveSection,
        },
      ],
    },
    {
      // Settings item moved to the bottom
    }
  ];

  const settingsItem = {
    type: "expandable" as const,
    icon: Settings,
    label: "Settings",
    isExpanded: isSettingsExpanded,
    items: [
      {
        icon: User,
        label: "Account",
        section: "settings-account" as ActiveSection,
      },
      {
        icon: FolderOpen,
        label: "Workspace",
        section: "settings-workspace" as ActiveSection,
      },
      {
        icon: CreditCard,
        label: "Subscription",
        section: "settings-subscription" as ActiveSection,
      },
      {
        icon: Palette,
        label: "Preferences",
        section: "settings-preferences" as ActiveSection,
      },
    ],
  };

  return (
    <div className="w-64 border-r bg-sidebar flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 ">
          <nav className="space-y-2">
            {mainSidebarItems.map((item, index) => {
              if (!item.type) return null; // Skip empty item from settings move

              if (item.type === "button") {
                return (
                  <Button
                    data-tour-id="new-chat-button"
                    key={index}
                    onClick={item.onClick}
                    variant="ghost"
                    className="w-full justify-start bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    {item.label}
                  </Button>
                );
              }

              if (item.type === "item") {
                return (
                  <Button
                    key={index}
                    variant={
                      activeSection === item.section ? "secondary" : "ghost"
                    }
                    className="w-full justify-start hover:bg-gray-200"
                    onClick={() => onSectionChange(item.section)}
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    {item.label}
                  </Button>
                );
              }

              if (item.type === "expandable") {
                return (
                  <Collapsible key={index} open={item.isExpanded}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between hover:bg-gray-200"
                        onClick={() => {
                          // Toggle between expanded state
                          if (item.isExpanded) {
                            onSectionChange("chat");
                          } else {
                            onSectionChange(item.items[0].section as NavigationSection);
                          }
                        }}
                      >
                        <div className="flex items-center">
                          <item.icon className="w-4 h-4 mr-3" />
                          {item.label}
                        </div>
                        <ChevronRight
                          className={cn(
                            "w-4 h-4 transition-transform",
                            item.isExpanded && "rotate-90"
                          )}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4">
                      <div className="space-y-1">
                        {item.items.map((subItem, subIndex) => (
                          <Button
                            key={subIndex}
                            variant={
                              activeSection === subItem.section
                                ? "secondary"
                                : "ghost"
                            }
                            className="w-full justify-start text-sm hover:bg-gray-200"
                            onClick={() => onSectionChange(subItem.section)}
                          >
                            <subItem.icon className="w-4 h-4 mr-3" />
                            {subItem.label}
                          </Button>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              return null;
            })}
          </nav>
        </div>
        {/* Recent Chats Section */}
        <div className="px-4 pt-4 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Recent
          </h3>
          <div className="space-y-1">
            {recentChats.slice(0, 8).map(chat => (
              <Button
                key={chat.id}
                variant={activeChatId === chat.id && activeSection === 'home' ? "secondary" : "ghost"}
                className="w-full justify-start text-sm truncate"
                onClick={() => onSelectChat(chat)}
                title={chat.title}
              >
                <span className="truncate">
                  {chat.title}
                </span>
              </Button>
            ))}
            {recentChats.length > 8 && (
              <Button
                variant="link"
                className="w-full justify-start text-sm text-muted-foreground h-auto p-1 mt-2"
                onClick={() => onSectionChange('history')}
              >
                View all in History...
              </Button>
            )}
          </div>
        </div>
      </div>
      {/* Bottom fixed section */}
      <div className="p-4 border-t border-border">
        <Collapsible open={settingsItem.isExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between hover:bg-gray-200"
              onClick={() => {
                if (settingsItem.isExpanded) {
                  onSectionChange("home");
                } else {
                  onSectionChange(settingsItem.items[0].section as NavigationSection);
                }
              }}
            >
              <div className="flex items-center">
                <settingsItem.icon className="w-4 h-4 mr-3" />
                {settingsItem.label}
              </div>
              <ChevronRight
                className={cn(
                  "w-4 h-4 transition-transform",
                  settingsItem.isExpanded && "rotate-90"
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-4">
            <div className="space-y-1">
              {settingsItem.items.map((subItem, subIndex) => (
                <Button
                  key={subIndex}
                  variant={
                    activeSection === subItem.section ? "secondary" : "ghost"
                  }
                  className="w-full justify-start text-sm hover:bg-gray-200"
                  onClick={() => onSectionChange(subItem.section)}
                >
                  <subItem.icon className="w-4 h-4 mr-3" />
                  {subItem.label}
                </Button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
