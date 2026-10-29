# Specifikation – federerat metamodellstyrt analysverktyg

**Version:** 0.1 (förslag)  
**Datum:** 2026-10-25  
**Status:** Diskussions- och arkitekturunderlag, inte beslutat implementationskontrakt

## 1. Syfte och målbild

Verktyget ska göra det möjligt att kombinera och analysera information från flera fristående källor utan att kräva ett centralt, gemensamt arkitekturregister eller att källsystemen ändras. Användaren väljer en metamodell, importerar källmaterial, kopplar materialet till metamodellens begrepp, löser identiteter och analyserar den sammanställda informationen.

**Det centrala återanvändningskravet:** En användare ska kunna spara och dela tolkningar, mappningar och bekräftade identiteter så att en annan användare kan skapa en ny analys med alla eller en delmängd av källorna, importera uppdaterade data och komma direkt till analysen när kontrollerna är godkända.

### Utanför första versionens mål

Ingen metamodell-editor, ingen fullständig ArchiMate-/UML-editor, ingen generell XMI-parser för alla leverantörsvarianter, ingen tvåvägssynk till källsystem, ingen obligatorisk central server och ingen automatisk publicering av kombinerad känslig information.

## 2. Grundläggande principer

1. **MMP beskriver enbart metamodellen.** Analysverktyget importerar MMP men ändrar inte dess innehåll.
2. **Källmaterialet bevaras logiskt oförändrat.** Normalisering, mappningar och sammanslagningar lagras separat med spårbarhet.
3. **Identitet är inte samma sak som relation.** Två poster kan representera samma objekt eller olika objekt med en typad relation.
4. **Objekt är inte samma sak som observationer.** Kostnad, incidentantal och timmar kan ha år, period, organisation och andra dimensioner.
5. **Konfiguration återanvänds oberoende av aktuella datavärden.** Identitetsregister kan vara separat skyddade.
6. **Partiell import ska fungera.** Frånvarande källor får inte framstå som aktuella data.
7. **Varje analys är reproducerbar.** Lås metamodell, integrationskonfiguration, källversioner och beräkningsdefinitioner.
8. **Inga tysta gissningar.** Osäkra mappningar och konflikter synliggörs och kan blockera berörda analyser.

## 3. Förhållande till MMP

Utgångspunkt: bifogade **MMP Specification & Developer Kit 1.1.0**, vilket innehåller det publicerade **MMP-paketformatet 1.0.0**. Core 1.1-förtydliganden är ännu inte generellt normativa. MMP är ett projektspecifikt, verktygsneutralt utbytesformat för metamodeller – **inte** för instansdata eller importkonfiguration.

MMP-importen ska:

- läsa `.mmp.zip` eller motsvarande katalog enligt manifestets deklarerade sökvägar;
- verifiera manifest, filinventering, SHA-256, säker ZIP-hantering, lokal JSON Schema-validering och semantisk konsistens;
- förstå de sju obligatoriska canonical-delarna (`metamodel`, `properties`, `constraints`, `viewpoints`, `notation`, `provenance`, `version`) och valfri `guidance`;
- identifiera typer med MMP:s stabila namespace + lokalt ID, inte visningsnamn;
- visa vilka semantiska regler som stöds respektive inte stöds; `not_supported` får aldrig räknas som godkänt;
- låsa metamodel-ID, namespace, modellversion, paketformatversion och paketets innehållshash i varje analys;
- inte exekvera kod eller hämta externa schema-referenser vid import.

Analysverktyget ska inte kräva att alla importerade egenskaper finns i MMP. Analyslokala attribut, mätvärden och härledda mått är tillåtna utan att metamodellen ändras.

## 4. Tre separata artefakter

| Artefakt | Ägare | Innehåll | Delning |
|---|---|---|---|
| **Metamodellpaket (MMP)** | Metamodel Builder | Typdefinitioner, egenskaper, relationer, regler, version | Verktygsneutralt |
| **Integrationspaket (föreslaget format)** | Analysverktyget | Källprofiler, typ-/fält-/relationsmappningar, identifierings- och kopplingsregler, valfria bekräftade identiteter | Återanvänds mellan analyser |
| **Analysprojekt** | Analysverktyget/användaren | Valda källor, importversioner, faktiska data eller referenser, analysidentiteter, lokala undantag, analyser och resultat | Delas enligt åtkomstregler |

Ett integrationspaket får inte vara en förutsättning för att skapa en engångsanalys; konfigurationen kan byggas stegvis och exporteras senare.

## 5. Informationsmodell

### 5.1 Metamodell

- `MetamodelReference`: namespace, id, version, packageFormatVersion, contentHash.
- `TypeDefinition`, `RelationshipTypeDefinition`, `PropertyDefinition`: läses från MMP; inga lokala redigeringar av definitionerna.

### 5.2 Källor och importer

- `SourceDefinition`: stabilt käll-ID, namn, format, beskrivning, ägare, klassning, förväntad struktur och hur nya data tillhandahålls.
- `SourceProfile`: versionerad instruktion för hur en källtyp tolkas, inklusive ark/urval, fält, nycklar, datatyper, radsemantik och mappningar.
- `SourceSnapshot`: konkret importtillfälle med käll-ID, tidpunkt, filhash, eventuellt verksamhetsdatum, profilversion och importstatus.
- `SourceRecord`: källpostens stabila logiska nyckel inom källa, råvärden, ursprunglig plats och snapshotreferens.
- `SourceRelationship`: importerad relation med egna käll-ID:n och ändpunkter.

Radnummer är spårbarhetsmetadata, **inte** normal identitetsnyckel. Vid avsaknad av stabil nyckel krävs uttrycklig strategi och varning om osäker återimport.

### 5.3 Mappningar och identitet

- `TypeMapping`: källans klass/radtyp → MMP-typ; tillåt omappat.
- `PropertyMapping`: kolumn/egenskap → MMP-egenskap eller analyslokalt fält; inkluderar transformation, enhet, nullhantering och datatyp.
- `RelationshipMapping`: källrelation → MMP-relation, inklusive riktning och ändpunktsregler.
- `ObservationMapping`: rader eller fält → mått + dimensioner, t.ex. kostnad per IT-stöd/år/avdelning.
- `IdentityRule`: matchningsstrategi, källomfång, typomfång, prioritet och konfidenspolicy.
- `IdentityAssertion`: bekräftat, avvisat eller preliminärt påstående om källidentiteter; med beslutsfattare, tid och ursprung.
- `AnalysisEntity`: analyslokal stabil identitet, MMP-typ, visningsnamn och kopplingar till källidentiteter.
- `AnalysisRelationship`: typad relation mellan analysobjekt med ursprung och giltighet.
- `Observation`: mätvärde/händelse med mått, enhet, tidsdimension, andra dimensioner och källa.

**Kritisk åtskillnad:** Ett alias (`ÄHS`) är inte globalt unikt; koppla alias till källkontext, typ och eventuell giltighetsperiod. En bekräftad identitet mellan två källposter ska inte utan vidare göra alla framtida likalydande poster identiska.

### 5.4 Analys

- `AnalysisDefinition`: urval, filter, grupperingar, mått, aggregationsregler och visualiseringar.
- `DerivedMeasure`: beräkningsuttryck, enhet, dimensioner, hantering av saknade värden och version.
- `AnalysisRun`: referenser till exakta snapshots, paketversioner, eventuella undantag, tidpunkt och resultatstatus.

## 6. Källformat och importflöde

### 6.1 Första källadaptrar

**XLSX:** Välj arbetsbok/ark/tabell, rubrikrad, kolumner, radfilter, objektnycklar, fälttyper och radsemantik (objekt, relation, observation). Flera tolkningar av samma ark tillåts. Förhandsvisa råvärden vid varje fältval.

**ArchiMate Model Exchange XML:** Läs element, relationer, egenskaper och källidentifierare; importera eventuella vyer som källmetadata där det är meningsfullt. Mappa typer och relationer mot vald MMP, utan antagande om identiska typnamn.

**Generell XMI:** Senare, genom explicit stödda profiler/leverantörsvarianter. XMI i sig garanterar inte enhetlig instanssemantik.

**CSV/API:** Möjliga senare adaptrar med samma interna importkontrakt.

### 6.2 Importprocess

1. Registrera eller välj `SourceDefinition` och eventuellt befintlig `SourceProfile`.
2. Läs filen säkert till en **stagingyta**; visa format, fält, provrader och datakvalitetsavvikelser.
3. Tillämpa och verifiera typ-, egenskaps-, relations- och observationsmappningar.
4. Identifiera stabila källposter och föreslå nya/ändrade/borttagna poster relativt tidigare snapshot.
5. Kör identitetsregler; återanvänd bekräftade identiteter där nycklar och kontext fortfarande håller.
6. Visa olösta matchningar, konflikter, dubbla poster och potentiell dubbelräkning.
7. Publicera snapshot atomärt till analysprojektet när nödvändiga kontroller är uppfyllda; annars behåll tidigare fungerande snapshot.
8. Bygg om berörda delar av analysmodellen och märk resultatets täckning/färskhet.

**Statusar:** `ready`, `ready_with_warnings`, `action_required`, `failed`. Analys får köras med varningar om användaren accepterar begränsningarna och de syns i resultatet.

## 7. Identitetsmatchning – prioritet och beslut

Prioritera: (1) beständigt verksamhets-ID, (2) käll-ID med dokumenterad stabilitet, (3) tidigare bekräftade identitetsassertioner, (4) kontrollerade alias i avgränsad kontext, (5) sammansatta attribut, (6) namnlikhet.

Resultat får vara `same_entity`, `related_entity`, `possible_match`, `different_entity` eller `unresolved`. Endast `same_entity` kan förena källposter under samma analysidentitet; `related_entity` ska skapa en typad relation. Automatiskt godkännande ska vara begränsat till uttryckligt säkra regler. Avvisade förslag sparas för att undvika upprepade falska positiva.

**Exempel:** Excel `ÄHS` och ArchiMate XML `Ärendehanteringssystem` kan matchas till analysobjekt `Ärendesystem`, men de ursprungliga benämningarna, käll-ID:n och attributvärdena bevaras. Ett ändrat visningsnamn påverkar inte identiteten.

Vid konflikter mellan källvärden ska användaren kunna ange auktoritativ källa per egenskap, alternativt behålla flera värden. Konfliktpolicy och härledning måste vara synliga i analysen.

## 8. Observationer, aggregation och datakvalitet

Exempel på Excel-rader:

| System | År | Avdelning | Kostnad SEK |
|---|---:|---|---:|
| ÄHS | 2025 | IT | 2 000 000 |
| ÄHS | 2025 | Verksamhet | 1 000 000 |
| ÄHS | 2026 | IT | 2 200 000 |

Dessa rader blir **tre observationer**, inte tre IT-stöd och inte en enda kostnadsegenskap. `Ärendesystem` har 3 000 000 SEK i **känd kostnad 2025**. Värdet för 2026 är 2 200 000 SEK i **känd importerad kostnad**, inte nödvändigtvis en fullständig årskostnad.

Varje mått ska ha aggregationsregel (`sum`, `count`, `distinct_count`, `avg`, `none` etc.), enhet, tidsgranularitet, dimensioner och eventuella villkor. Överlappande snapshots, samma transaktion i flera källor och olika kostnadsdefinitioner ska kunna upptäckas eller flaggas. Frånvarande källa är **saknade data**, inte noll.

## 9. Återanvändbart integrationspaket

### 9.1 Föreslagen logisk struktur (ej MMP-standard)

```text
integration-package.zip
  manifest.json
  metamodel-reference.json
  sources/
    application-register.yaml
    architecture-model.yaml
    costs.yaml
  mappings/
    type-mappings.yaml
    property-mappings.yaml
    relationship-mappings.yaml
    observation-mappings.yaml
  identity/
    matching-rules.yaml
    confirmed-identities.yaml       # valfri, åtkomststyrd
    rejected-matches.yaml          # valfri
  validation/
    expectations.yaml
  documentation/
    readme.md
```

Paketspecifikationen ska vara separat från MMP. Manifestet ska ange paket-ID/version, schema-/formatversion, MMP-kompatibilitet, beroenden, ingående källprofiler, SHA-256 per fil och eventuell säkerhetsklassning. Paketet ska kunna valideras offline. Inga lösenord, API-token eller källfiler ska ingå som standard.

### 9.2 Delningsnivåer

- **Profil:** En källas struktur och importregler, utan konkreta poster.
- **Integrationspaket utan identitetsregister:** Flera profiler och generella matchningsregler.
- **Integrationspaket med identitetsregister:** Dessutom bekräftade ID-/aliaskopplingar; kräver uttryckligt val och behörighetsprövning.

Även alias och interna ID:n kan vara känsliga. Paketet bör kunna maskera eller utesluta sådant material, och importen ska visa om identitetsregistret saknas.

### 9.3 Ny analys från paket

1. Välj paketversion och verifiera kompatibel MMP-version.
2. Välj **alla eller en delmängd** av källorna.
3. Tillhandahåll uppdaterade filer eller anslutningar; källans plats och autentisering anges separat.
4. Kör sparade importprofiler och identitetsregler.
5. Visa en **avvikelseöversikt**: ändrad struktur, nya/ändrade objekt, olösta identiteter, frånvarande källor och datatäckning.
6. Godkänn enbart avvikelser som behöver beslut och gå till analys.

En källa ska kunna användas självständigt även om andra paketkällor saknas. Bekräftade identiteter kan ge gemensamt namn men får inte förse analysen med gamla faktavärden från ej importerade källor.

### 9.4 Uppdatering och ändringshantering

Skilj på `replace_snapshot` (samma logiska datamängd uppdateras) och `append_period` (ny period/händelser tillkommer). Inga dubbletter får skapas vid idempotent återimport. Ändrade mappningsregler och identitetsregister ska versionshanteras och inte tyst förändra redan publicerade analysresultat. Analysprojekt kan välja att uppgradera och därefter få en konsekvensrapport.

## 10. Användargränssnitt

**Arbetsyta A – Metamodell:** välj/importera MMP, se begrepp och importstatus; ingen editor.

**Arbetsyta B – Källor:** katalog över källor, aktuella snapshots, format, klassning, kvalitet och uppdateringsstatus. En kort guide används vid ny import.

**Arbetsyta C – Kopplingar:** tre separata vyer för typ-/fältmappning, identitetsmatchning och relationsmappning; visa förslag, konflikter och täckning. Bekräftade beslut ska kunna återanvändas.

**Arbetsyta D – Analys:** filtrerbara tabeller, gruppering, mått, tidsurval, relationsnavigering, diagram och sparade analysdefinitioner. Varje resultat ska kunna spåras till källposter och regler.

**Arbetsyta E – Paket:** export/import av källprofiler och integrationspaket; välj delmängd, delningsnivå och version; visa kompatibilitet.

Undvik en enda lång obligatorisk importguide. Användaren ska kunna importera flera källor innan matchningarna är klara, och fortsätta analysera tillgängliga data med tydliga kvalitetsindikatorer.

## 11. Säkerhet och drift

En första implementation kan vara **lokal-first React/TypeScript-PWA** med IndexedDB och filbaserad import/export. Lokal körning eliminerar inte risker: webbläsarens lagring är inte automatiskt krypterad eller åtkomststyrd, och exporterade paket kan innehålla känsliga metadata. Undvik nätverksanrop med källdata som standard; gör externa integrationer explicita.

Framtida delning kräver separat behörighetsmodell för källor, identitetsregister, analysprojekt och exporter. Sammanställda analyser kan ha högre skyddsvärde än sina ingående källor. Export ska föregås av klassnings- och behörighetskontroll. Proveniens och revisionslogg ska kunna redovisa vem som godkände en matchning eller ändrade en regel.

## 12. Funktionell första version (MVP)

**Ingår:** MMP 1.0.0-import och validering; XLSX-import med provvärden; ArchiMate Model Exchange XML; generisk intern källmodell; typ-/egenskaps-/observations-/relationsmappning; bekräftade identiteter och alias; grundläggande regelbaserade förslag; återimport; versionslåsta källprofiler och integrationspaket; valfria källurval; tabeller, filter, grupperingar och summeringar; projektimport/-export; proveniens och importstatus.

**Senare:** leverantörsspecifik XMI, API-kopplingar, avancerad grafanalys, samarbetsserver, organisationsgemensamt katalogbibliotek, AI-förslag och avancerad regelmotor.

## 13. Acceptansscenarier

| ID | Scenario | Förväntat resultat |
|---|---|---|
| AC-01 | Importera giltigt MMP | Typdefinitioner läses med stabila ID:n och låst version |
| AC-02 | Importera manipulerat MMP | Import avvisas utan att exekvera innehåll |
| AC-03 | Mappa Excel `System` till MMP `IT-stöd` | Källposter får rätt typ, ursprung bevaras |
| AC-04 | Importera kostnader med upprepade system | En analysidentitet kan ha flera tids-/avdelningsobservationer |
| AC-05 | Importera ArchiMate XML och matcha `ÄHS` med `Ärendehanteringssystem` | Gemensamt analysobjekt `Ärendesystem`; källnamnen finns kvar |
| AC-06 | Markera ett namnlikt objekt som **inte samma** | Matchningen avvisas och föreslås inte igen på samma grunder |
| AC-07 | Exportera integrationspaket och skapa ny analys | Mappningar och bekräftade identiteter återanvänds utan manuell omkonfiguration |
| AC-08 | Importera endast kostnadskällan ur paketet | Kostnader analyseras; saknad arkitekturkälla markeras som frånvarande |
| AC-09 | Återimportera ändrad Excel med samma nycklar | Oförändrade identiteter bevaras; förändringar rapporteras |
| AC-10 | Byta kolumnnamn i Excel | Import föreslår ommappning och kräver beslut om inte säker regel finns |
| AC-11 | Två källor har olika systemägare | Båda källvärden visas; vald konfliktpolicy dokumenteras |
| AC-12 | Återimportera samma snapshot | Ingen dubbelräkning eller duplicering av poster |
| AC-13 | Öppna tidigare analys efter paketuppdatering | Tidigare resultat förblir knutet till ursprungliga versioner |
| AC-14 | Exportera paket utan identitetsregister | Källprofiler fungerar, skyddade alias/ID:n saknas |
| AC-15 | En källa saknas eller har ofullständig period | Resultatet visar täckning; saknad data räknas inte som noll |

## 14. Föreslagen utvecklingsordning

**Etapp 1 – Kärna och spårbar import:** MMP, källor, snapshots, XLSX, objekt/observationer, enkel tabellanalys.

**Etapp 2 – Koppling och återanvändning:** ArchiMate XML, typ-/relationsmappning, identitetsregister, konfliktlösning, profiler och integrationspaket.

**Etapp 3 – Robust uppdatering:** deltaidentifiering, partiella källurval, datatäckning, versionsuppgradering, reproducerbara analyskörningar.

**Etapp 4 – Fördjupad analys och delning:** relationsfrågor, härledda mått, visualiseringar, säkra samarbetsflöden och fler adaptrar.

Återanvändningsformat och stabil identitet ska **designas i etapp 1** även om den fulla användarupplevelsen levereras i etapp 2.

## 15. Öppna arkitekturbeslut

1. Ska integrationspaketets identitetsregister kunna referera en extern, behörighetsstyrd katalog eller enbart inbäddade assertioner?
2. Vilken minsta mängd identifierare krävs för säker automatisk återmatchning när källorna saknar permanenta ID:n?
3. Ska lokala analysundantag kunna föreslås tillbaka till ett delat integrationspaket genom ett granskningsflöde?
4. Hur ska källor med olika informationsklassning kombineras och hur ska resultatets skyddsnivå bestämmas?
5. Hur mycket av analysprojektet ska sparas som data respektive referenser till källsnapshots?
6. Vilka förändringar av MMP-version ska accepteras automatiskt respektive kräva ommappning?

## 16. Rekommenderat nästa steg

Definiera ett **maskinläsbart schema för källprofil och integrationspaket**, inklusive stabila ID:n, versionshantering, källnycklar, typ-/fält-/observationsmappningar och identitetsassertioner. Bygg sedan en liten vertikal prototyp: MMP + två Excel-filer + en ArchiMate XML, spara konfigurationen och skapa en ny analys med uppdaterade filer och delmängd av källorna. Utvärdera framför allt hur många manuella beslut som faktiskt krävs vid den andra importen.
