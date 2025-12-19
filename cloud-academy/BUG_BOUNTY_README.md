# Bug Bounty Game - Complete Implementation

## Overview

Bug Bounty is a production-incident debugging simulator where players hunt for bugs in flawed AWS architectures using real AWS logs, metrics, and environment data.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js)                                             │
│  /game/modes/bug-bounty/page.tsx                                │
│  - React Flow diagram viewer                                    │
│  - AWS environment tabs (logs, metrics, VPC, IAM, cost, etc.)  │
│  - Bug claim submission modal                                   │
│                           │                                     │
│                           ▼                                     │
│  API ROUTES (Next.js)                                           │
│  /api/gaming/bug-bounty/generate                                │
│  /api/gaming/bug-bounty/validate                                │
│  /api/gaming/bug-bounty/reveal                                  │
│                           │                                     │
│                           ▼                                     │
│  DRAWING AGENT (Python/FastAPI - Port 6098)                     │
│  POST /bug-bounty/generate                                      │
│  POST /bug-bounty/validate                                      │
│  GET  /bug-bounty/{challenge_id}/reveal                         │
│                           │                                     │
│                           ▼                                     │
│  BUG BOUNTY GENERATOR                                           │
│  bug_bounty_generator.py                                        │
│  - Generate flawed architectures                                │
│  - Create fake AWS logs/metrics                                 │
│  - Validate bug claims                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Game Mechanics

### Challenge Generation

Each challenge includes:

1. **Flawed Architecture Diagram** (React Flow)
   - Intentional security vulnerabilities
   - Missing HA components
   - Misconfigurations

2. **Use Case Description**
   - Requirements with contradictions
   - Claims that don't match diagram
   - Hidden inconsistencies

3. **Fake AWS Environment**
   - **CloudWatch Logs**: ERROR/WARN/INFO messages with evidence
   - **CloudWatch Metrics**: CPU, latency, connections with alarms
   - **VPC Flow Logs**: ACCEPT/REJECT traffic patterns
   - **IAM Policies**: Overly permissive configurations
   - **Cost Data**: Daily spend with trend analysis
   - **X-Ray Traces**: Request traces with errors
   - **Config Rules**: Compliance status (COMPLIANT/NON_COMPLIANT)

### Bug Types

- **Security**: Public RDS, unencrypted data, overly permissive IAM
- **Reliability**: Single AZ, no auto-scaling, no backups
- **Performance**: Wrong region, timeout issues, latency
- **Cost**: Oversized instances, unnecessary NAT gateways
- **Compliance**: Missing encryption, no flow logs
- **Mismatch**: Description contradicts diagram

### Scoring System

- ✅ **Correct bug found**: +100 points × severity multiplier
  - Critical: 2.0x (200 pts)
  - High: 1.5x (150 pts)
  - Medium: 1.0x (100 pts)
  - Low: 0.5x (50 pts)
- ✅ **Evidence bonus**: +30 points (2+ evidence items)
- ✅ **Confidence bonus**: +20 points (80%+ confidence)
- ❌ **False positive**: -50 points

### Difficulty Levels

| Difficulty | Bugs | Time Limit | Bounty Value |
|------------|------|------------|--------------|
| Beginner   | 3    | 15 min     | ~$275        |
| Intermediate | 5  | 10 min     | ~$500        |
| Advanced   | 7    | 7.5 min    | ~$700        |

## Files Created

### Backend (Drawing Agent)

1. **`aws_drawing_agent/bug_bounty_generator.py`**
   - `BugBountyGenerator` class
   - Challenge generation with flawed architectures
   - Fake AWS environment generation
   - Bug claim validation logic

2. **`aws_drawing_agent/main.py`** (updated)
   - `POST /bug-bounty/generate` endpoint
   - `POST /bug-bounty/validate` endpoint
   - `GET /bug-bounty/{challenge_id}/reveal` endpoint

3. **`aws_drawing_agent/test_bug_bounty.py`**
   - Test suite for challenge generation
   - Validation testing
   - JSON serialization verification

### Frontend (Next.js)

1. **`src/app/api/gaming/bug-bounty/generate/route.ts`**
   - Proxies to Drawing Agent
   - Handles authentication
   - Gets user API key via `getAiConfigForRequest()`

2. **`src/app/api/gaming/bug-bounty/validate/route.ts`**
   - Validates bug claims
   - Returns points and feedback

3. **`src/app/api/gaming/bug-bounty/reveal/route.ts`**
   - Reveals all bugs after game over

4. **`src/app/game/modes/bug-bounty/page.tsx`**
   - Complete game UI
   - React Flow diagram viewer
   - AWS environment tabs
   - Bug claim modal
   - Timer and scoring display

### Configuration

1. **`src/app/game/types.ts`** (updated)
   - Changed `daily_jackpot` → `bug_bounty`
   - Updated title, description, icon (🐛)
   - Changed players from "Global" to "Solo"

## Testing

Run the test suite:

```bash
cd cloud-academy/aws_drawing_agent
python3 test_bug_bounty.py
```

**Test Results:**
- ✅ Challenge generation (5 bugs, diagram, description, AWS environment)
- ✅ Correct bug validation (+250 points)
- ✅ False positive detection (-50 points)
- ✅ JSON serialization (6417 bytes)

## How to Play

1. Navigate to `/game` and select **Bug Bounty** 🐛
2. Review the architecture diagram and use case description
3. Examine AWS environment tabs for evidence:
   - CloudWatch Logs for errors
   - Metrics for alarms
   - Config Rules for compliance issues
   - IAM Policies for security problems
4. Click nodes in diagram or use "Flag Bug" button
5. Submit structured bug claims with:
   - Target (node ID, description, or log reference)
   - Bug type (security, reliability, performance, etc.)
   - Severity (critical, high, medium, low)
   - Claim description
   - Evidence references
   - Confidence level
6. Earn points for correct bugs, lose points for false positives
7. Find all bugs before time expires!

## Environment Variables

Add to `.env`:

```bash
# Drawing Agent URL (default: http://localhost:6098)
DRAWING_AGENT_URL=http://localhost:6098
```

## Example Challenge

**Scenario**: E-commerce platform with 10M requests/day

**Bugs Hidden**:
1. 🔴 **Critical**: RDS publicly accessible without encryption
2. 🟠 **High**: Single AZ deployment (contradicts description)
3. 🟡 **Medium**: No auto-scaling configured
4. 🟠 **High**: IAM role with wildcard permissions
5. 🟡 **Medium**: CloudFront mentioned but not in diagram

**Evidence in Logs**:
- CloudWatch: "ERROR: Unable to connect to RDS - timeout"
- VPC Flow: "REJECT" connections to RDS
- Config: "rds-storage-encrypted: NON_COMPLIANT"
- IAM Policy: `"Action": ["rds:*", "s3:*"], "Resource": "*"`

## Future Enhancements

- [ ] Multiplayer mode (first to find all bugs)
- [ ] Daily challenges with global leaderboard
- [ ] Real cash prizes for top players
- [ ] More scenario types (data pipeline, ML platform, etc.)
- [ ] Difficulty progression system
- [ ] Achievement badges
- [ ] Bug report export (PDF/Markdown)
- [ ] Integration with real AWS accounts (read-only)

## Production Considerations

1. **Challenge Storage**: Currently in-memory. Use Redis or database for production.
2. **Rate Limiting**: Add rate limits to prevent API abuse.
3. **Challenge Expiry**: Implement TTL for challenges (e.g., 1 hour).
4. **Leaderboard**: Track top scores in database.
5. **Analytics**: Log bug discovery patterns for difficulty tuning.

## Credits

Built using:
- **Drawing Agent**: AWS architecture generation and validation
- **React Flow**: Interactive diagram rendering
- **Pydantic**: Data validation and serialization
- **FastAPI**: High-performance Python API
- **Next.js**: Full-stack React framework

---

**Status**: ✅ Fully implemented and tested
**Last Updated**: December 19, 2025
