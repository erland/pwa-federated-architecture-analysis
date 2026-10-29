import ExcelJS from "exceljs";
import { safeZip, sha256 } from "./safe-zip";
import {
  entityId,
  type ExcelProfile,
  type SourceSnapshot,
} from "../domain/contracts";
export interface WorkbookData {
  sheets: { name: string; rows: string[][] }[];
}
export async function readWorkbook(bytes: Uint8Array): Promise<WorkbookData> {
  const files = safeZip(bytes);
  if (!files["xl/workbook.xml"])
    throw Error("Filen är inte en XLSX-arbetsbok.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  return {
    sheets: workbook.worksheets.map((s) => {
      if (s.rowCount > 20000 || s.columnCount > 200)
        throw Error("Arket överskrider 20 000 rader / 200 kolumner.");
      const rows: string[][] = [];
      for (let r = 1; r <= s.rowCount; r++) {
        const row: string[] = [];
        for (let c = 1; c <= s.columnCount; c++) {
          const cell = s.getCell(r, c);
          if (cell.type === ExcelJS.ValueType.Formula)
            throw Error(
              `Formler stöds inte: ${s.name}!${cell.address}. Exportera värden.`,
            );
          row.push(cell.text.trim());
        }
        rows.push(row);
      }
      return { name: s.name, rows };
    }),
  };
}
export function headers(
  data: WorkbookData,
  p: Pick<ExcelProfile, "sheet" | "headerRow">,
) {
  const s = data.sheets.find((s) => s.name === p.sheet);
  if (
    !s ||
    !Number.isInteger(p.headerRow) ||
    p.headerRow < 1 ||
    p.headerRow > s.rows.length
  )
    throw Error("Välj ett befintligt ark och en giltig rubrikrad.");
  const h = s.rows[p.headerRow - 1];
  if (!h.length || h.some((x) => !x) || new Set(h).size !== h.length)
    throw Error("Rubriker måste vara ifyllda och unika.");
  return h;
}
export async function stageExcel(
  data: WorkbookData,
  bytes: Uint8Array,
  fileName: string,
  p: ExcelProfile,
  profileVersion: number,
): Promise<SourceSnapshot> {
  const h = headers(data, p);
  for (const col of [p.key, p.name, p.uo])
    if (!h.includes(col)) throw Error("Saknad kolumn: " + col);
  if (!p.entityType || !p.uoType || !p.relationshipType)
    throw Error("Typmappningen är ofullständig.");
  const hash = await sha256(bytes),
    snapshotId = "excel:" + hash,
    entities: SourceSnapshot["entities"] = [],
    relationships: SourceSnapshot["relationships"] = [],
    keys = new Set<string>(),
    uos = new Set<string>();
  const rows = data.sheets.find((s) => s.name === p.sheet)!.rows;
  for (let i = p.headerRow; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((x) => !x)) continue;
    const value = (c: string) => r[h.indexOf(c)]?.trim() ?? "",
      key = value(p.key);
    if (!key) throw Error(`Saknad nyckel på rad ${i + 1}.`);
    if (keys.has(key)) throw Error(`Duplicerad nyckel ${key} på rad ${i + 1}.`);
    keys.add(key);
    if (!value(p.name) || !value(p.uo))
      throw Error(`Saknat systemnamn/UO på rad ${i + 1}.`);
    const id = entityId("excel", key),
      uo = entityId("excel-uo", value(p.uo)),
      source = { sourceId: "excel", recordId: key, snapshotId };
    entities.push({
      id,
      name: value(p.name),
      typeRef: p.entityType,
      attributes: { uo: value(p.uo), row: String(i + 1) },
      source,
    });
    if (!uos.has(uo)) {
      uos.add(uo);
      entities.push({
        id: uo,
        name: value(p.uo),
        typeRef: p.uoType,
        attributes: {},
        source: { ...source, recordId: "uo:" + value(p.uo) },
      });
    }
    relationships.push({
      id: `excel:membership:${encodeURIComponent(key)}`,
      typeRef: p.relationshipType,
      sourceId: id,
      targetId: uo,
      source,
    });
  }
  if (!keys.size) throw Error("Arket innehåller inga systemposter.");
  return {
    id: snapshotId,
    sourceId: "excel",
    fileName,
    sha256: hash,
    importedAt: new Date().toISOString(),
    entities,
    relationships,
    warnings: [],
    profileVersion,
  };
}
