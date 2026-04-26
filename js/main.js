// ============================================================
//  Campus Companion XR — Main Entry Point (ES Module)
//  Orchestrates: Scene → XR → Avatar → Agent → Chat
// ============================================================

// Version-tagged imports so Quest Browser's HTTP cache can't serve old
// scene/XR/VR-room code from a previous deploy. Bump in lock-step with
// the ?v= tags in index.html when you need to flush the headset cache.
import { CampusScene }    from './scene.js?v=20260426-3';
import { XRManager }      from './xr.js?v=20260426-3';
import { VRRoomManager }  from './vr-rooms.js?v=20260426-3';

// ── DOM refs ──────────────────────────────────────────────────
const loadingScreen  = document.getElementById('loading-screen');
const loadingBar     = document.querySelector('.loading-progress');
const zoneIndicator  = document.getElementById('zone-indicator');
const zoneIconEl     = document.getElementById('zone-icon');
const zoneNameEl     = document.getElementById('zone-name');
const zoneTooltip    = document.getElementById('zone-tooltip');
const homeBtn        = document.getElementById('home-btn');
const chatToggleBtn  = document.getElementById('chat-toggle-btn');
const vrBtn          = document.getElementById('vr-btn');
const arStudyBtn     = document.getElementById('ar-study-btn');
const arOverlay      = document.getElementById('ar-overlay');
const voiceBtnEl     = document.getElementById('voice-btn');
const voiceStatusEl  = document.getElementById('voice-status');

// ── App state ─────────────────────────────────────────────────
let scene, xrMgr, vrRoomMgr;
// Default kept on file because some existing UI keys are color-coded by
// it (e.g. VRPanels chat HUD highlight). The on-screen avatar-picker is
// gone — the hub companion orb is the same for every visitor.
const selectedGender = 'female';
let activeZone = null;
// VR HUD group (created per zone entry in VR)
let vrHUD = null;
// Track if we're inside a VR room (true for both VR sessions and desktop visits)
let isInVRRoom = false;
// Desktop-only: which immersive room is currently visible to the desktop user
let desktopVRRoom = null;

// ── XR movement bounds ───────────────────────────────────────
// Hub is the central cylindrical room (radius 21). We keep the user's HEAD
// inside r=19 so they can't poke through the outer wall.
const HUB_BOUNDS = {
  type: 'cylinder',
  cx: 0, cz: 0, maxRadius: 19,
  minY: 0, maxY: 8.5,
};
// Build bounds matching the interior of an immersive VR room.
function buildRoomBounds(room) {
  if (!room) return null;
  const size = room.getRoomSize();
  const rp   = room.getRoomPosition();
  const margin = 0.6;
  return {
    type: 'box',
    minX: rp.x - size.width  / 2 + margin,
    maxX: rp.x + size.width  / 2 - margin,
    minZ: rp.z - size.depth  / 2 + margin,
    maxZ: rp.z + size.depth  / 2 - margin,
    minY: 0, maxY: size.height - 0.3,
  };
}

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  progress(10);

  scene = new CampusScene(document.getElementById('canvas'));
  scene.init();
  progress(40);

  // Scene callbacks (desktop)
  scene.onZoneClick = handleZoneClick;
  scene.onZoneHover = handleZoneHover;
  
  // Frame update callback for VR room manager + hub companion
  scene.onFrameUpdate = (delta, isXR, camWorld) => {
    if (vrRoomMgr && isInVRRoom) {
      vrRoomMgr.update(delta, camWorld);
      const activeRoom = vrRoomMgr.getActiveRoom();
      // Track the player's world position in BOTH VR and desktop so the
      // companion in 谈心区 can walk over and follow.
      if (activeRoom) {
        activeRoom.updateStudentPosition?.(camWorld);
      }
    } else {
      // Player is in the central hub — let the hub companion orb tick
      // its idle/follow animation and run proximity-aware introductions
      // for whichever zone portal the player is approaching.
      scene.updateHubCompanion?.(delta, camWorld);
    }
  };

  // XR Manager
  xrMgr = new XRManager({
    renderer:     scene.renderer,
    scene:        scene.scene,
    camera:       scene.camera,
    playerGroup:  scene.playerGroup,
    floorMesh:    scene.floorMesh,
    portalMeshes: scene.portalMeshes,
    spawnPoint:   scene.spawnPoint,   // VR rig is pushed here on sessionstart
    onZoneEnter:  handleZoneClick,
    onExitXR:     handleExitXR,
  });
  scene.xrManager = xrMgr;
  // Default movement bounds = hub interior. Switched to room bounds on entry.
  xrMgr.setMovementBounds(HUB_BOUNDS);

  // VR Room Manager - handles immersive room environments
  vrRoomMgr = new VRRoomManager(scene.scene, scene.playerGroup, {
    // Pass the renderer so the manager can read `renderer.xr.getCamera()`
    // and recenter the rig (head world pos / yaw) on room entry — this
    // is what keeps the VR view aligned with the desktop view.
    renderer: scene.renderer,
    onRoomEnter: (zoneId, room) => {
      isInVRRoom = true;
      const exitPortal = room.getExitPortal?.();
      if (exitPortal) xrMgr.registerInteractable(exitPortal);
      const interactables = room.getInteractables?.() || [];
      interactables.forEach(obj => xrMgr.registerInteractable(obj));
      // Constrain XR thumbstick locomotion to this room's interior.
      xrMgr.setMovementBounds(buildRoomBounds(room));
    },
    onRoomExit: () => {
      isInVRRoom = false;
      xrMgr.clearInteractables();
      // Restore hub bounds so the user can walk around inside the central
      // cylindrical hub but not through its outer wall.
      xrMgr.setMovementBounds(HUB_BOUNDS);
    }
  });

  progress(60);

  // Init Chat
  Chat.init({ onSend: async msg => Agent.chat(msg) });

  // Init Voice
  VoiceInput.init({
    onStart:  () => { voiceStatusEl?.classList.remove('hidden'); voiceStatusEl.textContent = '🎤 Listening… / 正在聆听…'; },
    onResult: (text, final) => {
      if (voiceStatusEl) voiceStatusEl.textContent = `🎤 "${text}"`;
      if (final && text.trim()) {
        handleVoiceResult(text.trim());
        voiceStatusEl?.classList.add('hidden');
      }
    },
    onEnd: () => voiceStatusEl?.classList.add('hidden'),
  });

  progress(80);

  // Check WebXR support and show/hide buttons
  const supportsVR = await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false);
  const supportsAR = await navigator.xr?.isSessionSupported('immersive-ar').catch(() => false);
  if (vrBtn) vrBtn.style.display = supportsVR ? '' : 'none';
  if (arStudyBtn) arStudyBtn.style.display = supportsAR ? '' : 'none';

  progress(100);
  await sleep(500);

  loadingScreen.classList.add('fade-out');
  await sleep(500);
  loadingScreen.style.display = 'none';

  startApp();
}

function progress(p) { if (loadingBar) loadingBar.style.width = `${p}%`; }

// ── App start (no avatar picker) ─────────────────────────────
// Drop the user straight into the lobby. The hub companion orb takes
// over the role the human placeholder + gender picker used to play.
function startApp() {
  Chat.setGender(selectedGender);
  Agent.setApiKey(CONFIG.ZHIPU_API_KEY);
  Chat.systemMsg('AI 已就绪 / Zhipu GLM ready');
  // No active zone yet — the player is in the hub.
  activeZone = null;
  scene.setActiveZone(null);
  // Spawn / activate the hub companion so it can greet the player and
  // walk them through what each zone offers.
  scene.enterHub?.();
}

// ── Zone entry ────────────────────────────────────────────────
function handleZoneClick(zone) {
  activeZone = zone;
  Agent.setZone(zone.id);
  scene.setActiveZone(zone.id);
  updateZoneIndicator(zone);
  // Once the player commits to a zone, retire the hub companion so
  // it doesn't trail along into the immersive room.
  scene.exitHub?.();

  if (xrMgr.isPresenting()) {
    // VR mode
    handleZoneVR(zone);
  } else {
    // Desktop mode
    handleZoneDesktop(zone);
  }
}

function handleZoneDesktop(zone) {
  Chat.open(zone);
  Chat.setZone(zone);
  // AR study room button visibility
  if (arStudyBtn) arStudyBtn.style.display = zone.id === 'study' ? '' : 'none';

  // Teleport the desktop camera into the same immersive 3D room used in VR.
  enterDesktopVRRoom(zone);
}

// ── Desktop immersive-room visit ──────────────────────────────
function enterDesktopVRRoom(zone) {
  // Leave any previous room first (and unregister its clickables).
  exitDesktopVRRoom();

  const room = vrRoomMgr.getOrCreateRoom(zone.id);
  if (!room) return;

  desktopVRRoom = room;
  isInVRRoom = true;
  room.enter(); // makes room.group visible

  // Override exit so clicking the green exit door returns to the hub on desktop.
  room.onExit = () => goHome();

  // Make the exit portal and any in-room interactables clickable on desktop.
  const exitPortal = room.getExitPortal?.();
  if (exitPortal) scene.addClickable(exitPortal);
  const interactables = room.getInteractables?.() || [];
  interactables.forEach(m => scene.addClickable(m));

  // Snap camera into the room. Use spawn point at standing eye height.
  const spawn = room.getSpawnPoint();
  const lookAt = room.getLookAtPoint();
  const camPos = spawn.clone(); camPos.y = 1.7;

  // Build axis-aligned box bounds matching the room's interior (with a small
  // wall margin) so OrbitControls can never push the camera through the walls.
  const size = room.getRoomSize();
  const rp   = room.getRoomPosition();
  const margin = 0.8;
  const bounds = {
    type: 'box',
    minX: rp.x - size.width  / 2 + margin,
    maxX: rp.x + size.width  / 2 - margin,
    minZ: rp.z - size.depth  / 2 + margin,
    maxZ: rp.z + size.depth  / 2 - margin,
    minY: 1.1,
    maxY: size.height - 0.5,
    target: lookAt,
    minDistance: 1.2,
    maxDistance: Math.min(size.width, size.depth) * 0.55,
    minPolar: Math.PI * 0.18,
    maxPolar: Math.PI * 0.62,
  };

  scene.flyToRoom(camPos, lookAt, bounds);
}

function exitDesktopVRRoom() {
  if (!desktopVRRoom) return;
  const exitPortal = desktopVRRoom.getExitPortal?.();
  if (exitPortal) scene.removeClickable(exitPortal);
  const interactables = desktopVRRoom.getInteractables?.() || [];
  interactables.forEach(m => scene.removeClickable(m));
  desktopVRRoom.exit();
  desktopVRRoom = null;
  isInVRRoom = false;
}

// Unified "back to the hub" used by Home button and exit-portal clicks.
function goHome() {
  exitDesktopVRRoom();
  scene.flyHome();
  activeZone = null;
  zoneIndicator.classList.add('hidden');
  Chat.close();
  scene.setActiveZone(null);
  if (arStudyBtn) arStudyBtn.style.display = 'none';
  // Wake the hub companion back up so it greets the returning player.
  scene.enterHub?.();
}

function handleZoneVR(zone) {
  // Try to enter an immersive VR room for this zone
  const room = vrRoomMgr.enterRoom(zone.id);
  
  if (room) {
    // Successfully entered a VR room - show VR HUD inside the room
    showVRHUD(zone);
    
    // Position HUD for in-room experience
    if (vrHUD) {
      vrHUD.position.set(0.5, 0, -0.8);
      vrHUD.rotation.y = -0.2;
    }
  } else {
    // No VR room for this zone - use original behavior
    showVRHUD(zone);

    if (zone.id === 'study') {
      showARPrompt();
    } else if (zone.id === 'leisure') {
      scene.showCinema(true);
    } else {
      scene.showCinema(false);
    }
  }
}

function showVRHUD(zone) {
  // Remove previous HUD
  if (vrHUD) { scene.scene.remove(vrHUD); xrMgr.clearInteractables(); }

  vrHUD = VRPanels.createChatHUD(
    zone,
    selectedGender,
    (quickReplyText) => sendChat(quickReplyText),
    () => VoiceInput.toggle(),
  );

  // Position HUD in front of player at comfortable height
  const camWorld = new THREE.Vector3();
  scene.camera.getWorldPosition(camWorld);
  const camDir = new THREE.Vector3();
  scene.camera.getWorldDirection(camDir);
  vrHUD.position.copy(camWorld).addScaledVector(camDir, 1.2);
  vrHUD.position.y = camWorld.y - 0.1;
  vrHUD.lookAt(camWorld);

  // Attach to player so it follows
  scene.playerGroup.add(vrHUD);
  vrHUD.position.set(0.6, -0.15, -1.1);
  vrHUD.rotation.y = -0.25;

  // Register buttons as interactable
  vrHUD.quickBtns.forEach(b => xrMgr.registerInteractable(b));
  xrMgr.registerInteractable(vrHUD.voiceBtn);
}

async function sendChat(text) {
  Chat.addBubble(text, 'user');
  
  // Notify VR room or scene that student sent a message
  if (isInVRRoom && vrRoomMgr.getActiveRoom()) {
    vrRoomMgr.getActiveRoom().onStudentMessage?.(text);
  } else {
    scene.onStudentMessage(text);
  }
  
  // Update VR HUD
  const typing = VRPanels.createTypingIndicator();
  if (vrHUD) {
    typing.position.set(0, -0.68, 0);
    vrHUD.add(typing);
  }
  try {
    // Notify that AI is starting to respond
    if (isInVRRoom && vrRoomMgr.getActiveRoom()) {
      vrRoomMgr.getActiveRoom().onAIStartResponse?.();
    } else {
      scene.onAIStartResponse();
    }
    
    const reply = await Agent.chat(text);
    
    // Notify that AI finished responding
    if (isInVRRoom && vrRoomMgr.getActiveRoom()) {
      vrRoomMgr.getActiveRoom().onAIEndResponse?.();
    } else {
      scene.onAIEndResponse();
    }
    
    if (vrHUD) vrHUD.remove(typing);
    typing.destroy?.();
    Chat.addBubble(reply, 'assistant');
    // Update VR panel
    if (vrHUD?.chatPanel) {
      VRPanels.updateChatPanel(vrHUD.chatPanel, getLastMessages(6), activeZone, selectedGender);
    }
  } catch (e) {
    if (isInVRRoom && vrRoomMgr.getActiveRoom()) {
      vrRoomMgr.getActiveRoom().onAIEndResponse?.();
    } else {
      scene.onAIEndResponse();
    }
    if (vrHUD) vrHUD.remove(typing);
    typing.destroy?.();
    Chat.addBubble(`Error: ${e.message}`, 'assistant');
  }
}

function getLastMessages(n) {
  const msgs = [];
  document.querySelectorAll('#chat-messages .bubble-wrap').forEach(w => {
    const role = w.classList.contains('user') ? 'user' : 'assistant';
    const content = w.querySelector('.bubble')?.textContent || '';
    if (content) msgs.push({ role, content });
  });
  return msgs.slice(-n);
}

// ── AR Study Room ─────────────────────────────────────────────
function showARPrompt() {
  const el = document.getElementById('ar-prompt');
  if (el) { el.classList.remove('hidden'); el.classList.add('visible'); }
}

document.getElementById('start-ar-btn')?.addEventListener('click', async () => {
  document.getElementById('ar-prompt')?.classList.add('hidden');
  try {
    await xrMgr.requestARSession(arOverlay);
    Chat.systemMsg('📷 AR Study Room active — your AI tutor is here! / AR学习模式已启动！');
    Agent.setZone('study');
    Chat.setZone(ZONES.find(z => z.id === 'study'));
  } catch (e) {
    Chat.systemMsg(`AR not available: ${e.message}`);
  }
});

// ── VR Button ─────────────────────────────────────────────────
vrBtn?.addEventListener('click', async () => {
  try {
    await xrMgr.requestVRSession();
    vrBtn.textContent = '⏹ Exit VR';
  } catch (e) {
    alert(`VR Error: ${e.message}\n\nMake sure you're using Meta Quest Browser or Chrome with WebXR enabled.`);
  }
});

// Note: sessionend is handled inside XRManager._setupXR → calls onExitXR → handleExitXR
// which already resets vrBtn text. Redundant listener removed (scene is undefined here).

// ── AR Study button (desktop shortcut) ───────────────────────
arStudyBtn?.addEventListener('click', async () => {
  try {
    await xrMgr.requestARSession(arOverlay);
    arOverlay?.classList.remove('hidden');
    // Wire AR overlay chat
    const arInput = document.getElementById('ar-chat-input');
    const arSend  = document.getElementById('ar-chat-send');
    const arSendFn = async () => {
      const t = arInput?.value.trim(); if (!t) return;
      if (arInput) arInput.value = '';
      const arMsgs = document.getElementById('ar-messages');
      if (arMsgs) { const d=document.createElement('div'); d.className='ar-msg user'; d.textContent=t; arMsgs.appendChild(d); arMsgs.scrollTop=arMsgs.scrollHeight; }
      const reply = await Agent.chat(t);
      if (arMsgs) { const d=document.createElement('div'); d.className='ar-msg ai'; d.textContent=reply; arMsgs.appendChild(d); arMsgs.scrollTop=arMsgs.scrollHeight; }
    };
    arSend?.addEventListener('click', arSendFn);
    arInput?.addEventListener('keydown', e => { if (e.key==='Enter') arSendFn(); });
  } catch (e) {
    alert(`AR Error: ${e.message}`);
  }
});

// ── Voice input ───────────────────────────────────────────────
voiceBtnEl?.addEventListener('click', () => {
  if (!VoiceInput.supported()) { Chat.systemMsg('Voice not supported on this browser / 该浏览器不支持语音'); return; }
  VoiceInput.toggle();
  voiceBtnEl.classList.toggle('active', VoiceInput.isListening());
});

function handleVoiceResult(text) {
  sendChat(text);
  if (!document.getElementById('chat-panel').classList.contains('visible')) Chat.open(activeZone);
  const input = document.getElementById('chat-input');
  if (input) input.value = text;
}

// ── Exit XR ───────────────────────────────────────────────────
function handleExitXR() {
  // Exit any VR room we might be in
  if (isInVRRoom) {
    vrRoomMgr.exitRoom();
    isInVRRoom = false;
  }
  
  if (vrHUD) { scene.playerGroup.remove(vrHUD); vrHUD = null; xrMgr.clearInteractables(); }
  if (vrBtn) vrBtn.textContent = '🥽 Enter VR';
  scene.showCinema(false);
  scene.showChatRoom(false);
}

// ── Zone hover ────────────────────────────────────────────────
function handleZoneHover(zone) {
  if (zone) {
    zoneTooltip.classList.remove('hidden');
    zoneTooltip.innerHTML = `<strong>${zone.emoji} ${zone.name}</strong> · ${zone.nameZh}<br><span>${zone.desc}</span><br><small>${zone.descZh}</small>`;
  } else {
    zoneTooltip.classList.add('hidden');
  }
}

function updateZoneIndicator(zone) {
  zoneIndicator.classList.remove('hidden');
  zoneIconEl.textContent = zone.emoji;
  zoneNameEl.textContent = `${zone.name} · ${zone.nameZh}`;
  // Show AR button only in study zone (if AR supported)
  if (arStudyBtn) arStudyBtn.style.display = (zone.id === 'study') ? '' : 'none';
}

// ── Nav buttons ───────────────────────────────────────────────
homeBtn?.addEventListener('click', goHome);

chatToggleBtn?.addEventListener('click', () => Chat.toggle(activeZone || ZONES[0]));

// ── Util ───────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Start ���─────────────────────────────────────────────────────
boot().catch(err => {
  console.error('[Boot]', err);
  if (loadingScreen) loadingScreen.innerHTML = `
    <div class="loading-content">
      <div style="font-size:2.5rem">⚠️</div>
      <h2 style="color:#f5edd8">Failed to load · 加载失败</h2>
      <p style="color:#e88;margin:.5rem 0">${err.message}</p>
      <p style="color:#888;font-size:.85rem">Use Chrome / Edge / Meta Quest Browser with internet connection.</p>
      <button onclick="location.reload()" style="margin-top:1rem;padding:.5rem 1.5rem;cursor:pointer;border-radius:8px">Reload 刷新</button>
    </div>`;
});
