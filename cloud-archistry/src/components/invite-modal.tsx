"use client";

import { useState } from "react";
import { UserPlus, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface InviteModalProps {
  variant?: "default" | "transparent";
}

export function InviteModal({ variant = "default" }: InviteModalProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const isTransparent = variant === "transparent";

  const handleSendInvite = async () => {
    const emailToSend = email.trim().toLowerCase();
    if (!emailToSend) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToSend)) {
      toast({ title: "Error", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSend }),
      });
      const data = await response.json();

      if (response.status === 429) {
        const resetInMinutes = data.resetAt
          ? Math.ceil((data.resetAt - Date.now()) / 60000)
          : 60;
        toast({
          title: "Rate Limit Exceeded",
          description: `You can send more invites in ${resetInMinutes} minute${resetInMinutes !== 1 ? "s" : ""}. (Limit: 10 per hour)`,
          variant: "destructive",
        });
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invite");
      }

      toast({ title: "Invite Sent!", description: `${emailToSend} will receive an invite to join CloudArchistry` });
      setEmail("");
      setOpen(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send invite",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={
            isTransparent
              ? "text-white/70 hover:text-cyan-400 hover:bg-white/10 transition-colors text-sm font-medium flex items-center gap-1.5"
              : "text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          }
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden lg:inline">Invite</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-500" />
            Invite to CloudArchistry
          </DialogTitle>
          <DialogDescription>
            Send an invite to a friend or colleague. They&apos;ll receive an email with a link to get started.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="invite-email" className="text-sm font-medium">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !sending) {
                  handleSendInvite();
                }
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
              disabled={sending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSendInvite}
            disabled={sending || !email.trim()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Invite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
