import type { MetamodelReference, SourceSnapshot } from "../domain/contracts";
export interface TypedRef {
  kind: "element" | "relationship" | "junction";
  id: string;
}
export interface TypeDef {
  id: string;
  name: string;
  extends?: string[];
  abstract?: boolean;
  property_sets?: string[];
}
export interface RelationDef extends TypeDef {
  directed?: boolean;
  source: { types: string[]; typed_refs?: TypedRef[]; cardinality?: string };
  target: { types: string[]; typed_refs?: TypedRef[]; cardinality?: string };
  allowed_type_pairs?: { source: string; target: string }[];
  allowed_typed_pairs?: { source: TypedRef; target: TypedRef }[];
}
export interface ModelDoc {
  metamodel: {
    id: string;
    name: string;
    version: string;
    namespace: string;
    extensions?: {
      mmp_required_capabilities?: { id: string; version: string }[];
    };
  };
  elements: TypeDef[];
  relationships: RelationDef[];
  junctions?: TypeDef[];
}
export interface ImportedMetamodel {
  packageBytes: Uint8Array;
  reference: MetamodelReference;
  formatVersion: string;
  model: ModelDoc;
  documents: Record<string, any>;
  profiles: Record<string, any>;
  effectiveProperties: Record<string, string[]>;
  effectivePairs: Record<string, string[]>;
  warnings: string[];
}
export function typeRef(m: ImportedMetamodel, id: string) {
  return m.reference.namespace + "#" + encodeURIComponent(id);
}
export function localType(m: ImportedMetamodel, ref: string) {
  const prefix = m.reference.namespace + "#";
  if (!ref.startsWith(prefix))
    throw Error("Typen tillhör inte vald MMP-namnrymd: " + ref);
  return decodeURIComponent(ref.slice(prefix.length));
}
export function subtype(
  m: ModelDoc,
  actual: string,
  parent: string,
  seen = new Set<string>(),
): boolean {
  if (actual === parent) return true;
  if (seen.has(actual)) return false;
  seen.add(actual);
  return (m.elements.find((e) => e.id === actual)?.extends ?? []).some((p) =>
    subtype(m, p, parent, new Set(seen)),
  );
}
export function allows(
  m: ImportedMetamodel,
  relationId: string,
  sourceId: string,
  targetId: string,
) {
  const r = m.model.relationships.find((r) => r.id === relationId);
  if (!r || r.abstract) return false;
  const pairs = m.effectivePairs[relationId];
  if (pairs) return pairs.includes(`element:${sourceId}|element:${targetId}`);
  return (
    r.source.types.some((t) => subtype(m.model, sourceId, t)) &&
    r.target.types.some((t) => subtype(m.model, targetId, t))
  );
}
export function validateMappedSnapshot(
  s: SourceSnapshot,
  m: ImportedMetamodel,
) {
  for (const e of s.entities) {
    const id = localType(m, e.typeRef),
      t = m.model.elements.find((t) => t.id === id);
    if (!t || t.abstract) throw Error("Okänd/abstrakt objekttyp: " + id);
  }
  const index = new Map(s.entities.map((e) => [e.id, e]));
  for (const r of s.relationships) {
    const a = index.get(r.sourceId),
      b = index.get(r.targetId);
    if (
      !a ||
      !b ||
      !allows(
        m,
        localType(m, r.typeRef),
        localType(m, a.typeRef),
        localType(m, b.typeRef),
      )
    )
      throw Error("Relationsmappningen tillåter inte ändpunkterna: " + r.id);
  }
}
export function presenceStatus(c: {
  required: boolean;
  cardinality?: string;
  present: boolean;
  value?: unknown;
  default_defined: boolean;
}) {
  const text = c.cardinality ?? "0..*",
    parts = text === "*" ? ["0", "*"] : text.split(".."),
    min = Number(parts[0]),
    max = parts[1] === "*" ? Infinity : Number(parts[1] ?? parts[0]),
    minimum = Math.max(min, c.required ? 1 : 0);
  if (!Number.isFinite(min) || max < minimum) return "invalid_contract";
  if (!c.present) {
    if (c.required) return "missing_required";
    if (minimum > 0) return "insufficient_values";
    return c.default_defined ? "optional_default_available" : "optional_absent";
  }
  if (c.value === null) return "invalid_null";
  const n = Array.isArray(c.value) ? c.value.length : 1;
  return n < minimum
    ? "insufficient_values"
    : n > max
      ? "too_many_values"
      : "satisfied";
}
