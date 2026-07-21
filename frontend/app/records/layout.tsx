// Metadata for the Records route. The page itself is a client component, so the
// title has to be declared from a server layout wrapping it.
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Records" };

export default function RecordsLayout({ children }: { children: ReactNode }) {
  return children;
}
