# 🌸 Campus Companion XR

> **SPATIAL SHANGHAI 2026 · 24-Hour Hackathon**
> Track: Higher Education — Reshaping Campus Life with AI Agents

---

## 📋 Project Overview · 项目简介

**Campus Companion XR** is an immersive WebXR mental wellness platform built for university students.
It combines a warm, 3D healing campus space with a Claude/GLM-powered peer companion AI that provides
non-judgmental, always-available emotional support and lifestyle enrichment.

**Campus Companion XR** 是一套面向大学生的沉浸式 WebXR 心理健康平台。
融合温暖治愈的 3D 校园空间与 AI 同龄伴侣，提供全天候、低压力、高隐私的情绪陪伴服务。

---

## 😔 Problem · 核心痛点

| Pain Point | Details |
|---|---|
| Social anxiety epidemic | 1 in 3 college students reports loneliness or social anxiety |
| Counselor scarcity | A single counselor often serves 500–800 students |
| Privacy barrier | Students fear judgment when approaching official channels |
| Peer gap | Vulnerable students need peer-level companionship, not lectures |

---

## 💡 Solution · 解决方案

A browser-native **WebXR 3D healing campus** with an AI companion persona ("Lele") that acts as a
caring peer friend across 5 distinct functional zones:

| Zone | Purpose |
|---|---|
| 💬 Chat Corner · 谈心区 | Emotional listening, everyday companionship |
| 📚 Study Room · 学习区 | Course help, exam prep, Q&A |
| 🎭 Leisure Lounge · 休闲区 | Books, films, hobby discussions |
| 🌿 Healing Garden · 疗愈区 | Mindfulness, calligraphy, relaxation |
| 🎮 Game Zone · 轻游戏区 | Mindful coloring, Gomoku, Go, Chinese Chess |

---

## 🛠 Tech Stack · 技术栈

| Layer | Technology |
|---|---|
| 3D Rendering | Three.js r160 · WebXR · OrbitControls |
| 3D Characters | Tripo AI (text → GLB model, real-time generation) |
| AI Companion | Zhipu GLM API (OpenAI-compatible, GLM-4-Flash) |
| Frontend | Vanilla HTML5 · CSS3 · ES Modules · Canvas 2D |
| Deployment | Zero-dependency static files — open `index.html` directly |

---

## 🚀 Quick Start · 快速启动

### Option A — Direct open (Chrome / Edge)
```bash
# Simply double-click index.html
# Or drag it into your browser
```

### Option B — Local server (recommended for all browsers)
```bash
# Python
python -m http.server 8080
# Then open: http://localhost:8080

# Node.js
npx serve .
# Then open: http://localhost:3000
```

### First-Run Flow
1. Watch the loading animation while the 3D scene initialises
2. **Choose your companion's gender** (female / male)
3. Optionally enter your **Zhipu GLM API key** (or skip for demo mode)
4. **Drag** to look around the 3D central hall
5. **Click any glowing zone platform** to enter that zone
6. Chat with Lele in the floating panel — the AI context switches automatically

---

## 🔑 API Keys · API密钥

| Key | Where to get | Required? |
|---|---|---|
| Zhipu GLM | [open.bigmodel.cn](https://open.bigmodel.cn) | Optional (demo mode available) |
| Tripo AI | Pre-configured in `js/config.js` | ✅ Included |

To set the Zhipu key in code instead of the UI, open `js/config.js` and set:
```js
ZHIPU_API_KEY: 'your-key-here',
```

---

## 📁 Project Structure · 项目结构

```
campus-companion-xr/
├── index.html              # Entry point (all UI markup)
├── css/
│   └── style.css           # Healing-theme UI styles
├── js/
│   ├── config.js           # API keys, zone definitions, Tripo prompts
│   ├── tripo.js            # Tripo AI client (text→3D, poll, load)
│   ├── agent.js            # Zhipu GLM AI companion (context-aware)
│   ├── scene.js            # Three.js 3D scene (hall + 5 zones)
│   ├── chat.js             # Chat panel UI controller
│   └── main.js             # App orchestration (ES module entry)
└── README.md
```

---

## 🎨 Design Philosophy · 设计理念

- **Healing palette**: Low-saturation warm tones (cream, terracotta, sage, dusty rose)
- **Zero-threshold access**: No VR hardware, no app install, no login required
- **Peer persona**: Lele never diagnoses or prescribes — only listens and accompanies
- **Privacy-first**: No user data stored; all conversation is session-only

---

## 🏆 Hackathon Alignment · 赛道契合度

| Criterion | Coverage |
|---|---|
| AR/VR WebXR | ✅ Three.js + WebXR, browser-native 3D environment |
| AI Agent | ✅ Context-switching GLM agent with fixed peer persona |
| Higher Education | ✅ Targets university student mental health & campus life |
| Tripo AI | ✅ Integrated text-to-3D avatar generation pipeline |
| Demo-ready | ✅ Static files, zero dependencies, runs from `index.html` |

---

## 👥 Team · 团队

SPATIAL SHANGHAI 2026 · Higher Education Track Submission

---

*Built with ❤️ in 24 hours for students who need a quiet corner.*
