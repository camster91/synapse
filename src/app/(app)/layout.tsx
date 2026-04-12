"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const handleAddTodo = async (title: string) => {
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status: "INBOX" }),
    });
  };

  const handleAddNote = async (title: string) => {
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: "" }),
    });
  };

  const handleAddInbox = async (content: string) => {
    await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        userName="User"
        userXp={0}
        userLevel={1}
        unprocessedCount={0}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onAddTodo={handleAddTodo}
          onAddNote={handleAddNote}
          onAddInbox={handleAddInbox}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}