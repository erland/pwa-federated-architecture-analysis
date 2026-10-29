# MMP consumer scope

Uses the attached MMP Specification Kit 1.2.0, package format 1.1.0, published limited scope. Historical NO-GO documents inside the kit are not its current release decision.

Supported package versions are exactly 1.0.0 and 1.1.0. Mandatory capability IDs and exact versions:

| Capability | Version | Interpretation |
|---|---|---|
| mmp-pairwise-relationships | 1.0.0 | Element pair restrictions, subtype expansion as in supplied reference consumer, parent intersections |
| mmp-typed-endpoints | 1.0.0 | Element, relationship and junction references preserved and validated |
| mmp-typed-pairs | 1.0.0 | Exact typed pairs; parent intersections; no automatic subtype expansion |
| mmp-junction-structure | 0.1.0 | AND/OR structure metadata only; no junction execution |
| mmp-required-default-presence | 0.1.0 | Explicit presence; defaults do not satisfy required; null is not present |

Unknown required profiles/versions are rejected. Declaration and canonical metadata must match. Profile documents must be present exactly when required, hash-valid and schema-valid. Type IDs are namespace + encoded local ID. All original canonical documents and metadata are retained in the imported representation.

Three validation layers: strict ZIP inventory and SHA-256; trusted Kit schemas plus packaged schemas; cross-document IDs, inheritance cycles, references, effective property union and profile semantics. JSON Schema never fetches resources. For predictable safe validation this consumer accepts only schema byte signatures shipped in the attached Kit and its fixtures. A different schema is explicitly not_supported, even if otherwise standards-compliant; extending this whitelist needs review. This avoids executing arbitrary package-supplied regexes/schemas. No uploaded code executes.

Constraint rules are explicitly reported as not_supported. No full Core 1.1, general instance-graph/cardinality validation, arbitrary default evaluation, junction activation or general rule-language conformance is claimed. validateMappedSnapshot verifies mapped types and supported relationship endpoints/pairs; it is not full instance validation. Legacy 1.0.0 admission is not reinterpreted using optional future cardinality rules.

ZIP limits for MMP: 20 MiB input, 300 files, 32 MiB expanded total, 8 MiB each, compression ratio 200. ZIP64, encryption, symlinks, duplicates, directory entries and unsafe paths are rejected. Source XLSX has a separate 5,000-entry / 64 MiB expanded / 16 MiB member limit, the same input and ratio caps.
