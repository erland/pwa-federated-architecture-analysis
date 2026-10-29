import { initialType, missingSources, entityId } from "../src/domain/contracts";
test("view dependencies are explicit and independent", () => {
  expect(initialType.views.map((v) => v.requiredSourceIds)).toEqual([
    ["excel"],
    ["xml"],
    ["excel", "xml"],
  ]);
  expect(missingSources(initialType.views[0], [])).toEqual(["excel"]);
});
test("source IDs never merge equal keys", () =>
  expect(entityId("excel", "a")).not.toBe(entityId("xml", "a")));
