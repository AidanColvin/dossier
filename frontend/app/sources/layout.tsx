// Metadata for the Sources route. The page itself is a client component, so the
// title has to be declared from a server layout wrapping it.
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesLayout({ children }: { children: ReactNode }) {
  return children;
}
