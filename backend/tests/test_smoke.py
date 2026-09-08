"""Røyktester for backend-en.

Repoet har ingen enhetstester, og deploy bygger og restarter containeren
ved merge til main. Disse testene finnes for å fange den vanligste
feilkilden vi faktisk har: en avhengighetsbump som brekker noe.

De kjører uten nettverk og uten database — init_db, scheduleren og alle
ingestors ligger i `lifespan`, som ikke kjøres her.
"""

import importlib
from dataclasses import fields, is_dataclass

import pytest
from fastapi import FastAPI


@pytest.fixture(scope="module")
def app() -> FastAPI:
    """Selve importen er halve testen: den brekker hvis fastapi eller
    pydantic-settings endrer noe vi er avhengige av."""
    return importlib.import_module("app.main").app


@pytest.fixture(scope="module")
def openapi(app) -> dict:
    """Vi leser rutene ut av OpenAPI-skjemaet, ikke ut av `app.routes`.

    FastAPI 0.141 sluttet å kopiere rutene fra include_router() flatt inn
    i app.routes — de ligger nå bak nestede _IncludedRouter-objekter.
    Skjemaet er den stabile kontrakten. At det i det hele tatt lar seg
    generere er dessuten en pydantic-test i seg selv: alle responsmodeller
    serialiseres på veien.
    """
    return app.openapi()


def test_app_er_bygget(app):
    assert isinstance(app, FastAPI)
    assert app.title == "varselkart.no API"


def test_api_ruter_finnes(openapi):
    stier = set(openapi["paths"])
    # De frontenden faktisk kaller.
    for sti in ("/api/varsler", "/api/varsler/{varsel_id}", "/api/status", "/api/fylker"):
        assert sti in stier, f"ruten {sti} er borte — fant {sorted(stier)}"


def test_settings_laster_uten_env():
    """pydantic-settings-bumper brekker typisk her. Alle felter har
    defaults, så dette skal gå uten .env og uten miljøvariabler."""
    config = importlib.import_module("app.config")
    settings = config.Settings()
    assert settings.app_port == 8000
    assert settings.database_path


def test_varsel_modellen_er_intakt():
    """Modellene er dataclasses, ikke pydantic. Testen fanger at et felt
    forsvinner eller bytter navn under en refaktorering."""
    models = importlib.import_module("app.models")
    assert is_dataclass(models.Varsel)
    navn = {f.name for f in fields(models.Varsel)}
    for påkrevd in ("dedup_id", "kilde", "geometri_json", "first_seen", "last_seen"):
        assert påkrevd in navn, f"feltet {påkrevd} er borte fra Varsel"


def test_ingestors_kan_importeres():
    """Trekker inn lxml, shapely og pyproj via parsing og geometri."""
    for modul in ("app.ingest.base", "app.geo", "app.database"):
        importlib.import_module(modul)
