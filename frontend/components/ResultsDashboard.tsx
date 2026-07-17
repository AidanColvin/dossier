import type { RunResponse } from "@/lib/types";
import { RECORD_TYPES, groupByType, typeLabel } from "@/lib/format";
import RecordCard from "./RecordCard";
import SourceStatusBar from "./SourceStatusBar";
import StatCards from "./StatCards";

interface Props {
  data: RunResponse;
}

export default function ResultsDashboard({ data }: Props) {
  const groups = groupByType(data.records);
  const orderedTypes = RECORD_TYPES.filter((type) => groups[type]?.length);

  return (
    <section className="dashboard">
      <StatCards records={data.records} sources={data.sources} />
      <SourceStatusBar sources={data.sources} />

      {orderedTypes.length === 0 ? (
        <p className="empty">No records for “{data.entity}”. Try a different entity or load the demo data.</p>
      ) : (
        orderedTypes.map((type) => (
          <div className="group" key={type}>
            <h2 className="group__title">
              {typeLabel(type)}
              <span className="group__count">{groups[type].length}</span>
            </h2>
            <div className="group__grid">
              {groups[type].map((record) => (
                <RecordCard key={`${record.source}-${record.native_id}`} record={record} />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
