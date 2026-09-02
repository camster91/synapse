"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useApp } from "@/components/Providers";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import GlobalSearchResults from "@/components/GlobalSearchResults";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useApp();
  const [userName, setUserName] = useState("User");
  const [userLevel, setUserLevel] = useState(1);
  const [userXp, setUserXp] = useState(0);
  const [unprocessedCount, setUnprocessedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadUserData() {
      try {
        const [gamificationRes, inboxRes] = await Promise.all([
          fetch("/api/gamification"),
          fetch("/api/inbox?processed=false&countOnly=true"),
        ]);

        if (gamificationRes.ok) {
          const gamData = await gamificationRes.json();
          setUserName(gamData.userName ?? gamData.name ?? "User");
          setUserLevel(gamData.level ?? 1);
          setUserXp(gamData.xp ?? 0);
        }

        if (inboxRes.ok) {
          const inboxData = await inboxRes.json();
          setUnprocessedCount(inboxData.count ?? inboxData.total ?? 0);
        }
      } catch {
        // User data will show defaults; dashboard load will retry
      }
    }
    loadUserData();
  }, []);

  const handleAddTodo = async (title: string) => {
    const response = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status: "INBOX" }),
    });
    if (!response.ok) throw new Error("Todo creation failed");
  };

  const handleAddNote = async (title: string) => {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: "" }),
    });
    if (!response.ok) throw new Error("Note creation failed");
  };

  const handleAddInbox = async (content: string) => {
    const response = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error("Inbox creation failed");
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        userName={userName}
        userXp={userXp}
        userLevel={userLevel}
        unprocessedCount={unprocessedCount}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onSearch={setSearchQuery}
          searchQuery={searchQuery}
          onAddTodo={handleAddTodo}
          onAddNote={handleAddNote}
          onAddInbox={handleAddInbox}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>

      <PWAInstallPrompt />
      {searchQuery.trim() && (
        <GlobalSearchResults query={searchQuery} onQueryChange={setSearchQuery} onClose={() => setSearchQuery("")} />
      )}
    </div>
  );
}
