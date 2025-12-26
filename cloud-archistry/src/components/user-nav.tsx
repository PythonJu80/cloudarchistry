"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserNavProps {
  user: {
    username?: string;
    subscriptionTier?: string;
  } | null;
}

export function UserNav({ user }: UserNavProps) {
  if (!user) {
    return (
      <>
        <Link href="/login">
          <Button variant="ghost" size="sm">Sign In</Button>
        </Link>
        <Link href="/register">
          <Button variant="glow" size="sm">Start Free</Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">@{user.username}</span>
        <Badge variant="outline" className="text-xs capitalize">
          {user.subscriptionTier || "free"}
        </Badge>
      </div>
      <Link href="/dashboard">
        <Button variant="glow" size="sm">Dashboard</Button>
      </Link>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Settings</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign Out
      </Button>
    </>
  );
}
