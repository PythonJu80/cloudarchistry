"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { 
  Globe, 
  X, 
  ChevronRight,
  ChevronDown,
  Zap,
  ArrowLeft,
  Target,
  Clock,
  Lock,
  Sparkles,
  Crown,
  User,
  Building2,
  Users,
  UserPlus,
  HelpCircle,
  Trash2,
  Loader2,
  Swords,
  Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type SubscriptionTier, getTierFeatures, getUpgradeMessage } from "@/lib/academy/services/subscription";
import { type TeamSummary } from "@/lib/academy/types/team";
import { ScenarioGenerationModal } from "@/components/world/scenario-generation-modal";
import { ChallengeWorkspaceModal } from "@/components/world/challenge-workspace-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { TrialBanner } from "@/components/trial-banner";

// Dynamically import map components to avoid SSR issues
const Globe3D = dynamic(() => import("@/components/world/globe-3d"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/40 to-blue-500/40" />
        </div>
        <p className="text-muted-foreground">Initializing 3D Globe...</p>
      </div>
    </div>
  ),
});

const WorldMap = dynamic(() => import("@/components/world/world-map").then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <Globe className="w-16 h-16 text-cyan-400 animate-pulse mx-auto mb-4" />
        <p className="text-muted-foreground">Loading Satellite View...</p>
      </div>
    </div>
  ),
});

// Types
export interface Location {
  id: string;
  name: string;
  company: string;
  industry: string;
  lat: number;
  lng: number;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  challenges: number;
  completed: number;
  locked: boolean;
  description: string;
  compliance: string[];
  icon: string;
  // For dynamically discovered places from Google Places
  isDiscovered?: boolean;
  placeId?: string;
  website?: string;
}

// Empty locations array - system challenges removed, only user-generated challenges
const LOCATIONS: Location[] = [];

// Certification code to display name mapping (matches settings page)
const CERT_DISPLAY_NAMES: Record<string, string> = {
  "CLF": "Cloud Practitioner",
  "AIF": "AI Practitioner",
  "SAA": "Solutions Architect Associate",
  "DVA": "Developer Associate",
  "SOA": "SysOps Administrator Associate",
  "DEA": "Data Engineer Associate",
  "MLA": "ML Engineer Associate",
  "SAP": "Solutions Architect Professional",
  "DOP": "DevOps Engineer Professional",
  "ANS": "Advanced Networking Specialty",
  "SCS": "Security Specialty",
  "MLS": "Machine Learning Specialty",
  "PAS": "SAP on AWS Specialty",
  "DBS": "Database Specialty",
};

// Certification level mapping
const CERT_LEVELS: Record<string, string> = {
  "CLF": "foundational",
  "AIF": "foundational",
  "SAA": "associate",
  "DVA": "associate",
  "SOA": "associate",
  "DEA": "associate",
  "MLA": "associate",
  "SAP": "professional",
  "DOP": "professional",
  "ANS": "specialty",
  "SCS": "specialty",
  "MLS": "specialty",
  "PAS": "specialty",
  "DBS": "specialty",
};

// Difficulty colors
const difficultyColors = {
  beginner: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/50" },
  intermediate: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/50" },
  advanced: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/50" },
  expert: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50" },
};

// Location Item Component
function LocationItem({ 
  location, 
  isSelected, 
  onSelect 
}: { 
  location: Location; 
  isSelected: boolean; 
  onSelect: (location: Location) => void;
}) {
  return (
    <button
      onClick={() => onSelect(location)}
      className={cn(
        "w-full p-2 rounded-lg text-left transition-all hover:bg-secondary/50",
        isSelected && "bg-secondary ring-1 ring-primary/50",
        location.locked && "opacity-50"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="text-xl">{location.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{location.company}</span>
            {location.locked && <Lock className="w-3 h-3 text-muted-foreground" />}
          </div>
          <div className="text-xs text-muted-foreground truncate">{location.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {location.completed}/{location.challenges} challenges
          </div>
        </div>
      </div>
    </button>
  );
}

// Difficulty Section Component
function DifficultySection({
  title,
  locations,
  isOpen,
  onToggle,
  selectedLocation,
  onLocationSelect,
  colorClass,
}: {
  title: string;
  locations: Location[];
  isOpen: boolean;
  onToggle: () => void;
  selectedLocation: Location | null;
  onLocationSelect: (location: Location) => void;
  colorClass: { bg: string; text: string; border: string };
}) {
  return (
    <div className="border-t border-border/30">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 px-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={cn("text-xs px-1.5 py-0.5 rounded", colorClass.bg, colorClass.text)}>
            {title}
          </span>
          <span className="text-xs text-muted-foreground">({locations.length})</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-2 pb-2 space-y-1">
          {locations.map((location) => (
            <LocationItem
              key={location.id}
              location={location}
              isSelected={selectedLocation?.id === location.id}
              onSelect={onLocationSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorldPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [visitedLocations, setVisitedLocations] = useState<string[]>([]);
    const [mapView, setMapView] = useState<"globe" | "satellite">("globe");
  const [zoomLevel, setZoomLevel] = useState(2);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Get tier from session
  const userTier: SubscriptionTier = (session?.user?.subscriptionTier as SubscriptionTier) || "free";
  const tierFeatures = getTierFeatures(userTier);
  const upgradeInfo = getUpgradeMessage("canStartChallenges");
  
  // Collapsible section states - all closed by default
  const [userChallengesOpen, setUserChallengesOpen] = useState(false);
  const [cohortChallengesOpen, setCohortChallengesOpen] = useState(false);
  const [systemChallengesOpen, setSystemChallengesOpen] = useState(false);
  const [beginnerOpen, setBeginnerOpen] = useState(false);
  const [intermediateOpen, setIntermediateOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expertOpen, setExpertOpen] = useState(false);
  
  // User challenges (from database)
  interface SavedChallenge {
    id: string;
    scenarioId: string;
    status: string;
    pointsEarned: number;
    maxPoints: number;
    scenario: { 
      id: string;
      title: string; 
      description: string;
      difficulty: string;
      companyInfo: Record<string, unknown>;
    };
    location: { id: string; name: string; company: string; lat: number; lng: number; difficulty: string; industry: string };
    challenges: Array<{
      id: string;
      title: string;
      description: string;
      difficulty: string;
      points: number;
      estimatedMinutes: number;
      orderIndex: number;
      hints: string[];
      successCriteria: string[];
      awsServices: string[];
      status: string;
      pointsEarned: number;
    }>;
    challengesCompleted: number;
    totalChallenges: number;
  }
  const [userChallenges, setUserChallenges] = useState<SavedChallenge[]>([]);
  const [isLoadingUserChallenges, setIsLoadingUserChallenges] = useState(false);
  
  // Cohort challenges state (uses TeamSummary from shared types)
  const [cohortChallenges, setCohortChallenges] = useState<TeamSummary[]>([]);
  const [isLoadingCohorts, setIsLoadingCohorts] = useState(false);
  
  // State for resuming a saved challenge
  const [resumeChallenge, setResumeChallenge] = useState<SavedChallenge | null>(null);
  const [resumeChallengeIndex, setResumeChallengeIndex] = useState(0);
  
  // State for newly started challenge (from ScenarioGenerationModal)
  const [newChallengeData, setNewChallengeData] = useState<{
    challengeIndex: number;
    challenge: {
      id: string;
      title: string;
      description: string;
      difficulty: string;
      points: number;
      hints: string[];
      success_criteria: string[];
      aws_services_relevant: string[];
      estimated_time_minutes: number;
    };
    scenario: {
      scenario_title: string;
      scenario_description: string;
      business_context: string;
      company_name: string;
    };
    companyInfo: Record<string, unknown>;
    totalChallenges: number;
    allChallenges: Array<{
      id: string;
      title: string;
      description: string;
      difficulty: string;
      points: number;
      hints: string[];
      success_criteria: string[];
      aws_services_relevant: string[];
      estimated_time_minutes: number;
    }>;
    scenarioId: string;
    attemptId: string;
  } | null>(null);
  
  // State for deleting challenges
  const [deletingChallengeId, setDeletingChallengeId] = useState<string | null>(null);
  
  // Delete a user challenge
  const handleDeleteChallenge = async (attemptId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the challenge
    
    if (!confirm("Are you sure you want to delete this challenge? This will remove all progress, questions, and answers permanently.")) {
      return;
    }
    
    setDeletingChallengeId(attemptId);
    try {
      const response = await fetch(`/api/user/challenges/${attemptId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        // Remove from local state
        setUserChallenges(prev => prev.filter(c => c.id !== attemptId));
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete challenge");
      }
    } catch (error) {
      console.error("Failed to delete challenge:", error);
      alert("Failed to delete challenge");
    } finally {
      setDeletingChallengeId(null);
    }
  };

  // Fetch user's accepted challenges
  useEffect(() => {
    const fetchUserChallenges = async () => {
      if (!session?.user?.academyProfileId) return;
      
      setIsLoadingUserChallenges(true);
      try {
        const response = await fetch("/api/user/challenges");
        if (response.ok) {
          const data = await response.json();
          setUserChallenges(data.challenges || []);
        }
      } catch (error) {
        console.error("Failed to fetch user challenges:", error);
      } finally {
        setIsLoadingUserChallenges(false);
      }
    };
    
    fetchUserChallenges();
  }, [session?.user?.academyProfileId]);
  
  // Fetch cohort/team challenges
  useEffect(() => {
    const fetchCohorts = async () => {
      if (!session?.user?.id) return;
      
      setIsLoadingCohorts(true);
      try {
        const response = await fetch("/api/team");
        if (response.ok) {
          const data = await response.json();
          const teams = data.teams || [];
          
          // Transform teams into cohort challenges format
          const cohorts: TeamSummary[] = teams.map((team: {
            id: string;
            name: string;
            memberCount: number;
            activeChallenges: number;
          }) => ({
            id: team.id,
            name: team.name,
            memberCount: team.memberCount,
            activeChallenges: team.activeChallenges,
          }));
          
          setCohortChallenges(cohorts);
        }
      } catch (error) {
        console.error("Failed to fetch cohorts:", error);
      } finally {
        setIsLoadingCohorts(false);
      }
    };
    
    fetchCohorts();
  }, [session?.user?.id]);

  // Memoize location groupings to prevent recalculation on every render
  const { beginnerLocations, intermediateLocations, advancedLocations, expertLocations } = useMemo(() => ({
    beginnerLocations: LOCATIONS.filter(loc => loc.difficulty === "beginner"),
    intermediateLocations: LOCATIONS.filter(loc => loc.difficulty === "intermediate"),
    advancedLocations: LOCATIONS.filter(loc => loc.difficulty === "advanced"),
    expertLocations: LOCATIONS.filter(loc => loc.difficulty === "expert"),
  }), []);

  // Handle location selection
  const handleLocationSelect = useCallback((location: Location) => {
    setSelectedLocation(location);
    if (!visitedLocations.includes(location.id)) {
      setVisitedLocations((prev) => [...prev, location.id]);
    }
    // Set target coordinates for the map center
    setTargetCoords({ lat: location.lat, lng: location.lng });
    // Switch to satellite view when zooming in
    setMapView("satellite");
    setZoomLevel(15);
  }, [visitedLocations]);

  // Handle back to globe
  const handleBackToGlobe = useCallback(() => {
    setSelectedLocation(null);
    setTargetCoords(null);
    setMapView("globe");
    setZoomLevel(2);
  }, []);

  // Store the target coordinates for Leaflet
  const [targetCoords, setTargetCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // Selected business from Google Places
  const [selectedBusiness, setSelectedBusiness] = useState<{
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    types: string[];
    rating?: number;
    totalRatings?: number;
    icon?: string;
    photo?: string;
  } | null>(null);
  
  // Custom challenge form state
  const [customBusinessName, setCustomBusinessName] = useState("");
  const [customBusinessAddress, setCustomBusinessAddress] = useState("");
  const [customBusinessIndustry, setCustomBusinessIndustry] = useState("Technology");
  const [customSearchResults, setCustomSearchResults] = useState<Array<{ place_id: string; name: string; vicinity: string; types: string[] }>>([]);
  const [selectedCert, setSelectedCert] = useState("SAA"); // Default to Solutions Architect Associate (short code)
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<"beginner" | "intermediate" | "advanced" | "expert">("intermediate"); // Default skill level
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [generationTarget, setGenerationTarget] = useState<{
    businessName: string;
    industry: string;
    latitude?: number;
    longitude?: number;
    country?: string;
    skillLevel?: "beginner" | "intermediate" | "advanced" | "expert";
  } | null>(null);
  const [activeIndustries, setActiveIndustries] = useState<Set<string>>(new Set([
    "Finance", "Healthcare", "Technology", "Retail", "Hospitality", "Automotive", "Education", "Aviation"
  ]));
  
  // Toggle industry filter
  const toggleIndustry = (industry: string) => {
    setActiveIndustries(prev => {
      const next = new Set(prev);
      if (next.has(industry)) {
        next.delete(industry);
      } else {
        next.add(industry);
      }
      return next;
    });
  };
  
  // Available certifications from API (fetched from settings/profile)
  const [certificationOptions, setCertificationOptions] = useState<string[]>([]);
  
  // Build certifications array from options
  const certifications = useMemo(() => 
    certificationOptions.map(code => ({
      code,
      name: CERT_DISPLAY_NAMES[code] || code,
      level: CERT_LEVELS[code] || "associate",
    })),
    [certificationOptions]
  );
  
  // User's API key for generation
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [preferredModel, setPreferredModel] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Fetch target cert, skill level, certification options, and API key from database on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Fetch profile data including cert options (same as settings page)
        const profileRes = await fetch("/api/settings/profile");
        const profileData = await profileRes.json();
        
        // Set certification options from API
        if (profileData.certificationOptions) {
          setCertificationOptions(profileData.certificationOptions);
        }
        
        // Set target certification (uses short codes like "DVA", "SAA")
        if (profileData.targetCertification) {
          setSelectedCert(profileData.targetCertification);
        }
        
        // Set skill level
        if (profileData.skillLevel) {
          setSelectedSkillLevel(profileData.skillLevel as "beginner" | "intermediate" | "advanced" | "expert");
        }
        
        // Fetch API key (encrypted, returned decrypted for use)
        const settingsRes = await fetch("/api/settings/apikey");
        const settingsData = await settingsRes.json();
        if (settingsData.apiKey) {
          setUserApiKey(settingsData.apiKey);
        }
        if (settingsData.preferredModel) {
          setPreferredModel(settingsData.preferredModel);
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      } finally {
        setSettingsLoaded(true);
      }
    };
    fetchSettings();
  }, []);
  
  // Save cert to database when changed (uses same endpoint as settings page)
  const handleCertChange = async (certCode: string) => {
    setSelectedCert(certCode);
    try {
      await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCertification: certCode }),
      });
    } catch (err) {
      console.error("Failed to save cert:", err);
    }
  };
  
  // Save skill level to database when changed (uses same endpoint as settings page)
  const handleSkillLevelChange = async (level: "beginner" | "intermediate" | "advanced" | "expert") => {
    setSelectedSkillLevel(level);
    try {
      await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillLevel: level }),
      });
    } catch (err) {
      console.error("Failed to save skill level:", err);
    }
  };
  
  // Helper: Detect industry from Google Places types
  const detectIndustry = (types: string[]): string => {
    for (const type of types) {
      if (["bank", "finance", "atm", "accounting", "insurance_agency"].includes(type)) return "Banking & Finance";
      if (["hospital", "doctor", "dentist", "pharmacy", "health"].includes(type)) return "Healthcare";
      if (["electronics_store", "computer_store"].includes(type)) return "Technology";
      if (["store", "shopping_mall", "clothing_store", "supermarket"].includes(type)) return "Retail";
      if (["restaurant", "cafe", "bar", "bakery", "food", "hotel", "lodging", "gym", "spa", "beauty_salon"].includes(type)) return "Hospitality";
      if (["car_dealer", "car_rental", "car_repair", "gas_station"].includes(type)) return "Automotive";
      if (["school", "university", "library"].includes(type)) return "Education";
      if (["lawyer", "real_estate_agency"].includes(type)) return "Professional Services";
      if (["travel_agency", "airport"].includes(type)) return "Aviation";
    }
    return "Technology";
  };
  
  // Helper: Get emoji for industry
  const getIndustryIcon = (industry: string): string => {
    const icons: Record<string, string> = {
      "Technology": "💻",
      "Banking & Finance": "🏦",
      "Healthcare": "🏥",
      "E-Commerce": "🛍️",
      "Retail": "🛒",
      "Hospitality": "🏨",
      "Automotive": "🚗",
      "Education": "🎓",
      "Aviation": "✈️",
      "Professional Services": "💼",
    };
    return icons[industry] || "🏢";
  };

  // Handle zoom in from globe - switch to Leaflet at the passed coordinates
  const handleGlobeZoomIn = useCallback((lat: number, lng: number) => {
    // Store the coordinates to center Leaflet on
    setTargetCoords({ lat, lng });
    
    // Clear any selected location and business - we're exploring a new area
    setSelectedLocation(null);
    setSelectedBusiness(null);
    
    // Switch to satellite view - same zoom level as location select
    setMapView("satellite");
    setZoomLevel(15);
  }, []);

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-950 flex flex-col">
      {/* Trial Banner */}
      <TrialBanner />
      
      <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          "h-full w-80 bg-background/95 backdrop-blur-xl border-r border-border/50 flex flex-col"
        )}
      >
        <>
            {/* Header */}
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center justify-between mb-4">
                <Link href="/" className="flex items-center gap-2 group">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
                    <Image
                      src="/logo.png"
                      alt="Cloud Archistry"
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  </div>
                  <span className="font-bold">Cloud Archistry</span>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                </Link>
                <Link href="/guide">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-cyan-400">
                    <HelpCircle className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              
              {/* Target Certification Picker */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Target className="w-3 h-3" />
                  Target Certification
                </label>
                <select
                  value={selectedCert}
                  onChange={(e) => handleCertChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-slate-800 border border-cyan-500/30 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2306b6d4'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
                >
                  {certifications.filter(c => c.level === "foundational").length > 0 && (
                    <optgroup label="Foundational" className="bg-slate-800 text-white">
                      {certifications.filter(c => c.level === "foundational").map(cert => (
                        <option key={cert.code} value={cert.code} className="bg-slate-800 text-white py-2">{cert.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {certifications.filter(c => c.level === "associate").length > 0 && (
                    <optgroup label="Associate" className="bg-slate-800 text-white">
                      {certifications.filter(c => c.level === "associate").map(cert => (
                        <option key={cert.code} value={cert.code} className="bg-slate-800 text-white py-2">{cert.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {certifications.filter(c => c.level === "professional").length > 0 && (
                    <optgroup label="Professional" className="bg-slate-800 text-white">
                      {certifications.filter(c => c.level === "professional").map(cert => (
                        <option key={cert.code} value={cert.code} className="bg-slate-800 text-white py-2">{cert.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {certifications.filter(c => c.level === "specialty").length > 0 && (
                    <optgroup label="Specialty" className="bg-slate-800 text-white">
                      {certifications.filter(c => c.level === "specialty").map(cert => (
                        <option key={cert.code} value={cert.code} className="bg-slate-800 text-white py-2">{cert.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Stats - Connected to database */}
            <div className="p-4 border-b border-border/50 grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-cyan-400">{userChallenges.length}</div>
                <div className="text-xs text-muted-foreground">Started</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-400">
                  {userChallenges.filter(c => c.status === "completed").length}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">
                  {userChallenges.reduce((sum, c) => sum + c.pointsEarned, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Points</div>
              </div>
            </div>

            {/* Location List with Collapsible Sections */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-3">
                {/* User Challenges Section */}
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <button
                    onClick={() => setUserChallengesOpen(!userChallengesOpen)}
                    className="w-full flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-cyan-400" />
                      <span className="font-medium text-sm">User Challenges</span>
                      <span className="text-xs text-muted-foreground">({userChallenges.length})</span>
                    </div>
                    {userChallengesOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {userChallengesOpen && (
                    <div className="p-2">
                      {userChallenges.length === 0 ? (
                        isLoadingUserChallenges ? (
                          <div className="space-y-2 py-2">
                            {[...Array(3)].map((_, i) => (
                              <div key={i} className="p-2 rounded-lg bg-slate-800/50">
                                <div className="flex items-center justify-between mb-2">
                                  <Skeleton className="h-4 w-32" />
                                  <Skeleton className="h-4 w-16" />
                                </div>
                                <Skeleton className="h-3 w-24 mb-2" />
                                <Skeleton className="h-1.5 w-full rounded-full" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            No custom challenges yet
                          </div>
                        )
                      ) : (
                        <div className="space-y-2">
                          {userChallenges.map((challenge) => (
                            <div
                              key={challenge.id}
                              className="relative group"
                            >
                              <button
                                onClick={() => {
                                  // Find the first incomplete challenge to resume, or start from 0
                                  const firstIncomplete = challenge.challenges.findIndex(c => c.status !== "completed");
                                  setResumeChallengeIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
                                  setResumeChallenge(challenge);
                                  // Clear any selected location to avoid showing location card
                                  setSelectedLocation(null);
                                  setSelectedBusiness(null);
                                }}
                                disabled={deletingChallengeId === challenge.id}
                                className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-transparent hover:border-cyan-500/30 transition-all disabled:opacity-50"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-slate-200 truncate pr-6">
                                    {challenge.location.company}
                                  </span>
                                  <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap",
                                    challenge.status === "completed" 
                                      ? "bg-green-500/20 text-green-400"
                                      : "bg-cyan-500/20 text-cyan-400"
                                  )}>
                                    {challenge.status === "completed" ? "Done" : "In Progress"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 truncate mb-1">
                                  {challenge.scenario.title}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                  <span>{challenge.challengesCompleted}/{challenge.totalChallenges} challenges</span>
                                  <span>•</span>
                                  <span>{challenge.pointsEarned}/{challenge.maxPoints} pts</span>
                                </div>
                              </button>
                              {/* Delete button - shows on hover, bottom-right corner */}
                              <button
                                onClick={(e) => handleDeleteChallenge(challenge.id, e)}
                                disabled={deletingChallengeId === challenge.id}
                                className="absolute bottom-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                                title="Delete challenge"
                              >
                                {deletingChallengeId === challenge.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cohort Challenges Section */}
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <button
                    onClick={() => setCohortChallengesOpen(!cohortChallengesOpen)}
                    className="w-full flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span className="font-medium text-sm">Cohort Challenges</span>
                      <span className="text-xs text-muted-foreground">({cohortChallenges.length})</span>
                    </div>
                    {cohortChallengesOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {cohortChallengesOpen && (
                    <div className="p-2">
                      {!tierFeatures.hasTeamAccess ? (
                        <div className="text-center py-4 space-y-2">
                          <Lock className="w-5 h-5 text-muted-foreground mx-auto" />
                          <p className="text-xs text-muted-foreground">Sign up to access cohorts</p>
                          <Link href="/register">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-xs border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                            >
                              <Crown className="w-3 h-3 mr-1" />
                              Start Free Trial
                            </Button>
                          </Link>
                        </div>
                      ) : isLoadingCohorts ? (
                        <div className="text-center py-4">
                          <Loader2 className="w-5 h-5 text-muted-foreground mx-auto animate-spin" />
                          <p className="text-xs text-muted-foreground mt-2">Loading cohorts...</p>
                        </div>
                      ) : cohortChallenges.length === 0 ? (
                        <div className="text-center py-4 space-y-2">
                          <p className="text-sm text-muted-foreground">No cohorts yet</p>
                          {/* Only tutors can create cohorts */}
                          {tierFeatures.canCreateCohorts ? (
                            <Link href="/dashboard/settings">
                              <Button variant="outline" size="sm" className="text-xs">
                                <UserPlus className="w-3 h-3 mr-1" />
                                Create Cohort
                              </Button>
                            </Link>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Ask a tutor to invite you
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {cohortChallenges.map((cohort) => (
                            <Link
                              key={cohort.id}
                              href={`/dashboard/cohort/${cohort.id}`}
                              className="block w-full p-2 rounded-lg text-left transition-all hover:bg-secondary/50"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{cohort.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {cohort.memberCount} members
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {cohort.activeChallenges} active challenges
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Game Zone Section */}
                <Link href="/game" className="block">
                  <div className="rounded-lg border border-red-500/30 overflow-hidden bg-gradient-to-r from-red-500/10 to-orange-500/10 hover:from-red-500/20 hover:to-orange-500/20 transition-all">
                    <div className="w-full flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <Swords className="w-4 h-4 text-red-400" />
                        <span className="font-medium text-sm text-red-400">Game Zone</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">BATTLE</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-yellow-500" />
                        <ChevronRight className="w-4 h-4 text-red-400" />
                      </div>
                    </div>
                  </div>
                </Link>

                {/* System Challenges Section */}
                {/* <div className="rounded-lg border border-border/50 overflow-hidden">
                  <button
                    onClick={() => setSystemChallengesOpen(!systemChallengesOpen)}
                    className="w-full p-3 bg-secondary/30 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span className="font-medium text-sm">System Challenges</span>
                      <span className="text-xs text-muted-foreground">({LOCATIONS.length})</span>
                    </div>
                    <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", systemChallengesOpen && "rotate-90")} />
                  </button>
                  
                  {systemChallengesOpen && (
                    <>
                  {/* Beginner */}
                  {/* {beginnerLocations.length > 0 && (
                    <DifficultySection
                      title="Beginner"
                      locations={beginnerLocations}
                      isOpen={beginnerOpen}
                      onToggle={() => setBeginnerOpen(!beginnerOpen)}
                      selectedLocation={selectedLocation}
                      onLocationSelect={handleLocationSelect}
                      colorClass={difficultyColors.beginner}
                    />
                  )} */}
                  
                  {/* Intermediate */}
                  {/* {intermediateLocations.length > 0 && (
                    <DifficultySection
                      title="Intermediate"
                      locations={intermediateLocations}
                      isOpen={intermediateOpen}
                      onToggle={() => setIntermediateOpen(!intermediateOpen)}
                      selectedLocation={selectedLocation}
                      onLocationSelect={handleLocationSelect}
                      colorClass={difficultyColors.intermediate}
                    />
                  )} */}
                  
                  {/* Advanced */}
                  {/* {advancedLocations.length > 0 && (
                    <DifficultySection
                      title="Advanced"
                      locations={advancedLocations}
                      isOpen={advancedOpen}
                      onToggle={() => setAdvancedOpen(!advancedOpen)}
                      selectedLocation={selectedLocation}
                      onLocationSelect={handleLocationSelect}
                      colorClass={difficultyColors.advanced}
                    />
                  )} */}
                  
                  {/* Expert */}
                  {/* {expertLocations.length > 0 && (
                    <DifficultySection
                      title="Expert"
                      locations={expertLocations}
                      isOpen={expertOpen}
                      onToggle={() => setExpertOpen(!expertOpen)}
                      selectedLocation={selectedLocation}
                      onLocationSelect={handleLocationSelect}
                      colorClass={difficultyColors.expert}
                    />
                  )} */}
                    {/* </>
                  )}
                </div> */}

                {/* How to Use Guide */}
                <div className="rounded-lg border border-border/50 overflow-hidden bg-secondary/20">
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <HelpCircle className="w-4 h-4 text-cyan-400" />
                      <span className="font-medium text-sm text-cyan-400">How to Use</span>
                    </div>
                    
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex gap-2">
                        <span className="text-cyan-400 font-bold">1.</span>
                        <p>Click anywhere on the globe to explore different locations around the world</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <span className="text-cyan-400 font-bold">2.</span>
                        <p>Search for any real business to create a custom AWS architecture challenge</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <span className="text-cyan-400 font-bold">3.</span>
                        <p>Your challenges appear in <span className="text-cyan-400">User Challenges</span> - click to resume anytime</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <span className="text-red-400 font-bold">4.</span>
                        <p>Visit <span className="text-red-400">Game Zone</span> for quick practice battles and leaderboard competitions</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Journey Path */}
            {visitedLocations.length > 1 && (
              <div className="p-4 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-2">Your Journey</div>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {visitedLocations.map((id, index) => {
                    const loc = LOCATIONS.find((l) => l.id === id);
                    return (
                      <div key={id} className="flex items-center">
                        <div className="text-lg">{loc?.icon}</div>
                        {index < visitedLocations.length - 1 && (
                          <ChevronRight className="w-3 h-3 text-muted-foreground mx-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Custom Challenge Creator - Only shows when in satellite view (zoomed into a location) */}
            {mapView === "satellite" && targetCoords && (
              <div className="p-4 border-t border-border/50 bg-background/50">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium text-sm">Create Custom Challenge</span>
                </div>
                
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      placeholder="Search business name..."
                      value={customBusinessName}
                      onChange={async (e) => {
                        setCustomBusinessName(e.target.value);
                        // Auto-search Google Places when typing
                        if (e.target.value.length > 2 && targetCoords) {
                          try {
                            const res = await fetch(
                              `/api/places/search?query=${encodeURIComponent(e.target.value)}&lat=${targetCoords.lat}&lng=${targetCoords.lng}`
                            );
                            const data = await res.json();
                            if (data.results) {
                              setCustomSearchResults(data.results);
                            }
                          } catch (err) {
                            console.error("Search failed:", err);
                          }
                        } else {
                          setCustomSearchResults([]);
                        }
                      }}
                      className="bg-secondary/50 text-sm h-9"
                    />
                    {/* Search Results Dropdown */}
                    {customSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        {customSearchResults.map((result: { place_id: string; name: string; vicinity: string; types: string[] }) => (
                          <button
                            key={result.place_id}
                            className="w-full px-3 py-2 text-left hover:bg-secondary/50 text-sm border-b border-border/50 last:border-0"
                            onClick={() => {
                              setCustomBusinessName(result.name);
                              setCustomBusinessAddress(result.vicinity);
                              // Auto-detect industry from types
                              const industry = detectIndustry(result.types);
                              setCustomBusinessIndustry(industry);
                              setCustomSearchResults([]);
                            }}
                          >
                            <div className="font-medium truncate">{result.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{result.vicinity}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Address - Auto-filled, read-only */}
                  <div className="px-3 py-2 rounded-md bg-secondary/30 border border-input text-sm text-muted-foreground">
                    {customBusinessAddress || "Address auto-fills when you select a business"}
                  </div>
                  
                  {/* Industry - Auto-detected */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/30 border border-input text-sm">
                    <span>{getIndustryIcon(customBusinessIndustry)}</span>
                    <span>{customBusinessIndustry || "Industry auto-detected"}</span>
                  </div>
                  
                  {/* Show selected cert */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-sm">
                    <Target className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-400">{certifications.find(c => c.code === selectedCert)?.name || selectedCert}</span>
                  </div>
                  
                  {/* Skill Level Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Skill Level:</span>
                    <select
                      value={selectedSkillLevel}
                      onChange={(e) => handleSkillLevelChange(e.target.value as "beginner" | "intermediate" | "advanced" | "expert")}
                      className={cn(
                        "text-xs px-2 py-1 rounded-full border cursor-pointer appearance-none pr-6 [&>option]:bg-zinc-900 [&>option]:text-white",
                        selectedSkillLevel === "beginner" && "border-green-500/50 bg-green-500/20 text-green-400",
                        selectedSkillLevel === "intermediate" && "border-amber-500/50 bg-amber-500/20 text-amber-400",
                        selectedSkillLevel === "advanced" && "border-orange-500/50 bg-orange-500/20 text-orange-400",
                        selectedSkillLevel === "expert" && "border-red-500/50 bg-red-500/20 text-red-400"
                      )}
                    >
                      <option value="beginner" className="bg-zinc-900 text-green-400">Beginner</option>
                      <option value="intermediate" className="bg-zinc-900 text-amber-400">Intermediate</option>
                      <option value="advanced" className="bg-zinc-900 text-orange-400">Advanced</option>
                      <option value="expert" className="bg-zinc-900 text-red-400">Expert</option>
                    </select>
                  </div>
                  
                  {/* Error message */}
                  {generationError && (
                    <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-md">
                      {generationError}
                    </div>
                  )}
                  
                  {!tierFeatures.canStartChallenges ? (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => setShowUpgradeModal(true)}
                    >
                      <Crown className="w-4 h-4" />
                      Upgrade to Start
                    </Button>
                  ) : (
                    <Button 
                      variant="glow" 
                      className="w-full gap-2"
                      disabled={!customBusinessName.trim() || !customBusinessAddress.trim() || !settingsLoaded}
                      onClick={() => {
                        // Extract country from custom address (last part after comma)
                        const addressParts = customBusinessAddress.split(',');
                        const customCountry = addressParts.length > 0 ? addressParts[addressParts.length - 1].trim() : undefined;
                        setGenerationTarget({
                          businessName: customBusinessName,
                          industry: customBusinessIndustry,
                          latitude: targetCoords?.lat,
                          longitude: targetCoords?.lng,
                          country: customCountry,
                          skillLevel: selectedSkillLevel,
                        });
                        setShowGenerationModal(true);
                      }}
                    >
                      <Zap className="w-4 h-4" />
                      Create Challenge
                    </Button>
                  )}
                </div>
              </div>
            )}
        </>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative h-full">
        {/* Map Controls - Back to Globe button when zoomed in */}
        {mapView !== "globe" && !selectedLocation && (
          <div className="absolute top-4 right-4 z-[1000]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMapView("globe");
                setZoomLevel(2);
                setSelectedLocation(null);
              }}
              className="gap-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            >
              <Globe className="w-4 h-4" />
              Back to Globe
            </Button>
          </div>
        )}

        {/* Back Button when zoomed in */}
        {selectedLocation && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToGlobe}
            className="absolute top-4 left-4 z-[1000] gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Globe
          </Button>
        )}

        {/* Industry Legend - only shows in satellite view */}
        {mapView === "satellite" && (
          <div className="absolute bottom-4 left-4 z-20 bg-background/80 backdrop-blur-sm rounded-lg p-2 border border-border/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground font-medium">Industries</span>
              <span className="text-[9px] text-muted-foreground/60 italic">Click to filter</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {[
                { name: "Finance", color: "#22d3ee" },
                { name: "Healthcare", color: "#4ade80" },
                { name: "Technology", color: "#a78bfa" },
                { name: "Retail", color: "#fbbf24" },
                { name: "Hospitality", color: "#f87171" },
                { name: "Automotive", color: "#fb923c" },
                { name: "Education", color: "#60a5fa" },
                { name: "Aviation", color: "#2dd4bf" },
              ].map(({ name, color }) => (
                <button
                  key={name}
                  onClick={() => toggleIndustry(name)}
                  className={cn(
                    "flex items-center gap-1.5 transition-opacity cursor-pointer",
                    activeIndustries.has(name) ? "opacity-100" : "opacity-30"
                  )}
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: activeIndustries.has(name) ? color : "#666" }}
                  />
                  <span className="text-[10px]">{name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* The Map - 3D Globe and Leaflet Satellite (both mounted, crossfade) */}
        <div className={cn(
          "absolute inset-0 transition-opacity duration-500",
          mapView === "globe" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
        )}>
          <Globe3D
            locations={LOCATIONS}
            selectedLocation={selectedLocation}
            onLocationSelect={handleLocationSelect}
            visitedLocations={visitedLocations}
            onZoomIn={handleGlobeZoomIn}
          />
        </div>
        <div className={cn(
          "absolute inset-0 transition-opacity duration-500",
          mapView === "satellite" && targetCoords ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
        )}>
          <WorldMap
            locations={LOCATIONS}
            selectedLocation={selectedLocation}
            onLocationSelect={handleLocationSelect}
            visitedLocations={visitedLocations}
            mapView={mapView}
            zoomLevel={zoomLevel}
            onZoomOut={handleBackToGlobe}
            center={targetCoords}
            onBusinessSelect={setSelectedBusiness}
            selectedBusiness={selectedBusiness}
            activeIndustries={activeIndustries}
          />
        </div>

        {/* Location Detail Panel */}
        {selectedLocation && (
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[1000]">
            <Card className="bg-background/95 backdrop-blur-xl border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{selectedLocation.icon}</div>
                    <div>
                      <CardTitle className="text-lg">{selectedLocation.company}</CardTitle>
                      <p className="text-sm text-muted-foreground">{selectedLocation.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLocation(null)}
                    className="p-1 hover:bg-secondary rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Difficulty & Industry */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full border",
                    difficultyColors[selectedLocation.difficulty].bg,
                    difficultyColors[selectedLocation.difficulty].text,
                    difficultyColors[selectedLocation.difficulty].border
                  )}>
                    {selectedLocation.difficulty.charAt(0).toUpperCase() + selectedLocation.difficulty.slice(1)}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                    {selectedLocation.industry}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground">
                  {selectedLocation.description}
                </p>

                {/* Compliance Tags */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Compliance Requirements</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedLocation.compliance.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Progress */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedLocation.completed}/{selectedLocation.challenges} Challenges</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>~2h</span>
                  </div>
                </div>

                {/* Action Button */}
                {selectedLocation.locked ? (
                  <Button disabled className="w-full gap-2">
                    <Lock className="w-4 h-4" />
                    Complete Previous Challenges to Unlock
                  </Button>
                ) : !tierFeatures.canStartChallenges ? (
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    <Crown className="w-4 h-4" />
                    Upgrade to Start
                  </Button>
                ) : (
                  <Link href={`/challenge/${selectedLocation.id}`}>
                    <Button variant="glow" className="w-full gap-2">
                      <Zap className="w-4 h-4" />
                      Start Challenge
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Business Detail Panel - for Google Places businesses */}
        {selectedBusiness && !selectedLocation && (() => {
          // Get industry color for icon background
          const getIndustryColor = (types: string[]): string => {
            for (const type of types) {
              if (["bank", "finance", "atm", "accounting", "insurance_agency"].includes(type)) return "#22d3ee";
              if (["hospital", "doctor", "health", "dentist", "pharmacy"].includes(type)) return "#4ade80";
              if (["restaurant", "food", "cafe", "bar", "bakery", "hotel", "lodging", "spa", "beauty_salon", "gym"].includes(type)) return "#f87171";
              if (["store", "shopping_mall", "clothing_store", "supermarket"].includes(type)) return "#fbbf24";
              if (["electronics_store", "computer_store"].includes(type)) return "#a78bfa";
              if (["car_dealer", "car_rental", "car_repair", "car_wash", "gas_station"].includes(type)) return "#fb923c";
              if (["school", "university", "library"].includes(type)) return "#60a5fa";
              if (["lawyer", "real_estate_agency"].includes(type)) return "#f472b6";
              if (["travel_agency", "airport"].includes(type)) return "#2dd4bf";
            }
            return "#22d3ee";
          };
          
          const getIndustry = (types: string[]): string => {
            for (const type of types) {
              if (["bank", "finance", "atm", "accounting", "insurance_agency"].includes(type)) return "Banking & Finance";
              if (["hospital", "doctor", "dentist", "pharmacy", "health"].includes(type)) return "Healthcare";
              if (["restaurant", "cafe", "bar", "bakery", "food"].includes(type)) return "Hospitality";
              if (["hotel", "lodging", "spa", "gym", "beauty_salon"].includes(type)) return "Hospitality";
              if (["store", "shopping_mall", "clothing_store", "supermarket"].includes(type)) return "Retail";
              if (["electronics_store", "computer_store"].includes(type)) return "Technology";
              if (["car_dealer", "car_rental", "car_repair", "gas_station"].includes(type)) return "Automotive";
              if (["school", "university", "library"].includes(type)) return "Education";
              if (["lawyer", "real_estate_agency", "accounting"].includes(type)) return "Professional Services";
              if (["travel_agency", "airport"].includes(type)) return "Aviation";
            }
            return "Business";
          };
          
          const businessIndustry = getIndustry(selectedBusiness.types);
          const industryColor = getIndustryColor(selectedBusiness.types);
          
          return (
            <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[1000]">
              <Card className="bg-background/95 backdrop-blur-xl border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Google Places photo */}
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: `${industryColor}20` }}
                      >
                        {selectedBusiness.photo ? (
                          <img 
                            src={selectedBusiness.photo} 
                            alt={selectedBusiness.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-6 h-6" style={{ color: industryColor }} />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{selectedBusiness.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{selectedBusiness.address}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedBusiness(null)}
                      className="p-1 hover:bg-secondary rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Industry Tag & Rating */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                      {businessIndustry}
                    </span>
                    {selectedBusiness.rating && (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center gap-1">
                        ★ {selectedBusiness.rating}
                      </span>
                    )}
                  </div>

                  {/* Description - AI will generate this */}
                  <p className="text-sm text-muted-foreground">
                    Create a cloud migration challenge for {selectedBusiness.name}. 
                    The AI will research this business and generate realistic scenarios.
                  </p>

                  {/* Show selected cert */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-sm">
                    <Target className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-400">{certifications.find(c => c.code === selectedCert)?.name || selectedCert}</span>
                  </div>

                  {/* Error message */}
                  {generationError && (
                    <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-md">
                      {generationError}
                    </div>
                  )}

                  {/* Action Button - same logic as system challenges */}
                  {!tierFeatures.canStartChallenges ? (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => setShowUpgradeModal(true)}
                    >
                      <Crown className="w-4 h-4" />
                      Upgrade to Start
                    </Button>
                  ) : (
                    <Button 
                      variant="glow" 
                      className="w-full gap-2"
                      disabled={!settingsLoaded}
                      onClick={() => {
                        const industry = selectedBusiness?.types ? detectIndustry(selectedBusiness.types) : "Technology";
                        // Extract country from address (last part after comma)
                        const addressParts = selectedBusiness?.address?.split(',') || [];
                        const country = addressParts.length > 0 ? addressParts[addressParts.length - 1].trim() : undefined;
                        setGenerationTarget({
                          businessName: selectedBusiness?.name || "",
                          industry: industry,
                          latitude: selectedBusiness?.lat,
                          longitude: selectedBusiness?.lng,
                          country: country,
                          skillLevel: selectedSkillLevel,
                        });
                        setShowGenerationModal(true);
                        setSelectedBusiness(null); // Close the business card
                      }}
                    >
                      <Zap className="w-4 h-4" />
                      Create Challenge
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {/* Upgrade Modal */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                {upgradeInfo.title}
              </DialogTitle>
              <DialogDescription>
                {upgradeInfo.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                <p className="font-semibold text-lg mb-1">Learner Plan - $19/mo</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Unlimited challenges</li>
                  <li>✓ AI coaching & feedback</li>
                  <li>✓ Flashcards & quizzes</li>
                  <li>✓ Progress tracking</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowUpgradeModal(false)}>
                  Maybe Later
                </Button>
                <Link href="/pricing" className="flex-1">
                  <Button variant="glow" className="w-full">
                    View Plans
                  </Button>
                </Link>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Scenario Generation Modal */}
        {generationTarget && (
          <ScenarioGenerationModal
            isOpen={showGenerationModal}
            onClose={() => {
              setShowGenerationModal(false);
              setGenerationTarget(null);
              // Clear custom form after successful generation
              setCustomBusinessName("");
              setCustomBusinessAddress("");
              setCustomBusinessIndustry("Technology");
            }}
            businessName={generationTarget.businessName}
            industry={generationTarget.industry}
            certCode={selectedCert}
            certName={certifications.find(c => c.code === selectedCert)?.name || selectedCert}
            userLevel={generationTarget.skillLevel || "intermediate"}
            latitude={generationTarget.latitude}
            longitude={generationTarget.longitude}
            country={generationTarget.country}
            apiKey={userApiKey}
            preferredModel={preferredModel}
            onQuiz={async (scenario) => {
              const scenarioId = (scenario as { id?: string }).id;
              if (!scenarioId) {
                alert("Scenario ID not found. Please accept the challenge first.");
                return;
              }
              
              try {
                const response = await fetch("/api/quiz", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    scenarioId,
                    questionCount: 10,
                  }),
                });
                
                const data = await response.json();
                
                if (response.ok) {
                  router.push("/learn/quiz");
                } else {
                  alert(`Failed to generate quiz: ${data.error || "Unknown error"}`);
                }
              } catch (error) {
                console.error("Error generating quiz:", error);
                alert("Failed to generate quiz. Check console for details.");
              }
            }}
            onNotes={(scenario, companyInfo) => {
              console.log("Generate notes for:", scenario, companyInfo);
              // TODO: Navigate to notes generation
            }}
            onFlashcards={(scenario, companyInfo) => {
              console.log("Generate flashcards for:", scenario, companyInfo);
              // TODO: Navigate to flashcards generation
            }}
            onCoach={(scenario, companyInfo) => {
              console.log("Start coaching for:", scenario, companyInfo);
              // TODO: Navigate to AI coach
            }}
            onChallengeStart={(data) => {
              // Close generation modal and open challenge workspace at page level
              setShowGenerationModal(false);
              setGenerationTarget(null);
              setNewChallengeData(data);
              // Also reset map state so Back to Globe doesn't show
              setSelectedLocation(null);
              setMapView("globe");
            }}
          />
        )}

        {/* Resume Challenge Modal */}
        {resumeChallenge && (
          <ChallengeWorkspaceModal
            isOpen={!!resumeChallenge}
            onClose={() => {
              setResumeChallenge(null);
              setResumeChallengeIndex(0);
              // Refresh user challenges to get updated progress
              fetch("/api/user/challenges")
                .then(res => res.json())
                .then(data => setUserChallenges(data.challenges || []))
                .catch(console.error);
            }}
            challenge={{
              id: resumeChallenge.challenges[resumeChallengeIndex].id,
              title: resumeChallenge.challenges[resumeChallengeIndex].title,
              description: resumeChallenge.challenges[resumeChallengeIndex].description,
              difficulty: resumeChallenge.challenges[resumeChallengeIndex].difficulty,
              points: resumeChallenge.challenges[resumeChallengeIndex].points,
              hints: resumeChallenge.challenges[resumeChallengeIndex].hints,
              success_criteria: resumeChallenge.challenges[resumeChallengeIndex].successCriteria,
              aws_services_relevant: resumeChallenge.challenges[resumeChallengeIndex].awsServices,
              estimated_time_minutes: resumeChallenge.challenges[resumeChallengeIndex].estimatedMinutes,
            }}
            scenario={{
              scenario_title: resumeChallenge.scenario.title,
              scenario_description: resumeChallenge.scenario.description,
              business_context: resumeChallenge.scenario.description,
              company_name: resumeChallenge.location.company,
            }}
            companyInfo={resumeChallenge.scenario.companyInfo}
            challengeIndex={resumeChallengeIndex}
            totalChallenges={resumeChallenge.challenges.length}
            onNextChallenge={() => {
              if (resumeChallengeIndex < resumeChallenge.challenges.length - 1) {
                setResumeChallengeIndex(prev => prev + 1);
              }
            }}
            onPrevChallenge={() => {
              if (resumeChallengeIndex > 0) {
                setResumeChallengeIndex(prev => prev - 1);
              }
            }}
            apiKey={userApiKey}
            preferredModel={preferredModel}
            certCode={selectedCert}
            userLevel={selectedSkillLevel}
            industry={resumeChallenge.location.industry}
            scenarioId={resumeChallenge.scenarioId}
            attemptId={resumeChallenge.id}
          />
        )}

        {/* New Challenge Modal (from ScenarioGenerationModal) */}
        {newChallengeData && (
          <ChallengeWorkspaceModal
            isOpen={!!newChallengeData}
            onClose={() => {
              setNewChallengeData(null);
              // Refresh user challenges to get the new challenge in the list
              fetch("/api/user/challenges")
                .then(res => res.json())
                .then(data => setUserChallenges(data.challenges || []))
                .catch(console.error);
            }}
            challenge={{
              id: newChallengeData.challenge.id,
              title: newChallengeData.challenge.title,
              description: newChallengeData.challenge.description,
              difficulty: newChallengeData.challenge.difficulty,
              points: newChallengeData.challenge.points,
              hints: newChallengeData.challenge.hints,
              success_criteria: newChallengeData.challenge.success_criteria,
              aws_services_relevant: newChallengeData.challenge.aws_services_relevant,
              estimated_time_minutes: newChallengeData.challenge.estimated_time_minutes,
            }}
            scenario={newChallengeData.scenario}
            companyInfo={newChallengeData.companyInfo}
            challengeIndex={newChallengeData.challengeIndex}
            totalChallenges={newChallengeData.totalChallenges}
            onNextChallenge={() => {
              if (newChallengeData.challengeIndex < newChallengeData.totalChallenges - 1) {
                const nextIndex = newChallengeData.challengeIndex + 1;
                setNewChallengeData({
                  ...newChallengeData,
                  challengeIndex: nextIndex,
                  challenge: newChallengeData.allChallenges[nextIndex],
                });
              }
            }}
            onPrevChallenge={() => {
              if (newChallengeData.challengeIndex > 0) {
                const prevIndex = newChallengeData.challengeIndex - 1;
                setNewChallengeData({
                  ...newChallengeData,
                  challengeIndex: prevIndex,
                  challenge: newChallengeData.allChallenges[prevIndex],
                });
              }
            }}
            apiKey={userApiKey}
            preferredModel={preferredModel}
            certCode={selectedCert}
            userLevel={selectedSkillLevel}
            industry={generationTarget?.industry}
            scenarioId={newChallengeData.scenarioId}
            attemptId={newChallengeData.attemptId}
          />
        )}
      </div>
      </div>
    </div>
  );
}
