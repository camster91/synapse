import Link from "next/link";
import {
  Bot,
  CalendarDays,
  Download,
  Goal,
  ListChecks,
  NotebookTabs,
  ShieldCheck,
  Trophy,
} from "lucide-react";

const features = [
  { icon: Goal, title: "Goals to today", desc: "Choose the priorities that move a larger goal forward instead of maintaining another disconnected list." },
  { icon: ListChecks, title: "A focused daily loop", desc: "Plan priorities, complete habits, triage captures, and deliberately move unfinished work to tomorrow." },
  { icon: NotebookTabs, title: "Connected context", desc: "Keep notes, journal entries, and backlinks beside the work they inform." },
  { icon: CalendarDays, title: "Daily context", desc: "See today’s events beside the priorities and habits that need your attention." },
  { icon: Trophy, title: "Visible momentum", desc: "Build streaks, earn XP, and see consistent progress across goals and habits." },
  { icon: Bot, title: "Optional AI", desc: "Search your notes and review current tasks with your own Anthropic, OpenAI, or Ollama connection." },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-full flex flex-col bg-white dark:bg-gray-950">
      {/* Nav */}
      <nav aria-label="Primary" className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">Synapse</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 rounded-md"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-20 sm:py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full mb-6">
          Private daily operating system
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white tracking-tight max-w-4xl">
          Turn your goals into
          <span className="text-indigo-600 dark:text-indigo-400"> today’s plan.</span>
        </h1>
        <p className="mt-6 text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
          Plan priorities, habits, calendar context, captures, and reflection in one
          focused daily loop—without giving up control of your data. Connect your own AI provider only when it helps.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/register"
            className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            Log in
          </Link>
        </div>

        {/* Features grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <feature.icon aria-hidden="true" className="w-7 h-7 mx-auto mb-3 text-indigo-600 dark:text-indigo-400" strokeWidth={1.8} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>

        <section aria-labelledby="control-heading" className="mt-20 max-w-5xl w-full rounded-3xl bg-gray-950 text-white px-6 py-10 sm:px-10">
          <div className="max-w-2xl mx-auto">
            <ShieldCheck aria-hidden="true" className="w-8 h-8 mx-auto text-indigo-400" />
            <h2 id="control-heading" className="mt-4 text-2xl sm:text-3xl font-bold">Your system should stay yours.</h2>
            <p className="mt-3 text-gray-300">Run Synapse yourself, take a portable export, and add AI only when it helps. Reusable credentials are deliberately excluded from exports.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-gray-200">
              <span className="inline-flex items-center gap-2"><ShieldCheck aria-hidden="true" className="w-4 h-4 text-indigo-400" /> Self-hostable</span>
              <span className="inline-flex items-center gap-2"><Download aria-hidden="true" className="w-4 h-4 text-indigo-400" /> Portable data export</span>
              <span className="inline-flex items-center gap-2"><Bot aria-hidden="true" className="w-4 h-4 text-indigo-400" /> Bring your own AI key</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Synapse — Your second brain.
      </footer>
    </div>
  );
}
