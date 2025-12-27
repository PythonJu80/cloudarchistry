"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Swords, Brain, Users, Globe, CreditCard } from "lucide-react";
import { UserNav } from "@/components/user-nav";
import { InviteModal } from "@/components/invite-modal";

interface NavbarProps {
  showNav?: boolean;
  activePath?: string;
  variant?: "default" | "transparent";
  children?: React.ReactNode;
}

export function Navbar({ showNav = true, activePath, variant = "default", children }: NavbarProps) {
  const { data: session } = useSession();
  const [userTeam, setUserTeam] = useState<{ id: string; name: string } | null>(null);

  // Fetch user's team membership
  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/team")
        .then((res) => res.json())
        .then((data) => {
          if (data.teams && data.teams.length > 0) {
            // Use the first team the user is a member of
            setUserTeam({ id: data.teams[0].id, name: data.teams[0].name });
          }
        })
        .catch(() => {});
    }
  }, [session?.user?.email]);

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
      <div className="w-full px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
            <Image
              src="/logo.png"
              alt="Cloud Archistry"
              fill
              sizes="56px"
              className="object-cover scale-125"
            />
          </div>
          <span className={`text-xl font-bold ${isTransparent ? "text-white" : ""}`}>Cloud Archistry</span>
        </Link>
        
        {showNav && (
          <div className="hidden md:flex items-center gap-6">
            <Link href="/world" className={`${linkClass("/world")} flex items-center gap-1.5`}>
              <Globe className="w-4 h-4" />
              World Map
            </Link>
            <Link href="/learn" className={specialLinkClass("amber")}>
              <Brain className="w-4 h-4" />
              Learning Centre
            </Link>
            <Link href="/game" className={specialLinkClass("red")}>
              <Swords className="w-4 h-4" />
              Game Zone
            </Link>
            {userTeam && (
              <Link href={`/dashboard/cohort/${userTeam.id}`} className="text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1.5 font-medium">
                <Users className="w-4 h-4" />
                My Cohort
              </Link>
            )}
            <Link href="/pricing" className={`${linkClass("/pricing")} flex items-center gap-1.5`}>
              <CreditCard className="w-4 h-4" />
              Pricing
            </Link>
          </div>
        )}

        <div className="flex items-center gap-4">
          {children}
          {session?.user && (
            <InviteModal variant={variant} />
          )}
          <div className="h-6 w-px bg-border/50 hidden md:block" />
          <UserNav user={session?.user ? { username: session.user.username, subscriptionTier: session.user.subscriptionTier } : null} />
        </div>
      </div>
    </nav>
  );
}

