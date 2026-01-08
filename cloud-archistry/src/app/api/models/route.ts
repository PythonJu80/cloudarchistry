import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDecryptedApiKey } from "@/lib/academy/services/api-keys";

// In-memory cache for models (per user)
const modelsCache = new Map<string, { models: Model[]; expiresAt: number }>();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface Model {
  id: string;
  name: string;
  description: string;
  context_window?: number;
}

// Map of model IDs to friendly names and descriptions
const MODEL_INFO: Record<string, { name: string; description: string }> = {
  "gpt-4.1": { name: "GPT-4.1", description: "Latest and most capable" },
  "gpt-4.1-mini": { name: "GPT-4.1 Mini", description: "Fast and affordable" },
  "gpt-4.1-nano": { name: "GPT-4.1 Nano", description: "Ultra-fast, lightweight" },
  "gpt-4o": { name: "GPT-4o", description: "Fast and intelligent" },
  "gpt-4o-mini": { name: "GPT-4o Mini", description: "Cost-effective" },
  "gpt-4-turbo": { name: "GPT-4 Turbo", description: "High performance" },
  "gpt-4-turbo-preview": { name: "GPT-4 Turbo Preview", description: "Preview features" },
  "gpt-4": { name: "GPT-4", description: "Original GPT-4" },
  "gpt-3.5-turbo": { name: "GPT-3.5 Turbo", description: "Fast and affordable" },
  "o1": { name: "O1", description: "Advanced reasoning" },
  "o1-mini": { name: "O1 Mini", description: "Efficient reasoning" },
  "o1-preview": { name: "O1 Preview", description: "Preview reasoning model" },
  "o3-mini": { name: "O3 Mini", description: "Latest reasoning model" },
};

// Models we want to show - chat completion models
const ALLOWED_MODEL_PREFIXES = ["gpt-5", "gpt-4", "gpt-3.5", "o1", "o3", "o4"];

function isAllowedModel(modelId: string): boolean {
  return ALLOWED_MODEL_PREFIXES.some(prefix => modelId.startsWith(prefix)) &&
    !modelId.includes("instruct") &&
    !modelId.includes("vision") &&
    !modelId.includes("audio") &&
    !modelId.includes("realtime") &&
    !modelId.includes("search") &&
    !modelId.includes("embedding");
}

function getModelInfo(modelId: string): { name: string; description: string } {
  if (MODEL_INFO[modelId]) {
    return MODEL_INFO[modelId];
  }
  // Generate a friendly name for unknown models
  const name = modelId
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { name, description: "OpenAI model" };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to view models" },
        { status: 401 }
      );
    }

    const profileId = session.user.academyProfileId;

    // Check cache first
    const cached = modelsCache.get(profileId);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({
        models: cached.models,
        cached: true,
        expiresAt: new Date(cached.expiresAt).toISOString(),
      });
    }

    // Get user's API key, fall back to platform key from .env
    let apiKey = await getDecryptedApiKey(profileId);
    let _keySource = "user";
    
    if (!apiKey) {
      // Fall back to platform's API key
      apiKey = process.env.OPENAI_API_KEY || null;
      _keySource = "platform";
    }
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: "OpenAI API key required",
          message: "Please configure your OpenAI API key in Settings or contact support.",
          action: "configure_api_key",
        },
        { status: 402 }
      );
    }

    // Fetch models from OpenAI
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { 
            error: "Invalid API key",
            message: "Your OpenAI API key is invalid or expired. Please update it in Settings.",
            action: "configure_api_key",
          },
          { status: 401 }
        );
      }
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter and format models
    const models: Model[] = data.data
      .filter((m: { id: string }) => isAllowedModel(m.id))
      .map((m: { id: string; context_window?: number }) => {
        const info = getModelInfo(m.id);
        return {
          id: m.id,
          name: info.name,
          description: info.description,
          context_window: m.context_window,
        };
      })
      .sort((a: Model, b: Model) => {
        // Sort by preference: gpt-4.1 first, then gpt-4o, then gpt-4, then gpt-3.5, then o1/o3
        const order = ["gpt-4.1", "gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5", "o3", "o1"];
        const aIndex = order.findIndex(p => a.id.startsWith(p));
        const bIndex = order.findIndex(p => b.id.startsWith(p));
        if (aIndex !== bIndex) return aIndex - bIndex;
        // Within same prefix, prefer non-mini/preview versions
        if (a.id.includes("mini") && !b.id.includes("mini")) return 1;
        if (!a.id.includes("mini") && b.id.includes("mini")) return -1;
        return a.id.localeCompare(b.id);
      });

    // Cache the results
    const expiresAt = Date.now() + CACHE_DURATION_MS;
    modelsCache.set(profileId, { models, expiresAt });

    return NextResponse.json({
      models,
      cached: false,
      expiresAt: new Date(expiresAt).toISOString(),
      keyValid: true,
    });
  } catch (error) {
    console.error("Models fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}

// Clear cache for a user (call after API key update)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    modelsCache.delete(session.user.academyProfileId);
    return NextResponse.json({ success: true, message: "Cache cleared" });
  } catch (error) {
    console.error("Cache clear error:", error);
    return NextResponse.json({ error: "Failed to clear cache" }, { status: 500 });
  }
}
