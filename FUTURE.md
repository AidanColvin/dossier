# Future work

Deferred from the trust-and-restraint pass. None of these are built yet.

## Deferred

- User accounts and auth.
- Server-persisted watchlists (localStorage recently-viewed is enough for now).
- Annotations on records.
- A fifth data source.
- Advanced search (fielded query, boolean operators).
- The full /compare destination redesign (inline compare and a two-field
  destination both exist; a richer side-by-side can wait).
- A rebuilt "this quarter" strip, showing only strict author-affiliation
  records, once the pattern is proven.
- Company logos or hero imagery.
- A public API.

## Constraints any of these must keep

- No language model in the request path.
- No new API keys and no new paid services.
- Every displayed record keeps a clickable link to its primary source.
- Every financial number links to the filing it came from.
