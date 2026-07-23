// link hygiene for rendered record urls.
//
// every url the app displays comes from an external api payload. rendering
// them unchecked would let a poisoned upstream response smuggle javascript:
// or data: links into the page, so anything that is not plain http(s) is
// dropped rather than rendered.

/**
 * given a url from any api payload
 * return it when it is a plain http(s) link, or "" when it is anything
 * else; callers render plain text when this comes back empty
 */
export function safeUrl(url: string): string {
  const trimmed = (url ?? "").trim();
  // control characters can hide a scheme from a naive prefix check.
  if (/[\u0000-\u001f]/.test(trimmed)) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "";
}
