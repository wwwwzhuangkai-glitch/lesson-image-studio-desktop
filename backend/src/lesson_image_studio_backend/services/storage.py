from __future__ import annotations

import hashlib
import io
import mimetypes
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from PIL import Image

from ..config import Settings


@dataclass(slots=True)
class StoredFile:
    storage_key: str
    file_name: str
    mime_type: str
    width: int
    height: int
    file_size: int
    sha256: str


class StorageService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.base_dir = settings.file_storage_dir

    def ensure_dirs(self) -> None:
        for child in ("imported", "generated", "exports", "masks"):
            (self.base_dir / child).mkdir(parents=True, exist_ok=True)
        self.settings.resolved_data_dir.mkdir(parents=True, exist_ok=True)

    def build_url(self, storage_key: str) -> str:
        return f"/files/{storage_key}"

    def resolve_path(self, storage_key: str) -> Path:
        return self.base_dir / storage_key

    def read_bytes(self, storage_key: str) -> bytes:
        return self.resolve_path(storage_key).read_bytes()

    def save_upload(self, upload: UploadFile, category: str) -> StoredFile:
        data = upload.file.read()
        file_name = upload.filename or f"{category}.png"
        mime_type = upload.content_type or self._guess_mime_type(file_name)
        return self.save_bytes(data, category=category, file_name=file_name, mime_type=mime_type)

    def save_bytes(
        self,
        data: bytes,
        *,
        category: str,
        file_name: str,
        mime_type: str | None = None,
    ) -> StoredFile:
        suffix = Path(file_name).suffix or self._guess_extension(mime_type)
        target_name = f"{uuid4().hex}{suffix}"
        storage_key = f"{category}/{target_name}"
        target_path = self.base_dir / storage_key
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(data)

        image = Image.open(io.BytesIO(data))
        width, height = image.size
        image.close()

        return StoredFile(
            storage_key=storage_key,
            file_name=file_name,
            mime_type=mime_type or self._guess_mime_type(file_name),
            width=width,
            height=height,
            file_size=len(data),
            sha256=hashlib.sha256(data).hexdigest(),
        )

    def save_pillow_image(self, image: Image.Image, *, category: str, file_name: str) -> StoredFile:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return self.save_bytes(
            buffer.getvalue(),
            category=category,
            file_name=file_name,
            mime_type="image/png",
        )

    def export_copy(self, storage_key: str, *, export_name: str) -> StoredFile:
        source_path = self.resolve_path(storage_key)
        return self.save_bytes(
            source_path.read_bytes(),
            category="exports",
            file_name=export_name or source_path.name,
            mime_type=self._guess_mime_type(source_path.name),
        )

    @staticmethod
    def _guess_mime_type(file_name: str) -> str:
        return mimetypes.guess_type(file_name)[0] or "image/png"

    @staticmethod
    def _guess_extension(mime_type: str | None) -> str:
        if mime_type:
            return mimetypes.guess_extension(mime_type) or ".png"
        return ".png"
