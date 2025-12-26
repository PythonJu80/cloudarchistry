# CloudAcademy Database Integration

## Overview

CloudAcademy shares the same PostgreSQL database as the main CloudMigrate application, using a unified Prisma schema with separate tables for the learning platform.

## Schema Models

### Core Tables

| Model | Purpose |
|-------|---------|
| `AcademyLocation` | Company locations on the world map |
| `AcademyScenario` | Generated cloud architecture scenarios |
| `AcademyChallenge` | Individual challenges within scenarios |
| `AcademyUserProfile` | User profiles, stats, and gamification |
| `UserLocationProgress` | User's progress per location |
| `ScenarioAttempt` | Each attempt at a scenario |
| `ChallengeProgress` | Progress on individual challenges |

### Team Tables

| Model | Purpose |
|-------|---------|
| `AcademyTeam` | Teams for collaborative challenges |
| `AcademyTeamMember` | Team membership with roles |
| `AcademyTeamInvite` | Invite codes and email invites |
| `TeamChallengeAttempt` | Team-based scenario attempts |

### Gamification Tables

| Model | Purpose |
|-------|---------|
| `AcademyLeaderboard` | Materialized leaderboard entries |
| `AcademyAchievement` | Achievement definitions |
| `AcademyActivity` | Activity feed for social features |

## Setup Instructions

### 1. Run Migration

From the **parent directory** (`cloudmigrate-saas/`):

```bash
npx prisma migrate dev --name add_academy_tables
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Seed Locations & Achievements

```bash
npx ts-node prisma/seed-academy.ts
```

Or from the `cloud-academy/` directory:

```bash
pnpm db:migrate
pnpm db:seed
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                       │
├─────────────────────────────────────────────────────────────┤
│  CloudMigrate Tables        │  CloudAcademy Tables          │
│  ─────────────────          │  ────────────────────         │
│  • Tenant                   │  • AcademyLocation            │
│  • User                     │  • AcademyScenario            │
│  • Transfer                 │  • AcademyChallenge           │
│  • Architecture             │  • AcademyUserProfile         │
│  • CloudFlow                │  • AcademyTeam                │
│  • ...                      │  • AcademyLeaderboard         │
│                             │  • ...                        │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Prisma Client   │
                    └─────────┬─────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────┴─────┐       ┌─────┴─────┐       ┌─────┴─────┐
    │CloudMigrate│       │CloudAcademy│       │Learning   │
    │  Next.js  │       │  Next.js   │       │  Agent    │
    │  :3000    │       │  :6060     │       │  :1027    │
    └───────────┘       └───────────┘       └───────────┘
```

## Key Relationships

### User → Profile
- Main `User` table (from CloudMigrate) links to `AcademyUserProfile` via `userId`
- Profile is created on first Academy access
- Inherits `tenantId` for multi-tenant isolation

### Location → Scenario → Challenge
```
AcademyLocation (1) ──→ (N) AcademyScenario (1) ──→ (N) AcademyChallenge
```

### Progress Tracking
```
AcademyUserProfile (1) ──→ (N) UserLocationProgress
                    (1) ──→ (N) ScenarioAttempt (1) ──→ (N) ChallengeProgress
```

### Teams
```
AcademyTeam (1) ──→ (N) AcademyTeamMember ──→ User
            (1) ──→ (N) TeamChallengeAttempt ──→ AcademyScenario
```

## Multi-Tenancy

All Academy tables support multi-tenancy:

- `AcademyUserProfile.tenantId` - User's organization
- `AcademyTeam.tenantId` - Team's organization
- `ScenarioAttempt.tenantId` - Attempt's organization
- `AcademyActivity.tenantId` - Activity visibility scope

Leaderboards can be scoped to:
- `global` - All users (opt-in)
- `tenant` - Within organization
- `team` - Within team
- `industry` - By industry vertical

## XP & Leveling System

```typescript
const XP_PER_LEVEL = 1000;
const XP_GROWTH_RATE = 1.2;  // Each level requires 20% more XP

// Level 1: 0 XP
// Level 2: 1000 XP
// Level 3: 2200 XP (1000 + 1200)
// Level 4: 3640 XP (2200 + 1440)
// ...
```

## Environment Variables

Ensure `.env` in the parent directory has:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/cloudmigrate"
```

CloudAcademy will use the same `DATABASE_URL`.

## Service Layer

Located in `cloud-academy/src/lib/academy/`:

```
lib/academy/
├── index.ts           # Main exports
├── types.ts           # TypeScript interfaces
└── services/
    ├── profile.ts     # User profile & gamification
    ├── locations.ts   # Locations, scenarios, progress
    ├── teams.ts       # Team management (TODO)
    └── leaderboard.ts # Leaderboard queries (TODO)
```

## Future Enhancements

- [ ] Real-time team collaboration via WebSockets
- [ ] Achievement unlock notifications
- [ ] Weekly/monthly leaderboard resets
- [ ] Industry-specific challenges
- [ ] Custom tenant scenarios
- [ ] Learning path recommendations
