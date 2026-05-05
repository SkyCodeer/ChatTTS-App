import torch
import pygame
import numpy as np
from pydub import AudioSegment
from transformers import AutoTokenizer, AutoModelForCausalLM
import soundfile as sf
import os

# 修复 HuggingFace 环境变量中的换行符问题
if 'HF_ENDPOINT' in os.environ:
    os.environ['HF_ENDPOINT'] = os.environ['HF_ENDPOINT'].strip()

# ===================== 正确导入 ChatTTS =====================
from ChatTTS import Chat
chat_tts = Chat()  # 创建 Chat 实例
print("🎙️ 加载 ChatTTS 模型...")
# 从 HuggingFace 下载模型（首次运行）或从本地加载
chat_tts.load(source='huggingface', compile=False)  # 不指定device，使用CPU
# ============================================================

# ==================== 配置 ====================
DEVICE = "mps"
LLM_MODEL = "Qwen/Qwen2-0.5B-Instruct"
MY_VOICE = "my_voice.m4a"
# ==============================================

# 转换 m4a -> wav
def m4a_to_wav():
    wav = "ref.wav"
    audio = AudioSegment.from_file(MY_VOICE, format="m4a")
    audio.export(wav, format="wav")
    return wav

# 加载AI
print("🧠 加载本地模型...")
tokenizer = AutoTokenizer.from_pretrained(LLM_MODEL)
model = AutoModelForCausalLM.from_pretrained(
    LLM_MODEL, torch_dtype=torch.bfloat16, device_map=DEVICE
)

# AI回答
def ai_reply(prompt):
    messages = [{"role": "user", "content": prompt}]
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer([text], return_tensors="pt").to(DEVICE)
    outputs = model.generate(**inputs, max_new_tokens=512, temperature=0.6)
    return tokenizer.decode(outputs[0][len(inputs.input_ids[0]):], skip_special_tokens=True)

# 超自然发音
def speak(text):
    print(f"🤖 {text}")
    params_infer_code = chat_tts.InferCodeParams()
    params_infer_code.temperature = 0.3
    wavs = chat_tts.infer(text=[text], params_infer_code=params_infer_code)
    # infer 返回的是列表，取第一个
    wav = wavs[0] if isinstance(wavs, list) else wavs
    sf.write("output.wav", wav, 24000)
    pygame.mixer.init()
    pygame.mixer.music.load("output.wav")
    pygame.mixer.music.play()
    while pygame.mixer.music.get_busy():
        pygame.time.Clock().tick(10)

# 主程序
if __name__ == "__main__":
    print("✅ ChatTTS 终极版启动！")
    while True:
        user = input("你：")
        if user.lower() in ["q", "exit"]: break
        reply = ai_reply(user)
        speak(reply)
