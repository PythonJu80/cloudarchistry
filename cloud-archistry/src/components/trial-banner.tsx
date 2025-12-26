"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TrialBannerProps {
  className?: string;
}

export function TrialBanner({ className }: TrialBannerProps) {
  const [trialInfo, setTrialInfo] = useState<{
    trialDaysRemaining: number;
    trialExpired: boolean;
    subscriptionTier: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrialStatus() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setTrialInfo({
            trialDaysRemaining: data.trialDaysRemaining || 0,
            trialExpired: data.trialExpired || false,
            subscriptionTier: data.subscriptionTier || "free",
          });
        }
      } catch (err) {
        console.error("Failed to fetch trial status:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTrialStatus();
  }, []);

  // Don't show if loading, dismissed, or no trial info
  if (loading || dismissed || !trialInfo) {
    return null;
  }

  // Don't show for free tier (they haven't started a trial)
  if (trialInfo.subscriptionTier === "free") {
    return null;
  }

  // Don't show if trial has more than 7 days remaining (only show when getting close)
  if (trialInfo.trialDaysRemaining > 7 && !trialInfo.trialExpired) {
    return null;
  }

  // Determine urgency
  const isExpired = trialInfo.trialExpired;
  const isCritical = trialInfo.trialDaysRemaining <= 2;
  const isWarning = trialInfo.trialDaysRemaining <= 5;

  const bgColor = isExpired
    ? "bg-red-500/10 border-red-500/30"
    : isCritical
    ? "bg-orange-500/10 border-orange-500/30"
    : isWarning
    ? "bg-amber-500/10 border-amber-500/30"
    : "bg-cyan-500/10 border-cyan-500/30";

  const textColor = isExpired
    ? "text-red-400"
    : isCritical
    ? "text-orange-400"
    : isWarning
    ? "text-amber-400"
    : "text-cyan-400";

  const message = isExpired
    ? "Your trial has expired"
    : trialInfo.trialDaysRemaining === 1
    ? "1 day left in your trial"
    : `${trialInfo.trialDaysRemaining} days left in your trial`;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 border-b",
        bgColor,
        className
      )}
    >
      <div className="flex items-center gap-2">
        {isExpired ? (
          <Clock className={cn("w-4 h-4", textColor)} />
        ) : (
          <Sparkles className={cn("w-4 h-4", textColor)} />
        )}
        <span className={cn("text-sm font-medium", textColor)}>{message}</span>
        {!isExpired && (
          <span className="text-sm text-muted-foreground">
            — Upgrade to keep your progress
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Link href="/pricing">
          <Button
            size="sm"
            variant={isExpired ? "default" : "outline"}
            className={cn(
              "text-xs h-7",
              !isExpired && "border-current",
              textColor
            )}
          >
            {isExpired ? "Upgrade Now" : "View Plans"}
          </Button>
        </Link>
        {!isExpired && (
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
