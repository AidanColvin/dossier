# Future work

Items intentionally deferred from the answer-surface redesign. None of these are
built yet.

## Deferred

- **Watchlists and saved companies.** Let a visitor pin companies and return to
  them. Needs either localStorage state or user accounts.
- **User accounts.** Sign-in, per-user saved runs and preferences.
- **Record annotations.** Let a reader add a note to a record and keep it.
- **"Since your last visit" module.** Highlight records that are new since the
  reader last opened a company. Needs localStorage state or accounts to know
  when the last visit was.

## Constraints any of these must keep

- No language model in the request path.
- No new API keys and no new paid services.
- Every displayed record keeps a clickable link to its primary source.
