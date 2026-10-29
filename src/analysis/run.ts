import { version } from "../../package.json";
import type {
  AnalysisType,
  AnalysisRun,
  SourceSnapshot,
  ViewKind,
} from "../domain/contracts";
import { missingSources } from "../domain/contracts";
import { systemsPerUo, systemsForProcess, type ResultRow } from "./queries";
import { combined } from "../identity/matching";
import { profileHash, publishType } from "../config/packages";
import type { ImportedMetamodel } from "../metamodel/model";
export async function compatibleSnapshot(s: SourceSnapshot, c: AnalysisType) {
  const p = s.sourceId === "excel" ? c.excel : c.xml;
  return Boolean(
    p &&
    s.metamodelSha256 === c.metamodel?.sha256 &&
    s.profileHash === (await profileHash(p)),
  );
}
export async function runAnalysis(
  c: AnalysisType,
  m: ImportedMetamodel | undefined,
  viewId: ViewKind,
  all: SourceSnapshot[],
  parameters: Record<string, string>,
): Promise<AnalysisRun> {
  if (!c.published) throw Error("Publicera analystypen före analys.");
  publishType(c, m);
  const view = c.views.find((v) => v.id === viewId);
  if (!view) throw Error("Analysvyn finns inte i analystypen.");
  const missing = missingSources(view, all);
  if (missing.length)
    throw Error("Saknade obligatoriska källor: " + missing.join(", "));
  const snapshots = all.filter((s) =>
    view.requiredSourceIds.includes(s.sourceId),
  );
  if (new Set(snapshots.map((s) => s.sourceId)).size !== snapshots.length)
    throw Error("Duplicerade källsnapshots.");
  for (const s of snapshots)
    if (!(await compatibleSnapshot(s, c)))
      throw Error("Snapshot har inaktuell mappning/metamodell: " + s.fileName);
  const excel = snapshots.find((s) => s.sourceId === "excel"),
    xml = snapshots.find((s) => s.sourceId === "xml");
  let rows: ResultRow[] = [],
    coverage: Record<string, number> = {};
  const warnings = snapshots.flatMap((s) => s.warnings);
  warnings.push(...(m?.warnings ?? []));
  if (viewId === "A") rows = systemsPerUo(excel!, parameters.uo ?? "");
  else {
    if (
      !parameters.processId ||
      !xml!.entities.some(
        (e) =>
          e.id === parameters.processId &&
          c.xml!.processTypes.includes(e.typeRef),
      )
    )
      throw Error("Välj en process från aktuell XML-källa.");
    if (viewId === "B")
      rows = systemsForProcess(xml!, c.xml!, parameters.processId);
    else {
      const result = combined(
        excel!,
        xml!,
        c.xml!,
        c.identities,
        parameters.uo ?? "",
        parameters.processId,
      );
      rows = result.rows;
      coverage = result.coverage;
      warnings.push(
        `${coverage.unresolvedExcel} olösta system i Excel, ${coverage.unresolvedXml} i XML; ${coverage.stale} inaktuella beslut.`,
      );
    }
  }
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    analysisTypeId: c.id,
    configVersion: c.version,
    viewId,
    snapshots: snapshots.map((s) => ({
      id: s.id,
      sourceId: s.sourceId,
      sha256: s.sha256,
      profileHash: s.profileHash,
      profileVersion: s.profileVersion,
    })),
    metamodel: c.metamodel,
    parameters: { ...parameters },
    resultIds: [...new Set(rows.map((r) => r.entity.id))],
    config: structuredClone(c),
    engineVersion: version,
    results: rows.map((r) => ({
      entityId: r.entity.id,
      name: r.entity.name,
      ...(r.uo ? { uo: r.uo } : {}),
      path: r.path,
      ...(r.match ? { match: r.match } : {}),
    })),
    warnings,
    coverage,
  };
}
