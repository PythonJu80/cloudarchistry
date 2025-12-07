"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
}

interface BuzzEvent {
  playerId: string;
  playerName: string;
  timestamp: number;
}

interface AnswerResult {
  playerId: string;
  correct: boolean;
  points: number;
  correctAnswer?: number;
  timestamp: number;
}

interface ScoreUpdate {
  player1Score: number;
  player2Score: number;
}

interface MatchStatus {
  status: string;
  winnerId?: string;
}

interface RoomUpdate {
  players: Array<{ userId: string; userName: string }>;
  playerCount: number;
}

interface UseSocketOptions {
  matchCode: string;
  userId: string;
  userName: string;
  onChatMessage?: (msg: ChatMessage) => void;
  onPlayerBuzzed?: (event: BuzzEvent) => void;
  onAnswerResult?: (result: AnswerResult) => void;
  onScoreUpdate?: (scores: ScoreUpdate) => void;
  onMatchStatus?: (status: MatchStatus) => void;
  onNewQuestion?: (question: unknown) => void;
  onRoomUpdate?: (update: RoomUpdate) => void;
  onPlayerDisconnected?: (data: { userId: string; userName: string }) => void;
}

export function useSocket({
  matchCode,
  userId,
  userName,
  onChatMessage,
  onPlayerBuzzed,
  onAnswerResult,
  onScoreUpdate,
  onMatchStatus,
  onNewQuestion,
  onRoomUpdate,
  onPlayerDisconnected,
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!matchCode || !userId) return;

    // Create socket connection
    const socket = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      setIsConnected(true);
      setConnectionError(null);
      
      // Join the match room
      socket.emit("join-match", { matchCode, userId, userName });
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Event listeners
    socket.on("chat-message", (msg: ChatMessage) => {
      onChatMessage?.(msg);
    });

    socket.on("player-buzzed", (event: BuzzEvent) => {
      onPlayerBuzzed?.(event);
    });

    socket.on("answer-result", (result: AnswerResult) => {
      onAnswerResult?.(result);
    });

    socket.on("score-update", (scores: ScoreUpdate) => {
      onScoreUpdate?.(scores);
    });

    socket.on("match-status", (status: MatchStatus) => {
      onMatchStatus?.(status);
    });

    socket.on("new-question", (question: unknown) => {
      onNewQuestion?.(question);
    });

    socket.on("room-update", (update: RoomUpdate) => {
      onRoomUpdate?.(update);
    });

    socket.on("player-disconnected", (data: { userId: string; userName: string }) => {
      onPlayerDisconnected?.(data);
    });

    // Cleanup on unmount
    return () => {
      socket.emit("leave-match", { matchCode });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchCode, userId, userName]);

  // Send chat message
  const sendChatMessage = useCallback((message: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat-message", {
        matchCode,
        message,
        playerId: userId,
        playerName: userName,
      });
    }
  }, [matchCode, userId, userName]);

  // Buzz in
  const buzz = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("buzz", {
        matchCode,
        playerId: userId,
        playerName: userName,
      });
    }
  }, [matchCode, userId, userName]);

  // Submit answer result
  const submitAnswerResult = useCallback((correct: boolean, points: number, correctAnswer?: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("answer-submitted", {
        matchCode,
        playerId: userId,
        correct,
        points,
        correctAnswer,
      });
    }
  }, [matchCode, userId]);

  // Update scores
  const updateScores = useCallback((player1Score: number, player2Score: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("score-update", {
        matchCode,
        player1Score,
        player2Score,
      });
    }
  }, [matchCode]);

  // Send next question
  const sendNextQuestion = useCallback((question: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("next-question", {
        matchCode,
        question,
      });
    }
  }, [matchCode]);

  // Update match status
  const updateMatchStatus = useCallback((status: string, winnerId?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("match-status", {
        matchCode,
        status,
        winnerId,
      });
    }
  }, [matchCode]);

  return {
    isConnected,
    connectionError,
    sendChatMessage,
    buzz,
    submitAnswerResult,
    updateScores,
    sendNextQuestion,
    updateMatchStatus,
  };
}
