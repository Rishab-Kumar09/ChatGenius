import type { SelectUser } from "@db/schema";

export interface User extends SelectUser {
  isOnline?: boolean;
  status?: 'online' | 'busy' | 'offline';
  isTyping?: boolean;
  name?: string; // Add name property that defaults to username if not set
}

export interface Channel {
  id: string;
  name: string;
  description: string;
}

export interface DirectMessage {
  id: string;
  user: User;
}

export interface Message {
  id: string;
  content: string;
  sender: User;
  timestamp: string;
  channelId?: string;
  dmId?: string;
  readBy?: string[]; 
  parentId?: string; 
  replyCount?: number;
  thread?: Message[]; // Add thread property to store replies
}

export interface PresenceUpdate {
  userId: string;
  status: 'online' | 'busy' | 'offline';
  lastSeen?: string;
}

export interface TypingIndicator {
  userId: string;
  channelId?: string;
  dmId?: string;
  isTyping: boolean;
}