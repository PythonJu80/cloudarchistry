"use client";

/**
 * Profile Modal Component
 * 
 * Allows users to update their profile settings that aren't automatically updated.
 * Can be triggered from anywhere in the app.
 */

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Loader2,
  Check,
  X,
  GraduationCap,
  Target,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileData {
  displayName: string;
  bio: string;
  skillLevel: string;
  preferredDifficulty: string;
  targetCertification: string;
  preferredIndustries: string[];
}

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const SKILL_LEVELS = [
  { id: "beginner", label: "Beginner", description: "New to AWS" },
  { id: "intermediate", label: "Intermediate", description: "Some experience" },
  { id: "advanced", label: "Advanced", description: "Production experience" },
  { id: "expert", label: "Expert", description: "Deep expertise" },
];

const DIFFICULTY_OPTIONS = [
  { id: "easy", label: "Easy", color: "text-green-400" },
  { id: "medium", label: "Medium", color: "text-amber-400" },
  { id: "hard", label: "Hard", color: "text-red-400" },
];

const CERTIFICATIONS = [
  { id: "SAA", label: "Solutions Architect Associate" },
  { id: "SAP", label: "Solutions Architect Professional" },
  { id: "DVA", label: "Developer Associate" },
  { id: "SOA", label: "SysOps Administrator Associate" },
  { id: "DOP", label: "DevOps Engineer Professional" },
  { id: "ANS", label: "Advanced Networking Specialty" },
  { id: "SCS", label: "Security Specialty" },
  { id: "DBS", label: "Database Specialty" },
  { id: "MLS", label: "Machine Learning Specialty" },
];

const INDUSTRIES = [
  "Finance", "Healthcare", "E-commerce", "Media", "Gaming",
  "Education", "Government", "Manufacturing", "Logistics", "SaaS",
];

export function ProfileModal({ open, onOpenChange, onSaved }: ProfileModalProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [profile, setProfile] = useState<ProfileData>({
    displayName: "",
    bio: "",
    skillLevel: "intermediate",
    preferredDifficulty: "medium",
    targetCertification: "SAA",
    preferredIndustries: [],
  });

  // Load profile data
  useEffect(() => {
    if (open && session?.user?.academyProfileId) {
      loadProfile();
    }
  }, [open, session?.user?.academyProfileId]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile({
          displayName: data.displayName || session?.user?.name || "",
          bio: data.bio || "",
          skillLevel: data.skillLevel || "intermediate",
          preferredDifficulty: data.preferredDifficulty || "medium",
          targetCertification: data.targetCertification || "SAA",
          preferredIndustries: data.preferredIndustries || [],
        });
      }
    } catch (err) {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      setSuccess(true);
      setTimeout(() => {
        onSaved?.();
        onOpenChange(false);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const toggleIndustry = (industry: string) => {
    setProfile(prev => ({
      ...prev,
      preferredIndustries: prev.preferredIndustries.includes(industry)
        ? prev.preferredIndustries.filter(i => i !== industry)
        : [...prev.preferredIndustries, industry],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Edit Profile
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Error/Success Messages */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                <X className="w-4 h-4 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                <p className="text-sm text-green-400">Profile saved!</p>
              </div>
            )}

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={profile.displayName}
                onChange={(e) => setProfile(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="Your display name"
              />
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell us about yourself..."
                rows={3}
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm resize-none"
              />
            </div>

            {/* Skill Level */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Skill Level
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {SKILL_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setProfile(prev => ({ ...prev, skillLevel: level.id }))}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-colors",
                      profile.skillLevel === level.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <p className="font-medium text-sm">{level.label}</p>
                    <p className="text-xs text-muted-foreground">{level.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Difficulty */}
            <div className="space-y-2">
              <Label>Preferred Challenge Difficulty</Label>
              <div className="flex gap-2">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setProfile(prev => ({ ...prev, preferredDifficulty: opt.id }))}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                      profile.preferredDifficulty === opt.id
                        ? `border-primary bg-primary/10 ${opt.color}`
                        : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Certification */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Target Certification
              </Label>
              <select
                value={profile.targetCertification}
                onChange={(e) => setProfile(prev => ({ ...prev, targetCertification: e.target.value }))}
                className="w-full h-10 px-3 rounded-md bg-background border border-input text-sm"
              >
                {CERTIFICATIONS.map((cert) => (
                  <option key={cert.id} value={cert.id}>
                    AWS {cert.label} ({cert.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Preferred Industries */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Preferred Industries
              </Label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((industry) => (
                  <button
                    key={industry}
                    onClick={() => toggleIndustry(industry)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      profile.preferredIndustries.includes(industry)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {industry}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select industries to get relevant challenge scenarios
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Save Profile
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
