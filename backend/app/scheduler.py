import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .config import settings
from .ingest.base import BaseIngestor

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")


def registrer_jobber() -> list[BaseIngestor]:
    """Registrerer alle ingest-jobber. Kalles fra main.py lifespan-hook."""
    from .ingest.met import MetIngestor
    from .ingest.nve_flom import NveFlomIngestor
    from .ingest.nve_jordskred import NveJordskredIngestor
    from .ingest.nve_snoskred import NveSnoskredIngestor

    jobber = [
        (MetIngestor(), settings.poll_interval_met),
        (NveFlomIngestor(), settings.poll_interval_nve_flom),
        (NveJordskredIngestor(), settings.poll_interval_nve_jordskred),
        (NveSnoskredIngestor(), settings.poll_interval_nve_snoskred),
    ]

    # DATEX og Avinor legges til når credentials er tilgjengelige
    if settings.datex_username:
        from .ingest.vegvesen import VegvesenIngestor
        jobber.append((VegvesenIngestor(), settings.poll_interval_vegvesen))

    # Avinor: services.avinor.no er utilgjengelig og api2-developer.avinor.no
    # støtter ikke selvregistrering — deaktivert inntil videre.

    for ingestor, intervall in jobber:
        scheduler.add_job(
            ingestor.kjør,
            trigger="interval",
            seconds=intervall,
            id=ingestor.kilde_navn,
            next_run_time=None,  # Første kjøring trigges manuelt nedenfor
        )
        logger.info("Registrert jobb: %s (intervall %ds)", ingestor.kilde_navn, intervall)

    return [ingestor for ingestor, _ in jobber]
