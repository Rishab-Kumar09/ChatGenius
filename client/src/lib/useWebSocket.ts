import { useState, useEffect, useCallback } from 'react';
import { PresenceUpdate, Message } from './types';
import { mockUsers } from './mock-data';

// Message types supported by the WebSocket connection
interface WebSocketMessage {
  type: 'add_reaction' | 'remove_reaction' | 'new_message' | 'presence_update' | 'typing_indicator' | 'read_receipt' | 'message_confirmed' | 'connection_established';
  messageId?: string;
  emoji?: string;
  userId: string;
  content?: string;
  channelId?: string;
  dmId?: string;
  timestamp?: string;
  status?: 'online' | 'busy' | 'offline';
  isTyping?: boolean;
  lastSeen?: string;
  readBy?: string[];
  id?: string;
  parentId?: string; // Added for reply support
}

export function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [presenceUpdates, setPresenceUpdates] = useState<Map<string, PresenceUpdate>>(new Map());
  const [typingIndicators, setTypingIndicators] = useState<Map<string, Set<string>>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [reconnectTimer, setReconnectTimer] = useState<NodeJS.Timeout>();
  const [pendingMessages] = useState<Set<string>>(new Set());

  // WebSocket connection management with proper cleanup and error handling
  useEffect(() => {
    let socket: WebSocket | null = null;
    let isDestroyed = false;

    async function connect() {
      if (isDestroyed) return;

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        console.log('[WebSocket] Connecting to:', wsUrl);

        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          if (isDestroyed) return;
          console.log('[WebSocket] Connected');
          setIsConnected(true);
          setWs(socket);
          setRetryCount(0);

          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            setReconnectTimer(undefined);
          }
        };

        socket.onmessage = (event) => {
          if (isDestroyed) return;

          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            console.log('[WebSocket] Received:', data);

            switch (data.type) {
              case 'connection_established': {
                console.log('[WebSocket] Connection confirmed by server');
                break;
              }

              case 'presence_update': {
                if (!data.userId || !data.status) {
                  console.warn('[WebSocket] Invalid presence update:', data);
                  return;
                }

                setPresenceUpdates(prev => {
                  const next = new Map(prev);
                  next.set(data.userId, {
                    userId: data.userId,
                    status: data.status || 'offline',
                    lastSeen: data.lastSeen
                  });
                  return next;
                });
                break;
              }

              case 'new_message': {
                if (!data.content || !data.userId || !data.id) {
                  console.warn('[WebSocket] Invalid message format:', data);
                  return;
                }

                const sender = mockUsers.find(u => u.id === data.userId) || mockUsers[0];
                const newMessage: Message = {
                  id: data.id,
                  content: data.content,
                  sender,
                  timestamp: data.timestamp || new Date().toISOString(),
                  channelId: data.channelId,
                  dmId: data.dmId,
                  reactions: [],
                  readBy: data.readBy || [],
                  parentId: data.parentId // Add parentId to new messages
                };

                console.log('[WebSocket] Processing new message:', newMessage);

                setMessages(prev => {
                  if (prev.some(m => m.id === newMessage.id)) {
                    return prev;
                  }

                  const filtered = prev.filter(m => {
                    if (m.id.startsWith('temp_')) {
                      return m.content !== newMessage.content;
                    }
                    return true;
                  });

                  return [...filtered, newMessage].sort((a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  );
                });
                break;
              }

              case 'message_confirmed': {
                if (!data.id || !data.content) return;

                console.log('[WebSocket] Message confirmed:', data);
                pendingMessages.delete(data.content);

                setMessages(prev => {
                  const filtered = prev.filter(m => {
                    if (m.id.startsWith('temp_')) {
                      return m.content !== data.content;
                    }
                    return true;
                  });

                  const confirmedMessage: Message = {
                    id: data.id!,
                    content: data.content!,
                    sender: mockUsers[0],
                    timestamp: data.timestamp || new Date().toISOString(),
                    channelId: data.channelId,
                    dmId: data.dmId,
                    reactions: [],
                    readBy: [mockUsers[0].id],
                    parentId: data.parentId // Add parentId to confirmed messages
                  };

                  return [...filtered, confirmedMessage].sort((a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  );
                });
                break;
              }

              case 'typing_indicator': {
                if (!data.userId) return;

                setTypingIndicators(prev => {
                  const next = new Map(prev);
                  const key = data.channelId || data.dmId || '';
                  const users = next.get(key) || new Set();

                  if (data.isTyping) {
                    users.add(data.userId);
                  } else {
                    users.delete(data.userId);
                  }

                  next.set(key, users);
                  return next;
                });
                break;
              }
            }
          } catch (error) {
            console.error('[WebSocket] Failed to process message:', error);
          }
        };

        socket.onclose = () => {
          if (isDestroyed) return;

          console.log('[WebSocket] Disconnected');
          setIsConnected(false);
          setWs(null);
          pendingMessages.clear();


          if (retryCount < 5) {
            const nextRetry = Math.min(1000 * Math.pow(2, retryCount), 10000);
            console.log(`[WebSocket] Reconnecting in ${nextRetry}ms...`);

            const timer = setTimeout(() => {
              if (!isDestroyed) {
                setRetryCount(prev => prev + 1);
                connect();
              }
            }, nextRetry);

            setReconnectTimer(timer);
          }
        };

        socket.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
        };

      } catch (error) {
        console.error('[WebSocket] Failed to connect:', error);
        setIsConnected(false);
        setWs(null);
      }
    }

    connect();

    return () => {
      isDestroyed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [retryCount, reconnectTimer]);

  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Not connected, message not sent');
      return false;
    }

    try {
      console.log('[WebSocket] Sending:', message);

      if (message.type === 'new_message' && message.content) {
        pendingMessages.add(message.content);

        const tempMessage: Message = {
          id: `temp_${Date.now()}`,
          content: message.content,
          sender: mockUsers[0],
          timestamp: new Date().toISOString(),
          channelId: message.channelId,
          dmId: message.dmId,
          reactions: [],
          readBy: [mockUsers[0].id]
        };

        setMessages(prev => [...prev, tempMessage].sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ));
      }

      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WebSocket] Failed to send:', error);
      return false;
    }
  }, [ws, pendingMessages]);

  const updatePresence = useCallback((status: 'online' | 'busy' | 'offline') => {
    console.log('[WebSocket] Updating presence:', status);
    const sent = sendMessage({
      type: 'presence_update',
      userId: mockUsers[0].id,
      status,
      timestamp: new Date().toISOString()
    });

    if (sent) {
      setPresenceUpdates(prev => {
        const next = new Map(prev);
        next.set(mockUsers[0].id, {
          userId: mockUsers[0].id,
          status,
          lastSeen: new Date().toISOString()
        });
        return next;
      });
    }
  }, [sendMessage]);

  const updateTyping = useCallback((isTyping: boolean, channelId?: string, dmId?: string) => {
    sendMessage({
      type: 'typing_indicator',
      userId: mockUsers[0].id,
      isTyping,
      channelId,
      dmId,
      timestamp: new Date().toISOString()
    });
  }, [sendMessage]);

  return {
    sendMessage,
    updatePresence,
    updateTyping,
    messages,
    presenceUpdates,
    typingIndicators,
    isConnected
  };
}