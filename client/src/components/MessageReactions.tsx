import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { type Reaction, type User } from "@/lib/types";

const COMMON_EMOJIS = ["👍", "❤️", "😂", "🎉", "🙏", "👀"];

interface MessageReactionsProps {
  reactions?: Reaction[];
  onAddReaction: (emoji: string) => void;
  currentUser: User;
}

export function MessageReactions({ 
  reactions = [], 
  onAddReaction,
  currentUser 
}: MessageReactionsProps) {
  const handleReaction = (emoji: string) => {
    onAddReaction(emoji);
  };

  return (
    <div className="flex items-center gap-1 mt-1">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant="secondary"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={() => handleReaction(reaction.emoji)}
        >
          <span>{reaction.emoji}</span>
          <span>{reaction.users.length}</span>
        </Button>
      ))}
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="flex gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
