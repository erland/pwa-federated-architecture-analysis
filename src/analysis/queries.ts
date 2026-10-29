import type { SourceSnapshot, Entity } from "../domain/contracts";
export interface ResultRow {
  entity: Entity;
  uo?: string;
  path: string[];
  match?: string;
}
export function systemsPerUo(s: SourceSnapshot, uo: string = ""): ResultRow[] {
  const paths = new Map<string, string[]>();
  for (const r of s.relationships) {
    const list = paths.get(r.sourceId) ?? [];
    list.push(r.id);
    paths.set(r.sourceId, list);
  }
  return s.entities
    .filter((e) => e.attributes.uo && (!uo || e.attributes.uo === uo))
    .map((entity) => ({
      entity,
      uo: entity.attributes.uo,
      path: paths.get(entity.id) ?? [],
    }));
}
import type { XmlProfile } from "../domain/contracts";
export function systemsForProcess(
  s: SourceSnapshot,
  p: XmlProfile,
  processId: string,
): ResultRow[] {
  const process = s.entities.find((e) => e.id === processId);
  if (!process || !p.processTypes.includes(process.typeRef)) return [];
  const byId = new Map(s.entities.map((e) => [e.id, e])),
    result: ResultRow[] = [];
  const adjacent = new Map<string, typeof s.relationships>();
  for (const r of s.relationships)
    for (const direction of ["in", "out"] as const) {
      const key = JSON.stringify([
          direction,
          r.typeRef,
          direction === "in" ? r.targetId : r.sourceId,
        ]),
        list = adjacent.get(key) ?? [];
      list.push(r);
      adjacent.set(key, list);
    }
  for (const path of p.paths) {
    if (path.length < 1 || path.length > 5)
      throw Error("Ogiltig relationskedja.");
    let states: { id: string; path: string[]; visited: Set<string> }[] = [
      { id: processId, path: [], visited: new Set([processId]) },
    ];
    for (const step of path) {
      const next: typeof states = [];
      for (const state of states)
        for (const r of adjacent.get(
          JSON.stringify([step.direction, step.type, state.id]),
        ) ?? []) {
          const from = step.direction === "out" ? r.sourceId : r.targetId,
            to = step.direction === "out" ? r.targetId : r.sourceId;
          if (from === state.id && !state.visited.has(to)) {
            next.push({
              id: to,
              path: [...state.path, r.id],
              visited: new Set([...state.visited, to]),
            });
            if (next.length > 10000)
              throw Error(
                "Relationsfrågan ger för många vägar. Förfina kedjan.",
              );
          }
        }
      states = next;
    }
    for (const state of states) {
      const entity = byId.get(state.id);
      if (
        entity &&
        p.applicationTypes.includes(entity.typeRef) &&
        !result.some(
          (r) =>
            r.entity.id === entity.id &&
            r.path.join("|") === state.path.join("|"),
        )
      )
        result.push({ entity, path: state.path });
    }
  }
  return result;
}
