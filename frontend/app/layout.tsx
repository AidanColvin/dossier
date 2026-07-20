import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dossier — Multi-Source Intelligence Pipeline",
  description:
    "Compiles a sourced intelligence profile of any company or organization from four keyless public APIs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
