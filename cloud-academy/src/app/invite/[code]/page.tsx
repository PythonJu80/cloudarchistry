"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Cloud, Loader2, Users, CheckCircle, XCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface InviteData {
  id: string;
  email: string | null;
  role: string;
  expiresAt: string;
  team: {
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    memberCount: number;
  };
}

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const { data: session, status } = useSession();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`/api/team/invite/${code}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Invalid invite");
          return;
        }

        setInvite(data.invite);
      } catch {
        setError("Failed to load invite");
      } finally {
        setLoading(false);
      }
    }

    if (code) {
      fetchInvite();
    }
  }, [code]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/team/invite/${code}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invite");
        return;
      }

      setSuccess(true);
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/dashboard/settings");
      }, 2000);
    } catch {
      setError("Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invite...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-terminal-green/10 rounded-xl mb-4">
            <Cloud className="w-10 h-10 text-terminal-green" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-mono">CloudAcademy</h1>
        </div>

        <Card className="bg-card border-border">
          {error && !invite ? (
            // Error state - invalid/expired invite
            <CardContent className="pt-8 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Invalid Invite</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            </CardContent>
          ) : success ? (
            // Success state
            <CardContent className="pt-8 text-center">
              <div className="w-16 h-16 bg-terminal-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-terminal-green" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to the team!</h2>
              <p className="text-muted-foreground mb-6">
                You&apos;ve joined <strong>{invite?.team.name}</strong>. Redirecting to settings...
              </p>
            </CardContent>
          ) : invite ? (
            // Invite preview
            <>
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Team Invite</CardTitle>
                <CardDescription>
                  You&apos;ve been invited to join a team
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Team Info */}
                <div className="p-4 rounded-lg bg-background border border-border">
                  <h3 className="font-semibold text-lg text-foreground">{invite.team.name}</h3>
                  {invite.team.description && (
                    <p className="text-sm text-muted-foreground mt-1">{invite.team.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {invite.team.memberCount} member{invite.team.memberCount !== 1 ? "s" : ""}
                    </span>
                    <span className="capitalize">Role: {invite.role}</span>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                    {error}
                  </div>
                )}

                {/* Actions */}
                {status === "authenticated" ? (
                  <Button
                    className="w-full bg-terminal-green hover:bg-terminal-green/90 text-black font-semibold"
                    onClick={handleAccept}
                    disabled={accepting}
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Accept Invite
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-center text-muted-foreground">
                      Sign in to accept this invite
                    </p>
                    <Link href={`/login?callbackUrl=/invite/${code}`}>
                      <Button className="w-full" variant="outline">
                        <LogIn className="w-4 h-4 mr-2" />
                        Sign in to continue
                      </Button>
                    </Link>
                    <Link href={`/register?callbackUrl=/invite/${code}`}>
                      <Button className="w-full bg-terminal-green hover:bg-terminal-green/90 text-black font-semibold">
                        Create an account
                      </Button>
                    </Link>
                  </div>
                )}

                <p className="text-xs text-center text-muted-foreground">
                  This invite expires on {new Date(invite.expiresAt).toLocaleDateString()}
                </p>
              </CardContent>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
