import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "@/lib/types";
import { UserAvatar } from "./UserAvatar";
import { format } from "date-fns";
import { useRef, useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Trash2, PencilLine, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface MessageThreadProps {
  messages: Message[];
  onReply?: (message: Message) => void;
  replyingTo?: Message | null;
  currentUserId: string;
}

export function MessageThread({
  messages,
  onReply,
  replyingTo,
  currentUserId
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const messageThreads = useMemo(() => {
    return messages.reduce((acc: { [key: string]: Message[] }, message) => {
      if (message.parentId) {
        if (!acc[message.parentId]) {
          acc[message.parentId] = [];
        }
        acc[message.parentId].push(message);
      } else {
        if (!acc[message.id]) {
          acc[message.id] = [];
        }
      }
      return acc;
    }, {});
  }, [messages]);

  const toggleThread = (messageId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleEdit = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ content: editContent })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setEditingMessageId(null);
      setEditContent("");

      toast({
        title: "Success",
        description: "Message updated successfully",
      });
    } catch (error) {
      console.error('Failed to update message:', error);
      toast({
        title: "Error",
        description: "Failed to update message",
        variant: "destructive",
      });
    }
  };

  const startEditing = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleDelete = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="space-y-1">
        {messages.filter(m => !m.parentId).map((message) => {
          const replies = messageThreads[message.id] || [];
          const hasReplies = replies.length > 0;
          const isExpanded = expandedThreads.has(message.id);
          const previewReplies = hasReplies && !isExpanded ? replies.slice(0, 2) : [];
          const isBeingRepliedTo = replyingTo?.id === message.id;
          const shouldHighlight = hasReplies || isBeingRepliedTo;
          const isParentMessage = messages.some(m => m.parentId === message.id);
          const isOwner = message.sender.id.toString() === currentUserId;
          const isEditing = editingMessageId === message.id;

          return (
            <div key={message.id} className="group">
              <div className={cn(
                "flex items-start rounded-lg px-2 py-1",
                (shouldHighlight || isParentMessage) && "bg-accent/5",
                !shouldHighlight && !isParentMessage && "hover:bg-accent/5",
                isBeingRepliedTo && "border-l-4 border-primary/30 -ml-3 pl-3"
              )}>
                <UserAvatar
                  user={message.sender}
                  className="h-8 w-8 mr-2 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">
                      {message.sender.name || message.sender.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(message.timestamp), 'h:mm a')}
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="mt-1">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[60px] text-sm"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(message.id)}
                          className="h-7 px-2"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">Save</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditing}
                          className="h-7 px-2"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">Cancel</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm mt-0.5 break-words text-foreground">{message.content}</p>
                  )}

                  <div className="flex items-center gap-2 mt-1 min-h-[24px]">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2"
                      onClick={() => onReply?.(message)}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs">Reply</span>
                    </Button>
                    {isOwner && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2"
                          onClick={() => startEditing(message)}
                        >
                          <PencilLine className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(message.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">Delete</span>
                        </Button>
                      </>
                    )}
                  </div>

                  {previewReplies.length > 0 && (
                    <div 
                      className="mt-1 pl-4 border-l-2 border-accent/30 space-y-1 cursor-pointer"
                      onClick={() => toggleThread(message.id)}
                    >
                      {previewReplies.map((reply) => (
                        <div key={reply.id} className="flex items-center gap-2">
                          <UserAvatar
                            user={reply.sender}
                            className="h-5 w-5"
                          />
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            <span className="font-medium text-foreground">
                              {reply.sender.name || reply.sender.username}
                            </span>
                            {" "}
                            {reply.content}
                          </span>
                        </div>
                      ))}
                      {replies.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 -ml-1"
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">
                            View {replies.length - 2} more {replies.length - 2 === 1 ? 'reply' : 'replies'}
                          </span>
                        </Button>
                      )}
                    </div>
                  )}

                  {hasReplies && isExpanded && (
                    <div className="mt-1 pl-4 border-l-2 border-accent/30 space-y-1">
                      {replies.map((reply) => {
                        const isReplyOwner = reply.sender.id.toString() === currentUserId;
                        const isEditingReply = editingMessageId === reply.id;

                        return (
                          <div key={reply.id} className="flex items-start group">
                            <UserAvatar
                              user={reply.sender}
                              className="h-6 w-6 mr-2 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">
                                  {reply.sender.name || reply.sender.username}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(reply.timestamp), 'h:mm a')}
                                </span>
                              </div>
                              {isEditingReply ? (
                                <div className="mt-1">
                                  <Textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="min-h-[60px] text-sm"
                                  />
                                  <div className="flex items-center gap-2 mt-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEdit(reply.id)}
                                      className="h-7 px-2"
                                    >
                                      <Check className="h-3.5 w-3.5 mr-1" />
                                      <span className="text-xs">Save</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={cancelEditing}
                                      className="h-7 px-2"
                                    >
                                      <X className="h-3.5 w-3.5 mr-1" />
                                      <span className="text-xs">Cancel</span>
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm mt-0.5 break-words text-foreground">{reply.content}</p>
                              )}
                              {isReplyOwner && !isEditingReply && (
                                <div className="mt-1 flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2"
                                    onClick={() => startEditing(reply)}
                                  >
                                    <PencilLine className="h-3.5 w-3.5 mr-1" />
                                    <span className="text-xs">Edit</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(reply.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    <span className="text-xs">Delete</span>
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 -ml-1"
                        onClick={() => toggleThread(message.id)}
                      >
                        <span className="text-xs">Hide replies</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}