import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { useUser } from "@/hooks/use-user";
import { format } from "date-fns";
import { PencilLine, Check, X, Camera } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { user } = useUser();
  const [note, setNote] = useState(user?.note || "");
  const [aboutMe, setAboutMe] = useState(user?.aboutMe || "");
  const [isEditingAboutMe, setIsEditingAboutMe] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [tempAboutMe, setTempAboutMe] = useState(aboutMe);
  const [tempNote, setTempNote] = useState(note);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    // Update local state when user data changes
    if (user) {
      setNote(user.note || "");
      setAboutMe(user.aboutMe || "");
      setTempNote(user.note || "");
      setTempAboutMe(user.aboutMe || "");
    }
  }, [user]);

  if (!user) return null;

  // Format the membership date - we'll use a placeholder for demo
  const memberSince = format(new Date(user.createdAt), "MMMM d, yyyy");

  const handleSaveAboutMe = async () => {
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ aboutMe: tempAboutMe }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await queryClient.invalidateQueries({ queryKey: ['user'] });
      setAboutMe(tempAboutMe);
      setIsEditingAboutMe(false);
      toast({
        title: "Success",
        description: "About Me updated successfully",
      });
    } catch (error) {
      console.error('Failed to update About Me:', error);
      toast({
        title: "Error",
        description: "Failed to update About Me",
        variant: "destructive",
      });
    }
  };

  const handleSaveNote = async () => {
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: tempNote }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await queryClient.invalidateQueries({ queryKey: ['user'] });
      setNote(tempNote);
      setIsEditingNote(false);
      toast({
        title: "Success",
        description: "Note updated successfully",
      });
    } catch (error) {
      console.error('Failed to update Note:', error);
      toast({
        title: "Error",
        description: "Failed to update Note",
        variant: "destructive",
      });
    }
  };

  const handleCancelAboutMe = () => {
    setTempAboutMe(aboutMe);
    setIsEditingAboutMe(false);
  };

  const handleCancelNote = () => {
    setTempNote(note);
    setIsEditingNote(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch('/api/users/me/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // Refetch user data to update avatar
      await queryClient.invalidateQueries({ queryKey: ['user'] });
    } catch (error) {
      console.error('Failed to upload avatar:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with banner */}
      <div className="relative h-64 bg-muted" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="-mt-32">
          <div className="flex flex-col items-center">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />

            {/* Avatar with upload button overlay */}
            <div className="relative group">
              <UserAvatar
                user={user}
                className="h-40 w-40 border-4 border-background ring-4 ring-muted"
              />
              <Button
                variant="outline"
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background"
                onClick={handleAvatarClick}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>

            {/* Username */}
            <h1 className="mt-4 text-2xl font-bold">
              {user.username}
            </h1>

            {/* Card sections */}
            <div className="mt-6 w-full max-w-3xl space-y-6">
              {/* Member Since */}
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold mb-2">Member Since</h2>
                <p className="text-muted-foreground">{memberSince}</p>
              </div>

              {/* About Me */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-semibold">About Me</h2>
                  {isEditingAboutMe ? (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveAboutMe}
                        className="h-8 px-2"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelAboutMe}
                        className="h-8 px-2"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingAboutMe(true)}
                      className="h-8 px-2"
                    >
                      <PencilLine className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                {isEditingAboutMe ? (
                  <textarea
                    value={tempAboutMe}
                    onChange={(e) => setTempAboutMe(e.target.value)}
                    className="w-full p-2 rounded-md border bg-background text-sm"
                    rows={4}
                    placeholder="Tell us about yourself..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    {aboutMe || <p className="text-muted-foreground">Click edit to add about me</p>}
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-semibold">Note</h2>
                  {isEditingNote ? (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveNote}
                        className="h-8 px-2"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelNote}
                        className="h-8 px-2"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingNote(true)}
                      className="h-8 px-2"
                    >
                      <PencilLine className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                {isEditingNote ? (
                  <textarea
                    value={tempNote}
                    onChange={(e) => setTempNote(e.target.value)}
                    className="w-full p-2 rounded-md border bg-background text-sm"
                    rows={4}
                    placeholder="Add a note..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    {note || <p className="text-muted-foreground">Click edit to add a note</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}