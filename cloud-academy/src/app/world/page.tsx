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

// Sample locations - Real companies with ACTUAL HQ coordinates
const LOCATIONS: Location[] = [
  // ========== BEGINNER ==========
  // Mailchimp - Atlanta (Ponce City Market, 675 Ponce De Leon Ave NE)
  {
    id: "mailchimp-atlanta",
    name: "Mailchimp HQ",
    company: "Mailchimp",
    industry: "Technology",
    lat: 33.7725,
    lng: -84.3655,
    difficulty: "beginner",
    challenges: 3,
    completed: 0,
    locked: false,
    description: "Build a simple email campaign storage system with S3 and basic Lambda triggers for notifications.",
    compliance: ["CAN-SPAM", "GDPR Basics"],
    icon: "💻",
  },
  // Shopify - Ottawa (150 Elgin Street)
  {
    id: "shopify-ottawa",
    name: "Shopify HQ",
    company: "Shopify",
    industry: "E-Commerce",
    lat: 45.4208,
    lng: -75.6901,
    difficulty: "beginner",
    challenges: 4,
    completed: 0,
    locked: false,
    description: "Create a simple product catalog API with DynamoDB and API Gateway for a small online store.",
    compliance: ["PCI-DSS Basics"],
    icon: "🛍️",
  },
  // Canva - Sydney (110 Kippax Street, Surry Hills)
  {
    id: "canva-sydney",
    name: "Canva HQ",
    company: "Canva",
    industry: "Technology",
    lat: -33.8837,
    lng: 151.2086,
    difficulty: "beginner",
    challenges: 3,
    completed: 0,
    locked: false,
    description: "Design an image asset storage system with S3, CloudFront CDN, and basic access controls.",
    compliance: ["Basic Security"],
    icon: "💻",
  },
  // Atlassian/Trello - Sydney (341 George Street - Atlassian owns Trello)
  {
    id: "trello-sydney",
    name: "Atlassian HQ",
    company: "Trello",
    industry: "Technology",
    lat: -33.8651,
    lng: 151.2070,
    difficulty: "beginner",
    challenges: 3,
    completed: 0,
    locked: false,
    description: "Build a simple task board backend with DynamoDB and WebSocket API for real-time updates.",
    compliance: ["SOC 2 Basics"],
    icon: "💻",
  },
  
  // ========== INTERMEDIATE & ADVANCED ==========
  // HSBC - London (8 Canada Square, Canary Wharf)
  {
    id: "hsbc-london",
    name: "HSBC Tower",
    company: "HSBC",
    industry: "Banking & Finance",
    lat: 51.5049,
    lng: -0.0183,
    difficulty: "advanced",
    challenges: 8,
    completed: 0,
    locked: false,
    description: "Design a multi-region, PCI-DSS compliant banking infrastructure with real-time transaction processing.",
    compliance: ["PCI-DSS", "GDPR", "FCA"],
    icon: "🏦",
  },
  // Barclays - London (1 Churchill Place, Canary Wharf)
  {
    id: "barclays-canary",
    name: "Barclays HQ",
    company: "Barclays",
    industry: "Banking & Finance",
    lat: 51.5050,
    lng: -0.0155,
    difficulty: "advanced",
    challenges: 6,
    completed: 0,
    locked: false,
    description: "Build a secure trading platform with sub-millisecond latency and disaster recovery.",
    compliance: ["PCI-DSS", "MiFID II", "GDPR"],
    icon: "🏦",
  },
  // NHS Digital - Leeds (7 & 8 Wellington Place)
  {
    id: "nhs-leeds",
    name: "NHS Digital",
    company: "NHS",
    industry: "Healthcare",
    lat: 53.7960,
    lng: -1.5511,
    difficulty: "expert",
    challenges: 10,
    completed: 0,
    locked: false,
    description: "Architect a nationwide health records system with strict data sovereignty and HIPAA-equivalent compliance.",
    compliance: ["NHS DSPT", "GDPR", "ISO 27001"],
    icon: "🏥",
  },
  // Google - Mountain View (1600 Amphitheatre Parkway)
  {
    id: "google-mv",
    name: "Googleplex",
    company: "Google",
    industry: "Technology",
    lat: 37.4220,
    lng: -122.0841,
    difficulty: "expert",
    challenges: 12,
    completed: 0,
    locked: true,
    description: "Design a planet-scale search infrastructure handling billions of queries per day.",
    compliance: ["SOC 2", "ISO 27001", "CCPA"],
    icon: "💻",
  },
  // Meta - Menlo Park (1 Hacker Way)
  {
    id: "meta-menlo",
    name: "Meta HQ",
    company: "Meta",
    industry: "Technology",
    lat: 37.4845,
    lng: -122.1477,
    difficulty: "expert",
    challenges: 10,
    completed: 0,
    locked: true,
    description: "Build a real-time social graph with billions of connections and instant updates.",
    compliance: ["GDPR", "CCPA", "SOC 2"],
    icon: "💻",
  },
  // Amazon - Seattle (410 Terry Ave N, Day 1 Building)
  {
    id: "amazon-seattle",
    name: "Amazon HQ",
    company: "Amazon",
    industry: "E-Commerce",
    lat: 47.6222,
    lng: -122.3369,
    difficulty: "advanced",
    challenges: 8,
    completed: 0,
    locked: false,
    description: "Design a global e-commerce platform handling Black Friday scale traffic.",
    compliance: ["PCI-DSS", "SOC 2", "GDPR"],
    icon: "🛒",
  },
  // Netflix - Los Gatos (100 Winchester Circle)
  {
    id: "netflix-losgatos",
    name: "Netflix HQ",
    company: "Netflix",
    industry: "Technology",
    lat: 37.2614,
    lng: -121.9577,
    difficulty: "advanced",
    challenges: 7,
    completed: 0,
    locked: false,
    description: "Architect a global content delivery network for 4K streaming to 200M+ subscribers.",
    compliance: ["SOC 2", "MPAA"],
    icon: "💻",
  },
  // Nintendo - Kyoto (11-1 Kamitoba Hokotate-cho, Minami-ku)
  {
    id: "nintendo-kyoto",
    name: "Nintendo HQ",
    company: "Nintendo",
    industry: "Technology",
    lat: 34.9697,
    lng: 135.7544,
    difficulty: "intermediate",
    challenges: 5,
    completed: 0,
    locked: false,
    description: "Build a low-latency multiplayer gaming infrastructure for millions of concurrent players.",
    compliance: ["APPI", "SOC 2"],
    icon: "💻",
  },
  // BMW - Munich (BMW Welt, Am Olympiapark 1)
  {
    id: "bmw-munich",
    name: "BMW Welt",
    company: "BMW",
    industry: "Automotive",
    lat: 48.1770,
    lng: 11.5562,
    difficulty: "intermediate",
    challenges: 6,
    completed: 0,
    locked: false,
    description: "Design IoT infrastructure for connected vehicles with real-time telemetry.",
    compliance: ["GDPR", "ISO 27001", "TISAX"],
    icon: "🚗",
  },
  // DBS Bank - Singapore (Marina Bay Financial Centre Tower 3)
  {
    id: "dbs-singapore",
    name: "DBS Bank Tower",
    company: "DBS Bank",
    industry: "Banking & Finance",
    lat: 1.2789,
    lng: 103.8540,
    difficulty: "advanced",
    challenges: 7,
    completed: 0,
    locked: false,
    description: "Build a digital banking platform for Southeast Asia with multi-currency support.",
    compliance: ["MAS TRM", "PCI-DSS", "PDPA"],
    icon: "🏦",
  },
  // Emirates - Dubai (Emirates Group HQ, Airport Road)
  {
    id: "emirates-dubai",
    name: "Emirates HQ",
    company: "Emirates",
    industry: "Aviation",
    lat: 25.2528,
    lng: 55.3644,
    difficulty: "intermediate",
    challenges: 5,
    completed: 0,
    locked: false,
    description: "Design a real-time flight operations system with global coverage.",
    compliance: ["IATA", "GDPR"],
    icon: "✈️",
  },
  // LVMH - Paris (22 Avenue Montaigne)
  {
    id: "lvmh-paris",
    name: "LVMH Tower",
    company: "LVMH",
    industry: "Retail",
    lat: 48.8661,
    lng: 2.3044,
    difficulty: "intermediate",
    challenges: 4,
    completed: 0,
    locked: false,
    description: "Build a global luxury e-commerce platform with personalized experiences.",
    compliance: ["GDPR", "PCI-DSS"],
    icon: "👜",
  },
];

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
    // Switch to satellite view when zooming in
    setMapView("satellite");
    setZoomLevel(15);
  }, [visitedLocations]);

  // Handle back to globe
  const handleBackToGlobe = useCallback(() => {
    setSelectedLocation(null);
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
  const [selectedCert, setSelectedCert] = useState("solutions-architect-associate"); // Default to Solutions Architect Associate
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
  
  // Available certifications - using full IDs that match backend
  const certifications = [
    // Foundational
    { code: "cloud-practitioner", name: "Cloud Practitioner", level: "foundational" },
    { code: "ai-practitioner", name: "AI Practitioner", level: "foundational" },
    // Associate
    { code: "solutions-architect-associate", name: "Solutions Architect Associate", level: "associate" },
    { code: "developer-associate", name: "Developer Associate", level: "associate" },
    { code: "sysops-associate", name: "SysOps Administrator Associate", level: "associate" },
    { code: "data-engineer-associate", name: "Data Engineer Associate", level: "associate" },
    { code: "machine-learning-engineer-associate", name: "ML Engineer Associate", level: "associate" },
    // Professional
    { code: "solutions-architect-professional", name: "Solutions Architect Professional", level: "professional" },
    { code: "devops-professional", name: "DevOps Engineer Professional", level: "professional" },
    // Specialty
    { code: "networking-specialty", name: "Advanced Networking Specialty", level: "specialty" },
    { code: "security-specialty", name: "Security Specialty", level: "specialty" },
    { code: "machine-learning-specialty", name: "Machine Learning Specialty", level: "specialty" },
    { code: "sap-specialty", name: "SAP on AWS Specialty", level: "specialty" },
  ];
  
  // User's API key for generation
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [preferredModel, setPreferredModel] = useState<string | null>(null);
  
  // Fetch target cert, skill level, and API key from database on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Fetch cert and skill level from profile
        const certRes = await fetch("/api/profile/certification");
        const certData = await certRes.json();
        if (certData.targetCertification) {
          setSelectedCert(certData.targetCertification);
        }
        if (certData.skillLevel) {
          setSelectedSkillLevel(certData.skillLevel as "beginner" | "intermediate" | "advanced" | "expert");
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
      }
    };
    fetchSettings();
  }, []);
  
  // Save cert to database when changed
  const handleCertChange = async (certCode: string) => {
    setSelectedCert(certCode);
    try {
      await fetch("/api/profile/certification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certCode }),
      });
    } catch (err) {
      console.error("Failed to save cert:", err);
    }
  };
  
  // Save skill level to database when changed
  const handleSkillLevelChange = async (level: "beginner" | "intermediate" | "advanced" | "expert") => {
    setSelectedSkillLevel(level);
    try {
      await fetch("/api/profile/certification", {
        method: "PUT",
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
    
    // Switch to satellite view with a nice overview zoom (not street level)
    setMapView("satellite");
    setZoomLevel(13); // City/district overview level
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
                  <optgroup label="Associate" className="bg-slate-800 text-white">
                    {certifications.filter(c => c.level === "associate").map(cert => (
                      <option key={cert.code} value={cert.code} className="bg-slate-800 text-white py-2">{cert.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Professional" className="bg-slate-800 text-white">
                    {certifications.filter(c => c.level === "professional").map(cert => (
                      <option key={cert.code} value={cert.code} className="bg-slate-800 text-white py-2">{cert.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Specialty" className="bg-slate-800 text-white">
                    {certifications.filter(c => c.level === "specialty").map(cert => (
                      <option key={cert.code} value={cert.code} className="bg-slate-800 text-white py-2">{cert.name}</option>
                    ))}
                  </optgroup>
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
                      disabled={!customBusinessName.trim() || !customBusinessAddress.trim()}
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
          mapView === "satellite" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
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
                  {/* Skill Level Selector & Industry Tag */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={selectedSkillLevel}
                      onChange={(e) => setSelectedSkillLevel(e.target.value as "beginner" | "intermediate" | "advanced" | "expert")}
                      className={cn(
                        "text-xs px-2 py-1 rounded-full border cursor-pointer appearance-none pr-6 [&>option]:bg-zinc-900 [&>option]:text-white",
                        selectedSkillLevel === "beginner" && "border-green-500/50 bg-green-500/20 text-green-400",
                        selectedSkillLevel === "intermediate" && "border-amber-500/50 bg-amber-500/20 text-amber-400",
                        selectedSkillLevel === "advanced" && "border-orange-500/50 bg-orange-500/20 text-orange-400",
                        selectedSkillLevel === "expert" && "border-red-500/50 bg-red-500/20 text-red-400"
                      )}
                      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 4px center", backgroundSize: "12px" }}
                    >
                      <option value="beginner" className="bg-zinc-900 text-green-400">Beginner</option>
                      <option value="intermediate" className="bg-zinc-900 text-amber-400">Intermediate</option>
                      <option value="advanced" className="bg-zinc-900 text-orange-400">Advanced</option>
                      <option value="expert" className="bg-zinc-900 text-red-400">Expert</option>
                    </select>
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
            userLevel={resumeChallenge.scenario.difficulty}
            industry={resumeChallenge.location.industry}
            scenarioId={resumeChallenge.scenarioId}
            attemptId={resumeChallenge.id}
          />
        )}
      </div>
      </div>
    </div>
  );
}
