import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import {
  emptyWorkspace,
  loadWorkspace,
  saveWorkspace,
} from "../src/storage/workspace";
import { createAnalysisType } from "../src/domain/contracts";
import { importTypePackage } from "../src/config/packages";
test("new workspace contains no types, model, sources or runs", () => {
  expect(emptyWorkspace()).toEqual({
    schemaVersion: 1,
    activeTypeId: "",
    types: [],
    models: {},
    snapshots: {},
    history: {},
    runs: [],
  });
});
test("creating a type is explicit and creates a separate draft without examples or mappings", () => {
  const a = createAnalysisType(),
    b = createAnalysisType();
  expect(a.id).not.toBe(b.id);
  expect(a.name).toBe("Ny analystyp");
  expect(a.published).toBe(false);
  expect(a.metamodel).toBeUndefined();
  expect(a.excel).toBeUndefined();
  expect(a.xml).toBeUndefined();
  expect(a.identities).toEqual([]);
});
test("startup keeps saved work but never activates it automatically", async () => {
  const { config, model } = await importTypePackage(
    readFileSync("examples/analysis-type.json", "utf8"),
  );
  const w = emptyWorkspace();
  w.activeTypeId = config.id;
  w.types = [config];
  w.models[model.reference.sha256] = model;
  await saveWorkspace(w);
  const startup = await loadWorkspace();
  expect(startup.activeTypeId).toBe("");
  expect(startup.types).toEqual([config]);
  expect(startup.models[model.reference.sha256].reference).toEqual(
    model.reference,
  );
});
test.each([
  {
    file: "analysis-type-portfolio.json",
    id: "faa-register-example",
    views: ["A"],
    source: "excel",
  },
  {
    file: "analysis-type-process.json",
    id: "faa-process-example",
    views: ["B"],
    source: "xml",
  },
  {
    file: "analysis-type.json",
    id: "faa-reference",
    views: ["A", "B", "C"],
    source: "both",
  },
])(
  "example $file is an independently valid opt-in configuration",
  async ({ file, id, views, source }) => {
    const { config } = await importTypePackage(
      readFileSync("examples/" + file, "utf8"),
    );
    expect(config.id).toBe(id);
    expect(config.views.map((v) => v.id)).toEqual(views);
    expect(config.identities).toEqual([]);
    expect(Boolean(config.excel)).toBe(source !== "xml");
    expect(Boolean(config.xml)).toBe(source !== "excel");
  },
);
