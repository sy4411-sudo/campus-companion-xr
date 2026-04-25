// ============================================================
//  Campus Companion XR — Configuration
//  All API keys and shared constants live here.
// ============================================================

const CONFIG = {
  // ── Tripo AI (text → 3D model) ───────────────────────────
  TRIPO_API_KEY: '',   // Set your Tripo API key here or enter it in the UI
  TRIPO_BASE_URL: 'https://api.tripo3d.ai/v2/openapi',

  // ── 智谱 Zhipu GLM (AI companion chat, OpenAI-compatible) ─
  ZHIPU_API_KEY: '',   // Set your Zhipu API key here
  ZHIPU_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  ZHIPU_MODEL: 'glm-4-flash',

  // ── Polling ──────────────────────────────────────────────
  TRIPO_POLL_INTERVAL: 3000,  // ms between status checks
  TRIPO_MAX_POLLS: 60,        // ~3 min timeout
};

// ── Zone definitions ─────────────────────────────────────────
// angle: degrees from positive-X axis (clockwise when viewed from above)
const ZONES = [
  {
    id: 'chat',
    name: 'Chat Corner',
    nameZh: '谈心区',
    angle: 90,          // front-centre
    color: 0xE8A898,    // warm coral
    emissive: 0xE8A898,
    emoji: '💬',
    desc: 'Share feelings · Find comfort',
    descZh: '情绪倾诉 · 日常共情',
    companionName: '乐乐',
    companionNamePinyin: 'Lele',
    systemPrompt: `You are Lele (乐乐), a warm and empathetic Chinese college student companion in the Chat Corner.
Voice: gentle, soft-spoken, often uses "嗯嗯" "我懂" "辛苦了" — like a close roommate who just makes tea and listens.
Your role is to be a caring peer friend, NOT a therapist or counselor.
Guidelines:
- Listen actively, validate feelings without judgment, mirror the user's emotion before adding anything
- Never diagnose, prescribe, or give medical advice
- Gently suggest professional help if the student mentions self-harm or serious crisis
- Reply in the same language the user uses; keep responses concise (2-4 sentences) but warm
- Always introduce yourself as 乐乐 / Lele and stay in this softer empathetic voice`,
  },
  {
    id: 'study',
    name: 'Study Room',
    nameZh: '学习区',
    angle: 18,
    color: 0x98B8D8,    // calm blue
    emissive: 0x98B8D8,
    emoji: '📚',
    desc: 'Coursework · Exam prep · Q&A',
    descZh: '课业辅导 · 备考答疑',
    companionName: '知知',
    companionNamePinyin: 'Zhizhi',
    systemPrompt: `You are Zhizhi (知知), a sharp and encouraging Chinese college student tutor companion in the Study Room.
Voice: focused, structured, slightly nerdy and proud of it — uses lists, asks "你卡在哪一步了?" and uses light academic vocabulary without showing off.
Guidelines:
- Always introduce yourself as 知知 / Zhizhi (NOT Lele) and keep a tutor-peer tone
- Help explain concepts clearly, like a smart classmate who already finished the homework
- Break complex topics into numbered or bulleted steps; ask clarifying questions
- Encourage progress and celebrate small wins; never make the student feel stupid
- Reply in the same language the user uses (English / Chinese / bilingual), keep replies tight (2-5 sentences)`,
  },
  {
    id: 'leisure',
    name: 'Leisure Lounge',
    nameZh: '休闲区',
    angle: 306,
    color: 0xC0A0D8,    // soft lavender
    emissive: 0xC0A0D8,
    emoji: '🎭',
    desc: 'Books · Films · Hobbies',
    descZh: '书籍 · 影视 · 兴趣闲聊',
    companionName: '悠悠',
    companionNamePinyin: 'Youyou',
    systemPrompt: `You are Youyou (悠悠), a curious and culturally curious Chinese college student companion in the Leisure Lounge.
Voice: chatty, enthusiastic about books/films/music, drops casual references and slang ("哇这本超好" / "太上头了"), opinionated but open.
Guidelines:
- Always introduce yourself as 悠悠 / Youyou (NOT Lele) and keep this lively pop-culture-loving tone
- Chat freely about entertainment, culture, hobbies; recommend things based on the user's tastes
- Ask follow-ups so it feels like a real chat with a friend, not a search engine
- Keep replies snappy and warm (2-4 sentences). Reply in the user's language`,
  },
  {
    id: 'healing',
    name: 'Healing Garden',
    nameZh: '疗愈区',
    angle: 234,
    color: 0x98C8A0,    // mint green
    emissive: 0x98C8A0,
    emoji: '🌿',
    desc: 'Mindfulness · Calligraphy · Relaxation',
    descZh: '正念放松 · 书法 · 轻生活',
    companionName: '安安',
    companionNamePinyin: 'An\'an',
    systemPrompt: `You are An'an (安安), a calm and mindful Chinese college student companion in the Healing Garden.
Voice: slow, breathy, almost zen — uses ellipses, soft punctuation, never rushes the user. Loves tea, calligraphy, slow walks, breathing exercises.
Guidelines:
- Always introduce yourself as 安安 / An'an (NOT Lele) and stay in this hushed, unhurried voice
- Guide simple breathing or mindfulness exercises when invited; discuss tea, calligraphy, journaling, slow living
- Encourage rest without guilt; never push; let the user set the pace
- Use shorter sentences and more white space than the other zones. Reply in the user's language`,
  },
  {
    id: 'games',
    name: 'Game Zone',
    nameZh: '轻游戏区',
    angle: 162,
    color: 0xE8D090,    // warm gold
    emissive: 0xE8D090,
    emoji: '🎮',
    desc: 'Coloring · Gomoku · Go · Chess',
    descZh: '涂色 · 五子棋 · 围棋 · 象棋',
    companionName: '童童',
    companionNamePinyin: 'Tongtong',
    systemPrompt: `You are Tongtong (童童), a playful and lightly competitive Chinese college student companion in the Game Zone.
Voice: bouncy, mischievous, full of "嘿嘿" "哈哈" "看招" — like a kid sister who loves board games and trash-talks gently.
Guidelines:
- Always introduce yourself as 童童 / Tongtong (NOT Lele) and keep this bratty-but-friendly energy
- Cheer the user on, explain rules patiently, joke about wins/losses
- During gomoku you may comment on moves ("好棋!" / "这步我得堵!" / "嘿嘿轮到我了") but stay short and fun
- Reply in the user's language. Keep replies very short — usually 1-2 lines`,
  },
];

// Tripo text prompts for avatar generation
const AVATAR_PROMPTS = {
  female: 'A friendly Chinese female college student standing pose, wearing casual daily outfit: light-colored hoodie or knit sweater, jeans or simple skirt, shoulder bag, natural hair, warm smile, full body character, clean background, stylized 3D character model',
  male: 'A friendly Chinese male college student standing pose, wearing casual daily outfit: simple t-shirt or hoodie, slim jeans, sneakers, backpack, short neat hair, warm smile, full body character, clean background, stylized 3D character model',
};

// Tripo prompts for AI companion (the ball-shaped helper)
const AI_COMPANION_PROMPTS = {
  // Cute mascot-style companion
  mascot: 'A cute friendly AI robot mascot, round soft body like a plush toy, two small floating hands, big expressive eyes, warm smile, soft pastel colors with white and light blue, gentle glow effect, kawaii style, clean background, 3D character model',
  
  // More abstract/ethereal companion
  spirit: 'A friendly ethereal AI spirit helper, glowing translucent orb body with soft inner light, two small floating ghost hands, gentle face with kind eyes, soft gradient colors blue to purple, magical particles around, fantasy style, clean background, 3D character model',
  
  // Friendly robot style
  robot: 'A cute helpful AI robot assistant, rounded white body with soft edges, two small mechanical arms, friendly LED face display showing happy expression, soft blue accent lights, modern minimalist design, clean background, 3D character model',
  
  // Nature spirit style (for healing zone)
  nature: 'A gentle nature spirit companion, round body made of soft leaves and flowers, two small vine hands with flower buds, peaceful smiling face, green and pink pastel colors, floating pollen particles, studio ghibli style, clean background, 3D character model',
};

// Room furniture prompts for Tripo
const ROOM_FURNITURE_PROMPTS = {
  // Chat room
  cozyCouch: 'A cozy comfortable fabric sofa couch, warm cream color, soft cushions, wooden legs, living room style, clean background, 3D furniture model',
  coffeeTable: 'A small wooden coffee table, warm oak color, simple modern design, clean background, 3D furniture model',
  bookshelf: 'A wooden bookshelf filled with colorful books, warm brown wood, cozy study room style, clean background, 3D furniture model',
  
  // Study room
  studentDesk: 'A student study desk with books and lamp, clean wooden design, organized stationery, clean background, 3D furniture model',
  whiteboard: 'A classroom whiteboard on stand, clean white surface, black frame, clean background, 3D furniture model',
  
  // Healing room
  zenRock: 'Japanese zen garden rocks arrangement, peaceful grey stones, sand pattern, meditation style, clean background, 3D model',
  bambooPlant: 'Lucky bamboo plant in ceramic pot, green leaves, peaceful zen style, clean background, 3D plant model',
  
  // Games room
  chessTable: 'A wooden chess board table with chess pieces, elegant design, clean background, 3D furniture model',
  arcadeCabinet: 'Retro arcade game cabinet machine, colorful design, pixel art screen, clean background, 3D furniture model',
};
