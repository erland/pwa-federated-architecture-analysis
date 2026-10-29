import type {
  Entity,
  IdentityAssertion,
  SourceSnapshot,
  XmlProfile,
} from "../domain/contracts";
import {
  systemsForProcess,
  systemsPerUo,
  type ResultRow,
} from "../analysis/queries";
export function fingerprint(e: Entity) {
  return JSON.stringify({
    type: e.typeRef,
    name: e.name,
    attributes: Object.fromEntries(
      Object.entries(e.attributes)
        .filter(([key]) => key !== "row")
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  });
}
export function active(a: IdentityAssertion, left: Entity, right: Entity) {
  return (
    a.left === left.id &&
    a.right === right.id &&
    a.leftType === left.typeRef &&
    a.rightType === right.typeRef &&
    a.leftFingerprint === fingerprint(left) &&
    a.rightFingerprint === fingerprint(right)
  );
}
export function decide(
  left: Entity,
  right: Entity,
  decision: IdentityAssertion["decision"],
  existing: IdentityAssertion[],
): IdentityAssertion[] {
  if (
    left.source.sourceId !== "excel" ||
    right.source.sourceId !== "xml" ||
    left.typeRef !== right.typeRef
  )
    throw Error(
      "Identiteter måste koppla system med samma MMP-typ från Excel respektive XML.",
    );
  const rest = existing.filter(
    (a) => a.left !== left.id || a.right !== right.id,
  );
  if (
    decision === "confirmed" &&
    rest.some(
      (a) =>
        a.decision === "confirmed" &&
        (a.left === left.id || a.right === right.id),
    )
  )
    throw Error(
      "Systemet har redan en annan bekräftad koppling. Ta bort den först.",
    );
  return [
    ...rest,
    {
      left: left.id,
      right: right.id,
      decision,
      leftType: left.typeRef,
      rightType: right.typeRef,
      leftFingerprint: fingerprint(left),
      rightFingerprint: fingerprint(right),
    },
  ];
}
export function proposals(
  excel: SourceSnapshot,
  xml: SourceSnapshot,
  p: XmlProfile,
  assertions: IdentityAssertion[],
) {
  const normalize = (s: string) =>
    s.trim().normalize("NFKC").toLocaleLowerCase("sv");
  const byName = new Map<string, Entity[]>(),
    decisions = new Map(
      assertions.map((a) => [JSON.stringify([a.left, a.right]), a]),
    );
  for (const right of xml.entities.filter((e) =>
    p.applicationTypes.includes(e.typeRef),
  )) {
    const key = JSON.stringify([right.typeRef, normalize(right.name)]),
      list = byName.get(key) ?? [];
    list.push(right);
    byName.set(key, list);
  }
  const result: { left: Entity; right: Entity; reason: string }[] = [];
  for (const left of excel.entities.filter((e) => e.attributes.uo))
    for (const right of byName.get(
      JSON.stringify([left.typeRef, normalize(left.name)]),
    ) ?? []) {
      const a = decisions.get(JSON.stringify([left.id, right.id]));
      if (!a || !active(a, left, right))
        result.push({
          left,
          right,
          reason: "Samma namn och typ – kräver bekräftelse",
        });
      if (result.length >= 200) return result;
    }
  return result;
}
export function combined(
  excel: SourceSnapshot,
  xml: SourceSnapshot,
  p: XmlProfile,
  assertions: IdentityAssertion[],
  uo: string,
  processId: string,
): {
  rows: ResultRow[];
  coverage: {
    excelSystems: number;
    xmlSystems: number;
    confirmed: number;
    unresolvedExcel: number;
    unresolvedXml: number;
    stale: number;
  };
  unresolved: Entity[];
} {
  const lefts = excel.entities.filter((e) => e.attributes.uo),
    rights = xml.entities.filter((e) => p.applicationTypes.includes(e.typeRef)),
    leftIndex = new Map(lefts.map((e) => [e.id, e])),
    rightIndex = new Map(rights.map((e) => [e.id, e]));
  const isActive = (a: IdentityAssertion) => {
    const l = leftIndex.get(a.left),
      r = rightIndex.get(a.right);
    return Boolean(l && r && active(a, l, r));
  };
  const confirmed = assertions.filter(
    (a) => a.decision === "confirmed" && isActive(a),
  );
  const processResults = systemsForProcess(xml, p, processId),
    rows: ResultRow[] = [];
  for (const row of systemsPerUo(excel, uo)) {
    const a = confirmed.find((a) => a.left === row.entity.id);
    if (!a) continue;
    for (const hit of processResults.filter((r) => r.entity.id === a.right))
      rows.push({
        ...row,
        path: [...row.path, ...hit.path],
        match: a.left + " ↔ " + a.right,
      });
  }
  const unresolved = [
    ...lefts.filter((l) => !confirmed.some((a) => a.left === l.id)),
    ...rights.filter((r) => !confirmed.some((a) => a.right === r.id)),
  ];
  return {
    rows,
    coverage: {
      excelSystems: lefts.length,
      xmlSystems: rights.length,
      confirmed: confirmed.length,
      unresolvedExcel: lefts.filter(
        (l) => !confirmed.some((a) => a.left === l.id),
      ).length,
      unresolvedXml: rights.filter(
        (r) => !confirmed.some((a) => a.right === r.id),
      ).length,
      stale: assertions.filter((a) => !isActive(a)).length,
    },
    unresolved,
  };
}
