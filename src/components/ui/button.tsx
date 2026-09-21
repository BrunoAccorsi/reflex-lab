import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, ...props }, ref) => (
  <button ref={ref} className={cn("inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-bold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
));
Button.displayName = "Button";
