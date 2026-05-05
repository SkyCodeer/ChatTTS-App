"""ChatTTS 核心引擎封装 — 自然度优化版"""
from __future__ import annotations

import logging
import re
from ChatTTS import Chat
import numpy as np

logger = logging.getLogger(__name__)


class ChatTTSLoadError(Exception):
    """模型加载失败"""
    pass


class ChatTTSInferError(Exception):
    """语音生成失败"""
    pass


class ChatTTSEngine:
    """ChatTTS 语音合成引擎 — 优化韵律自然度"""

    def __init__(self) -> None:
        self.chat = Chat()
        try:
            self.chat.load(source='huggingface', compile=False)
        except Exception as e:
            logger.error(f"ChatTTS 模型加载失败: {e}")
            raise ChatTTSLoadError(f"模型加载失败: {e}") from e
        self._is_loaded = True
        logger.info("ChatTTS 引擎初始化完成")

    def _split_text(self, text: str) -> list[str]:
        """按句子分割文本，每段不超过 50 字符，确保韵律标记正确应用"""
        parts = re.split(r'\n+', text)
        chunks: list[str] = []

        for part in parts:
            part = part.strip()
            if not part:
                continue

            sentences = re.split(r'([。！？\.\!\?]+)', part)
            current = ""

            for i, seg in enumerate(sentences):
                seg = seg.strip()
                if not seg:
                    continue

                if i + 1 < len(sentences) and sentences[i + 1] in '。！？.!?':
                    seg = seg + sentences[i + 1]

                if len(current) + len(seg) <= 50:
                    current += seg
                else:
                    if current:
                        chunks.append(current)
                    current = seg[:50] if len(seg) > 50 else seg

            if current:
                chunks.append(current)

        return [c for c in chunks if c]

    def _generate_single(
        self,
        text: str,
        refine_text: bool,
        temperature: float,
        top_K: int,
        top_P: float,
        repetition_penalty: float,
    ) -> np.ndarray:
        """生成单段音频"""
        params_infer = self.chat.InferCodeParams()
        params_infer.temperature = temperature
        params_infer.top_K = top_K          # 大写 K
        params_infer.top_P = top_P          # 大写 P
        params_infer.repetition_penalty = repetition_penalty
        params_infer.ensure_non_empty = True

        # 文本精炼参数 — 添加 [Sbreak]、[Pbreak] 等韵律标记
        if refine_text:
            params_refine = self.chat.RefineTextParams()
            params_refine.temperature = 0.7
            params_refine.top_P = 0.7
            params_refine.top_K = 20
        else:
            params_refine = None

        wavs = self.chat.infer(
            [text],
            params_refine_text=params_refine,
            skip_refine_text=not refine_text,
            params_infer_code=params_infer,
        )

        wav = wavs[0] if isinstance(wavs, list) else wavs
        # 头部静音 trim（保留 100 样本的 pre-roll）
        thr = np.float32(1e-5)
        start = 0
        for i, v in enumerate(wav):
            if abs(v) > thr:
                start = max(0, i - 100)
                break
        return wav[start:]

    def generate_speech(
        self,
        text: str,
        speed: int = 5,
        temperature: float = 0.2,
        top_K: int = 30,
        top_P: float = 0.8,
        repetition_penalty: float = 1.1,
        refine_text: bool = True,
    ) -> np.ndarray:
        """
        生成语音（支持长文本分段生成）

        Args:
            text: 输入文本（建议 1000 字以内）
            speed: 语速 1-9（保留参数）
            temperature: 采样温度，越低越稳定（推荐 0.15-0.3）
            top_K: Top-K 采样范围（推荐 20-50）
            top_P: Top-P 核采样（推荐 0.7-0.9）
            repetition_penalty: 重复惩罚（推荐 1.05-1.2）
            refine_text: 是否启用文本精炼（添加韵律标记，大幅改善自然度）

        Returns:
            numpy array of audio samples (24kHz)
        """
        text = text.strip()
        if not text:
            raise ChatTTSInferError("文本不能为空")

        chunks = self._split_text(text)
        logger.debug(f"文本分为 {len(chunks)} 段")

        if len(chunks) == 1:
            try:
                return self._generate_single(
                    chunks[0], refine_text,
                    temperature, top_K, top_P, repetition_penalty,
                )
            except Exception as e:
                logger.error(f"语音生成失败: {e}")
                raise ChatTTSInferError(f"语音生成失败: {e}") from e

        # 分段生成并拼接，段间插入 1 秒静音模拟自然停顿
        wav_segments: list[np.ndarray] = []
        for i, chunk in enumerate(chunks):
            logger.debug(f"生成第 {i+1}/{len(chunks)} 段: {chunk[:30]}...")
            try:
                seg = self._generate_single(
                    chunk, refine_text,
                    temperature, top_K, top_P, repetition_penalty,
                )
            except Exception as e:
                logger.warning(f"第 {i+1} 段生成失败，跳过: {e}")
                continue

            silence = np.zeros(24000, dtype=np.float32)
            wav_segments.append(seg)
            wav_segments.append(silence)

        if not wav_segments:
            raise ChatTTSInferError("所有段落生成均失败")

        return np.concatenate(wav_segments)

    @property
    def is_loaded(self) -> bool:
        """检查模型是否已加载"""
        return self._is_loaded


# 全局单例
_engine: ChatTTSEngine | None = None


def get_engine() -> ChatTTSEngine:
    """获取全局引擎实例"""
    global _engine
    if _engine is None:
        _engine = ChatTTSEngine()
    return _engine
