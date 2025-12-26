"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ChallengeNotificationProvider } from "@/components/notifications/challenge-notification";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <ChallengeNotificationProvider>
          {children}
        </ChallengeNotificationProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
