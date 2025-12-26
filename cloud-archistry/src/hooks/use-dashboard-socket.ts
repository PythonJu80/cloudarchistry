"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface VersusMatch {
  id: string;
  status: string;
  player1Score: number;
  player2Score: number;
  opponent?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface DashboardUpdate {
  type: "versus" | "challenge" | "journey" | "profile";
  data: unknown;
}

interface UseDashboardSocketOptions {
  userId: string;
  onVersusUpdate?: (matches: VersusMatch[]) => void;
  onChallengeUpdate?: (data: unknown) => void;
  onJourneyUpdate?: (data: unknown) => void;
  onProfileUpdate?: (data: unknown) => void;
  onNotification?: (message: string) => void;
}

export function useDashboardSocket({
  userId,
  onVersusUpdate,
  onChallengeUpdate,
  onJourneyUpdate,
  onProfileUpdate,
  onNotification,
}: UseDashboardSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Store callbacks in refs to avoid reconnection on callback changes
  const callbacksRef = useRef({
    onVersusUpdate,
    onChallengeUpdate,
    onJourneyUpdate,
    onProfileUpdate,
    onNotification,
  });
  
  // Update refs when callbacks change (without triggering reconnect)
  useEffect(() => {
    callbacksRef.current = {
      onVersusUpdate,
      onChallengeUpdate,
      onJourneyUpdate,
      onProfileUpdate,
      onNotification,
    };
  }, [onVersusUpdate, onChallengeUpdate, onJourneyUpdate, onProfileUpdate, onNotification]);

  // Initialize socket connection - only depends on userId
  useEffect(() => {
    if (!userId) return;

    // Create socket connection
    const socket = io({
      path: "/api/socketio",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[DashboardSocket] Connected:", socket.id);
      setIsConnected(true);
      setConnectionError(null);
      
      // Join user's personal room for targeted updates
      socket.emit("join-dashboard", { userId });
    });

    socket.on("disconnect", (reason) => {
      console.log("[DashboardSocket] Disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("[DashboardSocket] Connection error:", error.message);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Dashboard-specific event listeners - use refs to get latest callbacks
    socket.on("dashboard-update", (update: DashboardUpdate) => {
      switch (update.type) {
        case "versus":
          callbacksRef.current.onVersusUpdate?.(update.data as VersusMatch[]);
          break;
        case "challenge":
          callbacksRef.current.onChallengeUpdate?.(update.data);
          break;
        case "journey":
          callbacksRef.current.onJourneyUpdate?.(update.data);
          break;
        case "profile":
          callbacksRef.current.onProfileUpdate?.(update.data);
          break;
      }
    });

    socket.on("versus-update", (matches: VersusMatch[]) => {
      callbacksRef.current.onVersusUpdate?.(matches);
    });

    socket.on("challenge-completed", (data: unknown) => {
      callbacksRef.current.onChallengeUpdate?.(data);
    });

    socket.on("journey-progress", (data: unknown) => {
      callbacksRef.current.onJourneyUpdate?.(data);
    });

    socket.on("notification", (message: string) => {
      callbacksRef.current.onNotification?.(message);
    });

    // Cleanup on unmount
    return () => {
      socket.emit("leave-dashboard", { userId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]); // Only reconnect when userId changes

  // Request a refresh of versus data
  const requestVersusRefresh = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("request-versus-update", { userId });
    }
  }, [userId]);

  // Request a refresh of dashboard data
  const requestDashboardRefresh = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("request-dashboard-update", { userId });
    }
  }, [userId]);

  return {
    isConnected,
    connectionError,
    requestVersusRefresh,
    requestDashboardRefresh,
  };
}
