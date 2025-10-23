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
import React from "react";

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

// Create a reusable NavItem component for consistent styling
const NavItem = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { isActive?: boolean }
>(({ className, isActive, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant="ghost"
      className={cn(
        "w-full justify-start text-sm transition-all duration-200 ease-in-out",
        "text-[#4B5563] dark:text-[#9CA3AF] font-normal", // Inactive state
        "hover:bg-[#F9FAFB] hover:dark:bg-[#383838] hover:text-[#1F2937] hover:dark:text-[#FAFAFA] hover:font-medium", // Hover state
        isActive && "bg-[#F3F4F6] dark:bg-[#2D2D2D] text-[#111827] dark:text-white font-semibold", // Active state
        className
      )}
      {...props}
    />
  );
});
NavItem.displayName = "NavItem";

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
    <aside className="w-64 border-r bg-muted/20 dark:bg-zinc-900/50 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <nav className="space-y-1">
            {mainSidebarItems.map((item, index) => {
              if (!item.type) return null; // Skip empty item from settings move
  
              if (item.type === "button") {
                return (
                  <NavItem
                    data-tour-id="new-chat-button"
                    key={index}
                    onClick={item.onClick}
                    className="font-semibold !text-primary dark:!text-primary hover:!bg-primary/10 dark:hover:!bg-primary/10"
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    {item.label}
                  </NavItem>
                );
              }

              if (item.type === "item") {
                return (
                  <NavItem
                    key={index}
                    isActive={activeSection === item.section}
                    onClick={() => onSectionChange(item.section)}
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    {item.label}
                  </NavItem>
                );
              }

              if (item.type === "expandable") {
                return (
                  <Collapsible key={index} open={item.isExpanded}>
                    <CollapsibleTrigger asChild>
                      <NavItem
                        isActive={item.isExpanded}
                        className="w-full justify-between"
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
                      </NavItem>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4">
                      <div className="space-y-1 mt-1">
                        {item.items.map((subItem, subIndex) => (
                          <NavItem
                            key={subIndex}
                            isActive={activeSection === subItem.section}
                            onClick={() => onSectionChange(subItem.section)}
                          >
                            <subItem.icon className="w-4 h-4 mr-3" />
                            {subItem.label}
                          </NavItem>
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
        <div className="px-4 pt-3 mt-2 border-t border-white/5 dark:border-white/5">
          <h3 className="text-xs font-medium text-muted-foreground/80 tracking-wide mb-2 px-3 text-[#9CA3AF]">
            Recent
          </h3>
          <div className="space-y-1">
            {recentChats.slice(0, 8).map(chat => (
              <NavItem
                key={chat.id}
                isActive={activeChatId === chat.id && activeSection === 'home'}
                className="truncate"
                onClick={() => onSelectChat(chat)}
                title={chat.title}
              >
                <span className="truncate">
                  {chat.title}
                </span>
              </NavItem>
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
      <div className="p-4 border-t border-white/5 dark:border-white/5">
        <Collapsible open={settingsItem.isExpanded}>
          <CollapsibleTrigger asChild>
            <NavItem
              isActive={settingsItem.isExpanded}
              className="w-full justify-between"
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
            </NavItem>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-4 mt-1">
            <div className="space-y-1 ">
              {settingsItem.items.map((subItem, subIndex) => (
                <NavItem
                  key={subIndex}
                  isActive={activeSection === subItem.section}
                  onClick={() => onSectionChange(subItem.section)}
                >
                  <subItem.icon className="w-4 h-4 mr-3" />
                  {subItem.label}
                </NavItem>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </aside>
  );
}
