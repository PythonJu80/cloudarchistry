"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

const TerminalProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    showPercentage?: boolean;
    color?: "green" | "cyan" | "amber" | "blue";
  }
>(({ className, value, showPercentage = true, color = "cyan", ...props }, ref) => {
  const colorClasses = {
    green: "bg-terminal-green",
    cyan: "bg-terminal-cyan",
    amber: "bg-terminal-amber",
    blue: "bg-terminal-blue",
  };
  const textClasses = {
    green: "text-terminal-green",
    cyan: "text-terminal-cyan",
    amber: "text-terminal-amber",
    blue: "text-terminal-blue",
  };

  return (
    <div className="flex items-center gap-3">
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative h-2 flex-1 overflow-hidden rounded-full bg-accent border border-border",
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn("h-full w-full flex-1 transition-all duration-300", colorClasses[color])}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </ProgressPrimitive.Root>
      {showPercentage && (
        <span className={cn("text-xs font-mono min-w-[3rem] text-right", textClasses[color])}>
          {value || 0}%
        </span>
      )}
    </div>
  );
});
TerminalProgress.displayName = "TerminalProgress";

export { Progress, TerminalProgress };
