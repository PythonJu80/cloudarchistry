/**
 * Socket.io server singleton for real-time versus mode and dashboard updates
 */

import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";

// Global socket server instance
let io: SocketIOServer | null = null;

// Track which users are in which match rooms
const matchRooms = new Map<string, Set<string>>(); // matchCode -> Set of socket IDs

// Track dashboard connections by userId
const dashboardUsers = new Map<string, Set<string>>(); // userId -> Set of socket IDs

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXTAUTH_URL || "https://cloudarchistry.com",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join a match room
    socket.on("join-match", (matchCode: string, userId: string) => {
      socket.join(`match:${matchCode}`);
      
      // Track user in room
      if (!matchRooms.has(matchCode)) {
        matchRooms.set(matchCode, new Set());
      }
      matchRooms.get(matchCode)!.add(socket.id);
      
      // Store user info on socket
      socket.data.matchCode = matchCode;
      socket.data.userId = userId;
      
      console.log(`[Socket] User ${userId} joined match:${matchCode}`);
      
      // Notify others in the room
      socket.to(`match:${matchCode}`).emit("player-joined", { userId });
    });

    // Leave a match room
    socket.on("leave-match", (matchCode: string) => {
      socket.leave(`match:${matchCode}`);
      matchRooms.get(matchCode)?.delete(socket.id);
      console.log(`[Socket] Socket ${socket.id} left match:${matchCode}`);
    });

    // Chat message
    socket.on("chat-message", (data: { matchCode: string; message: string; playerId: string; playerName: string }) => {
      // Broadcast to everyone in the match room (including sender for confirmation)
      io?.to(`match:${data.matchCode}`).emit("chat-message", {
        id: `msg-${Date.now()}`,
        playerId: data.playerId,
        playerName: data.playerName,
        message: data.message,
        timestamp: new Date().toISOString(),
      });
    });

    // Buzz in
    socket.on("buzz", (data: { matchCode: string; playerId: string }) => {
      // Broadcast buzz to everyone in match
      io?.to(`match:${data.matchCode}`).emit("player-buzzed", {
        playerId: data.playerId,
        timestamp: Date.now(),
      });
    });

    // Answer submitted
    socket.on("answer-submitted", (data: { matchCode: string; playerId: string; correct: boolean; points: number }) => {
      io?.to(`match:${data.matchCode}`).emit("answer-result", data);
    });

    // Match state update (scores, question, etc.)
    socket.on("match-update", (data: { matchCode: string; update: Record<string, unknown> }) => {
      io?.to(`match:${data.matchCode}`).emit("match-update", data.update);
    });

    // ==========================================
    // DASHBOARD REAL-TIME EVENTS
    // ==========================================

    // Join dashboard room for real-time updates
    socket.on("join-dashboard", (data: { userId: string }) => {
      const { userId } = data;
      socket.join(`dashboard:${userId}`);
      
      // Track user connection
      if (!dashboardUsers.has(userId)) {
        dashboardUsers.set(userId, new Set());
      }
      dashboardUsers.get(userId)!.add(socket.id);
      
      socket.data.dashboardUserId = userId;
      console.log(`[Socket] User ${userId} joined dashboard room`);
    });

    // Leave dashboard room
    socket.on("leave-dashboard", (data: { userId: string }) => {
      const { userId } = data;
      socket.leave(`dashboard:${userId}`);
      dashboardUsers.get(userId)?.delete(socket.id);
      console.log(`[Socket] User ${userId} left dashboard room`);
    });

    // Request versus data refresh (client can request, server will fetch and emit)
    socket.on("request-versus-update", async (data: { userId: string }) => {
      // The actual data fetching happens in the API route that calls emitToUser
      // This is just to acknowledge the request
      console.log(`[Socket] Versus update requested for user ${data.userId}`);
    });

    // Request full dashboard refresh
    socket.on("request-dashboard-update", async (data: { userId: string }) => {
      console.log(`[Socket] Dashboard update requested for user ${data.userId}`);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      const matchCode = socket.data.matchCode;
      if (matchCode) {
        matchRooms.get(matchCode)?.delete(socket.id);
        socket.to(`match:${matchCode}`).emit("player-disconnected", {
          userId: socket.data.userId,
        });
      }
      
      // Clean up dashboard connection
      const dashboardUserId = socket.data.dashboardUserId;
      if (dashboardUserId) {
        dashboardUsers.get(dashboardUserId)?.delete(socket.id);
      }
      
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  console.log("[Socket] Socket.io server initialized");
  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}

// Helper to emit to a specific match room from API routes
export function emitToMatch(matchCode: string, event: string, data: unknown) {
  if (io) {
    io.to(`match:${matchCode}`).emit(event, data);
  }
}

// Helper to emit to a specific user's dashboard
export function emitToUser(userId: string, event: string, data: unknown) {
  if (io) {
    io.to(`dashboard:${userId}`).emit(event, data);
  }
}

// Helper to emit versus updates to a user
export function emitVersusUpdate(userId: string, matches: unknown[]) {
  emitToUser(userId, "versus-update", matches);
}

// Helper to emit challenge completion to a user
export function emitChallengeUpdate(userId: string, data: unknown) {
  emitToUser(userId, "challenge-completed", data);
}

// Helper to emit journey progress to a user
export function emitJourneyUpdate(userId: string, data: unknown) {
  emitToUser(userId, "journey-progress", data);
}

// Helper to send notification to a user
export function emitNotification(userId: string, message: string) {
  emitToUser(userId, "notification", message);
}
