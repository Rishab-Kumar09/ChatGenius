import type { Channel, DirectMessage, Message, User } from "./types";

export const mockUsers: User[] = [
  { id: "current", name: "You", email: "you@example.com", isOnline: true },
  { id: "jane", name: "Jane Smith", email: "jane@example.com", isOnline: true },
  { id: "bob", name: "Bob Wilson", email: "bob@example.com", isOnline: false },
];

export const mockChannels: Channel[] = [
  { id: "1", name: "general", description: "General discussion" },
  { id: "2", name: "random", description: "Random chat" },
  { id: "3", name: "help", description: "Get help" },
];

export const mockDirectMessages: DirectMessage[] = [
  { id: "jane", user: mockUsers[1] }, // Jane Smith
  { id: "bob", user: mockUsers[2] }, // Bob Wilson
];

export const mockChannelMessages: Message[] = [
  {
    id: "1",
    content: "Hey everyone! How's it going?",
    sender: mockUsers[0], // You
    timestamp: "2024-03-20T10:00:00Z",
    channelId: "1",
    reactions: [
      { emoji: "👋", users: [mockUsers[1]] },
      { emoji: "👍", users: [mockUsers[1], mockUsers[2]] },
    ],
  },
  {
    id: "2",
    content: "Pretty good! Working on some new features.",
    sender: mockUsers[1], // Jane
    timestamp: "2024-03-20T10:05:00Z",
    channelId: "1",
    reactions: [
      { emoji: "🎉", users: [mockUsers[0]] },
    ],
  },
];

// Conversations for each direct message thread
export const mockDirectMessageThreads: Record<string, Message[]> = {
  "jane": [ // Conversation with Jane Smith
    {
      id: "dm1",
      content: "Hi! Need help with the project?",
      sender: mockUsers[1], // Jane Smith
      timestamp: "2024-03-20T09:00:00Z",
      dmId: "jane",
      reactions: [],
    },
    {
      id: "dm2",
      content: "Yes, could you review my code?",
      sender: mockUsers[0], // You (current user)
      timestamp: "2024-03-20T09:02:00Z",
      dmId: "jane",
      reactions: [],
    }
  ],
  "bob": [ // Conversation with Bob Wilson
    {
      id: "dm3",
      content: "Hey! Are you joining the meeting?",
      sender: mockUsers[2], // Bob Wilson
      timestamp: "2024-03-20T11:00:00Z",
      dmId: "bob",
      reactions: [],
    },
    {
      id: "dm4",
      content: "Yes, I'll be there in 5 minutes",
      sender: mockUsers[0], // You (current user)
      timestamp: "2024-03-20T11:05:00Z",
      dmId: "bob",
      reactions: [],
    }
  ]
};