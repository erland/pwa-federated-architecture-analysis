import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parseDocument } from "yaml";
import { safeZip, sha256 } from "../sources/safe-zip";
import {
  type ImportedMetamodel,
  type ModelDoc,
  type TypeDef,
  type RelationDef,
  subtype,
} from "./model";
import schemaHashes from "./schema-hashes.json";
import common from "./schemas/common-definitions.schema.json";
import metaSchema from "./schemas/metamodel.schema.json";
import propSchema from "./schemas/properties.schema.json";
import constraintSchema from "./schemas/constraints.schema.json";
import viewSchema from "./schemas/viewpoints.schema.json";
import notationSchema from "./schemas/notation.schema.json";
import provenanceSchema from "./schemas/provenance.schema.json";
import versionSchema from "./schemas/version.schema.json";
import guidanceSchema from "./schemas/guidance.schema.json";
import manifest10 from "./schemas/mmp-manifest-v1.schema.json";
import manifest11 from "./schemas/mmp-manifest-1-1-candidate.schema.json";
import junctionSchema from "./schemas/mmp-junction-structure-profile.schema.json";
import presenceSchema from "./schemas/mmp-required-default-presence-profile.schema.json";
const schemas: Record<string, any> = {
  metamodel: metaSchema,
  properties: propSchema,
  constraints: constraintSchema,
  viewpoints: viewSchema,
  notation: notationSchema,
  provenance: provenanceSchema,
  version: versionSchema,
  guidance: guidanceSchema,
};
export const supportedCapabilities: Record<string, string> = {
  "mmp-pairwise-relationships": "1.0.0",
  "mmp-typed-endpoints": "1.0.0",
  "mmp-typed-pairs": "1.0.0",
  "mmp-junction-structure": "0.1.0",
  "mmp-required-default-presence": "0.1.0",
};
const decoder = new TextDecoder("utf-8", { fatal: true });
function parse(bytes: Uint8Array) {
  if (!bytes) throw Error("Saknad paketfil.");
  const d = parseDocument(decoder.decode(bytes), {
    uniqueKeys: true,
    schema: "core",
  });
  if (d.errors.length) throw Error("Ogiltig YAML: " + d.errors[0].message);
  const value = d.toJS({ maxAliasCount: 0 });
  let n = 0;
  function walk(v: any, depth: number) {
    if (++n > 100000 || depth > 64) throw Error("För komplex YAML/JSON.");
    if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(k))
          throw Error("Otillåten egenskapsnyckel.");
        walk(x, depth + 1);
      }
  }
  walk(value, 0);
  return value;
}
function validator() {
  const a = new Ajv2020({
    strict: false,
    allErrors: false,
    validateFormats: true,
    addUsedSchema: false,
  });
  addFormats(a);
  a.addSchema(common);
  return a;
}
function check(a: Ajv2020, schema: any, value: unknown, label: string) {
  const validate = (schema.$id && a.getSchema(schema.$id)) || a.compile(schema);
  if (!validate(value))
    throw Error(`Schemafel i ${label}: ${a.errorsText(validate.errors)}`);
}
function unique(items: any[], label: string) {
  const ids = items.map((x) => x.id);
  if (new Set(ids).size !== ids.length) throw Error("Duplicerat ID i " + label);
  return new Set<string>(ids);
}
function graph(types: TypeDef[], label: string) {
  const ids = unique(types, label),
    visited = new Set<string>();
  function visit(id: string, stack: Set<string>) {
    if (stack.has(id)) throw Error("Arvscykel: " + id);
    if (visited.has(id)) return;
    if (!ids.has(id)) throw Error("Okänd supertyp: " + id);
    if (stack.size > 64) throw Error("För djupt arv.");
    for (const p of types.find((x) => x.id === id)?.extends ?? [])
      visit(p, new Set([...stack, id]));
    visited.add(id);
  }
  for (const id of ids) visit(id, new Set());
  return ids;
}
export async function importMmp(bytes: Uint8Array): Promise<ImportedMetamodel> {
  const files = safeZip(bytes, {
    count: 300,
    total: 32 * 1024 * 1024,
    entry: 8 * 1024 * 1024,
    ratio: 200,
  });
  if (Object.keys(files).some((n) => n.endsWith("/")))
    throw Error("MMP får inte innehålla katalogposter.");
  const manifest = parse(files["manifest.yaml"]);
  if (
    manifest?.package_format !== "mmp" ||
    !["1.0.0", "1.1.0"].includes(manifest?.package_format_version)
  )
    throw Error("MMP-format stöds inte.");
  const ajv = validator();
  check(
    ajv,
    manifest.package_format_version === "1.1.0" ? manifest11 : manifest10,
    manifest,
    "manifest",
  );
  const inventory = manifest.files as { path: string; sha256: string }[];
  const names = inventory.map((f) => f.path);
  if (
    new Set(names).size !== names.length ||
    names.includes("manifest.yaml") ||
    Object.keys(files).length !== names.length + 1 ||
    names.some((n) => !files[n])
  )
    throw Error("Manifestets filinventering stämmer inte.");
  for (const f of inventory)
    if ((await sha256(files[f.path])) !== f.sha256)
      throw Error("SHA-256 stämmer inte: " + f.path);
  const packageSchemas: Record<string, any> = {};
  for (const n of names.filter(
    (n) => n.startsWith("schemas/") && n.endsWith(".schema.json"),
  )) {
    if (
      !(schemaHashes as Record<string, string[]>)[n]?.includes(
        await sha256(files[n]),
      )
    )
      throw Error(
        "not_supported: okänt schema, utöka konsumentens granskade schemaurval: " +
          n,
      );
    const s = parse(files[n]);
    if (!s.$id || packageSchemas[s.$id])
      throw Error("Saknat eller duplicerat schema-ID.");
    packageSchemas[s.$id] = s;
  }
  for (const s of Object.values(packageSchemas)) {
    function refs(v: any) {
      if (v && typeof v === "object") {
        if (v.$ref && !v.$ref.startsWith("#")) {
          const ref = v.$ref.split("#")[0];
          if (!/^[a-zA-Z0-9._-]+$/.test(ref) || !files["schemas/" + ref])
            throw Error("Extern/olöst schemareferens: " + v.$ref);
        }
        for (const child of Object.values(v)) refs(child);
      }
    }
    refs(s);
  }
  const packaged = validator();
  packaged.removeSchema(common.$id);
  for (const s of Object.values(packageSchemas)) packaged.addSchema(s);
  const docs: Record<string, any> = {};
  for (const key of Object.keys(manifest.entrypoints)) {
    if (!schemas[key]) throw Error("Okänd canonical entrypoint: " + key);
    const path = manifest.entrypoints[key];
    if (!names.includes(path)) throw Error("Entry point saknas i inventering.");
    const schemaPath = "schemas/" + key + ".schema.json";
    if (!files[schemaPath]) throw Error("Saknat canonical schema: " + key);
    const doc = parse(files[path]);
    check(ajv, schemas[key], doc, key);
    check(packaged, parse(files[schemaPath]), doc, key + " (paketschema)");
    docs[key] = doc;
  }
  const model = docs.metamodel as ModelDoc,
    properties = docs.properties,
    meta = model.metamodel;
  for (const key of ["id", "name", "version", "namespace"] as const)
    if (meta[key] !== manifest.metamodel[key])
      throw Error("Metamodellidentitet stämmer inte: " + key);
  if (docs.version.version.current !== meta.version)
    throw Error("Versionsidentitet stämmer inte.");
  const caps = meta.extensions?.mmp_required_capabilities ?? [];
  if (manifest.package_format_version === "1.1.0") {
    if (JSON.stringify(caps) !== JSON.stringify(manifest.required_capabilities))
      throw Error("Profildeklarationerna stämmer inte.");
  } else if (caps.length)
    throw Error("Obligatoriska profiler stöds inte i MMP 1.0.");
  for (const c of caps)
    if (supportedCapabilities[c.id] !== c.version)
      throw Error(`not_supported: ${c.id}@${c.version}`);
  const has = (id: string) => caps.some((c) => c.id === id);
  const requireCap = (id: string) => {
    if (!has(id)) throw Error("Saknad obligatorisk profil: " + id);
  };
  const elements = graph(model.elements, "element"),
    relations = graph(model.relationships, "relation"),
    junctions = unique(model.junctions ?? [], "junction");
  for (const id of elements)
    if (relations.has(id) || junctions.has(id))
      throw Error("Kolliderande typ-ID.");
  for (const id of relations)
    if (junctions.has(id)) throw Error("Kolliderande junction-ID.");
  if ((model.junctions?.length ?? 0) > 0) requireCap("mmp-typed-endpoints");
  const propertyIds = unique(properties.property_definitions, "property"),
    setIds = unique(properties.property_sets, "property set"),
    dataIds = unique(properties.data_types, "data type"),
    enumIds = unique(properties.enumerations, "enum");
  for (const s of properties.property_sets)
    for (const id of s.properties)
      if (!propertyIds.has(id)) throw Error("Okänd egenskap: " + id);
  for (const p of properties.property_definitions) {
    if (
      (p.type.data_type && !dataIds.has(p.type.data_type)) ||
      (p.type.enumeration && !enumIds.has(p.type.enumeration))
    )
      throw Error("Okänd egenskapstyp.");
  }
  for (const e of properties.enumerations) unique(e.values, "enum values");
  unique(docs.constraints.constraints, "constraints");
  unique(docs.viewpoints.viewpoints, "viewpoints");
  const effectiveProperties: Record<string, string[]> = {};
  const setMap = new Map<string, string[]>(
    properties.property_sets.map((s: any) => [s.id, s.properties]),
  );
  for (const collection of [model.elements, model.relationships]) {
    function props(t: TypeDef): string[] {
      const values = new Set<string>();
      for (const parent of t.extends ?? [])
        for (const prop of props(collection.find((t) => t.id === parent)!))
          values.add(prop);
      for (const id of t.property_sets ?? []) {
        if (!setIds.has(id)) throw Error("Okänd egenskapsgrupp: " + id);
        for (const prop of setMap.get(id)!) values.add(prop);
      }
      return [...values].sort();
    }
    for (const t of collection) effectiveProperties[t.id] = props(t);
  }
  const namespaces: Record<string, Set<string>> = {
    element: elements,
    relationship: relations,
    junction: junctions,
  };
  const key = (r: { kind: string; id: string }) => r.kind + ":" + r.id;
  for (const r of model.relationships) {
    for (const side of ["source", "target"] as const) {
      const end = r[side];
      for (const id of end.types)
        if (!elements.has(id)) throw Error("Okänd ändpunkt: " + id);
      if (end.typed_refs) {
        requireCap("mmp-typed-endpoints");
        const seen = new Set<string>();
        for (const ref of end.typed_refs) {
          if (!namespaces[ref.kind]?.has(ref.id) || seen.has(key(ref)))
            throw Error("Okänd/duplicerad typad ändpunkt.");
          seen.add(key(ref));
        }
        if (
          [...seen]
            .filter((x) => x.startsWith("element:"))
            .sort()
            .join("|") !==
          end.types
            .map((t) => "element:" + t)
            .sort()
            .join("|")
        )
          throw Error("Typade ändpunkter stämmer inte med types.");
      }
    }
    if (r.allowed_typed_pairs) {
      requireCap("mmp-typed-pairs");
      requireCap("mmp-typed-endpoints");
      if (r.allowed_type_pairs) throw Error("Blandade parprofiler.");
      for (const pair of r.allowed_typed_pairs)
        for (const side of ["source", "target"] as const)
          if (!r[side].typed_refs?.some((ref) => key(ref) === key(pair[side])))
            throw Error("Typat par utanför ändpunktsdomän.");
    }
    if (r.allowed_type_pairs) {
      requireCap("mmp-pairwise-relationships");
      for (const p of r.allowed_type_pairs)
        if (!elements.has(p.source) || !elements.has(p.target))
          throw Error("Okänt relationspar.");
    }
  }
  const effectivePairs: Record<string, string[]> = {};
  function pairConstraints(
    r: RelationDef,
    mode: "typed" | "legacy",
  ): Set<string>[] {
    const own = mode === "typed" ? r.allowed_typed_pairs : r.allowed_type_pairs;
    let sets: Set<string>[] = [];
    for (const p of r.extends ?? []) {
      const parent = model.relationships.find((r) => r.id === p)!,
        inherited = pairConstraints(parent, mode);
      if (!inherited.length)
        throw Error("not_supported: ärvd relation utan explicit parprofil.");
      sets.push(...inherited);
    }
    if (own) {
      const pairs = new Set<string>();
      if (mode === "typed")
        for (const p of r.allowed_typed_pairs!)
          pairs.add(key(p.source) + "|" + key(p.target));
      else
        for (const p of r.allowed_type_pairs!)
          for (const a of model.elements.filter(
            (e) => !e.abstract && subtype(model, e.id, p.source),
          ))
            for (const b of model.elements.filter(
              (e) => !e.abstract && subtype(model, e.id, p.target),
            ))
              pairs.add("element:" + a.id + "|element:" + b.id);
      sets.push(pairs);
    }
    return sets;
  }
  function hasPairs(r: RelationDef, mode: "typed" | "legacy"): boolean {
    return (
      Boolean(
        mode === "typed" ? r.allowed_typed_pairs : r.allowed_type_pairs,
      ) ||
      (r.extends ?? []).some((p) =>
        hasPairs(
          model.relationships.find((r) => r.id === p)!,
          mode,
        ),
      )
    );
  }
  for (const r of model.relationships) {
    for (const mode of ["typed", "legacy"] as const)
      if (hasPairs(r, mode)) {
        if (effectivePairs[r.id]) throw Error("Blandad ärvd parsemantik.");
        const sets = pairConstraints(r, mode),
          intersection = [...sets[0]]
            .filter((p) => sets.every((s) => s.has(p)))
            .filter((p) => {
              const [a, b] = p.split("|");
              if (mode === "typed")
                return (
                  r.source.typed_refs?.some((x) => key(x) === a) &&
                  r.target.typed_refs?.some((x) => key(x) === b)
                );
              return (
                r.source.types.some((t) => subtype(model, a.slice(8), t)) &&
                r.target.types.some((t) => subtype(model, b.slice(8), t))
              );
            });
        if (!intersection.length)
          throw Error("Tomt snitt av ärvda relationspar.");
        effectivePairs[r.id] = intersection.sort();
      }
  }
  const profiles: Record<string, any> = {};
  for (const [id, path, schema] of [
    [
      "mmp-junction-structure",
      "documentation/junction-structure.json",
      junctionSchema,
    ],
    [
      "mmp-required-default-presence",
      "documentation/required-default-presence.json",
      presenceSchema,
    ],
  ] as const) {
    if (has(id) !== Boolean(files[path]))
      throw Error("Profildeklaration/fil stämmer inte: " + id);
    if (has(id)) {
      const p = parse(files[path]);
      check(ajv, schema, p, id);
      profiles[id] = p;
      if (
        id === "mmp-junction-structure" &&
        Object.keys(p.junction_operators).sort().join("|") !==
          [...junctions].sort().join("|")
      )
        throw Error("Junctionoperatorerna stämmer inte.");
    }
  }
  const warnings = [
    "Begränsad MMP-profilkonsument: ingen full Core-/instanskonformitet, junctionaktivering eller generell regelutvärdering.",
  ];
  for (const c of docs.constraints.constraints)
    warnings.push(
      `not_supported: constraint ${c.id} (${c.rule?.language ?? "okänt språk"})`,
    );
  return {
    packageBytes: new Uint8Array(bytes),
    reference: {
      id: meta.id,
      version: meta.version,
      namespace: meta.namespace,
      sha256: await sha256(bytes),
    },
    formatVersion: manifest.package_format_version,
    model,
    documents: docs,
    profiles,
    effectiveProperties,
    effectivePairs,
    warnings,
  };
}
