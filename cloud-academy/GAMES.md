# Cloud Academy Games Development Guide

> **IMPORTANT FOR AI AGENTS**: This document is the definitive guide for adding new games to Cloud Academy. Follow this EXACTLY. Do NOT create new folder structures or patterns.

---

## WebSocket Server for Multiplayer/PvP Games

For any game that requires **real-time multiplayer**, **PvP**, or **live synchronization**, use the custom Socket.io server:

```
cloud-academy/server.js
```

### Running the Server
```bash
# Instead of `npm run dev`, use:
node server.js
```

The server runs on port `6060` (configurable via `PORT` env var) and exposes Socket.io at `/api/socketio`.

### Available Socket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `register-user` | Client → Server | Register user for direct messaging |
| `join-match` | Client → Server | Join a match room by code |
| `leave-match` | Client → Server | Leave a match room |
| `chat-message` | Bidirectional | In-match chat |
| `buzz` | Client → Server | Buzz in (quiz battles) |
| `player-buzzed` | Server → Client | Notify all players of buzz |
| `answer-submitted` | Client → Server | Submit answer |
| `answer-result` | Server → Client | Broadcast answer result |
| `score-update` | Bidirectional | Sync scores |
| `next-question` | Server → Client | Push next question |
| `match-status` | Bidirectional | Match state changes (accepted, started, completed) |
| `match-update` | Bidirectional | Generic match data sync |
| `room-update` | Server → Client | Player join/leave notifications |
| `player-disconnected` | Server → Client | Player disconnect notification |

### Client-Side Usage
```typescript
import { io } from "socket.io-client";

const socket = io({
  path: "/api/socketio",
  transports: ["websocket", "polling"],
});

// Register user
socket.emit("register-user", { userId, userName });

// Join match
socket.emit("join-match", { matchCode, userId, userName });

// Listen for events
socket.on("player-buzzed", ({ playerId, playerName, timestamp }) => {
  // Handle buzz
});
```

### When to Use WebSockets
- **PvP games** (head-to-head battles)
- **Live leaderboards** during matches
- **Real-time chat** in lobbies
- **Buzz-in mechanics** (first to answer)
- **Synchronized timers** across players

### When NOT to Use WebSockets
- **Single-player games** (Hot Streak, Cloud Tycoon, etc.)
- **Async leaderboards** (use REST API)
- **Score submission** (use REST API)

---

## Architecture Overview

Games in Cloud Academy follow a **3-layer architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js)                                             │
│  cloud-academy/src/app/game/modes/{game-name}/page.tsx          │
│                           │                                     │
│                           ▼                                     │
│  API ROUTE (Next.js)                                            │
│  cloud-academy/src/app/api/gaming/{game-name}/route.ts          │
│                           │                                     │
│                           ▼                                     │
│  LEARNING AGENT (Python/FastAPI)                                │
│  learning_agent/crawl4ai_mcp.py  ← Endpoint defined here        │
│  learning_agent/generators/{generator}.py  ← Logic here         │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Locations

### Frontend Game Pages
```
cloud-academy/src/app/game/modes/{game-name}/page.tsx
```

**Existing games:**
- `hot-streak/page.tsx` - 60-second quick-fire quiz
- `service-slots/page.tsx` - Slot machine AWS challenges
- `sniper-quiz/page.tsx` - Precision quiz game
- `cloud-tycoon/page.tsx` - Business simulation game
- `service-sniper/page.tsx` - Shooting gallery game

### Frontend API Routes
```
cloud-academy/src/app/api/gaming/{game-name}/route.ts
```

**IMPORTANT**: All game API routes go in `/api/gaming/`, NOT `/api/game/`!

**Existing routes:**
- `/api/gaming/hot-streak/route.ts`
- `/api/gaming/slots/challenge/route.ts`
- `/api/gaming/slots/state/route.ts`
- `/api/gaming/slots/validate/route.ts`
- `/api/gaming/sniper-quiz/questions/route.ts`
- `/api/gaming/sniper-quiz/submit/route.ts`
- `/api/gaming/tycoon/journey/route.ts`
- `/api/gaming/tycoon/validate/route.ts`

### Learning Agent Endpoints
```
learning_agent/crawl4ai_mcp.py
```

**CRITICAL**: All Learning Agent endpoints are defined in `crawl4ai_mcp.py`, NOT in `routes/*.py`. The routes folder is for legacy/alternative patterns only.

**Existing game endpoints in crawl4ai_mcp.py:**
- `@app.post("/api/gaming/hot-streak/generate")`
- `@app.post("/api/slots/challenge/generate")`
- `@app.post("/api/cloud-tycoon/journey/generate")`
- `@app.post("/api/cloud-tycoon/validate")`

### Learning Agent Generators
```
learning_agent/generators/{generator}.py
```

**Existing generators:**
- `game_modes.py` - Contains `generate_hot_streak_questions`, `generate_sniper_quiz_questions`, `generate_speed_round_questions`
- `service_slots.py` - Slot machine challenge generation
- `cloud_tycoon.py` - Business journey generation

---

## Adding a New Game: Step-by-Step

### Step 1: Create the Generator (Learning Agent)

Create or add to `learning_agent/generators/game_modes.py`:

```python
class NewGameQuestions(BaseModel):
    """Response model for your game"""
    questions: List[GameQuestion]
    topics_covered: List[str]


NEW_GAME_PROMPT = """Your prompt here...

IMPORTANT: Randomize which option is correct! Do NOT always put the correct answer first.
The correct_index should vary between 0, 1, 2, and 3 across questions.

Return JSON:
{{
  "questions": [
    {{
      "id": "unique_id",
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 2,
      "topic": "AWS Service/Topic",
      "difficulty": "easy|medium|hard",
      "explanation": "Brief explanation"
    }}
  ],
  "topics_covered": ["list", "of", "topics"]
}}
"""


async def generate_new_game_questions(
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    question_count: int = 20,
    api_key: Optional[str] = None,
) -> NewGameQuestions:
    """Generate questions for New Game."""
    
    # Build cert context using CERT_CODE_TO_PERSONA and CERTIFICATION_PERSONAS
    # ... (see existing generators for pattern)
    
    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        api_key=api_key,
    )
    
    # Parse and return
    # ...
```

### Step 2: Add Endpoint to crawl4ai_mcp.py

Add to `learning_agent/crawl4ai_mcp.py`:

```python
@app.post("/api/gaming/new-game/generate")
async def generate_new_game_endpoint(request: GenerateContentRequest):
    """Generate questions for New Game."""
    from utils import set_request_api_key, set_request_model
    from generators.game_modes import generate_new_game_questions
    
    try:
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        short_code = (request.certification_code or "SAA").upper()
        question_count = request.options.get("question_count", 20) if request.options else 20
        
        result = await generate_new_game_questions(
            user_level=request.user_level or "intermediate",
            cert_code=short_code,
            question_count=question_count,
        )
        
        return {
            "success": True,
            "questions": [
                {
                    "id": q.id,
                    "question": q.question,
                    "options": q.options,
                    "correct_index": q.correct_index,
                    "topic": q.topic,
                    "difficulty": q.difficulty,
                    "explanation": q.explanation,
                }
                for q in result.questions
            ],
            "topics_covered": result.topics_covered,
            "certification": short_code,
        }
    finally:
        set_request_api_key(None)
        set_request_model(None)
```

### Step 3: Create Frontend API Route

Create `cloud-academy/src/app/api/gaming/new-game/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";

const LEARNING_AGENT_URL = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL!;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await req.json();

    // Get AI config (user's API key)
    const aiConfig = await getAiConfigForRequest(profileId);
    if (!aiConfig) {
      return NextResponse.json(
        {
          error: "OpenAI API key required",
          message: "Add an API key in Settings to play.",
          action: "configure_api_key",
        },
        { status: 402 }
      );
    }

    // Get user profile
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: {
        skillLevel: true,
        targetCertification: true,
      },
    });

    if (!profile?.targetCertification) {
      return NextResponse.json(
        {
          error: "No target certification set",
          message: "Please set your target AWS certification in Settings.",
          action: "set_certification",
        },
        { status: 400 }
      );
    }

    // Call Learning Agent
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/gaming/new-game/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certification_code: profile.targetCertification,
          user_level: profile.skillLevel || "intermediate",
          options: { question_count: body.count || 20 },
          openai_api_key: aiConfig.key,
          preferred_model: aiConfig.preferredModel,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[New Game] Learning agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate questions" },
        { status: 500 }
      );
    }

    const result = await response.json();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Generation failed" },
        { status: 500 }
      );
    }

    // Transform to frontend format (correct_index -> correctIndex)
    const questions = result.questions.map((q: any) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
      topic: q.topic,
      difficulty: q.difficulty,
      explanation: q.explanation,
    }));

    return NextResponse.json({ 
      questions,
      source: "ai",
      certification: profile.targetCertification,
      skillLevel: profile.skillLevel,
    });
  } catch (error) {
    console.error("[New Game] Error:", error);
    return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
  }
}
```

### Step 4: Create Frontend Game Page

Create `cloud-academy/src/app/game/modes/new-game/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  topic: string;
  difficulty: string;
  explanation?: string;
}

export default function NewGamePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchQuestions = useCallback(async () => {
    try {
      const response = await fetch("/api/gaming/new-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 20 }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions);
      }
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    }
  }, []);

  // ... rest of game logic
}
```

### Step 5: Add Game to Game Selection Page

Update `cloud-academy/src/app/game/page.tsx` to include routing for the new game.

---

## Key Patterns to Follow

### 1. API Key Handling
Always use `getAiConfigForRequest(profileId)` to get the user's API key. Never hardcode keys.

### 2. Field Name Transformation
- Learning Agent uses `correct_index` (snake_case)
- Frontend uses `correctIndex` (camelCase)
- Always transform in the API route

### 3. Error Handling
Return proper status codes:
- `401` - Unauthorized (no session)
- `402` - Payment required (no API key)
- `400` - Bad request (no certification set)
- `500` - Server error

### 4. Prompt Best Practices
- Always tell AI to randomize correct answer positions
- Show example with `correct_index: 2` not `0-3`
- Be explicit about JSON structure

---

## Environment Variables

```
NEXT_PUBLIC_LEARNING_AGENT_URL=http://learning-agent:1027
```

---

## Testing Checklist

- [ ] Generator function works in isolation
- [ ] Endpoint in crawl4ai_mcp.py returns correct JSON
- [ ] Frontend API route transforms data correctly
- [ ] Game page fetches and displays questions
- [ ] Error states handled (no API key, no cert, etc.)
- [ ] Answers are randomized (not always A)

---

## DO NOT

1. ❌ Create routes in `/api/game/` - use `/api/gaming/`
2. ❌ Define endpoints in `learning_agent/routes/*.py` - use `crawl4ai_mcp.py`
3. ❌ Hardcode API keys
4. ❌ Hardcode fallback questions (AI only)
5. ❌ Put correct answer always in position 0

---

## Current Games Summary

| Game | Frontend | API Route | Learning Agent Endpoint |
|------|----------|-----------|------------------------|
| Hot Streak | `hot-streak/page.tsx` | `/api/gaming/hot-streak` | `/api/gaming/hot-streak/generate` |
| Service Slots | `service-slots/page.tsx` | `/api/gaming/slots/*` | `/api/slots/challenge/generate` |
| Sniper Quiz | `sniper-quiz/page.tsx` | `/api/gaming/sniper-quiz/*` | `/api/game/sniper-quiz/generate` |
| Cloud Tycoon | `cloud-tycoon/page.tsx` | `/api/gaming/tycoon/*` | `/api/cloud-tycoon/*` |
| Service Sniper | `service-sniper/page.tsx` | N/A (local only) | N/A |

---

*Last updated: December 2024*
