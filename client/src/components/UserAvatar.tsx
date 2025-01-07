import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface UserAvatarProps {
  user: User | null | undefined;
  className?: string;
  interactive?: boolean;
}

export function UserAvatar({
  user,
  className,
  interactive = false
}: UserAvatarProps) {
  const [, setLocation] = useLocation();

  // Handle cases where user object is null or undefined
  if (!user) {
    return (
      <Avatar className={cn("", className)}>
        <AvatarFallback>?</AvatarFallback>
      </Avatar>
    );
  }

  // Get initials from name, or use first character of displayName/email as fallback
  const getInitials = () => {
    if (user.displayName) {
      return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (user.username) {
      return user.username[0].toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <Avatar 
      className={cn("", className, interactive && "cursor-pointer hover:opacity-80")}
      onClick={() => interactive && user.id && setLocation(`/profile/${user.id}`)}
    >
      <AvatarImage
        src={user.avatarUrl || undefined}
        alt={user.displayName || user.username || 'User avatar'}
      />
      <AvatarFallback>
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}