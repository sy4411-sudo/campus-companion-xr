// ============================================================
//  Campus Companion XR — AI Companion Agent
//  Uses Zhipu GLM API (OpenAI-compatible interface).
//  Maintains per-session chat history and switches persona
//  context when the user enters a different zone.
// ============================================================

const Agent = (() => {

  // ── State ────────────────────────────────────────────────
  let apiKey = '';
  let currentZoneId = 'chat';
  let history = [];       // { role: 'user'|'assistant', content: string }[]
  const MAX_HISTORY = 20; // keep last N turns to stay within context limit

  // ── Demo responses (fallback when no API key) ────────────
  // Each zone has its OWN companion character so demo replies must
  // sound distinctly different — same vibe as the systemPrompt voice.
  const DEMO_RESPONSES = {
    chat: [
      "嗯嗯，我在听。慢慢说，不用急。\n\nI'm here. Take your time, no rush.",
      "听起来真的挺累的……抱抱。你愿意的话再多跟乐乐说说？\n\nThat sounds really heavy. I'm right here if you want to keep going.",
      "什么都没想清楚也没关系呀——这种状态我也常常有。\n\nIt's okay to not have it figured out. I get that feeling a lot too.",
    ],
    study: [
      "好嘞，我们拆一下：① 先确认题目要什么，② 找你已经会的部分，③ 再补缺口。你卡在哪一步？\n\nOk let's break it: ① clarify what's asked, ② list what you already know, ③ fill the gap. Where are you stuck?",
      "这个概念其实就一句话——但魔鬼在三个细节里。我先给你那一句话，再一个个挑细节，行不？\n\nThe concept is one sentence with three sneaky details. Want me to give you the sentence first, then unpack the traps?",
      "我的备考小习惯：先做一份「我已经会的清单」，能直接砍掉三分之一压力。要不要来一份？\n\nMy study trick: write a 'stuff I already know' list first — it cuts a third of the panic. Want to try?",
    ],
    leisure: [
      "哇这个我也好喜欢！你那本读到哪儿了？我最近在啃一本超级上头的散文集～\n\nOh I love that one! How far in are you? I'm currently obsessed with an essay collection.",
      "悠悠的小私心推荐：午后咖啡 + 一首老港乐 + 一本翻了一半的书，治愈到爆。\n\nMy guilty rec combo: afternoon coffee + a Cantopop classic + a half-read book. Pure bliss.",
      "等等——你刚刚说的那个梗我也在追！你站CP还是站事业线？\n\nWait that show?! I'm watching too. Are you here for the romance or the plot twists?",
    ],
    healing: [
      "我们……一起慢慢吸一口气。\n4 拍吸气……4 拍屏住……6 拍呼出。\n\n这样……再来一次。\n\n…Slow breath in for 4… hold 4… out for 6. Once more, gently.",
      "你不需要 productive，今天能好好喝一杯水也很好。\n\nYou don't need to be productive today. Even just drinking a glass of water is enough.",
      "如果实在累……\n就让自己安静地坐着。\n书法、茶、窗外的风——都是借口，让你停一下而已。\n\nIf you're tired… just sit. Calligraphy, tea, the breeze — they're all excuses to pause.",
    ],
    games: [
      "嘿嘿你来啦！按墙上「开始游戏」，咱俩就开战~你执黑先手哦。\n\nHi! Hit START on the wall and we'll battle. You're black, you go first.",
      "这步好棋！等等让我想一下下……👀\n\nSlick move! Hold on, let me think… 👀",
      "嘿嘿不能让你赢的，看童童这一手！\n\nNot letting you win that easy — watch me!",
    ],
  };

  function getDemoResponse(zoneId) {
    const pool = DEMO_RESPONSES[zoneId] || DEMO_RESPONSES.chat;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Zone switching ───────────────────────────────────────
  function setZone(zoneId) {
    if (currentZoneId === zoneId) return;
    currentZoneId = zoneId;
    // Clear history so the new zone context is clean
    history = [];
  }

  // ── Send a message ───────────────────────────────────────
  async function chat(userMessage) {
    if (!apiKey) {
      // Demo mode: simulate a small delay then return canned response
      await sleep(800 + Math.random() * 600);
      return getDemoResponse(currentZoneId);
    }

    // Find system prompt for current zone
    const zone = ZONES.find(z => z.id === currentZoneId);
    const systemPrompt = zone ? zone.systemPrompt : ZONES[0].systemPrompt;

    // Build messages array
    history.push({ role: 'user', content: userMessage });
    // Trim history
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    try {
      const response = await fetch(CONFIG.ZHIPU_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: CONFIG.ZHIPU_MODEL,
          messages,
          temperature: 0.85,
          max_tokens: 300,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Zhipu API ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '…';
      history.push({ role: 'assistant', content: reply });
      return reply;

    } catch (err) {
      console.error('[Agent] API error:', err);
      history.pop(); // remove the failed user turn
      throw err;
    }
  }

  // ── Public API ───────────────────────────────────────────
  function setApiKey(key) {
    apiKey = key.trim();
    CONFIG.ZHIPU_API_KEY = apiKey;
  }

  function getApiKey() { return apiKey; }

  function clearHistory() { history = []; }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { chat, setZone, setApiKey, getApiKey, clearHistory };
})();
