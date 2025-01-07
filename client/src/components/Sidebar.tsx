import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Hash, MessageCircle, Plus, Circle, X } from "lucide-react";
import { mockChannels, mockDirectMessages, mockUsers, mockChannelMessages, mockDirectMessageThreads } from "@/lib/mock-data";
import { UserAvatar } from "@/components/UserAvatar";
import { useLocation, useRoute } from "wouter";
import { useWebSocket } from "@/lib/useWebSocket";
import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { StatusSelector } from "./StatusSelector";
import { SearchBar } from "./SearchBar";
import { SearchResults } from "./SearchResults";

export function Sidebar({ className }: { className?: string }) {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/channel/:id');
  const [, dmParams] = useRoute('/dm/:id');
  const currentUser = mockUsers[0];
  const [currentStatus, setCurrentStatus] = useState<'online' | 'busy' | 'offline'>('online');
  const { updatePresence, presenceUpdates, messages: websocketMessages } = useWebSocket();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Combine all messages for search - including both mock and websocket messages
  const allMessages = useMemo(() => {
    const mockMessages = [
      ...mockChannelMessages,
      ...Object.values(mockDirectMessageThreads).flat()
    ];
    return [...mockMessages, ...websocketMessages];
  }, [websocketMessages]);

  useEffect(() => {
    updatePresence('online');
    setCurrentStatus('online');

    return () => {
      updatePresence('offline');
      setCurrentStatus('offline');
    };
  }, [updatePresence]);

  const getUserStatus = (userId: string) => {
    const presence = presenceUpdates.get(userId);
    return presence?.status || 'offline';
  };

  const handleStatusChange = (status: 'online' | 'busy' | 'offline') => {
    setCurrentStatus(status);
    updatePresence(status);
  };

  const handleSearchSelect = (type: 'message' | 'channel' | 'dm', id: string) => {
    const route = type === 'channel' ? `/channel/${id}` : `/dm/${id}`;
    navigate(route);
    setSearchQuery("");
    setIsSearching(false);
  };

  return (
    <div className={cn("flex flex-col bg-[#1a1f36] text-white", className)}>
      <div className="p-4">
        <h2 className="text-3xl font-extrabold mb-4 bg-gradient-to-b from-blue-300 to-blue-500 bg-clip-text text-transparent">Chat Genius</h2>
        <div className="relative">
          <SearchBar
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setIsSearching(true);
            }}
            placeholder="Search messages, channels..."
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 hover:bg-white/10"
              onClick={() => {
                setSearchQuery("");
                setIsSearching(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Separator className="bg-white/10" />

      {isSearching && searchQuery ? (
        <SearchResults
          query={searchQuery}
          messages={allMessages}
          channels={mockChannels}
          directMessages={mockDirectMessages}
          onSelect={handleSearchSelect}
        />
      ) : (
        <ScrollArea className="flex-1 px-2">
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-white/70">Channels</h3>
              <Button variant="ghost" size="icon" className="hover:bg-white/10">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {mockChannels.map((channel) => {
              const isActive = params?.id === channel.id;
              return (
                <Button
                  key={channel.id}
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start mb-1",
                    isActive ? "bg-white/20 hover:bg-white/25" : "hover:bg-white/10",
                    "text-white/80 hover:text-white"
                  )}
                  onClick={() => navigate(`/channel/${channel.id}`)}
                >
                  <Hash className="h-4 w-4 mr-2 opacity-70" />
                  {channel.name}
                </Button>
              );
            })}

            <div className="flex items-center justify-between mb-2 mt-6">
              <h3 className="text-sm font-medium text-white/70">Direct Messages</h3>
              <Button variant="ghost" size="icon" className="hover:bg-white/10">
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>

            {mockDirectMessages.map((dm) => {
              const isActive = dmParams?.id === dm.id;
              const status = getUserStatus(dm.user.id);
              return (
                <Button
                  key={dm.id}
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start mb-1 relative",
                    isActive ? "bg-white/20 hover:bg-white/25" : "hover:bg-white/10",
                    "text-white/80 hover:text-white"
                  )}
                  onClick={() => navigate(`/dm/${dm.id}`)}
                >
                  <UserAvatar
                    user={dm.user}
                    className="h-6 w-6 mr-2"
                  />
                  <span className="flex-1">{dm.user.name}</span>
                  <Badge
                    variant={
                      status === 'online' ? 'success' :
                        status === 'busy' ? 'destructive' :
                          'outline'
                    }
                    className={cn(
                      "px-2 py-0 h-5 flex items-center gap-1 bg-white/10"
                    )}
                  >
                    <Circle className={cn(
                      "h-3 w-3 fill-current",
                      status === 'online' && "text-green-500",
                      status === 'busy' && "text-red-500",
                      status === 'offline' && "text-gray-500 opacity-50"
                    )} />
                    <span className="text-xs text-white">{status}</span>
                  </Badge>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <Separator className="bg-white/10" />
      <div className="p-4 bg-[#151930]">
        <div className="flex items-center gap-2">
          <UserAvatar
            user={currentUser}
            className="h-8 w-8"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white/90">
              {currentUser.name}
            </span>
            <StatusSelector
              currentStatus={currentStatus}
              onStatusChange={handleStatusChange}
              className="bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}