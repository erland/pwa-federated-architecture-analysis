import { ImportOptions, WorkspaceStart } from "./ImportOptions";
import { version } from "../../package.json";
import { useEffect, useRef, useState } from "react";
import { ExcelImport } from "./ExcelImport";
import { XmlImport } from "./XmlImport";
import { MetamodelImport } from "./MetamodelImport";
import { IdentityPanel } from "./IdentityPanel";
import {
  initialType,
  createAnalysisType,
  type AnalysisType,
  type AnalysisRun,
  type ExcelProfile,
  type XmlProfile,
  type SourceSnapshot,
  type ViewKind,
} from "../domain/contracts";
import { type ImportedMetamodel } from "../metamodel/model";
import {
  emptyWorkspace,
  loadWorkspace,
  saveWorkspace,
  sourceKey,
  stampedSnapshot,
  type Workspace,
} from "../storage/workspace";
import {
  exportTypePackage,
  importTypePackage,
  profileHash,
  publishType,
  stableJson,
} from "../config/packages";
import { compatibleSnapshot, runAnalysis } from "../analysis/run";
import { combined } from "../identity/matching";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
function revised(c: AnalysisType, patch: Partial<AnalysisType>) {
  const next = { ...c, ...patch };
  if (stableJson(c) === stableJson(next)) return c;
  return { ...next, version: c.version + 1, published: false };
}
function replaceType(w: Workspace, c: AnalysisType): Workspace {
  return {
    ...w,
    activeTypeId: c.id,
    types: w.types.some((t) => t.id === c.id)
      ? w.types.map((t) => (t.id === c.id ? c : t))
      : [...w.types, c],
  };
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const ref = useRef(workspace),
    queue = useRef(Promise.resolve()),
    pending = useRef(0);
  const [page, setPage] = useState<"analysis" | "config">("analysis"),
    [viewId, setViewId] = useState<ViewKind>("A"),
    [sessionSources, setSessionSources] = useState<string[]>([]),
    [uo, setUo] = useState(""),
    [processId, setProcessId] = useState(""),
    [result, setResult] = useState<AnalysisRun>(),
    [historical, setHistorical] = useState(false),
    [includeIdentities, setIncludeIdentities] = useState(false),
    [nameDraft, setNameDraft] = useState(""),
    [compatibility, setCompatibility] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    loadWorkspace()
      .then((w) => {
        if (!cancelled) {
          if (w.schemaVersion !== 1 || !Array.isArray(w.types))
            throw Error("Lagrad arbetsyta har okänt format.");
          ref.current = w;
          setWorkspace(w);
          setReady(true);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError("Lokal lagring kunde inte öppnas: " + message(e));
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const activeConfig = workspace.types.find(
    (t) => t.id === workspace.activeTypeId,
  );
  const config =
      workspace.types.find((t) => t.id === workspace.activeTypeId) ??
      initialType,
    model = config.metamodel
      ? workspace.models[config.metamodel.sha256]
      : undefined,
    view = config.views.find((v) => v.id === viewId) ?? config.views[0];
  const excel = workspace.snapshots[sourceKey(config.id, "excel")],
    xml = workspace.snapshots[sourceKey(config.id, "xml")];
  useEffect(() => {
    setNameDraft(config.name);
  }, [config.id, config.name]);
  useEffect(() => {
    let stop = false;
    Promise.all(
      [excel, xml]
        .filter((s): s is SourceSnapshot => Boolean(s))
        .map(
          async (s) =>
            [s.sourceId, await compatibleSnapshot(s, config)] as const,
        ),
    )
      .then((entries) => {
        if (!stop) setCompatibility(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (!stop) setError(message(e));
      });
    return () => {
      stop = true;
    };
  }, [config, excel, xml]);
  function invalidate() {
    setResult(undefined);
    setHistorical(false);
    setNotice("");
  }
  async function commit(update: (w: Workspace) => Workspace) {
    pending.current++;
    setBusy(true);
    const work = queue.current.then(async () => {
      const next = update(ref.current);
      await saveWorkspace(next);
      ref.current = next;
      setWorkspace(next);
    });
    queue.current = work.catch(() => {});
    try {
      await work;
    } finally {
      pending.current--;
      setBusy(pending.current > 0);
    }
  }
  async function attempt(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (e) {
      setError(message(e));
    }
  }
  async function updateConfig(patch: Partial<AnalysisType>) {
    const id = config.id;
    await commit((w) => {
      if (w.activeTypeId !== id)
        throw Error("Analystypen ändrades. Försök igen.");
      const c = w.types.find((t) => t.id === id)!;
      return replaceType(w, revised(c, patch));
    });
    invalidate();
  }
  async function publishSource(
    s: SourceSnapshot,
    p: ExcelProfile | XmlProfile,
  ) {
    const id = config.id,
      expectedModel = model?.reference.sha256;
    if (!expectedModel)
      throw Error("Importera en MMP innan källan publiceras.");
    const hash = await profileHash(p);
    await commit((w) => {
      if (w.activeTypeId !== id)
        throw Error("Analystypen ändrades under importen.");
      const current = w.types.find((t) => t.id === id)!;
      if (current.metamodel?.sha256 !== expectedModel)
        throw Error("Metamodellen ändrades under importen. Gör om kontrollen.");
      const next = revised(
        current,
        s.sourceId === "excel"
          ? { excel: p as ExcelProfile }
          : { xml: p as XmlProfile },
      );
      const stamped = stampedSnapshot(s, hash, next.version, expectedModel);
      return {
        ...replaceType(w, next),
        snapshots: { ...w.snapshots, [sourceKey(id, s.sourceId)]: stamped },
        history: { ...w.history, [stamped.id]: stamped },
      };
    });
    setSessionSources((ids) => [...new Set([...ids, s.sourceId])]);
    invalidate();
    setNotice(
      "Snapshot publicerat. " +
        (config.published
          ? "Oförändrad mappning återanvänds."
          : "Publicera analystypen när konfigurationen är klar."),
    );
  }
  async function installPackage(text: string) {
    const p = await importTypePackage(text);
    await commit((w) => ({
      ...replaceType(w, p.config),
      models: { ...w.models, [p.model.reference.sha256]: p.model },
    }));
    setViewId(p.config.views[0].id);
    setSessionSources([]);
    setUo("");
    setProcessId("");
    invalidate();
    setNotice(
      "Analystyp importerad och validerad. Bifoga källorna för vald vy.",
    );
  }
  async function setModel(m: ImportedMetamodel) {
    const id = config.id;
    await commit((w) => {
      const current = w.types.find((c) => c.id === id)!;
      if (w.activeTypeId !== id) throw Error("Analystypen ändrades.");
      const next = revised(current, {
        metamodel: m.reference,
        excel: undefined,
        xml: undefined,
        identities: [],
      });
      return {
        ...replaceType(w, next),
        models: { ...w.models, [m.reference.sha256]: m },
      };
    });
    setSessionSources([]);
    invalidate();
    setNotice("Metamodell vald. Mappa källornas typer före publicering.");
  }
  const current = [excel, xml].filter((s): s is SourceSnapshot =>
    Boolean(
      s && sessionSources.includes(s.sourceId) && compatibility[s.sourceId],
    ),
  );
  const missing = view.requiredSourceIds.filter(
    (id) => !current.some((s) => s.sourceId === id),
  );
  const processes =
    xml?.entities.filter((e) => config.xml?.processTypes.includes(e.typeRef)) ??
    [];
  const uos = [
    ...new Set(
      excel?.entities.map((e) => e.attributes.uo).filter(Boolean) ?? [],
    ),
  ].sort();
  const identityReady =
    excel &&
    xml &&
    config.xml &&
    sessionSources.includes("excel") &&
    sessionSources.includes("xml") &&
    compatibility.excel &&
    compatibility.xml;
  let joined: ReturnType<typeof combined> | undefined;
  try {
    if (view.id === "C" && identityReady && processId)
      joined = combined(
        excel!,
        xml!,
        config.xml!,
        config.identities,
        uo,
        processId,
      );
  } catch {}
  async function execute() {
    const capturedConfig = config,
      capturedIds = current
        .map((s) => s.id)
        .sort()
        .join();
    const run = await runAnalysis(capturedConfig, model, view.id, current, {
      uo,
      processId,
    });
    await commit((w) => {
      const latest = w.types.find((t) => t.id === capturedConfig.id);
      if (
        w.activeTypeId !== capturedConfig.id ||
        latest?.version !== capturedConfig.version ||
        stableJson(latest) !== stableJson(capturedConfig)
      )
        throw Error("Konfigurationen ändrades under körningen. Kör igen.");
      const actual = run.snapshots
        .map((s) => w.snapshots[sourceKey(config.id, s.sourceId)]?.id)
        .sort()
        .join();
      if (actual !== capturedIds)
        throw Error("Källdata ändrades under körningen. Kör igen.");
      return { ...w, runs: [...w.runs, run] };
    });
    setResult(run);
    setHistorical(false);
    setNotice(
      "Analys genomförd. Körningens konfiguration och källversioner är låsta.",
    );
  }

  return (
    <div className="shell">
      <aside>
        <a className="brand" href="./">
          <span className="mark">◈</span>
          <span>
            Federated <br />
            Architecture Analysis
          </span>
        </a>
        <div className="workspace">LOKAL ARBETSYTA</div>
        <nav>
          <button
            id="nav-analysis"
            aria-current={page === "analysis" ? "page" : undefined}
            onClick={() => setPage("analysis")}
          >
            ◫ &nbsp; Analys
          </button>
          <button
            id="nav-config"
            aria-current={page === "config" ? "page" : undefined}
            onClick={() => setPage("config")}
          >
            ⚙ &nbsp; Konfiguration
          </button>
        </nav>
        {activeConfig && (
          <button
            id="workspace-start"
            className="home-button"
            disabled={busy}
            onClick={() =>
              attempt(async () => {
                await commit((w) => ({ ...w, activeTypeId: "" }));
                setSessionSources([]);
                invalidate();
              })
            }
          >
            Gå till startsidan
          </button>
        )}
        <p className="privacy">
          Dina filer behandlas lokalt.
          <br />
          Inga källdata lämnar enheten.
        </p>
      </aside>
      <main>
        <header>
          <span>
            ARKITEKTUR / {page === "analysis" ? "ANALYS" : "KONFIGURATION"}
          </span>
          <span className="pill">● Lokal PWA</span>
        </header>
        <h1>
          {!activeConfig
            ? "Börja med en tom arbetsyta."
            : page === "analysis"
              ? "Från källor till insikt."
              : "En grund att återanvända."}
        </h1>
        <p className="lead">
          Kombinera systemregister och arkitekturmodeller med spårbara
          kopplingar.
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="success" role="status">
            {notice}
          </div>
        )}
        {!ready ? (
          <p>Läser arbetsyta…</p>
        ) : !activeConfig ? (
          <WorkspaceStart
            types={workspace.types}
            busy={busy}
            onImport={installPackage}
            onError={(e) => setError(message(e))}
            onCreate={() =>
              attempt(async () => {
                const c = createAnalysisType();
                await commit((w) => replaceType(w, c));
                setPage("config");
                setViewId("A");
                setSessionSources([]);
                invalidate();
                setNotice(
                  "En ny analystyp är skapad. Importera en MMP och välj källmappningar.",
                );
              })
            }
            onResume={(id) =>
              attempt(async () => {
                await commit((w) => ({ ...w, activeTypeId: id }));
                setViewId(
                  ref.current.types.find((t) => t.id === id)!.views[0].id,
                );
                setSessionSources([]);
                setUo("");
                setProcessId("");
                invalidate();
              })
            }
          />
        ) : (
          <>
            <section className="panel">
              <div className="row">
                <label>
                  Analystyp
                  <select
                    id="analysis-type"
                    value={config.id}
                    disabled={busy}
                    onChange={(e) =>
                      attempt(async () => {
                        const id = e.target.value;
                        await commit((w) => ({ ...w, activeTypeId: id }));
                        setViewId(
                          ref.current.types.find((t) => t.id === id)!.views[0]
                            .id,
                        );
                        setSessionSources([]);
                        setUo("");
                        setProcessId("");
                        invalidate();
                      })
                    }
                  >
                    {workspace.types.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · v{c.version} {c.published ? "" : "(utkast)"}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="pill">
                  {config.published ? "Publicerad" : "Utkast"} · v
                  {config.version}
                </span>
              </div>
              <p className="muted">
                {config.metamodel
                  ? `Metamodell ${config.metamodel.id} · ${config.metamodel.version}`
                  : "Börja med en MMP och källmappningar i Konfiguration."}
              </p>
              {!config.published && (
                <p className="notice">
                  Analystypen behöver publiceras i Konfiguration före analys.
                  Ändrad mappning skapar en ny utkastversion.
                </p>
              )}
              <details>
                <summary>Importera analystyp</summary>
                <ImportOptions
                  busy={busy}
                  onImport={installPackage}
                  onError={(e) => setError(message(e))}
                />
              </details>
            </section>
            {page === "config" && (
              <>
                <section className="panel">
                  <h2>Publicera och återanvänd</h2>
                  <div className="row">
                    <label>
                      Analystypens namn
                      <input
                        id="config-name"
                        value={nameDraft}
                        maxLength={200}
                        onChange={(e) => setNameDraft(e.target.value)}
                      />
                    </label>
                    <button
                      className="secondary"
                      disabled={busy || !nameDraft.trim()}
                      onClick={() =>
                        attempt(() => updateConfig({ name: nameDraft.trim() }))
                      }
                    >
                      Spara namn
                    </button>
                    <button
                      id="new-type"
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        attempt(async () => {
                          const c = {
                            ...structuredClone(config),
                            id: crypto.randomUUID(),
                            version: 1,
                            name: config.name + " – kopia",
                            published: false,
                            identities: [],
                          };
                          await commit((w) => replaceType(w, c));
                          setSessionSources([]);
                          invalidate();
                        })
                      }
                    >
                      Ny analystyp från denna
                    </button>
                  </div>
                  <h3>Publicerade analysvyer</h3>
                  {initialType.views.map((v) => {
                    const selected = config.views.find((x) => x.id === v.id);
                    return (
                      <div className="mapping" key={v.id}>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={Boolean(selected)}
                            disabled={
                              busy ||
                              Boolean(selected && config.views.length === 1)
                            }
                            onChange={(e) =>
                              attempt(() =>
                                updateConfig({
                                  views: e.target.checked
                                    ? [
                                        ...config.views,
                                        structuredClone(v),
                                      ].sort((a, b) => a.id.localeCompare(b.id))
                                    : config.views.filter((x) => x.id !== v.id),
                                }),
                              )
                            }
                          />
                          {v.id} · {selected?.name ?? v.name}
                        </label>
                        {selected && (
                          <label>
                            Vyns namn
                            <input
                              defaultValue={selected.name}
                              key={config.id + v.id + selected.name}
                              maxLength={200}
                              onBlur={(e) => {
                                if (
                                  e.target.value.trim() &&
                                  e.target.value.trim() !== selected.name
                                )
                                  attempt(() =>
                                    updateConfig({
                                      views: config.views.map((x) =>
                                        x.id === v.id
                                          ? {
                                              ...x,
                                              name: e.target.value.trim(),
                                            }
                                          : x,
                                      ),
                                    }),
                                  );
                              }}
                            />
                          </label>
                        )}
                        <p className="muted">
                          Källberoenden:{" "}
                          {v.requiredSourceIds
                            .map(
                              (id) =>
                                config.sources.find((s) => s.id === id)!.name,
                            )
                            .join(" + ")}
                        </p>
                      </div>
                    );
                  })}
                  <div className="actions">
                    <button
                      id="publish-type"
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        attempt(async () => {
                          const id = config.id;
                          await commit((w) => {
                            const c = w.types.find((t) => t.id === id)!;
                            return replaceType(
                              w,
                              publishType(
                                c,
                                c.metamodel
                                  ? w.models[c.metamodel.sha256]
                                  : undefined,
                              ),
                            );
                          });
                          setNotice(
                            "Analystyp publicerad. Den kan återanvändas med nya källfiler.",
                          );
                        })
                      }
                    >
                      Publicera analystyp
                    </button>
                    <button
                      id="export-type"
                      className="secondary"
                      disabled={busy || !config.published || !model}
                      onClick={() =>
                        attempt(async () =>
                          download(
                            await exportTypePackage(
                              config,
                              model!,
                              includeIdentities,
                            ),
                            "federated-architecture-analysis-type.json",
                          ),
                        )
                      }
                    >
                      Exportera analystyp
                    </button>
                  </div>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={includeIdentities}
                      onChange={(e) => setIncludeIdentities(e.target.checked)}
                    />
                    Inkludera identitetsbeslut i exporten (kan innehålla interna
                    ID:n och namn)
                  </label>
                  <p className="muted">
                    Källfiler och snapshots ingår aldrig i
                    konfigurationsexporten. Lagringen är lokal och ersätter inte
                    en säkerhetskopia.
                  </p>
                </section>
                <MetamodelImport model={model} onPublish={setModel} />
              </>
            )}
            <div className="views">
              {config.views.map((v) => (
                <button
                  id={`view-${v.id}`}
                  className={view.id === v.id ? "view selected" : "view"}
                  key={v.id}
                  onClick={() => {
                    setViewId(v.id);
                    setProcessId("");
                    invalidate();
                  }}
                >
                  <span className="letter">{v.id}</span>
                  <strong>{v.name}</strong>
                  <small>{v.description}</small>
                </button>
              ))}
            </div>
            <section className="panel">
              <h2>{view.name}</h2>
              <p className="muted">
                Bifoga enbart källorna för vald vy. Sparade snapshots används
                först när du uttryckligen väljer dem i den här sessionen.
              </p>
              {view.requiredSourceIds.map((id) => {
                const source = config.sources.find((s) => s.id === id)!,
                  s = id === "excel" ? excel : xml,
                  isCurrent = current.some((s) => s.sourceId === id);
                return (
                  <div className="source-block" key={id}>
                    <div className="source">
                      <strong>{source.name}</strong>
                      <span className="pill">
                        {isCurrent
                          ? "Vald i denna session"
                          : s
                            ? "Sparat, ej valt"
                            : "Saknas"}
                      </span>
                    </div>
                    {s && (
                      <>
                        <p className="muted">
                          {s.fileName} ·{" "}
                          {new Date(s.importedAt).toLocaleString("sv-SE")} ·{" "}
                          {s.entities.length} objekt
                        </p>
                        <div className="actions">
                          <button
                            id={`reuse-${id}`}
                            className="secondary"
                            disabled={busy || !compatibility[id] || isCurrent}
                            onClick={() => {
                              setSessionSources((ids) => [
                                ...new Set([...ids, id]),
                              ]);
                              invalidate();
                            }}
                          >
                            Använd sparat snapshot
                          </button>
                          {isCurrent && (
                            <button
                              className="secondary"
                              onClick={() => {
                                setSessionSources((ids) =>
                                  ids.filter((x) => x !== id),
                                );
                                invalidate();
                              }}
                            >
                              Ta bort från denna session
                            </button>
                          )}
                        </div>
                        {!compatibility[id] && (
                          <p className="notice">
                            Snapshot stämmer inte med aktuell mappning eller
                            MMP. Importera filen på nytt.
                          </p>
                        )}
                        <details>
                          <summary>Importstatus och källhash</summary>
                          <code>{s.sha256}</code>
                          <p>Profilversion {s.profileVersion}</p>
                          {s.warnings.map((w, i) => (
                            <p className="notice" key={i}>
                              {w}
                            </p>
                          ))}
                        </details>
                      </>
                    )}
                    {id === "excel" ? (
                      <ExcelImport
                        key={config.id + ":excel:" + config.version}
                        compact={page === "analysis" && Boolean(config.excel)}
                        model={model}
                        profile={config.excel}
                        onPublish={publishSource}
                      />
                    ) : (
                      <XmlImport
                        key={config.id + ":xml:" + config.version}
                        compact={page === "analysis" && Boolean(config.xml)}
                        model={model}
                        profile={config.xml}
                        onPublish={publishSource}
                      />
                    )}
                  </div>
                );
              })}
            </section>
            {(page === "config" || view.id === "C") && identityReady && (
              <IdentityPanel
                excel={excel!}
                xml={xml!}
                profile={config.xml!}
                assertions={config.identities}
                onChange={async (identities) => {
                  const id = config.id;
                  await commit((w) => {
                    const c = w.types.find((t) => t.id === id)!;
                    return replaceType(w, revised(c, { identities }));
                  });
                  invalidate();
                }}
              />
            )}
            <section className="panel">
              <h2>Kör analys</h2>
              <div className="grid">
                {view.id !== "B" && (
                  <label>
                    UO
                    <select
                      id="filter-uo"
                      value={uo}
                      onChange={(e) => {
                        setUo(e.target.value);
                        invalidate();
                      }}
                    >
                      <option value="">Alla UO</option>
                      {uos.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                )}
                {view.id !== "A" && (
                  <label>
                    Process
                    <select
                      id="filter-process"
                      value={processId}
                      onChange={(e) => {
                        setProcessId(e.target.value);
                        invalidate();
                      }}
                    >
                      <option value="">Välj process</option>
                      {processes.map((e) => (
                        <option value={e.id} key={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {missing.length > 0 && (
                <p className="notice">
                  Obligatoriska källor saknas i sessionen:{" "}
                  {missing
                    .map((id) => config.sources.find((s) => s.id === id)!.name)
                    .join(", ")}
                  .
                </p>
              )}
              {joined && (
                <>
                  <p className="notice">
                    {joined.coverage.confirmed} bekräftade kopplingar ·{" "}
                    {joined.coverage.unresolvedExcel} olösta i Excel ·{" "}
                    {joined.coverage.unresolvedXml} olösta i XML ·{" "}
                    {joined.coverage.stale} inaktuella beslut.
                  </p>
                  <details>
                    <summary>
                      Olösta system ({joined.unresolved.length})
                    </summary>
                    {joined.unresolved.map((e) => (
                      <p key={e.id}>
                        {e.name} · {e.source.sourceId} · {e.source.recordId}
                      </p>
                    ))}
                  </details>
                </>
              )}
              <button
                id="run-analysis"
                className="primary"
                disabled={
                  busy ||
                  !config.published ||
                  Boolean(missing.length) ||
                  (view.id !== "A" && !processId)
                }
                onClick={() => attempt(execute)}
              >
                Kör {view.name}
              </button>
            </section>
            {result && (
              <Result
                run={result}
                workspace={workspace}
                historical={historical}
              />
            )}
            <section className="panel">
              <h2>Tidigare körningar</h2>
              <label>
                Öppna historiskt resultat
                <select
                  id="run-history"
                  value={historical ? (result?.id ?? "") : ""}
                  onChange={(e) => {
                    const r = workspace.runs.find(
                      (r) => r.id === e.target.value,
                    );
                    setResult(r);
                    setHistorical(Boolean(r));
                  }}
                >
                  <option value="">Välj sparad körning</option>
                  {workspace.runs
                    .filter((r) => r.analysisTypeId === config.id)
                    .slice()
                    .reverse()
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {new Date(r.at).toLocaleString("sv-SE")} · {r.viewId} ·
                        konfiguration v{r.configVersion}
                      </option>
                    ))}
                </select>
              </label>
              <p className="muted">
                Historiska resultat behåller sina ursprungliga snapshots. Nya
                filer ändrar inte tidigare körningar.
              </p>
            </section>
          </>
        )}
        <footer>
          Federated Architecture Analysis · Lokal prototyp {version} · Exportera
          konfigurationen för återanvändning.
        </footer>
      </main>
    </div>
  );
}

function Result({
  run,
  workspace,
  historical,
}: {
  run: AnalysisRun;
  workspace: Workspace;
  historical: boolean;
}) {
  const snapshots = run.snapshots
      .map((ref) => workspace.history[ref.id])
      .filter(Boolean),
    relations = snapshots.flatMap((s) => s.relationships),
    entities = snapshots.flatMap((s) => s.entities);
  return (
    <section className="panel" id="analysis-result">
      <div className="row">
        <h2>{historical ? "Historiskt resultat" : "Resultat"}</h2>
        <span className="pill">{run.resultIds.length} unika system</span>
      </div>
      <p className="muted">
        {new Date(run.at).toLocaleString("sv-SE")} · konfiguration v
        {run.configVersion} · vy {run.viewId}
        {run.parameters.uo ? " · UO " + run.parameters.uo : ""}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>System</th>
              {run.viewId !== "B" && <th>UO</th>}
              <th>Källor och härledning</th>
            </tr>
          </thead>
          <tbody>
            {run.results?.map((r, i) => (
              <tr key={i}>
                <td>
                  {r.name}
                  <small>{r.entityId}</small>
                </td>
                {run.viewId !== "B" && <td>{r.uo}</td>}
                <td>
                  {r.match && <small>Bekräftad identitet: {r.match}</small>}
                  <details>
                    <summary>{r.path.length} källrelationer</summary>
                    <ol>
                      {r.path.map((id) => {
                        const rel = relations.find((x) => x.id === id),
                          source = entities.find((e) => e.id === rel?.sourceId),
                          target = entities.find((e) => e.id === rel?.targetId),
                          file = snapshots.find(
                            (s) => s.id === rel?.source.snapshotId,
                          );
                        return (
                          <li key={id}>
                            {source?.name} → {target?.name}
                            <small>
                              {rel?.typeRef}
                              <br />
                              {file?.fileName} · post {rel?.source.recordId}
                            </small>
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!run.results?.length && (
        <p className="empty">
          Inga dokumenterade träffar för valda kriterier. Frånvaro är inte bevis
          för att stöd saknas i verkligheten.
        </p>
      )}
      {(run.warnings?.length ?? 0) > 0 && (
        <details>
          <summary>Datatäckning och begränsningar</summary>
          {run.warnings?.map((w, i) => (
            <p className="notice" key={i}>
              {w}
            </p>
          ))}
          {run.coverage && Object.keys(run.coverage).length > 0 && (
            <pre>{JSON.stringify(run.coverage, null, 2)}</pre>
          )}
        </details>
      )}
      <details>
        <summary>Körningens proveniens</summary>
        <p>
          Körning {run.id} · motor {run.engineVersion} · analystyp{" "}
          {run.analysisTypeId} v{run.configVersion}
        </p>
        <p>
          MMP {run.metamodel?.id} v{run.metamodel?.version}
          <br />
          <code>{run.metamodel?.sha256}</code>
        </p>
        {run.snapshots.map((s) => (
          <p key={s.id}>
            <strong>
              {snapshots.find((x) => x.id === s.id)?.fileName ?? s.sourceId}
            </strong>
            <br />
            <code>{s.sha256}</code>
            <small>
              Profilversion {s.profileVersion} · profilhash {s.profileHash}
            </small>
          </p>
        ))}
      </details>
    </section>
  );
}
