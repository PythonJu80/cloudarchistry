/**
 * Socket.io API route handler
 * This initializes the socket server when the API is first called
 */

import { NextResponse } from "next/server";
import { Server as SocketIOServer } from "socket.io";

// Store the socket server globally
declare global {
  // eslint-disable-next-line no-var
  var socketIO: SocketIOServer | undefined;
}

export async function GET() {
  // This endpoint is just for health checks
  // The actual socket connection happens via the socket.io client
  return NextResponse.json({ 
    status: "ok",
    socketInitialized: !!global.socketIO,
  });
}
