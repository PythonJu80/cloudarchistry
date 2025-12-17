import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "icon" | "horizontal";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { icon: 32, horizontal: { width: 140, height: 36 } },
  md: { icon: 40, horizontal: { width: 180, height: 45 } },
  lg: { icon: 56, horizontal: { width: 220, height: 52 } },
};

export function Logo({ variant = "icon", size = "md", className }: LogoProps) {
  const sizeConfig = sizes[size];

  if (variant === "icon") {
    return (
      <Image
        src="/branding/cloudfabric-icon.svg"
        alt="CloudFabric"
        width={sizeConfig.icon}
        height={sizeConfig.icon}
        className={cn("shrink-0", className)}
        priority
      />
    );
  }

  return (
    <Image
      src="/branding/cloudfabric-logo-horizontal.svg"
      alt="CloudFabric"
      width={sizeConfig.horizontal.width}
      height={sizeConfig.horizontal.height}
      className={cn("shrink-0", className)}
      priority
    />
  );
}

// Fallback component using CSS until SVG is ready
export function LogoFallback({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="w-8 h-8 rounded-lg bg-terminal-cyan/10 flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5 text-terminal-cyan"
        >
          {/* Cloud outline */}
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          {/* Nodes */}
          <circle cx="10" cy="14" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="14" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
          {/* Connections */}
          <line x1="10" y1="14" x2="14" y2="12" />
          <line x1="14" y1="12" x2="12" y2="16" />
          <line x1="12" y1="16" x2="10" y2="14" />
        </svg>
      </div>
      <span className="font-semibold text-foreground">CloudFabric</span>
    </div>
  );
}
