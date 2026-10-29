import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceStart } from "../src/ui/ImportOptions";
test("runtime start offers own configuration and file import without built-in examples", () => {
  const html = renderToStaticMarkup(
    createElement(WorkspaceStart, {
      types: [],
      busy: false,
      onImport: async () => {},
      onError: () => {},
      onCreate: () => {},
      onResume: () => {},
    }),
  );
  expect(html).toContain("Skapa egen analystyp");
  expect(html).toContain("Importera konfigurationsfil");
  expect(html).not.toMatch(/exempel|examples\/|example-card|example-import/i);
  expect(html).not.toContain("href=");
});
