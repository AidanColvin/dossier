// saved projects: one finished run under a user-chosen name.
//
// localStorage is the source of truth in the browser, so saves survive a
// refresh on every deployment, including the standalone one with no backend
// and the serverless one whose disk forgets. the backend /projects api is
// the server-side counterpart for deployments with a real volume.

import type { PartnershipResponse } from "./partnershipTypes";
import type { SectorReport } from "./sectorTypes";
import type { RunResult } from "./types";

const STORAGE_KEY = "dossier:projects";
const MAX_PROJECTS = 50;

export type ProjectMode = "company" | "sector" | "partnership";

export interface ProjectBundle {
  id: string;
  name: string;
  mode: ProjectMode;
  subject: string;
  savedAt: number;
  company?: RunResult;
  sector?: SectorReport;
  partnership?: PartnershipResponse;
}

/**
 * takes nothing
 * return every saved project, newest first; corrupt storage reads as empty
 * rather than taking the page down
 */
export function listProjects(): ProjectBundle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const projects = raw ? (JSON.parse(raw) as ProjectBundle[]) : [];
    return projects.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function writeProjects(projects: ProjectBundle[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // quota or private-mode failures are not worth surfacing; the save
    // button simply will not persist in that environment.
  }
}

/**
 * given a project without identity fields
 * save it and return the stored bundle; the oldest saves fall off past the
 * cap so storage can never fill up unbounded
 */
export function saveProject(
  bundle: Omit<ProjectBundle, "id" | "savedAt">
): ProjectBundle {
  const stored: ProjectBundle = {
    ...bundle,
    id: crypto.randomUUID(),
    savedAt: Date.now(),
  };
  const projects = [stored, ...listProjects()].slice(0, MAX_PROJECTS);
  writeProjects(projects);
  return stored;
}

/**
 * given a project id
 * return the saved bundle, or null when absent
 */
export function getProject(id: string): ProjectBundle | null {
  return listProjects().find((project) => project.id === id) ?? null;
}

/**
 * given a project id
 * delete it and return whether anything was deleted
 */
export function deleteProject(id: string): boolean {
  const projects = listProjects();
  const remaining = projects.filter((project) => project.id !== id);
  if (remaining.length === projects.length) return false;
  writeProjects(remaining);
  return true;
}
