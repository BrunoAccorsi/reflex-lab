import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/components/trpc-provider";

export const metadata: Metadata = {
  title: "Reflex Lab",
  description: "Fast decisions. Clear confidence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
