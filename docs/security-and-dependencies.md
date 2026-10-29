# Säkerhet och beroenden

Filer behandlas lokalt. Appens nätverksanrop gäller egna statiska resurser och service worker-installation. Ingen analytics eller backendklient finns. React renderar importerade namn som text, inte HTML. Inga användarskript, formler, externa XML-entiteter eller externa schemareferenser körs. ZIP och XML har explicit dokumenterade resursgränser. Lagringskvotfel bevarar senaste sparade tillståndet.

ExcelJS 4.4.0 är MIT men har äldre transitiva beroenden. uuid är låst till 11.1.1 via override för att undanröja dess advisory; Excel-läsning/skrivning verifieras med override. Äldre verktygspaket kan ge deprecation-varningar. npm audit är ett kontrollunderlag, inte bevis för frånvaro av alla sårbarheter. Slutkörningens audit-resultat anges i DEV-006-evidensen.

Jest har ett lågriskfynd via deepmerge i utvecklingsverktygen om ingen upstream-patch finns i låsfilen. Det används av fasta testkonfigurationer, inte av importerade källfiler eller produktionsappen. Ingen riskfylld automatisk nedgradering av Jest görs för att få ett tomt audit-resultat.

MMP-scheman begränsas till granskade signaturer från bifogat Kit; se mmp-compatibility.md. Obekanta scheman/profiler avvisas tydligt. Konfigurationsexport innehåller MMP, inte data; frivilliga identitetsbeslut kan ändå innehålla interna namn och nycklar. Granska filens skyddsvärde innan den delas.
