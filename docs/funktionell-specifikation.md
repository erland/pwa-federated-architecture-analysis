# Funktionell specifikation – Federated Architecture Analysis

Version: 0.1 · Status: inriktning för första prototypen · 2026-10-28

## Syfte

Låt en konfiguratör publicera återanvändbara analystyper med MMP-metamodell, källkrav, mappningar, identitetsregler och analysvyer. En analysanvändare väljer analystyp eller vy, bifogar de källfiler som behövs och får spårbara resultat.

## Roller

- **Konfiguratör:** importerar och validerar MMP, registrerar källtyper, mappar typer/fält/relationer, beslutar identitetskopplingar, definierar och publicerar vyer.
- **Analysanvändare:** väljer analystyp/vy, tillhandahåller filer, granskar importvarningar, filtrerar och utforskar resultat.

## Funktionella krav

- FR-001: PWA utan serverberoende; data behandlas lokalt i webbläsaren.
- FR-002: Import av MMP-paketformat 1.1.0 enligt Specification Kit 1.2.0 (publicerad begränsad profilomfattning). Paketets obligatoriska kapabiliteter ska kontrolleras mot importörens dokumenterade stöd; inkompatibla paket ska avvisas med begripligt fel. Ingen full Core 1.1- eller instanskonformitet påstås. Okända/icke-stödda obligatoriska semantikregler får aldrig godkännas tyst.
- FR-003: Konfiguratör kan skapa en analystyp med flera vyer och deklarerade källkrav; varje vy deklarerar egna beroenden.
- FR-004: Enkla XLSX-tabeller kan läsas med val av ark, rubrikrad, nyckelkolumn och fältmappning.
- FR-005: ArchiMate Model Exchange XML kan importera applikationsobjekt, processer och relevanta relationer, med källa och riktning bevarad.
- FR-006: Identitetsmatchning mellan källposter kräver beständiga nycklar eller uttrycklig bekräftelse; ett namnsammanträffande räcker inte.
- FR-007: Fördefinierade analysvyer: system per UO, system som stödjer process, system inom valt UO som stödjer vald process.
- FR-008: Val av analysvy begär enbart de källtyper som vyn behöver, visar status och blockerar när obligatoriska källor saknas.
- FR-009: Sparad konfiguration kan återanvändas med nya filversioner; användaren kan exportera och importera analystyp lokalt.
- FR-010: Resultat anger källa, täckning, olösta identiteter och spårbara relationer; frånvarande källor får inte framstå som aktuella.
- FR-011: Nya källfiler importeras som staging och publiceras först efter kontroller; misslyckad import bevarar föregående fungerande snapshot.

## Första prototypens avgränsning

Ingår: MMP 1.1-orienterat stöd, enkel Excel, ArchiMate XML, enkel manuell mappning, tre vyer, lokalt sparad analystyp. Senare: skriptbar Excel-import, generell XMI, tidsserier, kostnads-/resursanalys, samarbetsserver.

## Acceptanstest för konceptet

1. Två filer innehåller delvis samma system, där Excel ger UO-tillhörighet och XML ger processstöd.
2. Analys A fungerar med enbart Excel och kräver inte XML.
3. Analys B fungerar med enbart XML och kräver inte Excel.
4. Analys C begär båda och visar bara säkert länkade system.
5. Omatchade system och indirekt härledda relationer syns, inga dolda namnbaserade sammanslagningar.
6. En ny analys kan använda samma konfiguration med uppdaterade källfiler.

## Ändring CHG-001 – tom start (FR-012)

Appen öppnar utan aktiv analystyp, metamodell, källvy eller resultat. En ny arbetsyta innehåller inga skapade analystyper. Tidigare sparade data bevaras men aktiveras först genom uttryckligt val av sparat arbete. Skapa egen analystyp, importera konfigurationsfil och importera ett av tre syntetiska exempel är separata användarval. Exempelimport aktiverar endast den valda konfigurationen; källfiler bifogas och publiceras separat. Startsidan kan öppnas igen utan att radera data.

## CHG-002 – exempel endast i källprojektet

Användarbeslut 2026-10-29 ersätter CHG-001:s exempelgalleri: den körbara applikationen får inte innehålla exempelkort, exempelimportknappar, exempellänkar eller medföljande exempelfiler. Exempel bevaras i källprojektet för manuell filimport och test. Vanlig konfigurationsimport, egen konfiguration, tom start och sparat arbete behålls. Produktionsbyggning och offline-cache ska utesluta exemplen.
