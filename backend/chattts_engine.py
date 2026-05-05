"""ChatTTS 核心引擎封装"""
from __future__ import annotations

from ChatTTS import Chat
import numpy as np


class ChatTTSEngine:
    """ChatTTS 语音合成引擎"""

    def __init__(self) -> None:
        self.chat = Chat()
        self.chat.load(source='huggingface', compile=False)
        self._is_loaded = True

    def generate_speech(
        self,
        text: str,
        speed: int = 5,
        temperature: float = 0.3,
        top_k: int = 20,
        top_p: float = 0.7,
    ) -> np.ndarray:
        """
        生成语音

        Args:
            text: 输入文本
            speed: 语速 (1-9)
            temperature: 温度参数 (0.1-1.0)
            top_k: Top-K 采样 (1-100)
            top_p: Top-P 采样 (0.0-1.0)

        Returns:
            numpy array of audio samples
        """
        params = self.chat.InferCodeParams()
        params.temperature = temperature
        params.top_k = top_k
        params.top_p = top_p

        wavs = self.chat.infer(text=[text], params_infer_code=params)
        return wavs[0] if isinstance(wavs, list) else wavs

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
