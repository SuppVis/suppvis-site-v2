"use client";

interface ResearchToggleProps {
  active: "supplements" | "habits";
  onChange: (tab: "supplements" | "habits") => void;
}

export default function ResearchToggle({ active, onChange }: ResearchToggleProps) {
  return (
    <div className="inline-flex bg-bg-secondary border border-white/10 rounded-full p-1">
      <button
        onClick={() => onChange("supplements")}
        className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
          active === "supplements"
            ? "bg-accent text-bg-primary"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        Supplements
      </button>
      <button
        onClick={() => onChange("habits")}
        className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
          active === "habits"
            ? "bg-habit-gold text-bg-primary"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        Habits
      </button>
    </div>
  );
}
