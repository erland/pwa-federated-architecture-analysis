import { DOMParser, type Element as XmlElement } from "@xmldom/xmldom";
import {
  entityId,
  type XmlProfile,
  type SourceSnapshot,
} from "../domain/contracts";
import { sha256 } from "./safe-zip";
import {
  type ImportedMetamodel,
  validateMappedSnapshot,
} from "../metamodel/model";
const NS = "http://www.opengroup.org/xsd/archimate/3.0/",
  XSI = "http://www.w3.org/2001/XMLSchema-instance";
export interface RawXml {
  modelId: string;
  elements: {
    id: string;
    name: string;
    type: string;
    attributes: Record<string, string>;
  }[];
  relationships: { id: string; type: string; source: string; target: string }[];
}
function children(e: XmlElement, name: string) {
  const out: XmlElement[] = [];
  for (let i = 0; i < e.childNodes.length; i++) {
    const c = e.childNodes.item(i);
    if (
      c?.nodeType === 1 &&
      (c as XmlElement).namespaceURI === NS &&
      (c as XmlElement).localName === name
    )
      out.push(c as XmlElement);
  }
  return out;
}
function one(e: XmlElement, name: string) {
  const all = children(e, name);
  if (all.length > 1) throw Error("Duplicerad XML-behållare: " + name);
  return all[0];
}
function required(e: XmlElement, a: string) {
  const s = e.getAttribute(a)?.trim();
  if (!s) throw Error(`Saknat XML-attribut ${a}.`);
  return s;
}
function type(e: XmlElement) {
  const v = e.getAttributeNS(XSI, "type");
  if (!v) throw Error("Saknad xsi:type.");
  return v.split(":").pop()!;
}
export function readArchiMate(bytes: Uint8Array): RawXml {
  if (bytes.length > 5 * 1024 * 1024) throw Error("XML får vara högst 5 MiB.");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(text) || text.includes("\0"))
    throw Error(
      "DTD, externa entiteter och annan kodning än UTF-8 stöds inte.",
    );
  const doc = new DOMParser({
    onError: (_level, message) => {
      throw Error("Ogiltig XML: " + message);
    },
  }).parseFromString(text, "application/xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "model" || root.namespaceURI !== NS)
    throw Error("Endast ArchiMate Model Exchange 3.x stöds.");
  const todo: { node: XmlElement; depth: number }[] = [
    { node: root, depth: 0 },
  ];
  let count = 0;
  while (todo.length) {
    const { node, depth } = todo.pop()!;
    if (++count > 100000 || depth > 64) throw Error("XML är för stor/djup.");
    for (let i = 0; i < node.childNodes.length; i++) {
      const c = node.childNodes.item(i);
      if (c?.nodeType === 1)
        todo.push({ node: c as XmlElement, depth: depth + 1 });
    }
  }
  const modelId = required(root, "identifier"),
    es = one(root, "elements");
  if (!es) throw Error("XML saknar elements.");
  const elements = children(es, "element").map((e) => {
    const id = required(e, "identifier"),
      names = children(e, "name"),
      name =
        (
          names.find((n) => n.getAttribute("xml:lang") === "sv") ?? names[0]
        )?.textContent?.trim() || id,
      attributes: Record<string, string> = {};
    const props = one(e, "properties");
    if (props)
      for (const p of children(props, "property"))
        attributes["property:" + required(p, "propertyDefinitionRef")] =
          children(p, "value")
            .map((v) => v.textContent ?? "")
            .join(" | ");
    return { id, name, type: type(e), attributes };
  });
  const rs = one(root, "relationships"),
    relationships = rs
      ? children(rs, "relationship").map((e) => ({
          id: required(e, "identifier"),
          type: type(e),
          source: required(e, "source"),
          target: required(e, "target"),
        }))
      : [];
  const ids = new Set<string>();
  for (const e of [...elements, ...relationships]) {
    if (ids.has(e.id)) throw Error("Duplicerat XML-ID: " + e.id);
    ids.add(e.id);
  }
  const elementsById = new Set(elements.map((e) => e.id));
  for (const r of relationships)
    if (!elementsById.has(r.source) || !elementsById.has(r.target))
      throw Error("Relation med okänd ändpunkt: " + r.id);
  if (elements.length > 20000 || relationships.length > 50000)
    throw Error("XML innehåller för många objekt/relationer.");
  return { modelId, elements, relationships };
}
export async function stageArchiMate(
  raw: RawXml,
  bytes: Uint8Array,
  fileName: string,
  p: XmlProfile,
  m: ImportedMetamodel,
  profileVersion: number,
): Promise<SourceSnapshot> {
  if (
    !p.processTypes.length ||
    !p.applicationTypes.length ||
    !p.paths.length ||
    p.paths.some((path) => !path.length || path.length > 5)
  )
    throw Error("Ange process-/systemtyp och en relationskedja (1–5 steg).");
  const hash = await sha256(bytes),
    id = "xml:" + hash,
    record = (key: string) => raw.modelId + "/" + key,
    ref = (key: string) => ({
      sourceId: "xml",
      recordId: record(key),
      snapshotId: id,
    }),
    entity = (key: string) => entityId("xml", record(key));
  const warnings: string[] = [];
  const entities = raw.elements.flatMap((e) => {
    const mapped = p.elementTypes[e.type];
    if (!mapped) {
      warnings.push("Omappad objekttyp: " + e.type + " (" + e.id + ")");
      return [];
    }
    return [
      {
        id: entity(e.id),
        typeRef: mapped,
        name: e.name,
        attributes: { ...e.attributes, xmlType: e.type },
        source: ref(e.id),
      },
    ];
  });
  const known = new Set(entities.map((e) => e.id));
  const relationships = raw.relationships.flatMap((r) => {
    const mapped = p.relationshipTypes[r.type];
    if (
      !mapped ||
      !known.has(entity(r.source)) ||
      !known.has(entity(r.target))
    ) {
      warnings.push("Utelämnad relation: " + r.id + " (omappad typ/ändpunkt)");
      return [];
    }
    return [
      {
        id: entityId("xml-rel", record(r.id)),
        typeRef: mapped,
        sourceId: entity(r.source),
        targetId: entity(r.target),
        source: ref(r.id),
      },
    ];
  });
  if (!entities.length) throw Error("Inga objekt är mappade.");
  for (const path of p.paths)
    for (const step of path)
      if (
        !m.model.relationships.some(
          (r) =>
            m.reference.namespace + "#" + encodeURIComponent(r.id) ===
            step.type,
        ) ||
        !["out", "in"].includes(step.direction)
      )
        throw Error("Okänd relation/riktning i sökväg.");
  const s: SourceSnapshot = {
    id,
    sourceId: "xml",
    fileName,
    sha256: hash,
    importedAt: new Date().toISOString(),
    entities,
    relationships,
    warnings,
    profileVersion,
  };
  validateMappedSnapshot(s, m);
  return s;
}
