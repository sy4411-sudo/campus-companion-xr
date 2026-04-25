// ============================================================
//  Campus Companion XR — VR 3D UI Panel System
//  All UI in VR mode must be Three.js meshes (no HTML).
//  Panels use CanvasTexture for rich visual content.
//  Buttons are separate meshes for easy raycasting.
// ============================================================

const VRPanels = (() => {

  // ── Helpers ───────────────────────────────────────────────
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  }

  function makeCanvasMesh(w, h, cw, ch) {
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh._canvas = canvas; mesh._ctx = ctx; mesh._tex = tex;
    return mesh;
  }

  // ── Chat Panel (main message area) ───────────────────────
  function createChatPanel(w = 1.4, h = 1.1) {
    const mesh = makeCanvasMesh(w, h, 560, 440);
    mesh._messages = [];
    mesh._zoneLabel = 'Chat Corner · 谈心区';
    mesh._genderIcon = '👩‍🎓';
    mesh.userData.isPanelChat = true;
    renderChatPanel(mesh);
    return mesh;
  }

  function renderChatPanel(mesh) {
    const ctx = mesh._ctx;
    const cw = mesh._canvas.width, ch = mesh._canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // Background
    ctx.fillStyle = 'rgba(255,248,235,0.93)';
    rrect(ctx, 8, 8, cw-16, ch-16, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(180,140,80,0.45)'; ctx.lineWidth = 3; ctx.stroke();

    // Header
    ctx.fillStyle = 'rgba(255,244,220,0.85)';
    rrect(ctx, 8, 8, cw-16, 64, [20,20,0,0]); ctx.fill();
    ctx.fillStyle = '#4a3020';
    ctx.font = 'bold 26px "Segoe UI Emoji", Arial'; ctx.textAlign = 'left';
    ctx.fillText(`${mesh._genderIcon}  Lele · 乐乐`, 24, 46);
    ctx.font = '18px Arial'; ctx.fillStyle = '#8a6040';
    ctx.fillText(mesh._zoneLabel, 24, 68);

    // Messages
    const msgs = mesh._messages.slice(-5);
    let y = 88;
    msgs.forEach(msg => {
      const isUser = msg.role === 'user';
      const maxW = cw - 80;
      ctx.font = '19px "Microsoft YaHei", Arial';
      const lines = wrapText(ctx, msg.content, maxW);
      const boxH = lines.length * 26 + 16;

      if (isUser) {
        ctx.fillStyle = 'rgba(70,120,200,0.88)';
        rrect(ctx, cw - 30 - maxW*0.65, y, maxW*0.65, boxH, 12); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        lines.forEach((ln, li) => ctx.fillText(ln, cw - 28 - maxW*0.63, y+22+li*26));
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        rrect(ctx, 20, y, maxW*0.72, boxH, 12); ctx.fill();
        ctx.strokeStyle = 'rgba(180,140,80,0.3)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#4a3020';
        ctx.textAlign = 'left';
        lines.forEach((ln, li) => ctx.fillText(ln, 28, y+22+li*26));
      }
      y += boxH + 8;
    });

    mesh._tex.needsUpdate = true;
  }

  function updateChatPanel(mesh, messages, zone, gender) {
    if (messages) mesh._messages = messages;
    if (zone)     mesh._zoneLabel = `${zone.emoji} ${zone.name} · ${zone.nameZh}`;
    if (gender)   mesh._genderIcon = gender === 'female' ? '👩‍🎓' : '👨‍🎓';
    renderChatPanel(mesh);
  }

  // ── Voice Button ─────────────────────────────────────────
  function createVoiceButton(r = 0.14) {
    const mesh = makeCanvasMesh(r*2, r*2, 256, 256);
    mesh.userData.isButton = true;
    mesh.userData.isVoiceBtn = true;
    mesh._active = false;
    mesh._draw = (hover) => {
      const ctx = mesh._ctx, s = 256;
      ctx.clearRect(0, 0, s, s);
      ctx.beginPath(); ctx.arc(s/2,s/2,s/2-6,0,Math.PI*2);
      ctx.fillStyle = mesh._active ? '#e84040' : (hover ? '#c87040' : 'rgba(255,248,235,0.95)');
      ctx.fill();
      ctx.strokeStyle = mesh._active ? '#c02020' : 'rgba(180,140,80,0.5)';
      ctx.lineWidth = 5; ctx.stroke();
      ctx.font = `${Math.round(s*0.42)}px "Segoe UI Emoji", Arial`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🎤', s/2, s/2+4);
      ctx.textBaseline = 'alphabetic';
      mesh._tex.needsUpdate = true;
    };
    mesh._draw(false);
    return mesh;
  }

  // ── Quick Reply Button ────────────────────────────────────
  function createQuickBtn(labelEn, labelZh, accentColor, onClick) {
    const mesh = makeCanvasMesh(0.55, 0.14, 320, 80);
    mesh.userData.isButton = true;
    mesh.userData.onClick = onClick;
    mesh._draw = (hover) => {
      const ctx = mesh._ctx, cw = 320, ch = 80;
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = hover
        ? `#${accentColor.toString(16).padStart(6,'0')}`
        : 'rgba(255,248,235,0.92)';
      rrect(ctx, 4, 4, cw-8, ch-8, 14); ctx.fill();
      ctx.strokeStyle = `#${accentColor.toString(16).padStart(6,'0')}`;
      ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = hover ? '#fff' : '#4a3020';
      ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
      ctx.fillText(labelEn, cw/2, 32);
      ctx.font = '16px "Microsoft YaHei", Arial';
      ctx.fillStyle = hover ? 'rgba(255,255,255,0.8)' : '#7a5838';
      ctx.fillText(labelZh, cw/2, 56);
      mesh._tex.needsUpdate = true;
    };
    mesh._draw(false);
    return mesh;
  }

  // ── Zone Entry Panel (shown near each portal) ─────────────
  function createZoneInfoPanel(zone) {
    const mesh = makeCanvasMesh(1.1, 0.55, 440, 220);
    const cw = 440, ch = 220;
    const ctx = mesh._ctx;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = 'rgba(255,248,235,0.90)';
    rrect(ctx, 8, 8, cw-16, ch-16, 18); ctx.fill();
    ctx.strokeStyle = `#${zone.color.toString(16).padStart(6,'0')}88`;
    ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#4a3020';
    ctx.font = `bold 36px "Segoe UI Emoji", Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`${zone.emoji}  ${zone.name}`, cw/2, 58);
    ctx.font = '26px "Microsoft YaHei", Arial'; ctx.fillStyle = '#7a5838';
    ctx.fillText(zone.nameZh, cw/2, 96);
    ctx.font = '19px Arial'; ctx.fillStyle = '#a07850';
    ctx.fillText(zone.desc, cw/2, 134);
    ctx.fillText(zone.descZh, cw/2, 160);
    ctx.font = 'bold 17px Arial'; ctx.fillStyle = '#c07840';
    ctx.fillText('▶  Point & Pull Trigger to Enter  ·  指向并扣动扳机进入', cw/2, 196);
    mesh._tex.needsUpdate = true;
    return mesh;
  }

  // ── Full VR Chat HUD (panel + buttons group) ──────────────
  /**
   * Returns a THREE.Group with:
   *   .chatPanel  — main message canvas
   *   .voiceBtn   — microphone circle
   *   .quickBtns  — array of quick reply buttons
   * Position the group relative to camera/player.
   */
  function createChatHUD(zone, gender, onQuickReply, onVoice) {
    const group = new THREE.Group();

    // Chat panel (centre)
    const panel = createChatPanel();
    updateChatPanel(panel, [], zone, gender);
    panel.position.set(0, 0.25, 0);
    group.add(panel);
    group.chatPanel = panel;

    // Voice button (bottom-left)
    const vBtn = createVoiceButton(0.13);
    vBtn.position.set(-0.62, -0.5, 0);
    vBtn.userData.onClick = () => { if (onVoice) onVoice(); };
    group.add(vBtn);
    group.voiceBtn = vBtn;

    // Quick replies (bottom row)
    const replies = getQuickReplies(zone);
    const quickBtns = [];
    replies.forEach((r, i) => {
      const btn = createQuickBtn(r.en, r.zh, zone.color, () => {
        if (onQuickReply) onQuickReply(r.en);
      });
      btn.position.set(-0.42 + i * 0.58, -0.52, 0);
      group.add(btn);
      quickBtns.push(btn);
    });
    group.quickBtns = quickBtns;

    return group;
  }

  function getQuickReplies(zone) {
    const byZone = {
      chat:    [
        { en: "I'm stressed",   zh: '我很焦虑' },
        { en: 'Just wanna chat', zh: '随便聊聊' },
        { en: 'Cheer me up',    zh: '鼓励我一下' },
      ],
      study:   [
        { en: 'Explain this',   zh: '帮我解释' },
        { en: 'Give an example',zh: '举个例子' },
        { en: 'Quiz me',        zh: '考考我' },
      ],
      leisure: [
        { en: 'Recommend sth',  zh: '推荐一下' },
        { en: "What's trending",zh: '最近流行啥' },
        { en: 'Tell me a story',zh: '给我讲个故事' },
      ],
      healing: [
        { en: 'Guide breathing', zh: '引导我呼吸' },
        { en: 'Calm me down',   zh: '帮我平静' },
        { en: 'Mindfulness tip',zh: '正念技巧' },
      ],
      games:   [
        { en: 'How to play',    zh: '怎么玩' },
        { en: 'Good move!',     zh: '好棋！' },
        { en: 'I won!',         zh: '我赢了！' },
      ],
    };
    return (zone && byZone[zone.id]) || byZone.chat;
  }

  // ── Typing indicator panel ────────────────────────────────
  function createTypingIndicator() {
    const mesh = makeCanvasMesh(0.5, 0.14, 200, 56);
    let frame = 0;
    const dots = ['·  ·  ·', '●  ·  ·', '●  ●  ·', '●  ●  ●'];
    function tick() {
      frame = (frame + 1) % dots.length;
      const ctx = mesh._ctx;
      ctx.clearRect(0, 0, 200, 56);
      ctx.fillStyle = 'rgba(255,248,235,0.9)';
      rrect(ctx, 4, 4, 192, 48, 12); ctx.fill();
      ctx.fillStyle = '#8a6040'; ctx.font = 'bold 26px Arial';
      ctx.textAlign = 'center'; ctx.fillText(dots[frame], 100, 34);
      mesh._tex.needsUpdate = true;
    }
    mesh._interval = setInterval(tick, 350);
    mesh.destroy = () => clearInterval(mesh._interval);
    return mesh;
  }

  // ── Text wrap util ────────────────────────────────────────
  function wrapText(ctx, text, maxW) {
    const words = text.split('');  // char-by-char for CJK
    // Try word split first for English
    const wordTokens = text.split(' ');
    if (wordTokens.length > 1) {
      const lines = [];
      let line = '';
      for (const w of wordTokens) {
        const test = line + (line ? ' ' : '') + w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line); line = w;
        } else line = test;
      }
      if (line) lines.push(line);
      return lines;
    }
    // CJK char-by-char wrap
    const lines = [];
    let line = '';
    for (const ch of words) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = ch;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  return {
    createChatPanel, renderChatPanel, updateChatPanel,
    createVoiceButton, createQuickBtn,
    createZoneInfoPanel, createChatHUD,
    createTypingIndicator,
  };
})();
