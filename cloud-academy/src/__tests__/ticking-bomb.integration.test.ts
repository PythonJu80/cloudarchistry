/**
 * ============================================================================
 * TICKING BOMB GAME - INTEGRATION SMOKE TEST
 * ============================================================================
 * 
 * This test file performs actual API calls to test the full game flow.
 * It mocks authentication and database but tests real route handlers.
 * 
 * Run with: pnpm test src/__tests__/ticking-bomb.integration.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock socket emit
vi.mock('@/lib/socket', () => ({
  emitVersusUpdate: vi.fn(),
  emitToMatch: vi.fn(),
}));

// Mock Resend
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
    };
  },
}));

// Mock API keys service
vi.mock('@/lib/academy/services/api-keys', () => ({
  getAiConfigForRequest: vi.fn().mockResolvedValue({
    key: 'mock-api-key',
    preferredModel: 'gpt-4o',
  }),
}));

// In-memory database mock
const mockDatabase = {
  academyUsers: new Map<string, {
    id: string;
    email: string;
    name: string;
    username: string;
  }>(),
  versusMatches: new Map<string, {
    id: string;
    matchCode: string;
    player1Id: string;
    player2Id: string;
    matchType: string;
    status: string;
    matchState: Record<string, unknown> | null;
    player1Score: number;
    player2Score: number;
    currentQuestion: number;
    totalQuestions: number;
    winnerId: string | null;
    completedAt: Date | null;
    createdAt: Date;
    chatMessages: unknown[];
    challengeId: string | null;
  }>(),
};

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    academyUser: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        for (const user of mockDatabase.academyUsers.values()) {
          if (where.email && user.email === where.email) return user;
          if (where.id && user.id === where.id) return user;
        }
        return null;
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return mockDatabase.academyUsers.get(where.id) || null;
      }),
    },
    versusMatch: {
      create: vi.fn().mockImplementation(({ data, include }) => {
        const match = {
          id: `match_${Date.now()}`,
          ...data,
          player1Score: 0,
          player2Score: 0,
          currentQuestion: 0,
          totalQuestions: 10,
          matchState: null,
          winnerId: null,
          completedAt: null,
          createdAt: new Date(),
          chatMessages: [],
        };
        mockDatabase.versusMatches.set(match.matchCode, match);
        
        if (include?.player1) {
          (match as Record<string, unknown>).player1 = mockDatabase.academyUsers.get(data.player1Id);
        }
        if (include?.player2) {
          (match as Record<string, unknown>).player2 = mockDatabase.academyUsers.get(data.player2Id);
        }
        return match;
      }),
      findUnique: vi.fn().mockImplementation(({ where, include }) => {
        const match = mockDatabase.versusMatches.get(where.matchCode);
        if (!match) return null;
        
        const result = { ...match };
        if (include?.player1) {
          (result as Record<string, unknown>).player1 = mockDatabase.academyUsers.get(match.player1Id);
        }
        if (include?.player2) {
          (result as Record<string, unknown>).player2 = mockDatabase.academyUsers.get(match.player2Id);
        }
        return result;
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const match = mockDatabase.versusMatches.get(where.matchCode);
        if (!match) return null;
        
        Object.assign(match, data);
        return match;
      }),
    },
  },
}));

// Mock fetch for Learning Agent calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks
import { getServerSession } from 'next-auth';
import { POST as createMatch } from '../app/api/versus/route';
import { GET as getMatch, PATCH as updateMatch } from '../app/api/versus/[matchCode]/route';
import { POST as tickingBombAction } from '../app/api/versus/[matchCode]/ticking-bomb/route';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Ticking Bomb - Full Game Integration', () => {
  const player1 = {
    id: 'player1-id',
    email: 'player1@test.com',
    name: 'Alice',
    username: 'alice',
  };

  const player2 = {
    id: 'player2-id',
    email: 'player2@test.com',
    name: 'Bob',
    username: 'bob',
  };

  let matchCode: string;

  beforeEach(() => {
    // Reset database
    mockDatabase.academyUsers.clear();
    mockDatabase.versusMatches.clear();

    // Add test users
    mockDatabase.academyUsers.set(player1.id, player1);
    mockDatabase.academyUsers.set(player2.id, player2);

    // Reset mocks
    vi.clearAllMocks();

    // Mock Learning Agent response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        questions: Array.from({ length: 30 }, (_, i) => ({
          id: `q_${i}`,
          question: `Test question ${i + 1}?`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correct_index: i % 4,
          topic: 'S3',
          difficulty: 'easy',
          explanation: `Explanation for question ${i + 1}`,
        })),
        topics_covered: ['S3', 'EC2', 'VPC'],
        certification: 'SAA',
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // PHASE 1: CHALLENGE CREATION
  // ============================================================================

  describe('Phase 1: Challenge Creation', () => {
    it('should create a ticking_bomb challenge', async () => {
      // Mock session as player1
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const req = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player2.id,
          matchType: 'ticking_bomb',
        }),
      });

      const response = await createMatch(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.match).toBeDefined();
      expect(data.match.matchType).toBe('ticking_bomb');
      expect(data.match.status).toBe('pending');
      expect(data.match.player1Id).toBe(player1.id);
      expect(data.match.player2Id).toBe(player2.id);

      // Save matchCode for subsequent tests
      matchCode = data.match.matchCode;
    });

    it('should not allow challenging yourself', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const req = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player1.id, // Same as challenger
          matchType: 'ticking_bomb',
        }),
      });

      const response = await createMatch(req);
      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // PHASE 2: CHALLENGE ACCEPTANCE
  // ============================================================================

  describe('Phase 2: Challenge Acceptance', () => {
    beforeEach(async () => {
      // Create a match first
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const req = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player2.id,
          matchType: 'ticking_bomb',
        }),
      });

      const response = await createMatch(req);
      const data = await response.json();
      matchCode = data.match.matchCode;
    });

    it('should allow player2 to accept the challenge', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player2.id, email: player2.email },
      } as never);

      const req = new NextRequest(`http://localhost/api/versus/${matchCode}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' }),
      });

      const response = await updateMatch(req, { params: Promise.resolve({ matchCode }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.match.status).toBe('active');
    });

    it('should not allow player1 to accept their own challenge', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const req = new NextRequest(`http://localhost/api/versus/${matchCode}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' }),
      });

      const response = await updateMatch(req, { params: Promise.resolve({ matchCode }) });
      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // PHASE 3: GAME START
  // ============================================================================

  describe('Phase 3: Game Start', () => {
    beforeEach(async () => {
      // Create and accept match
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const createReq = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player2.id,
          matchType: 'ticking_bomb',
        }),
      });
      const createRes = await createMatch(createReq);
      const createData = await createRes.json();
      matchCode = createData.match.matchCode;

      // Accept as player2
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player2.id, email: player2.email },
      } as never);

      const acceptReq = new NextRequest(`http://localhost/api/versus/${matchCode}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' }),
      });
      await updateMatch(acceptReq, { params: Promise.resolve({ matchCode }) });
    });

    it('should allow host (player1) to start the game', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const req = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      });

      const response = await tickingBombAction(req, { params: Promise.resolve({ matchCode }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.matchState).toBeDefined();
      expect(data.matchState.questions).toHaveLength(30);
      expect(data.matchState.fuseTime).toBe(60);
      expect(data.matchState.players).toHaveLength(2);
      expect(data.matchState.currentBombHolder).toBeDefined();
    });

    it('should not allow player2 to start the game', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player2.id, email: player2.email },
      } as never);

      const req = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      });

      const response = await tickingBombAction(req, { params: Promise.resolve({ matchCode }) });
      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // PHASE 4: GAMEPLAY - PASS ACTION
  // ============================================================================

  describe('Phase 4: Gameplay - Pass Action', () => {
    beforeEach(async () => {
      // Setup: Create, accept, and start game
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const createReq = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player2.id,
          matchType: 'ticking_bomb',
        }),
      });
      const createRes = await createMatch(createReq);
      const createData = await createRes.json();
      matchCode = createData.match.matchCode;

      // Accept
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player2.id, email: player2.email },
      } as never);
      const acceptReq = new NextRequest(`http://localhost/api/versus/${matchCode}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' }),
      });
      await updateMatch(acceptReq, { params: Promise.resolve({ matchCode }) });

      // Start
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);
      const startReq = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      });
      await tickingBombAction(startReq, { params: Promise.resolve({ matchCode }) });
    });

    it('should allow bomb holder to pass after correct answer', async () => {
      // Get current bomb holder from match state
      const match = mockDatabase.versusMatches.get(matchCode);
      const matchState = match?.matchState as { currentBombHolder: string };
      const bombHolderId = matchState?.currentBombHolder;
      const targetId = bombHolderId === player1.id ? player2.id : player1.id;

      // Mock session as bomb holder
      const bombHolderEmail = bombHolderId === player1.id ? player1.email : player2.email;
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: bombHolderId, email: bombHolderEmail },
      } as never);

      const req = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'pass', targetId }),
      });

      const response = await tickingBombAction(req, { params: Promise.resolve({ matchCode }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.matchState.currentBombHolder).toBe(targetId);
      expect(data.matchState.fuseTime).toBe(60); // Reset on pass
      expect(data.matchState.currentQuestion).toBe(1); // Advanced
    });

    it('should not allow non-bomb-holder to pass', async () => {
      const match = mockDatabase.versusMatches.get(matchCode);
      const matchState = match?.matchState as { currentBombHolder: string };
      const bombHolderId = matchState?.currentBombHolder;
      const nonHolderId = bombHolderId === player1.id ? player2.id : player1.id;
      const nonHolderEmail = nonHolderId === player1.id ? player1.email : player2.email;

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: nonHolderId, email: nonHolderEmail },
      } as never);

      const req = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'pass', targetId: bombHolderId }),
      });

      const response = await tickingBombAction(req, { params: Promise.resolve({ matchCode }) });
      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // PHASE 5: GAMEPLAY - WRONG ACTION
  // ============================================================================

  describe('Phase 5: Gameplay - Wrong Action', () => {
    beforeEach(async () => {
      // Setup: Create, accept, and start game
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const createReq = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player2.id,
          matchType: 'ticking_bomb',
        }),
      });
      const createRes = await createMatch(createReq);
      const createData = await createRes.json();
      matchCode = createData.match.matchCode;

      // Accept
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player2.id, email: player2.email },
      } as never);
      const acceptReq = new NextRequest(`http://localhost/api/versus/${matchCode}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' }),
      });
      await updateMatch(acceptReq, { params: Promise.resolve({ matchCode }) });

      // Start
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);
      const startReq = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      });
      await tickingBombAction(startReq, { params: Promise.resolve({ matchCode }) });
    });

    it('should advance question on wrong answer but keep bomb with same player', async () => {
      // Get current bomb holder from match state
      const match = mockDatabase.versusMatches.get(matchCode);
      const matchState = match?.matchState as { currentBombHolder: string; currentQuestion: number };
      const bombHolderId = matchState?.currentBombHolder;
      const initialQuestion = matchState?.currentQuestion;

      // Mock session as bomb holder
      const bombHolderEmail = bombHolderId === player1.id ? player1.email : player2.email;
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: bombHolderId, email: bombHolderEmail },
      } as never);

      const req = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'wrong' }),
      });

      const response = await tickingBombAction(req, { params: Promise.resolve({ matchCode }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.matchState.currentBombHolder).toBe(bombHolderId); // Same holder
      expect(data.matchState.currentQuestion).toBe(initialQuestion + 1); // Advanced question
    });

    it('should not allow non-bomb-holder to submit wrong answer', async () => {
      const match = mockDatabase.versusMatches.get(matchCode);
      const matchState = match?.matchState as { currentBombHolder: string };
      const bombHolderId = matchState?.currentBombHolder;
      const nonHolderId = bombHolderId === player1.id ? player2.id : player1.id;
      const nonHolderEmail = nonHolderId === player1.id ? player1.email : player2.email;

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: nonHolderId, email: nonHolderEmail },
      } as never);

      const req = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'wrong' }),
      });

      const response = await tickingBombAction(req, { params: Promise.resolve({ matchCode }) });
      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // PHASE 6: GAMEPLAY - EXPLODE ACTION
  // ============================================================================

  describe('Phase 6: Gameplay - Explode Action', () => {
    beforeEach(async () => {
      // Setup: Create, accept, and start game
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const createReq = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player2.id,
          matchType: 'ticking_bomb',
        }),
      });
      const createRes = await createMatch(createReq);
      const createData = await createRes.json();
      matchCode = createData.match.matchCode;

      // Accept
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player2.id, email: player2.email },
      } as never);
      const acceptReq = new NextRequest(`http://localhost/api/versus/${matchCode}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' }),
      });
      await updateMatch(acceptReq, { params: Promise.resolve({ matchCode }) });

      // Start
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);
      const startReq = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      });
      await tickingBombAction(startReq, { params: Promise.resolve({ matchCode }) });
    });

    it('should eliminate player and end game on explosion', async () => {
      const match = mockDatabase.versusMatches.get(matchCode);
      const matchState = match?.matchState as { currentBombHolder: string };
      const bombHolderId = matchState?.currentBombHolder;
      const bombHolderEmail = bombHolderId === player1.id ? player1.email : player2.email;

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: bombHolderId, email: bombHolderEmail },
      } as never);

      const req = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'explode' }),
      });

      const response = await tickingBombAction(req, { params: Promise.resolve({ matchCode }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.gameOver).toBe(true);
      
      // Winner should be the other player
      const expectedWinner = bombHolderId === player1.id ? player2.id : player1.id;
      expect(data.winnerId).toBe(expectedWinner);
    });
  });

  // ============================================================================
  // PHASE 7: MATCH RETRIEVAL
  // ============================================================================

  describe('Phase 7: Match Retrieval', () => {
    beforeEach(async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const createReq = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player2.id,
          matchType: 'ticking_bomb',
        }),
      });
      const createRes = await createMatch(createReq);
      const createData = await createRes.json();
      matchCode = createData.match.matchCode;
    });

    it('should return match details for participants', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const req = new NextRequest(`http://localhost/api/versus/${matchCode}`, {
        method: 'GET',
      });

      const response = await getMatch(req, { params: Promise.resolve({ matchCode }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.match).toBeDefined();
      expect(data.match.matchCode).toBe(matchCode);
      expect(data.match.myPlayerId).toBe(player1.id);
    });

    it('should return 404 for non-existent match', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const req = new NextRequest('http://localhost/api/versus/nonexistent', {
        method: 'GET',
      });

      const response = await getMatch(req, { params: Promise.resolve({ matchCode: 'nonexistent' }) });
      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // PHASE 8: ERROR HANDLING
  // ============================================================================

  describe('Phase 8: Error Handling', () => {
    it('should return 401 for unauthenticated requests', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player2.id,
          matchType: 'ticking_bomb',
        }),
      });

      const response = await createMatch(req);
      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid action', async () => {
      // Create match first
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const createReq = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player2.id,
          matchType: 'ticking_bomb',
        }),
      });
      const createRes = await createMatch(createReq);
      const createData = await createRes.json();
      matchCode = createData.match.matchCode;

      // Try invalid action
      const req = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid_action' }),
      });

      const response = await tickingBombAction(req, { params: Promise.resolve({ matchCode }) });
      expect(response.status).toBe(400);
    });

    it('should handle Learning Agent failure gracefully', async () => {
      // Mock Learning Agent failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Create and accept match
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);

      const createReq = new NextRequest('http://localhost/api/versus', {
        method: 'POST',
        body: JSON.stringify({
          opponentId: player2.id,
          matchType: 'ticking_bomb',
        }),
      });
      const createRes = await createMatch(createReq);
      const createData = await createRes.json();
      matchCode = createData.match.matchCode;

      // Accept
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player2.id, email: player2.email },
      } as never);
      const acceptReq = new NextRequest(`http://localhost/api/versus/${matchCode}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' }),
      });
      await updateMatch(acceptReq, { params: Promise.resolve({ matchCode }) });

      // Try to start - should fail
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: player1.id, email: player1.email },
      } as never);
      const startReq = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      });

      const response = await tickingBombAction(startReq, { params: Promise.resolve({ matchCode }) });
      expect(response.status).toBe(500);
    });
  });
});

// ============================================================================
// FULL GAME SIMULATION
// ============================================================================

describe('Ticking Bomb - Full Game Simulation', () => {
  const player1 = {
    id: 'sim-player1',
    email: 'sim1@test.com',
    name: 'Simulator1',
    username: 'sim1',
  };

  const player2 = {
    id: 'sim-player2',
    email: 'sim2@test.com',
    name: 'Simulator2',
    username: 'sim2',
  };

  beforeEach(() => {
    mockDatabase.academyUsers.clear();
    mockDatabase.versusMatches.clear();
    mockDatabase.academyUsers.set(player1.id, player1);
    mockDatabase.academyUsers.set(player2.id, player2);
    vi.clearAllMocks();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        questions: Array.from({ length: 5 }, (_, i) => ({
          id: `sim_q_${i}`,
          question: `Simulation question ${i + 1}?`,
          options: ['A', 'B', 'C', 'D'],
          correct_index: 0,
          topic: 'Test',
          difficulty: 'easy',
          explanation: 'Test explanation',
        })),
        topics_covered: ['Test'],
        certification: 'SAA',
      }),
    });
  });

  it('should complete a full game with multiple passes and an explosion', async () => {
    // 1. Create challenge
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: player1.id, email: player1.email },
    } as never);

    const createReq = new NextRequest('http://localhost/api/versus', {
      method: 'POST',
      body: JSON.stringify({
        opponentId: player2.id,
        matchType: 'ticking_bomb',
      }),
    });
    const createRes = await createMatch(createReq);
    const { match } = await createRes.json();
    const matchCode = match.matchCode;

    // 2. Accept challenge
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: player2.id, email: player2.email },
    } as never);
    const acceptReq = new NextRequest(`http://localhost/api/versus/${matchCode}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'accept' }),
    });
    await updateMatch(acceptReq, { params: Promise.resolve({ matchCode }) });

    // 3. Start game
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: player1.id, email: player1.email },
    } as never);
    const startReq = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
      method: 'POST',
      body: JSON.stringify({ action: 'start' }),
    });
    const startRes = await tickingBombAction(startReq, { params: Promise.resolve({ matchCode }) });
    const startData = await startRes.json();

    expect(startData.success).toBe(true);
    let currentHolder = startData.matchState.currentBombHolder;

    // 4. Simulate 3 passes
    for (let i = 0; i < 3; i++) {
      const holderEmail = currentHolder === player1.id ? player1.email : player2.email;
      const targetId = currentHolder === player1.id ? player2.id : player1.id;

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: currentHolder, email: holderEmail },
      } as never);

      const passReq = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
        method: 'POST',
        body: JSON.stringify({ action: 'pass', targetId }),
      });
      const passRes = await tickingBombAction(passReq, { params: Promise.resolve({ matchCode }) });
      const passData = await passRes.json();

      expect(passData.success).toBe(true);
      expect(passData.matchState.currentQuestion).toBe(i + 1);
      currentHolder = passData.matchState.currentBombHolder;
    }

    // 5. Current holder explodes
    const holderEmail = currentHolder === player1.id ? player1.email : player2.email;
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: currentHolder, email: holderEmail },
    } as never);

    const explodeReq = new NextRequest(`http://localhost/api/versus/${matchCode}/ticking-bomb`, {
      method: 'POST',
      body: JSON.stringify({ action: 'explode' }),
    });
    const explodeRes = await tickingBombAction(explodeReq, { params: Promise.resolve({ matchCode }) });
    const explodeData = await explodeRes.json();

    // 6. Verify game over
    expect(explodeData.success).toBe(true);
    expect(explodeData.gameOver).toBe(true);
    
    const expectedWinner = currentHolder === player1.id ? player2.id : player1.id;
    expect(explodeData.winnerId).toBe(expectedWinner);

    // 7. Verify match is completed in database
    const finalMatch = mockDatabase.versusMatches.get(matchCode);
    expect(finalMatch?.status).toBe('completed');
    expect(finalMatch?.winnerId).toBe(expectedWinner);
  });
});
