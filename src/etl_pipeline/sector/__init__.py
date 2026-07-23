"""sector scan: turn an industry name into a multi-company sourced report.

resolution never returns empty: a curated seed list is tried first, then live
sec edgar full-text discovery, then a default blue-chip set. the orchestrator
fans the existing single-company pipeline out across the resolved set.
"""
