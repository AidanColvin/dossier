"""command-line entry point for the pipeline.

example:
  python -m etl_pipeline.cli --entity "NVIDIA" --ticker NVDA --out ./out
"""
import argparse
import sys
from typing import Optional

from etl_pipeline.config import Config
from etl_pipeline.core.load import ALL_FORMATS
from etl_pipeline.core.pipeline import run
from etl_pipeline.models import Query, RunResult
from etl_pipeline.registry import available_sources


def build_parser() -> argparse.ArgumentParser:
    """
    takes nothing
    return the argument parser for the command-line interface
    """
    parser = argparse.ArgumentParser(
        prog="dossier",
        description="extract public research and company data from several "
                    "keyless sources into json, csv, and sqlite.",
    )
    parser.add_argument("--entity", required=True,
                        help="company or organization name to search for")
    parser.add_argument("--ticker", default="",
                        help="stock ticker, used by the sec edgar source")
    parser.add_argument("--sources", default="",
                        help="comma-separated sources; default is all: "
                             + ", ".join(available_sources()))
    parser.add_argument("--formats", default=",".join(ALL_FORMATS),
                        help="comma-separated output formats to write")
    parser.add_argument("--out", default="out",
                        help="directory to write output files into")
    parser.add_argument("--max-results", type=int, default=10,
                        help="maximum records to request per source")
    parser.add_argument("--min-sources", type=int, default=1,
                        help="distinct reputable sources required to verify a record")
    parser.add_argument("--sequential", action="store_true",
                        help="fetch sources one at a time instead of concurrently")
    return parser


def split_list(value: str) -> Optional[list[str]]:
    """
    given a comma-separated string
    return the trimmed non-empty items, or None when the string is empty
    """
    items = [item.strip() for item in (value or "").split(",") if item.strip()]
    return items or None


def config_from_args(args: argparse.Namespace) -> Config:
    """
    given parsed arguments
    return a Config carrying the result and verification limits
    """
    return Config(max_results_per_source=args.max_results,
                  min_sources_to_verify=args.min_sources)


def query_from_args(args: argparse.Namespace) -> Query:
    """
    given parsed arguments
    return the Query to run
    """
    return Query(entity=args.entity, ticker=args.ticker,
                 max_results=args.max_results)


def summarize(result: RunResult) -> str:
    """
    given a run result
    return a human-readable multi-line summary of what was written
    """
    lines = [f"entity: {result.entity}", f"records: {len(result.records)}"]
    for source_result in result.results:
        state = "ok" if source_result.ok else f"failed ({source_result.error})"
        lines.append(f"  {source_result.source}: "
                     f"{len(source_result.records)} records — {state}")
    for fmt, path in result.outputs.items():
        lines.append(f"wrote {fmt}: {path}")
    return "\n".join(lines)


def main(argv: Optional[list[str]] = None) -> int:
    """
    given optional command-line arguments
    run the pipeline and return a process exit code
    """
    args = build_parser().parse_args(argv)
    result = run(
        query_from_args(args),
        sources=split_list(args.sources),
        out_dir=args.out,
        formats=split_list(args.formats) or list(ALL_FORMATS),
        config=config_from_args(args),
        concurrent=not args.sequential,
    )
    print(summarize(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
