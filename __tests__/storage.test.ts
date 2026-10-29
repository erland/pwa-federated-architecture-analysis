import "fake-indexeddb/auto";
import { load, publishSnapshot } from "../src/storage/db";
import { stageExcel } from "../src/sources/excel";
import type { SourceSnapshot, ExcelProfile } from "../src/domain/contracts";
test("failed staging preserves previous IndexedDB snapshot; successful reimport replaces atomically", async () => {
  const s: SourceSnapshot = {
    id: "old",
    sourceId: "excel",
    sha256: "a".repeat(64),
    fileName: "old.xlsx",
    importedAt: "2026-10-28",
    entities: [],
    relationships: [],
    warnings: [],
    profileVersion: 1,
  };
  await publishSnapshot(s);
  const p: ExcelProfile = {
    sheet: "X",
    headerRow: 1,
    key: "ID",
    name: "System",
    uo: "UO",
    entityType: "application",
    uoType: "unit",
    relationshipType: "belongs_to",
  };
  await expect(
    stageExcel(
      {
        sheets: [
          {
            name: "X",
            rows: [
              ["ID", "System", "UO"],
              ["", "Broken", "Nord"],
            ],
          },
        ],
      },
      new Uint8Array([1]),
      "bad.xlsx",
      p,
      1,
    ),
  ).rejects.toThrow("Saknad nyckel");
  expect(await load("snapshot:excel")).toEqual(s);
  await publishSnapshot({ ...s, id: "new" });
  expect((await load<SourceSnapshot>("snapshot:excel"))?.id).toBe("new");
});
