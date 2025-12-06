"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Globe, Settings, LogOut, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  showNav?: boolean;
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

export function Navbar({ showNav = true, children }: NavbarProps) {
  const { data: session } = useSession();
  const avatar = useAvatar();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
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
          <span className="text-xl font-bold">CloudAcademy</span>
        </Link>
        
        {showNav && (
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/world"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              World Map
            </Link>
            <Link
              href="/challenges"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Challenges
            </Link>
            <Link
              href="/game"
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Gamepad2 className="w-4 h-4" />
              Game Mode
            </Link>
            <Link
              href="/leaderboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Leaderboard
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3">
          {children}
          {session && (
            <>
              <Link href="/dashboard/settings">
                <Button variant="ghost" size="icon">
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </>
          )}
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
