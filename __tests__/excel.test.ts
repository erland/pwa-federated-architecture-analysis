import ExcelJS from "exceljs";
import { readWorkbook, stageExcel } from "../src/sources/excel";
import { systemsPerUo } from "../src/analysis/queries";
import type { ExcelProfile } from "../src/domain/contracts";
const p: ExcelProfile = {
  sheet: "Register",
  headerRow: 1,
  key: "ID",
  name: "System",
  uo: "UO",
  entityType: "application",
  uoType: "unit",
  relationshipType: "belongs_to",
};
async function fixture(rows: unknown[][]) {
  const w = new ExcelJS.Workbook();
  w.addWorksheet("Register").addRows(rows);
  return new Uint8Array(await w.xlsx.writeBuffer());
}
test("real XLSX fixture yields systems per UO with stable IDs and provenance", async () => {
  const b = await fixture([
    ["ID", "System", "UO"],
    ["s1", "ÄHS", "Nord"],
    ["s2", "Lön", "Syd"],
    ["s3", "Arkiv", "Nord"],
  ]);
  const data = await readWorkbook(b),
    s = await stageExcel(data, b, "register.xlsx", p, 1);
  expect(systemsPerUo(s, "Nord").map((r) => r.entity.name)).toEqual([
    "ÄHS",
    "Arkiv",
  ]);
  expect(s.relationships).toHaveLength(3);
  expect(s.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(s.entities[0].source.recordId).toBe("s1");
});
test.each([
  [
    ["ID", "System", "UO"],
    ["", "A", "Nord"],
  ],
  [
    ["ID", "System", "UO"],
    ["s1", "A", "Nord"],
    ["s1", "B", "Syd"],
  ],
  [
    ["ID", "System", "UO"],
    ["s1", "A", ""],
  ],
])(
  "missing/duplicate keys and missing UO fail before publication: %j",
  async (...rows) => {
    const b = await fixture(rows as unknown[][]);
    await expect(
      stageExcel(await readWorkbook(b), b, "bad.xlsx", p, 1),
    ).rejects.toThrow();
  },
);
test("missing mapped column fails clearly", async () => {
  const b = await fixture([
    ["ID", "System", "Enhet"],
    ["s1", "A", "Nord"],
  ]);
  await expect(
    stageExcel(await readWorkbook(b), b, "bad.xlsx", p, 1),
  ).rejects.toThrow("Saknad kolumn: UO");
});
