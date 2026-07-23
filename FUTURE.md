# Future work

Deferred items. Several earlier deferrals shipped with the engines pass
(saved runs became Projects, the HTTP API is now public and documented,
the directory covers every listed company); what remains is below.

## Deferred

- User accounts and auth. An optional gate (Firebase free tier, client
  config only) could front the workspace behind an env flag, keeping the
  public demo gateless; it needs a Firebase project created first.
- Annotations on records.
- A fifth data source.
- Advanced search (fielded query, boolean operators).
- The full /compare destination redesign (inline compare and a two-field
  destination both exist; a richer side-by-side can wait).
- A rebuilt "this quarter" strip, showing only strict author-affiliation
  records, once the pattern is proven.
- Company logos or hero imagery.
- Verbatim sentence extraction from 10-K filings for partnership filing
  mentions (the mention and its archive link ship today; quoting the
  sentence needs an HTML fetch path the JSON-only client deliberately
  does not have).
- A shared-store rate limiter for multi-instance deployments (the
  in-memory one is per instance by design).

## Constraints any of these must keep

- No language model in the request path.
- No new API keys and no new paid services.
- Every displayed record keeps a clickable link to its primary source.
- Every financial number links to the filing it came from.
