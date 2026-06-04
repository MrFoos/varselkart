import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import init_db
from .scheduler import registrer_jobber, scheduler
from .api import varsler, status, geo

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ingestors = registrer_jobber()
    scheduler.start()
    logger.info("Scheduler startet med %d jobber", len(ingestors))

    # Kjør alle ingestors én gang ved oppstart
    await asyncio.gather(*[i.kjør() for i in ingestors], return_exceptions=True)

    yield

    scheduler.shutdown()
    logger.info("Scheduler stoppet")


app = FastAPI(title="varselkart.no API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.app_env == "development" else ["https://varselkart.no"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(varsler.router, prefix="/api")
app.include_router(status.router, prefix="/api")
app.include_router(geo.router, prefix="/api")
