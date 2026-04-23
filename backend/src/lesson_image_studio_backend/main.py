from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError

from .api import router
from .config import Settings, get_settings
from .database import Database
from .services.jobs import JobRunner
from .services.presets import ensure_builtin_presets
from .services.storage import StorageService


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    storage = StorageService(app_settings)
    storage.ensure_dirs()
    db = Database(app_settings)
    job_runner = JobRunner(settings=app_settings, db=db, storage=storage)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        try:
            with db.session() as session:
                ensure_builtin_presets(session, app_settings)
        except OperationalError:
            pass
        yield

    app = FastAPI(title=app_settings.app_name, lifespan=lifespan)
    app.state.settings = app_settings
    app.state.storage = storage
    app.state.db = db
    app.state.job_runner = job_runner
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    app.mount("/files", StaticFiles(directory=Path(app_settings.file_storage_dir)), name="files")
    return app


app = create_app()


def run() -> None:
    uvicorn.run("lesson_image_studio_backend.main:app", host="127.0.0.1", port=8000, reload=True)
