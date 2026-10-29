export type ViewKind = "A" | "B" | "C";
export interface SourceRequirement {
  id: string;
  name: string;
  format: "xlsx" | "archimate";
  keyPolicy: "source-local";
}
export interface AnalysisView {
  id: ViewKind;
  name: string;
  description: string;
  requiredSourceIds: string[];
}
export interface ExcelProfile {
  sheet: string;
  headerRow: number;
  key: string;
  name: string;
  uo: string;
  entityType: string;
  uoType: string;
  relationshipType: string;
}
export interface XmlProfile {
  elementTypes: Record<string, string>;
  relationshipTypes: Record<string, string>;
  processTypes: string[];
  applicationTypes: string[];
  paths: { type: string; direction: "out" | "in" }[][];
}
export interface MetamodelReference {
  id: string;
  version: string;
  namespace: string;
  sha256: string;
}
export interface IdentityAssertion {
  left: string;
  right: string;
  decision: "confirmed" | "rejected";
  leftType: string;
  rightType: string;
  leftFingerprint: string;
  rightFingerprint: string;
}
export interface AnalysisType {
  schemaVersion: 1;
  id: string;
  version: number;
  name: string;
  published: boolean;
  sources: SourceRequirement[];
  views: AnalysisView[];
  excel?: ExcelProfile;
  xml?: XmlProfile;
  metamodel?: MetamodelReference;
  identities: IdentityAssertion[];
}
export interface SourceRef {
  sourceId: string;
  recordId: string;
  snapshotId: string;
}
export interface Entity {
  id: string;
  typeRef: string;
  name: string;
  attributes: Record<string, string>;
  source: SourceRef;
}
export interface Relationship {
  id: string;
  typeRef: string;
  sourceId: string;
  targetId: string;
  source: SourceRef;
}
export interface SourceSnapshot {
  id: string;
  sourceId: string;
  fileName: string;
  sha256: string;
  importedAt: string;
  entities: Entity[];
  relationships: Relationship[];
  warnings: string[];
  profileVersion: number;
  profileHash?: string;
  metamodelSha256?: string;
}
export interface AnalysisRun {
  id: string;
  at: string;
  analysisTypeId: string;
  configVersion: number;
  viewId: ViewKind;
  snapshots: {
    id: string;
    sourceId: string;
    sha256: string;
    profileHash?: string;
    profileVersion?: number;
  }[];
  metamodel?: MetamodelReference;
  parameters: Record<string, string>;
  resultIds: string[];
  config: AnalysisType;
  engineVersion?: string;
  results?: {
    entityId: string;
    name: string;
    uo?: string;
    path: string[];
    match?: string;
  }[];
  warnings?: string[];
  coverage?: Record<string, number>;
}
export const initialType: AnalysisType = {
  schemaVersion: 1,
  id: "system-process",
  version: 1,
  name: "System, UO och processer",
  published: false,
  sources: [
    {
      id: "excel",
      name: "Systemregister",
      format: "xlsx",
      keyPolicy: "source-local",
    },
    {
      id: "xml",
      name: "Arkitekturmodell",
      format: "archimate",
      keyPolicy: "source-local",
    },
  ],
  views: [
    {
      id: "A",
      name: "System per UO",
      description: "Utforska systemregistrets tillhörighet.",
      requiredSourceIds: ["excel"],
    },
    {
      id: "B",
      name: "System som stödjer process",
      description: "Följ dokumenterade relationer från en process.",
      requiredSourceIds: ["xml"],
    },
    {
      id: "C",
      name: "UO och process",
      description:
        "Kombinera tillhörighet och processstöd med bekräftad identitet.",
      requiredSourceIds: ["excel", "xml"],
    },
  ],
  identities: [],
};
export function missingSources(
  view: AnalysisView,
  snapshots: SourceSnapshot[],
) {
  return view.requiredSourceIds.filter(
    (id) => !snapshots.some((s) => s.sourceId === id),
  );
}
export function entityId(source: string, key: string) {
  return `${source}:${encodeURIComponent(key)}`;
}

/** Supported source/view templates are created only after an explicit user action. */
export function createAnalysisType(): AnalysisType {
  return {
    ...structuredClone(initialType),
    id: crypto.randomUUID(),
    name: "Ny analystyp",
    version: 1,
    published: false,
  };
}
