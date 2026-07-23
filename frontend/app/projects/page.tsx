"use client";

// the projects page at /projects. every saved run lives here: reopening a
// sector or partnership project renders it inline with no re-fetch, and
// reopening a company project restores the saved dossier into the session
// and opens the company page, again with no re-fetch.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, PageHead } from "@/components/ui";
import { PartnershipView } from "@/components/partnerships/PartnershipView";
import { SectorReportView } from "@/components/sector/SectorReportView";
import {
  deleteProject,
  listProjects,
  type ProjectBundle,
} from "@/lib/projects";

const MODE_LABEL: Record<ProjectBundle["mode"], string> = {
  company: "Company",
  sector: "Sector",
  partnership: "Partnership",
};

/**
 * given a saved company bundle
 * restore its run into the session and open the company page; the full page
 * load rehydrates the run store from sessionStorage, so nothing re-fetches
 */
function openCompanyProject(bundle: ProjectBundle): void {
  if (!bundle.company) return;
  try {
    window.sessionStorage.setItem("dossier:run", JSON.stringify(bundle.company));
  } catch {
    // with storage unavailable the company page simply re-runs the pipeline.
  }
  const ticker =
    bundle.company.response.ticker || bundle.company.request.entity || "";
  window.location.href = `/company/${encodeURIComponent(ticker)}`;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectBundle[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProjects(listProjects());
    setHydrated(true);
  }, []);

  const open = projects.find((project) => project.id === openId) ?? null;

  return (
    <main className="page page--wide">
      <div className="canvas">
        <PageHead title="Projects">
          Saved runs. Open one and every panel comes back exactly as it was,
          with no re-fetch.
        </PageHead>

        {hydrated && projects.length === 0 && (
          <Empty>
            Nothing saved yet. Run a <Link href="/sectors">sector scan</Link>,
            a <Link href="/partnerships">partnership lookup</Link>, or a
            company search, then use its save button.
          </Empty>
        )}

        <div className="stack" style={{ gap: 10 }}>
          {projects.map((project) => (
            <div key={project.id} className="record">
              <div className="record__body">
                <div className="record__title">
                  <button
                    type="button"
                    className="linklike"
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      font: "inherit",
                      color: "var(--accent)",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (project.mode === "company") {
                        openCompanyProject(project);
                      } else {
                        setOpenId(openId === project.id ? null : project.id);
                      }
                    }}
                  >
                    {project.name}
                  </button>
                </div>
                <div className="record__meta">
                  <span className="badge badge--neutral">
                    {MODE_LABEL[project.mode]}
                  </span>
                  <span>{project.subject}</span>
                  <span className="record__dot">·</span>
                  <span>{new Date(project.savedAt).toLocaleString()}</span>
                  <button
                    type="button"
                    className="chip"
                    style={{ marginLeft: "auto" }}
                    onClick={() => {
                      deleteProject(project.id);
                      setProjects(listProjects());
                      if (openId === project.id) setOpenId(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {open?.mode === "sector" && open.sector && (
          <div style={{ marginTop: 20 }}>
            <SectorReportView report={open.sector} />
          </div>
        )}

        {open?.mode === "partnership" && open.partnership && (
          <div style={{ marginTop: 20 }}>
            <PartnershipView data={open.partnership} />
          </div>
        )}
      </div>
    </main>
  );
}
