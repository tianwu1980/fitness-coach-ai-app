"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from "react";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "coach" | "system";
  content: string;
}

interface UserProgress {
  totalMessages: number;
  sessionsCount: number;
  lastSessionDate: string;
  firstSessionDate: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 10;
const STORAGE_PROGRESS = "fc-progress";
const STORAGE_SESSION = "fc-session-id";

const WELCOME =
  "Welcome! I\u2019m your AI fitness coach. I can help with weightlifting programs, yoga guidance, stretching & mobility routines, and nutrition advice.\n\nWhat are you working on today?";

const DEFAULT_PROGRESS: UserProgress = {
  totalMessages: 0,
  sessionsCount: 0,
  lastSessionDate: "",
  firstSessionDate: "",
};

// ─── LocalStorage helpers ───────────────────────────────────────────────────────

function loadProgress(): UserProgress {
  try {
    const raw = localStorage.getItem(STORAGE_PROGRESS);
    return raw ? { ...DEFAULT_PROGRESS, ...JSON.parse(raw) } : { ...DEFAULT_PROGRESS };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

function saveProgress(p: UserProgress) {
  localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(p));
}

function loadSessionId(): string {
  let id = localStorage.getItem(STORAGE_SESSION);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_SESSION, id);
  }
  return id;
}

// ─── Derived values ─────────────────────────────────────────────────────────────

function levelOf(total: number) {
  return Math.floor(total / XP_PER_LEVEL) + 1;
}

function xpOf(total: number) {
  return total % XP_PER_LEVEL;
}

// ─── Inline markdown ────────────────────────────────────────────────────────────

function formatInline(str: string): ReactNode {
  const parts: ReactNode[] = [];
  let rest = str;
  let k = 0;

  while (rest.length > 0) {
    const bold = rest.match(/\*\*(.+?)\*\*/);
    const italic = rest.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);
    const first = [bold, italic]
      .filter(Boolean)
      .sort((a, b) => (a!.index ?? Infinity) - (b!.index ?? Infinity))[0];

    if (!first || first.index === undefined) {
      parts.push(rest);
      break;
    }
    if (first.index > 0) parts.push(rest.slice(0, first.index));

    if (first === bold) {
      parts.push(
        <strong key={k++} className="font-semibold text-text">
          {first[1]}
        </strong>,
      );
    } else {
      parts.push(<em key={k++}>{first[1]}</em>);
    }
    rest = rest.slice(first.index + first[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderMarkdown(text: string): ReactNode[] {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let listItems: string[] = [];
  let listTag: "ul" | "ol" | null = null;
  let key = 0;

  const flush = () => {
    if (!listItems.length || !listTag) return;
    const Tag = listTag;
    elements.push(
      <Tag
        key={key++}
        className={
          Tag === "ul"
            ? "list-disc pl-5 my-1.5 space-y-0.5"
            : "list-decimal pl-5 my-1.5 space-y-0.5"
        }
      >
        {listItems.map((item, i) => (
          <li key={i}>{formatInline(item)}</li>
        ))}
      </Tag>,
    );
    listItems = [];
    listTag = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^[-*]\s+/.test(trimmed)) {
      if (listTag !== "ul") flush();
      listTag = "ul";
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listTag !== "ol") flush();
      listTag = "ol";
      listItems.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }

    flush();
    if (trimmed === "") continue;

    if (/^###\s+/.test(trimmed)) {
      elements.push(
        <p key={key++} className="font-semibold text-sm mt-3 mb-1">
          {formatInline(trimmed.replace(/^###\s+/, ""))}
        </p>,
      );
    } else if (/^##\s+/.test(trimmed)) {
      elements.push(
        <p key={key++} className="font-semibold mt-3 mb-1">
          {formatInline(trimmed.replace(/^##\s+/, ""))}
        </p>,
      );
    } else {
      elements.push(
        <p key={key++} className="my-1 leading-relaxed">
          {formatInline(trimmed)}
        </p>,
      );
    }
  }
  flush();
  return elements;
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center py-2 animate-message-in">
        <span className="text-xs font-medium text-accent bg-accent/10 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-message-in py-1`}
    >
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-accent-dim text-accent rounded-br-sm"
            : "bg-surface-alt text-text rounded-bl-sm"
        }`}
      >
        {isUser ? message.content : renderMarkdown(message.content)}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start py-1 animate-message-in">
      <div className="bg-surface-alt px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-text-dim"
            style={{
              animation: "pulse-dot 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MobileStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-surface rounded-lg px-3 py-2 text-center">
      <p className="text-text font-semibold tabular-nums text-sm">{value}</p>
      <p className="text-text-dim text-xs">{label}</p>
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-text-dim text-sm">{label}</span>
      <span className="text-text font-medium tabular-nums text-sm">
        {value}
      </span>
    </div>
  );
}

function LevelRing({
  level,
  xp,
  animating,
}: {
  level: number;
  xp: number;
  animating: boolean;
}) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - xp / XP_PER_LEVEL);

  return (
    <div className={animating ? "animate-level-up" : ""}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#1E1E2E"
          strokeWidth="4"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-text-dim text-[10px] uppercase tracking-[0.2em]">
          Level
        </span>
        <span className="text-3xl font-bold text-text tabular-nums leading-none mt-0.5">
          {level}
        </span>
      </div>
    </div>
  );
}

function motivationText(level: number): string {
  if (level < 3) return "Every session counts. Keep showing up.";
  if (level < 5) return "Building momentum. Consistency is key.";
  if (level < 10) return "Dedicated. Your commitment is showing.";
  return "Elite consistency. You\u2019re in the top tier.";
}

// ─── Send icon ──────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-text-dim transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);
  const [sessionId, setSessionId] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [levelAnim, setLevelAnim] = useState(false);
  const [mounted, setMounted] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastMsgRef = useRef<string | null>(null);

  // ── Initialise ──────────────────────────────────────────────────────────────

  useEffect(() => {
    setSessionId(loadSessionId());
    setProgress(loadProgress());
    setMessages([{ id: "welcome", role: "coach", content: WELCOME }]);
    setMounted(true);
  }, []);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Session tracking ────────────────────────────────────────────────────────

  const trackSession = useCallback((p: UserProgress): UserProgress => {
    const today = new Date().toISOString().split("T")[0];
    if (p.lastSessionDate === today) return p;
    return {
      ...p,
      sessionsCount: p.sessionsCount + 1,
      lastSessionDate: today,
      firstSessionDate: p.firstSessionDate || today,
    };
  }, []);

  // ── API call ────────────────────────────────────────────────────────────────

  const callWebhook = useCallback(
    async (text: string) => {
      setIsLoading(true);
      setError(null);
      lastMsgRef.current = text;

      try {
        const res = await fetch(process.env.NEXT_PUBLIC_WEBHOOK_URL!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, sessionId }),
        });

        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = await res.json();

        const coachMsg: Message = {
          id: crypto.randomUUID(),
          role: "coach",
          content:
            data.reply || "I couldn\u2019t generate a response. Please try again.",
        };

        // Progress
        const current = loadProgress();
        const tracked = trackSession(current);
        const prevLevel = levelOf(tracked.totalMessages);
        const updated = {
          ...tracked,
          totalMessages: tracked.totalMessages + 1,
        };
        const newLevel = levelOf(updated.totalMessages);
        saveProgress(updated);
        setProgress(updated);

        if (newLevel > prevLevel) {
          setLevelAnim(true);
          setTimeout(() => setLevelAnim(false), 650);
          const lvlMsg: Message = {
            id: crypto.randomUUID(),
            role: "system",
            content: `Level up! You\u2019ve reached Level ${newLevel}`,
          };
          setMessages((prev) => [...prev, coachMsg, lvlMsg]);
        } else {
          setMessages((prev) => [...prev, coachMsg]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, trackSession],
  );

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);
    callWebhook(text);
  }, [input, isLoading, callWebhook]);

  const retry = useCallback(() => {
    if (lastMsgRef.current) callWebhook(lastMsgRef.current);
  }, [callWebhook]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const level = levelOf(progress.totalMessages);
  const xp = xpOf(progress.totalMessages);
  const xpPct = (xp / XP_PER_LEVEL) * 100;
  const memberSince = progress.firstSessionDate
    ? new Date(progress.firstSessionDate + "T00:00:00").toLocaleDateString(
        "en-US",
        { month: "short", year: "numeric" },
      )
    : "Today";

  // ── Loading state ───────────────────────────────────────────────────────────

  if (!mounted) {
    return (
      <div className="h-screen bg-bg flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-bg flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* ── Mobile compact bar ─────────────────────────────────────────────── */}
      <div className="lg:hidden border-b border-border">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center gap-3 text-sm"
        >
          <span className="text-text-dim font-medium text-xs uppercase tracking-wider">
            Lvl
          </span>
          <span
            className={`text-text font-bold tabular-nums ${levelAnim ? "animate-level-up" : ""}`}
          >
            {level}
          </span>
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <span className="text-text-dim tabular-nums text-xs">
            {xp}/{XP_PER_LEVEL}
          </span>
          <ChevronIcon open={mobileOpen} />
        </button>

        {mobileOpen && (
          <div className="px-4 pb-3 grid grid-cols-3 gap-2 animate-message-in">
            <MobileStat label="Messages" value={progress.totalMessages} />
            <MobileStat label="Sessions" value={progress.sessionsCount} />
            <MobileStat
              label="Next Level"
              value={`${XP_PER_LEVEL - xp} to go`}
            />
          </div>
        )}
      </div>

      {/* ── Chat column ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          <h1 className="text-text font-semibold tracking-tight text-[15px]">
            Fitness Coach
          </h1>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && <TypingIndicator />}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 py-2 animate-message-in">
              <span>{error}</span>
              <button
                onClick={retry}
                className="underline hover:text-red-300 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-end gap-2 bg-surface rounded-xl border border-border focus-within:border-accent/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              onInput={(e) => autoResize(e.target as HTMLTextAreaElement)}
              placeholder="Ask your coach anything..."
              disabled={isLoading}
              rows={1}
              className="flex-1 bg-transparent px-4 py-3 text-sm text-text placeholder:text-text-dim resize-none focus:outline-none disabled:opacity-50"
              style={{ maxHeight: 120 }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="p-3 text-accent hover:text-accent/80 disabled:text-text-dim/30 transition-colors"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>

      {/* ── Desktop progress panel ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-72 border-l border-border p-6 gap-6">
        {/* Level ring */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <LevelRing level={level} xp={xp} animating={levelAnim} />
          </div>
          <p className="text-text-dim text-xs tabular-nums">
            {xp} / {XP_PER_LEVEL} to next level
          </p>
        </div>

        {/* Stats */}
        <div>
          <StatRow label="Total Messages" value={progress.totalMessages} />
          <StatRow label="Sessions" value={progress.sessionsCount} />
          <StatRow label="Member Since" value={memberSince} />
        </div>

        {/* Motivation */}
        <div className="mt-auto pt-4 border-t border-border">
          <p className="text-text-dim text-xs leading-relaxed italic">
            {motivationText(level)}
          </p>
        </div>
      </aside>
    </div>
  );
}
