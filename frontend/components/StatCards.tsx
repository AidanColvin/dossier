import type { PipelineRecord, SourceStatus } from "@/lib/types";

interface Props {
  records: PipelineRecord[];
  sources: SourceStatus[];
}

interface Stat {
  label: string;
  value: number;
}

function buildStats(records: PipelineRecord[], sources: SourceStatus[]): Stat[] {
  const verified = records.filter((record) => record.verified).length;
  const succeeded = sources.filter((source) => source.ok).length;
  const types = new Set(records.map((record) => record.record_type)).size;
  return [
    { label: "Records", value: records.length },
    { label: "Verified", value: verified },
    { label: "Sources OK", value: succeeded },
    { label: "Record types", value: types },
  ];
}

export default function StatCards({ records, sources }: Props) {
  return (
    <div className="stats">
      {buildStats(records, sources).map((stat) => (
        <div className="stat" key={stat.label}>
          <span className="stat__value">{stat.value}</span>
          <span className="stat__label">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
