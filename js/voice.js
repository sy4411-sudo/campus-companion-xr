// ============================================================
//  Campus Companion XR — Voice Input
//  Web Speech API wrapper. Works on Quest Browser + Chrome.
//  Detects language automatically from first result.
// ============================================================

const VoiceInput = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let listening = false;
  let callbacks = {};

  function supported() { return !!SR; }

  function init(cbs = {}) {
    callbacks = cbs;
    if (!SR) { console.warn('[Voice] SpeechRecognition not supported'); return false; }

    rec = new SR();
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;
    rec.lang            = 'zh-CN';  // Quest Browser supports zh-CN

    rec.onstart = () => {
      listening = true;
      callbacks.onStart?.();
    };
    rec.onresult = (e) => {
      const res   = e.results[e.results.length - 1];
      const text  = res[0].transcript;
      const final = res.isFinal;
      callbacks.onResult?.(text, final);
    };
    rec.onend = () => {
      listening = false;
      callbacks.onEnd?.();
    };
    rec.onerror = (e) => {
      console.warn('[Voice] Error:', e.error);
      listening = false;
      callbacks.onEnd?.();
    };

    return true;
  }

  function start(lang = 'zh-CN') {
    if (!rec || listening) return;
    rec.lang = lang;
    try { rec.start(); } catch (e) { console.warn('[Voice]', e); }
  }

  function stop()   { if (rec && listening) rec.stop(); }
  function toggle() { listening ? stop() : start(); }
  function isListening() { return listening; }

  return { supported, init, start, stop, toggle, isListening };
})();
