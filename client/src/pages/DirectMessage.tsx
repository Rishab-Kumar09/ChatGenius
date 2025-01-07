import { MessageThread } from "@/components/MessageThread";
import { MessageInput } from "@/components/MessageInput";
import { useParams } from "wouter";
import { mockDirectMessages, mockUsers, mockDirectMessageThreads } from "@/lib/mock-data";
import { UserAvatar } from "@/components/UserAvatar";
import { useWebSocket } from "@/lib/useWebSocket";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/lib/types";
import { Circle } from "lucide-react";

export function DirectMessage() {
  const { id } = useParams();
  const { sendMessage, messages: wsMessages, isConnected, presenceUpdates } = useWebSocket();
  const currentUser = mockUsers[0];
  const dm = mockDirectMessages.find(d => d.id === id);
  const { toast } = useToast();
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Sync messages from mock data and WebSocket
  useEffect(() => {
    if (!id) return;

    // Get initial messages from mock data
    const mockMessages = mockDirectMessageThreads[id] || [];
    // Get WebSocket messages for this DM
    const dmMessages = wsMessages.filter(m => m.dmId === id);

    console.log('[DirectMessage] Initial mock messages:', mockMessages);
    console.log('[DirectMessage] Current DM messages:', dmMessages);

    // Combine and sort all messages by timestamp
    const allMessages = [...mockMessages, ...dmMessages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Deduplicate messages by id, keeping the most recent version
    const messageMap = new Map<string, Message>();
    allMessages.forEach(msg => {
      if (msg.id.startsWith('temp_')) {
        // For temporary messages, only keep them if there's no confirmed version
        if (!messageMap.has(msg.content)) {
          messageMap.set(msg.content, msg);
        }
      } else {
        // For confirmed messages, always keep the latest version
        messageMap.set(msg.id, msg);
      }
    });

    setLocalMessages(Array.from(messageMap.values()));
  }, [id, wsMessages]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!dm) {
      toast({
        title: "Cannot send message",
        description: "Conversation not found",
        variant: "destructive"
      });
      throw new Error("Conversation not found");
    }

    if (!isConnected) {
      toast({
        title: "Cannot send message",
        description: "Not connected to server. Please try again.",
        variant: "destructive"
      });
      throw new Error("Not connected to server");
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error("Message cannot be empty");
    }

    console.log('[DirectMessage] Sending message:', {
      content: trimmedContent,
      dmId: id,
      userId: currentUser.id,
      parentId: replyingTo?.id
    });

    try {
      // Send via WebSocket
      const sent = sendMessage({
        type: 'new_message',
        content: trimmedContent,
        userId: currentUser.id,
        dmId: id,
        parentId: replyingTo?.id
      });

      if (!sent) {
        throw new Error("Failed to send message");
      }

      // Clear reply state after successful send
      setReplyingTo(null);

      console.log('[DirectMessage] Message sent successfully');
    } catch (error) {
      console.error('[DirectMessage] Failed to send message:', error);
      throw error;
    }
  }, [dm, currentUser, id, isConnected, sendMessage, toast, replyingTo]);

  const handleReply = useCallback((message: Message) => {
    console.log('[DirectMessage] Setting reply to:', message);
    setReplyingTo(message);
  }, []);

  if (!dm) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Conversation not found</p>
      </div>
    );
  }

  const userStatus = presenceUpdates.get(dm.user.id)?.status || 'offline';

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4 flex items-center gap-2">
        <UserAvatar user={dm.user} className="h-8 w-8" />
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            {dm.user.name}
            <Circle className={`h-3 w-3 fill-current ${
              userStatus === 'online' ? "text-green-500" :
              userStatus === 'busy' ? "text-red-500" :
              "text-gray-500"
            }`} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {isConnected ? (
              <>
                <span className="capitalize">{userStatus}</span>
                {userStatus !== 'online' && presenceUpdates.get(dm.user.id)?.lastSeen && (
                  <> · Last seen {new Date(presenceUpdates.get(dm.user.id)!.lastSeen!).toLocaleString()}</>
                )}
              </>
            ) : (
              'Connecting...'
            )}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <MessageThread 
          messages={localMessages} 
          onReply={handleReply}
          replyingTo={replyingTo}
        />
        <MessageInput 
          onSend={handleSendMessage} 
          disabled={!isConnected}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>
    </div>
  );
}