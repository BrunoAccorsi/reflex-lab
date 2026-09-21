import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" className={cn("rounded-2xl border border-ink/10 bg-[#fff8ec] p-4 text-sm", className)} {...props} />;
}
