// Legacy route. Source and pipeline detail now live on the How it works page.
// Kept as a redirect stub for one release cycle.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/how-it-works");
}
