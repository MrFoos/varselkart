# varselkart.no

Offisielle norske varsler fra MET, NVE og Statens vegvesen samlet på ett interaktivt kart.

varselkart.no henter vær-, flom-, skred- og vegvarsler fra Norges offisielle etater og viser dem i sanntid på ett kart. Ingen konto, ingen sporing.

## Stack

- **Backend**: FastAPI + APScheduler + SQLite, kjører med uvicorn
- **Frontend**: Vanilla JS (ES-modules), MapLibre GL, Kartverket-fliser
- **Produksjon**: Docker Compose + nginx reverse proxy

## Kom i gang (lokal utvikling)

**Forutsetninger**: Python 3.12+, `make`

```bash
# 1. Klon og gå inn i mappen
git clone https://github.com/<bruker>/varselkart.git
cd varselkart

# 2. Sett opp miljøvariabler
cp .env.example .env
# Fyll inn DATEX_USERNAME og DATEX_PASSWORD (se .env.example for instruksjoner)

# 3. Installer avhengigheter og start
make install
make dev
```

Åpne [http://localhost:5300](http://localhost:5300).

Backend-API kjører på [http://localhost:8300](http://localhost:8300).

### Makefile-kommandoer

| Kommando | Beskrivelse |
|---|---|
| `make dev` | Start backend + frontend (med reload) |
| `make backend` | Start kun backend |
| `make frontend` | Start kun frontend |
| `make install` | Installer Python-avhengigheter i `.venv` |
| `make clean` | Slett database og `__pycache__` |

## Produksjon (Docker)

```bash
cp .env.example .env
# Fyll inn credentials og sett APP_ENV=production

docker compose up -d
```

Tjenestene starter på port 80. Sett opp HTTPS med Certbot etter at DNS peker til serveren:

```bash
certbot --nginx -d varselkart.no -d www.varselkart.no
```

### Analytics (umami)

Webanalyse kjøres av en **delt umami-instans** som betjener flere domener (bl.a. varselkart.no og nettradar.no). Den er ikke en del av dette prosjektets compose-stack — den driftes separat fra `/opt/umami/` på VPS-en, med nginx-vhostene `umami.varselkart.no` og `umami.nettradar.no` som proxyer til `127.0.0.1:3000`. Hvert nettsted er registrert som en egen «website» i umami.

## Datakilder

| Kilde | Etat | Oppdatering | Lisens |
|---|---|---|---|
| MetAlerts (CAP) | Meteorologisk institutt | ~10 min | NLOD 2.0 |
| Flomvarsel | NVE / Varsom | ~30 min | NLOD 2.0 |
| Jordskredvarsel | NVE / Varsom | ~30 min | NLOD 2.0 |
| Snøskredvarsel | NVE / Varsom | ~60 min | NLOD 2.0 |
| DATEX II vegmeldinger | Statens vegvesen | ~5 min | NLOD 2.0 |

Kartdata: © [Kartverket](https://kartverket.no)

## Lisens

Kildekoden er lisensiert under [MIT](LICENSE).  
Varseldata fra MET, NVE og Statens vegvesen er tilgjengelig under [NLOD 2.0](https://data.norge.no/nlod/no/2.0) og eies av respektive etater.
