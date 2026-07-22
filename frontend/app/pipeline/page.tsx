// Legacy route. Source and pipeline detail now live in the "how it works"
// panel, so this redirects home with the panel open. Kept as a stub for one
// release cycle.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/?info=1");
}
