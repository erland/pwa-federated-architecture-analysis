import type {
  Entity,
  SourceSnapshot,
  XmlProfile,
} from "../src/domain/contracts";
import { active, decide, proposals, combined } from "../src/identity/matching";
import { systemsPerUo, systemsForProcess } from "../src/analysis/queries";
function e(source: string, id: string, name: string, type = "app"): Entity {
  return {
    id: source + ":" + id,
    name,
    typeRef: type,
    attributes: source === "excel" ? { uo: "Nord" } : {},
    source: { sourceId: source, recordId: id, snapshotId: source + "hash" },
  };
}
const l = e("excel", "s1", "ÄHS"),
  r = e("xml", "app1", "ÄHS"),
  process = e("xml", "p1", "Ärenden", "process");
const snap = (sourceId: string, entities: Entity[]): SourceSnapshot => ({
  id: sourceId + "hash",
  sourceId,
  fileName: sourceId + ".fixture",
  sha256: "a".repeat(64),
  importedAt: "2026-10-28",
  entities,
  relationships: [],
  warnings: [],
  profileVersion: 1,
});
const excel = snap("excel", [l, e("excel", "s2", "Endast Excel")]),
  xml = {
    ...snap("xml", [r, e("xml", "app2", "Endast XML"), process]),
    relationships: [
      {
        id: "serving1",
        typeRef: "supports",
        sourceId: r.id,
        targetId: process.id,
        source: r.source,
      },
    ],
  };
const p: XmlProfile = {
  elementTypes: {},
  relationshipTypes: {},
  processTypes: ["process"],
  applicationTypes: ["app"],
  paths: [[{ type: "supports", direction: "in" }]],
};
test("A/B independent; C requires explicit confirmation despite identical name", () => {
  expect(systemsPerUo(excel)).toHaveLength(2);
  expect(systemsForProcess(xml, p, process.id)).toHaveLength(1);
  expect(proposals(excel, xml, p, [])).toHaveLength(1);
  expect(combined(excel, xml, p, [], "Nord", process.id).rows).toHaveLength(0);
  const decisions = decide(l, r, "confirmed", []),
    result = combined(excel, xml, p, decisions, "Nord", process.id);
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0].path).toContain("serving1");
  expect(result.coverage).toMatchObject({
    confirmed: 1,
    unresolvedExcel: 1,
    unresolvedXml: 1,
  });
  expect(
    combined(excel, xml, p, decisions, "Syd", process.id).rows,
  ).toHaveLength(0);
});
test("rejected name match is suppressed and never joins", () => {
  const a = decide(l, r, "rejected", []);
  expect(proposals(excel, xml, p, a)).toHaveLength(0);
  expect(combined(excel, xml, p, a, "Nord", process.id).rows).toHaveLength(0);
});
test("different names can be explicitly linked; type mismatch cannot", () => {
  const renamed = { ...r, name: "Ärendehanteringssystem" };
  expect(active(decide(l, renamed, "confirmed", [])[0], l, renamed)).toBe(true);
  expect(() => decide(l, { ...r, typeRef: "other" }, "confirmed", [])).toThrow(
    "samma MMP-typ",
  );
});
test("key reuse or changed source values invalidate decisions; missing source cannot contribute", () => {
  const a = decide(l, r, "confirmed", []);
  expect(active(a[0], l, { ...r, name: "Other" })).toBe(false);
  expect(
    combined(
      excel,
      { ...xml, entities: [{ ...r, name: "Other" }, process] },
      p,
      a,
      "Nord",
      process.id,
    ).coverage.stale,
  ).toBe(1);
  expect(
    combined(
      excel,
      { ...xml, entities: [], relationships: [] },
      p,
      a,
      "Nord",
      process.id,
    ).rows,
  ).toHaveLength(0);
});
test("ambiguous many-to-one confirmation blocked; rejection retracts match", () => {
  const a = decide(l, r, "confirmed", []);
  expect(() => decide(excel.entities[1], r, "confirmed", a)).toThrow(
    "annan bekräftad",
  );
  expect(decide(l, r, "rejected", a)).toHaveLength(1);
  expect(decide(l, r, "rejected", a)[0].decision).toBe("rejected");
});
import { readFileSync } from "node:fs";
import { readWorkbook, stageExcel } from "../src/sources/excel";
import { readArchiMate, stageArchiMate } from "../src/sources/archimate";
import { importMmp } from "../src/metamodel/import";
import { typeRef } from "../src/metamodel/model";
test("end-to-end domain A/B/C with actual XLSX, XML and combined MMP files", async () => {
  const m = await importMmp(
      new Uint8Array(readFileSync("examples/faa-reference.mmp.zip")),
    ),
    t = (id: string) => typeRef(m, id),
    xb = new Uint8Array(readFileSync("examples/systemregister.xlsx")),
    ab = new Uint8Array(readFileSync("examples/architecture.xml"));
  const x = await stageExcel(
    await readWorkbook(xb),
    xb,
    "register.xlsx",
    {
      sheet: "Register",
      headerRow: 1,
      key: "ID",
      name: "System",
      uo: "UO",
      entityType: t("application"),
      uoType: t("unit"),
      relationshipType: t("belongs_to"),
    },
    1,
  );
  const p: XmlProfile = {
    elementTypes: {
      ApplicationComponent: t("application"),
      ApplicationService: t("application_service"),
      BusinessProcess: t("business_process"),
    },
    relationshipTypes: { Serving: t("serving"), Realization: t("realization") },
    processTypes: [t("business_process")],
    applicationTypes: [t("application")],
    paths: [
      [
        { type: t("serving"), direction: "in" },
        { type: t("realization"), direction: "in" },
      ],
    ],
  };
  const a = await stageArchiMate(
      readArchiMate(ab),
      ab,
      "architecture.xml",
      p,
      m,
      1,
    ),
    process = a.entities.find((e) => e.name === "Hantera ärende")!;
  expect(systemsPerUo(x, "Nord").map((r) => r.entity.name)).toEqual([
    "ÄHS",
    "Arkiv",
  ]);
  expect(systemsForProcess(a, p, process.id).map((r) => r.entity.name)).toEqual(
    ["ÄHS"],
  );
  expect(combined(x, a, p, [], "Nord", process.id).rows).toHaveLength(0);
  const confirmed = decide(
    x.entities.find((e) => e.name === "ÄHS")!,
    a.entities.find((e) => e.name === "ÄHS")!,
    "confirmed",
    [],
  );
  const c = combined(x, a, p, confirmed, "Nord", process.id);
  expect(c.rows.map((r) => r.entity.name)).toEqual(["ÄHS"]);
  expect(c.coverage).toMatchObject({
    confirmed: 1,
    unresolvedExcel: 2,
    unresolvedXml: 2,
  });
  expect(c.rows[0].path).toHaveLength(3);
});
