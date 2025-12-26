"use client";

import { useRef, useEffect } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
}

interface ChatSidebarProps {
  messages: ChatMessage[];
  myPlayerId: string;
  opponentOnline: boolean;
  isConnected: boolean;
  chatMessage: string;
  onChatMessageChange: (message: string) => void;
  onSendMessage: () => void;
}

export function ChatSidebar({
  messages,
  myPlayerId,
  opponentOnline,
  isConnected,
  chatMessage,
  onChatMessageChange,
  onSendMessage,
}: ChatSidebarProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Live Chat
          </span>
          {opponentOnline && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Online
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No messages yet. Say hi! 👋
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 rounded-lg text-sm ${
                msg.playerId === myPlayerId ? "bg-primary/20 ml-4" : "bg-muted mr-4"
              }`}
            >
              <p className="font-medium text-xs text-muted-foreground mb-1">
                {msg.playerId === myPlayerId ? "You" : msg.playerName}
              </p>
              <p>{msg.message}</p>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={chatMessage}
            onChange={(e) => onChatMessageChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSendMessage()}
            disabled={!isConnected}
          />
          <Button
            size="icon"
            onClick={onSendMessage}
            disabled={!isConnected || !chatMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
