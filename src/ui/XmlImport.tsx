import { useState } from "react";
import {
  readArchiMate,
  stageArchiMate,
  type RawXml,
} from "../sources/archimate";
import { type ImportedMetamodel, typeRef } from "../metamodel/model";
import { readLocalFile } from "../sources/safe-zip";
import type { XmlProfile, SourceSnapshot } from "../domain/contracts";
export function XmlImport({
  model,
  profile,
  compact = false,
  onPublish,
}: {
  compact?: boolean;
  model?: ImportedMetamodel;
  profile?: XmlProfile;
  onPublish: (s: SourceSnapshot, p: XmlProfile) => Promise<void>;
}) {
  const [data, setData] = useState<RawXml>(),
    [bytes, setBytes] = useState<Uint8Array>(),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [candidate, setCandidate] = useState<SourceSnapshot>();
  const [p, setP] = useState<XmlProfile>(
    profile ?? {
      elementTypes: {},
      relationshipTypes: {},
      processTypes: [],
      applicationTypes: [],
      paths: [[{ type: "", direction: "in" }]],
    },
  );
  function change(next: XmlProfile) {
    setP(next);
    setCandidate(undefined);
    setError("");
  }
  const option = (kind: "element" | "relationship") => (
    <>
      <option value="">Välj typ / utelämna</option>
      {(kind === "element" ? model?.model.elements : model?.model.relationships)
        ?.filter((t) => !t.abstract)
        .map((t) => (
          <option key={t.id} value={typeRef(model!, t.id)}>
            {t.name}
          </option>
        ))}
    </>
  );
  return (
    <div className="mapping">
      {!model ? (
        <p className="notice">Importera först en MMP i Konfiguration.</p>
      ) : (
        <>
          <label>
            ArchiMate XML
            <input
              id="xml-file"
              type="file"
              accept=".xml"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setError("");
                setData(undefined);
                setCandidate(undefined);
                setBusy(true);
                try {
                  const b = await readLocalFile(f);
                  setData(readArchiMate(b));
                  setBytes(b);
                  setName(f.name);
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
              <p className="muted">
                {data.elements.length} objekt · {data.relationships.length}{" "}
                relationer · modell {data.modelId}
              </p>
              <details open={!compact}>
                <summary>
                  {compact
                    ? "Sparad XML-mappning och relationskedja"
                    : "Mappning och relationskedjor"}
                </summary>
                <fieldset disabled={compact}>
                  <h3>Typmappning</h3>
                  <div className="grid">
                    {[...new Set(data.elements.map((e) => e.type))].map((t) => (
                      <label key={t}>
                        {t}
                        <select
                          value={p.elementTypes[t] ?? ""}
                          onChange={(e) =>
                            change({
                              ...p,
                              elementTypes: {
                                ...p.elementTypes,
                                [t]: e.target.value,
                              },
                            })
                          }
                        >
                          {option("element")}
                        </select>
                      </label>
                    ))}
                    {[...new Set(data.relationships.map((e) => e.type))].map(
                      (t) => (
                        <label key={t}>
                          {t} (relation)
                          <select
                            value={p.relationshipTypes[t] ?? ""}
                            onChange={(e) =>
                              change({
                                ...p,
                                relationshipTypes: {
                                  ...p.relationshipTypes,
                                  [t]: e.target.value,
                                },
                              })
                            }
                          >
                            {option("relationship")}
                          </select>
                        </label>
                      ),
                    )}
                  </div>
                  <div className="grid">
                    <label>
                      Processer i analysen
                      <select
                        value={p.processTypes[0] ?? ""}
                        onChange={(e) =>
                          change({
                            ...p,
                            processTypes: e.target.value
                              ? [e.target.value]
                              : [],
                          })
                        }
                      >
                        {option("element")}
                      </select>
                    </label>
                    <label>
                      System i analysen
                      <select
                        value={p.applicationTypes[0] ?? ""}
                        onChange={(e) =>
                          change({
                            ...p,
                            applicationTypes: e.target.value
                              ? [e.target.value]
                              : [],
                          })
                        }
                      >
                        {option("element")}
                      </select>
                    </label>
                  </div>
                  <h3>Relationskedjor från process till system</h3>
                  {p.paths.map((path, i) => (
                    <div className="mapping" key={i}>
                      <strong>Kedja {i + 1}</strong>
                      {path.map((step, j) => (
                        <div className="row" key={j}>
                          <label>
                            Relation {j + 1}
                            <select
                              value={step.type}
                              onChange={(e) =>
                                change({
                                  ...p,
                                  paths: p.paths.map((path, k) =>
                                    k !== i
                                      ? path
                                      : path.map((s, l) =>
                                          l !== j
                                            ? s
                                            : { ...s, type: e.target.value },
                                        ),
                                  ),
                                })
                              }
                            >
                              {option("relationship")}
                            </select>
                          </label>
                          <label>
                            Riktning
                            <select
                              value={step.direction}
                              onChange={(e) =>
                                change({
                                  ...p,
                                  paths: p.paths.map((path, k) =>
                                    k !== i
                                      ? path
                                      : path.map((s, l) =>
                                          l !== j
                                            ? s
                                            : {
                                                ...s,
                                                direction: e.target.value as
                                                  "in" | "out",
                                              },
                                        ),
                                  ),
                                })
                              }
                            >
                              <option value="in">
                                Inkommande (mål → källa)
                              </option>
                              <option value="out">
                                Utgående (källa → mål)
                              </option>
                            </select>
                          </label>
                        </div>
                      ))}
                      <div className="actions">
                        <button
                          className="secondary"
                          disabled={path.length >= 5}
                          onClick={() =>
                            change({
                              ...p,
                              paths: p.paths.map((x, k) =>
                                k === i
                                  ? [...x, { type: "", direction: "in" }]
                                  : x,
                              ),
                            })
                          }
                        >
                          Lägg till relationssteg
                        </button>
                        <button
                          className="secondary"
                          onClick={() =>
                            change({
                              ...p,
                              paths: p.paths.filter((_, k) => k !== i),
                            })
                          }
                        >
                          Ta bort kedja
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={compact || p.paths.length >= 5}
                      onClick={() =>
                        change({
                          ...p,
                          paths: [...p.paths, [{ type: "", direction: "in" }]],
                        })
                      }
                    >
                      Alternativ kedja
                    </button>
                  </div>
                </fieldset>
              </details>
              <div className="actions">
                <button
                  id="xml-stage"
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      setCandidate(
                        await stageArchiMate(data, bytes!, name, p, model, 1),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Kontrollera XML-import
                </button>
              </div>
            </>
          )}
          {candidate && (
            <div className="success">
              <p>
                {candidate.entities.length} objekt,{" "}
                {candidate.relationships.length} relationer kontrollerade.
              </p>
              {candidate.warnings.length > 0 && (
                <details>
                  <summary>
                    {candidate.warnings.length} varningar – granska före
                    publicering
                  </summary>
                  {candidate.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </details>
              )}
              <button
                id="xml-publish"
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
                Godkänn och publicera snapshot
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error} Föregående snapshot bevaras.
        </p>
      )}
      {busy && <p role="status">Bearbetar…</p>}
    </div>
  );
}
