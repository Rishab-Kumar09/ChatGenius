import { Message, Channel, DirectMessage } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface SearchResultsProps {
  query: string;
  messages: Message[];
  channels: Channel[];
  directMessages: DirectMessage[];
  onSelect: (type: 'message' | 'channel' | 'dm', id: string) => void;
}

export function SearchResults({
  query,
  messages,
  channels,
  directMessages,
  onSelect
}: SearchResultsProps) {
  if (!query) return null;

  const filteredMessages = messages.filter(message =>
    message.content.toLowerCase().includes(query.toLowerCase())
  );

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(query.toLowerCase())
  );

  const filteredDMs = directMessages.filter(dm =>
    dm.user.name.toLowerCase().includes(query.toLowerCase())
  );

  const highlightText = (text: string) => {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return <mark key={i} className="bg-yellow-200 dark:bg-yellow-900 dark:text-white px-1 rounded">{part}</mark>;
      }
      return part;
    });
  };

  if (filteredMessages.length === 0 && filteredChannels.length === 0 && filteredDMs.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No results found for "{query}"
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      {filteredChannels.length > 0 && (
        <div className="p-2">
          <h3 className="text-sm font-medium mb-2 px-2">Channels</h3>
          {filteredChannels.map(channel => (
            <Button
              key={channel.id}
              variant="ghost"
              className="w-full justify-start mb-1 h-auto py-2"
              onClick={() => onSelect('channel', channel.id)}
            >
              <Hash className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
              <span>{highlightText(channel.name)}</span>
            </Button>
          ))}
        </div>
      )}

      {filteredDMs.length > 0 && (
        <div className="p-2">
          <h3 className="text-sm font-medium mb-2 px-2">People</h3>
          {filteredDMs.map(dm => (
            <Button
              key={dm.id}
              variant="ghost"
              className="w-full justify-start mb-1 h-auto py-2"
              onClick={() => onSelect('dm', dm.id)}
            >
              <UserAvatar user={dm.user} className="h-6 w-6 mr-2 flex-shrink-0" />
              <span>{highlightText(dm.user.name)}</span>
            </Button>
          ))}
        </div>
      )}

      {filteredMessages.length > 0 && (
        <div className="p-2">
          <h3 className="text-sm font-medium mb-2 px-2">Messages</h3>
          {filteredMessages.map(message => (
            <Button
              key={message.id}
              variant="ghost"
              className="w-full justify-start mb-1 h-auto py-2"
              onClick={() => {
                const chatId = message.channelId || message.dmId;
                if (chatId) {
                  onSelect(
                    message.channelId ? 'channel' : 'dm',
                    chatId
                  );
                }
              }}
            >
              <div className="flex items-start gap-2 w-full overflow-hidden">
                <UserAvatar user={message.sender} className="h-6 w-6 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium whitespace-nowrap">
                      {message.sender.name}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(message.timestamp), 'PP')}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground break-words">
                    {highlightText(message.content)}
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}