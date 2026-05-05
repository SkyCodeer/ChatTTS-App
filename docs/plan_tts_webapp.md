# ChatTTS Web 应用实现计划

## 需求重述

基于现有的 `final_voice.py` 代码，创建一个本地 Web 应用，实现：
- 文字转语音（TTS）功能
- 可调参数：音色（voice）、语调（pitch）、语速（speed）、情绪（emotion）
- 支持语音预览
- 支持音频文件下载

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 后端框架 | FastAPI | 轻量、异步、支持自动文档 |
| 前端 | 原生 HTML/CSS/JS | 零依赖、快速原型 |
| 音频处理 | soundfile + numpy | 现有依赖 |
| TTS 引擎 | ChatTTS | 现有依赖 |
| 服务器 | uvicorn | ASGI 服务器 |

## ChatTTS 参数映射

| UI 参数 | ChatTTS 参数 | 说明 | 范围 | 默认值 |
|---------|-------------|------|------|--------|
| 语速 (Speed) | `params_infer_code.prompt` | speed_1 ~ speed_9 | 1-9 | 5 |
| 温度 (Temperature) | `params_infer_code.temperature` | 创造性/稳定性 | 0.1-1.0 | 0.3 |
| Top_K | `params_infer_code.top_k` | 采样范围 | 1-100 | 20 |
| Top_P | `params_infer_code.top_p` | 核采样 | 0.0-1.0 | 0.7 |

**注意：** ChatTTS 原生不直接支持"语调"和"情绪"参数。可通过温度参数间接控制输出的情感变化。

## 项目结构

```
ai_voice/
├── final_voice.py          # 原有脚本
├── docs/
│   └── plan_tts_webapp.md  # 本计划文档
├── backend/
│   ├── main.py             # FastAPI 服务入口
│   ├── chattts_engine.py   # TTS 核心封装
│   └── requirements.txt    # Python 依赖
├── frontend/
│   ├── index.html          # 主页面
│   ├── style.css           # 样式
│   └── app.js              # 前端逻辑
└── static/                 # 静态文件目录
```

## 实现阶段

### Phase 1: 后端 API 服务

#### 1.1 安装依赖

```bash
pip install fastapi uvicorn python-multipart aiofiles
```

#### 1.2 创建 `backend/requirements.txt`

```
fastapi>=0.100.0
uvicorn>=0.23.0
python-multipart>=0.0.6
aiofiles>=23.0.0
```

#### 1.3 创建 `backend/chattts_engine.py`

封装 ChatTTS 核心逻辑：

```python
from ChatTTS import Chat
import numpy as np

class ChatTTSEngine:
    def __init__(self):
        self.chat = Chat()
        self.chat.load(source='huggingface', compile=False)

    def generate_speech(
        self,
        text: str,
        speed: int = 5,
        temperature: float = 0.3,
        top_k: int = 20,
        top_p: float = 0.7
    ) -> np.ndarray:
        # 设置推理参数
        params = self.chat.InferCodeParams()
        params.temperature = temperature
        params.top_k = top_k
        params.top_p = top_p
        params.prompt = [f"speed_{speed}"]

        # 生成语音
        wavs = self.chat.infer(text=[text], params_infer_code=params)
        return wavs[0] if isinstance(wavs, list) else wavs
```

#### 1.4 创建 `backend/main.py`

FastAPI 服务入口：

- `POST /tts` - 生成语音
  - 请求体: `{ text: str, speed: int, temperature: float, top_k: int, top_p: float }`
  - 返回: WAV 文件二进制流
- `GET /health` - 健康检查

### Phase 2: 前端界面

#### 2.1 创建 `frontend/index.html`

页面结构：
- 顶部：标题 "ChatTTS Web"
- 左侧面板：参数控制
  - 语速滑块 (1-9)
  - 温度滑块 (0.1-1.0)
  - Top_K 滑块 (1-100)
  - Top_P 滑块 (0.0-1.0)
- 右侧区域：
  - 文本输入框 (textarea)
  - 生成按钮
  - 音频预览播放器
  - 下载按钮

#### 2.2 创建 `frontend/style.css`

样式要点：
- 响应式布局 (移动端友好)
- 现代化 UI 设计
- 滑块样式美化

#### 2.3 创建 `frontend/app.js`

功能逻辑：
- 监听生成按钮点击
- 调用 `/tts` API
- 显示加载状态
- 预览音频
- 下载功能

### Phase 3: 运行脚本

#### 3.1 创建启动脚本 `run.sh`

```bash
#!/bin/bash
cd "$(dirname "$0")"
uvicorn backend.main:app --reload --port 8000
```

#### 3.2 创建 `README.md`

说明如何启动和使用应用。

## API 文档

### POST /tts

生成语音并返回 WAV 文件。

**请求体 (JSON):**
```json
{
  "text": "你好，这是一段测试文本",
  "speed": 5,
  "temperature": 0.3,
  "top_k": 20,
  "top_p": 0.7
}
```

**响应:**
- Content-Type: `audio/wav`
- 状态码: 200 OK

**错误响应:**
```json
{
  "detail": "Text is required"
}
```

### GET /health

健康检查端点。

**响应:**
```json
{
  "status": "ok",
  "model_loaded": true
}
```

## 启动步骤

1. 安装 Python 依赖
   ```bash
   cd backend && pip install -r requirements.txt
   ```

2. 启动服务
   ```bash
   ./run.sh
   # 或
   uvicorn backend.main:app --reload --port 8000
   ```

3. 打开浏览器
   ```
   http://localhost:8000
   ```

4. 使用应用
   - 输入文本
   - 调整参数
   - 点击生成
   - 预览或下载

## 风险与限制

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| ChatTTS 模型加载慢 | 中 | 启动时预加载，保留在内存 |
| MPS 设备兼容问题 | 低 | 使用 CPU 运行（已验证） |
| 大文本处理 | 低 | 限制单次生成字数 500 |
| 并发请求 | 低 | 串行处理，避免资源竞争 |

## 实施检查清单

- [ ] Phase 1: 后端 API
  - [ ] 创建 backend/chattts_engine.py
  - [ ] 创建 backend/main.py
  - [ ] 创建 backend/requirements.txt
  - [ ] 测试 API 端点
- [ ] Phase 2: 前端界面
  - [ ] 创建 frontend/index.html
  - [ ] 创建 frontend/style.css
  - [ ] 创建 frontend/app.js
  - [ ] 测试完整流程
- [ ] Phase 3: 部署
  - [ ] 创建 run.sh
  - [ ] 创建 README.md
  - [ ] 文档完善

## 预估工时

| 阶段 | 时间 |
|------|------|
| Phase 1: 后端 | 2-3 小时 |
| Phase 2: 前端 | 2-3 小时 |
| Phase 3: 部署 | 1 小时 |
| **总计** | **5-7 小时** |
