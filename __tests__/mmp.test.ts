import { readFileSync } from "node:fs";
import { join } from "node:path";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { parse, stringify } from "yaml";
import { importMmp } from "../src/metamodel/import";
import {
  presenceStatus,
  typeRef,
  validateMappedSnapshot,
} from "../src/metamodel/model";
import { sha256, safeZip } from "../src/sources/safe-zip";
const root = join(__dirname, "fixtures/mmp");
const baseline = () =>
  new Uint8Array(readFileSync("examples/faa-reference.mmp.zip"));
async function mutate(
  fn: (files: Record<string, Uint8Array>) => void,
  rehash = true,
) {
  const f = unzipSync(baseline());
  fn(f);
  if (rehash) {
    const m = parse(new TextDecoder().decode(f["manifest.yaml"]));
    for (const item of m.files) item.sha256 = await sha256(f[item.path]);
    f["manifest.yaml"] = strToU8(stringify(m));
  }
  return zipSync(f);
}
const suite: { cases: { id: string; package: string; expected: string }[] } =
  JSON.parse(readFileSync(join(root, "test-manifest.json"), "utf8"));
test.each(suite.cases)("Kit package conformance: $id", async (c) => {
  const b = new Uint8Array(
    readFileSync(join(root, c.package.split("/").pop()!)),
  );
  if (c.expected === "accept")
    await expect(importMmp(b)).resolves.toHaveProperty("model");
  else await expect(importMmp(b)).rejects.toThrow();
});
test("published 1.1 combined profiles preserve exact pairs, structure and presence policy", async () => {
  const m = await importMmp(baseline());
  expect(m.formatVersion).toBe("1.1.0");
  expect(m.effectivePairs.belongs_to).toEqual([
    "element:application|element:unit",
  ]);
  expect(m.profiles["mmp-junction-structure"].junction_operators.gate).toBe(
    "and",
  );
  expect(
    m.profiles["mmp-required-default-presence"].default_satisfies_required,
  ).toBe(false);
  expect(typeRef(m, "unit")).toBe("https://example.org/faa#unit");
});
test.each(["unknown-property-set", "unknown-relation-parent"])(
  "semantic negative %s",
  async (name) => {
    await expect(
      importMmp(new Uint8Array(readFileSync(join(root, name + ".mmp.zip")))),
    ).rejects.toThrow();
  },
);
test("diamond inheritance effective properties", async () => {
  const m = await importMmp(
    new Uint8Array(readFileSync(join(root, "diamond-inheritance.mmp.zip"))),
  );
  expect(m.effectiveProperties.special_application).toEqual([
    "owner",
    "status",
  ]);
});
test.each(
  JSON.parse(
    readFileSync(join(root, "required-default-presence-v1.json"), "utf8"),
  ).cases as (Parameters<typeof presenceStatus>[0] & {
    id: string;
    expected: string;
  })[],
)("kit presence profile: $id", (c) =>
  expect(presenceStatus(c)).toBe(c.expected),
);
test("unknown required profile version fails closed", async () => {
  const b = await mutate((f) => {
    for (const n of ["manifest.yaml", "canonical/metamodel.yaml"]) {
      const d = parse(new TextDecoder().decode(f[n]));
      (n === "manifest.yaml"
        ? d.required_capabilities
        : d.metamodel.extensions.mmp_required_capabilities)[0].version =
        "99.0.0";
      f[n] = strToU8(stringify(d));
    }
  });
  await expect(importMmp(b)).rejects.toThrow("not_supported");
});
test("tampered profile fails hash before schema evaluation", async () => {
  const b = await mutate((f) => {
    f["documentation/required-default-presence.json"] = strToU8("{}");
  }, false);
  await expect(importMmp(b)).rejects.toThrow("SHA-256");
});
test("invalid presence policy rejected even after rehash", async () => {
  const b = await mutate((f) => {
    const p = JSON.parse(
      new TextDecoder().decode(
        f["documentation/required-default-presence.json"],
      ),
    );
    p.default_satisfies_required = true;
    f["documentation/required-default-presence.json"] = strToU8(
      JSON.stringify(p),
    );
  });
  await expect(importMmp(b)).rejects.toThrow();
});
test("typed pair cannot leave endpoint domain", async () => {
  const b = await mutate((f) => {
    const d = parse(new TextDecoder().decode(f["canonical/metamodel.yaml"]));
    d.relationships[0].allowed_typed_pairs[0].target.id = "business_process";
    f["canonical/metamodel.yaml"] = strToU8(stringify(d));
  });
  await expect(importMmp(b)).rejects.toThrow("utanför");
});
test("unknown schema cannot weaken trusted admission", async () => {
  const b = await mutate((f) => {
    f["schemas/metamodel.schema.json"] = strToU8(
      '{"$id":"unsafe","type":"object"}',
    );
  });
  await expect(importMmp(b)).rejects.toThrow("okänt schema");
});
test("traversal and compression bombs rejected before parsing", () => {
  expect(() => safeZip(zipSync({ "../evil": strToU8("bad") }))).toThrow(
    "Osäker",
  );
  expect(() => safeZip(zipSync({ bomb: new Uint8Array(2000000) }))).toThrow(
    "kompressionsgrad",
  );
});
test("exact typed pairs do not expand to subtypes", async () => {
  const b = await mutate((f) => {
    const d = parse(new TextDecoder().decode(f["canonical/metamodel.yaml"]));
    d.elements.push({
      id: "special_app",
      name: "Special",
      extends: ["application"],
    });
    f["canonical/metamodel.yaml"] = strToU8(stringify(d));
  });
  const m = await importMmp(b);
  expect(m.effectivePairs.belongs_to).toEqual([
    "element:application|element:unit",
  ]);
  const s: any = {
    entities: [
      { id: "a", typeRef: typeRef(m, "special_app") },
      { id: "b", typeRef: typeRef(m, "unit") },
    ],
    relationships: [
      {
        id: "x",
        typeRef: typeRef(m, "belongs_to"),
        sourceId: "a",
        targetId: "b",
      },
    ],
  };
  expect(() => validateMappedSnapshot(s, m)).toThrow("ändpunkterna");
  s.entities[0].typeRef = typeRef(m, "application");
  expect(() => validateMappedSnapshot(s, m)).not.toThrow();
});
test("typed multiple inheritance intersects exact pairs", async () => {
  const b = await mutate((f) => {
    const d = parse(new TextDecoder().decode(f["canonical/metamodel.yaml"])),
      r = d.relationships[0];
    r.target.types.push("business_process");
    r.target.typed_refs.push({ kind: "element", id: "business_process" });
    r.allowed_typed_pairs.push({
      source: { kind: "element", id: "application" },
      target: { kind: "element", id: "business_process" },
    });
    const parent = structuredClone(r);
    parent.id = "parent2";
    parent.allowed_typed_pairs.pop();
    const child = structuredClone(r);
    child.id = "child";
    child.extends = ["belongs_to", "parent2"];
    delete child.allowed_typed_pairs;
    d.relationships.push(parent, child);
    f["canonical/metamodel.yaml"] = strToU8(stringify(d));
  });
  const m = await importMmp(b);
  expect(m.effectivePairs.child).toEqual(["element:application|element:unit"]);
});
test.each([
  "inverted-endpoint-cardinality-v1",
  "inverted-property-cardinality-v1",
  "required-zero-cardinality-v1",
])(
  "kit does not require undeclared cardinality semantics for %s",
  async (name) => {
    await expect(
      importMmp(new Uint8Array(readFileSync(join(root, name + ".mmp.zip")))),
    ).resolves.toHaveProperty("formatVersion", "1.1.0");
  },
);
test("actual 1.0.0 package still admitted without 1.1 capabilities", async () => {
  const files = unzipSync(
      new Uint8Array(readFileSync(join(root, "valid-baseline.mmp.zip"))),
    ),
    manifest = parse(new TextDecoder().decode(files["manifest.yaml"]));
  manifest.package_format_version = "1.0.0";
  delete manifest.required_capabilities;
  files["manifest.yaml"] = strToU8(stringify(manifest));
  await expect(importMmp(zipSync(files))).resolves.toHaveProperty(
    "formatVersion",
    "1.0.0",
  );
});
