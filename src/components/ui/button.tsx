import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: "default" | "icon" }
>(({ className, size = "default", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-full text-sm font-bold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50",
      size === "icon" ? "h-10 w-10 p-3" : "px-4 py-2",
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";
