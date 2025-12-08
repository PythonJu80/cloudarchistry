"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  FileText,
  Layers,
  Headphones,
  BookOpen,
  ListTodo,
  GraduationCap,
  Trophy,
} from "lucide-react";
import { Navbar } from "@/components/navbar";

interface LearnLayoutProps {
  children: React.ReactNode;
}

const tabs = [
  { href: "/learn", label: "Guide", icon: BookOpen, exact: true },
  { href: "/learn/sources", label: "Sources", icon: Layers },
  { href: "/learn/chat", label: "Chat", icon: MessageSquare },
  { href: "/learn/flashcards", label: "Flashcards", icon: GraduationCap },
  { href: "/learn/exams", label: "Practice Exams", icon: Trophy },
  { href: "/learn/quiz", label: "Quizzes", icon: ListTodo },
  { href: "/learn/notes", label: "Notes", icon: FileText },
  { href: "/learn/studio", label: "Studio", icon: Headphones },
];

export default function LearnLayout({ children }: LearnLayoutProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Main App Navbar */}
      <Navbar activePath="/learn" />

      {/* Learning Centre Sub-navigation */}
      <div className="fixed top-16 left-0 right-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = isActive(tab.href, tab.exact);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page Content - account for both navbars */}
      <main className="pt-28 max-w-7xl mx-auto px-6">{children}</main>
    </div>
  );
}
