import { Link } from "@tanstack/react-router";
import { Home, Layers, Plus, RotateCcw, User } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/sets", label: "My Sets", icon: Layers },
  { to: "/add", label: "Add", icon: Plus },
  { to: "/review", label: "Review", icon: RotateCcw },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-float backdrop-blur-lg">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              aria-label={label}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors active:bg-secondary"
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "text-primary" }}
            >
              {label === "Add" ? (
                <span className="bg-accent-gradient -mt-4 flex size-11 items-center justify-center rounded-2xl text-accent-foreground shadow-glow">
                  <Icon className="size-5" strokeWidth={2.6} />
                </span>
              ) : (
                <Icon className="size-5" strokeWidth={2.1} />
              )}
              <span className="text-[0.68rem] font-semibold tracking-tight">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
