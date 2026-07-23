"""saved runs: a small sqlite-backed project store.

one saved project is one finished run (company, sector, or partnership)
under a user-chosen name, reopenable without re-fetching anything. the
browser keeps its own localStorage mirror, so a deployment with an
ephemeral disk still gives visitors durable saves; this store is the
server-side half for deployments with a real volume.
"""
