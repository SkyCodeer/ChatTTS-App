"""FastAPI TTS 服务入口 — 自然度优化版"""
from __future__ import annotations

import io
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import soundfile as sf

from backend.chattts_engine import get_engine, ChatTTSLoadError, ChatTTSInferError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


class SecureStaticFiles(StaticFiles):
    """防止目录遍历攻击的安全 StaticFiles"""

    async def get_full_path(self, path: str) -> tuple[str, bool]:
        full_path = await super().get_full_path(path)
        real_dir = os.path.realpath(self.directory)
        real_path = os.path.realpath(full_path[0])
        if not real_path.startswith(real_dir + os.sep) and real_path != real_dir:
            raise HTTPException(403, "Forbidden")
        return full_path


class TTSRequest(BaseModel):
    """TTS 请求参数 — 自然度优化默认值"""
    text: str = Field(..., min_length=1, max_length=1000, description="要转换的文本（建议 1000 字以内）")
    speed: int = Field(default=5, ge=1, le=9, description="语速 1-9（保留参数）")
    temperature: float = Field(default=0.2, ge=0.05, le=1.0, description="采样温度，越低越稳定（推荐 0.15-0.3）")
    top_K: int = Field(default=30, ge=1, le=100, description="Top-K 采样（推荐 20-50）")
    top_P: float = Field(default=0.8, ge=0.0, le=1.0, description="Top-P 核采样（推荐 0.7-0.9）")
    repetition_penalty: float = Field(default=1.1, ge=1.0, le=2.0, description="重复惩罚（推荐 1.05-1.2）")
    refine_text: bool = Field(default=True, description="启用文本精炼（添加韵律标记，大幅改善自然度）")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🎙️ 加载 ChatTTS 模型...")
    try:
        engine = get_engine()
        print(f"✅ ChatTTS 模型加载完成: {engine.is_loaded}")
    except ChatTTSLoadError as e:
        logger.error(f"❌ 模型加载失败: {e}")
    yield
    print("👋 应用关闭")


app = FastAPI(
    title="ChatTTS Web API",
    description="基于 ChatTTS 的文字转语音服务 — 韵律自然度优化版",
    version="1.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {type(exc).__name__}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}


@app.post("/tts")
@limiter.limit("10/minute")
async def text_to_speech(request: Request, tts_request: TTSRequest) -> StreamingResponse:
    """将文本转换为自然语音（速率限制: 10 次/分钟）"""
    if not tts_request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    engine = get_engine()

    try:
        wav_array = engine.generate_speech(
            text=tts_request.text,
            speed=tts_request.speed,
            temperature=tts_request.temperature,
            top_K=tts_request.top_K,
            top_P=tts_request.top_P,
            repetition_penalty=tts_request.repetition_penalty,
            refine_text=tts_request.refine_text,
        )
    except ChatTTSInferError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    buffer = io.BytesIO()
    sf.write(buffer, wav_array, 24000, format='WAV')
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="audio/wav",
        headers={"Content-Disposition": "attachment; filename=output.wav"},
    )


@app.get("/")
async def root():
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'index.html')
    return FileResponse(frontend_path)


frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
app.mount("/static", SecureStaticFiles(directory=frontend_dir, html=False), name="static")
