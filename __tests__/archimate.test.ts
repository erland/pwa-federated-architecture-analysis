import { readFileSync } from "node:fs";
import { readArchiMate, stageArchiMate } from "../src/sources/archimate";
import { importMmp } from "../src/metamodel/import";
import { typeRef } from "../src/metamodel/model";
import { systemsForProcess } from "../src/analysis/queries";
import type { XmlProfile } from "../src/domain/contracts";
const bytes = new Uint8Array(readFileSync("examples/architecture.xml"));
export async function xmlFixture() {
  const m = await importMmp(
      new Uint8Array(readFileSync("examples/faa-reference.mmp.zip")),
    ),
    t = (id: string) => typeRef(m, id);
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
  return { m, p, raw: readArchiMate(bytes) };
}
test("representative Exchange XML preserves types, IDs, direction and multihop explanation", async () => {
  const { m, p, raw } = await xmlFixture(),
    s = await stageArchiMate(raw, bytes, "architecture.xml", p, m, 1);
  expect(s.entities).toHaveLength(5);
  expect(s.relationships).toHaveLength(2);
  expect(s.relationships[0].sourceId).toContain("app-1");
  expect(s.relationships[0].targetId).toContain("svc-1");
  const process = s.entities.find((e) => e.name === "Hantera ärende")!;
  const rows = systemsForProcess(s, p, process.id);
  expect(rows.map((r) => r.entity.name)).toEqual(["ÄHS"]);
  expect(rows[0].path).toHaveLength(2);
  expect(s.entities[0].source.recordId).toBe("faa-example/app-1");
  expect(
    systemsForProcess(
      s,
      { ...p, paths: [[{ type: p.paths[0][0].type, direction: "out" }]] },
      process.id,
    ),
  ).toHaveLength(0);
});
test.each([
  '<!DOCTYPE model [<!ENTITY x SYSTEM "https://evil.invalid/">]><model/>',
  '<model xmlns="other"/>',
  "<model><bad></model>",
])("invalid/unsafe XML rejects before publish: %s", (text) =>
  expect(() => readArchiMate(new TextEncoder().encode(text))).toThrow(),
);
test("unresolved endpoint and duplicate ID rejected", () => {
  const s = new TextDecoder().decode(bytes);
  expect(() =>
    readArchiMate(
      new TextEncoder().encode(s.replace('target="svc-1"', 'target="absent"')),
    ),
  ).toThrow("okänd ändpunkt");
  expect(() =>
    readArchiMate(
      new TextEncoder().encode(
        s.replace('identifier="app-2"', 'identifier="app-1"'),
      ),
    ),
  ).toThrow("Duplicerat");
});
test("MMP wrong-direction mapping fails; unmapped objects explicitly warn", async () => {
  const { m, p, raw } = await xmlFixture();
  await expect(
    stageArchiMate(
      raw,
      bytes,
      "bad.xml",
      {
        ...p,
        relationshipTypes: {
          ...p.relationshipTypes,
          Serving: typeRef(m, "belongs_to"),
        },
      },
      m,
      1,
    ),
  ).rejects.toThrow("ändpunkterna");
  const s = await stageArchiMate(
    raw,
    bytes,
    "partial.xml",
    { ...p, elementTypes: { ApplicationComponent: typeRef(m, "application") } },
    m,
    1,
  );
  expect(s.warnings.length).toBeGreaterThan(0);
  expect(s.relationships).toHaveLength(0);
});
