import { useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { MessageInput } from "@/components/MessageInput";
import { mockDirectMessages, mockDirectMessageThreads } from "@/lib/mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/UserAvatar";

export default function DMPage() {
  const [, params] = useRoute('/dm/:id');
  const dmId = params?.id;

  const dm = mockDirectMessages.find(d => d.id === dmId);
  const messages = mockDirectMessageThreads[dmId || ''] || [];

  const handleSendMessage = (content: string) => {
    console.log('Sending DM:', content);
    // In a real app, this would send via WebSocket
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b p-4 flex items-center gap-3">
        {dm?.user && (
          <>
            <UserAvatar user={dm.user} className="h-8 w-8" />
            <div>
              <h2 className="text-lg font-semibold">{dm.user.name}</h2>
              <p className="text-sm text-muted-foreground">
                {dm.user.isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <UserAvatar user={message.sender} className="h-8 w-8 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{message.sender.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <MessageInput onSend={handleSendMessage} />
    </div>
  );
}