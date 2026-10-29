import type { AnalysisType } from "../domain/contracts";
import { readLocalFile } from "../sources/safe-zip";
export function ImportOptions({
  busy,
  onImport,
  onError,
}: {
  busy: boolean;
  onImport: (text: string) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  return (
    <>
      <label className="file-label">
        Importera konfigurationsfil (.json)
        <input
          id="config-file"
          type="file"
          accept=".json"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              await onImport(
                new TextDecoder("utf-8", { fatal: true }).decode(
                  await readLocalFile(f),
                ),
              );
            } catch (e) {
              onError(e);
            }
          }}
        />
      </label>
    </>
  );
}
export function WorkspaceStart({
  types,
  busy,
  onImport,
  onError,
  onCreate,
  onResume,
}: {
  types: AnalysisType[];
  busy: boolean;
  onImport: (text: string) => Promise<void>;
  onError: (e: unknown) => void;
  onCreate: () => void;
  onResume: (id: string) => void;
}) {
  return (
    <>
      <section className="panel" id="empty-workspace">
        <h2>Ingenting är inläst</h2>
        <p>Skapa en egen analystyp eller importera en konfiguration.</p>
        <button
          id="create-analysis-type"
          className="primary"
          disabled={busy}
          onClick={onCreate}
        >
          Skapa egen analystyp
        </button>
        {types.length > 0 && (
          <details id="saved-analysis-types">
            <summary>Öppna sparat arbete ({types.length})</summary>
            <p className="muted">
              Tidigare konfigurationer, källor och körningar finns kvar på den
              här enheten.
            </p>
            {types.map((c) => (
              <div className="source" key={c.id}>
                <span>
                  {c.name}
                  <small>
                    v{c.version} · {c.published ? "Publicerad" : "Utkast"}
                  </small>
                </span>
                <button
                  id={"resume-" + c.id}
                  className="secondary"
                  disabled={busy}
                  onClick={() => onResume(c.id)}
                >
                  Öppna
                </button>
              </div>
            ))}
          </details>
        )}
      </section>
      <section className="panel">
        <h2>Importera analystyp</h2>
        <ImportOptions busy={busy} onImport={onImport} onError={onError} />
      </section>
    </>
  );
}
