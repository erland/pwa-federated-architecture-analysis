# Utvecklingsplan – ett steg per prompt

Varje steg ska resultera i en komplett projekt-ZIP och verifierade tester. Kör inte nästa steg automatiskt.

## DEV-001 – PWA-skal och domänkontrakt

- Leverera Vite/React/TypeScript-PWA med mobil/iPad-anpassad navigation mellan **Konfiguration** och **Analys**.
- Definiera typer för analystyp, källkrav, analysvy, källsnapshot, objekt/relation och körning. Sätt upp Jest och __tests__.
- Visa val av analystyp och vilka källor varje analysvy behöver; ingen skarp import ännu.
- Verifiera: `npm ci`, `npm test`, `npm run build`; manuellt kontrollera vybyten. Done när PWA bygger och kontrakten testas.

## DEV-002 – Enkel Excel-import och system per UO

- Läs enkel XLSX lokalt; val av ark/rubrik/nyckel, förhandsgranskning och enkel mappning.
- Skapa analysgraf och vy A; spara lokalt snapshot.
- Verifiera med känd Excel-fixture: rätt system per UO och tydliga fel för saknad kolumn/nyckel.

## DEV-003 – MMP 1.1-konsument

- Implementera paketläsare mot bifogat Specification Kit 1.2.0 (paketformat 1.1.0) med format-/profilförhandling, schemakontroll, säker ZIP och semantisk validering.
- Koppla Excel-system och UO till deklarerade typer; visa explicita kompatibilitetsbegränsningar.
- Verifiera med positiva/negativa fixtures och tillämpliga 1.1-konformansfall; inte enbart en happy path.

## DEV-004 – ArchiMate Model Exchange XML

- Läs processer, applikationer och typade relationer inklusive käll-ID.
- Mappa mot MMP, skapa vy B och spåra vilka relationssteg som ger resultat.
- Verifiera importerade objekt, riktning och processfråga med verklig/representativ export.

## DEV-005 – Federerad identitet och analys C

- Matchningsförslag + bekräfta/avvisa, inget implicit namnmerge.
- Kombinera UO och processkriterier; visa matchningsstatus och täckning.
- Verifiera A/B/C med delvis överlappande källor samt negativa matchningsfall.

## DEV-006 – Publicerad analystyp och återanvändning

- Persistens och export/import av analystyper, vyernas källberoenden, återimport av ny data och run-proveniens.
- Verifiera att ny användarsession kan välja vy, bifoga enbart behövda filer och återanvända konfiguration.

## Senare

Säker sandlåda för TypeScript-importadaptrar (komplexa Excel), generella observationer/mått, ytterligare ArchiMate- och XMI-profiler, projektutbyte och E2E offline/PWA-releasekontroller.
