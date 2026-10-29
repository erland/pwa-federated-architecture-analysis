import { load, save } from "./db";
import {
  type AnalysisType,
  type AnalysisRun,
  type SourceSnapshot,
} from "../domain/contracts";
import type { ImportedMetamodel } from "../metamodel/model";
export interface Workspace {
  schemaVersion: 1;
  activeTypeId: string;
  types: AnalysisType[];
  models: Record<string, ImportedMetamodel>;
  snapshots: Record<string, SourceSnapshot>;
  history: Record<string, SourceSnapshot>;
  runs: AnalysisRun[];
}
export function emptyWorkspace(): Workspace {
  return {
    schemaVersion: 1,
    activeTypeId: "",
    types: [],
    models: {},
    snapshots: {},
    history: {},
    runs: [],
  };
}
export async function loadWorkspace() {
  const saved = (await load<Workspace>("workspace")) ?? emptyWorkspace();
  // Always start without an active analysis. Saved work is opened explicitly.
  return { ...saved, activeTypeId: "" };
}
export async function saveWorkspace(w: Workspace) {
  await save("workspace", w);
}
export function sourceKey(typeId: string, sourceId: string) {
  return typeId + ":" + sourceId;
}
export function stampedSnapshot(
  s: SourceSnapshot,
  hash: string,
  version: number,
  metamodel: string,
) {
  const id =
    s.id +
    ":" +
    hash.slice(0, 16) +
    ":" +
    metamodel.slice(0, 16) +
    ":" +
    crypto.randomUUID();
  return {
    ...s,
    id,
    profileHash: hash,
    profileVersion: version,
    metamodelSha256: metamodel,
    entities: s.entities.map((e) => ({
      ...e,
      source: { ...e.source, snapshotId: id },
    })),
    relationships: s.relationships.map((r) => ({
      ...r,
      source: { ...r.source, snapshotId: id },
    })),
  };
}
