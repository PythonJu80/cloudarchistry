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
  Crown,
  Link2,
  CheckCircle2,
  XCircle,
  HelpCircle,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Team types imported from shared location
import type { 
  TeamResponse, 
  TeamMemberResponse, 
  TeamInviteResponse 
} from "@/lib/academy/types/team";

// Alias for backward compatibility in this file
type TeamData = TeamResponse;
type TeamMember = TeamMemberResponse;
type TeamInvite = TeamInviteResponse;

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

  // URL Crawl state
  const [crawlUrl, setCrawlUrl] = useState("");
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState<{ success: boolean; message: string; jobId?: string; polling?: boolean } | null>(null);
  const [crawlDepth, setCrawlDepth] = useState(2);
  const [crawlConcurrent, setCrawlConcurrent] = useState(5);

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
      
      // Handle rate limiting
      if (response.status === 429) {
        const resetInMinutes = data.resetAt 
          ? Math.ceil((data.resetAt - Date.now()) / 60000)
          : 60;
        setError(`Rate limit exceeded. You can create more teams in ${resetInMinutes} minute${resetInMinutes !== 1 ? 's' : ''}.`);
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create team");
      }
      
      // Show success with team limits
      const maxMembers = data.limits?.maxMembers || data.team?.maxMembers;
      const successMsg = maxMembers 
        ? `Team created successfully! Capacity: ${maxMembers} members`
        : "Team created successfully!";
      setSuccess(successMsg);
      
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

  const pollCrawlStatus = async (jobId: string) => {
    try {
      const res = await fetch(`/api/crawl/status/${jobId}`);
      const data = await res.json();
      
      if (data.status === "completed") {
        const result = data.result;
        setCrawlStatus({
          success: true,
          message: `✓ Done! ${result.pages_crawled} pages, ${result.total_words?.toLocaleString() || 0} words indexed`,
          jobId
        });
        setTimeout(() => setCrawlStatus(null), 8000);
      } else if (data.status === "failed") {
        setCrawlStatus({
          success: false,
          message: data.error || "Crawl failed",
          jobId
        });
        setTimeout(() => setCrawlStatus(null), 8000);
      } else {
        setTimeout(() => pollCrawlStatus(jobId), 3000);
      }
    } catch (error) {
      setCrawlStatus({
        success: false,
        message: "Lost connection to crawl service",
        jobId
      });
      setTimeout(() => setCrawlStatus(null), 5000);
    }
  };

  const crawlWebsite = async () => {
    if (!crawlUrl.trim() || isCrawling) return;
    
    setIsCrawling(true);
    setCrawlStatus(null);
    
    try {
      const res = await fetch(`/api/crawl?url=${encodeURIComponent(crawlUrl)}&max_depth=${crawlDepth}&max_concurrent=${crawlConcurrent}`, {
        method: "POST",
      });
      
      const data = await res.json();
      
      if (data.success && data.job_id) {
        setCrawlStatus({
          success: true,
          message: "Crawl started! Indexing in background...",
          jobId: data.job_id,
          polling: true
        });
        setCrawlUrl("");
        setIsCrawling(false);
        setTimeout(() => pollCrawlStatus(data.job_id), 2000);
      } else if (data.rate_limit) {
        const limits = data.rate_limit;
        setCrawlStatus({
          success: false,
          message: `Rate limited: ${limits.active_crawls}/${limits.limits?.concurrent} active, ${limits.hourly_crawls}/${limits.limits?.hourly} hourly`
        });
        setIsCrawling(false);
        setTimeout(() => setCrawlStatus(null), 8000);
      } else {
        setCrawlStatus({
          success: false,
          message: data.error || "Failed to start crawl"
        });
        setIsCrawling(false);
        setTimeout(() => setCrawlStatus(null), 5000);
      }
    } catch (error) {
      setCrawlStatus({
        success: false,
        message: "Failed to connect to crawl service"
      });
      setIsCrawling(false);
      setTimeout(() => setCrawlStatus(null), 5000);
    }
  };

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
    <TooltipProvider>
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
            <span className="text-xl font-bold">Cloud Archistry</span>
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
                        {(profile?.certificationOptions || ["CLF", "AIF", "SAA", "DVA", "SOA", "DEA", "MLA", "SAP", "DOP", "ANS", "SCS", "MLS", "PAS"]).map((cert) => (
                          <SelectItem key={cert} value={cert}>
                            {cert === "CLF" ? "Cloud Practitioner" :
                             cert === "AIF" ? "AI Practitioner" :
                             cert === "SAA" ? "Solutions Architect Associate" :
                             cert === "DVA" ? "Developer Associate" :
                             cert === "SOA" ? "SysOps Administrator Associate" :
                             cert === "DEA" ? "Data Engineer Associate" :
                             cert === "MLA" ? "ML Engineer Associate" :
                             cert === "SAP" ? "Solutions Architect Professional" :
                             cert === "DOP" ? "DevOps Engineer Professional" :
                             cert === "ANS" ? "Advanced Networking Specialty" :
                             cert === "SCS" ? "Security Specialty" :
                             cert === "MLS" ? "Machine Learning Specialty" :
                             cert === "PAS" ? "SAP on AWS Specialty" : cert}
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

          {/* OpenAI API Key Section - Commented out
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
          */}

          {/* Model Selection - Compact - Commented out
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
          */}

          {/* AWS Credentials Section - Commented out
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
          */}

          {/* Cohort Section - Show for learners (can view) and tutors (can create/manage) */}
          {settings?.subscriptionTier && ["learner", "tutor"].includes(settings.subscriptionTier) && (
            <Card className="bg-card/50 border-border/50 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Cohorts
                </CardTitle>
                <CardDescription>
                  Collaborate with your cohort on challenges and track progress together.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {teamsLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading cohorts...</span>
                  </div>
                ) : teams.length === 0 ? (
                  <div className="space-y-4">
                    {!showCreateTeam ? (
                      <div className="text-center py-6">
                        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground mb-4">You&apos;re not part of any cohort yet.</p>
                        {/* Only tutors can create cohorts */}
                        {settings?.subscriptionTier === "tutor" ? (
                          <Button onClick={() => setShowCreateTeam(true)} className="gap-2">
                            <UserPlus className="w-4 h-4" />
                            Create a Cohort
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Ask a tutor to invite you to their cohort.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4 p-4 rounded-lg bg-background border border-border">
                        <h4 className="font-medium">Create a New Cohort</h4>
                        <div className="space-y-2">
                          <Label htmlFor="teamName">Cohort Name</Label>
                          <Input
                            id="teamName"
                            placeholder="My Learning Cohort"
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="teamDesc">Description (optional)</Label>
                          <Input
                            id="teamDesc"
                            placeholder="A cohort for learning AWS together"
                            value={newTeamDescription}
                            onChange={(e) => setNewTeamDescription(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleCreateTeam} disabled={creatingTeam} className="gap-2">
                            {creatingTeam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Create Cohort
                          </Button>
                          <Button variant="outline" onClick={() => setShowCreateTeam(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teams.map((team) => (
                      <Link
                        key={team.id}
                        href={`/dashboard/cohort/${team.id}`}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <h4 className="font-medium flex items-center gap-2">
                              {team.name}
                              {team.myRole === "owner" && (
                                <Crown className="w-4 h-4 text-yellow-500" />
                              )}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {team.memberCount} members
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">{team.myRole}</Badge>
                      </Link>
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

              {/* URL Crawl Section */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    Add Knowledge
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Crawl AWS docs or guides to enhance AI responses
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="space-y-2">
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={crawlUrl}
                        onChange={(e) => setCrawlUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            crawlWebsite();
                          }
                        }}
                        placeholder="Paste URL to crawl..."
                        className="pl-9 h-9 bg-background/50 border-border/50 focus:border-cyan-500/50 text-sm"
                        disabled={isCrawling}
                      />
                    </div>

                    {/* Crawl Settings */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label htmlFor="crawlDepth" className="text-xs text-muted-foreground">
                            Depth
                          </Label>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <button type="button" className="inline-flex">
                                <HelpCircle className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs z-50">
                              <p className="text-xs">
                                <strong>How deep to follow links:</strong><br />
                                • Level 1: Just the page you enter<br />
                                • Level 2: The page + all linked pages<br />
                                • Level 3+: Follows links on those pages too<br />
                                <br />
                                <em>Example:</em> For a blog, use 3-4 levels to get the blog index and all individual posts.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Select 
                          value={crawlDepth.toString()} 
                          onValueChange={(v) => setCrawlDepth(parseInt(v))}
                          disabled={isCrawling}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent side="bottom" align="start" sideOffset={4}>
                            <SelectItem value="1">1 level</SelectItem>
                            <SelectItem value="2">2 levels</SelectItem>
                            <SelectItem value="3">3 levels</SelectItem>
                            <SelectItem value="4">4 levels</SelectItem>
                            <SelectItem value="5">5 levels</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label htmlFor="crawlConcurrent" className="text-xs text-muted-foreground">
                            Concurrent
                          </Label>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <button type="button" className="inline-flex">
                                <HelpCircle className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs z-50">
                              <p className="text-xs">
                                <strong>How many pages at once:</strong><br />
                                Controls how many pages are crawled simultaneously.<br />
                                <br />
                                • <strong>3-5 pages:</strong> Slower but gentler on the website<br />
                                • <strong>10-20 pages:</strong> Faster crawling for large sites<br />
                                <br />
                                Higher numbers = faster but more resource-intensive.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Select 
                          value={crawlConcurrent.toString()} 
                          onValueChange={(v) => setCrawlConcurrent(parseInt(v))}
                          disabled={isCrawling}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent side="bottom" align="start" sideOffset={4}>
                            <SelectItem value="3">3 pages</SelectItem>
                            <SelectItem value="5">5 pages</SelectItem>
                            <SelectItem value="10">10 pages</SelectItem>
                            <SelectItem value="15">15 pages</SelectItem>
                            <SelectItem value="20">20 pages</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      onClick={crawlWebsite}
                      disabled={isCrawling || !crawlUrl.trim()}
                      size="sm"
                      className="w-full gap-2 bg-cyan-600 hover:bg-cyan-500"
                    >
                      {isCrawling ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Crawling...
                        </>
                      ) : (
                        <>
                          <Globe className="w-3.5 h-3.5" />
                          Start Crawl
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Crawl Status */}
                  {crawlStatus && (
                    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                      crawlStatus.success 
                        ? crawlStatus.polling 
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {crawlStatus.success ? (
                        crawlStatus.polling ? (
                          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        )
                      ) : (
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="text-[11px] leading-tight">{crawlStatus.message}</span>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    Indexed content will be available for AI-powered features across the platform.
                  </p>
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
    </TooltipProvider>
  );
}
