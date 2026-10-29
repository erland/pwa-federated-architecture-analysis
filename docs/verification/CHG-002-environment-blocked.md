# CHG-002 verification – 0.1.2

Status: passed_with_deferred (browser environment unavailable). No observed project failure remains.

PASS: npm run format:check; npm test (74 tests, 9 suites); npm run build (strict TypeScript + Vite + service worker). A real React server-rendering test verifies the start UI offers own configuration/file import and contains no example text, cards or links. Existing parser, mapping, identity, reuse and persistence tests pass using source-only fixtures.

PASS: all six example files were moved byte-for-byte from public/examples to examples/, compared against delivered 0.1.1 ZIP. Existing fixtures remain manually importable through the generic file chooser. Generator and test paths updated; no fixture data were changed.

PASS: inspected all eight actual dist files. No example directory/files, example-import UI text, fixture filenames or ./examples/ resource paths are shipped or precached. Build-time guard rejects known fixture files if they accidentally enter dist. Exact production filenames/hashes: production-files.json. Complete source/test hashes: verified-revision.json.

Not PASS / deferred: 11 browser tests could not execute app assertions. Agent Workspace workspace_create returned internal server errors twice; get_profile failed similarly. Local Playwright browser download returned invalid/truncated archives. Installed system Chromium could not launch: socket() failed: Operation not permitted. Browser results.json records launch failures, not application assertion failures. Re-run npm run test:e2e in a compatible environment. No new remote preview was created because remote build execution was unavailable.

Delivery includes complete source plus built runtime dist/ (intentional runtime deliverable), with examples/ only in the source tree. Existing user configurations and stored work are preserved. Prior 0.1.1 browser PASS evidence remains archived separately and is not used as PASS for changed source.

Production contents, ZIP integrity, source/example preservation and project-state consistency are checked at packaging. Existing limitations around limited MMP profiles, full workspace export and Safari/iPad release acceptance remain unchanged.
