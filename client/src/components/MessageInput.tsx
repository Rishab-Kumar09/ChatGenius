import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal, Loader2, X, Reply } from "lucide-react";
import { KeyboardEvent, useState, useEffect, useCallback } from "react";
import { useWebSocket } from "@/lib/useWebSocket";
import { useParams } from "wouter";
import { Message } from "@/lib/types";

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

export function MessageInput({ 
  onSend, 
  disabled = false,
  replyingTo,
  onCancelReply
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const { id } = useParams();
  const { updateTyping, typingIndicators } = useWebSocket();
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout>();
  const [isSending, setIsSending] = useState(false);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        updateTyping(false, undefined, id);
      }
    };
  }, [typingTimeout, updateTyping, id]);

  const handleTyping = useCallback(() => {
    updateTyping(true, undefined, id);

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    const timeout = setTimeout(() => {
      updateTyping(false, undefined, id);
    }, 2000);

    setTypingTimeout(timeout);
  }, [id, typingTimeout, updateTyping]);

  const handleSend = useCallback(async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled || isSending) return;

    setIsSending(true);
    console.log('Attempting to send message:', trimmedMessage);

    try {
      await onSend(trimmedMessage);
      console.log('Message sent successfully');
      setMessage("");

      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      updateTyping(false, undefined, id);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  }, [message, disabled, onSend, typingTimeout, updateTyping, id, isSending]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else {
      handleTyping();
    }
  }, [handleSend, handleTyping]);

  // Get typing indicators for current chat
  const typingUsers = (typingIndicators?.get(id || "") || new Set()).size > 0;

  return (
    <div className="p-4 border-t bg-background">
      {replyingTo && (
        <div className="mb-2 pl-2 border-l-4 border-primary/30">
          <div className="flex items-start gap-2 bg-accent/5 p-2 rounded">
            <Reply className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span>Replying to</span>
                <span className="font-semibold text-foreground">{replyingTo.sender.name}</span>
              </p>
              <p className="text-sm text-foreground truncate mt-0.5">
                {replyingTo.content}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancelReply}
              className="h-6 w-6 -mt-1 -mr-1 hover:bg-accent/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {typingUsers && (
        <div className="text-sm text-muted-foreground mb-2">
          Someone is typing...
        </div>
      )}
      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            handleTyping();
          }}
          onKeyPress={handleKeyPress}
          placeholder={replyingTo ? "Write a reply..." : "Type a message..."}
          className="min-h-[80px]"
          disabled={disabled || isSending}
        />
        <Button
          onClick={handleSend}
          className="self-end"
          disabled={disabled || isSending || !message.trim()}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}