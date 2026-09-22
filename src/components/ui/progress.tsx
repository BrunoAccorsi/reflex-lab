import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  const progress = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  return <div className={cn("h-2 overflow-hidden rounded-full bg-ink/10", className)}><div className="progress-fill h-full rounded-full bg-ink transition-all" style={{ "--progress-width": progress } as React.CSSProperties} /></div>;
}
