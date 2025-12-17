"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cloud, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const verifyAttempted = useRef(false);

  useEffect(() => {
    // Prevent double-call from React Strict Mode using ref
    if (verifyAttempted.current) return;
    verifyAttempted.current = true;
    
    if (!token) {
      setStatus("error");
      setError("Missing verification token");
      return;
    }
    
    // Verify the token
    fetch(`/api/auth/verify-email/confirm?token=${token}`)
      .then((res) => res.json())
      .then(async (data) => {
        if (data.success) {
          setEmail(data.email);
          setStatus("success");
          
          // Auto redirect to login after 2 seconds
          setTimeout(() => {
            router.push("/login?verified=true");
          }, 2000);
        } else {
          setStatus("error");
          setError(data.error || "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Verification failed. Please try again.");
      });
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-terminal-green/10 rounded-xl mb-4">
            <Cloud className="w-10 h-10 text-terminal-green" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-mono">Cloud Archistry</h1>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 text-center">
          {status === "verifying" && (
            <>
              <Loader2 className="w-12 h-12 text-terminal-green animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Verifying your email...</h2>
              <p className="text-muted-foreground">Please wait a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 bg-terminal-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-terminal-green" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Email verified!</h2>
              <p className="text-muted-foreground mb-6">
                Your email has been verified successfully.<br />
                Redirecting you to sign in...
              </p>
              <Link href="/login?verified=true">
                <Button className="bg-terminal-green hover:bg-terminal-green/90 text-black font-semibold">
                  Sign in now
                </Button>
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Verification failed</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <div className="space-y-3">
                <Link href="/register">
                  <Button variant="outline" className="w-full">
                    Try registering again
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" className="w-full text-muted-foreground">
                    Back to sign in
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-terminal-green" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
