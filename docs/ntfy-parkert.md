# ntfy-varsling — parkert i v1

## Hva er parkert

«Følg fylker»-funksjonaliteten (per-fylke push-varsling via ntfy og Web Push) er tatt ut av v1-grensesnittet. All koden er bevart og kommentert ut med markøren `// SKJULT I v1 — ntfy-varsling`.

## Hvorfor

Varslingsfunksjonen er ikke god nok ennå:

- **Støy-problem**: Følger man et stort fylke (f.eks. Oslo) ville man fått push-varsling på hvert enkelt Vegvesen-vegarbeid — potensielt hundrevis av meldinger per dag.
- **Ingen filtrering**: Vi mangler muligheten til å la brukeren velge kilde (kun MET/NVE, ikke vegvesen) eller alvorlighetsnivå (kun oransje/rødt, ikke gult) før vi sender varsel.
- **ntfy-server**: ntfy.varselkart.no er satt opp, men er ikke produksjonsklar for stort abonnentvolum.

## Hva som er bevart

- `frontend/src/subscribe.js` — panelet med fylke-toggles, Web Push-bryter og ntfy-emner
- `frontend/index.html` — `#sheet-bell` og `#bell-btn` (kommentert ut)
- `frontend/om.html` — ntfy-steg og bell-knapp (kommentert ut)
- `frontend/src/app.js` — `åpneBell()`, `oppdaterBellCount()`, `lagreSubs()`/`lastSubs()` (inaktive)
- `backend/app/ntfy/publisher.py` — backend-publisering
- `ntfy/server.yml` — ntfy-tjener-konfig

## Plan for gjeninnføring

Varslingen bør løftes tilbake når:

1. Brukeren kan velge **hvilke kilder** de vil varsles om (minimum: ekskluder Vegvesen fra standard).
2. Brukeren kan sette **minimumsterskel** for alvorlighetsgrad.
3. Backend har **deduplicering** slik at samme varsel ikke sender to push-meldinger.
4. ntfy-serveren er testet for last med flere samtidige abonnenter.

Se `docs/ntfy.md` for teknisk dokumentasjon av ntfy-oppsettet.
