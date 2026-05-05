# ChatTTS Web 应用 — 语音自然度优化计划

## 需求重述

当前版本语音断句不自然、韵律平淡。目标：在 MacBook Air M1 16GB 上充分发挥本地硬件优势，实现自然流畅的语音输出。

**核心问题诊断：**

1. **未使用 `txt_smp` / `spk_smp`**：ChatTTS 的核心能力——通过参考文本+随机音色采样引导韵律——完全未启用
2. **未启用文本精炼**：`skip_refine_text=True`（默认）跳过了添加 `[Sbreak]`、`[Pbreak]` 等韵律标记的关键步骤
3. **参数名拼写错误**：`top_k` / `top_p` 应为 `top_K` / `top_P`（大写），当前设置未生效
4. **采样参数保守**：temperature=0.3 偏高，top_P=0.7 偏低，导致输出不稳定
5. **长文本未分段**：一次性传入整段文字，模型无法正确处理句子边界的停顿

## 技术方案

### 核心原理

ChatTTS 的自然语音生成依赖三层机制：

```
文本 → [文本精炼层] → 韵律标记文本 → [GPT生成层] → mel谱 → [Vocos解码] → 音频
                    ↑
              spk_smp + txt_smp 控制韵律风格
```

- **文本精炼**（`RefineTextParams`）：GPT-LLM 在文本后追加 `[Sbreak]`（短停顿）、`[Pbreak]`（段落停顿）等韵律标记
- **音色采样**（`sample_random_speaker()`）：采样一个音色嵌入，用于引导生成更自然的语音特征
- **参考文本**（`txt_smp`）：提供韵律参考，与 `spk_smp` 配合使用
- **Vocos 解码器**：已启用（默认 CPU 推理），将 mel 谱转为高保真音频

### 架构调整

```
backend/chattts_engine.py     核心引擎
  ├── 初始化时采样随机音色 (spk_smp)
  ├── 暴露 txt_smp 参数供外部传入
  ├── 启用文本精炼 (skip_refine_text=False)
  ├── 修正 top_K/top_P 参数名
  └── 文本分段 + 分段生成 + 拼接

backend/main.py               API 层
  ├── POST /tts — 接收 refine_text 参数
  ├── 参数校验和默认值
  └── 异常处理

frontend/                     UI 层
  ├── index.html — 新增"文本精炼"开关
  ├── style.css — UI 调整
  └── app.js — 新增 refine_text 参数传递
```

## 实现阶段

### Phase 1: 核心引擎重构（`chattts_engine.py`）

#### 1.1 音色预采样

在引擎初始化时调用 `sample_random_speaker()`，将 `spk_smp` 保存为实例变量，后续所有生成复用：

```python
def __init__(self) -> None:
    self.chat = Chat()
    self.chat.load(source='huggingface', compile=False)
    self._spk_smp = self.chat.sample_random_speaker()  # 预采样音色
```

#### 1.2 启用文本精炼

`infer()` 调用时设置 `skip_refine_text=False` + `params_refine_text`：

```python
refine_params = self.chat.RefineTextParams()
refine_params.temperature = 0.7   # 文本精炼用高温保持创造性
refine_params.top_P = 0.7
refine_params.top_K = 20
```

#### 1.3 修正采样参数

```python
params = self.chat.InferCodeParams()
params.temperature = temperature      # 默认 0.2（更稳定）
params.top_K = top_k                 # 注意大写 K
params.top_P = top_p                 # 注意大写 P
params.repetition_penalty = 1.1      # 防止重复（比默认值 1.05 略高）
params.spk_smp = self._spk_smp       # 注入预采样的音色
params.ensure_non_empty = True       # 确保输出非空
```

#### 1.4 长文本分段

将文本按标点符号分割为句子，逐句生成后拼接：

```python
def _split_text(self, text: str) -> list[str]:
    """按句子分割文本"""
    import re
    sentences = re.split(r'([。！？\n])', text)
    chunks = []
    for i in range(0, len(sentences)-1, 2):
        chunk = sentences[i] + (sentences[i+1] if i+1 < len(sentences) else '')
        if chunk.strip():
            chunks.append(chunk.strip())
    return [c for c in chunks if c]
```

### Phase 2: API 层更新（`main.py`）

#### 2.1 新增请求参数

```python
class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)  # 放宽到 1000
    speed: int = Field(default=5, ge=1, le=9)
    temperature: float = Field(default=0.2, ge=0.1, le=1.0)  # 默认改 0.2
    top_K: int = Field(default=30, ge=1, le=100)              # 大写 K
    top_P: float = Field(default=0.8, ge=0.0, le=1.0)          # 默认改 0.8
    repetition_penalty: float = Field(default=1.1, ge=1.0, le=2.0)
    refine_text: bool = Field(default=True, description="启用文本精炼以改善韵律")
    spk_smp: str | None = Field(default=None, description="自定义音色采样（留空使用随机）")
```

#### 2.2 更新引擎调用

```python
wav_array = engine.generate_speech(
    text=tts_request.text,
    speed=tts_request.speed,
    temperature=tts_request.temperature,
    top_K=tts_request.top_K,
    top_P=tts_request.top_P,
    repetition_penalty=tts_request.repetition_penalty,
    refine_text=tts_request.refine_text,
    spk_smp=tts_request.spk_smp,
)
```

### Phase 3: 前端 UI 更新

#### 3.1 `index.html` 新增控件

- 文本精炼开关（默认开启）
- 新预设：播客(podcast)、朗读(read)、对话(dialogue)
- 参数说明 tooltip（鼠标悬停显示参数含义）

#### 3.2 `app.js` 更新

- 传递 `refine_text` 和 `spk_smp` 参数
- 预设值更新为自然度优化参数

### Phase 4: 验证与调优

#### 4.1 测试用例

| 文本类型 | 预期效果 |
|---------|---------|
| "今天天气真好，我们去公园散步吧。" | 单句流畅，有自然停顿 |
| 3-4句段落 | 句间停顿自然，整体连贯 |
| 复杂长句（带逗号） | 逗号处有轻微停顿，不是机械断开 |

#### 4.2 参数调优方向

- 若语速过快 → 调低 `stream_speed` 或提高 UI speed 值
- 若仍有机械感 → 降低 `temperature` 到 0.15
- 若重复 → 提高 `repetition_penalty` 到 1.2
- 若停顿不自然 → 检查分段逻辑，确保 `[Sbreak]` 标记正确

## 风险评估

| 风险 | 等级 | 缓解 |
|------|------|------|
| 文本精炼增加首次生成延迟 | 低 | 精炼在 GPT（CPU）上很快，影响可忽略 |
| 分段拼接处可能有音频瑕疵 | 中 | 使用 silence trimming，拼接处淡入淡出 |
| 自定义 spk_smp 格式错误 | 低 | 限制为 None 或预验证的字符串 |
| M1 MPS 性能未充分利用 | 低 | ChatTTS GPT 必须在 CPU 运行（架构限制），但 Vocos 在 CPU 已足够快 |

## 预估工时

| 阶段 | 工作量 |
|------|--------|
| Phase 1: 引擎重构 | 1-2 小时 |
| Phase 2: API 更新 | 30 分钟 |
| Phase 3: 前端 UI | 1 小时 |
| Phase 4: 验证调优 | 1-2 小时 |
| **总计** | **3.5-5.5 小时** |

## 确认

以上计划是否符合预期？确认后我将开始实施。

请回复：
- `yes` — 开始实施
- `modify: <具体修改>` — 调整方案
