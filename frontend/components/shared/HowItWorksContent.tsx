"use client";

// The "how it works" copy, shared by the full page and the slide-over. Written
// so a skeptical reader trusts the tool in ninety seconds: what it is, the four
// sources, the five stages, what it is not, and what verified means.

import Link from "next/link";

/** Takes an optional flag to show the permalink. Returns the content body. */
export function HowItWorksContent({ showPermalink = false }: { showPermalink?: boolean }) {
  return (
    <div className="hiw">
      <div className="canvas__eyebrow">How it works</div>
      <h1 className="hiw__h1">A pipeline, not a chatbot.</h1>
      <p className="hiw__lede">
        Dossier assembles every public record for a company from four primary
        sources. No language model in the request path. No API keys. Every
        record links back to where it came from.
      </p>

      <h2 className="hiw__h2">What you get</h2>
      <p>
        Search a company and Dossier returns its SEC filings, its research
        papers, the clinical trials it sponsors, and the federal grants that
        name it, in one list. Each record is normalized to the same shape,
        deduplicated across sources, and tagged with the identifier that ties it
        to the company. The company's own reported financials sit on top, read
        from its filings.
      </p>

      <h2 className="hiw__h2">The four sources</h2>
      <ul className="hiw__list">
        <li>
          <strong>SEC EDGAR.</strong> Company filings and XBRL financials,
          resolved by the company's Central Index Key.
        </li>
        <li>
          <strong>OpenAlex.</strong> Research papers, matched by author
          affiliation to the company's research institution, not by keyword.
        </li>
        <li>
          <strong>ClinicalTrials.gov.</strong> Interventional and observational
          studies, matched on the trial's lead sponsor.
        </li>
        <li>
          <strong>NIH RePORTER.</strong> Federally funded projects, matched on
          the awardee organization.
        </li>
      </ul>

      <h2 className="hiw__h2">The five stages</h2>
      <ul className="hiw__list">
        <li>
          <strong>Extract.</strong> Each connector queries its own endpoint in
          parallel. A source that fails is recorded, not fatal.
        </li>
        <li>
          <strong>Transform.</strong> Every result is mapped to one record
          shape, so the four sources read as one list.
        </li>
        <li>
          <strong>Deduplicate.</strong> Records for the same thing are merged
          and their provenance links unioned.
        </li>
        <li>
          <strong>Verify.</strong> Each record keeps the identifier that tied it
          to the company: a CIK, a sponsor, an awardee, an author affiliation.
        </li>
        <li>
          <strong>Summarize.</strong> A deterministic template writes the lede
          sentence from the record metadata. No language model.
        </li>
      </ul>

      <h2 className="hiw__h2">What Dossier is not</h2>
      <p>
        No language model runs in the request path. Nothing is scraped. No
        secondary sources are aggregated. There is no login and no API key.
        There is no record without a link back to its primary source. If a
        number cannot be sourced, it is not shown.
      </p>

      <h2 className="hiw__h2">What verified means</h2>
      <p>
        A record is verified when it carries the identifier that ties it to the
        company. SEC filings match on the Central Index Key. Trials match on the
        lead sponsor. Grants match on the awardee organization. Papers match on
        an author's institutional affiliation. When a match is looser than that,
        the record is labeled unverified rather than dropped.
      </p>

      <h2 className="hiw__h2">Open source</h2>
      <p>
        Dossier is open source. The connectors, the resolver, and the summary
        templates are all in the repository.
      </p>
      <p>
        <a
          className="btn btn--sm"
          href="https://github.com/AidanColvin/dossier"
          target="_blank"
          rel="noopener noreferrer"
        >
          View the source on GitHub
        </a>
      </p>

      <p className="hiw__foot">
        Built by Aidan Colvin. Data from SEC EDGAR, ClinicalTrials.gov, NIH
        RePORTER, OpenAlex.
      </p>

      {showPermalink && (
        <p className="hiw__foot">
          <Link href="/how-it-works">View full page</Link>
        </p>
      )}
    </div>
  );
}
