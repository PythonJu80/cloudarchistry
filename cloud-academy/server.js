/**
 * Custom Next.js server with Socket.io integration
 * Run with: node server.js
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "6060", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track match rooms
const matchRooms = new Map(); // matchCode -> Set of { socketId, userId }

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.io
  const io = new Server(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:6060",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Make io available globally for API routes
  global.socketIO = io;

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join a match room
    socket.on("join-match", ({ matchCode, userId, userName }) => {
      socket.join(`match:${matchCode}`);
      
      // Track user in room
      if (!matchRooms.has(matchCode)) {
        matchRooms.set(matchCode, new Map());
      }
      matchRooms.get(matchCode).set(socket.id, { userId, userName });
      
      // Store user info on socket
      socket.data = { matchCode, userId, userName };
      
      console.log(`[Socket] User ${userName} (${userId}) joined match:${matchCode}`);
      
      // Get current players in room
      const players = Array.from(matchRooms.get(matchCode).values());
      
      // Notify everyone in the room about current players
      io.to(`match:${matchCode}`).emit("room-update", { 
        players,
        playerCount: players.length,
      });
    });

    // Leave a match room
    socket.on("leave-match", ({ matchCode }) => {
      socket.leave(`match:${matchCode}`);
      if (matchRooms.has(matchCode)) {
        matchRooms.get(matchCode).delete(socket.id);
        
        // Notify others
        const players = Array.from(matchRooms.get(matchCode).values());
        io.to(`match:${matchCode}`).emit("room-update", { 
          players,
          playerCount: players.length,
        });
      }
      console.log(`[Socket] Socket ${socket.id} left match:${matchCode}`);
    });

    // Chat message - instant broadcast
    socket.on("chat-message", (data) => {
      const { matchCode, message, playerId, playerName } = data;
      
      const chatMsg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        playerId,
        playerName,
        message,
        timestamp: new Date().toISOString(),
      };
      
      // Broadcast to everyone in the match room
      io.to(`match:${matchCode}`).emit("chat-message", chatMsg);
      console.log(`[Socket] Chat in ${matchCode}: ${playerName}: ${message}`);
    });

    // Buzz in - critical for quiz battles!
    socket.on("buzz", (data) => {
      const { matchCode, playerId, playerName } = data;
      
      // Broadcast buzz immediately to everyone
      io.to(`match:${matchCode}`).emit("player-buzzed", {
        playerId,
        playerName,
        timestamp: Date.now(),
      });
      console.log(`[Socket] BUZZ in ${matchCode} by ${playerName}`);
    });

    // Answer submitted
    socket.on("answer-submitted", (data) => {
      const { matchCode, playerId, correct, points, correctAnswer } = data;
      
      io.to(`match:${matchCode}`).emit("answer-result", {
        playerId,
        correct,
        points,
        correctAnswer,
        timestamp: Date.now(),
      });
    });

    // Score update
    socket.on("score-update", (data) => {
      const { matchCode, player1Score, player2Score } = data;
      
      io.to(`match:${matchCode}`).emit("score-update", {
        player1Score,
        player2Score,
      });
    });

    // Next question
    socket.on("next-question", (data) => {
      const { matchCode, question } = data;
      
      io.to(`match:${matchCode}`).emit("new-question", question);
    });

    // Match status change (accepted, started, completed)
    socket.on("match-status", (data) => {
      const { matchCode, status, winnerId } = data;
      
      io.to(`match:${matchCode}`).emit("match-status", {
        status,
        winnerId,
      });
      console.log(`[Socket] Match ${matchCode} status: ${status}`);
    });

    // Generic match update
    socket.on("match-update", (data) => {
      const { matchCode, ...update } = data;
      io.to(`match:${matchCode}`).emit("match-update", update);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      const { matchCode, userId, userName } = socket.data || {};
      
      if (matchCode && matchRooms.has(matchCode)) {
        matchRooms.get(matchCode).delete(socket.id);
        
        // Notify others about disconnect
        const players = Array.from(matchRooms.get(matchCode).values());
        io.to(`match:${matchCode}`).emit("room-update", { 
          players,
          playerCount: players.length,
        });
        io.to(`match:${matchCode}`).emit("player-disconnected", {
          userId,
          userName,
        });
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server running on path: /api/socketio`);
  });
});
