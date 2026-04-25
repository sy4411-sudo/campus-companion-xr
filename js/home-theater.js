// ============================================================
//  Home Theater overlay — Bilibili / YouTube embed in lounge.
//
//  The leisure room's big screen is replaced with a clickable
//  surface that opens this overlay. We can't iframe Bilibili or
//  YouTube *homepages* (X-Frame-Options blocks them), so the UX is:
//
//    • Two tabs (Bilibili / YouTube) with a curated "channel" list
//      whose items embed via the official player iframe URLs.
//    • A URL / ID input that parses pasted links and updates the
//      iframe src in-place.
//    • An "Open homepage in new tab" shortcut for unrestricted
//      browsing (since the homepage itself can't be iframed).
//
//  Exposed as a classic script for parity with chat.js / voice.js.
//  Pattern: one IIFE, then `window.HomeTheater = …`.
// ============================================================
const HomeTheater = (() => {
  const FEATURED = {
    bilibili: [
      // Featured BVIDs — chosen for relaxing / 治愈 / 学习 vibes.
      { title: '4K · 治愈风景', bvid: 'BV1GJ411x7h7' },
      { title: 'Lo-fi · 学习背景', bvid: 'BV1Cv411k7VV' },
      { title: '猫咪日常', bvid: 'BV1bL4y1F7Wo' },
    ],
    youtube: [
      { title: 'Lofi hip hop · study/relax', vid: 'jfKfPfyJRdk' },
      { title: 'Synthwave radio · chill/game', vid: '4xDzrJKXOOY' },
      { title: 'Coffee shop ambience', vid: 'h2zkV-l_TfP4' },
    ],
  };

  let root = null;        // overlay container (lazy-built)
  let frame = null;       // iframe element
  let tabBili = null;
  let tabYT = null;
  let urlInput = null;
  let titleEl = null;
  let listEl = null;
  let currentTab = 'bilibili';
  let isOpen = false;

  // ── URL / ID parsing ─────────────────────────────────────
  function extractBvid(input) {
    if (!input) return null;
    const trimmed = input.trim();
    // Direct BVID (case-sensitive prefix "BV").
    const direct = trimmed.match(/(BV[0-9A-Za-z]{10})/);
    if (direct) return direct[1];
    // bilibili.com/video/BVxxxxxxxxxx[/...]
    const url = trimmed.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]{10})/);
    return url ? url[1] : null;
  }

  function extractYouTubeId(input) {
    if (!input) return null;
    const trimmed = input.trim();
    // Direct 11-char id.
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
    // youtu.be/ID
    const short = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (short) return short[1];
    // youtube.com/watch?v=ID  (or  &v=ID anywhere)
    const watch = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (watch) return watch[1];
    // youtube.com/embed/ID
    const embed = trimmed.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
    return embed ? embed[1] : null;
  }

  // ── Iframe helpers ───────────────────────────────────────
  function loadBilibili(bvid, title) {
    const src = `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&autoplay=0&danmaku=0&high_quality=1`;
    frame.src = src;
    titleEl.textContent = title || `Bilibili · ${bvid}`;
    currentTab = 'bilibili';
    syncTabs();
  }
  function loadYouTube(vid, title) {
    const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid)}?rel=0&modestbranding=1`;
    frame.src = src;
    titleEl.textContent = title || `YouTube · ${vid}`;
    currentTab = 'youtube';
    syncTabs();
  }

  // ── Build curated list for the active tab. ───────────────
  function rebuildList() {
    listEl.innerHTML = '';
    const items = FEATURED[currentTab] || [];
    for (const it of items) {
      const btn = document.createElement('button');
      btn.className = 'ht-channel';
      btn.textContent = it.title;
      btn.addEventListener('click', () => {
        if (currentTab === 'bilibili') loadBilibili(it.bvid, it.title);
        else loadYouTube(it.vid, it.title);
      });
      listEl.appendChild(btn);
    }
    // Tail "Open homepage" shortcut — unrestricted external link.
    const home = document.createElement('a');
    home.className = 'ht-channel ht-channel-link';
    home.target = '_blank';
    home.rel = 'noopener noreferrer';
    home.href = currentTab === 'bilibili' ? 'https://www.bilibili.com/' : 'https://www.youtube.com/';
    home.textContent = currentTab === 'bilibili'
      ? 'Open Bilibili homepage in new tab ↗'
      : 'Open YouTube homepage in new tab ↗';
    listEl.appendChild(home);
  }

  function syncTabs() {
    if (!tabBili || !tabYT) return;
    tabBili.classList.toggle('active', currentTab === 'bilibili');
    tabYT.classList.toggle('active', currentTab === 'youtube');
    rebuildList();
  }

  // ── Search / paste handler ───────────────────────────────
  function onSearch() {
    const v = urlInput.value;
    if (!v) return;
    // Try to detect the source from the input itself first so users
    // can paste a link from either site without changing tabs.
    const ytId = extractYouTubeId(v);
    if (ytId) { loadYouTube(ytId, 'YouTube · ' + ytId); urlInput.value = ''; return; }
    const bv = extractBvid(v);
    if (bv) { loadBilibili(bv, 'Bilibili · ' + bv); urlInput.value = ''; return; }
    // Fallback — open a search results page in a new tab since the
    // search UI itself isn't iframe-friendly.
    const q = encodeURIComponent(v);
    const url = currentTab === 'bilibili'
      ? `https://search.bilibili.com/all?keyword=${q}`
      : `https://www.youtube.com/results?search_query=${q}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ── Build overlay DOM (lazy) ─────────────────────────────
  function build() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'home-theater-overlay';
    root.innerHTML = `
      <div class="ht-backdrop"></div>
      <div class="ht-window" role="dialog" aria-label="Home Theater">
        <header class="ht-header">
          <div class="ht-tabs">
            <button class="ht-tab" data-tab="bilibili">Bilibili</button>
            <button class="ht-tab" data-tab="youtube">YouTube</button>
          </div>
          <div class="ht-search">
            <input type="text" class="ht-input"
              placeholder="Paste BV / YouTube link or ID · 粘贴链接或编号" />
            <button class="ht-go">Play</button>
          </div>
          <button class="ht-close" aria-label="Close">×</button>
        </header>
        <main class="ht-main">
          <aside class="ht-side">
            <div class="ht-side-head">Featured · 推荐</div>
            <div class="ht-list"></div>
          </aside>
          <section class="ht-stage">
            <div class="ht-title">Home Theater · 家庭影院</div>
            <div class="ht-frame-wrap">
              <iframe class="ht-frame"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowfullscreen
                referrerpolicy="no-referrer-when-downgrade"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"></iframe>
            </div>
          </section>
        </main>
      </div>
    `;
    document.body.appendChild(root);

    // Wire references
    frame    = root.querySelector('.ht-frame');
    tabBili  = root.querySelector('.ht-tab[data-tab="bilibili"]');
    tabYT    = root.querySelector('.ht-tab[data-tab="youtube"]');
    urlInput = root.querySelector('.ht-input');
    titleEl  = root.querySelector('.ht-title');
    listEl   = root.querySelector('.ht-list');

    // Events
    root.querySelector('.ht-backdrop').addEventListener('click', close);
    root.querySelector('.ht-close').addEventListener('click', close);
    tabBili.addEventListener('click', () => { currentTab = 'bilibili'; syncTabs(); });
    tabYT.addEventListener('click', () => { currentTab = 'youtube'; syncTabs(); });
    root.querySelector('.ht-go').addEventListener('click', onSearch);
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onSearch(); }
    });

    // Esc to close
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.addEventListener('keydown', _onDocKey);

    syncTabs();
    // Default first item of the first tab.
    const first = FEATURED.bilibili[0];
    loadBilibili(first.bvid, first.title);
  }

  function _onDocKey(e) {
    if (isOpen && e.key === 'Escape') close();
  }

  // ── Public API ───────────────────────────────────────────
  function open() {
    build();
    root.classList.add('open');
    isOpen = true;
    // Focus the input so users can paste immediately.
    setTimeout(() => urlInput?.focus(), 60);
  }

  function close() {
    if (!root) return;
    root.classList.remove('open');
    isOpen = false;
    // Stop playback by clearing the iframe src. Without this, audio
    // keeps playing in the background after the overlay is hidden.
    if (frame) frame.src = 'about:blank';
  }

  function toggle() { isOpen ? close() : open(); }

  return { open, close, toggle };
})();

if (typeof window !== 'undefined') window.HomeTheater = HomeTheater;
