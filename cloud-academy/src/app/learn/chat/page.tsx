"use client";

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  Send,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Lightbulb,
  X,
  Trash2,
  Plus,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  error?: boolean;
  keyTerms?: Array<{ term: string; category: string }>;
}

interface Thread {
  id: string;
  title: string;
  messages: Message[];
  lastMessageAt: string;
  createdAt: string;
}

interface ExtractedKeyword {
  term: string;
  category: string;
}

const suggestedPrompts = [
  { text: "Explain VPC peering vs Transit Gateway", icon: "🌐" },
  { text: "What should I focus on for SAA-C03?", icon: "🎯" },
  { text: "How does S3 versioning work?", icon: "📦" },
  { text: "Explain Lambda cold starts", icon: "⚡" },
];

function ChatContent() {
  const searchParams = useSearchParams();
  const initialQuestion = searchParams.get("q");
  
  // Thread state
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  
  // Current thread messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKeywords, setShowKeywords] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Edit/delete state
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load threads from database on mount
  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    try {
      const response = await fetch("/api/learn/chat");
      if (response.ok) {
        const data = await response.json();
        setThreads(data);
      }
    } catch (error) {
      console.error("Failed to load threads:", error);
    } finally {
      setLoadingThreads(false);
    }
  };

  // Load thread messages when active thread changes
  useEffect(() => {
    if (activeThreadId) {
      loadThreadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId]);

  const loadThreadMessages = async (threadId: string) => {
    try {
      const response = await fetch(`/api/learn/chat?id=${threadId}`);
      if (response.ok) {
        const data = await response.json();
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        setMessages(msgs.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })));
      }
    } catch (error) {
      console.error("Failed to load thread messages:", error);
    }
  };

  // Handle initial question from URL
  useEffect(() => {
    if (initialQuestion && !loadingThreads && messages.length === 0 && !activeThreadId) {
      handleSend(initialQuestion);
    }
  }, [initialQuestion, loadingThreads]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get key terms from assistant messages (dynamic from agent)
  const extractedKeywords = useMemo(() => {
    const allKeywords: ExtractedKeyword[] = [];
    const seen = new Set<string>();
    
    messages
      .filter(m => m.role === "assistant" && !m.error && m.keyTerms)
      .forEach(m => {
        m.keyTerms?.forEach(kw => {
          if (!seen.has(kw.term.toLowerCase())) {
            seen.add(kw.term.toLowerCase());
            allKeywords.push(kw);
          }
        });
      });
    
    return allKeywords.slice(0, 15);
  }, [messages]);

  // Sync messages to database with debounce
  useEffect(() => {
    if (messages.length === 0) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      setSyncing(true);
      try {
        const response = await fetch("/api/learn/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: activeThreadId,
            messages,
            keywords: extractedKeywords.map(k => k.term),
            topicsDiscussed: [...new Set(extractedKeywords.map(k => k.category))],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.id && !activeThreadId) {
            setActiveThreadId(data.id);
            // Refresh thread list
            loadThreads();
          }
        }
      } catch (error) {
        console.error("Failed to sync:", error);
      } finally {
        setSyncing(false);
      }
    }, 1500);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [messages, activeThreadId, extractedKeywords]);

  // Create new thread
  const createNewThread = () => {
    setActiveThreadId(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  // Delete thread
  const deleteThread = async (threadId: string) => {
    try {
      await fetch(`/api/learn/chat?id=${threadId}`, { method: "DELETE" });
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  };

  // Rename thread
  const renameThread = async (threadId: string) => {
    if (!editTitle.trim()) return;
    try {
      await fetch("/api/learn/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: threadId, title: editTitle }),
      });
      setThreads(prev => prev.map(t => 
        t.id === threadId ? { ...t, title: editTitle } : t
      ));
    } catch (error) {
      console.error("Failed to rename thread:", error);
    }
    setEditingThreadId(null);
    setEditTitle("");
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const askAboutKeyword = (keyword: string) => {
    const prompt = `Can you explain "${keyword}" in more detail? What is it, when would I use it, and what are the key things I should know for AWS certification exams?`;
    handleSend(prompt);
  };

  const handleSend = useCallback(async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: {
            mode: "learning_assistant",
            // Send more history for better context
            history: messages.slice(-20).map(m => ({
              role: m.role,
              content: m.content
            })),
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to get response");
      }

      const assistantMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        role: "assistant",
        content: data.response || data.message || "I couldn't generate a response.",
        timestamp: new Date(),
        keyTerms: data.key_terms || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        role: "assistant",
        content: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        timestamp: new Date(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  useEffect(() => {
    if (initialQuestion && messages.length === 0) {
      const timer = setTimeout(() => {
        handleSend(initialQuestion);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const regenerate = (index: number) => {
    // Find the user message before this assistant message
    const userMessageIndex = index - 1;
    if (userMessageIndex >= 0 && messages[userMessageIndex].role === "user") {
      const userContent = messages[userMessageIndex].content;
      // Remove the last assistant message and regenerate
      setMessages(prev => prev.slice(0, index));
      handleSend(userContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  // Group keywords by category
  const keywordsByCategory = useMemo(() => {
    const grouped: Record<string, ExtractedKeyword[]> = {};
    extractedKeywords.forEach(kw => {
      if (!grouped[kw.category]) grouped[kw.category] = [];
      grouped[kw.category].push(kw);
    });
    return grouped;
  }, [extractedKeywords]);

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-[calc(100vh-160px)] gap-4">
      {/* Thread Sidebar - Always visible */}
      <div className="w-48 border border-border/50 rounded-lg bg-muted/20 flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-2 border-b border-border/50 flex items-center justify-between">
          <span className="text-xs font-medium">Threads</span>
          <button
            onClick={createNewThread}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="New thread"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {/* Thread List */}
        <div className="flex-1 overflow-y-auto p-1.5">
          {loadingThreads ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : threads.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No threads yet
            </p>
          ) : (
            <div className="space-y-0.5">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className={`group relative rounded transition-colors ${
                    activeThreadId === thread.id
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {editingThreadId === thread.id ? (
                    <div className="p-1.5">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameThread(thread.id);
                          if (e.key === "Escape") {
                            setEditingThreadId(null);
                            setEditTitle("");
                          }
                        }}
                        onBlur={() => renameThread(thread.id)}
                        className="w-full px-1.5 py-0.5 text-xs bg-background border border-border rounded"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveThreadId(thread.id)}
                      className="w-full p-1.5 text-left"
                    >
                      <p className="text-xs font-medium truncate">{thread.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(thread.lastMessageAt)}
                      </p>
                    </button>
                  )}
                  
                  {/* Thread Actions */}
                  {activeThreadId === thread.id && editingThreadId !== thread.id && (
                    <div className="absolute right-0.5 top-0.5 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTitle(thread.title);
                          setEditingThreadId(thread.id);
                        }}
                        className="p-0.5 rounded hover:bg-muted"
                        title="Rename"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this thread?")) {
                            deleteThread(thread.id);
                          }
                        }}
                        className="p-0.5 rounded hover:bg-red-500/20 text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 border border-border/50 rounded-lg overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Empty State - ChatGPT Style */
          <div className="h-full flex flex-col items-center justify-center px-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-5">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-semibold mb-2 text-center">How can I help you learn today?</h1>
            <p className="text-muted-foreground text-center mb-6 max-w-sm text-sm">
              Ask me anything about AWS, certifications, and cloud architecture.
            </p>
            
            {/* Suggested Prompts - Stack vertically */}
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt.text)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/50 transition-all text-left group"
                >
                  <span className="text-xl">{prompt.icon}</span>
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    {prompt.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`mb-6 ${message.role === "user" ? "" : ""}`}
              >
                {/* User Message */}
                {message.role === "user" && (
                  <div className="flex justify-end mb-6">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                )}

                {/* Assistant Message */}
                {message.role === "assistant" && (
                  <div className="group">
                    <div className={`prose prose-sm prose-invert max-w-none ${
                      message.error ? "text-red-400" : ""
                    }`}>
                      {message.error ? (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-red-400 font-medium mb-1">Error</p>
                            <p className="text-red-400/80 text-sm">{message.content}</p>
                          </div>
                        </div>
                      ) : (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="mb-4 space-y-2 list-disc list-inside">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-4 space-y-2 list-decimal list-inside">{children}</ol>,
                            li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                            strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                            code: ({ children, className }) => {
                              const isBlock = className?.includes("language-");
                              return isBlock ? (
                                <code className="block bg-muted/50 rounded-lg p-4 text-sm overflow-x-auto mb-4">
                                  {children}
                                </code>
                              ) : (
                                <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm">
                                  {children}
                                </code>
                              );
                            },
                            h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6 first:mt-0">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-semibold mb-3 mt-5 first:mt-0">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-4 first:mt-0">{children}</h3>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      )}
                    </div>

                    {/* Actions */}
                    {!message.error && (
                      <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyMessage(message.id, message.content)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy"
                        >
                          {copiedId === message.id ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => regenerate(index)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Regenerate"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
        </div>

        {/* Input Area - ChatGPT Style */}
        <div className="border-t border-border/50 bg-background p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-muted/50 rounded-2xl border border-border/50 focus-within:border-primary/50 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Learning Assistant..."
                className="flex-1 bg-transparent px-4 py-3 text-sm resize-none focus:outline-none min-h-[48px] max-h-[200px]"
                rows={1}
                disabled={loading}
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                size="icon"
                className="m-1.5 h-9 w-9 rounded-xl shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                AI can make mistakes. Verify important information.
              </p>
              <div className="flex items-center gap-3">
                {syncing && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving...
                  </span>
                )}
                {messages.length > 0 && (
                  <button
                    onClick={createNewThread}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    New thread
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keywords Side Panel */}
      {messages.length > 0 && extractedKeywords.length > 0 && showKeywords && (
        <div className="w-64 border-l border-border/50 bg-muted/20 flex flex-col shrink-0">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium">Key Terms</span>
            </div>
            <button
              onClick={() => setShowKeywords(false)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Click any term to learn more about it
            </p>
            {Object.entries(keywordsByCategory).map(([category, keywords]) => (
              <div key={category} className="mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <button
                      key={kw.term}
                      onClick={() => askAboutKeyword(kw.term)}
                      className="px-2 py-1 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      {kw.term}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toggle keywords panel button when hidden */}
      {messages.length > 0 && extractedKeywords.length > 0 && !showKeywords && (
        <button
          onClick={() => setShowKeywords(true)}
          className="absolute right-4 top-32 p-2 rounded-lg bg-muted border border-border/50 hover:border-primary/50 transition-colors"
          title="Show key terms"
        >
          <Lightbulb className="w-4 h-4 text-amber-400" />
        </button>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100vh-160px)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
