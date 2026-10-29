# Installation och drift

Bygg med låst package-lock.json: Node 24, npm ci, npm test, npm run build. Endast dist/ behövs på statisk server. Använd HTTPS, korrekt MIME för JS/CSS/JSON/webmanifest och publicera index.html samt sw.js med omvalidering (Cache-Control: no-cache). Hashade assets kan få lång immutable cache. Ingen serverhemlighet eller miljövariabel krävs.

Service worker precachar enbart appens statiska filer. Exempel i källprojektets examples/-mapp distribueras inte. Källdata sparas i IndexedDB, inte i nätverk eller service worker-cache. En ny appbyggning får en innehållshashad cacheversion. Gamla FAA-cacheversioner tas bort när den nya aktiveras. Körningar anger motorversion, konfiguration och dataversioner; uppgradera inte själva motorkoden mitt under känsligt analysarbete utan att granska resultat.

En PWA uppgraderas genom att ersätta de statiska filerna. Säker rollback: publicera föregående sammanhängande dist-byggning, inklusive dess sw.js och hashade assets. Rensa inte IndexedDB för rollback. Databasversion 1; inga destruktiva migreringar i denna leverans.

Konfigurationsbackup: exportera analystyp; spara originalkällfiler separat. Hela arbetsytan och körningshistoriken exporteras inte i första versionen. Browsers kan rensa lagring eller neka kvot. En lagringsoperation bekräftas först efter IndexedDB-transaktionens completion; vid fel visas fel och föregående sparade arbetsyta behålls.

Rekommenderade värdhuvuden för produktion: Content-Security-Policy med resurser från self, frame-ancestors enligt värdens policy, X-Content-Type-Options: nosniff och Referrer-Policy: no-referrer. Säkerställ att eventuell värdtelemetri inte registrerar källfiler eller härledda data. Dessa värdinställningar är inte en del av ZIP-appen och preview-tjänsten ska inte behandlas som en produktionsdriftsättning.

Verifiera på avsedd iPad/Safari före drift: installation till hemskärmen, ny/återöppnad session, IndexedDB-kvot, bakgrund/återupptagning, offline och uppgradering. Dessa plattformsgates ligger i utvecklingsplanens senare scope.
