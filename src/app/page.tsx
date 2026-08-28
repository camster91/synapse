"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-full flex flex-col bg-white dark:bg-gray-950">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">Synapse</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full mb-6">
          Your Second Brain
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white tracking-tight max-w-4xl">
          Think less.{" "}
          <span className="text-indigo-600 dark:text-indigo-400">Do more.</span>
        </h1>
        <p className="mt-6 text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
          Turn goals, tasks, habits, notes, and reflection into one focused daily view.
          Self-host it, export your data, and connect your own AI provider when you choose.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/register"
            className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            Log in
          </Link>
        </div>

        {/* Features grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
          {[
            { icon: "🎯", title: "Habit Tracker", desc: "Build streaks, track daily habits, and watch your XP grow with every completion." },
            { icon: "✅", title: "Smart Todos", desc: "Kanban boards, priorities, subtasks — and an AI that can create them for you." },
            { icon: "📝", title: "Connected Notes", desc: "Notion-style notes with [[backlinks]] that connect your thinking." },
            { icon: "📅", title: "Daily context", desc: "See today’s events beside the priorities and habits that move life forward." },
            { icon: "🏆", title: "Goals & XP", desc: "Link daily tasks to yearly goals. Earn XP, unlock achievements, level up." },
            { icon: "🤖", title: "Optional AI", desc: "Search your notes and review current tasks with your own Anthropic, OpenAI, or Ollama connection." },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Synapse — Your second brain.
      </footer>
    </div>
  );
}
