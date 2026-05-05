"""FastAPI TTS 服务入口"""
from __future__ import annotations

import io
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import soundfile as sf

from backend.chattts_engine import get_engine


class TTSRequest(BaseModel):
    """TTS 请求参数"""
    text: str = Field(..., min_length=1, max_length=500, description="要转换的文本")
    speed: int = Field(default=5, ge=1, le=9, description="语速 1-9")
    temperature: float = Field(default=0.3, ge=0.1, le=1.0, description="温度参数")
    top_k: int = Field(default=20, ge=1, le=100, description="Top-K 采样")
    top_p: float = Field(default=0.7, ge=0.0, le=1.0, description="Top-P 采样")


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    model_loaded: bool


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理 - 预加载模型"""
    print("🎙️ 加载 ChatTTS 模型...")
    engine = get_engine()
    print(f"✅ ChatTTS 模型加载完成: {engine.is_loaded}")
    yield
    print("👋 应用关闭")


app = FastAPI(
    title="ChatTTS Web API",
    description="基于 ChatTTS 的文字转语音服务",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """健康检查端点"""
    engine = get_engine()
    return HealthResponse(status="ok", model_loaded=engine.is_loaded)


@app.post("/tts")
async def text_to_speech(request: TTSRequest) -> StreamingResponse:
    """
    将文本转换为语音

    返回 WAV 格式的音频流
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    engine = get_engine()

    # 生成语音
    wav_array = engine.generate_speech(
        text=request.text,
        speed=request.speed,
        temperature=request.temperature,
        top_k=request.top_k,
        top_p=request.top_p,
    )

    # 转换为 WAV 格式
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
    """返回前端页面"""
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'index.html')
    return FileResponse(frontend_path)


# 挂载静态文件
frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
