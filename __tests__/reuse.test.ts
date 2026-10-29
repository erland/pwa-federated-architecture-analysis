import ExcelJS from "exceljs";
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import {
  importTypePackage,
  exportTypePackage,
  publishType,
  profileHash,
  validateType,
} from "../src/config/packages";
import { runAnalysis, compatibleSnapshot } from "../src/analysis/run";
import {
  emptyWorkspace,
  loadWorkspace,
  saveWorkspace,
  sourceKey,
  stampedSnapshot,
} from "../src/storage/workspace";
import { readWorkbook, stageExcel } from "../src/sources/excel";
import { readArchiMate, stageArchiMate } from "../src/sources/archimate";
import { decide } from "../src/identity/matching";
const example = () => readFileSync("examples/analysis-type.json", "utf8");
async function prepared() {
  const { config, model } = await importTypePackage(example());
  const b = new Uint8Array(readFileSync("examples/systemregister.xlsx"));
  const excel = stampedSnapshot(
    await stageExcel(
      await readWorkbook(b),
      b,
      "register.xlsx",
      config.excel!,
      config.version,
    ),
    await profileHash(config.excel!),
    config.version,
    model.reference.sha256,
  );
  return { config, model, b, excel };
}
test("fresh session imports published type and runs A using only its XLSX dependency", async () => {
  const { config, model, excel } = await prepared();
  const w = emptyWorkspace();
  w.types = [config];
  w.activeTypeId = config.id;
  w.models[model.reference.sha256] = model;
  w.snapshots[sourceKey(config.id, "excel")] = excel;
  w.history[excel.id] = excel;
  await saveWorkspace(w);
  const reopened = await loadWorkspace();
  expect(reopened.types[0].published).toBe(true);
  expect(reopened.models[model.reference.sha256].packageBytes).toEqual(
    model.packageBytes,
  );
  const run = await runAnalysis(reopened.types[0], model, "A", [excel], {
    uo: "Nord",
  });
  expect(run.results?.map((r) => r.name)).toEqual(["ÄHS", "Arkiv"]);
  expect(run.snapshots.map((s) => s.sourceId)).toEqual(["excel"]);
  expect(run.configVersion).toBe(config.version);
  expect(run.snapshots[0].profileHash).toBe(excel.profileHash);
});
test("configuration export omits data and identity decisions unless explicitly requested", async () => {
  const { config, model, excel } = await prepared();
  const ab = new Uint8Array(readFileSync("examples/architecture.xml")),
    xml = await stageArchiMate(
      readArchiMate(ab),
      ab,
      "architecture.xml",
      config.xml!,
      model,
      1,
    );
  config.identities = decide(
    excel.entities.find((e) => e.name === "ÄHS")!,
    xml.entities.find((e) => e.name === "ÄHS")!,
    "confirmed",
    [],
  );
  const text = await exportTypePackage(config, model);
  expect(JSON.parse(text).analysisType.identities).toEqual([]);
  expect(Object.keys(JSON.parse(text))).toEqual([
    "format",
    "formatVersion",
    "analysisType",
    "metamodelPackage",
  ]);
  expect(
    (await importTypePackage(await exportTypePackage(config, model, true)))
      .config.identities,
  ).toHaveLength(1);
});
test("new file snapshot replaces active data while saved run and history stay pinned", async () => {
  const { config, model, b, excel } = await prepared();
  const first = await runAnalysis(config, model, "A", [excel], { uo: "Nord" }),
    workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    b as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  workbook.getWorksheet("Register")!.getCell("B2").value = "ÄHS version 2";
  const newBytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const newer = stampedSnapshot(
    await stageExcel(
      await readWorkbook(newBytes),
      newBytes,
      "new.xlsx",
      config.excel!,
      1,
    ),
    await profileHash(config.excel!),
    1,
    model.reference.sha256,
  );
  const second = await runAnalysis(config, model, "A", [newer], { uo: "Nord" });
  expect(first.results?.[0].name).toBe("ÄHS");
  expect(second.results?.[0].name).toBe("ÄHS version 2");
  expect(second.snapshots[0].sha256).not.toBe(first.snapshots[0].sha256);
  expect(second.snapshots[0].id).not.toBe(first.snapshots[0].id);
  expect(first.config).not.toBe(config);
});
test("missing source, stale mapping and draft configuration block execution", async () => {
  const { config, model, excel } = await prepared();
  await expect(runAnalysis(config, model, "B", [excel], {})).rejects.toThrow(
    "Saknade",
  );
  await expect(
    runAnalysis({ ...config, published: false }, model, "A", [excel], {}),
  ).rejects.toThrow("Publicera");
  const changed = { ...config, excel: { ...config.excel!, key: "Other" } };
  expect(await compatibleSnapshot(excel, changed)).toBe(false);
  await expect(runAnalysis(changed, model, "A", [excel], {})).rejects.toThrow(
    "inaktuell",
  );
});
test("B can run XML alone and C cannot run with only Excel", async () => {
  const { config, model, excel } = await prepared(),
    b = new Uint8Array(readFileSync("examples/architecture.xml")),
    xml = stampedSnapshot(
      await stageArchiMate(
        readArchiMate(b),
        b,
        "architecture.xml",
        config.xml!,
        model,
        1,
      ),
      await profileHash(config.xml!),
      1,
      model.reference.sha256,
    ),
    process = xml.entities.find((e) => e.name === "Hantera ärende")!;
  const run = await runAnalysis(config, model, "B", [xml], {
    processId: process.id,
  });
  expect(run.results?.map((r) => r.name)).toEqual(["ÄHS"]);
  expect(run.snapshots).toHaveLength(1);
  await expect(
    runAnalysis(config, model, "C", [excel], { processId: process.id }),
  ).rejects.toThrow("Saknade");
});
test.each([
  "bad-version",
  "tampered-mmp",
  "wrong-hash",
  "wrong-dependencies",
  "duplicate-decision",
])("malformed configuration rejected: %s", async (what) => {
  const p = JSON.parse(example());
  if (what === "bad-version") p.formatVersion = 99;
  if (what === "tampered-mmp") p.metamodelPackage = "AA==";
  if (what === "wrong-hash") p.analysisType.metamodel.sha256 = "0".repeat(64);
  if (what === "wrong-dependencies")
    p.analysisType.views[0].requiredSourceIds = ["xml"];
  if (what === "duplicate-decision")
    p.analysisType.identities = [
      {
        left: "excel:x",
        right: "xml:x",
        decision: "confirmed",
        leftType: "x",
        rightType: "x",
        leftFingerprint: "x",
        rightFingerprint: "x",
      },
      {
        left: "excel:x",
        right: "xml:x",
        decision: "confirmed",
        leftType: "x",
        rightType: "x",
        leftFingerprint: "x",
        rightFingerprint: "x",
      },
    ];
  await expect(importTypePackage(JSON.stringify(p))).rejects.toThrow();
});
