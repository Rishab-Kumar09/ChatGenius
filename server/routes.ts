import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocket, WebSocketServer } from 'ws';
import { setupAuth } from "./auth";
import { db } from "@db";
import { channels, messages, channelMembers, userPresence, messageReadStatus, users } from "@db/schema";
import { eq, and, desc, or, ilike } from "drizzle-orm";
import type { SelectMessage, SelectUser } from "@db/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import express from 'express';

const upload = multer({
  storage: multer.diskStorage({
    destination: './uploads/avatars',
    filename: function (req, file, cb) {
      cb(null, `${req.user!.id}-${Date.now()}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  }
});

export function registerRoutes(app: Express): Server {
  // Ensure uploads directory exists
  fs.mkdir('./uploads/avatars', { recursive: true }).catch(console.error);

  // Set up authentication routes and middleware
  setupAuth(app);

  // Message routes with thread support
  app.post("/api/messages", requireAuth, async (req, res) => {
    const { content, channelId, recipientId, parentId } = req.body;

    try {
      // Validate the user can post to this channel/DM
      if (channelId) {
        const [membership] = await db
          .select()
          .from(channelMembers)
          .where(
            and(
              eq(channelMembers.channelId, channelId),
              eq(channelMembers.userId, req.user!.id)
            )
          )
          .limit(1);

        if (!membership) {
          return res.status(403).json({ error: "Not a member of this channel" });
        }
      }

      // If this is a reply, verify parent message exists
      if (parentId) {
        const [parentMessage] = await db
          .select()
          .from(messages)
          .where(eq(messages.id, parentId))
          .limit(1);

        if (!parentMessage) {
          return res.status(404).json({ error: "Parent message not found" });
        }
      }

      const [message] = await db
        .insert(messages)
        .values({
          content,
          senderId: req.user!.id,
          channelId,
          recipientId,
          parentId,
        })
        .returning();

      // Mark as read by sender
      await db.insert(messageReadStatus).values({
        messageId: message.id,
        userId: req.user!.id,
      });

      // Get the full message with sender info for broadcasting
      const [fullMessage] = await db
        .select({
          message: messages,
          sender: users,
        })
        .from(messages)
        .where(eq(messages.id, message.id))
        .innerJoin(users, eq(messages.senderId, users.id))
        .limit(1);

      // Broadcast the new message via WebSocket
      if (fullMessage) {
        broadcastMessage({
          type: 'new_message',
          id: fullMessage.message.id.toString(),
          content: fullMessage.message.content,
          userId: fullMessage.sender.id.toString(),
          channelId: channelId?.toString(),
          dmId: recipientId?.toString(),
          parentId: parentId?.toString(),
          timestamp: fullMessage.message.createdAt.toISOString(),
          readBy: [fullMessage.sender.id.toString()]
        });
      }

      res.json(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Get messages with thread support
  app.get("/api/messages", requireAuth, async (req, res) => {
    const { channelId, recipientId, parentId } = req.query;

    try {
      let query = db
        .select({
          message: messages,
          sender: users,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .orderBy(desc(messages.createdAt))
        .limit(50);

      if (channelId) {
        query = query.where(eq(messages.channelId, parseInt(channelId as string)));
      } else if (recipientId) {
        query = query.where(
          or(
            and(
              eq(messages.recipientId, parseInt(recipientId as string)),
              eq(messages.senderId, req.user!.id)
            ),
            and(
              eq(messages.senderId, parseInt(recipientId as string)),
              eq(messages.recipientId, req.user!.id)
            )
          )
        );
      }

      if (parentId) {
        query = query.where(eq(messages.parentId, parseInt(parentId as string)));
      } else {
        query = query.where(eq(messages.parentId, null));
      }

      const results = await query;

      // Format messages for the client
      const formattedMessages = results.map(({ message, sender }) => ({
        id: message.id.toString(),
        content: message.content,
        sender: {
          id: sender.id,
          username: sender.username,
          displayName: sender.displayName,
          avatarUrl: sender.avatarUrl
        },
        channelId: message.channelId?.toString(),
        recipientId: message.recipientId?.toString(),
        parentId: message.parentId?.toString(),
        timestamp: message.createdAt.toISOString(),
        isEdited: message.isEdited,
        deliveryStatus: message.deliveryStatus
      }));

      res.json(formattedMessages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Get thread replies count
  app.get("/api/messages/:messageId/replies/count", requireAuth, async (req, res) => {
    const { messageId } = req.params;

    try {
      const [[{ count }]] = await db
        .select({ count: db.fn.count() })
        .from(messages)
        .where(eq(messages.parentId, parseInt(messageId)));

      res.json({ count: Number(count) });
    } catch (error) {
      console.error('Failed to get reply count:', error);
      res.status(500).json({ error: "Failed to get reply count" });
    }
  });

  // Update the profile update endpoint to handle aboutMe and note
  app.patch("/api/users/me", requireAuth, async (req, res) => {
    const { displayName, email, aboutMe, note } = req.body;

    try {
      const [updatedUser] = await db
        .update(users)
        .set({
          displayName,
          email,
          aboutMe,
          note,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user!.id))
        .returning();

      res.json(updatedUser);
    } catch (error) {
      console.error('Failed to update profile:', error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Add endpoint to get user profile
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const userId = parseInt(req.params.id);

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Don't send sensitive information
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  // Channel routes
  app.post("/api/channels", requireAuth, async (req, res) => {
    const { name, description, isPrivate } = req.body;

    try {
      const [channel] = await db
        .insert(channels)
        .values({
          name,
          description,
          isPrivate: isPrivate || false,
        })
        .returning();

      // Add creator as channel member with owner role
      await db.insert(channelMembers).values({
        channelId: channel.id,
        userId: req.user!.id,
        role: "owner",
      });

      res.json(channel);
    } catch (error) {
      res.status(500).json({ error: "Failed to create channel" });
    }
  });

  app.get("/api/channels", requireAuth, async (req, res) => {
    try {
      const userChannels = await db
        .select({
          channel: channels,
          role: channelMembers.role,
        })
        .from(channelMembers)
        .where(eq(channelMembers.userId, req.user!.id))
        .innerJoin(channels, eq(channelMembers.channelId, channels.id));

      res.json(userChannels);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  app.post("/api/channels/:id/join", requireAuth, async (req, res) => {
    const channelId = parseInt(req.params.id);

    try {
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }

      if (channel.isPrivate) {
        return res.status(403).json({ error: "Cannot join private channel" });
      }

      await db.insert(channelMembers).values({
        channelId,
        userId: req.user!.id,
        role: "member",
      });

      res.json({ message: "Joined channel successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to join channel" });
    }
  });


  // Search endpoint for messages, channels, and users
  app.get("/api/search", requireAuth, async (req, res) => {
    const { query, type } = req.query;
    const userId = req.user!.id;

    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    try {
      const searchResults: {
        messages: (Partial<SelectMessage> & {
          channel?: { id: number; name: string } | null;
          sender: { id: number; username: string; displayName: string | null };
        })[];
        channels: any[];
        users: any[];
      } = {
        messages: [],
        channels: [],
        users: []
      };

      // If type is not specified or includes 'messages'
      if (!type || type === 'messages') {
        const messageResults = await db
          .select({
            message: messages,
            channel: channels,
            sender: users
          })
          .from(messages)
          .leftJoin(channels, eq(messages.channelId, channels.id))
          .leftJoin(users, eq(messages.senderId, users.id))
          .innerJoin(
            channelMembers,
            and(
              eq(channelMembers.channelId, messages.channelId),
              eq(channelMembers.userId, userId)
            )
          )
          .where(ilike(messages.content, `%${query}%`))
          .orderBy(desc(messages.createdAt))
          .limit(20);

        searchResults.messages = messageResults.map(({ message, channel, sender }) => ({
          ...message,
          channel: channel ? {
            id: channel.id,
            name: channel.name
          } : null,
          sender: sender ? {
            id: sender.id,
            username: sender.username,
            displayName: sender.displayName
          } : {
            id: 0,
            username: 'Unknown',
            displayName: null
          }
        }));
      }

      // If type is not specified or includes 'channels'
      if (!type || type === 'channels') {
        // Search public channels
        const channelResults = await db
          .select()
          .from(channels)
          .where(
            and(
              or(
                ilike(channels.name, `%${query}%`),
                ilike(channels.description, `%${query}%`)
              ),
              eq(channels.isPrivate, false)
            )
          )
          .limit(10);

        searchResults.channels = channelResults;
      }

      // If type is not specified or includes 'users'
      if (!type || type === 'users') {
        // Search users
        const userResults = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName
          })
          .from(users)
          .where(
            or(
              ilike(users.username, `%${query}%`),
              ilike(users.displayName, `%${query}%`)
            )
          )
          .limit(10);

        searchResults.users = userResults;
      }

      res.json(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

  // User presence
  app.post("/api/presence", requireAuth, async (req, res) => {
    const { status } = req.body;

    if (!["online", "offline", "busy"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    try {
      await db
        .insert(userPresence)
        .values({
          userId: req.user!.id,
          status,
        })
        .onConflictDoUpdate({
          target: [userPresence.userId],
          set: { status, lastSeen: new Date() },
        });

      res.json({ message: "Presence updated" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update presence" });
    }
  });

  // Add the delete message endpoint
  app.delete("/api/messages/:messageId", requireAuth, async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user!.id;

    try {
      // Check if message exists and belongs to the user
      const [message] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.id, parseInt(messageId)),
            eq(messages.senderId, userId)
          )
        )
        .limit(1);

      if (!message) {
        return res.status(404).json({ error: "Message not found or not authorized to delete" });
      }

      // Delete the message
      await db
        .delete(messages)
        .where(eq(messages.id, parseInt(messageId)));

      // Broadcast deletion via WebSocket
      broadcastMessage({
        type: 'message_deleted',
        messageId: messageId.toString(),
        userId: userId.toString(),
        timestamp: new Date().toISOString()
      });

      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.error('Failed to delete message:', error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Add message editing endpoint
  app.patch("/api/messages/:messageId", requireAuth, async (req, res) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    try {
      // Check if message exists and belongs to the user
      const [message] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.id, parseInt(messageId)),
            eq(messages.senderId, userId)
          )
        )
        .limit(1);

      if (!message) {
        return res.status(404).json({ error: "Message not found or not authorized to edit" });
      }

      // Update the message
      const [updatedMessage] = await db
        .update(messages)
        .set({
          content,
          isEdited: true,
          updatedAt: new Date()
        })
        .where(eq(messages.id, parseInt(messageId)))
        .returning();

      // Broadcast the edit via WebSocket
      broadcastMessage({
        type: 'message_edited',
        messageId: messageId.toString(),
        userId: userId.toString(),
        content,
        timestamp: new Date().toISOString()
      });

      res.json(updatedMessage);
    } catch (error) {
      console.error('Failed to update message:', error);
      res.status(500).json({ error: "Failed to update message" });
    }
  });

  // Add avatar upload endpoint
  app.post("/api/users/me/avatar", requireAuth, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      // Update user avatar URL in database
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      await db
        .update(users)
        .set({ avatarUrl })
        .where(eq(users.id, req.user!.id));

      res.json({ avatarUrl });
    } catch (error) {
      console.error('Failed to update avatar:', error);
      res.status(500).json({ error: "Failed to update avatar" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  console.log('[WebSocket] Server initialized');

  // In-memory storage for messages and client state
  const messagesInMemory: WebSocketMessage[] = [];
  const clients = new Map<WebSocket, string>();
  const userPresenceInMemory = new Map<string, {status: 'online' | 'busy' | 'offline', lastSeen: string}>();
  const pendingMessages = new Map<string, WebSocketMessage>();

  function broadcastMessage(message: WebSocketMessage, excludeWs?: WebSocket) {
    const messageStr = JSON.stringify(message);
    console.log('[WebSocket] Broadcasting:', message);

    clients.forEach((userId, ws) => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
          console.log(`[WebSocket] Message sent to client ${userId}`);
        } catch (error) {
          console.error(`[WebSocket] Failed to send to client ${userId}:`, error);
          cleanupClient(ws);
        }
      }
    });
  }

  function cleanupClient(ws: WebSocket) {
    const userId = clients.get(ws);
    if (userId) {
      console.log(`[WebSocket] Cleaning up client ${userId}`);
      clients.delete(ws);
      userPresenceInMemory.set(userId, {
        status: 'offline',
        lastSeen: new Date().toISOString()
      });
      broadcastMessage({
        type: 'presence_update',
        userId,
        status: 'offline',
        timestamp: new Date().toISOString()
      });
    }
  }

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket] New connection established');
    let isAlive = true;

    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'connection_established',
      timestamp: new Date().toISOString()
    }));

    // Send current presence state
    userPresenceInMemory.forEach((presence, userId) => {
      try {
        ws.send(JSON.stringify({
          type: 'presence_update',
          userId,
          status: presence.status,
          lastSeen: presence.lastSeen,
          timestamp: new Date().toISOString()
        }));
        console.log(`[WebSocket] Sent presence state for ${userId}`);
      } catch (error) {
        console.error(`[WebSocket] Failed to send presence state for ${userId}:`, error);
      }
    });

    // Send existing messages
    messagesInMemory.forEach(message => {
      if (message.type === 'new_message') {
        try {
          ws.send(JSON.stringify(message));
          console.log('[WebSocket] Sent existing message:', message.id);
        } catch (error) {
          console.error('[WebSocket] Failed to send existing message:', error);
        }
      }
    });


    ws.on('message', (rawData) => {
      try {
        const message: WebSocketMessage = JSON.parse(rawData.toString());
        const timestamp = new Date().toISOString();
        console.log('[WebSocket] Received:', message);

        if (!message.type || !message.userId) {
          console.warn('[WebSocket] Invalid message format:', message);
          return;
        }

        clients.set(ws, message.userId);

        switch (message.type) {
          case 'new_message': {
            if (!message.content) {
              console.warn('[WebSocket] Invalid message format: missing content');
              return;
            }

            const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const newMessage: WebSocketMessage = {
              ...message,
              id: messageId,
              timestamp,
              readBy: [message.userId],
              parentId: message.parentId
            };

            messagesInMemory.push(newMessage);
            pendingMessages.set(messageId, newMessage);

            try {
              ws.send(JSON.stringify({
                type: 'message_confirmed',
                id: messageId,
                content: message.content,
                channelId: message.channelId,
                dmId: message.dmId,
                parentId: message.parentId,
                timestamp
              }));
              console.log('[WebSocket] Sent confirmation for message:', messageId);

              broadcastMessage(newMessage, ws);
              pendingMessages.delete(messageId);
            } catch (error) {
              console.error('[WebSocket] Failed to handle message:', error);
              messagesInMemory.pop();
              pendingMessages.delete(messageId);
            }
            break;
          }

          case 'presence_update': {
            if (!message.status) {
              console.warn('[WebSocket] Invalid presence update format:', message);
              return;
            }

            userPresenceInMemory.set(message.userId, {
              status: message.status,
              lastSeen: timestamp
            });

            broadcastMessage({
              type: 'presence_update',
              userId: message.userId,
              status: message.status,
              lastSeen: timestamp,
              timestamp
            });
            break;
          }

          case 'typing_indicator': {
            broadcastMessage({
              type: 'typing_indicator',
              userId: message.userId,
              channelId: message.channelId,
              dmId: message.dmId,
              isTyping: message.isTyping,
              timestamp
            }, ws);
            break;
          }

          default:
            broadcastMessage(message, ws);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to process message:', error);
      }
    });

    ws.on('close', () => {
      cleanupClient(ws);
      console.log('[WebSocket] Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
      cleanupClient(ws);
    });
  });

  // Handle WebSocket upgrade
  httpServer.on('upgrade', (request, socket, head) => {
    // Ignore vite HMR requests
    if (request.headers['sec-websocket-protocol'] === 'vite-hmr') {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  return httpServer;
}

interface WebSocketMessage {
  type: 'new_message' | 'presence_update' | 'typing_indicator' | 'read_receipt' | 'message_confirmed' | 'connection_established' | 'message_deleted' | 'message_edited';
  messageId?: string;
  userId: string;
  content?: string;
  channelId?: string;
  dmId?: string;
  timestamp: string;
  status?: 'online' | 'busy' | 'offline';
  isTyping?: boolean;
  lastSeen?: string;
  readBy?: string[];
  id?: string;
  parentId?: string;
}

const requireAuth = (req: Express.Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    res.status(401).send("Not authenticated");
    return;
  }
  next();
};