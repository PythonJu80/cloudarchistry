"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Globe, Swords, Brain } from "lucide-react";
import { UserNav } from "@/components/user-nav";

interface NavbarProps {
  showNav?: boolean;
  activePath?: string;
  variant?: "default" | "transparent";
  children?: React.ReactNode;
}

// Use useSyncExternalStore for localStorage - the recommended React 18 pattern
function subscribeToAvatar(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getAvatarSnapshot() {
  return localStorage.getItem("academy-avatar");
}

function getAvatarServerSnapshot() {
  return null; // No localStorage on server
}

function useAvatar() {
  return useSyncExternalStore(
    subscribeToAvatar,
    getAvatarSnapshot,
    getAvatarServerSnapshot
  );
}

export function Navbar({ showNav = true, activePath, variant = "default", children }: NavbarProps) {
  const { data: session } = useSession();
  const avatar = useAvatar();

  const isTransparent = variant === "transparent";
  const navClass = isTransparent
    ? "absolute top-0 left-0 right-0 z-50 px-6 py-4"
    : "fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl";

  const linkClass = (path: string) => {
    const isActive = activePath === path;
    if (isTransparent) {
      return isActive
        ? "text-cyan-400 text-sm font-medium"
        : "text-white/70 hover:text-cyan-400 transition-colors text-sm font-medium";
    }
    return isActive
      ? "text-foreground font-medium"
      : "text-muted-foreground hover:text-foreground transition-colors";
  };

  const specialLinkClass = (color: "amber" | "red") => {
    if (isTransparent) {
      return color === "amber"
        ? "text-amber-400 hover:text-amber-300 transition-colors text-sm font-medium flex items-center gap-1"
        : "text-red-400 hover:text-red-300 transition-colors text-sm font-medium flex items-center gap-1";
    }
    return color === "amber"
      ? "text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 font-medium"
      : "text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5 font-medium";
  };

  return (
    <nav className={navClass}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt="Profile"
              className="w-10 h-10 rounded-xl object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
          )}
          <span className={`text-xl font-bold ${isTransparent ? "text-white" : ""}`}>CloudAcademy</span>
        </Link>
        
        {showNav && (
          <div className="hidden md:flex items-center gap-6">
            <Link href="/world" className={linkClass("/world")}>
              World Map
            </Link>
            <Link href="/challenges" className={linkClass("/challenges")}>
              Challenges
            </Link>
            <Link href="/learn" className={specialLinkClass("amber")}>
              <Brain className="w-4 h-4" />
              Learning Centre
            </Link>
            <Link href="/game" className={specialLinkClass("red")}>
              <Swords className="w-4 h-4" />
              Game Zone
            </Link>
            <Link href="/leaderboard" className={linkClass("/leaderboard")}>
              Leaderboard
            </Link>
            <Link href="/pricing" className={linkClass("/pricing")}>
              Pricing
            </Link>
          </div>
        )}

        <div className="flex items-center gap-4">
          {children}
          <div className="h-6 w-px bg-border/50 hidden md:block" />
          <UserNav user={session?.user ? { username: session.user.username, subscriptionTier: session.user.subscriptionTier } : null} />
        </div>
      </div>
    </nav>
  );
}

export function NavbarAvatar() {
  const avatar = useAvatar();

  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt="Profile"
        className="w-10 h-10 rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
      <Globe className="w-6 h-6 text-white" />
    </div>
  );
}
