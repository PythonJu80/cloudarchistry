"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Edit2, Save, X, Github, Linkedin, Globe, Award } from "lucide-react";
import Link from "next/link";

interface ArcHubProfile {
  id: string;
  profileId: string;
  arcHubUsername: string | null;
  arcHubBio: string | null;
  arcHubAvatarUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  diagramsUploaded: number;
  totalViews: number;
  totalRemixes: number;
  totalExports: number;
  reputation: number;
  badges: { id: string; earnedAt: string }[];
  defaultVisibility: string;
  allowRemixes: boolean;
  allowComments: boolean;
  profile: {
    displayName: string | null;
    avatarUrl: string | null;
    level: number;
    totalPoints: number;
    targetCertification: string | null;
    skillLevel: string | null;
  };
}

export default function ArcHubProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ArcHubProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    arcHubUsername: "",
    arcHubBio: "",
    githubUrl: "",
    linkedinUrl: "",
    websiteUrl: "",
    defaultVisibility: "public",
    allowRemixes: true,
    allowComments: true,
  });

  useEffect(() => {
    setMounted(true);
    // Load avatar from localStorage (same as settings page)
    const storedAvatar = localStorage.getItem("academy-avatar");
    if (storedAvatar) {
      setLocalAvatar(storedAvatar);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/archub/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setFormData({
          arcHubUsername: data.arcHubUsername || "",
          arcHubBio: data.arcHubBio || "",
          githubUrl: data.githubUrl || "",
          linkedinUrl: data.linkedinUrl || "",
          websiteUrl: data.websiteUrl || "",
          defaultVisibility: data.defaultVisibility,
          allowRemixes: data.allowRemixes,
          allowComments: data.allowComments,
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/archub/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditing(false);
      }
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Please sign in to view your profile</p>
          <Link href="/login" className="px-6 py-3 bg-blue-500 text-white rounded-lg">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        <Link href="/archub" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
          ← Back to ArcHub
        </Link>

        <div className="grid grid-cols-12 gap-6">
          {/* Profile Card */}
          <div className="col-span-4">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 sticky top-6">
              {/* Avatar */}
              <div className="text-center mb-6">
                {mounted && (localAvatar || profile.profile.avatarUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={localAvatar || profile.profile.avatarUrl || ""}
                    alt="Profile"
                    className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-blue-500/50"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 mx-auto mb-4 flex items-center justify-center text-4xl font-bold text-white">
                    {profile.profile.displayName?.[0]?.toUpperCase() || session.user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <h2 className="text-2xl font-bold text-white mb-1">
                  {profile.arcHubUsername || session.user.username}
                </h2>
                <p className="text-slate-400">
                  {profile.profile.displayName || session.user.name}
                </p>
              </div>

              {/* Academy Stats */}
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-slate-400 mb-3">Cloud Academy</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Level</span>
                    <span className="text-white font-medium">{profile.profile.level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total XP</span>
                    <span className="text-white font-medium">{profile.profile.totalPoints}</span>
                  </div>
                  {profile.profile.targetCertification && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Cert</span>
                      <span className="text-amber-400 font-medium">{profile.profile.targetCertification}</span>
                    </div>
                  )}
                  {profile.profile.skillLevel && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Skill Level</span>
                      <span className="text-white font-medium capitalize">{profile.profile.skillLevel}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ArcHub Stats */}
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-slate-400 mb-3">ArcHub Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Blueprints</span>
                    <span className="text-white font-medium">{profile.diagramsUploaded}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Views</span>
                    <span className="text-white font-medium">{profile.totalViews}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Remixes</span>
                    <span className="text-white font-medium">{profile.totalRemixes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reputation</span>
                    <span className="text-white font-medium flex items-center gap-1">
                      <Award className="w-3 h-3 text-yellow-400" />
                      {profile.reputation}
                    </span>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              {!editing && (profile.githubUrl || profile.linkedinUrl || profile.websiteUrl) && (
                <div className="space-y-2">
                  {profile.githubUrl && (
                    <a
                      href={profile.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                    >
                      <Github className="w-4 h-4" />
                      <span className="text-sm">GitHub</span>
                    </a>
                  )}
                  {profile.linkedinUrl && (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                    >
                      <Linkedin className="w-4 h-4" />
                      <span className="text-sm">LinkedIn</span>
                    </a>
                  )}
                  {profile.websiteUrl && (
                    <a
                      href={profile.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      <span className="text-sm">Website</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Profile Details */}
          <div className="col-span-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        fetchProfile();
                      }}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    ArcHub Username
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.arcHubUsername}
                      onChange={(e) => setFormData({ ...formData, arcHubUsername: e.target.value })}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-white">{profile.arcHubUsername || "Not set"}</p>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bio</label>
                  {editing ? (
                    <textarea
                      value={formData.arcHubBio}
                      onChange={(e) => setFormData({ ...formData, arcHubBio: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                      placeholder="Tell the community about yourself..."
                    />
                  ) : (
                    <p className="text-white whitespace-pre-wrap">{profile.arcHubBio || "No bio yet"}</p>
                  )}
                </div>

                {/* Social Links */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      GitHub URL
                    </label>
                    {editing ? (
                      <input
                        type="url"
                        value={formData.githubUrl}
                        onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                        placeholder="https://github.com/username"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-white">{profile.githubUrl || "Not set"}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      LinkedIn URL
                    </label>
                    {editing ? (
                      <input
                        type="url"
                        value={formData.linkedinUrl}
                        onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                        placeholder="https://linkedin.com/in/username"
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-white">{profile.linkedinUrl || "Not set"}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Website URL
                  </label>
                  {editing ? (
                    <input
                      type="url"
                      value={formData.websiteUrl}
                      onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                      placeholder="https://yourwebsite.com"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-white">{profile.websiteUrl || "Not set"}</p>
                  )}
                </div>

                {/* Preferences */}
                {editing && (
                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Preferences</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">Allow Remixes</p>
                          <p className="text-sm text-slate-400">Let others remix your blueprints</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.allowRemixes}
                          onChange={(e) => setFormData({ ...formData, allowRemixes: e.target.checked })}
                          className="w-5 h-5"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">Allow Comments</p>
                          <p className="text-sm text-slate-400">Enable comments on your blueprints</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.allowComments}
                          onChange={(e) => setFormData({ ...formData, allowComments: e.target.checked })}
                          className="w-5 h-5"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* My Blueprints */}
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">My Blueprints</h2>
                <Link
                  href="/archub/upload"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                >
                  Upload New
                </Link>
              </div>
              <p className="text-slate-400">
                You have uploaded {profile.diagramsUploaded} blueprint{profile.diagramsUploaded !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
