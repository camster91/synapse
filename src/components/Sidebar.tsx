"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  CheckSquare,
  Target,
  FileText,
  Calendar,
  Trophy,
  BookOpen,
  MessageSquare,
  Puzzle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
} from "lucide-react";
import XpBar from "./XpBar";

interface SidebarProps {
  userName?: string;
  userAvatar?: string;
  userXp?: number;
  userLevel?: number;
  unprocessedCount?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Today" },
  { href: "/inbox", icon: Inbox, label: "Inbox", badge: true },
  { href: "/todos", icon: CheckSquare, label: "Todos" },
  { href: "/habits", icon: Target, label: "Habits" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/journal", icon: BookOpen, label: "Journal" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
];

const secondaryNavItems = [
  { href: "/notes", icon: FileText, label: "Notes" },
  { href: "/goals", icon: Trophy, label: "Goals" },
  { href: "/achievements", icon: Trophy, label: "Achievements" },
  { href: "/plugins", icon: Puzzle, label: "Plugins" },
];

export default function Sidebar({
  userName = "User",
  userAvatar,
  userXp = 0,
  userLevel = 1,
  unprocessedCount = 0,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const navContent = (
    <aside
      className={`flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-foreground tracking-tight">
              Synapse
            </span>
          )}
        </div>
        {/* Close button on mobile */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => {
                    // Close mobile sidebar on nav
                    if (window.innerWidth < 1024) {
                      onMobileClose?.();
                    }
                  }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.badge && unprocessedCount > 0 && (
                    <span className="ml-auto text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-semibold">
                      {unprocessedCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {!collapsed && <p className="px-3 pt-5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">More</p>}
        <ul className="space-y-0.5">
          {secondaryNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return <li key={item.href}><Link href={item.href} onClick={() => { if (window.innerWidth < 1024) onMobileClose?.(); }} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`} title={collapsed ? item.label : undefined}><Icon className="w-5 h-5 flex-shrink-0" />{!collapsed && <span>{item.label}</span>}</Link></li>;
          })}
        </ul>
      </nav>

      {/* Level Badge */}
      {!collapsed && (
        <div className="px-4 py-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-sidebar-accent/50 text-xs">
            <span className="font-semibold text-sidebar-accent-foreground">Lv.{userLevel}</span>
            <XpBar currentXp={userXp} level={userLevel} compact showLabel={false} />
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="px-2 py-1 border-t border-sidebar-border">
        <Link
          href="/settings"
          onClick={() => {
            if (window.innerWidth < 1024) {
              onMobileClose?.();
            }
          }}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }`}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>

      {/* User Profile */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-foreground">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {userName}
              </p>
              <XpBar currentXp={userXp} level={userLevel} compact showLabel={false} />
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-foreground">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Collapse Toggle (desktop only) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center h-8 border-t border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block h-full">{navContent}</div>

      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </div>
    </>
  );
}
