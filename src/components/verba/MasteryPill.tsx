import { cn } from "@/lib/utils";
import { masteryState } from "@/lib/verba/srs";

const STYLES: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  learning: "bg-warning-soft text-accent-foreground",
  familiar: "bg-primary-soft text-primary-deep",
  strong: "bg-success-soft text-success",
  mastered: "bg-primary text-primary-foreground",
};

const LABELS: Record<string, string> = {
  new: "New",
  learning: "Learning",
  familiar: "Familiar",
  strong: "Strong",
  mastered: "Mastered",
};

export function MasteryPill({ mastery, className }: { mastery: number; className?: string }) {
  const state = masteryState(mastery);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-semibold",
        STYLES[state],
        className,
      )}
    >
      {LABELS[state]}
    </span>
  );
}

export function MasteryBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className="bg-hero-gradient h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}
