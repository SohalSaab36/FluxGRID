from __future__ import annotations

import os
import tempfile
import uuid
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request
from werkzeug.utils import secure_filename

from config import Config

detection_bp = Blueprint("detection", __name__)


@detection_bp.get("/detection/status")
def detection_status():
    return jsonify(current_app.extensions["detector"].status())


@detection_bp.post("/detection/analyze")
def detection_analyze():
    config: type[Config] = Config
    if "file" not in request.files and "video" not in request.files:
        return jsonify({"error": "Upload a video file using multipart field 'file' or 'video'."}), 400
    uploaded = request.files.get("file") or request.files.get("video")
    if uploaded is None or not uploaded.filename:
        return jsonify({"error": "Missing video filename."}), 400

    original_name = secure_filename(uploaded.filename)
    suffix = Path(original_name).suffix.lower()
    allowed = current_app.config.get("ALLOWED_VIDEO_EXTENSIONS", config.ALLOWED_VIDEO_EXTENSIONS)
    if suffix not in allowed:
        return jsonify(
            {
                "error": "Unsupported video extension.",
                "allowedExtensions": sorted(allowed),
            }
        ), 400

    uploaded.stream.seek(0, os.SEEK_END)
    size = uploaded.stream.tell()
    uploaded.stream.seek(0)
    max_bytes = current_app.config.get("MAX_UPLOAD_BYTES", config.MAX_UPLOAD_BYTES)
    if size > max_bytes:
        return jsonify({"error": "Uploaded file exceeds the configured size limit."}), 413

    temp_path = None
    try:
        fd, temp_path = tempfile.mkstemp(prefix=f"cityflow_{uuid.uuid4().hex}_", suffix=suffix)
        os.close(fd)
        uploaded.save(temp_path)
        result = current_app.extensions["detector"].analyze_video(temp_path, original_name)
        status = result.get("status")
        code = 200
        if status == "invalid_video":
            code = 400
        elif status == "unavailable":
            code = 503
        return jsonify(result), code
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
