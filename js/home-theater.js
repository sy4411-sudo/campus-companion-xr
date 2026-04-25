// ============================================================
//  Home Theater overlay — direct-mp4 player for the lounge.
//
//  WHY THIS FILE LOOKS DIFFERENT FROM THE ORIGINAL IFRAME VERSION
//  ────────────────────────────────────────────────────────────
//  In immersive VR the browser composites only the WebGL frame to
//  the headset, so DOM <iframe> embeds (Bilibili / YouTube) become
//  invisible. To make video actually play *on the 3D screen* in VR
//  we need a `THREE.VideoTexture` — and that requires a same-origin
//  (or CORS-enabled) `<video>` element.
//
//  This module:
//    • owns ONE shared `<video crossorigin="anonymous">` element,
//      kept in document.body forever (re-parented between an
//      offscreen wrapper and the overlay's stage so its frames
//      never stop being available to VideoTexture);
//    • exposes the element as `HomeTheater.video` so vr-rooms.js
//      can wrap it in a VideoTexture and paint the floor cinema
//      screen with the live video;
//    • fires `ht:load` / `ht:play` / `ht:pause` window events so
//      other systems can react;
//    • drives a curated playlist plus a "paste any mp4 URL" input.
//
//  YouTube / Bilibili streams cannot be programmatically extracted
//  from a v0 sandbox (ToS + signed URLs), so the items below ship
//  with public-domain CC mp4s as PLACEHOLDERS. Replace each `src`
//  with your own mp4 URL (Vercel Blob recommended) when you have
//  the real clip files.
// ============================================================
const HomeTheater = (() => {
  // ── Curated playlist ─────────────────────────────────────
  // Each entry: { title, src }. `src` MUST be a direct mp4/webm
  // URL on a same-origin host or one that returns CORS headers
  // (Access-Control-Allow-Origin) so VideoTexture works in VR.
  // Titles preserved from the user's request; sources are
  // CC-licensed Google sample mp4s used as placeholders.
  const FEATURED = {
    bilibili: [
      { title: '《天空之城》剪辑 · Castle in the Sky',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4' },
      { title: '《心灵捕手》剪辑 · Good Will Hunting',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
      { title: '《绿皮书》剪辑 · Green Book',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' },
    ],
    youtube: [
      { title: 'Paddington · clip',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
      { title: 'Eternal Sunshine of the Spotless Mind · clip',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4' },
      { title: 'About Time · clip',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
    ],
  };

  // Flat playlist + index (used by next/prev buttons in the 3D scene).
  const PLAYLIST = [...FEATURED.bilibili, ...FEATURED.youtube];
  let currentIndex = -1;

  // ── Shared <video> element (built once, lives forever) ───
  const offscreen = document.createElement('div');
  offscreen.style.cssText = [
    'position:fixed', 'left:-99999px', 'top:0',
    'width:1px', 'height:1px',
    'overflow:hidden', 'pointer-events:none',
  ].join(';');

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.playsInline = true;
  video.preload = 'metadata';
  video.controls = true;     // matters only when parented inside the overlay
  video.style.cssText = 'width:100%;height:100%;background:#000;';
  offscreen.appendChild(video);

  // Append once the document is ready so it always exists.
  function _attachOffscreen() {
    if (!offscreen.parentNode) document.body.appendChild(offscreen);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _attachOffscreen, { once: true });
  } else {
    _attachOffscreen();
  }

  video.addEventListener('play',  () => window.dispatchEvent(new CustomEvent('ht:play')));
  video.addEventListener('pause', () => window.dispatchEvent(new CustomEvent('ht:pause')));
  video.addEventListener('ended', () => next());

  // ── Overlay DOM (lazy) ───────────────────────────────────
  let root = null, tabBili, tabYT, urlInput, titleEl, listEl, frameWrap;
  let currentTab = 'bilibili';
  let isOpen = false;

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'home-theater-overlay';
    root.innerHTML = `
      <div class="ht-backdrop"></div>
      <div class="ht-window" role="dialog" aria-label="Home Theater">
        <header class="ht-header">
          <div class="ht-tabs">
            <button class="ht-tab" data-tab="bilibili">B 站</button>
            <button class="ht-tab" data-tab="youtube">YouTube</button>
          </div>
          <div class="ht-search">
            <input type="text" class="ht-input"
              placeholder="Paste a direct .mp4 / .webm URL · 粘贴 mp4 直链" />
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
            <div class="ht-frame-wrap"></div>
          </section>
        </main>
      </div>
    `;
    document.body.appendChild(root);

    tabBili   = root.querySelector('.ht-tab[data-tab="bilibili"]');
    tabYT     = root.querySelector('.ht-tab[data-tab="youtube"]');
    urlInput  = root.querySelector('.ht-input');
    titleEl   = root.querySelector('.ht-title');
    listEl    = root.querySelector('.ht-list');
    frameWrap = root.querySelector('.ht-frame-wrap');

    root.querySelector('.ht-backdrop').addEventListener('click', close);
    root.querySelector('.ht-close').addEventListener('click', close);
    tabBili.addEventListener('click', () => { currentTab = 'bilibili'; syncTabs(); });
    tabYT.addEventListener('click', () => { currentTab = 'youtube'; syncTabs(); });
    root.querySelector('.ht-go').addEventListener('click', onSearch);
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onSearch(); }
    });
    document.addEventListener('keydown', _onDocKey);

    syncTabs();
  }

  function _onDocKey(e) { if (isOpen && e.key === 'Escape') close(); }

  function rebuildList() {
    listEl.innerHTML = '';
    for (const it of FEATURED[currentTab] || []) {
      const btn = document.createElement('button');
      btn.className = 'ht-channel';
      btn.textContent = it.title;
      btn.addEventListener('click', () => {
        const idx = PLAYLIST.findIndex(p => p.src === it.src && p.title === it.title);
        playIndex(idx >= 0 ? idx : 0);
      });
      listEl.appendChild(btn);
    }
  }

  function syncTabs() {
    if (!tabBili || !tabYT) return;
    tabBili.classList.toggle('active', currentTab === 'bilibili');
    tabYT.classList.toggle('active', currentTab === 'youtube');
    rebuildList();
  }

  function onSearch() {
    const v = urlInput.value.trim();
    if (!v) return;
    // Treat any pasted text as a direct media URL.
    loadSrc(v, v);
    urlInput.value = '';
  }

  // ── Playback API ─────────────────────────────────────────
  function loadSrc(src, title) {
    if (!src) return;
    if (video.src !== src) {
      video.src = src;
      video.load();
    }
    titleEl && (titleEl.textContent = title || src);
    window.dispatchEvent(new CustomEvent('ht:load', { detail: { src, title } }));
    // Best-effort autoplay; browsers may require user-gesture for the
    // first call, but the click that triggered playIndex *is* a gesture.
    video.play().catch(() => {});
  }

  function playIndex(i) {
    if (!PLAYLIST.length) return;
    currentIndex = ((i % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    const it = PLAYLIST[currentIndex];
    loadSrc(it.src, it.title);
  }

  function next() { playIndex(currentIndex < 0 ? 0 : currentIndex + 1); }
  function prev() { playIndex(currentIndex < 0 ? 0 : currentIndex - 1); }

  function togglePlay() {
    if (currentIndex < 0) { playIndex(0); return; }
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  function isReady() { return currentIndex >= 0 && !!video.src; }

  // ── Overlay open/close (re-parents the shared <video>) ──
  function open() {
    build();
    // Move the video element from the offscreen wrapper into the
    // overlay's stage so the user can see + scrub it while open.
    frameWrap.appendChild(video);
    root.classList.add('open');
    isOpen = true;
    setTimeout(() => urlInput?.focus(), 60);
  }

  function close() {
    if (!root) return;
    root.classList.remove('open');
    isOpen = false;
    // Pull the element back to the offscreen wrapper so its frames
    // stay available for VideoTexture, but no longer compete with
    // the WebGL canvas for layout.
    if (video.parentNode !== offscreen) offscreen.appendChild(video);
    // Note: we deliberately DON'T clear video.src or pause here —
    // closing the overlay should leave the 3D screen still playing.
  }

  function toggle() { isOpen ? close() : open(); }

  return {
    video,                  // the live HTMLVideoElement (for VideoTexture)
    open, close, toggle,
    next, prev, togglePlay, playIndex,
    isReady,
    get currentIndex() { return currentIndex; },
    get playlist() { return PLAYLIST; },
  };
})();

if (typeof window !== 'undefined') window.HomeTheater = HomeTheater;
