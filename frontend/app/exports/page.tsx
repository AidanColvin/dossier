// Legacy route. The record view now lives on the company page and the homepage
// is the entry point, so this redirects rather than 404s. Kept as a stub for
// one release cycle.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/");
}
