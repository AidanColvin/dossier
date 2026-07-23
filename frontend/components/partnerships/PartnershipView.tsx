"use client";

// renders one partnership lookup: the relationship signals, four evidence
// cards (one per source), and the talking points card with copy-all. every
// item links to its primary source; nothing here computes evidence, it only
// displays what the backend attested.

import { Empty, SourceChip, Stat } from "@/components/ui";
import { formatDate, sourceLabel } from "@/lib/format";
import { safeUrl } from "@/lib/safeUrl";
import type {
  PartnershipResponse,
  TalkingPoint,
} from "@/lib/partnershipTypes";

const STRENGTH_TONE: Record<TalkingPoint["strength"], string> = {
  high: "badge--ok",
  medium: "badge--warn",
  low: "badge--neutral",
};

/**
 * given the talking points
 * return them as pasteable plain text, one point per block
 */
function pointsAsText(points: TalkingPoint[]): string {
  return points
    .map((point) => `[${point.category}] ${point.headline}\n> ${point.detail}`)
    .join("\n\n");
}

function TalkingPointsCard({ points }: { points: TalkingPoint[] }) {
  return (
    <section className="card">
      <div className="row" style={{ alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>Talking points</h3>
        <button
          type="button"
          className="chip"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            void navigator.clipboard.writeText(pointsAsText(points));
          }}
        >
          Copy all as text
        </button>
      </div>
      <div className="stack" style={{ gap: 10, marginTop: 10 }}>
        {points.map((point) => (
          <div key={point.headline} className="record">
            <div className="record__body">
              <div className="record__meta" style={{ marginBottom: 2 }}>
                <span style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {point.category}
                </span>
                <span className={`badge ${STRENGTH_TONE[point.strength]}`}>
                  {point.strength}
                </span>
              </div>
              <div className="record__title">{point.headline}</div>
              {point.detail && (
                <div className="record__meta">
                  {safeUrl(point.url) ? (
                    <a href={safeUrl(point.url)} target="_blank" rel="noopener noreferrer">
                      View source
                    </a>
                  ) : (
                    point.detail
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * given a card title, a source key, and rows
 * render one evidence card; an empty card says so instead of hiding
 */
function EvidenceCard({
  title,
  source,
  count,
  children,
}: {
  title: string;
  source: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <SourceChip source={source} count={count} />
      </div>
      <div className="stack" style={{ gap: 8, marginTop: 10 }}>
        {count === 0 ? <Empty>Nothing found in {sourceLabel(source)}.</Empty> : children}
      </div>
    </section>
  );
}

function EvidenceRow({
  title,
  url,
  meta,
}: {
  title: string;
  url: string;
  meta: string;
}) {
  const href = safeUrl(url);
  return (
    <div className="record">
      <div className="record__body">
        <div className="record__title">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {title}
            </a>
          ) : (
            title
          )}
        </div>
        {meta && <div className="record__meta">{meta}</div>}
      </div>
    </div>
  );
}

export function PartnershipView({ data }: { data: PartnershipResponse }) {
  const confirmed = data.signals.filter((s) => s.strength === "confirmed");
  const bannerTone = confirmed.length > 0 ? "notice--info" : "notice--warn";
  const bannerText =
    confirmed.length > 0
      ? `Active relationship: ${confirmed.length} confirmed signal(s) tie ${data.company} to ${data.institution}.`
      : data.signals.length > 0
        ? `Exploratory: real but indirect evidence links ${data.company} to ${data.institution}.`
        : `No confirmed relationship between ${data.company} and ${data.institution} was found.`;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className={`notice ${bannerTone}`}>{bannerText}</p>

      <div className="grid grid--4">
        <Stat label="Signals" value={data.signals.length} />
        <Stat label="Confirmed" value={confirmed.length} tone={confirmed.length ? "pos" : undefined} />
        <Stat
          label="Evidence items"
          value={
            data.papers.length +
            data.trials.length +
            data.faculty_leads.length +
            data.filing_mentions.length
          }
        />
        <Stat label="Lookup time" value={`${data.elapsed_seconds}s`} />
      </div>

      {data.signals.length > 0 && (
        <section className="card">
          <h3 style={{ margin: 0 }}>Relationship signals</h3>
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            {data.signals.map((signal) => (
              <div key={signal.kind + signal.description} className="record">
                <div className="record__body">
                  <div className="record__meta" style={{ marginBottom: 2 }}>
                    <span
                      className={`badge ${signal.strength === "confirmed" ? "badge--ok" : "badge--warn"}`}
                    >
                      {signal.strength}
                    </span>
                  </div>
                  <div className="record__title">
                    {safeUrl(signal.url) ? (
                      <a href={safeUrl(signal.url)} target="_blank" rel="noopener noreferrer">
                        {signal.description}
                      </a>
                    ) : (
                      signal.description
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid--2">
        <EvidenceCard
          title="Filings that mention it"
          source="sec_edgar"
          count={data.filing_mentions.length}
        >
          {data.filing_mentions.map((mention) => (
            <EvidenceRow
              key={mention.accession}
              title={`${mention.form || "Filing"} - ${mention.accession}`}
              url={mention.url}
              meta={`filed ${formatDate(mention.filed)}`}
            />
          ))}
        </EvidenceCard>

        <EvidenceCard
          title="Co-authored research"
          source="openalex"
          count={data.papers.length}
        >
          {data.papers.map((paper) => (
            <EvidenceRow
              key={paper.url + paper.title}
              title={paper.title}
              url={paper.url}
              meta={[paper.journal, formatDate(paper.date)].filter(Boolean).join(" - ")}
            />
          ))}
        </EvidenceCard>

        <EvidenceCard
          title="Trials involving both"
          source="clinicaltrials"
          count={data.trials.length}
        >
          {data.trials.map((trial) => (
            <EvidenceRow
              key={trial.nct_id}
              title={`${trial.nct_id}: ${trial.title}`}
              url={trial.url}
              meta={`${trial.is_joint ? "named collaborator" : "overlap"} - ${trial.status}`}
            />
          ))}
        </EvidenceCard>

        <EvidenceCard
          title="Funded researchers to contact"
          source="nih_reporter"
          count={data.faculty_leads.length}
        >
          {data.faculty_leads.map((lead) => (
            <EvidenceRow
              key={lead.project_num}
              title={`${lead.pi_names.join(", ") || "Project team"} - ${lead.title}`}
              url={lead.url}
              meta={`${lead.project_num} - FY${lead.fiscal_year}${
                lead.award_amount ? ` - $${lead.award_amount.toLocaleString()}` : ""
              }`}
            />
          ))}
        </EvidenceCard>
      </div>

      <TalkingPointsCard points={data.talking_points} />
    </div>
  );
}
