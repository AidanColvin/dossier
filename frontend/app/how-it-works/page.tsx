// The full How it works page. A permalink for the same content the info icon
// shows in a slide-over on every page.
import type { Metadata } from "next";
import { HowItWorksContent } from "@/components/shared/HowItWorksContent";

export const metadata: Metadata = { title: "How it works" };

export default function HowItWorksPage() {
  return (
    <main className="page">
      <div className="hiw-page">
        <HowItWorksContent />
      </div>
    </main>
  );
}
