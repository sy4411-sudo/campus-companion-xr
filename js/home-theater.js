// ============================================================
//  Home Theater — dual-channel video for the lounge.
//
//  TWO PATHS, ONE UI:
//    1. SCREEN_CLIPS — direct mp4 sources (Google Drive uploads,
//       same-origin Vercel Blob, etc.). Played through ONE shared
//       <video crossorigin="anonymous"> element so vr-rooms.js can
//       wrap it in a THREE.VideoTexture and render the video on the
//       3D cinema screen — works in immersive VR too, where DOM
//       iframes are invisible.
//    2. EXTERNAL_LINKS — Bilibili clips, YouTube clips, and the
//       site front pages. Each opens in a popup window via
//       window.open() because VR headsets cannot composite DOM
//       iframes onto the WebGL canvas, and YouTube/Bilibili refuse
//       direct mp4 access for licensing reasons.
//
//  Public API exposed on window.HomeTheater:
//    • video                 — shared HTMLVideoElement (for VideoTexture)
//    • open()/close()/toggle() — overlay panel
//    • playIndex(i)          — loads SCREEN_CLIPS[i] and plays it
//    • next()/prev()/togglePlay() — drive the on-screen player
//    • isReady()             — true once a clip has been loaded
// ============================================================
const HomeTheater = (() => {
  // ── On-screen clips (mp4 direct links, play in 3D screen) ─
  // The mp4 bytes are streamed through our same-origin
  // /api/video-proxy?id=… endpoint. Drive itself does NOT send the
  // CORS headers required for `<video crossorigin="anonymous">` →
  // `THREE.VideoTexture` GPU uploads, so without the proxy the
  // cinema screen would render black even when audio plays.
  // `fallback` opens Drive's /preview page in a popup as a safety
  // net for environments where the proxy is unreachable (offline /
  // local dev without Vercel functions running).
  const SCREEN_CLIPS = [
    {
      title: '《天空之城》剪辑 · Castle in the Sky',
      src: '/api/video-proxy?id=1nnOb541EaREf6KtEWDXO5_D7cAu76Quj',
      fallback: 'https://drive.google.com/file/d/1nnOb541EaREf6KtEWDXO5_D7cAu76Quj/preview',
    },
    {
      title: '《心灵捕手》剪辑 · Good Will Hunting',
      src: '/api/video-proxy?id=107Y1T8QiExo85yT0B4RarPRBqd-dTy87',
      fallback: 'https://drive.google.com/file/d/107Y1T8QiExo85yT0B4RarPRBqd-dTy87/preview',
    },
    {
      title: '《绿皮书》剪辑 · Green Book',
      src: '/api/video-proxy?id=1GPIVLY5EHqzOs4ZftdXvnWhvOkbbUdFc',
      fallback: 'https://drive.google.com/file/d/1GPIVLY5EHqzOs4ZftdXvnWhvOkbbUdFc/preview',
    },
  ];

  // ── External links (open as popup window, never on the 3D screen) ─
  const EXTERNAL_LINKS = [
    { title: 'Paddington · clip',                            url: 'https://www.youtube.com/watch?v=EoRYe17lAQ8' },
    { title: 'Eternal Sunshine of the Spotless Mind · clip', url: 'https://www.youtube.com/watch?v=hZdl2FFp0eA' },
    { title: 'About Time · clip',                            url: 'https://www.youtube.com/watch?v=dgMKzky9S4I' },
    { title: 'Bilibili · 主站',                               url: 'https://www.bilibili.com/' },
    { title: 'YouTube · main site',                           url: 'https://www.youtube.com/' },
  ];

  let currentIndex = -1;

  // ── Shared <video> element (built once, lives forever) ───
  // It floats in an off-screen wrapper most of the time so the
  // browser keeps decoding frames for the VideoTexture even when
  // the overlay is closed. While the overlay is open we re-parent
  // the SAME element into the stage div so the user can scrub.
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

  // CORS / network fallback — if the Drive direct URL refuses to
  // play (CORS preflight failure, virus-scan redirect, 403, etc.),
  // open the Drive `/preview` page in a new tab so the user can
  // still watch the clip.
  video.addEventListener('error', () => {
    const it = SCREEN_CLIPS[currentIndex];
    if (it?.fallback) {
      console.warn('[HomeTheater] direct mp4 load failed, opening fallback popup:', it.fallback);
      _popup(it.fallback);
    }
  });

  // ── Overlay DOM (lazy) ───────────────────────────────────
  let root = null, titleEl, frameWrap, screenListEl, externalListEl;
  let isOpen = false;

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'home-theater-overlay';
    root.innerHTML = `
      <div class="ht-backdrop"></div>
      <div class="ht-window" role="dialog" aria-label="Home Theater">
        <header class="ht-header">
          <div class="ht-header-title">Home Theater · 家庭影院</div>
          <button class="ht-close" aria-label="Close">×</button>
        </header>
        <main class="ht-main">
          <aside class="ht-side">
            <div class="ht-side-head">在影院屏幕上播放 · On the screen</div>
            <div class="ht-list" data-list="screen"></div>
            <div class="ht-side-head ht-side-head-2">外部链接 · External (popup)</div>
            <div class="ht-list" data-list="external"></div>
          </aside>
          <section class="ht-stage">
            <div class="ht-title">Home Theater · 家庭影院</div>
            <div class="ht-frame-wrap"></div>
          </section>
        </main>
      </div>
    `;
    document.body.appendChild(root);

    titleEl         = root.querySelector('.ht-title');
    frameWrap       = root.querySelector('.ht-frame-wrap');
    screenListEl    = root.querySelector('.ht-list[data-list="screen"]');
    externalListEl  = root.querySelector('.ht-list[data-list="external"]');

    root.querySelector('.ht-backdrop').addEventListener('click', close);
    root.querySelector('.ht-close').addEventListener('click', close);
    document.addEventListener('keydown', _onDocKey);

    // Build the lists once — both sets are static.
    SCREEN_CLIPS.forEach((it, idx) => {
      const btn = document.createElement('button');
      btn.className = 'ht-channel';
      btn.textContent = it.title;
      btn.addEventListener('click', () => playIndex(idx));
      screenListEl.appendChild(btn);
    });
    EXTERNAL_LINKS.forEach((it) => {
      const btn = document.createElement('a');
      btn.className = 'ht-channel ht-channel-link';
      btn.textContent = it.title;
      btn.href = it.url;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
      btn.addEventListener('click', (e) => {
        // Use _popup so we can size the window like a video popup.
        e.preventDefault();
        _popup(it.url);
      });
      externalListEl.appendChild(btn);
    });
  }

  function _onDocKey(e) { if (isOpen && e.key === 'Escape') close(); }

  function _popup(url) {
    // Sized to look like a typical video popup; falls back to a new
    // tab if the browser blocks the popup geometry (e.g. mobile).
    const w = Math.min(1280, Math.round(window.innerWidth  * 0.85));
    const h = Math.min(800,  Math.round(window.innerHeight * 0.85));
    const left = Math.round((window.screen.availWidth  - w) / 2);
    const top  = Math.round((window.screen.availHeight - h) / 2);
    const features = `noopener,noreferrer,width=${w},height=${h},left=${left},top=${top}`;
    const win = window.open(url, '_blank', features);
    if (!win) window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ── Playback API (drives the on-screen <video>) ──────────
  function loadSrc(src, title) {
    if (!src) return;
    if (video.src !== src) {
      video.src = src;
      video.load();
    }
    if (titleEl) titleEl.textContent = title || src;
    window.dispatchEvent(new CustomEvent('ht:load', { detail: { src, title } }));
    // Best-effort autoplay; the click that triggered playIndex is a
    // user gesture so most browsers will allow audible playback.
    video.play().catch(() => {});
  }

  function playIndex(i) {
    if (!SCREEN_CLIPS.length) return;
    currentIndex = ((i % SCREEN_CLIPS.length) + SCREEN_CLIPS.length) % SCREEN_CLIPS.length;
    const it = SCREEN_CLIPS[currentIndex];
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
    frameWrap.appendChild(video);
    root.classList.add('open');
    isOpen = true;
  }

  function close() {
    if (!root) return;
    root.classList.remove('open');
    isOpen = false;
    if (video.parentNode !== offscreen) offscreen.appendChild(video);
    // Note: we deliberately DON'T pause / clear video.src here —
    // closing the panel should leave the 3D screen still playing.
  }

  function toggle() { isOpen ? close() : open(); }

  return {
    video,                  // the live HTMLVideoElement (for VideoTexture)
    open, close, toggle,
    next, prev, togglePlay, playIndex,
    isReady,
    get currentIndex() { return currentIndex; },
    get screenClips() { return SCREEN_CLIPS; },
    get externalLinks() { return EXTERNAL_LINKS; },
  };
})();

if (typeof window !== 'undefined') window.HomeTheater = HomeTheater;
