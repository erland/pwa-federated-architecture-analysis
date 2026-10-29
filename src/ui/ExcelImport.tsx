import {
  type ImportedMetamodel,
  typeRef,
  validateMappedSnapshot,
} from "../metamodel/model";
import { useState } from "react";
import {
  headers,
  readWorkbook,
  stageExcel,
  type WorkbookData,
} from "../sources/excel";
import { readLocalFile } from "../sources/safe-zip";
import type { ExcelProfile, SourceSnapshot } from "../domain/contracts";
export function ExcelImport({
  profile,
  model,
  compact = false,
  onPublish,
}: {
  compact?: boolean;
  profile?: ExcelProfile;
  model?: ImportedMetamodel;
  onPublish: (s: SourceSnapshot, p: ExcelProfile) => Promise<void>;
}) {
  const [data, setData] = useState<WorkbookData>(),
    [bytes, setBytes] = useState<Uint8Array>(),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [candidate, setCandidate] = useState<SourceSnapshot>();
  const [p, setP] = useState<ExcelProfile>(
    profile ?? {
      sheet: "",
      headerRow: 1,
      key: "ID",
      name: "System",
      uo: "UO",
      entityType: "application",
      uoType: "unit",
      relationshipType: "belongs_to",
    },
  );
  let cols: string[] = [];
  try {
    if (data) cols = headers(data, p);
  } catch {}
  const update = (patch: Partial<ExcelProfile>) => {
    setP({ ...p, ...patch });
    setCandidate(undefined);
    setError("");
  };
  async function stage() {
    try {
      setBusy(true);
      setError("");
      const s = await stageExcel(data!, bytes!, name, p, 1);
      if (model) validateMappedSnapshot(s, model);
      setCandidate(s);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mapping">
      <label className="file-label">
        Excel-fil (.xlsx)
        <input
          id="excel-file"
          type="file"
          accept=".xlsx"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setCandidate(undefined);
            setData(undefined);
            setError("");
            setBusy(true);
            try {
              const b = await readLocalFile(f),
                d = await readWorkbook(b);
              setBytes(b);
              setData(d);
              setName(f.name);
              setP({
                ...p,
                sheet: d.sheets.some((s) => s.name === p.sheet)
                  ? p.sheet
                  : (d.sheets[0]?.name ?? ""),
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {data && (
        <>
          <details open={!compact}>
            <summary>
              {compact
                ? "Sparad Excel-mappning"
                : "Ark, kolumner och typmappning"}
            </summary>
            <fieldset disabled={compact}>
              <div className="grid">
                <label>
                  Ark
                  <select
                    value={p.sheet}
                    onChange={(e) => update({ sheet: e.target.value })}
                  >
                    {data.sheets.map((s) => (
                      <option key={s.name}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Rubrikrad
                  <input
                    type="number"
                    min="1"
                    value={p.headerRow}
                    onChange={(e) =>
                      update({ headerRow: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <div className="grid">
                {(["key", "name", "uo"] as const).map((key, i) => (
                  <label key={key}>
                    {["Nyckelkolumn", "Systemnamn", "UO-kolumn"][i]}
                    <select
                      value={p[key]}
                      onChange={(e) => update({ [key]: e.target.value })}
                    >
                      <option value="">Välj kolumn</option>
                      {cols.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="grid">
                {(["entityType", "uoType", "relationshipType"] as const).map(
                  (key, i) => (
                    <label key={key}>
                      {
                        [
                          "Systemtyp i MMP",
                          "UO-typ i MMP",
                          "Tillhörighetsrelation i MMP",
                        ][i]
                      }
                      {model ? (
                        <select
                          id={"excel-type-" + key}
                          aria-label={
                            [
                              "Systemtyp i MMP",
                              "UO-typ i MMP",
                              "Tillhörighetsrelation i MMP",
                            ][i]
                          }
                          value={p[key]}
                          onChange={(e) => update({ [key]: e.target.value })}
                        >
                          <option value="">Välj typ</option>
                          {(key === "relationshipType"
                            ? model.model.relationships
                            : model.model.elements
                          )
                            .filter((t) => !t.abstract)
                            .map((t) => (
                              <option value={typeRef(model, t.id)} key={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <input
                          value={p[key]}
                          onChange={(e) => update({ [key]: e.target.value })}
                        />
                      )}
                    </label>
                  ),
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {cols.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.sheets
                      .find((s) => s.name === p.sheet)
                      ?.rows.slice(p.headerRow, p.headerRow + 5)
                      .map((r, i) => (
                        <tr key={i}>
                          {r.map((c, j) => (
                            <td key={j}>{c}</td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </fieldset>
          </details>
          <button
            id="excel-stage"
            className="secondary"
            disabled={busy}
            onClick={stage}
          >
            Kontrollera import
          </button>
        </>
      )}
      {candidate && (
        <div className="success">
          <p>
            {candidate.relationships.length} systemposter kontrollerade.
            Publicera för att ersätta aktivt snapshot.
          </p>
          <button
            id="excel-publish"
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onPublish(candidate, p);
                setCandidate(undefined);
                setData(undefined);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Publicera snapshot
          </button>
        </div>
      )}
      {busy && <p role="status">Bearbetar…</p>}
      {error && (
        <p role="alert" className="error">
          {error} Föregående snapshot bevaras.
        </p>
      )}
    </div>
  );
}
