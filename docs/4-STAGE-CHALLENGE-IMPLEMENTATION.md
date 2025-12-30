# 4-Stage Challenge Implementation Plan

## Overview

Each challenge now has 4 stages that must be completed before portfolio generation:
1. **Questions** - 5 multiple choice questions (existing)
2. **Drawing** - Architecture diagram with AI audit (existing)
3. **Proficiency Test** - Agent-led conversation where user explains their work
4. **CLI** - Practical CLI tasks to demonstrate hands-on skills

---

## Stage 3: Proficiency Test (Chat)

### Concept
- NOT like the multiple choice questions
- Agent has full context: challenge brief, user's diagram, their question answers
- Agent asks the user to EXPLAIN their architectural decisions
- User must justify WHY they made certain choices
- Agent evaluates understanding, not just correctness

### Flow
1. User clicks "Chat" tab
2. Agent loads context (diagram, answers, challenge brief)
3. Agent initiates conversation: "I can see you've designed an architecture with X, Y, Z. Let's discuss your decisions..."
4. Agent asks 3-5 probing questions based on their actual work:
   - "Why did you place the WAF outside the VPC?"
   - "What's your reasoning for using RDS Multi-AZ here?"
   - "How does your subnet design support the compliance requirements?"
5. User explains their reasoning
6. After sufficient conversation (5+ exchanges), agent generates proficiency summary
7. Agent scores the conversation (0-100) based on:
   - Technical accuracy
   - Understanding of AWS concepts
   - Ability to justify decisions
   - Awareness of trade-offs

### Data Model
```typescript
interface ProficiencyTestResult {
  chatHistory: Array<{role: 'user' | 'assistant', content: string, timestamp: string}>;
  questionsAsked: string[];
  score: number;  // 0-100
  summary: string;  // AI-generated summary of their proficiency
  strengths: string[];
  areasForImprovement: string[];
  completedAt: string;
}
```

### Learning Agent Endpoints Needed
1. `POST /api/learning/proficiency-test/start` - Initialize test with context
2. `POST /api/learning/proficiency-test/chat` - Handle conversation turns
3. `POST /api/learning/proficiency-test/evaluate` - Generate final score/summary

---

## Stage 4: CLI Objectives

### Concept
- Agent generates specific CLI tasks based on the challenge
- User must execute commands in the simulated terminal
- Tasks relate to their diagram (deploy what they designed)

### Flow
1. User clicks "CLI" tab
2. Agent generates 2-3 CLI objectives based on challenge:
   - "Create a VPC with CIDR 10.0.0.0/16"
   - "Launch an EC2 instance in the private subnet"
   - "Configure a security group allowing HTTPS traffic"
3. User executes commands
4. AI validates command correctness
5. Track objectives completed
6. Mark complete when all objectives done

### Data Model
```typescript
interface CLITestResult {
  objectives: Array<{
    id: string;
    description: string;
    expectedCommand: string;  // Pattern or exact
    completed: boolean;
    userCommand?: string;
    completedAt?: string;
  }>;
  totalObjectives: number;
  completedObjectives: number;
  score: number;  // percentage
  commandHistory: Array<{command: string, output: string, timestamp: string}>;
  completedAt?: string;
}
```

### Learning Agent Endpoints Needed
1. `POST /api/learning/cli-objectives/generate` - Generate objectives for challenge
2. `POST /api/learning/cli-objectives/validate` - Check if command completes objective

---

## Database Changes

### ChallengeProgress.solution (JSON field)
Add to existing structure:
```typescript
{
  // Existing
  answers: [...],
  questionsData: {...},
  diagramData: {...},
  diagramScore: {...},
  auditScore: number,
  auditPassed: boolean,
  
  // NEW - Proficiency Test
  proficiencyTest: {
    chatHistory: [...],
    score: number,
    summary: string,
    strengths: [...],
    areasForImprovement: [...],
    completedAt: string,
  },
  
  // NEW - CLI Test
  cliTest: {
    objectives: [...],
    completedObjectives: number,
    score: number,
    commandHistory: [...],
    completedAt: string,
  }
}
```

No schema migration needed - solution is already a JSON field.

---

## Portfolio Updates

### What to Include
- Proficiency test score and summary
- CLI completion rate
- Overall challenge score combining all 4 stages

### Learning Agent Portfolio Generator Updates
Add to prompt context:
- `proficiencyTestScore`
- `proficiencyTestSummary`
- `cliScore`
- `cliObjectivesCompleted`

---

## Implementation Order

### Phase 1: Learning Agent Endpoints
- [ ] Create `generators/proficiency_test.py`
- [ ] Create proficiency test start endpoint
- [ ] Create proficiency test chat endpoint  
- [ ] Create proficiency test evaluate endpoint
- [ ] Create CLI objectives generate endpoint
- [ ] Create CLI objectives validate endpoint

### Phase 2: Frontend Integration
- [ ] Update Chat mode to use proficiency test flow
- [ ] Update CLI mode to fetch and track objectives
- [ ] Add completion detection for both stages
- [ ] Store results in progress save calls

### Phase 3: Portfolio Integration
- [ ] Update portfolio generator to include proficiency/CLI data
- [ ] Update portfolio display to show new scores

---

## Files to Modify

### Learning Agent
- `learning_agent/generators/proficiency_test.py` (NEW)
- `learning_agent/generators/cli_objectives.py` (NEW)
- `learning_agent/crawl4ai_mcp.py` (add endpoints)
- `learning_agent/generators/portfolio.py` (update prompt)

### Frontend
- `cloud-archistry/src/components/world/challenge-workspace-modal.tsx`
- `cloud-archistry/src/app/api/challenge/progress/route.ts`

### API Routes (NEW)
- `cloud-archistry/src/app/api/proficiency-test/start/route.ts`
- `cloud-archistry/src/app/api/proficiency-test/chat/route.ts`
- `cloud-archistry/src/app/api/proficiency-test/evaluate/route.ts`
- `cloud-archistry/src/app/api/cli-objectives/generate/route.ts`
- `cloud-archistry/src/app/api/cli-objectives/validate/route.ts`

---

## Key Principles

1. **No reinventing** - Use existing patterns from challenge questions generator
2. **Agent has full context** - Diagram, answers, brief all available
3. **User explains, not answers** - Proficiency test is about justification
4. **Stored for portfolio** - Everything saved in solution JSON
5. **Realistic CLI** - Tasks match what they'd actually do in AWS
