import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@/components/shell/AppShell";
import { RunProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dossier — Multi-Source Intelligence Pipeline",
    template: "%s — Dossier",
  },
  description:
    "Compiles a sourced intelligence profile of any company or organization from four keyless public APIs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* The provider sits above the shell so a dossier loaded on one route
            is still there after navigating to another. */}
        <RunProvider>
          <AppShell>{children}</AppShell>
        </RunProvider>
      </body>
    </html>
  );
}
