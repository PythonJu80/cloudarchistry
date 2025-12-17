"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Cloud,
  Settings,
  Boxes,
  Activity,
  Brain,
  CreditCard,
  Users,
  HelpCircle,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onConfigClick?: () => void; // Deprecated - config now in Settings page
}

// Main services only - each service has its own internal navigation
const services = [
  { 
    title: "CloudMigrate", 
    href: "/migrate", 
    icon: Cloud, 
    color: "#4ade80", // green
    bgColor: "rgba(74, 222, 128, 0.15)",
  },
  { 
    title: "CloudFlow", 
    href: "/cloudflow", 
    icon: GitBranch, 
    color: "#f59e0b", // amber - the star of the show
    bgColor: "rgba(245, 158, 11, 0.15)",
  },
  { 
    title: "CloudArch", 
    href: "/architecture", 
    icon: Boxes, 
    color: "#a78bfa", // purple
    bgColor: "rgba(167, 139, 250, 0.15)",
  },
  { 
    title: "CloudWatch", 
    href: "/monitoring", 
    icon: Activity, 
    color: "#fb923c", // orange
    bgColor: "rgba(251, 146, 60, 0.15)",
  },
  { 
    title: "CloudGPT", 
    href: "/chat", 
    icon: Brain, 
    color: "#22d3ee", // cyan
    bgColor: "rgba(34, 211, 238, 0.15)",
  },
];

// Fixed settings at bottom
const settingsItems = [
  { title: "Team", href: "/settings/team", icon: Users },
  { title: "Billing", href: "/billing", icon: CreditCard },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Help", href: "/help", icon: HelpCircle },
];

export function Sidebar({ onConfigClick }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-52 bg-card/95 backdrop-blur-sm flex flex-col border-r border-border/50 z-40">
      {/* Logo Header - CloudFabric branding */}
      <div className="p-4 border-b border-border/50">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/branding/cloudfabric-icon.svg"
            alt="CloudFabric"
            width={48}
            height={48}
            className="shrink-0"
          />
          <span className="text-base font-bold text-terminal-cyan font-mono">
            CloudFabric
          </span>
        </Link>
      </div>

      {/* Services List */}
      <nav className="flex-1 p-2 overflow-y-auto">
        <div className="space-y-1">
          {services.map((service) => {
            const isActive = pathname === service.href || pathname.startsWith(service.href + "/");
            const Icon = service.icon;

            return (
              <Link
                key={service.title}
                href={service.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                  isActive
                    ? "bg-accent"
                    : "hover:bg-accent/50"
                )}
              >
                <div 
                  className="p-1.5 rounded-md"
                  style={{ backgroundColor: service.bgColor }}
                >
                  <Icon 
                    className="w-4 h-4" 
                    style={{ color: service.color }}
                  />
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {service.title}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Fixed Settings Section */}
      <div className="p-2 border-t border-border/50">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.title}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
