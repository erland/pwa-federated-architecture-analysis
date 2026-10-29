# Specifikation – analysmotor och referensscenarier för federerat analysverktyg

**Version:** 0.2 (förslag)  
**Datum:** 2026-10-25  
**Status:** Diskussions- och utvecklingsunderlag  
**Relation:** Kompletterar *Specifikation – federerat metamodellstyrt analysverktyg v0.1*. Denna specifikation prioriterar **analys före avancerad import och mappning**.

## 1. Syfte

Utveckla en generell, metamodellstyrd analysmotor som kan kombinera objekt, relationer, egenskaper och kvantitativa observationer från flera källor. Första leveransen ska bevisa analysnyttan med representativa exempeldata, innan vi investerar i en omfattande import- och identitetsmatchningslösning.

Målgruppen är bland annat organisationer med begränsad EA-mognad, där relevant information finns i systemregister, Excel, ekonomi-/budgetunderlag, projektportföljer, avtal och resursplanering, men där process- och arkitekturrelationer kan vara ofullständiga.

**Produktprincip:** Användaren ska kunna utforska objekt och deras egenskaper, kombinera filter och mått, följa relationer och spara resultatet som en återanvändbar analysdefinition. Färdiga mallar och utforskande analys ska använda samma motor.

## 2. Omfattning och prioritering

Fyra referensscenarier ska styra utformningen:

| Scenario | Kärnfrågor | Förmågor som prövas |
|---|---|---|
| A. IT-portfölj | Vilka IT-stöd finns? Vilka är interna? Vem äger dem? | Urval, egenskapsfilter, gruppering, saknade värden |
| B. Kostnader och resurser | Vad kostar utveckling/förvaltning per IT-stöd och år? Hur fördelas kostnader från komponenter? | Observationer, dimensioner, relationer, summering, avstämning |
| C. Livscykel och förändring | Vilka IT-stöd är på väg att avvecklas? Vilka projekt påverkar dem? | Status, tidsvillkor, objektkopplingar, periodjämförelse |
| D. Utvecklingsanalys | Hur fördelas planerade/utfallna IT- och verksamhetstimmar mellan UO, LO, processer, avdelningar och år? | Hierarkier, multidimensionella mått, fördelningsregler, jämförelse |

**Tvärgående grundfunktion:** Datakvalitet och spårbarhet: identifiera saknade värden, olösta identiteter, motstridiga källuppgifter, ofördelade observationer och osäkra beräkningar.

**Senare utbyggnad:** Avtal/leverantörer, incidenter/ITSM, process- och konsekvensanalys, risk/efterlevnad och avancerad grafanalys. Dessa ska kunna tillkomma utan att motorn blir domänspecifik.

## 3. Grundläggande arkitektur

```text
MMP-metamodell (extern definition)
         │
         ▼
Analysmodell (objekt, relationer, egenskaper, observationer)
         │
         ▼
Generell analysmotor (urval, filtrering, navigering,
                     aggregering, fördelning, jämförelse)
         │
         ▼
Analysdefinitioner och parametrar
         │
         ▼
Resultat (tabell, diagram, objektvy, förklaring, export)
```

I den första prototypen matas analysmodellen från ett **versionshanterat exempeldata-set**, inte från en avancerad importpipeline. Senare ska importörer producera exakt samma analysmodell. Ingen analyslogik får bero på Excel-celladresser, XMI-struktur eller specifika källfiler.

MMP importeras som separat kontrakt för tillåtna objekttyper, relationstyper och egenskapsdefinitioner. MMP är **inte** lagringsplats för analysdefinitioner, källmappningar eller observationer. Utgå från publicerad MMP-formatversion och versionskontrollera stödet; anta inte att förtydliganden i ett specifikationskit automatiskt innebär en ny normativ formatversion.

## 4. Informationsmodell – minsta användbara kärna

### 4.1 Analysobjekt

- `id`: stabil intern identitet i analysprojektet.
- `typeRef`: referens till typ i MMP (namespace och typ-ID).
- `displayName`: presentationsnamn; identitet ska inte baseras på namn.
- `attributes`: typade egenskapsvärden med status och proveniens.
- `sourceRefs`: referenser till underliggande källposter.

Exempeltyper i testmetamodellen: `ITSupport`, `Component`, `Process`, `DevelopmentArea` (UO), `DeliveryArea` (LO), `Department`, `Project`. Dessa är **exempel**, inte hårdkodade typer i motorn.

### 4.2 Relationer

- `id`, `typeRef`, `sourceObjectId`, `targetObjectId`.
- `validFrom`/`validTo` vid behov.
- Proveniens och eventuell fördelningsandel/roll.
- Relationsriktning och ändpunkter ska respektera MMP.

Exempel: `ITSupport contains Component`, `Project affects ITSupport`, `DevelopmentArea contains DeliveryArea`, `DeliveryArea contributesTo Process`.

### 4.3 Observationer

Observationer ska vara förstaklassobjekt, **inte** endast attribut på IT-stöd eller komponenter.

| Fält | Syfte |
|---|---|
| `id` | Unik observationsidentitet |
| `subjectId` | Objekt observationen avser |
| `measureRef` | Måttdefinition, t.ex. utvecklingskostnad eller planerade timmar |
| `value` | Typat numeriskt värde |
| `unit` | SEK, timmar, antal etc. |
| `period` | År eller avgränsat tidsintervall |
| `dimensions` | T.ex. resurstyp, aktivitet, avdelning, scenario, plan/utfall |
| `provenance` | Källa, post, importversion och eventuell beräkningskedja |
| `valueStatus` | Känd, saknas, ej tillämplig, osäker eller konflikt |

Dimensioner ska ha stabila identifierare och definierad betydelse; fritextvärden får inte tyst skapa separata kategorier. Måttdefinitionen anger tillåten enhet, aggregeringsfunktion och vilka dimensioner som är relevanta.

### 4.4 Analysdefinition

Sparbar deklarativ definition med `id`, `version`, `name`, `targetType`, `filters`, `traversals`, `measures`, `groupBy`, `parameters`, `presentation` och `validationPolicy`. Referenser ska vara stabila typ-/relations-/mått-ID:n, inte etiketter. Definitionen ska gå att köra på nya data utan omskrivning.

### 4.5 Resultat och härledning

Ett resultat ska kunna visa **vilka objekt, observationer, relationer, regler och källposter** som bidrog. Bevara även utelämnade poster och orsaker, exempelvis okänd leveransform eller ofördelad kostnad. Presentationsvyer ska inte ändra beräkningssemantiken.

## 5. Generella analysoperationer

1. **Urval:** välj objekt utifrån typ, inklusive definierad undertypshantering.
2. **Filtrering:** villkor på egenskaper, observationer, datum, dimensioner och relationers existens.
3. **Gruppering:** gruppera efter typade attribut, relationer eller dimensionsvärden.
4. **Aggregering:** summa, antal, distinkta objekt, medelvärde, min/max; enhets- och dimensionskontroll.
5. **Relationsnavigering:** deklarerade relationsvägar i rätt riktning, med möjlighet att förklara varje träff.
6. **Hierarkisk sammanställning:** summera underliggande objekt med explicit regel för total-/delpost.
7. **Period- och scenariejämförelse:** exempelvis 2025 mot 2026, plan mot utfall, prognos mot budget.
8. **Fördelning:** koppla mått från en kostnads-/resursbärare till flera mottagare enligt en dokumenterad regel.
9. **Datakvalitet:** täckning, konflikter, okända värden, saknade relationer och omatchade objekt.
10. **Sammansättning:** ett analysresultats objekturval kan användas som indata till en ny analys.

En analysoperation ska vara **domänoberoende**. Namn som IT-stöd, UO och LO ska komma från metamodellen eller analysdefinitionen.

## 6. Referensscenario A – IT-portfölj

**Frågor:** Lista interna IT-stöd, filtrera efter ägare/leveransform/livscykel, gruppera efter avdelning, identifiera objekt som saknar attribut.

**Testdata:** IT-stöd med varierande leveransform, ägare, status och ett objekt utan leveransform.

**Förväntat beteende:** `leveransform = intern` inkluderar endast uttryckligen interna objekt; okänt värde ska inte behandlas som externt. Användaren kan se antal per grupp och öppna objektens källhänvisningar.

## 7. Referensscenario B – kostnads- och resursanalys

**Frågor:** Summera utvecklings- och förvaltningskostnad per IT-stöd, inklusive kostnader på komponenter; jämför år och avdelningar; identifiera kostnader som inte kan hänföras.

**Testdata:** IT-stöd med flera komponenter, kostnadsobservationer på komponentnivå, direktkostnader på IT-stöd, två år och minst en delad komponent.

**Beräkningsregler:**

- Direktkostnad och härledd komponentkostnad måste särredovisas för att undvika dubbelräkning.
- En observation får inte räknas mer än en gång inom samma resultatgrupp utan explicit fördelningsregel.
- Delade komponenter kräver val mellan `ej fördelad`, `explicit procentuell fördelning` och eventuell senare godkänd policy; tyst full dubbelallokering är inte tillåten.
- Saknade kostnader betyder **okänt**, inte automatiskt noll.
- SEK och timmar ska inte summeras med varandra; valuta och tidsperiod ska kontrolleras.
- Visa avstämning: originalbelopp = fördelat + ofördelat (med avrundningstolerans).

## 8. Referensscenario C – livscykel och förändring

**Frågor:** Vilka IT-stöd ska avvecklas inom vald period? Vilka pågående projekt berör dem? Hur mycket planerad utveckling läggs på dessa system?

**Testdata:** Livscykelstatus, planerat slutdatum, projekt med start/slut och relationer till IT-stöd samt resursobservationer per år.

**Förväntat beteende:** Filter på tid och status ska skilja nuläge från framtida planer. Frånvaro av projektrelation ska redovisas som "ingen dokumenterad koppling i valda källor", inte "inget projekt finns".

## 9. Referensscenario D – utvecklingsanalys

Utgå från behoven i det tidigare utvecklingsanalysverktyget, men modellera dem generellt.

### 9.1 Begrepp och mått

- UO och LO representeras som **konfigurerade objekttyper** och hierarkiska relationer.
- IT-timmar och verksamhetstimmar är observationer med `resourceType`.
- Utveckling/förvaltning är en klassificerande dimension `activityType`.
- Plan/utfall/prognos är en dimension `scenario` eller motsvarande.
- År och eventuell delperiod är tidsdimensioner.
- Avdelning och process kan vara dimensionsreferenser eller objektkopplingar beroende på källans granularitet.

### 9.2 Hierarkisk summering

UO kan innehålla en **egen övergripande del** samt underliggande LO. Totalen måste kunna definieras som `egen del + summa LO`, alternativt som en explicit inläst total som används för avstämning, **inte** läggs ovanpå delposterna. Regler för totaler och delposter ska vara deklarativa och testbara.

### 9.3 Fördelningar

Stöd som senare utbyggnad för procentfördelning av timmar/kostnader till processer och avdelningar. Varje fördelning behöver: källa, mål, period, fördelningsnyckel, andel, metod och proveniens. Kontrollera att andelar summerar till 100 % där full fördelning krävs. Partiell fördelning ska visa restpost.

### 9.4 Exempelanalyser

- Planerade IT-timmar per UO/LO och år.
- IT- respektive verksamhetstimmar för utveckling/förvaltning.
- Timmar per avdelning och process.
- Plan mot utfall och utveckling över flera år.
- Timmar för IT-stöd som samtidigt är planerade för avveckling (när identitets- och relationsunderlag finns).

## 10. Användarupplevelse

### 10.1 Två kompletterande arbetssätt

**Objektcentrerad utforskning:** börja i IT-stöd, UO, LO eller process; se attribut, mått, relationer och ursprung; avgränsa urvalet stegvis.

**Frågecentrerad analys:** välj sparad analysmall eller bygg en fråga genom att välja objekttyp, filter, mått, gruppering, period och vid behov relationsväg.

### 10.2 Resultatpresentation

Första versionen: tabell, enkel stapel-/linjegraf, summeringskort och detaljvy. Därefter hierarkisk drilldown, matris och nätverksvy. Varje resultat ska visa aktiva filter, period, beräkningsregel, datatäckning och möjlighet att granska bidragande poster.

### 10.3 Återanvändning

Spara analysdefinitioner oberoende av dataset och presentation. En ny användare ska senare kunna kombinera ett versionslåst MMP-paket, ett integrationspaket, aktuella källfiler och sparade analysdefinitioner. Den första prototypen behöver **inte** implementera hela återimportflödet, men analysdefinitionernas referenser måste vara stabila redan då.

## 11. Etappvis utvecklingsplan

| Etapp | Leverans | Klart när |
|---|---|---|
| 1. Analysprototyp | Lokal React/TypeScript-PWA, separat exempeldata, fyra enkla scenarier | Urval, filter, gruppering, summering och periodjämförelse fungerar; resultat kan granskas |
| 2. Generell motor | Deklarativa analysdefinitioner, relationsvägar, återanvändbara mått, enkel datakvalitet | En ny analys kan skapas utan ny domänspecifik kod |
| 3. MMP-koppling | Import och validering av MMP; typ-/relationsreferenser från paket | Samma motor fungerar med externa metamodelldefinitioner |
| 4. Begränsad källimport | Enkel Excel/CSV-import till den etablerade analysmodellen | Importerade data ger samma resultat som motsvarande exempeldata |
| 5. Återanvändbar integration | Sparade källprofiler, identitetsregister, integrationspaket, återimport | En annan användare kan välja delmängd av källor, läsa in nya filer och köra sparade analyser |
| 6. Avancerade analyser | Fördelningsregler, avstämning, fler relationer och källformat | Delade kostnader och UO/LO-fördelningar hanteras reproducerbart |

**Viktig ordningsprincip:** Etapp 1–2 ska testa både portfölj, kostnad, livscykel och enkel utvecklingsanalys med samma generella modell. Full fördelningsmotor kan vänta till etapp 6, men observationsmodellens dimensioner och härledning ska stödja den från början.

## 12. Tekniska principer

- Frontend: React/TypeScript; första versionen kan vara lokal PWA utan backend.
- Lagring: lokal projektlagring med tydligt export-/importformat; IndexedDB är ett möjligt val.
- Kärnan bör vara testbar som ett separat TypeScript-bibliotek utan UI-beroenden.
- Beräkningar ska vara deterministiska för samma modell, analysdefinition och parametrar.
- Versionslås analysdefinition, MMP-referens, dataögonblicksbild och eventuella fördelningsregler.
- Data med okänd eller konfliktfylld status får inte tyst konverteras till noll eller ett godtyckligt valt värde.
- Källornas sekretessklassning och proveniens ska följa med in i härledda resultat; exporter ska kunna begränsas.
- Inga dolda domänregler i presentationskomponenterna.

## 13. Acceptanskriterier för första prototypen

1. Det går att visa alla IT-stöd och filtrera på `leveransform = intern`; saknad leveransform redovisas separat.
2. Det går att summera utvecklingskostnad per IT-stöd från komponentobservationer för valt år.
3. En komponent som används av flera IT-stöd orsakar inte tyst dubbelräkning; ofördelad kostnad syns.
4. Det går att jämföra utvecklingskostnad 2025 och 2026.
5. Det går att identifiera IT-stöd med planerad avveckling inom ett valt tidsintervall.
6. Det går att visa projekt som har dokumenterad relation till ett valt IT-stöd.
7. Det går att gruppera planerade timmar per UO och LO, år och resurstyp.
8. Det går att skilja utveckling från förvaltning och IT från verksamhetstimmar.
9. Hierarkisk UO-total kan stämmas av mot egen del och LO utan dubbelräkning.
10. En användare kan klicka från ett aggregerat värde till de observationer och objekt som bidrog.
11. Analysdefinitionen kan sparas och köras på en annan version av exempeldata utan kodändring.
12. En enkel ny analys (annat filter/gruppering) kan konfigureras utan att ny domänspecifik kod skrivs, senast i etapp 2.
13. Datakvalitetsvyn visar saknade attribut och observationer som inte kan hänföras.
14. Samma dataset används av alla fyra scenarier, utan separata specialdatamodeller per analys.

## 14. Avgränsningar och öppna beslut

**Inte krav för första prototypen:** fullständig Excel-malltolkning, generell XMI, avancerad identitetsmatchning, flerkällssynkronisering, central server, AI-matchning, komplett visuell frågebyggare, komplex grafanalys eller produktionsmässig behörighetsstyrning.

**Beslut som bör tas efter prototypen:**

- Vilka måtttyper och aggregeringsfunktioner behövs utöver summa och antal?
- Ska dimensionsvärden modelleras som objekt, kodlistor eller båda beroende på behov?
- Vilka regler behövs för kostnadsfördelning på delade komponenter och UO/LO?
- Vilken presentationsform ger bäst stöd för att utforska relationer och förklara resultat?
- Hur uttrycker vi analysdefinitioner i ett stabilt maskinläsbart format?
- Vilken grad av MMP-semantik måste en första konsument stödja?

## 15. Rekommenderat nästa steg

Skapa **ett litet men sammanhängande syntetiskt dataset** med IT-stöd, komponenter, UO, LO, projekt, avdelningar, två till fyra år, kostnads- och timobservationer samt några avsiktliga datakvalitetsproblem. Bygg därefter en tunn analysprototyp med tabell, filter, gruppering, periodjämförelse och spårbar drilldown. Utvärdera användbarheten och informationsmodellen innan importmotorn byggs ut.

**Sammanfattande arkitekturbeslut:** Vi bygger en generell, observations- och relationsbaserad analysmotor, styrd av MMP och återanvändbara analysdefinitioner. Import och mappning ska på sikt mata denna motor, men ska inte styra dess utformning.
