import { MessageThread } from "@/components/MessageThread";
import { MessageInput } from "@/components/MessageInput";
import { useParams } from "wouter";
import { mockChannels, mockUsers, mockChannelMessages } from "@/lib/mock-data";
import { Hash } from "lucide-react";
import { useWebSocket } from "@/lib/useWebSocket";
import { useState, useEffect, useCallback } from "react";
import type { Message } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export function Channel() {
  const { id } = useParams();
  const { sendMessage, messages: wsMessages, isConnected } = useWebSocket();
  const currentUser = mockUsers[0];
  const channel = mockChannels.find(c => c.id === id);
  const { toast } = useToast();
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Combine mock and websocket messages for the current channel
  useEffect(() => {
    if (!id) return;

    const mockMessages = mockChannelMessages.filter(m => m.channelId === id);
    const channelMessages = wsMessages.filter(m => m.channelId === id);

    // Sort messages by timestamp
    const allMessages = [...mockMessages, ...channelMessages].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Deduplicate messages by id, keeping the most recent version
    const messageMap = new Map<string, Message>();
    allMessages.forEach(msg => {
      // For temp messages, only keep them if there's no confirmed version
      if (msg.id.startsWith('temp_')) {
        if (!messageMap.has(msg.content)) {
          messageMap.set(msg.content, msg);
        }
      } else {
        messageMap.set(msg.id, msg);
      }
    });

    setLocalMessages(Array.from(messageMap.values()));
  }, [id, wsMessages]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!channel) {
      toast({
        title: "Cannot send message",
        description: "Channel not found",
        variant: "destructive"
      });
      throw new Error("Channel not found");
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

    try {
      // Attempt to send via WebSocket
      const sent = sendMessage({
        type: 'new_message',
        content: trimmedContent,
        userId: currentUser.id,
        channelId: id,
        parentId: replyingTo?.id // Include parentId if replying
      });

      if (!sent) {
        throw new Error("Failed to send message");
      }

      // Clear reply state after sending
      setReplyingTo(null);
    } catch (error) {
      throw error;
    }
  }, [channel, currentUser, id, isConnected, sendMessage, toast, replyingTo]);

  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Channel not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4 flex items-center gap-2">
        <Hash className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">
            {channel.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Connecting...'}
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