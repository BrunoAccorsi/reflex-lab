import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-ink/10 bg-white shadow-card",
        className,
      )}
      {...props}
    />
  );
}
