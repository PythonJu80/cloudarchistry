"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Globe,
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  ArrowLeft,
  Brain,
  Sparkles,
  Shield,
  AlertTriangle,
  Trash2,
  Cloud,
  RefreshCw,
  User,
  Award,
  BarChart3,
  Camera,
  Trophy,
  FileText,
  Download,
  ExternalLink,
  Users,
  UserPlus,
  Mail,
  Copy,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PortfolioViewer } from "@/components/portfolio/portfolio-viewer";

interface SettingsData {
  hasOpenAiKey: boolean;
  openaiKeyLastFour: string | null;
  openaiKeyAddedAt: string | null;
  preferredModel: string;
  subscriptionTier: string;
  hasAiAccess: boolean;
  settings: Record<string, unknown>;
}

interface AwsCredentialsData {
  hasCredentials: boolean;
  accessKeyLastFour?: string;
  region?: string;
  addedAt?: string;
  isValid?: boolean;
  availableRegions: string[];
}

interface ProfileData {
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  skillLevel: string;
  targetCertification: string | null;
  preferredDifficulty: string | null;
  preferredIndustries: string[];
  // Stats
  totalPoints: number;
  level: number;
  xp: number;
  currentStreak: number;
  longestStreak: number;
  challengesCompleted: number;
  scenariosCompleted: number;
  locationsVisited: number;
  totalTimeMinutes: number;
  lastActivityDate: string | null;
  // Options
  skillLevelOptions: string[];
  difficultyOptions: string[];
  certificationOptions: string[];
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
}

interface PortfolioData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  isExample: boolean;
  companyName: string | null;
  industry: string | null;
  locationName: string | null;
  awsServices: string[];
  challengeScore: number;
  maxScore: number;
  completionTimeMinutes: number;
  thumbnailUrl: string | null;
  pdfUrl: string | null;
  generatedAt: string | null;
  createdAt: string;
  // Extended fields for detail view
  businessUseCase?: string | null;
  problemStatement?: string | null;
  solutionSummary?: string | null;
  keyDecisions?: string[];
  complianceAchieved?: string[];
  // Architecture diagram (React Flow nodes/edges)
  architectureDiagram?: {
    nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: {
        serviceId: string;
        label: string;
        sublabel?: string;
        color: string;
        subnetType?: "public" | "private";
      };
      parentId?: string;
      width?: number;
      height?: number;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
      type?: string;
      animated?: boolean;
    }>;
  } | null;
}

// No fallback - models must come from OpenAI API

interface TeamMember {
  id: string;
  role: string;
  academyUser: {
    id: string;
    name: string | null;
    email: string;
    username: string | null;
  } | null;
}

interface TeamInvite {
  id: string;
  email: string | null;
  code: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

interface TeamData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  myRole: string;
  memberCount: number;
  maxMembers: number;
  members: TeamMember[];
  invites: TeamInvite[];
}

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // API Key form state
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4.1");
  
  // Dynamic models state - no fallback, must fetch from OpenAI
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);

  // AWS Credentials state
  const [awsCredentials, setAwsCredentials] = useState<AwsCredentialsData | null>(null);
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [showAwsSecret, setShowAwsSecret] = useState(false);
  const [awsSaving, setAwsSaving] = useState(false);
  const [awsVerifying, setAwsVerifying] = useState(false);
  const [awsDeleting, setAwsDeleting] = useState(false);

  // Profile state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileSkillLevel, setProfileSkillLevel] = useState("intermediate");
  const [profileCertification, setProfileCertification] = useState("");
  const [profileDifficulty, setProfileDifficulty] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Portfolio state
  const [portfolios, setPortfolios] = useState<PortfolioData[]>([]);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioData | null>(null);
  const [portfolioViewerOpen, setPortfolioViewerOpen] = useState(false);

  // Team state
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      fetchSettings();
      fetchAwsCredentials();
      fetchProfile();
      fetchPortfolios();
      fetchTeams();
    }
  }, [status, router]);

  async function fetchSettings() {
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      const data = await response.json();
      setSettings(data);
      setSelectedModel(data.preferredModel || "gpt-4.1");
      
      // If user has an API key, fetch available models
      if (data.hasOpenAiKey) {
        fetchModels();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }
  
  async function fetchModels() {
    setModelsLoading(true);
    try {
      const response = await fetch("/api/models");
      if (response.ok) {
        const data = await response.json();
        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models);
          setKeyValid(true);
        }
      } else if (response.status === 401) {
        // Invalid API key
        setKeyValid(false);
        setError("Your API key appears to be invalid. Please update it.");
      }
    } catch (err) {
      console.error("Failed to fetch models:", err);
      // Keep fallback models
    } finally {
      setModelsLoading(false);
    }
  }

  async function fetchAwsCredentials() {
    try {
      const response = await fetch("/api/settings/aws");
      if (response.ok) {
        const data = await response.json();
        setAwsCredentials(data);
        if (data.region) {
          setAwsRegion(data.region);
        }
      }
    } catch (err) {
      console.error("Failed to fetch AWS credentials:", err);
    }
  }

  async function handleSaveAwsCredentials() {
    if (!awsAccessKeyId.trim() || !awsSecretAccessKey.trim()) {
      setError("Please enter both Access Key ID and Secret Access Key");
      return;
    }

    setAwsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings/aws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
          region: awsRegion,
          verify: true, // Verify credentials before saving
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save AWS credentials");
      }

      setAwsCredentials(data);
      setAwsAccessKeyId("");
      setAwsSecretAccessKey("");
      setSuccess("AWS credentials saved and verified successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save AWS credentials");
    } finally {
      setAwsSaving(false);
    }
  }

  async function handleVerifyAwsCredentials() {
    setAwsVerifying(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings/aws", {
        method: "PATCH",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Credentials verification failed");
      }

      // Refresh credentials info
      await fetchAwsCredentials();
      setSuccess(`AWS credentials verified! Account: ${data.accountId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify AWS credentials");
      // Refresh to get updated validity status
      await fetchAwsCredentials();
    } finally {
      setAwsVerifying(false);
    }
  }

  async function handleDeleteAwsCredentials() {
    if (!confirm("Are you sure you want to remove your AWS credentials? Diagram deployment will be disabled.")) {
      return;
    }

    setAwsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings/aws", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove AWS credentials");
      }

      await fetchAwsCredentials();
      setSuccess("AWS credentials removed successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove AWS credentials");
    } finally {
      setAwsDeleting(false);
    }
  }

  async function fetchProfile() {
    try {
      const response = await fetch("/api/settings/profile");
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setProfileDisplayName(data.displayName || "");
        setProfileBio(data.bio || "");
        setProfileSkillLevel(data.skillLevel || "intermediate");
        setProfileCertification(data.targetCertification || "none");
        setProfileDifficulty(data.preferredDifficulty || "none");
        
        // Load avatar from localStorage or use the one from profile
        const localAvatar = localStorage.getItem("academy-avatar");
        if (localAvatar) {
          setProfileAvatar(localAvatar);
        } else if (data.avatarUrl) {
          setProfileAvatar(data.avatarUrl);
        }
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  }

  async function fetchPortfolios() {
    setPortfoliosLoading(true);
    try {
      const response = await fetch("/api/portfolio");
      if (response.ok) {
        const data = await response.json();
        setPortfolios(data.portfolios || []);
      }
    } catch (err) {
      console.error("Failed to fetch portfolios:", err);
    } finally {
      setPortfoliosLoading(false);
    }
  }

  async function fetchTeams() {
    setTeamsLoading(true);
    try {
      const response = await fetch("/api/team");
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    } finally {
      setTeamsLoading(false);
    }
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) {
      setError("Team name is required");
      return;
    }
    setCreatingTeam(true);
    setError(null);
    try {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeamName,
          description: newTeamDescription,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create team");
      }
      setSuccess("Team created successfully!");
      setShowCreateTeam(false);
      setNewTeamName("");
      setNewTeamDescription("");
      fetchTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreatingTeam(false);
    }
  }

  async function handleSendInvite(teamId: string) {
    const emailToSend = inviteEmail.trim().toLowerCase();
    if (!emailToSend) {
      setError("Email is required");
      return;
    }
    setSendingInvite(true);
    setError(null);
    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          email: emailToSend,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send invite");
      }
      setSuccess(`Invite sent to ${inviteEmail}!`);
      setInviteEmail("");
      fetchTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      const response = await fetch(`/api/team/invite?id=${inviteId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke invite");
      }
      setSuccess("Invite revoked");
      fetchTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invite");
    }
  }

  function copyInviteLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedInvite(code);
    setTimeout(() => setCopiedInvite(null), 2000);
  }

  function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB");
      return;
    }

    setAvatarUploading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      
      // Create an image to resize it
      const img = new Image();
      img.onload = () => {
        // Resize to max 200x200 for storage efficiency
        const canvas = document.createElement("canvas");
        const maxSize = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const resizedBase64 = canvas.toDataURL("image/jpeg", 0.8);
        
        // Save to localStorage
        localStorage.setItem("academy-avatar", resizedBase64);
        setProfileAvatar(resizedBase64);
        setAvatarUploading(false);
        setSuccess("Avatar updated! Click Save Profile to persist.");
      };
      img.src = base64;
    };
    reader.onerror = () => {
      setError("Failed to read image file");
      setAvatarUploading(false);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveAvatar() {
    localStorage.removeItem("academy-avatar");
    setProfileAvatar(profile?.avatarUrl || null);
    setSuccess("Avatar removed");
  }

  async function handleSaveProfile() {
    setProfileSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profileDisplayName || null,
          bio: profileBio || null,
          skillLevel: profileSkillLevel,
          targetCertification: profileCertification === "none" ? null : profileCertification,
          preferredDifficulty: profileDifficulty === "none" ? null : profileDifficulty,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save profile");
      }

      await fetchProfile();
      setSuccess("Profile updated successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) {
      setError("Please enter an API key");
      return;
    }

    if (!apiKey.startsWith("sk-")) {
      setError("Invalid API key format. Key should start with 'sk-'");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: apiKey,
          preferredModel: selectedModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save API key");
      }

      setSettings(data);
      setApiKey("");
      setSuccess("API key saved successfully!");
      
      // Clear model cache and fetch fresh models to validate the key
      await fetch("/api/models", { method: "DELETE" });
      fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateModel() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredModel: selectedModel }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update model");
      }

      setSettings(data);
      setSuccess("Model preference updated!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update model");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteApiKey() {
    if (!confirm("Are you sure you want to remove your API key? AI features will be disabled.")) {
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove API key");
      }

      // Refresh settings
      await fetchSettings();
      setSuccess("API key removed successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove API key");
    } finally {
      setDeleting(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {profileAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileAvatar}
                alt="Profile"
                className="w-10 h-10 rounded-xl object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
            )}
            <span className="text-xl font-bold">CloudAcademy</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content - Two Column Layout */}
      <main className="pt-20 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Alerts - Full Width */}
          {(error || success) && (
            <div className="mb-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm">
                  <X className="w-4 h-4 text-red-400" />
                  <p className="text-red-400 flex-1">{error}</p>
                  <Button variant="ghost" size="sm" onClick={() => setError(null)}>×</Button>
                </div>
              )}
              {success && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-400" />
                  <p className="text-green-400 flex-1">{success}</p>
                  <Button variant="ghost" size="sm" onClick={() => setSuccess(null)}>×</Button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Settings */}
            <div className="lg:col-span-2 space-y-4">

          {/* Profile Section */}
          <Card className="bg-card/50 border-border/50 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                Profile
              </CardTitle>
              <CardDescription>
                Manage your profile information and learning preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Editable Fields */}
              <div className="space-y-4">
                {/* Avatar Upload */}
                <div className="space-y-2">
                  <Label>Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {profileAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profileAvatar}
                          alt="Profile"
                          className="w-20 h-20 rounded-full object-cover border-2 border-border"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                          <User className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      {avatarUploading && (
                        <div className="absolute inset-0 rounded-full bg-background/80 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          disabled={avatarUploading}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          asChild
                        >
                          <span>
                            <Camera className="w-4 h-4" />
                            Upload Photo
                          </span>
                        </Button>
                      </label>
                      {profileAvatar && profileAvatar.startsWith("data:") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-red-400 hover:text-red-300"
                          onClick={handleRemoveAvatar}
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG or GIF. Max 2MB.<br />
                      Stored in your browser.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Your display name"
                    value={profileDisplayName}
                    onChange={(e) => setProfileDisplayName(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    placeholder="Tell us about yourself and your cloud journey..."
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {profileBio.length}/500
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="skillLevel" className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Skill Level
                    </Label>
                    <Select value={profileSkillLevel} onValueChange={setProfileSkillLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select skill level" />
                      </SelectTrigger>
                      <SelectContent>
                        {(profile?.skillLevelOptions || ["beginner", "intermediate", "advanced", "expert"]).map((level) => (
                          <SelectItem key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="certification" className="flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Target Certification
                    </Label>
                    <Select value={profileCertification} onValueChange={setProfileCertification}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select certification" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {(profile?.certificationOptions || ["SAA", "SAP", "DVA", "SOA", "DOP", "CLF"]).map((cert) => (
                          <SelectItem key={cert} value={cert}>
                            {cert === "SAA" ? "Solutions Architect Associate" :
                             cert === "SAP" ? "Solutions Architect Professional" :
                             cert === "DVA" ? "Developer Associate" :
                             cert === "SOA" ? "SysOps Administrator Associate" :
                             cert === "DOP" ? "DevOps Engineer Professional" :
                             cert === "CLF" ? "Cloud Practitioner" :
                             cert === "ANS" ? "Advanced Networking Specialty" :
                             cert === "SCS" ? "Security Specialty" :
                             cert === "DBS" ? "Database Specialty" :
                             cert === "MLS" ? "Machine Learning Specialty" :
                             cert === "PAS" ? "Data Analytics Specialty" : cert}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="gap-2"
                >
                  {profileSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Save Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* OpenAI API Key Section */}
          <Card className="bg-card/50 border-border/50 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                OpenAI API Key
              </CardTitle>
              <CardDescription>
                Add your own OpenAI API key to unlock AI-powered features like coaching,
                flashcard generation, and solution feedback.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add/Update Key Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">
                    {settings?.hasOpenAiKey ? "Replace API Key" : "API Key"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{" "}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      platform.openai.com
                    </a>
                  </p>
                </div>

                <Button
                  onClick={handleSaveApiKey}
                  disabled={saving || !apiKey.trim()}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  {settings?.hasOpenAiKey ? "Update API Key" : "Save API Key"}
                </Button>
              </div>

              {/* Security Note */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Your key is encrypted</p>
                  <p className="text-muted-foreground">
                    We encrypt your API key using AES-256-GCM before storing it. 
                    Only the last 4 characters are visible for identification.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Selection - Compact */}
          {settings?.hasOpenAiKey && (
            <Card className="bg-card/50 border-border/50 mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="w-4 h-4 text-purple-400" />
                  Preferred Model
                  <span className="text-xs text-muted-foreground font-normal">
                    {modelsLoading ? "Loading..." : `${availableModels.length} available`}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {modelsLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Fetching models...</span>
                  </div>
                ) : availableModels.length === 0 ? (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Could not fetch models</span>
                    <Button variant="outline" size="sm" onClick={() => fetchModels()}>Retry</Button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2 max-h-[200px] overflow-y-auto">
                      {availableModels.map((model) => (
                        <div
                          key={model.id}
                          className={`p-2 rounded-md border cursor-pointer transition-all text-sm ${
                            selectedModel === model.id
                              ? "bg-primary/10 border-primary"
                              : "bg-background/50 border-border/50 hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedModel(model.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{model.name}</span>
                            {selectedModel === model.id && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        </div>
                      ))}
                    </div>
                    {settings?.preferredModel !== selectedModel && (
                      <Button onClick={handleUpdateModel} disabled={saving} size="sm" className="gap-2">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Save
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* AWS Credentials Section */}
          <Card className="bg-card/50 border-border/50 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cloud className="w-4 h-4 text-orange-400" />
                AWS Credentials
              </CardTitle>
              <CardDescription className="text-sm">
                {awsCredentials?.hasCredentials 
                  ? `Key: ...${awsCredentials.accessKeyLastFour} • Region: ${awsCredentials.region}`
                  : "Add credentials to deploy to AWS"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="awsAccessKeyId" className="text-sm">
                    {awsCredentials?.hasCredentials ? "Replace Access Key ID" : "Access Key ID"}
                  </Label>
                  <Input
                    id="awsAccessKeyId"
                    type="text"
                    placeholder="AKIA..."
                    value={awsAccessKeyId}
                    onChange={(e) => setAwsAccessKeyId(e.target.value.toUpperCase())}
                  />
                  <p className="text-xs text-muted-foreground">
                    20 characters, starts with AKIA (user) or ASIA (temporary)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="awsSecretAccessKey">
                    {awsCredentials?.hasCredentials ? "Replace Secret Access Key" : "Secret Access Key"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="awsSecretAccessKey"
                      type={showAwsSecret ? "text" : "password"}
                      placeholder="Your secret access key"
                      value={awsSecretAccessKey}
                      onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowAwsSecret(!showAwsSecret)}
                    >
                      {showAwsSecret ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    40 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="awsRegion">AWS Region</Label>
                  <Select value={awsRegion} onValueChange={setAwsRegion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a region" />
                    </SelectTrigger>
                    <SelectContent>
                      {(awsCredentials?.availableRegions || [
                        "us-east-1", "us-east-2", "us-west-1", "us-west-2",
                        "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
                        "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
                        "sa-east-1", "ca-central-1", "me-south-1", "af-south-1",
                      ]).map((region) => (
                        <SelectItem key={region} value={region}>
                          {region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleSaveAwsCredentials}
                  disabled={awsSaving || !awsAccessKeyId.trim() || !awsSecretAccessKey.trim()}
                  className="gap-2"
                >
                  {awsSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  {awsCredentials?.hasCredentials ? "Update AWS Credentials" : "Save AWS Credentials"}
                </Button>
              </div>

              {/* Security Note */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Your credentials are encrypted</p>
                  <p className="text-muted-foreground">
                    We encrypt your AWS credentials using AES-256-GCM before storing them.
                    Only the last 4 characters of your Access Key ID are visible.
                  </p>
                </div>
              </div>

              {/* IAM Permissions Note */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Recommended IAM Permissions</p>
                  <p className="text-muted-foreground">
                    For diagram deployment, your IAM user should have permissions for:
                    EC2, VPC, RDS, S3, Lambda, API Gateway, and CloudFormation.
                    We recommend creating a dedicated IAM user with least-privilege access.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Section */}
          {settings?.subscriptionTier && ["team", "enterprise"].includes(settings.subscriptionTier) && (
            <Card className="bg-card/50 border-border/50 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Team
                </CardTitle>
                <CardDescription>
                  Collaborate with your team on challenges and track progress together.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {teamsLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading teams...</span>
                  </div>
                ) : teams.length === 0 ? (
                  // No teams - show create team form
                  <div className="space-y-4">
                    {!showCreateTeam ? (
                      <div className="text-center py-6">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground mb-4">You&apos;re not part of any team yet.</p>
                        <Button onClick={() => setShowCreateTeam(true)} className="gap-2">
                          <UserPlus className="w-4 h-4" />
                          Create a Team
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4 p-4 rounded-lg bg-background border border-border">
                        <h4 className="font-medium">Create a New Team</h4>
                        <div className="space-y-2">
                          <Label htmlFor="teamName">Team Name</Label>
                          <Input
                            id="teamName"
                            placeholder="My Awesome Team"
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="teamDesc">Description (optional)</Label>
                          <Input
                            id="teamDesc"
                            placeholder="A team for learning AWS together"
                            value={newTeamDescription}
                            onChange={(e) => setNewTeamDescription(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleCreateTeam} disabled={creatingTeam} className="gap-2">
                            {creatingTeam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Create Team
                          </Button>
                          <Button variant="outline" onClick={() => setShowCreateTeam(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Show teams
                  <div className="space-y-6">
                    {teams.map((team) => (
                      <div key={team.id} className="space-y-4">
                        {/* Team Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-lg flex items-center gap-2">
                              {team.name}
                              {team.myRole === "owner" && (
                                <Crown className="w-4 h-4 text-yellow-500" />
                              )}
                            </h4>
                            {team.description && (
                              <p className="text-sm text-muted-foreground">{team.description}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="capitalize">{team.myRole}</Badge>
                        </div>

                        {/* Members */}
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-muted-foreground">
                            Members ({team.memberCount}/{team.maxMembers})
                          </h5>
                          <div className="space-y-2">
                            {team.members.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-background/50"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User className="w-4 h-4 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">
                                      {member.academyUser?.name || member.academyUser?.username || "Unknown"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{member.academyUser?.email}</p>
                                  </div>
                                </div>
                                <Badge variant="secondary" className="capitalize text-xs">{member.role}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Invite Section (only for owner/admin) */}
                        {["owner", "admin"].includes(team.myRole) && (
                          <div className="space-y-3 pt-3 border-t border-border">
                            <h5 className="text-sm font-medium">Invite Members</h5>
                            <div className="flex gap-2">
                              <Input
                                placeholder="colleague@company.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="flex-1"
                              />
                              <Button
                                onClick={() => handleSendInvite(team.id)}
                                disabled={sendingInvite}
                                size="sm"
                                className="gap-2"
                              >
                                {sendingInvite ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Mail className="w-4 h-4" />
                                )}
                                Send
                              </Button>
                            </div>

                            {/* Pending Invites */}
                            {team.invites.length > 0 && (
                              <div className="space-y-2">
                                <h6 className="text-xs font-medium text-muted-foreground">Pending Invites</h6>
                                {team.invites.map((invite) => (
                                  <div
                                    key={invite.id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/20"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Mail className="w-4 h-4 text-amber-500" />
                                      <span className="text-sm">{invite.email}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyInviteLink(invite.code)}
                                        className="h-7 px-2"
                                      >
                                        {copiedInvite === invite.code ? (
                                          <Check className="w-3 h-3 text-green-500" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRevokeInvite(invite.id)}
                                        className="h-7 px-2 text-red-500 hover:text-red-600"
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-4">
              {/* Subscription Card */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <Badge variant="outline" className="capitalize">
                      {settings?.subscriptionTier || "free"}
                    </Badge>
                  </div>
                  {settings?.subscriptionTier === "free" && (
                    <Link href="/pricing" className="block mt-3">
                      <Button variant="glow" size="sm" className="w-full gap-2">
                        <Sparkles className="w-3 h-3" />
                        Upgrade
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>

              {/* Stats Card */}
              {profile && (
                <Card className="bg-card/50 border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Level</span>
                      <span className="font-medium">{profile.level}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Points</span>
                      <span className="font-medium text-amber-400">{profile.totalPoints}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Challenges</span>
                      <span className="font-medium text-green-400">{profile.challengesCompleted}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Streak</span>
                      <span className="font-medium text-orange-400">{profile.currentStreak} days</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Portfolios Card */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-4 h-4 text-purple-400" />
                    Portfolios
                    {portfoliosLoading && (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Your generated PDF portfolios
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Portfolio Thumbnails Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {portfolios.length > 0 ? (
                      portfolios.slice(0, 4).map((portfolio) => (
                        <div
                          key={portfolio.id}
                          className="group relative aspect-[3/4] rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-border/50 overflow-hidden cursor-pointer hover:border-purple-500/50 transition-all"
                          title={portfolio.title}
                          onClick={() => {
                            setSelectedPortfolio(portfolio);
                            setPortfolioViewerOpen(true);
                          }}
                        >
                          {/* Portfolio content */}
                          <div className="absolute inset-0 flex flex-col p-2">
                            {/* Example badge */}
                            {portfolio.isExample && (
                              <Badge className="absolute top-1 right-1 text-[8px] px-1 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                                Example
                              </Badge>
                            )}
                            
                            {/* Thumbnail - always use dynamic SVG thumbnail */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/portfolio/${portfolio.id}/thumbnail`}
                              alt={portfolio.title}
                              className="w-full h-full object-contain rounded"
                              onError={(e) => {
                                // Fallback to icon if thumbnail fails
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <div className="hidden flex-1 flex-col items-center justify-center">
                              <FileText className="w-6 h-6 text-purple-400/70 mb-1" />
                              <span className="text-[9px] text-muted-foreground text-center line-clamp-2 px-1">
                                {portfolio.title}
                              </span>
                            </div>
                            
                            {/* Company/Industry tag */}
                            <div className="mt-auto">
                              <span className="text-[8px] text-muted-foreground truncate block">
                                {portfolio.companyName || portfolio.industry || "Portfolio"}
                              </span>
                            </div>
                          </div>
                          
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 bg-background/90 hover:bg-background"
                                title="Download PDF"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (portfolio.pdfUrl) {
                                    window.open(portfolio.pdfUrl, "_blank");
                                  } else {
                                    // Open viewer for preview
                                    setSelectedPortfolio(portfolio);
                                    setPortfolioViewerOpen(true);
                                  }
                                }}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 bg-background/90 hover:bg-background"
                                title="View Details"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPortfolio(portfolio);
                                  setPortfolioViewerOpen(true);
                                }}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      // Empty state - show 4 placeholder slots
                      [1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="aspect-[3/4] rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-dashed border-border/30 flex flex-col items-center justify-center p-2"
                        >
                          <FileText className="w-5 h-5 text-muted-foreground/30 mb-1" />
                          <span className="text-[9px] text-muted-foreground/30 text-center">
                            Empty
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Info message */}
                  <p className="text-xs text-muted-foreground text-center mb-3">
                    {portfolios.length > 0 
                      ? `${portfolios.length} portfolio${portfolios.length > 1 ? "s" : ""} available`
                      : "Complete challenges to generate portfolio PDFs showcasing your skills."
                    }
                  </p>
                  
                  {/* Generate Portfolio Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                    disabled
                  >
                    <FileText className="w-3 h-3" />
                    Generate Portfolio
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Status */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="w-4 h-4 text-blue-400" />
                    API Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">OpenAI</span>
                    <div className="flex items-center gap-2">
                      {settings?.hasOpenAiKey ? (
                        <>
                          <Badge variant="outline" className="text-green-400 border-green-400/30">
                            <Check className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-red-400 hover:text-red-300"
                            onClick={handleDeleteApiKey}
                            disabled={deleting}
                          >
                            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not Set
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">AWS</span>
                    <div className="flex items-center gap-2">
                      {awsCredentials?.hasCredentials ? (
                        <>
                          <Badge variant="outline" className={awsCredentials.isValid ? "text-green-400 border-green-400/30" : "text-yellow-400 border-yellow-400/30"}>
                            {awsCredentials.isValid ? <Check className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                            {awsCredentials.isValid ? "Valid" : "Check"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-muted-foreground hover:text-foreground"
                            onClick={handleVerifyAwsCredentials}
                            disabled={awsVerifying}
                          >
                            {awsVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-red-400 hover:text-red-300"
                            onClick={handleDeleteAwsCredentials}
                            disabled={awsDeleting}
                          >
                            {awsDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not Set
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Portfolio Viewer Modal */}
      <PortfolioViewer
        portfolio={selectedPortfolio}
        open={portfolioViewerOpen}
        onClose={() => {
          setPortfolioViewerOpen(false);
          setSelectedPortfolio(null);
        }}
      />
    </div>
  );
}
