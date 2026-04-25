// ============================================================
//  Campus Companion XR — Chat UI
//  Manages the floating chat panel: message rendering,
//  user input, send button, typing indicator, mode display.
// ============================================================

const Chat = (() => {

  let panelEl, messagesEl, inputEl, sendEl, modeEl, closeEl;
  let avatarIconEl;
  let onSend = null;   // callback(message: string) => Promise<string>
  let isOpen = false;
  let pendingGender = 'female';

  // ── Init ─────────────────────────────────────────────────
  function init(opts = {}) {
    panelEl     = document.getElementById('chat-panel');
    messagesEl  = document.getElementById('chat-messages');
    inputEl     = document.getElementById('chat-input');
    sendEl      = document.getElementById('chat-send');
    modeEl      = document.getElementById('chat-mode');
    closeEl     = document.getElementById('chat-close');
    avatarIconEl = document.getElementById('companion-avatar-icon');

    onSend = opts.onSend || null;

    sendEl.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    closeEl.addEventListener('click', close);
  }

  // ── Open / close ─────────────────────────────────────────
  function open(zone) {
    panelEl.classList.remove('hidden');
    panelEl.classList.add('visible');
    isOpen = true;
    if (zone) setZone(zone);
    // Greet on first open
    if (messagesEl.children.length === 0) {
      setTimeout(() => greet(zone), 400);
    }
  }

  function close() {
    panelEl.classList.remove('visible');
    panelEl.classList.add('hidden');
    isOpen = false;
  }

  function toggle(zone) {
    isOpen ? close() : open(zone);
  }

  // ── Zone context ─────────────────────────────────────────
  function setZone(zone) {
    if (!zone) return;
    if (modeEl) modeEl.textContent = `${zone.emoji} ${zone.name}  ${zone.nameZh}`;
  }

  function setGender(gender) {
    pendingGender = gender;
    if (avatarIconEl) avatarIconEl.textContent = gender === 'female' ? '👩‍🎓' : '👨‍🎓';
  }

  // ── Greet ────────────────────────────────────────────────
  // Each zone has its OWN companion character — different name, different
  // voice — so the greeting sets the tone right away.
  function greet(zone) {
    const greetings = {
      chat:    ["嗨，我是乐乐 👋 在这里就是想陪你慢慢聊聊。有什么压在心里的、开心的、奇怪的，都可以说给我听。\n\nHey, I'm Lele — I'm here just to listen, no judgment. Tell me anything that's on your mind."],
      study:   ["你好，我是知知 📚 学习的事交给我吧——你卡在哪一步了？发我题目或概念，我们一起拆开看。\n\nHi, I'm Zhizhi. Drop the topic or problem and we'll break it down step by step."],
      leisure: ["嘿嘿，我是悠悠 🎭 最近有什么超上头的书、剧、歌吗？快推给我，我也馋着追新坑！\n\nHey, I'm Youyou. Got any books / shows / songs you're obsessed with lately? Spill!"],
      healing: ["……欢迎来到这里 🌿\n我是安安。先不急着说什么，慢慢呼吸，喝口水，准备好了再聊。\n\n…Welcome. I'm An'an. No rush — just breathe. We can talk whenever you're ready."],
      games:   ["嘿嘿我是童童 🎮 想下五子棋吗？按墙上「开始游戏」，你执黑先手，我陪你玩~\n\nHey, I'm Tongtong! Hit the START button on the wall and let's play some gomoku — you go first!"],
    };
    const pool = zone ? (greetings[zone.id] || greetings.chat) : greetings.chat;
    addBubble(pool[0], 'assistant');
  }

  // ── Send message ─────────────────────────────────────────
  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    addBubble(text, 'user');

    const typingEl = addTyping();
    try {
      if (onSend) {
        const reply = await onSend(text);
        typingEl.remove();
        addBubble(reply, 'assistant');
      } else {
        typingEl.remove();
        addBubble('(Chat feature requires an API key / 需要API密钥才能使用聊天功能)', 'assistant');
      }
    } catch (err) {
      typingEl.remove();
      addBubble(`Sorry, something went wrong 😅 — ${err.message}\n\n抱歉，出现了问题。`, 'assistant');
    }
  }

  // ── Bubble rendering ─────────────────────────────────────
  function addBubble(text, role) {
    const wrap = document.createElement('div');
    wrap.className = `bubble-wrap ${role}`;

    if (role === 'assistant') {
      const icon = document.createElement('div');
      icon.className = 'bubble-icon';
      icon.textContent = pendingGender === 'female' ? '👩‍🎓' : '👨‍🎓';
      wrap.appendChild(icon);
    }

    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    wrap.appendChild(bubble);

    messagesEl.appendChild(wrap);
    // Animate in
    requestAnimationFrame(() => bubble.classList.add('show'));
    scrollBottom();
    return wrap;
  }

  function addTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'bubble-wrap assistant';
    const icon = document.createElement('div');
    icon.className = 'bubble-icon';
    icon.textContent = pendingGender === 'female' ? '👩‍🎓' : '👨‍🎓';
    wrap.appendChild(icon);
    const bubble = document.createElement('div');
    bubble.className = 'bubble assistant typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── System message ────────────────────────────────────────
  function systemMsg(text) {
    const el = document.createElement('div');
    el.className = 'system-msg';
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollBottom();
  }

  return { init, open, close, toggle, setZone, setGender, addBubble, systemMsg, greet };
})();
