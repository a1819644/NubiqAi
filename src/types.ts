// export interface User {
//   id: string;
//   name: string;
//   email: string;
//   avatar?: string;
//   isAuthenticated: boolean;
//   subscription: 'free' | 'pro' | 'enterprise';
// }

// export interface ChatMessage {
//   id: string;
//   content: string;
//   role: 'user' | 'assistant';
//   timestamp: Date;
//   files?: UploadedFile[];
//   type?: 'text' | 'confirmation' | 'image' | 'loading';
//   imageUrl?: string;
//   isConfirmation?: boolean;
//   confirmationId?: string;
//   attachments?: string[];
// }

// export interface ChatHistory {
//   id:string;
//   title: string;
//   messages: ChatMessage[];
//   createdAt: Date;
//   updatedAt: Date;
// }

// export interface UploadedFile {
//   id: string;
//   name: string;
//   size: number;
//   type: string;
//   url: string;
// }

// export interface WorkspaceProject {
//   id: string;
//   name: string;
//   description: string;
//   status: 'active' | 'completed' | 'archived';
//   createdAt: Date;
//   updatedAt: Date;
// }

// export interface TeamMember {
//   id: string;
//   name: string;
//   email: string;
//   role: 'owner' | 'admin' | 'member';
//   avatar?: string;
// }

// export type NavigationSection = 'home' | 'history' | 'workspace' | 'settings';

// export type SettingsSection = 'account' | 'workspace-settings' | 'subscription' | 'preferences';

// export type WorkspaceSection = 'overview' | 'projects' | 'team' | 'ai-tools' | 'files' | 'analytics';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isAuthenticated: boolean;
  subscription: 'free' | 'pro' | 'enterprise';
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  files?: UploadedFile[];
  type?: 'text' | 'confirmation' | 'image' | 'loading';
  imageUrl?: string;
  isConfirmation?: boolean;
  confirmationId?: string;
}

export interface ChatHistory {
  id:string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  archived?: boolean;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  avatar?: string;
}

export type NavigationSection = 'home' | 'history' | 'workspace' | 'settings';

export type SettingsSection = 'account' | 'workspace-settings' | 'subscription' | 'preferences';

export type WorkspaceSection = 'overview' | 'projects' | 'team' | 'ai-tools' | 'files' | 'analytics';