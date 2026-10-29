import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
const example = (name: string) => resolve("examples", name);
async function configuration(page: Page) {
  await page.goto("/");
  await page.getByText("Importera analystyp", { exact: true }).click();
  await page
    .locator("#config-file")
    .setInputFiles(example("analysis-type.json"));
  await expect(page.locator("#analysis-type")).toContainText(
    "System, UO och processer – exempel",
  );
  await expect(
    page.getByText("Analystyp importerad och validerad.", { exact: false }),
  ).toBeVisible();
}
async function excel(page: Page) {
  await page
    .locator("#excel-file")
    .setInputFiles(example("systemregister.xlsx"));
  await expect(page.locator("#excel-stage")).toBeVisible();
  await page.locator("#excel-stage").click();
  await expect(page.locator("#excel-publish")).toBeVisible();
  await page.locator("#excel-publish").click();
  await expect(page.locator("#reuse-excel")).toBeDisabled();
}
async function xml(page: Page) {
  await page.locator("#xml-file").setInputFiles(example("architecture.xml"));
  await expect(page.locator("#xml-stage")).toBeVisible();
  await page.locator("#xml-stage").click();
  await expect(page.locator("#xml-publish")).toBeVisible();
  await page.locator("#xml-publish").click();
  await expect(page.locator("#reuse-xml")).toBeDisabled();
}
test("navigation and source requirements on iPad and mobile", async ({
  page,
}) => {
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 850 });
    await configuration(page);
    await expect(page.locator(".brand")).toHaveText(
      /Federated\s+Architecture Analysis/,
    );
    await page.locator("#nav-config").click();
    await expect(
      page.getByRole("heading", { name: "En grund att återanvända." }),
    ).toBeVisible();
    await page.locator("#nav-analysis").click();
    await page.locator("#view-B").click();
    await expect(
      page.getByRole("heading", {
        name: "System som stödjer process",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Arkitekturmodell", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("#excel-file")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("fresh A session, export/import reuse, persistence and failed staging", async ({
  page,
  browser,
}) => {
  await configuration(page);
  await expect(page.locator("#xml-file")).toHaveCount(0);
  await expect(page.locator("#run-analysis")).toBeDisabled();
  await excel(page);
  await page.locator("#filter-uo").selectOption("Nord");
  await page.locator("#run-analysis").click();
  await expect(page.locator("#analysis-result tbody tr")).toHaveCount(2);
  await expect(page.locator("#analysis-result")).toContainText("ÄHS");
  await expect(page.locator("#analysis-result")).toContainText("Arkiv");
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Register").addRows([
    ["ID", "Wrong", "UO"],
    ["bad", "Bad", "Nord"],
  ]);
  await page.locator("#excel-file").setInputFiles({
    name: "bad.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
  });
  await page.locator("#excel-stage").click();
  await expect(page.getByRole("alert")).toContainText("Saknad kolumn");
  await page.reload();
  await expect(page.locator("#empty-workspace")).toBeVisible();
  await expect(page.locator("#analysis-type")).toHaveCount(0);
  await page.locator("#saved-analysis-types summary").click();
  await page.locator("#resume-faa-reference").click();
  await expect(
    page.getByText("Sparat, ej valt", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#run-analysis")).toBeDisabled();
  await page.locator("#reuse-excel").click();
  await expect(page.locator("#run-analysis")).toBeEnabled();
  await page.locator("#nav-config").click();
  const downloaded = page.waitForEvent("download");
  await page.locator("#export-type").click();
  const file = await downloaded;
  const path = await file.path();
  const fresh = await browser.newContext(),
    other = await fresh.newPage();
  await other.goto("/");
  await other.getByText("Importera analystyp", { exact: true }).click();
  await other.locator("#config-file").setInputFiles(path!);
  await expect(other.locator("#analysis-type")).toContainText("exempel");
  await expect(other.locator("#reuse-excel")).toHaveCount(0);
  await excel(other);
  await other.locator("#run-analysis").click();
  await expect(other.locator("#analysis-result tbody tr")).toHaveCount(3);
  await fresh.close();
});
test("B runs XML only and explains two directed steps", async ({ page }) => {
  await configuration(page);
  await page.locator("#view-B").click();
  await expect(page.locator("#excel-file")).toHaveCount(0);
  await xml(page);
  await page
    .locator("#filter-process")
    .selectOption({ label: "Hantera ärende" });
  await page.locator("#run-analysis").click();
  await expect(page.locator("#analysis-result tbody tr")).toHaveCount(1);
  await page.getByText("2 källrelationer", { exact: true }).click();
  await expect(page.locator("#analysis-result")).toContainText(
    "faa-example/serves-1",
  );
  await expect(page.locator("#analysis-result")).toContainText(
    "faa-example/realizes-1",
  );
});
test("C needs both sources and explicit identity decision; historical run stays pinned", async ({
  page,
}) => {
  await configuration(page);
  await page.locator("#view-C").click();
  await excel(page);
  await expect(page.locator("#run-analysis")).toBeDisabled();
  await xml(page);
  await page
    .locator("#filter-process")
    .selectOption({ label: "Hantera ärende" });
  await page.locator("#filter-uo").selectOption("Nord");
  await page.locator("#run-analysis").click();
  await expect(page.locator("#analysis-result tbody tr")).toHaveCount(0);
  await page.locator("#identity-left").selectOption("excel:s1");
  await page.locator("#identity-right").selectOption("xml:faa-example%2Fapp-1");
  await page.locator("#identity-confirm").click();
  await expect(page.locator("#run-analysis")).toBeDisabled();
  await page.locator("#nav-config").click();
  await page.locator("#publish-type").click();
  await page.locator("#nav-analysis").click();
  await page.locator("#run-analysis").click();
  await expect(page.locator("#analysis-result tbody tr")).toHaveCount(1);
  await expect(page.locator("#analysis-result")).toContainText("ÄHS");
  await page.locator("#run-history").selectOption({ index: 2 });
  await expect(
    page.getByRole("heading", { name: "Historiskt resultat" }),
  ).toBeVisible();
  await expect(page.locator("#analysis-result tbody tr")).toHaveCount(0);
});
test("service worker controls and reload works offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Börja med en tom arbetsyta." }),
  ).toBeVisible();
  await page.locator("#create-analysis-type").click();
  await expect(
    page.getByRole("heading", { name: "En grund att återanvända." }),
  ).toBeVisible();
});
test("default start is genuinely empty and a failed import leaves it empty", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#empty-workspace")).toBeVisible();
  await expect(page.locator("#analysis-type")).toHaveCount(0);
  await expect(page.locator(".views")).toHaveCount(0);
  await expect(
    page.locator("#excel-file, #xml-file, #analysis-result"),
  ).toHaveCount(0);
  await expect(page.locator(".example-card")).toHaveCount(0);
  await expect(page.getByText(/exempel/i)).toHaveCount(0);
  await expect(
    page.locator('a[href*="examples"], [id^="example-import-"]'),
  ).toHaveCount(0);
  await page.locator("#config-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("alert")).toContainText("Konfigurationsformat");
  await expect(page.locator("#empty-workspace")).toBeVisible();
  await page.reload();
  await expect(page.locator("#empty-workspace")).toBeVisible();
  await expect(page.locator("#saved-analysis-types")).toHaveCount(0);
});
for (const entry of [
  {
    id: "portfolio",
    file: "analysis-type-portfolio.json",
    view: "A",
    source: "excel",
  },
  {
    id: "process",
    file: "analysis-type-process.json",
    view: "B",
    source: "xml",
  },
  { id: "federated", file: "analysis-type.json", view: "C", source: "both" },
])
  test(
    "source-only fixture imported through normal file picker: " + entry.id,
    async ({ page }) => {
      await page.goto("/");
      await page.locator("#config-file").setInputFiles(example(entry.file));
      await expect(page.locator("#empty-workspace")).toHaveCount(0);
      await page.locator("#view-" + entry.view).click();
      await expect(page.locator("#run-analysis")).toBeDisabled();
      await expect(page.locator("#excel-file")).toHaveCount(
        entry.source === "xml" ? 0 : 1,
      );
      await expect(page.locator("#xml-file")).toHaveCount(
        entry.source === "excel" ? 0 : 1,
      );
      if (entry.source !== "xml") await excel(page);
      if (entry.source !== "excel") {
        await xml(page);
        await page
          .locator("#filter-process")
          .selectOption({ label: "Hantera ärende" });
      }
      if (entry.source !== "xml")
        await page.locator("#filter-uo").selectOption("Nord");
      await page.locator("#run-analysis").click();
      await expect(page.locator("#analysis-result tbody tr")).toHaveCount(
        entry.view === "A" ? 2 : entry.view === "B" ? 1 : 0,
      );
      await page.locator("#workspace-start").click();
      await expect(page.locator("#empty-workspace")).toBeVisible();
      await expect(
        page.locator("#analysis-type, #analysis-result"),
      ).toHaveCount(0);
      await page.locator("#saved-analysis-types summary").click();
      await expect(page.locator("#saved-analysis-types .source")).toHaveCount(
        1,
      );
    },
  );
test("whole configuration flow starts with an empty user-created type", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#create-analysis-type").click();
  await expect(page.locator("#config-name")).toHaveValue("Ny analystyp");
  await expect(page.locator("#mmp-publish")).toHaveCount(0);
  const viewB = page.getByRole("checkbox", { name: /^B ·/ });
  await viewB.click();
  await expect(viewB).not.toBeChecked();
  const viewC = page.getByRole("checkbox", { name: /^C ·/ });
  await viewC.click();
  await expect(viewC).not.toBeChecked();
  await page
    .locator("#mmp-file")
    .setInputFiles(example("faa-reference.mmp.zip"));
  await page.locator("#mmp-publish").click();
  await expect(
    page.getByText("Metamodell vald.", { exact: false }),
  ).toBeVisible();
  await page
    .locator("#excel-file")
    .setInputFiles(example("systemregister.xlsx"));
  await expect(page.locator("#excel-stage")).toBeVisible();
  await page
    .getByLabel("Systemtyp i MMP", { exact: true })
    .selectOption({ label: "System" });
  await page
    .getByLabel("UO-typ i MMP", { exact: true })
    .selectOption({ label: "UO" });
  await page
    .getByLabel("Tillhörighetsrelation i MMP", { exact: true })
    .selectOption({ label: "Tillhör" });
  await page.locator("#excel-stage").click();
  await page.locator("#excel-publish").click();
  await page.locator("#publish-type").click();
  await page.locator("#nav-analysis").click();
  await page.locator("#filter-uo").selectOption("Nord");
  await page.locator("#run-analysis").click();
  await expect(page.locator("#analysis-result tbody tr")).toHaveCount(2);
  await expect(page.locator("#analysis-type")).toContainText("Ny analystyp");
});

test("examples remain source-only and are absent from UI, production files and offline cache", async ({
  page,
}) => {
  const { existsSync, readdirSync, readFileSync } = await import("node:fs");
  expect(existsSync(resolve("examples/analysis-type.json"))).toBe(true);
  expect(existsSync(resolve("dist/examples"))).toBe(false);
  const files = readdirSync(resolve("dist"), { recursive: true }).map(String);
  const fixtureNames = [
    "analysis-type.json",
    "analysis-type-portfolio.json",
    "analysis-type-process.json",
    "systemregister.xlsx",
    "architecture.xml",
    "faa-reference.mmp.zip",
  ];
  for (const file of files)
    expect(fixtureNames).not.toContain(file.split("/").pop());
  const sw = readFileSync(resolve("dist/sw.js"), "utf8");
  expect(sw).not.toContain("examples/");
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await expect(page.getByText(/exempel/i)).toHaveCount(0);
  await expect(page.locator('a[href*="examples"], .example-card')).toHaveCount(
    0,
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map((r) => r.url));
    }
    return urls;
  });
  expect(cached.some((url) => url.includes("/examples/"))).toBe(false);
  expect(requests.some((url) => url.includes("/examples/"))).toBe(false);
  await page.locator("#create-analysis-type").click();
  await expect(page.getByText(/exempel/i)).toHaveCount(0);
  await expect(page.locator('a[href*="examples"], .example-card')).toHaveCount(
    0,
  );
});
