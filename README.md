# Campus Companion XR

> **SPATIAL SHANGHAI 2026 · 24-Hour Hackathon**
> Track: Higher Education — Reshaping Campus Life with AI Agents

---

## Project Overview · 项目简介

**Campus Companion XR** is an immersive WebXR mental wellness platform built for university students.
It pairs a warm, hand-crafted 3D healing campus with an AI peer companion ("Lele / 乐乐") that provides
non-judgmental, always-available emotional support and lifestyle enrichment — all from a browser, with
optional Meta Quest VR support.

**Campus Companion XR** 是一套面向大学生的沉浸式 WebXR 心理健康平台。
温暖治愈的 3D 校园空间 + AI 同龄伴侣，提供全天候、低压力、高隐私的情绪陪伴服务。
浏览器原生运行，可选 Meta Quest VR 体验。

---

## Build Status · 已完成进度

The roadmap covers a central hub plus five themed zones. The current build ships **three** of them in
finished, fully-interactive form. The other two are reserved for later iterations.

| Zone | Status |
|---|---|
| Central Hall · 中央大厅 | **Shipped** |
| Chat Corner · 谈心区 | **Shipped** |
| Game Zone · 轻游戏区 | **Shipped** |
| Study Room · 学习区 | Planned |
| Healing Garden · 疗愈区 | Planned |

---

## Shipped Features

### 1. Central Hall · 中央大厅

The hub is a circular wood-floored rotunda the player drops into on first load. From here you can see
all five gateway portals arranged on a ring; clicking or walking through one teleports the camera into
the matching zone.

- **Five portal gateways** with stone arches, animated dust motes, foot-spotlights, and a rotating
  central key gem. Each portal is colour-coded by zone (coral / sage / amber / lilac / teal).
- **Central chandelier** as the only architectural light source — a warm `PointLight` is positioned
  exactly inside the bulb cluster of the GLB model, so the lamp visually emits its own glow and casts
  shadows of the rod and fountain rim onto the floor.
- **Per-portal coloured light pools.** Each portal carries a foreground `PointLight` that paints its
  zone colour onto the floor in a clear pool, plus a low-intensity backlight that haloes the curved
  hub wall. Both gently breathe in opposite phase. Result: from across the dim lobby every gateway
  reads instantly by colour.
- **Floor mosaic, fountain centerpiece, and ornamental ring** so the rotunda has architectural depth
  rather than feeling like a featureless menu screen.
- **Distance-based label fade**: each portal's HTML label dims when the player isn't facing it, so the
  hub doesn't get visually cluttered.
- **Onboarding overlay** on first run prompts for companion gender and (optional) Zhipu GLM API key —
  skip it for offline demo mode.

### 2. Chat Corner · 谈心区 (ChatVRRoom)

A warm bedroom-scaled lounge designed around one core scenario: sit down, talk to Lele, feel listened
to. Layout follows a real-world conversation pit: armchairs near the door, a coffee table with porcelain
tea set, floor cushions on a Persian rug, and a coral 3-seater sofa across the room.

- **Furniture pipeline.** Every prop is generated on-demand from text prompts via the Tripo AI
  text-to-3D service and cached, then mounted with `mountTripoModel()` helpers that handle scale,
  ground-alignment, and rotation (front-facing convention: `rotationY = 0` faces -Z by default).
- **Living-room atmosphere.** Custom canvas-textured wood floor and stucco walls, two glass windows
  cut into the side walls (with painted night-sky exteriors), a working fireplace and two floor lamps
  that provide all of the room's lighting — no overhead `PointLight`, deliberately cosy.
- **Companion AI behaviour:**
  - Lele walks over to the player on entry and sits **beside-and-slightly-forward** instead of facing
    them head-on, mimicking a friend on the couch rather than an interviewer.
  - Idle prompt fires once if the player stays silent.
  - Smooth speech bubble with auto-fade based on text length (1.8s base + 70 ms per character,
    capped at 7 s) so quick acknowledgements don't linger and bilingual lines stay readable.
- **Voice input loop** via Web Speech API (`js/voice.js`) — push-to-talk, transcript routed straight
  into the agent.
- **Context-switching agent.** `js/agent.js` swaps the system prompt to the Chat Corner persona on
  zone entry: gentle voice, "嗯嗯" / "我懂" / "辛苦了" — never a therapist, always a peer.

### 3. Game Zone · 轻游戏区 (GamesVRRoom)

An arcade-lounge themed games room with a giant floor board (covers ~72 % of the room) that switches
between two complete board games. Lele's mascot variant — **童童 (Tongtong)** — is the in-room
opponent and commentator.

- **Bespoke arcade-lounge shell.**
  - Walls: programmatically generated `CanvasTexture` — deep plum upper wall with cool-cyan argyle
    diamonds and sparse star dots; amber neon chair-rail with a shadow band; dark walnut wainscot
    with vertical seams and grain; black skirting.
  - Floor: matching dark walnut planks.
  - Ceiling: deep plum so the cinematic spotlight pool feels like a real stage.
  - Lighting: layered rig — `HemisphereLight` (warm sky / cool floor) + faint `AmbientLight` for fill,
    central warm-cream `SpotLight` straight down on the board with soft penumbra (the "billiards
    lamp"), and three low-intensity coloured `PointLight` accents tucked in the upper corners (amber,
    cyan, pink) for arcade flavour without colour-casting the pieces.

- **Gomoku · 五子棋** (15×15)
  - Player plays black and moves first against a defensive AI.
  - Heuristic AI evaluates open-3 / four threats and blocks/extends accordingly.
  - Win detection on 5-in-a-row; victory banner + confetti + 童童 voice line.

- **Chess · 国际象棋** (full 8×8)
  - Player plays white and moves first.
  - Pieces are procedurally built `LatheGeometry` profiles in true Staunton proportions
    (pawn 0.70 m → king 1.22 m on a 1.53 m square) with composite tops: crenellated rook, mitred
    bishop, pearl-crowned queen, cross-tipped king, extruded horse-head silhouette knight.
    Materials are matte ivory and warm mahogany — chosen specifically to read against the deep-plum
    walls without melting in.
  - All 32 pieces and their geometry buffers are warmed up at room build time so the first move is
    GPU-ready instantly.
  - Click-to-select, click-to-move (Windows-3D-Chess style): own piece highlights green, valid
    targets highlight yellow, captures highlight red. Works with both desktop mouse and VR
    controller through one unified click hook.
  - Animated moves: parabolic lift + ease-in-out glide + soft landing. Captured pieces sink and
    shrink (no opacity fade — that would mutate shared materials).
  - Pawns auto-promote to queen on the back rank by hot-swapping the mesh.
  - Move generation, full king-safety filtering, check / checkmate / stalemate detection.
  - 2-ply minimax AI with material + centre + pawn-advancement scoring and a small alpha-beta-ish
    prune.
  - **Animated AI cursor.** When the AI takes its turn, a glowing red ring + downward chevron flies
    to the source square first, then travels with the moving piece to the destination, then fades
    out — exactly like Microsoft 3D Chess on Windows.

- **Game lifecycle parity with Gomoku.** Both games share the wall START / END buttons; pressing
  START while a game is in progress resets the board. Switching the floor texture between Gomoku
  and Chess automatically aborts any active match and clears the board.

- **童童 commentary.** Bilingual (Chinese / English) line pools per game state — greet, start,
  player move, capture, check, AI move, AI capture, AI check, win, end. The `_say()` dispatcher
  picks the correct pool by current board mode.

---

## Tech Stack · 技术栈

| Layer | Technology |
|---|---|
| 3D Rendering | Three.js r160 · WebXR · OrbitControls |
| 3D Models | Tripo AI text-to-GLB (cached per asset id) |
| AI Companion | Zhipu GLM (OpenAI-compatible, GLM-4-Flash) |
| Voice Input | Web Speech API |
| Procedural Art | Canvas 2D textures · `LatheGeometry` / `ExtrudeGeometry` for chess pieces |
| Frontend | Vanilla HTML5 · CSS3 · ES Modules · classic-script bridges via `window.*` |
| Deployment | Zero-dependency static files — open `index.html` directly |

---

## Quick Start · 快速启动

### Option A — Direct open (Chrome / Edge / Meta Quest Browser)

```bash
# Double-click index.html, or drag it into the browser
```

### Option B — Local server (recommended)

```bash
# Python
python -m http.server 8080
# → http://localhost:8080

# Node.js
npx serve .
# → http://localhost:3000
```

### First-run flow

1. Loading screen runs while Three.js boots and the hub mesh is generated.
2. Choose your companion's gender (female / male).
3. Optionally enter your Zhipu GLM API key — skip for offline demo lines.
4. Drag to look around the central hall.
5. Click any glowing portal to teleport into the zone.
6. Talk to Lele / 童童 in the floating panel. The agent's system prompt swaps automatically per zone.

---

## API Keys · API 密钥

| Key | Where to get | Required? |
|---|---|---|
| Zhipu GLM | [open.bigmodel.cn](https://open.bigmodel.cn) | Optional (demo mode covers basic responses) |
| Tripo AI | Pre-configured in `js/config.js` | Included |

To preset the Zhipu key in code, edit `js/config.js`:

```js
ZHIPU_API_KEY: 'your-key-here',
```

---

## Project Structure · 项目结构

```
campus-companion-xr/
├── index.html              # Entry point + UI markup + onboarding modals
├── css/
│   └── style.css           # Healing-theme UI styles
├── js/
│   ├── config.js           # API keys, ZONES table, Tripo prompts, AI prompts
│   ├── tripo.js            # Tripo AI text-to-3D client (request, poll, cache, load)
│   ├── agent.js            # Zhipu GLM companion (zone-context-aware system prompts)
│   ├── chat.js             # Floating chat panel UI controller
│   ├── voice.js            # Web Speech API push-to-talk loop
│   ├── scene.js            # Central hall: portals, chandelier, fountain, lighting
│   ├── ai-companion.js     # Companion mesh, walking, speech bubble, expressions
│   ├── vr-rooms.js         # Per-zone room classes (ChatVRRoom, GamesVRRoom, ...)
│   ├── vr-panels.js        # Curved 3D panels (chat / info HUDs in VR)
│   ├── vr-interactive.js   # VR controller raycasts + click dispatch
│   ├── xr.js               # WebXR session + reference-space wiring
│   └── main.js             # ES-module entry that orchestrates everything
└── README.md
```

---

## Design Philosophy · 设计理念

- **Healing palette.** Low-saturation warm tones (cream, terracotta, sage, dusty rose). Each zone
  carries a distinct accent colour that propagates from the hub portal pool light all the way to its
  companion's silhouette and chat panel border.
- **Zero-threshold access.** No VR hardware required, no app install, no login. Quest browser users
  get controller-driven raycast interaction; desktop users get mouse + drag + WASD.
- **Peer persona.** Lele never diagnoses, prescribes, or lectures — the system prompt explicitly
  positions her as a same-age friend who listens.
- **Privacy-first.** No user data is stored; all conversation is session-only. The Zhipu key is held
  in memory and never written to disk.

---

## Hackathon Alignment · 赛道契合度

| Criterion | Coverage |
|---|---|
| AR/VR WebXR | Three.js + WebXR session; controller raycast; zero install |
| AI Agent | Context-switching GLM agent with fixed peer persona per zone |
| Higher Education | Targets university student loneliness and counselor-scarcity gap |
| Tripo AI | Integrated text-to-3D pipeline drives every furniture asset in Chat Corner |
| Demo-ready | Static files; runs from `index.html`; no build step |

---

## Team · 团队

SPATIAL SHANGHAI 2026 · Higher Education Track Submission

---

*Built in 24 hours for students who need a quiet corner.*
