"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Send, Bot, User, Loader2, Trash2 } from "lucide-react";

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

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/chat/conversations")
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeConvo) {
      fetch(`/api/chat/conversations/${activeConvo}/messages`)
        .then((r) => r.json())
        .then((data) => setMessages(data.messages || []))
        .catch(() => {});
    } else {
      setMessages([]);
    }
  }, [activeConvo]);

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

      if (!activeConvo) {
        const convoRes = await fetch("/api/chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userMessage.slice(0, 50) }),
        });
        const convoData = await convoRes.json();
        setActiveConvo(convoData.id);
        setConversations((prev) => [convoData, ...prev]);
      }

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
                } else if (data.type === "done") {
                  setMessages((prev) => [
                    ...prev.filter((m) => m.id !== tempId),
                    { id: tempId, role: "user", content: userMessage, createdAt: new Date().toISOString() },
                    { id: `resp-${Date.now()}`, role: "assistant", content: fullContent, createdAt: new Date().toISOString() },
                  ]);
                  setStreamContent("");
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

  const deleteConversation = async (id: string) => {
    await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
    setConversations(conversations.filter((c) => c.id !== id));
    if (activeConvo === id) {
      setActiveConvo(null);
      setMessages([]);
    }
  };

  const suggestions = [
    "What's on my calendar today?",
    "Log my morning meditation",
    "Summarize my week",
    "Create a todo: review budget",
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
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot className="w-16 h-16 mb-4 opacity-30" />
              <h3 className="text-xl font-medium text-foreground">Your AI Assistant</h3>
              <p className="mt-2 text-center max-w-md">
                Ask me anything — I can create todos, log habits, search your notes, check your calendar, and more.
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