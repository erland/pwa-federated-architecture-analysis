import Ajv from "ajv";
import { importMmp } from "../metamodel/import";
import { typeRef, type ImportedMetamodel } from "../metamodel/model";
import {
  initialType,
  type AnalysisType,
  type XmlProfile,
  type ExcelProfile,
} from "../domain/contracts";
import { sha256 } from "../sources/safe-zip";
const text = { type: "string", minLength: 1, maxLength: 2000 };
const strs = { type: "array", items: text, maxItems: 40, uniqueItems: true };
const map = {
  type: "object",
  maxProperties: 100,
  propertyNames: { not: { enum: ["__proto__", "constructor", "prototype"] } },
  additionalProperties: { type: "string", maxLength: 2000 },
};
const excel = {
  type: "object",
  additionalProperties: false,
  required: [
    "sheet",
    "headerRow",
    "key",
    "name",
    "uo",
    "entityType",
    "uoType",
    "relationshipType",
  ],
  properties: {
    sheet: text,
    headerRow: { type: "integer", minimum: 1, maximum: 20000 },
    key: text,
    name: text,
    uo: text,
    entityType: text,
    uoType: text,
    relationshipType: text,
  },
};
const xml = {
  type: "object",
  additionalProperties: false,
  required: [
    "elementTypes",
    "relationshipTypes",
    "processTypes",
    "applicationTypes",
    "paths",
  ],
  properties: {
    elementTypes: map,
    relationshipTypes: map,
    processTypes: strs,
    applicationTypes: strs,
    paths: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "direction"],
          properties: { type: text, direction: { enum: ["in", "out"] } },
        },
      },
    },
  },
};
const assertion = {
  type: "object",
  additionalProperties: false,
  required: [
    "left",
    "right",
    "decision",
    "leftType",
    "rightType",
    "leftFingerprint",
    "rightFingerprint",
  ],
  properties: {
    left: text,
    right: text,
    decision: { enum: ["confirmed", "rejected"] },
    leftType: text,
    rightType: text,
    leftFingerprint: { type: "string", maxLength: 100000 },
    rightFingerprint: { type: "string", maxLength: 100000 },
  },
};
const reference = {
  type: "object",
  additionalProperties: false,
  required: ["id", "version", "namespace", "sha256"],
  properties: {
    id: text,
    version: text,
    namespace: text,
    sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
  },
};
export const typeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "id",
    "version",
    "name",
    "published",
    "sources",
    "views",
    "identities",
  ],
  properties: {
    schemaVersion: { const: 1 },
    id: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,100}$" },
    version: { type: "integer", minimum: 1 },
    name: { type: "string", minLength: 1, maxLength: 200 },
    published: { type: "boolean" },
    sources: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "format", "keyPolicy"],
        properties: {
          id: { enum: ["excel", "xml"] },
          name: text,
          format: { enum: ["xlsx", "archimate"] },
          keyPolicy: { const: "source-local" },
        },
      },
    },
    views: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "description", "requiredSourceIds"],
        properties: {
          id: { enum: ["A", "B", "C"] },
          name: text,
          description: { type: "string", maxLength: 2000 },
          requiredSourceIds: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            uniqueItems: true,
            items: { enum: ["excel", "xml"] },
          },
        },
      },
    },
    excel,
    xml,
    metamodel: reference,
    identities: { type: "array", maxItems: 10000, items: assertion },
  },
};
const ajv = new Ajv({ allErrors: false }),
  validate = ajv.compile<AnalysisType>(typeSchema);
export function validateType(value: unknown): asserts value is AnalysisType {
  if (!validate(value))
    throw Error("Ogiltig analystyp: " + ajv.errorsText(validate.errors));
  const c = value as AnalysisType;
  if (
    new Set(c.sources.map((s) => s.id)).size !== 2 ||
    c.sources.some(
      (s) => s.format !== (s.id === "excel" ? "xlsx" : "archimate"),
    )
  )
    throw Error("Källkontraktet stöds inte.");
  if (new Set(c.views.map((v) => v.id)).size !== c.views.length)
    throw Error("Duplicerad analysvy.");
  for (const v of c.views) {
    const expected = initialType.views.find(
      (x) => x.id === v.id,
    )!.requiredSourceIds;
    if ([...v.requiredSourceIds].sort().join() !== [...expected].sort().join())
      throw Error("Analysvyn har fel källberoenden: " + v.id);
  }
  const lefts = new Set<string>(),
    rights = new Set<string>(),
    pairs = new Set<string>();
  for (const a of c.identities) {
    const pair = a.left + "|" + a.right;
    if (pairs.has(pair)) throw Error("Duplicerat identitetsbeslut.");
    pairs.add(pair);
    if (
      a.leftType !== a.rightType ||
      !a.left.startsWith("excel:") ||
      !a.right.startsWith("xml:")
    )
      throw Error("Ogiltigt identitetskontrakt.");
    if (a.decision === "confirmed") {
      if (lefts.has(a.left) || rights.has(a.right))
        throw Error("Motstridiga identitetsbeslut.");
      lefts.add(a.left);
      rights.add(a.right);
    }
  }
}
export function validateProfiles(c: AnalysisType, m: ImportedMetamodel) {
  const elements = new Set(
      m.model.elements.filter((e) => !e.abstract).map((e) => typeRef(m, e.id)),
    ),
    relations = new Set(
      m.model.relationships
        .filter((e) => !e.abstract)
        .map((e) => typeRef(m, e.id)),
    );
  if (c.excel) {
    if (
      !elements.has(c.excel.entityType) ||
      !elements.has(c.excel.uoType) ||
      !relations.has(c.excel.relationshipType)
    )
      throw Error("Excel-mappningen har okända/abstrakta MMP-typer.");
  }
  if (c.xml) {
    for (const t of Object.values(c.xml.elementTypes).filter(Boolean))
      if (!elements.has(t)) throw Error("Okänd XML-objekttyp i mappning.");
    for (const t of Object.values(c.xml.relationshipTypes).filter(Boolean))
      if (!relations.has(t)) throw Error("Okänd XML-relationstyp i mappning.");
    for (const t of [...c.xml.processTypes, ...c.xml.applicationTypes])
      if (!elements.has(t)) throw Error("Okänd analystyp i XML-profil.");
    for (const path of c.xml.paths)
      for (const step of path)
        if (!relations.has(step.type)) throw Error("Okänd relationskedja.");
    if (!c.xml.processTypes.length || !c.xml.applicationTypes.length)
      throw Error("Process- och systemtyp saknas.");
  }
}
export function publishType(
  c: AnalysisType,
  m?: ImportedMetamodel,
): AnalysisType {
  validateType(c);
  if (!m || c.metamodel?.sha256 !== m.reference.sha256)
    throw Error("Välj en validerad MMP innan publicering.");
  const required = new Set(c.views.flatMap((v) => v.requiredSourceIds));
  if ((required.has("excel") && !c.excel) || (required.has("xml") && !c.xml))
    throw Error(
      "Importera och spara mappning för vyernas källor före publicering.",
    );
  validateProfiles(c, m);
  return { ...structuredClone(c), published: true };
}
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  return (
    "{" +
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => JSON.stringify(k) + ":" + stableJson(v))
      .join(",") +
    "}"
  );
}
export async function profileHash(p: ExcelProfile | XmlProfile) {
  return sha256(new TextEncoder().encode(stableJson(p)));
}
function encode(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768)
    s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
}
function decode(s: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length > 28 * 1024 * 1024)
    throw Error("Ogiltigt MMP-innehåll.");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
export async function exportTypePackage(
  c: AnalysisType,
  m: ImportedMetamodel,
  includeIdentities = false,
) {
  const type = publishType(c, m);
  if (!includeIdentities) type.identities = [];
  return JSON.stringify(
    {
      format: "faa-analysis-type",
      formatVersion: 1,
      analysisType: type,
      metamodelPackage: encode(m.packageBytes),
    },
    null,
    2,
  );
}
export async function importTypePackage(
  text: string,
): Promise<{ config: AnalysisType; model: ImportedMetamodel }> {
  if (new TextEncoder().encode(text).length > 20 * 1024 * 1024)
    throw Error("Konfigurationsfilen är för stor.");
  const p = JSON.parse(text);
  if (
    p?.format !== "faa-analysis-type" ||
    p.formatVersion !== 1 ||
    Object.keys(p).some(
      (k) =>
        ![
          "format",
          "formatVersion",
          "analysisType",
          "metamodelPackage",
        ].includes(k),
    ) ||
    typeof p.metamodelPackage !== "string"
  )
    throw Error("Konfigurationsformat stöds inte.");
  validateType(p.analysisType);
  if (!p.analysisType.published)
    throw Error("Endast publicerade analystyper kan importeras.");
  const model = await importMmp(decode(p.metamodelPackage)),
    c = p.analysisType as AnalysisType;
  if (stableJson(c.metamodel) !== stableJson(model.reference))
    throw Error("MMP-referensen stämmer inte med paketet.");
  publishType(c, model);
  return { config: c, model };
}
