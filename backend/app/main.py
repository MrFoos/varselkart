import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
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
    allow_headers=["*"] if settings.app_env == "development" else ["Content-Type", "Accept", "If-None-Match"],
    expose_headers=["ETag"],
)

app.include_router(varsler.router, prefix="/api")
app.include_router(status.router, prefix="/api")
app.include_router(geo.router, prefix="/api")


@app.get("/robots.txt", include_in_schema=False)
async def robots():
    return Response(
        content="User-agent: *\nAllow: /\nSitemap: https://varselkart.no/sitemap.xml\n",
        media_type="text/plain",
    )


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    content = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://varselkart.no/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>
  <url><loc>https://varselkart.no/om.html</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
</urlset>"""
    return Response(content=content, media_type="application/xml")
