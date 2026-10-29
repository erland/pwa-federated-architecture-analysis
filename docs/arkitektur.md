# Arkitektur – första versionen

## Teknik

- React + TypeScript + Vite, PWA via manifest och service worker.
- IndexedDB för lokal lagring av analystyper, mappningar och snapshots; explicit JSON/ZIP export för portabilitet.
- Fristående domänmoduler: `metamodel`, `sources`, `mapping`, `identity`, `analysis`, `storage`, `ui`.
- Excel-parser (t.ex. SheetJS eller ExcelJS efter säkerhets-/licensbedömning), säker XML-parser för ArchiMate Model Exchange.
- Jest för domän-/frontendtester under `__tests__`. E2E med Playwright när grunden är på plats.

## Flöde

MMP-package → ZIP-integritet + lokal schemasemantik + stödd profil → metamodell

Vald vy → källberoenden → filinläsning → staging → mappning → identitetslösning → gemensam analysgraf → fråga → tabell/resultat med proveniens

## Grundobjekt

`AnalysisType`, `AnalysisView`, `SourceRequirement`, `SourceProfile`, `SourceSnapshot`, `SourceRecord`, `MetamodelReference`, `Entity`, `Relationship`, `IdentityAssertion`, `AnalysisRun`.

Varje vy har `requiredSourceIds`. En analystyp är ett konfigurationspaket; en analyskörning binder konkreta filhashar och versionsnummer.

## MMP-versionering

Styrande underlag är **MMP Specification Kit 1.2.0**, som publicerar **MMP-paketformat 1.1.0** i begränsad profilbaserad omfattning. Importören ska validera paketformat och manifest, jämföra deklarerade obligatoriska kapabiliteter med faktiskt implementerat stöd och avvisa inkompatibla paket. Exakt typade relationspar, strukturella junction-metadata och deklarerad required/default presence-policy ska bevaras där motsvarande profil stöds. Det ingår inte att hävda full Core 1.1-konformitet, generell instansgrafvalidering eller generell regelutvärdering. Verifiera importeraren mot kitets conformance-fixtures och `specification/mmp-1-1-limited-contract.md`.

## Risker och avgränsningar

- XML: avvisa DTD/externa entiteter och resurskrävande indata.
- ZIP: filinventering, hash, storleksgränser, path traversal, zip-bomb-kontroller.
- PWA: browserlagring är en enhetslokal bekvämlighet, inte backup; exportera konfiguration.
- Matchning: enbart bekräftade eller verifierbart säkra nyckelmatchningar skapar gemensam identitet.
- Relationsfrågor: börja med uttryckligt definierade kedjor mellan process och applikation.
- Ingen körning av användarskript i första versionen.

## Realiserad första prototyp

Produktnamn: **Federated Architecture Analysis**. Modulerna ligger under src/domain, src/metamodel, src/sources, src/identity, src/analysis, src/config, src/storage och src/ui. ExcelJS (MIT), xmldom (MIT), fflate (MIT), YAML (ISC), Ajv (MIT) och React (MIT) körs lokalt. UUID-beroendet för ExcelJS är låst med override; se säkerhetsnoteringar.

Återanvändningsformat: JSON-envelope faa-analysis-type, formatVersion 1, med strikt validerad AnalysisType och original-MMP som Base64. MMP omvalideras vid import. Källfiler/snapshots ingår inte; identitetsbeslut är opt-in. Konfigurationen versionshöjs och blir utkast vid ändring. Vyerna A/B/C har explicita, verifierade källberoenden; publicering kan avgränsas till en delmängd av dem.

IndexedDB lagrar en atomärt ersatt arbetsyta: analystyper, innehållslåsta MMP, aktuella snapshots per analystyp/källa, snapshothistorik och oföränderliga körningar. En serialiserad skrivkö skyddar samtidiga publiceringar från tappade uppdateringar. Varje session väljer aktiva källor explicit; sparade data är inte implicit aktuella.

En körning låser full konfiguration, motorversion, MMP-hash, källhashar, snapshot-ID, profilhash/-version, parametrar, resultat och varningar. Snapshot-ID omfattar en unik importversion; upprepad filimport ersätter aktiv källa och dubblerar inte grafens objekt. Historiken bevaras separat. Ändrad profil/MMP kräver återimport innan körning. Tidigare resultat skrivs inte om.

Importvalidering följs av explicit publicering. Relationsfrågor använder en indexerad graf, konfigurerade riktningar och begränsade kedjor (1–5 steg). Identitet är en separat koppling mellan källposter; källornas objekt och värden bevaras. Första versionen begränsar bekräftelser till en-till-en och samma MMP-typ. Namnförslag är begränsade till 200 visade kandidater; manuellt val finns för resten.

## CHG-001 – starttillstånd

emptyWorkspace returnerar tom katalog och tom activeTypeId. loadWorkspace återför sparat innehåll med tom activeTypeId för den nya sessionen. WorkspaceStart separerar startsidan från den aktiva analysen; ImportOptions visar tre explicita konfigurationsexempel. createAnalysisType skapar ett nytt utkast först efter användarens val. Befintliga databaser behöver ingen destruktiv migrering. Produktversionen läses från package.json även i UI och körningsproveniens.

## CHG-002 – separerad distribution av exempel

Exempelfiler är flyttade från public/examples till källprojektets examples/, utanför Vites public-katalog. ImportOptions innehåller enbart vanlig konfigurationsfilimport; galleri, exempelmetadata, länkar, fetch-anrop och tillhörande CSS är borttagna. Service worker byggs enbart från produktionsfiler; byggningen avvisar kända exempelfiler om de ändå råkar hamna i dist. Äldre FAA-cachar tas fortsatt bort vid ny service worker-aktivering. Inga sparade användarkonfigurationer raderas. Detta ersätter galleribeskrivningen under CHG-001 ovan.
