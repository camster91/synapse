"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Send, Bot, User, Loader2, Trash2, Check, X, Undo2, ShieldCheck } from "lucide-react";
import ResourceLoadError from "@/components/ResourceLoadError";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
}

interface ActionProposal {
  id: string;
  summary: string;
  status: "PENDING" | "APPLIED" | "REJECTED" | "UNDONE" | "EXPIRED";
  expiresAt: string;
  undoExpiresAt?: string | null;
  details?: {
    title: string;
    description: string | null;
    priority: number;
    dueDate: string | null;
    status: string;
  } | null;
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [actions, setActions] = useState<ActionProposal[]>([]);
  const [actionError, setActionError] = useState("");
  const [conversationListError, setConversationListError] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationLoadError, setConversationLoadError] = useState(false);
  const [conversationReloadKey, setConversationReloadKey] = useState(0);
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canUndo = (action: ActionProposal) =>
    action.status === "APPLIED" &&
    Boolean(action.undoExpiresAt) &&
    new Date(action.undoExpiresAt!).getTime() > renderedAt;

  const loadConversations = useCallback(async () => {
    setConversationListError(false);
    try {
      const response = await fetch("/api/chat/conversations");
      if (!response.ok) throw new Error("Conversations request failed");
      const data = await response.json();
      const loadedConversations = Array.isArray(data) ? data : (data.conversations || []);
      setConversations(loadedConversations);
      const requestedConversation = new URLSearchParams(window.location.search).get("conversation");
      if (requestedConversation && loadedConversations.some((conversation: Conversation) => conversation.id === requestedConversation)) {
        setActiveConvo(requestedConversation);
      }
    } catch {
      setConversationListError(true);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeConvo) {
      let cancelled = false;
      setConversationLoading(true);
      setConversationLoadError(false);
      Promise.all([
        fetch(`/api/chat/conversations/${activeConvo}/messages`),
        fetch(`/api/chat/actions?conversationId=${encodeURIComponent(activeConvo)}`),
      ])
        .then(async ([messagesResponse, actionsResponse]) => {
          if (!messagesResponse.ok || !actionsResponse.ok) throw new Error("Conversation request failed");
          const [messageData, actionData] = await Promise.all([messagesResponse.json(), actionsResponse.json()]);
          if (cancelled) return;
          setMessages(Array.isArray(messageData) ? messageData : (messageData.messages || []));
          setActions(Array.isArray(actionData.actions) ? actionData.actions : []);
        })
        .catch(() => {
          if (!cancelled) setConversationLoadError(true);
        })
        .finally(() => {
          if (!cancelled) setConversationLoading(false);
        });
      return () => {
        cancelled = true;
      };
    } else {
      setMessages([]);
      setActions([]);
      setConversationLoading(false);
      setConversationLoadError(false);
    }
  }, [activeConvo, conversationReloadKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const userMessage = input.trim();
    setInput("");

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", content: userMessage, createdAt: new Date().toISOString() }]);
    setStreaming(true);
    setStreamContent("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationId: activeConvo || undefined,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "text") {
                  fullContent += data.content;
                  setStreamContent(fullContent);
                } else if (data.type === "action_proposal" && data.action) {
                  setActions((current) => [...current.filter((action) => action.id !== data.action.id), data.action]);
                } else if (data.type === "done") {
                  setMessages((prev) => [
                    ...prev.filter((m) => m.id !== tempId),
                    { id: tempId, role: "user", content: userMessage, createdAt: new Date().toISOString() },
                    { id: `resp-${Date.now()}`, role: "assistant", content: fullContent, createdAt: new Date().toISOString() },
                  ]);
                  if (data.conversationId && !activeConvo) {
                    setActiveConvo(data.conversationId);
                    // Refresh conversations list to include the new one
                    void loadConversations();
                  }
                }
              } catch {
                fullContent += line.slice(6);
                setStreamContent(fullContent);
              }
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: "Sorry, something went wrong. Please try again.", createdAt: new Date().toISOString() },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  const updateAction = async (id: string, decision: "confirm" | "reject" | "undo") => {
    setUpdatingAction(id);
    setActionError("");
    try {
      const response = await fetch(`/api/chat/actions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action could not be updated");
      setActions((current) => current.map((action) =>
        action.id === id ? { ...action, ...data.action } : action
      ));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action could not be updated");
    } finally {
      setUpdatingAction(null);
    }
  };

  const deleteConversation = async (id: string) => {
    setActionError("");
    try {
      const response = await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Conversation delete failed");
      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (activeConvo === id) {
        setActiveConvo(null);
        setMessages([]);
      }
    } catch {
      setActionError("The conversation could not be deleted. It remains available.");
    }
  };

  const suggestions = [
    "What tasks should I focus on?",
    "Search my notes for project ideas",
    "Propose a task to review my budget",
    "Which habits are incomplete today?",
  ];

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-6">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-sidebar">
        <div className="p-3">
          <button
            onClick={() => { setActiveConvo(null); setMessages([]); }}
            className="w-full flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {conversationListError && (
            <div role="alert" className="mb-2 rounded-lg border border-destructive/30 p-3 text-xs text-sidebar-foreground">
              <p>Unable to load conversations.</p>
              <button type="button" onClick={loadConversations} className="mt-2 min-h-11 font-medium text-primary hover:underline">Try again</button>
            </div>
          )}
          {conversations.map((convo) => (
            <div
              key={convo.id}
              onClick={() => setActiveConvo(convo.id)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm mb-1 group transition-colors ${
                activeConvo === convo.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
              }`}
            >
              <span className="truncate flex-1">{convo.title || "Untitled"}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(convo.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-2 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversationLoadError ? (
            <ResourceLoadError resource="conversation history" onRetry={() => setConversationReloadKey((key) => key + 1)} />
          ) : conversationLoading ? (
            <div className="flex h-full items-center justify-center" aria-label="Loading conversation">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot className="w-16 h-16 mb-4 opacity-30" />
              <h3 className="text-xl font-medium text-foreground">Your AI Assistant</h3>
              <p className="mt-2 text-center max-w-md">
                Ask about your notes, habits, and tasks. I can also propose a new task for you to review before anything changes.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    className="px-3 py-1.5 text-sm rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {actions.map((action) => (
            <div key={action.id} className="mx-auto max-w-2xl rounded-xl border border-primary/30 bg-card p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">AI-proposed action</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{action.summary}</p>
                  {action.details && (
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <dt className="text-muted-foreground">Status</dt><dd className="text-foreground">{action.details.status}</dd>
                      <dt className="text-muted-foreground">Priority</dt><dd className="text-foreground">{action.details.priority}</dd>
                      <dt className="text-muted-foreground">Due</dt><dd className="text-foreground">{action.details.dueDate || "None"}</dd>
                      {action.details.description && <><dt className="text-muted-foreground">Details</dt><dd className="whitespace-pre-wrap text-foreground">{action.details.description}</dd></>}
                    </dl>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {action.status === "PENDING" && "Review required. Nothing has changed yet."}
                    {action.status === "APPLIED" && (canUndo(action) ? "Task created. Undo is available briefly unless you edit the task." : "Task created. The undo window has ended.")}
                    {action.status === "REJECTED" && "Proposal rejected. No task was created."}
                    {action.status === "UNDONE" && "Creation undone."}
                    {action.status === "EXPIRED" && "Proposal expired. No task was created."}
                  </p>
                  {action.status === "PENDING" && (
                    <div className="mt-3 flex gap-2">
                      <button type="button" disabled={updatingAction === action.id} onClick={() => void updateAction(action.id, "confirm")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                        <Check className="h-4 w-4" /> Confirm
                      </button>
                      <button type="button" disabled={updatingAction === action.id} onClick={() => void updateAction(action.id, "reject")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50">
                        <X className="h-4 w-4" /> Reject
                      </button>
                    </div>
                  )}
                  {canUndo(action) && (
                    <button type="button" disabled={updatingAction === action.id} onClick={() => void updateAction(action.id, "undo")} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50">
                      <Undo2 className="h-4 w-4" /> Undo creation
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {actionError && <p className="mx-auto max-w-2xl text-sm text-destructive" role="alert">{actionError}</p>}
          {streaming && streamContent && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="max-w-[70%] px-4 py-3 rounded-2xl bg-card border border-border text-foreground">
                <p className="text-sm whitespace-pre-wrap">{streamContent}</p>
                <span className="inline-block w-2 h-4 bg-primary animate-pulse-subtle ml-1" />
              </div>
            </div>
          )}
          {streaming && !streamContent && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-card border border-border">
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-3 items-end max-w-3xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask Synapse anything..."
              rows={1}
              className="flex-1 px-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              disabled={streaming}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
