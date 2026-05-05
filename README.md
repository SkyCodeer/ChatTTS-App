# ChatTTS Web

基于 ChatTTS 的本地文字转语音 Web 应用。

## 功能特性

- 文字转语音 (TTS)
- 可调参数：语速、温度、Top-K、Top-P
- 实时预览
- 下载为 WAV 文件

## 快速开始

### 方式一：使用启动脚本（推荐）

```bash
./run.sh
```

### 方式二：手动启动

```bash
# 安装依赖
cd backend
pip install -r requirements.txt

# 启动服务
cd ..
uvicorn backend.main:app --reload --port 8000
```

### 访问应用

打开浏览器访问：**http://localhost:8000**

## 项目结构

```
ai_voice/
├── backend/
│   ├── main.py              # FastAPI 服务入口
│   ├── chattts_engine.py    # ChatTTS 核心封装
│   └── requirements.txt     # Python 依赖
├── frontend/
│   ├── index.html          # 主页面
│   ├── style.css           # 样式
│   └── app.js              # 前端逻辑
├── docs/
│   └── plan_tts_webapp.md  # 实现计划文档
├── run.sh                  # 启动脚本
├── final_voice.py          # 原 CLI 脚本
└── README.md               # 本文档
```

## API 文档

启动服务后访问：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/` | 返回前端页面 |
| GET | `/health` | 健康检查 |
| POST | `/tts` | 生成语音 |

### POST /tts

**请求体：**

```json
{
  "text": "你好，这是一段测试文本",
  "speed": 5,
  "temperature": 0.3,
  "top_k": 20,
  "top_p": 0.7
}
```

**参数说明：**

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| text | string | - | 1-500字符 | 要转换的文本 |
| speed | int | 5 | 1-9 | 语速 |
| temperature | float | 0.3 | 0.1-1.0 | 温度参数（创造性/稳定性） |
| top_k | int | 20 | 1-100 | Top-K 采样 |
| top_p | float | 0.7 | 0.0-1.0 | Top-P 采样 |

**响应：** WAV 音频文件

## 参数调节指南

| 参数 | 低值效果 | 高值效果 |
|------|----------|----------|
| 语速 | 慢速、稳重 | 快速、急促 |
| 温度 | 稳定、一致 | 创造、多变 |
| Top-K | 保守、精确 | 多样、随机 |
| Top-P | 精确、集中 | 广泛、发散 |

## 技术栈

- **后端:** FastAPI + ChatTTS
- **前端:** 原生 HTML/CSS/JavaScript
- **音频:** soundfile + numpy

## 注意事项

- 首次启动会下载 ChatTTS 模型（约 800MB），请耐心等待
- 建议使用 Chrome、Firefox、Safari 最新版本
- 单次转换文本限制 500 字符
# ChatTTS-App
