"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    async function processOAuthRegistration() {
      if (status === "loading") return;
      
      if (status === "unauthenticated") {
        router.push("/login");
        return;
      }

      if (status === "authenticated" && session?.user) {
        try {
          // Check if we have stored OAuth registration preferences
          const storedPrefs = localStorage.getItem("oauth_registration_prefs");
          
          if (storedPrefs) {
            const prefs = JSON.parse(storedPrefs);
            
            // Update user profile with stored preferences
            const response = await fetch("/api/auth/oauth-complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: prefs.username,
                userType: prefs.userType,
              }),
            });

            if (response.ok) {
              // Clear stored preferences
              localStorage.removeItem("oauth_registration_prefs");
            }
          }
        } catch (error) {
          console.error("Error processing OAuth registration:", error);
        } finally {
          // Redirect to world page
          router.push("/world");
        }
      }
    }

    processOAuthRegistration();
  }, [status, session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-terminal-green" />
        <p className="text-muted-foreground">Completing registration...</p>
      </div>
    </div>
  );
}
