# Federated Architecture Analysis

Lokal React/TypeScript-PWA för att kombinera systemregister (Excel), ArchiMate Model Exchange XML och MMP-metamodeller. Källdata behandlas i webbläsaren; ingen backend behövs.

Denna ZIP innehåller även färdigbyggd app i `dist/`. Den katalogen kan publiceras på en statisk HTTPS-server. Exempel finns endast i källprojektets `examples/`.

## Kör lokalt

Node.js 24 LTS rekommenderas (22.12+ stöds).

```bash
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

Öppna adressen som Vite visar. För att prova produktionsbyggningen: `npm run preview -- --host 127.0.0.1`. Publicera innehållet i `dist/` på valfri statisk HTTPS-server. Öppna inte index.html direkt via file://; service worker och PWA kräver HTTPS eller localhost. Applikationen använder relativa URL:er och kan publiceras i en underkatalog.

## Tom start

Appen öppnar startsidan utan aktiv analystyp. Välj **Skapa egen analystyp**, **Importera analystyp** eller öppna sparat arbete. Inga exempelkort, exempelknappar eller länkar till exempelfiler finns i applikationen.

## Exempel endast i källprojektet

Exempelfilerna finns i mappen `examples/` i projekt-ZIP:en. De ingår inte i `dist/`, hämtas inte av applikationen och sparas inte i offline-cachen. För att prova dem, välj konfigurationsfilen från din disk genom appens vanliga filimport och bifoga därefter källfilerna.

| Konfiguration | Källfiler i samma mapp | Förväntat resultat |
|---|---|---|
| `analysis-type-portfolio.json` | `systemregister.xlsx` | Vy A, Nord: ÄHS och Arkiv |
| `analysis-type-process.json` | `architecture.xml` | Vy B, Hantera ärende: ÄHS |
| `analysis-type.json` | Båda källfilerna | Vy C: ÄHS efter uttrycklig identitetsbekräftelse och publicering |

Alla exempel är syntetiska. Konfigurationerna innehåller MMP och mappningar men inga snapshots eller identitetsbeslut. `faa-reference.mmp.zip` kan användas vid konfiguration från grunden.

### Testa hela konfigurationsflödet från grunden

1. Hämta MMP-filen och Excel-källfilen ur källprojektets examples/-mapp. Välj sedan **Skapa egen analystyp**. Utkastet innehåller ingen MMP eller källmappning.
2. För ett enkelt första prov, låt endast vy A vara vald. Importera den hämtade MMP-filen under Konfiguration → Metamodell. Klicka **Använd metamodell**.
3. Bifoga systemregister.xlsx. Välj Register, rubrikrad 1 och kolumnerna ID/System/UO. Mappa Systemtyp = System, UO-typ = UO, Tillhörighetsrelation = Tillhör. Kontrollera och publicera snapshot.
4. Publicera analystypen, gå till Analys, välj Nord och kör. Resultatet ska innehålla ÄHS och Arkiv. Exportera analystypen för att sedan testa konfigurationsimport på startsidan.

Alla exempel är syntetiska. De är representativa formatprov, inte en verifierad export från en viss kund eller leverantör.

## Egen konfiguration och återanvändning

Importera MMP i Konfiguration, välj vy, importera källor och ange mappningar. XML frågar efter objekt-/relationstyper och explicita relationskedjor från process till system. Exempelkedjan är inkommande Serving och därefter inkommande Realization. Välj vilka av A/B/C som ska ingå och publicera analystypen. En A-konfiguration kan publiceras utan XML-profil, en B-konfiguration utan Excel-profil.

Exportera den publicerade analystypen som JSON. Den innehåller MMP och mappningar, inga källfiler, snapshots eller analysresultat. Identitetsbeslut utesluts som standard och kan väljas med uttryckligen. Import validerar om MMP och kontrollerar konfigurationen. Samma ID ersätter den lokala definitionen; gamla körningar behåller sina konfigurationer. **Ny analystyp från denna** skapar en separat definition.

Vid ny session öppnas först startsidan. Öppna en sparad analystyp explicit; inga sparade källor väljs automatiskt. Bifoga nya filer eller välj uttryckligen **Använd sparat snapshot**. Felaktig import bevarar aktivt snapshot. Ändrad mappning eller MMP blockerar gamla snapshots tills de importerats på nytt. Nya källversioner ersätter aktiv data utan att ändra tidigare körningar. **Tidigare körningar** visar låsta resultat och proveniens.

## Tester och underhåll

```bash
npm run typecheck
npm run format:check
npm test
npm run build
npx playwright install chromium --with-deps
npm run test:e2e
```

En befintlig kompatibel Chromium kan väljas med `CHROMIUM_PATH=/path/to/chromium`. `verification/browser/` är en separat npm-runner för Agent Workspace och utför samma browserkontroller; den ingår inte i produkten. Browserpaketets version är låst i package-lock.json.

Domäntester under `__tests__/`; automatiska UI-flöden under `e2e/`. Per-stegsevidens finns i `docs/verification/`. Maskinläsbar framdrift finns under `.system-builder/`. Utvecklingsplanen finns i `docs/utvecklingsplan.md`. `references/` bevarar ursprungliga diskussionsunderlag och det oförändrade Specification Kit 1.2.0.

## Gränser

Begränsad MMP 1.0.0/1.1.0-konsument enligt bifogat Kit; se `docs/mmp-compatibility.md`. Ingen full Core-/instanskonformitet eller generell regelutvärdering. Enkel XLSX, värden utan formler, och UTF-8 ArchiMate Exchange 3.x. Ingen generell XMI eller användarskript. Namn ger förslag men slår aldrig ihop objekt. Identitetsbeslut binds konservativt till nycklar, typer och granskade värden.

IndexedDB är lokal bekvämlighetslagring, inte backup. Rensade webbplatsdata tar bort lokala snapshots och körningar. Exporten säkerhetskopierar konfigurationen, inte hela arbetsytan; fullständigt projektutbyte hör till senare scope. Safaris/iPads installation, kvoter och långtidslagring behöver prövas på mål­enheten före drift.
