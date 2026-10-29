import { useState } from "react";
import { importMmp } from "../metamodel/import";
import type { ImportedMetamodel } from "../metamodel/model";
import { readLocalFile } from "../sources/safe-zip";
export function MetamodelImport({
  model,
  onPublish,
}: {
  model?: ImportedMetamodel;
  onPublish: (m: ImportedMetamodel) => Promise<void>;
}) {
  const [candidate, setCandidate] = useState<ImportedMetamodel>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel">
      <h2>Metamodell · MMP</h2>
      <p className="muted">
        Paketformat 1.0.0 / 1.1.0 · begränsade profiler från Specification Kit
        1.2.0.
      </p>
      {model && (
        <p className="success">
          {model.model.metamodel.name} · {model.reference.version}
        </p>
      )}
      <label>
        MMP-paket
        <input
          id="mmp-file"
          type="file"
          accept=".zip"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setError("");
            setCandidate(undefined);
            setBusy(true);
            try {
              setCandidate(await importMmp(await readLocalFile(f)));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {candidate && (
        <>
          <p>
            {candidate.model.elements.length} objekttyper,{" "}
            {candidate.model.relationships.length} relationstyper. Kontroller
            godkända.
          </p>
          <ul>
            {candidate.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <button
            id="mmp-publish"
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onPublish(candidate);
                setCandidate(undefined);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Använd metamodell
          </button>
        </>
      )}
      {model && (
        <details>
          <summary>Typer och kompatibilitet</summary>
          <p>
            {model.model.elements
              .map((t) => t.name + " (" + t.id + ")")
              .join(", ")}
          </p>
          {model.warnings.map((w) => (
            <p className="notice" key={w}>
              {w}
            </p>
          ))}
        </details>
      )}
      {error && (
        <p className="error" role="alert">
          {error} Föregående metamodell bevaras.
        </p>
      )}
      {busy && <p role="status">Validerar…</p>}
    </section>
  );
}
