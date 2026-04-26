// ============================================================
//  Campus Companion XR — Three.js Scene
//  First-person VR + Desktop orbit camera.
//  Circular hub + 5 radial zones + animated portals.
//  Zone sub-environments: VR cinema (leisure), AR study, etc.
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mountTripoModel } from './tripo-loader.js?v=20260426-3';
import { AICompanion }     from './ai-companion.js?v=20260426-3';

export class CampusScene {
  constructor(canvas) {
    this.canvas      = canvas;
    this.scene       = new THREE.Scene();
    this.camera      = null;
    this.renderer    = null;
    this.controls    = null;     // OrbitControls (desktop only)
    this.playerGroup = new THREE.Group(); // wraps camera for VR locomotion
    this.raycaster   = new THREE.Raycaster();
    this.mouse       = new THREE.Vector2();

    this.floorMesh    = null;   // exposed for XR teleport raycasting
    this.portalMeshes = [];     // exposed for XR portal raycasting (per-zone Groups)
    this.portalPlanes = [];     // animated inner planes
    this.labels       = [];     // billboard labels
    this.zoneRings    = [];
    this.clickables   = [];     // desktop click targets
    this.xrManager    = null;   // set by main.js after XR init

    // ── Hub companion (圆圆) ─────────────────────────────────
    // Spherical AI orb that lives in the central lobby. Replaces the
    // old humanoid avatar + gender picker: it greets the player,
    // tags along beside them, and announces what each zone does as
    // the player approaches its portal.
    this.hubCompanion       = null;
    this._hubActive         = false;
    this._hubGreetTimer     = null;
    this._hubChatterTimer   = null;
    this._hubLastSpokeAt    = 0;
    this._hubFollowOffset   = new THREE.Vector3(1.4, -0.45, 0.6);
    this._hubLastZoneSpoken = null;     // for proximity debounce
    this._hubLines          = null;     // populated in _initHubCompanionLines()

    // Leisure cinema assets
    this.cinemaGroup  = null;
    this.cinemaScreen = null;
    this.videoEl      = null;
    this.videoTex     = null;

    // Healing particles
    this.healingParticles = null;

    // Chat Room (VR enhanced) - now handled by VRRoomManager in main.js
    this.chatRoom = null;
    this.chatRoomActive = false;

    this.clock     = new THREE.Clock();
    this.activeZoneId = null;
    this.hoveredMesh  = null;

    this.gltfLoader = new GLTFLoader();

    // Callbacks
    this.onZoneClick  = null;
    this.onZoneHover  = null;
    this.onFrameUpdate = null; // Called every frame with (delta, isXR, camWorld)
  }

  // ── Init ──────────────────────────────────────────────────
  init() {
    this._initRenderer();
    this._initCamera();
    this._initLights();
    this._buildFloor();
    this._buildWallsAndCeiling();
    this._buildCenterDecor();
    this._buildZones();
    this._buildPortals();
    this._buildHubCompanion();
    this._buildCinemaRoom();
    this._buildHealingParticles();
    // Chat room is now built by VRRoomManager in main.js
    this._initDesktopControls();
    this._bindDesktopEvents();
    // Use setAnimationLoop (required for WebXR)
    this.renderer.setAnimationLoop((ts, frame) => this._onFrame(ts, frame));
  }

  // ── Renderer ──────────────────────────────────────────────
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setClearColor(0x120e0a);
    this.renderer.xr.enabled = true;  // ← WebXR
  }

  // ── Camera (inside playerGroup for VR locomotion) ─────────
  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);
    // In VR: XR system controls camera transform; playerGroup is the "body"
    // In desktop: OrbitControls moves camera directly
    this.playerGroup.add(this.camera);
    this.scene.add(this.playerGroup);

    // ── Spawn point (clear of the central fountain) ──────────
    // The fountain occupies a ~5m disc centred on (0,0,0); the inner
    // ring extends out to r=6.5. We arrive at z = +16, facing -Z so
    // the fountain + chandelier are framed dead ahead and the player
    // is well outside any portal trigger radius. xr.js consumes this
    // value on `sessionstart` to push the VR rig to the same spot.
    this.spawnPoint = new THREE.Vector3(0, 0, 16);

    // Desktop start — the camera is a child of playerGroup, but
    // OrbitControls operates in world space WITHOUT walking the
    // parent transform, so playerGroup MUST stay at the origin in
    // desktop mode or mouse-drag orbit math breaks. We therefore put
    // the camera at the spawn coordinates as its LOCAL position
    // (which equals world position while playerGroup is at origin).
    this.camera.position.set(this.spawnPoint.x, 6, this.spawnPoint.z);
    this.camera.lookAt(0, 1.5, 0);
    // VR rig stays at origin until WebXR session starts; xr.js then
    // moves it to this.spawnPoint on `sessionstart` so the headset
    // user also lands outside the fountain.
    this.playerGroup.position.set(0, 0, 0);
  }

  // ── Lights ────────────────────────────────────────────────
  // The hub now has only TWO ambient sources — a faint hemisphere fill
  // and a tiny key — and otherwise relies on (1) the chandelier bulb at
  // y ≈ 7.4 and (2) one coloured PointLight per portal. This makes the
  // five gateways visually "own" their light pool and gives the lobby a
  // dim, museum-like atmosphere.
  _initLights() {
    this.scene.add(new THREE.AmbientLight(0xfff0d8, 0.55));
    const fill = new THREE.DirectionalLight(0xffe8c8, 0.40);
    fill.position.set(8, 18, 8);
    this.scene.add(fill);
    this.scene.fog = new THREE.FogExp2(0x1a120a, 0.012);
  }

  // ── Floor ─────────────────────────────────────────────────
  // Outer ring: warm walnut parquet pattern, generated procedurally
  // so the floor isn't a flat colour. Inner circle: cream marble with
  // subtle grey veins. Plus a brass compass-rose torus on top.
  _buildFloor() {
    // Outer parquet
    const parquetTex = this._makeHubParquetTexture();
    parquetTex.wrapS = parquetTex.wrapT = THREE.RepeatWrapping;
    parquetTex.repeat.set(6, 6);
    parquetTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: parquetTex, roughness: 0.78, metalness: 0.05,
    });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 0.3, 72), mat);
    floor.position.y = -0.15; floor.receiveShadow = true;
    this.scene.add(floor);
    this.floorMesh = floor; // exposed for XR teleport

    // Inner marble disc
    const marbleTex = this._makeHubMarbleTexture();
    marbleTex.wrapS = marbleTex.wrapT = THREE.ClampToEdgeWrapping;
    marbleTex.colorSpace = THREE.SRGBColorSpace;
    const innerMat = new THREE.MeshStandardMaterial({
      map: marbleTex, roughness: 0.35, metalness: 0.12,
    });
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.32, 64), innerMat);
    inner.position.y = -0.14; this.scene.add(inner);

    // Compass rose ring
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xd4a84a, metalness: 0.6, roughness: 0.32 });
    const rose = new THREE.Mesh(new THREE.TorusGeometry(5, 0.12, 8, 64), ringMat);
    rose.rotation.x = Math.PI/2; rose.position.y = 0.02; this.scene.add(rose);
    // A second, finer brass ring inside the first for visual layering.
    const innerRose = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.06, 8, 64), ringMat);
    innerRose.rotation.x = Math.PI/2; innerRose.position.y = 0.02; this.scene.add(innerRose);
  }

  // Procedural walnut parquet texture for the hub outer floor.
  // Renders a herringbone grid of warm walnut planks with subtle
  // grain so the floor reads as wood, not flat brown.
  _makeHubParquetTexture() {
    const W = 512, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    const base = ctx.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, '#7a5230');
    base.addColorStop(1, '#5a3818');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    // Herringbone planks: 32x128 rectangles, alternating rotation.
    const plankW = 32, plankH = 128;
    ctx.save();
    for (let y = -plankH; y < H + plankH; y += plankH / 2) {
      for (let x = -plankH; x < W + plankH; x += plankH) {
        const offX = ((y / (plankH / 2)) | 0) % 2 === 0 ? 0 : plankH / 2;
        // Slight per-plank colour variation
        const shade = 0.85 + Math.random() * 0.25;
        ctx.fillStyle = `rgba(0,0,0,${(1 - shade) * 0.35})`;
        ctx.fillRect(x + offX, y, plankW, plankH);
        ctx.strokeStyle = 'rgba(255, 200, 150, 0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + offX + 0.5, y + 0.5, plankW - 1, plankH - 1);
        // Wood grain whispers within plank
        ctx.strokeStyle = 'rgba(255, 200, 130, 0.05)';
        for (let i = 0; i < 4; i++) {
          const gy = y + Math.random() * plankH;
          ctx.beginPath();
          ctx.moveTo(x + offX, gy);
          ctx.lineTo(x + offX + plankW, gy + (Math.random() - 0.5) * 3);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // Soft vignette for depth.
    const vg = ctx.createRadialGradient(W/2, H/2, W*0.2, W/2, H/2, W*0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // Procedural cream marble texture for the inner floor disc.
  _makeHubMarbleTexture() {
    const W = 1024, H = 1024;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // Creamy ivory base.
    ctx.fillStyle = '#f3e9d6';
    ctx.fillRect(0, 0, W, H);

    // Soft grey veins, drawn as a few smooth curves.
    ctx.strokeStyle = 'rgba(110, 90, 70, 0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      let x = Math.random() * W;
      let y = Math.random() * H;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (Math.random() - 0.5) * 220;
        y += (Math.random() - 0.5) * 220;
        ctx.quadraticCurveTo(
          x + (Math.random() - 0.5) * 80,
          y + (Math.random() - 0.5) * 80, x, y);
      }
      ctx.stroke();
    }
    // A few darker, finer veins
    ctx.strokeStyle = 'rgba(80, 60, 40, 0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      ctx.beginPath();
      let x = Math.random() * W;
      let y = Math.random() * H;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 150;
        y += (Math.random() - 0.5) * 150;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Gentle radial highlight in the centre to feel polished.
    const hi = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, W*0.55);
    hi.addColorStop(0, 'rgba(255, 248, 230, 0.55)');
    hi.addColorStop(1, 'rgba(255, 248, 230, 0)');
    ctx.fillStyle = hi;
    ctx.fillRect(0, 0, W, H);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ── Walls & Ceiling ───────────────────────────────────────
  // Walls: cream upper field with quiet damask + warm walnut wainscot
  // and a crown moulding. Ceiling: pale cream coffered dome with a
  // central rosette where the chandelier hangs from. Plus a torus
  // collar around the chandelier rod.
  _buildWallsAndCeiling() {
    // Wall texture
    const wallTex = this._makeHubWallTexture();
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.ClampToEdgeWrapping;
    wallTex.repeat.set(8, 1);
    wallTex.colorSpace = THREE.SRGBColorSpace;
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex, roughness: 0.85, metalness: 0.05, side: THREE.BackSide,
    });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 9, 72, 1, true), wallMat);
    wall.position.y = 4.5; this.scene.add(wall);

    // Ceiling rosette
    const ceilTex = this._makeHubCeilingTexture();
    ceilTex.colorSpace = THREE.SRGBColorSpace;
    const ceilMat = new THREE.MeshStandardMaterial({
      map: ceilTex, roughness: 0.88, metalness: 0.05,
    });
    const ceil = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 0.4, 72), ceilMat);
    ceil.position.y = 9.2; this.scene.add(ceil);

    // Brass chandelier collar + chains around the central rosette.
    const chandMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.18 });
    const chand = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 40), chandMat);
    chand.rotation.x = Math.PI/2; chand.position.y = 8.8; this.scene.add(chand);
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.4,6), chandMat);
      chain.position.set(Math.cos(a)*1.2, 8.5, Math.sin(a)*1.2); this.scene.add(chain);
    }
  }

  // Cream wall: walnut skirting + wainscot panels, gold chair-rail,
  // upper damask field, warm crown band. Renders to a wide texture
  // tiled around the cylinder so seams don't repeat too aggressively.
  _makeHubWallTexture() {
    const W = 1024, H = 768;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // Crown moulding band.
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(0, 0, W, H * 0.04);
    ctx.fillStyle = '#c8a25e';
    ctx.fillRect(0, H * 0.04, W, H * 0.012);

    // Upper cream field with gentle vertical gradient.
    const upper = ctx.createLinearGradient(0, H * 0.05, 0, H * 0.62);
    upper.addColorStop(0, '#f6ecd6');
    upper.addColorStop(1, '#e6d8b8');
    ctx.fillStyle = upper;
    ctx.fillRect(0, H * 0.05, W, H * 0.57);

    // Damask diamonds — soft warm taupe so the wall has rhythm.
    ctx.strokeStyle = 'rgba(150, 110, 70, 0.14)';
    ctx.lineWidth = 1.5;
    const dW = 168, dH = 96;
    for (let y = H * 0.07; y < H * 0.6; y += dH) {
      for (let x = -dW / 2; x < W + dW; x += dW) {
        const off = ((y / dH) | 0) % 2 === 0 ? 0 : dW / 2;
        ctx.beginPath();
        ctx.moveTo(x + off,            y + dH / 2);
        ctx.lineTo(x + off + dW / 2,   y);
        ctx.lineTo(x + off + dW,       y + dH / 2);
        ctx.lineTo(x + off + dW / 2,   y + dH);
        ctx.closePath();
        ctx.stroke();
        // Tiny rosette dot inside each diamond.
        ctx.fillStyle = 'rgba(180, 130, 70, 0.10)';
        ctx.beginPath();
        ctx.arc(x + off + dW / 2, y + dH / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Chair rail: dark + gold + dark.
    ctx.fillStyle = '#2a1810';
    ctx.fillRect(0, H * 0.62, W, H * 0.012);
    ctx.fillStyle = '#c8a25e';
    ctx.fillRect(0, H * 0.632, W, H * 0.014);
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(0, H * 0.646, W, H * 0.014);

    // Wainscot — warm walnut panels with vertical seams + frames.
    const wainscot = ctx.createLinearGradient(0, H * 0.66, 0, H * 0.97);
    wainscot.addColorStop(0, '#5a3a20');
    wainscot.addColorStop(1, '#36200e');
    ctx.fillStyle = wainscot;
    ctx.fillRect(0, H * 0.66, W, H * 0.31);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 2;
    const panels = 8;
    const pad = 18;
    for (let i = 0; i < panels; i++) {
      const px = i * (W / panels) + pad;
      const pw = W / panels - pad * 2;
      ctx.strokeRect(px, H * 0.685, pw, H * 0.27);
    }
    // Panel highlight bevel
    ctx.strokeStyle = 'rgba(255, 220, 170, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i < panels; i++) {
      const px = i * (W / panels) + pad + 4;
      const pw = W / panels - pad * 2 - 8;
      ctx.strokeRect(px, H * 0.685 + 4, pw, H * 0.27 - 8);
    }
    // Walnut grain whispers
    ctx.strokeStyle = 'rgba(255, 220, 170, 0.05)';
    for (let i = 0; i < 80; i++) {
      const y = H * 0.66 + Math.random() * H * 0.31;
      const x = Math.random() * W;
      const len = 60 + Math.random() * 200;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }

    // Skirting board.
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(0, H * 0.97, W, H * 0.03);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // Pale cream coffered dome with a central gold rosette where the
  // chandelier rod attaches. UV-mapped to the cylinder cap so the
  // rosette ends up centred above the lobby.
  _makeHubCeilingTexture() {
    const W = 1024, H = 1024;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // Soft warm cream base, slightly brighter at centre.
    const base = ctx.createRadialGradient(W/2, H/2, 30, W/2, H/2, W*0.6);
    base.addColorStop(0, '#fbf5e4');
    base.addColorStop(1, '#e8dcc0');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    // Concentric brass rings — three of them — for a layered dome.
    ctx.strokeStyle = '#c8a25e';
    ctx.lineWidth = 4;
    for (const r of [W * 0.18, W * 0.30, W * 0.42]) {
      ctx.beginPath();
      ctx.arc(W/2, H/2, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Coffered grid only in the OUTER ring so the central area stays
    // clean for the rosette.
    ctx.strokeStyle = 'rgba(120, 90, 60, 0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(W/2 + Math.cos(a) * W * 0.42, H/2 + Math.sin(a) * H * 0.42);
      ctx.lineTo(W/2 + Math.cos(a) * W * 0.49, H/2 + Math.sin(a) * H * 0.49);
      ctx.stroke();
    }

    // Central rosette: gold concentric flower with petal arcs.
    ctx.fillStyle = '#d8b25e';
    ctx.beginPath(); ctx.arc(W/2, H/2, W * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a87830';
    ctx.beginPath(); ctx.arc(W/2, H/2, W * 0.025, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8a25e';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x1 = W/2 + Math.cos(a) * W * 0.05;
      const y1 = H/2 + Math.sin(a) * H * 0.05;
      const x2 = W/2 + Math.cos(a) * W * 0.10;
      const y2 = H/2 + Math.sin(a) * H * 0.10;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ── Central fountain ──────────────────────────────────────
  // Tripo-generated marble fountain at the hub centre, ringed by an
  // alternating set of marble flower urns and amber-shaded floor
  // lamps for a warm hotel-lobby feel. A pulsing top light remains
  // regardless of whether GLBs have loaded so the room is always lit.
  _buildCenterDecor() {
    const fountain = new THREE.Group();
    this.scene.add(fountain);
    this.fountain = fountain;

    // Pulsing top light kept by `_animateFountain` for the warm breathing glow.
    const orbLight = new THREE.PointLight(0xffd9a0, 1.2, 9, 2.0);
    orbLight.position.set(0, 3.0, 0);
    fountain.add(orbLight);
    this.fountainLight = orbLight;

    // Tripo-generated baroque marble fountain — the centerpiece of the hub.
    mountTripoModel(fountain, 'fountain',
      { position: [0, 0, 0], targetSize: 5.0, yAlign: 'bottom' }
    );

    // Eight evenly-spaced ring slots: alternate marble urn vase and
    // an art-deco floor lamp. Each lamp carries a small warm point
    // light so the lobby gets a halo of soft amber light at floor
    // level — much cosier than the previous flat-lit ring of plants.
    const RING_R = 5.6;
    for (let i = 0; i < 8; i++) {
      const a  = (i / 8) * Math.PI * 2 + Math.PI / 8; // offset so neither
                                                     // urn nor lamp lines up
                                                     // with a portal axis
      const x  = Math.cos(a) * RING_R;
      const z  = Math.sin(a) * RING_R;
      const facing = a + Math.PI;     // face inward toward fountain
      if (i % 2 === 0) {
        mountTripoModel(this.scene, 'marble_urn_vase', {
          position: [x, 0, z], rotationY: facing,
          targetSize: 1.4, yAlign: 'bottom',
        });
      } else {
        mountTripoModel(this.scene, 'art_deco_floor_lamp', {
          position: [x, 0, z], rotationY: facing,
          targetSize: 1.9, yAlign: 'bottom',
        });
        // Warm bulb glow tucked at lamp-shade height.
        const bulb = new THREE.PointLight(0xffc880, 0.9, 6.5, 1.7);
        bulb.position.set(x, 1.6, z);
        this.scene.add(bulb);
      }
    }

    this._buildCenterChandelier();
  }

  // ── Center ceiling chandelier ─────────────────────────────
  // Suspension rod + Tripo-generated chandelier + warm down-light.
  _buildCenterChandelier() {
    const ceilingY = 9.2;
    const rodLen   = 1.6;
    const lampY    = ceilingY - rodLen;

    const group = new THREE.Group();
    this.scene.add(group);

    // Thin metal suspension rod
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.4, metalness: 0.7 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, rodLen, 8), rodMat);
    rod.position.set(0, lampY + rodLen / 2, 0);
    group.add(rod);

    // Warm down-light positioned exactly at the chandelier's bulb core
    // (yAlign:'center' centres the GLB on lampY, so the bulb cluster sits
    // a touch below centre). Cast shadows so the rod and the fountain
    // edges below it pick up real chandelier-shaped silhouettes.
    const lamp = new THREE.PointLight(0xFFE6B4, 5.0, 48, 1.2);
    lamp.position.set(0, lampY - 0.25, 0);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(512, 512);
    group.add(lamp);
    this.chandelierLamp = lamp;

    // Tripo-generated chandelier mounted at the bottom of the rod.
    mountTripoModel(group, 'chandelier',
      { position: [0, lampY, 0], targetSize: 1.6, yAlign: 'center' }
    );
  }

  // ── Zones (platforms, labels, furniture) ──────────────────
  _buildZones() {
    ZONES.forEach((zone, idx) => {
      const a = zone.angle * Math.PI / 180;
      const r = 13;
      const x = Math.cos(a)*r, z = Math.sin(a)*r;

      this._buildPath(a, r);

      // Platform
      const platMat = new THREE.MeshStandardMaterial({
        color: zone.color, roughness: 0.72, metalness: 0.08,
        emissive: zone.color, emissiveIntensity: 0.12,
      });
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.8,3.8,0.22,36), platMat);
      plat.position.set(x, 0.11, z); plat.receiveShadow = true;
      plat.userData = { isZone: true, zoneId: zone.id, zoneIdx: idx };
      this.scene.add(plat);
      this.clickables.push(plat);

      // Glow ring
      const ringMat = new THREE.MeshStandardMaterial({
        color: zone.color, emissive: zone.color, emissiveIntensity: 0.55,
        transparent: true, opacity: 0.85,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.8,0.09,8,48), ringMat);
      ring.rotation.x = Math.PI/2; ring.position.set(x, 0.25, z);
      this.scene.add(ring);
      this.zoneRings.push({ ring, zoneId: zone.id });

      // Label
      const label = this._makeZoneLabel(zone);
      label.position.set(x, 4, z);
      this.scene.add(label);
      this.labels.push(label);

      // Furniture
      const fur = new THREE.Group();
      fur.position.set(x, 0, z);
      fur.rotation.y = -a + Math.PI;
      this._buildFurniture(zone.id, fur);
      this.scene.add(fur);
    });
  }

  _buildPath(angle, zoneRadius) {
    const len = zoneRadius - 7;
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x8c7050, roughness: 0.95 });
    const path = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, len), pathMat);
    path.position.set(Math.cos(angle)*(7+len/2), 0.02, Math.sin(angle)*(7+len/2));
    path.rotation.y = -angle;
    this.scene.add(path);
  }

  // ── Portals ──────�������────────────────────────────────────────
  _buildPortals() {
    this.portalAnims = []; // collected per-portal animated bits
    ZONES.forEach(zone => {
      const a = zone.angle * Math.PI / 180;
      const r = 9; // midway between center and zone
      const x = Math.cos(a)*r, z = Math.sin(a)*r;

      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = -a + Math.PI;
      g.userData.zone = zone; // for XR raycasting

      // Shared materials
      const stoneLight = new THREE.MeshStandardMaterial({ color: 0xd4c4a8, roughness: 0.85 });
      const stoneDark  = new THREE.MeshStandardMaterial({ color: 0xa89478, roughness: 0.9 });
      const goldTrim   = new THREE.MeshStandardMaterial({ color: 0xc8a25e, roughness: 0.35, metalness: 0.65 });
      const glowMat    = new THREE.MeshStandardMaterial({
        color: zone.color, emissive: zone.color, emissiveIntensity: 1.2,
        metalness: 0.4, roughness: 0.3,
      });

      // Two-tier circular plinth (gate stands centred on it — no orientation issues)
      const plinthLow = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.6, 0.18, 24), stoneDark);
      plinthLow.position.y = 0.09; g.add(plinthLow);
      const plinthMid = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.42, 0.16, 24), stoneLight);
      plinthMid.position.y = 0.26; g.add(plinthMid);
      const plinthRim = new THREE.Mesh(new THREE.TorusGeometry(2.34, 0.04, 10, 48), goldTrim);
      plinthRim.rotation.x = Math.PI/2; plinthRim.position.y = 0.34; g.add(plinthRim);

      // Two side pillars flanking the gate (in the gate plane, z=0)
      const buildPillar = (sx) => {
        const pg = new THREE.Group();
        const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.55), stoneDark);
        pBase.position.set(sx, 0.45, 0); pg.add(pBase);
        const pShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.3, 12), stoneLight);
        pShaft.position.set(sx, 2.21, 0); pg.add(pShaft);
        for (let i = 0; i < 3; i++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 22), goldTrim);
          ring.rotation.x = Math.PI/2;
          ring.position.set(sx, 0.85 + i*1.3, 0);
          pg.add(ring);
        }
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.55), stoneLight);
        cap.position.set(sx, 3.95, 0); pg.add(cap);
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), glowMat.clone());
        crystal.position.set(sx, 4.22, 0);
        pg.add(crystal);
        return { pg, crystal };
      };
      const left  = buildPillar(-2.15);
      const right = buildPillar( 2.15);
      g.add(left.pg, right.pg);

      // Horizontal lintel beam connecting the pillar tops (replaces the buggy arch
      // that previously rotated through the gate centre).
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.22, 0.4), stoneLight);
      lintel.position.y = 4.05; g.add(lintel);
      const lintelTrim = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.04, 0.42), goldTrim);
      lintelTrim.position.y = 3.93; g.add(lintelTrim);
      // Centre keystone gem on the lintel front face — well above the gate ring.
      const keyGem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), glowMat.clone());
      keyGem.position.set(0, 4.05, 0.22); g.add(keyGem);

      // Outer gold ring (slightly larger so studs can sit between the two rings
      // without intersecting either) + inner colored ring.
      const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.05, 0.07, 14, 64),
        new THREE.MeshStandardMaterial({
          color: 0xc8a25e, metalness: 0.7, roughness: 0.3,
          emissive: 0x4a3618, emissiveIntensity: 0.25
        })
      );
      outerRing.position.y = 2.0;
      outerRing.userData.zone = zone;
      g.add(outerRing);

      const torusMat = new THREE.MeshStandardMaterial({
        color: zone.color, emissive: zone.color, emissiveIntensity: 0.55,
        metalness: 0.55, roughness: 0.28,
      });
      // Inner ring made thinner so studs don't visually fuse with it.
      const torus = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.08, 20, 72), torusMat);
      torus.position.y = 2.0;
      torus.userData.zone = zone;
      g.add(torus);

      // Six rune studs in the gap BETWEEN the inner (1.85±0.08) and outer
      // (2.05±0.07) rings, slightly forward (z>0) so they read as raised
      // jewels on the gate face without intersecting either torus.
      const studs = [];
      for (let i = 0; i < 6; i++) {
        const ang = (i/6)*Math.PI*2;
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), glowMat.clone());
        stud.position.set(Math.cos(ang)*1.97, 2.0 + Math.sin(ang)*1.97, 0.13);
        stud.userData.studPhase = i / 6;
        g.add(stud);
        studs.push(stud);
      }

      // Animated portal plane (primary click target)
      const tex = this._createPortalTexture(zone);
      const planeMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
      const plane = new THREE.Mesh(new THREE.CircleGeometry(1.78, 64), planeMat);
      plane.position.y = 2.0;
      plane.userData.zone = zone;
      g.add(plane);
      this.portalPlanes.push({ plane, tex, zone });

      // Info label sits just above the lintel
      const infoLabel = this._makePortalLabel(zone);
      infoLabel.position.y = 4.7;
      g.add(infoLabel);
      this.labels.push(infoLabel);

      // Energy motes drift IN FRONT of the gate only (z>0), inside a soft
      // bounding box so they don't pierce the pillars or fly behind the gate.
      const motes = [];
      const moteMatBase = new THREE.MeshBasicMaterial({
        color: zone.color, transparent: true, opacity: 0.85, depthWrite: false
      });
      for (let i = 0; i < 10; i++) {
        const mote = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), moteMatBase.clone());
        mote.userData.phase  = (i/10) * Math.PI*2;
        mote.userData.xAmp   = 1.4 + Math.random()*0.3;     // horizontal drift inside pillars
        mote.userData.yBase  = 1.4 + Math.random()*1.4;     // 1.4..2.8m, in front of the gate
        mote.userData.yAmp   = 0.25 + Math.random()*0.25;
        mote.userData.zBase  = 0.55 + Math.random()*0.45;   // 0.55..1.0m forward
        mote.userData.speed  = 0.35 + Math.random()*0.35;
        g.add(mote);
        motes.push(mote);
      }

      // Foot dots arranged as a tight ring on TOP of the plinth (radius 1.95
      // keeps them well inside the 2.25m plinth top, no clipping with the
      // plinth rim or pillar bases).
      const footDots = [];
      for (let i = 0; i < 8; i++) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 6),
          new THREE.MeshStandardMaterial({ color: zone.color, emissive: zone.color, emissiveIntensity: 1.8 }),
        );
        const ang = (i/8) * Math.PI*2;
        dot.position.set(Math.cos(ang)*1.95, 0.42, Math.sin(ang)*1.95);
        dot.userData.basey = 0.42;
        dot.userData.phase = ang;
        g.add(dot);
        footDots.push(dot);
      }

      // Coloured PointLight pushed forward of the gate. With the central
      // ceiling lamp now the only other warm source, each portal owns
      // its own pool of zone-coloured light on the floor and fountain
      // base — a clear visual cue from across the dim lobby.
      const portalLight = new THREE.PointLight(zone.color, 2.0, 14, 1.7);
      portalLight.position.set(0, 2.2, 0.8);
      g.add(portalLight);

      // A second, low-strength back-glow behind the lintel that paints
      // colour onto the curved hub wall so the gateway "haloes" outward.
      const portalHalo = new THREE.PointLight(zone.color, 0.9, 8, 1.8);
      portalHalo.position.set(0, 3.6, -0.4);
      g.add(portalHalo);

      this.scene.add(g);
      this.portalMeshes.push(g);   // XR raycasts against these
      this.clickables.push(plane); // desktop click
      plane.userData = { isPortal: true, zone };

      this.portalAnims.push({
        torus, outerRing, studs, motes, footDots,
        leftCrystal: left.crystal, rightCrystal: right.crystal,
        keyGem, portalLight, portalHalo, color: zone.color
      });
    });
  }

  _createPortalTexture(zone) {
    const s = 256;
    const canvas = document.createElement('canvas');
    canvas.width = s; canvas.height = s;
    const tex = new THREE.CanvasTexture(canvas);
    const col = `#${zone.color.toString(16).padStart(6,'0')}`;
    tex._canvas = canvas;
    tex._ctx = canvas.getContext('2d');
    tex._col = col;
    tex._t = 0;
    this._drawPortalFrame(tex, 0);
    return tex;
  }

  _drawPortalFrame(tex, t) {
    const ctx = tex._ctx, s = 256, cx = s/2, cy = s/2, col = tex._col;
    ctx.clearRect(0, 0, s, s);
    // Radial glow
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
    grd.addColorStop(0,   col + 'cc');
    grd.addColorStop(0.45, col + '66');
    grd.addColorStop(1,   col + '00');
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, 122, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    // Spinning arcs
    for (let i = 0; i < 6; i++) {
      const speed = i % 2 === 0 ? 0.6 : -0.45;
      const angle = t * speed + (i/6)*Math.PI*2;
      const r = 28 + i*16;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.55 - i*0.06;
      ctx.lineWidth = 3.5 - i*0.3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI*(1.3 + Math.sin(t*0.3+i)*0.4));
      ctx.stroke(); ctx.restore();
    }
    // Star sparkles
    for (let i = 0; i < 4; i++) {
      const sa = t*1.2 + (i/4)*Math.PI*2;
      const sr = 50 + Math.sin(t+i)*25;
      ctx.beginPath();
      ctx.arc(cx+Math.cos(sa)*sr, cy+Math.sin(sa)*sr, 3.5, 0, Math.PI*2);
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.7+Math.sin(t*2+i)*0.3;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    tex.needsUpdate = true;
  }

  // ── VR Cinema Room (Leisure Zone) ─────────────────────────
  _buildCinemaRoom() {
    const g = new THREE.Group();
    g.visible = false; // shown only when entering leisure VR
    g.name = 'cinemaRoom';

    const a = ZONES.find(z => z.id === 'leisure').angle * Math.PI / 180;
    const r = 13;
    g.position.set(Math.cos(a)*r, 0, Math.sin(a)*r);

    // Dark walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1010, roughness: 0.95, side: THREE.BackSide });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 6, 32, 1, true), wallMat);
    wall.position.y = 3; g.add(wall);

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a1818, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.1, 32), floorMat);
    floor.position.y = 0.05; g.add(floor);

    // Cinema screen (large plane)
    const screenGeo = new THREE.PlaneGeometry(6, 3.5);
    // Try to use a video texture
    const { videoEl, videoTex } = this._createVideoTexture();
    this.videoEl = videoEl; this.videoTex = videoTex;
    const screenMat = new THREE.MeshBasicMaterial({
      map: videoTex || this._makeCinemaPlaceholderTex(),
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 2.8, -5.8);
    g.add(screen);
    this.cinemaScreen = screen;

    // Screen glow
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x4488cc, emissive: 0x224466, emissiveIntensity: 0.5, transparent: true, opacity: 0.15 });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.9), glowMat);
    glow.position.set(0, 2.8, -5.79); g.add(glow);

    // Screen frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.4 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(6.3, 3.7, 0.08), frameMat);
    frame.position.set(0, 2.8, -5.85); g.add(frame);

    // Cinema seats (3 rows)
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x8b2020, roughness: 0.85 });
    const legMat  = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
    for (let row = 0; row < 2; row++) {
      for (let col = -2; col <= 2; col++) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.55), seatMat);
        seat.position.set(col*0.75, 0.45 + row*0.3, -2 - row*0.6);
        g.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.08), seatMat);
        back.position.set(col*0.75, 0.8+row*0.3, -2.27-row*0.6);
        g.add(back);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.45,6), legMat);
        leg.position.set(col*0.75, 0.22+row*0.3, -2-row*0.6);
        g.add(leg);
      }
    }

    // Ambient cinema light (dim blue)
    const cineLight = new THREE.PointLight(0x2244aa, 1.5, 15);
    cineLight.position.set(0, 5, 0); g.add(cineLight);
    // Screen bounce light
    const screenLight = new THREE.PointLight(0x88aacc, 1.0, 12);
    screenLight.position.set(0, 2.8, -4); g.add(screenLight);

    this.scene.add(g);
    this.cinemaGroup = g;
  }

  _createVideoTexture() {
    const videoEl = document.createElement('video');
    videoEl.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    videoEl.crossOrigin = 'anonymous';
    videoEl.loop = true;
    videoEl.muted = true; // must be muted for autoplay
    videoEl.playsInline = true;
    videoEl.preload = 'auto';

    let videoTex = null;
    videoEl.addEventListener('canplay', () => {
      videoTex = new THREE.VideoTexture(videoEl);
      videoTex.minFilter = THREE.LinearFilter;
      if (this.cinemaScreen) this.cinemaScreen.material.map = videoTex;
    }, { once: true });

    return { videoEl, videoTex: null };
  }

  _makeCinemaPlaceholderTex() {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 360;
    const ctx = c.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 640, 360);
    grd.addColorStop(0, '#0a1528');
    grd.addColorStop(1, '#1a2a48');
    ctx.fillStyle = grd; ctx.fillRect(0,0,640,360);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(Math.random()*640, Math.random()*360, Math.random()*2, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center';
    ctx.fillText('🎬  Loading video…', 320, 170);
    ctx.font = '20px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('Big Buck Bunny · Open Source Cinema', 320, 210);
    return new THREE.CanvasTexture(c);
  }

  playVideo() {
    this.videoEl?.play().catch(() => {});
  }

  pauseVideo() {
    this.videoEl?.pause();
  }

  showCinema(show) {
    if (this.cinemaGroup) this.cinemaGroup.visible = show;
    if (show) this.playVideo();
    else this.pauseVideo();
  }

  // ── Healing Particles ─────────────────────────────────────
  _buildHealingParticles() {
    const zone = ZONES.find(z => z.id === 'healing');
    if (!zone) return;
    const a = zone.angle * Math.PI / 180;
    const count = 120;
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    const cx = Math.cos(a)*13, cz = Math.sin(a)*13;
    for (let i = 0; i < count; i++) {
      const r = Math.random()*3.5;
      const pa = Math.random()*Math.PI*2;
      positions[i*3]   = cx + Math.cos(pa)*r;
      positions[i*3+1] = Math.random()*4;
      positions[i*3+2] = cz + Math.sin(pa)*r;
      colors[i*3]   = 0.6 + Math.random()*0.4;
      colors[i*3+1] = 0.8 + Math.random()*0.2;
      colors[i*3+2] = 0.6 + Math.random()*0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.75 });
    this.healingParticles = new THREE.Points(geo, mat);
    this.healingParticles._basePositions = positions.slice();
    this.scene.add(this.healingParticles);
  }

  // ── Chat Room (VR Enhanced for ���心区) ─────────────────────
  // NOTE: Chat room is now handled by VRRoomManager in main.js
  // These methods are kept for backward compatibility but are no-ops
  
  showChatRoom(show) {
    // Now handled by VRRoomManager
    this.chatRoomActive = show;
  }

  getChatRoomCompanion() {
    return null; // Now handled by VRRoomManager
  }

  onStudentMessage(message) {
    // Now handled by VRRoomManager
  }

  onAIStartResponse() {
    // Now handled by VRRoomManager
  }

  onAIEndResponse() {
    // Now handled by VRRoomManager
  }

  updateStudentPosition(position) {
    // Now handled by VRRoomManager
  }

  // ── Furniture (same as before, condensed) ─────────────────
  _buildFurniture(zoneId, g) {
    switch (zoneId) {
      case 'chat':    this._furChat(g);    break;
      case 'study':   this._furStudy(g);   break;
      case 'leisure': this._furLeisure(g); break;
      case 'healing': this._furHealing(g); break;
      case 'games':   this._furGames(g);   break;
    }
  }

  // Each zone platform shows a single Tripo-generated diorama placed near its
  // back edge so the player approaches it through the portal-facing front.
  _furChat(g) {
    mountTripoModel(g, 'zone_chat',
      { position: [0, 0, -1.6], targetSize: 3.2, yAlign: 'bottom' });
  }
  _furStudy(g) {
    mountTripoModel(g, 'zone_study',
      { position: [0, 0, -1.6], targetSize: 3.4, yAlign: 'bottom' });
  }
  _furLeisure(g) {
    mountTripoModel(g, 'zone_leisure',
      { position: [0, 0, -1.6], targetSize: 3.2, yAlign: 'bottom' });
  }
  _furHealing(g) {
    mountTripoModel(g, 'zone_healing',
      { position: [0, 0, -1.6], targetSize: 3.0, yAlign: 'bottom' });
  }
  _furGames(g) {
    mountTripoModel(g, 'zone_games',
      { position: [0, 0, -1.6], targetSize: 3.0, yAlign: 'bottom' });
  }

  // ── Zone labels ───────────────────────────────────────────
  // Two label variants:
  //   _makeZoneLabel  — large floating placard above each zone's
  //                     furniture cluster (3.2 × 1.4 m plane)
  //   _makePortalLabel — slim banner mounted on the portal lintel
  //                      (3.4 × 0.8 m plane)
  //
  // Both share a single "elegant lobby plaque" visual language: a
  // warm cream card with gradient depth, a thin gold pinstripe, a
  // circular medallion holding the zone's emoji tinted with the
  // zone's signature colour, and well-spaced serif/sans bilingual
  // typography. Drawn at 2× pixel density so the type stays crisp
  // when seen from across the lobby or right at the gate in VR.
  _makeZoneLabel(zone) {
    const W = 1280, H = 560;                       // 2× the 3.2:1.4 plane
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    const accent = this._zoneCss(zone.color);
    const accentSoft = this._zoneCss(zone.color, 0.18);

    // Drop-shadow halo behind the card for depth.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
    this._rrect(ctx, 28, 38, W - 56, H - 56, 56); ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // reset

    // Card body: warm cream → soft amber gradient.
    const cardX = 24, cardY = 24, cardW = W - 48, cardH = H - 48;
    const grad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    grad.addColorStop(0, '#fff8ea');
    grad.addColorStop(1, '#f3e3c2');
    ctx.fillStyle = grad;
    this._rrect(ctx, cardX, cardY, cardW, cardH, 48); ctx.fill();

    // Inner soft accent wash on the left so the card isn't monotone.
    const wash = ctx.createLinearGradient(cardX, 0, cardX + cardW * 0.55, 0);
    wash.addColorStop(0, accentSoft);
    wash.addColorStop(1, 'rgba(255, 248, 234, 0)');
    ctx.fillStyle = wash;
    this._rrect(ctx, cardX, cardY, cardW, cardH, 48); ctx.fill();

    // Double pinstripe — outer dark bronze, inner gold.
    ctx.strokeStyle = 'rgba(60, 36, 18, 0.55)'; ctx.lineWidth = 4;
    this._rrect(ctx, cardX, cardY, cardW, cardH, 48); ctx.stroke();
    ctx.strokeStyle = 'rgba(196, 154, 80, 0.95)'; ctx.lineWidth = 2;
    this._rrect(ctx, cardX + 10, cardY + 10, cardW - 20, cardH - 20, 40); ctx.stroke();

    // Accent stripe down the left edge, in zone colour.
    ctx.fillStyle = accent;
    this._rrect(ctx, cardX + 18, cardY + 30, 8, cardH - 60, 4); ctx.fill();

    // Emoji medallion — circle filled with zone-tinted glaze.
    const medX = cardX + 110, medY = H / 2, medR = 78;
    const mGrad = ctx.createRadialGradient(medX - 12, medY - 18, 6, medX, medY, medR);
    mGrad.addColorStop(0, '#ffffff');
    mGrad.addColorStop(0.55, accentSoft);
    mGrad.addColorStop(1, accent);
    ctx.fillStyle = mGrad;
    ctx.beginPath(); ctx.arc(medX, medY, medR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(196, 154, 80, 0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(medX, medY, medR, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '90px "Segoe UI Emoji", Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(zone.emoji, medX, medY + 4);

    // Text column starts after the medallion.
    const textX = medX + medR + 50;
    const textRight = cardX + cardW - 50;
    const textW = textRight - textX;
    ctx.textAlign = 'left';

    // English headline — serif, deep walnut.
    ctx.fillStyle = '#3a2010';
    ctx.font = '700 76px "Georgia", "Times New Roman", serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(zone.name, textX, cardY + 170, textW);

    // Chinese sub-headline — clean sans, warm walnut.
    ctx.fillStyle = '#6e4a26';
    ctx.font = '500 52px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(zone.nameZh, textX, cardY + 250, textW);

    // CTA pill — small rounded chip with the zone accent + small dot.
    const pillY = cardY + 320;
    const pillH = 60;
    const pillText = 'Click to enter · 点击进入';
    ctx.font = '500 30px "Inter", "Helvetica Neue", Arial, sans-serif';
    const pillW = ctx.measureText(pillText).width + 90;
    ctx.fillStyle = accent;
    this._rrect(ctx, textX, pillY, pillW, pillH, pillH / 2); ctx.fill();
    // Tiny pulsing dot (static here, but visually communicates "live").
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(textX + 28, pillY + pillH / 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, textX + 56, pillY + pillH / 2 + 2);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), mat);
  }

  _makePortalLabel(zone) {
    const W = 1360, H = 320;                       // 2× the 3.4:0.8 plane
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    const accent = this._zoneCss(zone.color);
    const accentSoft = this._zoneCss(zone.color, 0.20);

    // Soft drop-shadow halo for floating effect.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    this._rrect(ctx, 22, 30, W - 44, H - 44, 56); ctx.fill();

    // Banner body: warm cream with a horizontal accent gradient.
    const cardX = 16, cardY = 16, cardW = W - 32, cardH = H - 32;
    const bodyGrad = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
    bodyGrad.addColorStop(0, accentSoft);
    bodyGrad.addColorStop(0.45, '#fff5dc');
    bodyGrad.addColorStop(1, accentSoft);
    ctx.fillStyle = bodyGrad;
    this._rrect(ctx, cardX, cardY, cardW, cardH, 50); ctx.fill();

    // Pinstripes: outer bronze, inner gold.
    ctx.strokeStyle = 'rgba(60, 36, 18, 0.55)'; ctx.lineWidth = 4;
    this._rrect(ctx, cardX, cardY, cardW, cardH, 50); ctx.stroke();
    ctx.strokeStyle = 'rgba(196, 154, 80, 0.95)'; ctx.lineWidth = 2;
    this._rrect(ctx, cardX + 10, cardY + 10, cardW - 20, cardH - 20, 42); ctx.stroke();

    // Tiny ornaments at the two ends of the banner.
    const drawOrnament = (cx) => {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, H / 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(196, 154, 80, 0.9)';
      ctx.beginPath();
      ctx.arc(cx + 20, H / 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - 20, H / 2, 3, 0, Math.PI * 2); ctx.fill();
    };
    drawOrnament(cardX + 60);
    drawOrnament(cardX + cardW - 60);

    // Title — emoji medallion + EN + ZH centred together.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3a2010';
    ctx.font = '700 80px "Georgia", "Times New Roman", serif';
    const en = zone.name;
    const zh = zone.nameZh;
    const sep = '  ·  ';
    const enW = ctx.measureText(en).width;
    ctx.font = '500 64px "PingFang SC", "Microsoft YaHei", sans-serif';
    const zhW = ctx.measureText(zh).width;
    ctx.font = '500 64px "Inter", Arial';
    const sepW = ctx.measureText(sep).width;
    ctx.font = '90px "Segoe UI Emoji", Arial';
    const emojiW = ctx.measureText(zone.emoji).width;

    const totalW = emojiW + 36 + enW + sepW + zhW;
    let cursor = (W - totalW) / 2;
    const cy = H / 2 + 4;

    // Emoji
    ctx.font = '90px "Segoe UI Emoji", Arial';
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.fillText(zone.emoji, cursor, cy);
    cursor += emojiW + 36;

    // English in serif
    ctx.font = '700 80px "Georgia", "Times New Roman", serif';
    ctx.fillStyle = '#3a2010';
    ctx.fillText(en, cursor, cy);
    cursor += enW;

    // Decorative separator
    ctx.font = '500 64px "Inter", Arial';
    ctx.fillStyle = 'rgba(196, 154, 80, 0.95)';
    ctx.fillText(sep, cursor, cy);
    cursor += sepW;

    // Chinese in clean sans
    ctx.font = '500 64px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#6e4a26';
    ctx.fillText(zh, cursor, cy);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), mat);
  }

  // Format a zone color (numeric 0xRRGGBB) as a CSS rgb/rgba string.
  // The optional alpha lets callers reuse the same value for semi-
  // transparent washes / gradients without repeating the byte math.
  _zoneCss(colorInt, alpha) {
    const r = (colorInt >> 16) & 0xff;
    const g = (colorInt >> 8) & 0xff;
    const b = colorInt & 0xff;
    return alpha === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
  }

  _rrect(ctx,x,y,w,h,r) {
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  _makePortalLabel(zone) {
    // Same 3.4:0.8 aspect, larger canvas + maxWidth so long combined names fit.
    const w=680,h=160,c=document.createElement('canvas'); c.width=w; c.height=h;
    const ctx=c.getContext('2d');
    const pad=28;
    ctx.fillStyle=`rgba(${(zone.color>>16)&0xff},${(zone.color>>8)&0xff},${zone.color&0xff},0.15)`;
    this._rrect(ctx,12,12,w-24,h-24,28); ctx.fill();
    ctx.strokeStyle=`#${zone.color.toString(16).padStart(6,'0')}99`; ctx.lineWidth=5; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='bold 56px "Segoe UI Emoji",Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`${zone.emoji}  ${zone.name}  ·  ${zone.nameZh}`, w/2, h/2, w-pad*2);
    const tex=new THREE.CanvasTexture(c); tex.anisotropy=4;
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide});
    return new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.8),mat);
  }

  _rrect(ctx,x,y,w,h,r) {
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  // ── Hub companion (圆圆) ──────────────────────────────────
  // Single AICompanion orb that lives in the central lobby. It is
  // shared across desktop and VR — `enterHub`/`exitHub` toggle its
  // chatter loop and `updateHubCompanion` is called every frame
  // while the player is in the hub (i.e. NOT inside an immersive
  // zone room). Behaviour mirrors the room companions: smooth
  // side-by-side follow, scheduled idle chatter, proximity-aware
  // zone introductions, and bilingual speech bubbles.
  _buildHubCompanion() {
    // Warm gold so the orb stands apart from the per-zone companions
    // (coral chat, blue games, lavender leisure, etc.).
    this.hubCompanion = new AICompanion(this.scene, {
      position: new THREE.Vector3(2.2, 1.55, 6.0), // off-centre near entrance
      color: 0xF0C870,
      scale: 0.85,
      followSpeed: 1.6,
    });
    this._initHubCompanionLines();
  }

  _initHubCompanionLines() {
    // Friendly, slightly playful guide. Bilingual lines so the speech
    // bubble reads naturally for either audience. Per-zone "approach"
    // arrays are keyed by zone id and randomised so revisits don't
    // feel canned.
    this._hubLines = {
      greet: [
        '嘿，欢迎来到 Campus Companion！\nI\'m 圆圆 — your guide. 想去哪个区，我都陪你。',
        '你好呀！\nI\'m 圆圆. 跟我一起在大厅转转吧，我会介绍每个传送门。',
      ],
      idle: [
        '中间是喷泉，五个传送门围成一圈。\nFive portals, five different vibes — pick whichever calls you.',
        '想聊心事？想看电影？\n或者下盘棋？跟我说一声就行。',
        '有点累的话，来谈心区坐一坐~\nThe Chat Corner is always warm.',
      ],
      // Per-portal proximity intros. study & healing flagged WIP.
      zones: {
        chat: [
          '谈心区里有一位伴生球，\n会安安静静坐在你旁边听你说话。',
          'The Chat Corner — sit down, talk it out.\n那里有个温柔的小球陪着你。',
        ],
        study: [
          '学习区开放啦~\nThe Study Room is open. 绘绘会陪你出题、讲解。',
          'Drop by the Study Room — \n那里有白板、课件卡和一只爱出题的小老师。',
        ],
        leisure: [
          '休闲区是一个家庭影院。\nThe Leisure Lounge — a real home cinema.',
          '想看电影吗？休闲区有大屏幕和零食。\n灵灵会陪你一起看。',
        ],
  healing: [
  '想找个地方静一静吗?\n莲莲在疗愈花园陪你做几节深呼吸.',
  '走累了就去疗愈区, 那里能记录心情、还会有粒子陪你呼吸.\n' +
  'The Healing Garden — guided breathing + mood journal.',
  ],
        games: [
          '轻游戏区可以玩五子棋和国际象棋，\n童童会陪你下，并且当裁判。',
          'Game Zone — Gomoku & full chess.\n童童会一边下棋一边碎碎念。',
        ],
      },
    };
  }

  // Activate the hub companion: greet, schedule rotating chatter,
  // and reset proximity cooldowns. Idempotent.
  enterHub() {
    if (this._hubActive) return;
    this._hubActive = true;
    this._hubLastZoneSpoken = null;
    if (!this.hubCompanion) return;
    this.hubCompanion.setMode?.('idle');

    if (this._hubGreetTimer) clearTimeout(this._hubGreetTimer);
    this._hubGreetTimer = setTimeout(() => {
      this._hubGreetTimer = null;
      if (!this._hubActive) return;
      this._hubSay('greet');
      this._scheduleHubChatter(11000 + Math.random() * 6000);
    }, 1400);
  }

  // Deactivate the hub companion when the player commits to a zone.
  // Hides the bubble and stops timers but keeps the orb in the scene
  // so it's ready (and visible from inside the hub) when the player
  // returns via the home button.
  exitHub() {
    this._hubActive = false;
    if (this._hubGreetTimer)   { clearTimeout(this._hubGreetTimer);   this._hubGreetTimer   = null; }
    if (this._hubChatterTimer) { clearTimeout(this._hubChatterTimer); this._hubChatterTimer = null; }
    this.hubCompanion?.hideBubble?.();
    this.hubCompanion?.setMode?.('idle');
    this.hubCompanion?.setFollowTarget?.(null);
  }

  // Per-frame tick: animate the orb, follow the player at a side
  // offset, and trigger a one-shot zone intro whenever the player
  // walks within ~5m of any portal that we haven't recently spoken
  // about. `worldPos` is the camera (head) world position.
  updateHubCompanion(delta, worldPos) {
    const c = this.hubCompanion;
    if (!c) return;
    // Tick the orb's internal animation (breathing, mouth, follow
    // smoothing, bubble fade) every frame regardless of activity so
    // it never freezes mid-pose.
    c.update(delta, worldPos);
    if (!this._hubActive || !worldPos) return;

    // ── Side-by-side follow ──────────────────────────────────
    // Target = player + (1.4m to the right, slight forward, eye-level
    // dip). Clamp inside the cylindrical hub interior (r=17) and
    // a comfortable Y range.
    const ox = this._hubFollowOffset.x;
    const oy = this._hubFollowOffset.y;
    const oz = this._hubFollowOffset.z;
    const tx = worldPos.x + ox;
    const ty = Math.max(0.9, Math.min(2.1, worldPos.y + oy));
    const tz = worldPos.z + oz;
    const r  = Math.hypot(tx, tz);
    const maxR = 16;
    let cx = tx, cz = tz;
    if (r > maxR) { cx = tx * maxR / r; cz = tz * maxR / r; }
    c.setFollowTarget?.(new THREE.Vector3(cx, ty, cz));
    // Look toward the player so the eyes track them.
    c.lookAtStudent?.(new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z));

    // ── Proximity-aware zone intro ───────────────────────────
    // Walk through every zone portal and find the closest one within
    // the trigger radius. If it's a different zone than the last we
    // spoke about, fire its intro line.
    let closestId = null, closestDist = Infinity;
    for (const portal of this.portalMeshes) {
      // Each portal Group's inner plane carries `userData.zone` (the
      // full ZONES entry). The Group's world position is the gate's
      // anchor on the lobby ring, so distance is XZ-only.
      let zoneId = null;
      portal.traverse(o => {
        if (!zoneId && o.userData?.zone?.id) zoneId = o.userData.zone.id;
      });
      if (!zoneId) continue;
      const pp = portal.position;
      const dx = pp.x - worldPos.x;
      const dz = pp.z - worldPos.z;
      const d  = Math.hypot(dx, dz);
      if (d < closestDist) { closestDist = d; closestId = zoneId; }
    }
    const TRIGGER = 5.5;          // metres
    const RESET   = 8.0;          // hysteresis: must walk away first
    if (closestDist > RESET) this._hubLastZoneSpoken = null;
    if (closestId && closestDist < TRIGGER &&
        this._hubLastZoneSpoken !== closestId &&
        performance.now() - this._hubLastSpokeAt > 2500) {
      this._hubLastZoneSpoken = closestId;
      this._hubSay('zone', closestId);
    }
  }

  // Speak a randomly-picked line from a category (or per-zone pool).
  // Categories: 'greet', 'idle', or 'zone' + zoneId.
  _hubSay(category, zoneId) {
    if (!this.hubCompanion?.say) return;
    let pool;
    if (category === 'zone' && zoneId) {
      pool = this._hubLines?.zones?.[zoneId];
    } else {
      pool = this._hubLines?.[category];
    }
    if (!pool || pool.length === 0) return;
    const text = pool[(Math.random() * pool.length) | 0];
    this.hubCompanion.say(text);
    this._hubLastSpokeAt = performance.now();
  }

  // Recursive idle-chatter scheduler. While the player is in the hub
  // and not actively triggering a zone intro, the orb drops a random
  // tip every 12-20s. Suppressed if the orb has spoken in the last
  // ~6 seconds so we never overlap with a zone proximity bubble.
  _scheduleHubChatter(initialDelayMs) {
    if (this._hubChatterTimer) clearTimeout(this._hubChatterTimer);
    const delay = initialDelayMs ?? (12000 + Math.random() * 8000);
    this._hubChatterTimer = setTimeout(() => {
      this._hubChatterTimer = null;
      if (!this._hubActive) return;
      const since = performance.now() - this._hubLastSpokeAt;
      if (since > 6000) this._hubSay('idle');
      this._scheduleHubChatter();
    }, Math.max(2000, delay));
  }

  // ── Desktop controls ──────────────────────────────────────
  _initDesktopControls() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    // Pan would let the user drag the orbit target outside the room — disable it.
    this.controls.enablePan = false;
    // Locked target keeps focus on the room centre, regardless of mouse drag.
    this.controls.target.set(0, 1.5, 0);
    // Apply hub bounds (tightened so the orbit can't push through the walls).
    this.setCameraBounds(this._hubBounds());
    this.controls.update();
  }

  // ── Camera bounds ─────────────────────────────────────────
  // A bounds object describes the volume the camera is allowed to occupy and
  // is enforced every frame after controls.update().
  //   {
  //     type: 'cylinder',
  //     cx, cz, maxRadius,           // XZ disc the camera must stay inside
  //     minY, maxY,                  // vertical clamp
  //     target: Vector3,             // forced orbit target
  //     minDistance, maxDistance,    // forwarded to OrbitControls
  //     minPolar, maxPolar,
  //   }
  // For rectangular VR rooms use type:'box' with minX/maxX/minZ/maxZ instead.
  _hubBounds() {
    return {
      type: 'cylinder',
      cx: 0, cz: 0, maxRadius: 17,    // hub wall is at r=21 — keep margin
      minY: 1.2, maxY: 8.4,           // floor + ceiling margin
      target: new THREE.Vector3(0, 1.5, 0),
      minDistance: 5, maxDistance: 17,
      minPolar: Math.PI * 0.18,       // never look straight down
      maxPolar: Math.PI * 0.55,       // never look straight up at ceiling
    };
  }

  setCameraBounds(b) {
    if (!b || !this.controls) return;
    this.cameraBounds = b;
    if (b.target) this.controls.target.copy(b.target);
    if (b.minDistance != null) this.controls.minDistance = b.minDistance;
    if (b.maxDistance != null) this.controls.maxDistance = b.maxDistance;
    if (b.minPolar != null)    this.controls.minPolarAngle = b.minPolar;
    if (b.maxPolar != null)    this.controls.maxPolarAngle = b.maxPolar;
    this.controls.update();
    this._clampCamera();
  }

  resetCameraBounds() {
    this.setCameraBounds(this._hubBounds());
  }

  _clampCamera() {
    const b = this.cameraBounds;
    if (!b) return;
    const cam = this.camera.position;
    if (b.type === 'cylinder') {
      const dx = cam.x - b.cx, dz = cam.z - b.cz;
      const r = Math.hypot(dx, dz);
      if (r > b.maxRadius && r > 1e-6) {
        const k = b.maxRadius / r;
        cam.x = b.cx + dx * k;
        cam.z = b.cz + dz * k;
      }
    } else if (b.type === 'box') {
      cam.x = THREE.MathUtils.clamp(cam.x, b.minX, b.maxX);
      cam.z = THREE.MathUtils.clamp(cam.z, b.minZ, b.maxZ);
    }
    cam.y = THREE.MathUtils.clamp(cam.y, b.minY, b.maxY);
  }

  _bindDesktopEvents() {
    this.canvas.addEventListener('mousemove', e => this._onMove(e));
    // Trigger on press (pointerdown), not release. Only react to the primary
    // (left) mouse button so the right-button orbit / middle-button pan in
    // OrbitControls keep working untouched.
    this.canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      this._onClick(e);
    });
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth/innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  _screenNDC(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  }

  _castDesktop() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(this.clickables, true);
  }

  _onMove(e) {
    if (this.renderer.xr.isPresenting) return;
    this._screenNDC(e);
    const hits = this._castDesktop();
    if (hits.length > 0) {
      const obj = hits[0].object;
      const zone = obj.userData.zone || ZONES[obj.userData.zoneIdx];
      if (zone) {
        this.canvas.style.cursor = 'pointer';
        if (this.hoveredMesh !== obj) {
          if (this.hoveredMesh?.material?.emissiveIntensity !== undefined) this.hoveredMesh.material.emissiveIntensity = 0.12;
          this.hoveredMesh = obj;
          if (obj.material?.emissiveIntensity !== undefined) obj.material.emissiveIntensity = 0.45;
        }
        if (this.onZoneHover) this.onZoneHover(zone);
        return;
      }
    }
    this.canvas.style.cursor = '';
    if (this.hoveredMesh?.material?.emissiveIntensity !== undefined) this.hoveredMesh.material.emissiveIntensity = 0.12;
    this.hoveredMesh = null;
    if (this.onZoneHover) this.onZoneHover(null);
  }

  _onClick(e) {
    if (this.renderer.xr.isPresenting) return;
    this._screenNDC(e);
    const hits = this._castDesktop();
    if (hits.length === 0) return;
    const hit = hits[0];
    const obj = hit.object;

    // 1) Walk up to find a userData.onClick handler (e.g. exit portal in VR rooms).
    let m = obj;
    while (m && !m.userData?.onClick) m = m.parent;
    if (m?.userData?.onClick) {
      const result = m.userData.onClick(m, {
        source: 'desktop',
        point: hit.point ? hit.point.clone() : null,
        uv: hit.uv ? hit.uv.clone() : null,
        hitObject: obj,
      });
      // Handlers may return `false` to opt out and let the click fall
      // through to zone-entry below (e.g. inactive floor game board).
      if (result !== false) return;
    }

    // 2) Zone entry (platform / portal plane).
    const zone = obj.userData.zone || ZONES[obj.userData.zoneIdx];
    if (zone && this.onZoneClick) this.onZoneClick(zone);
  }

  // Register/unregister extra meshes as desktop click targets (used for VR room
  // exit portals & in-room interactables when opened from desktop).
  addClickable(mesh) {
    if (mesh && !this.clickables.includes(mesh)) this.clickables.push(mesh);
  }
  removeClickable(mesh) {
    const i = this.clickables.indexOf(mesh);
    if (i >= 0) this.clickables.splice(i, 1);
  }

  // Snap-teleport the desktop camera into an immersive VR room (rooms live
  // 100+ units away from the hub, so a fly tween would cross walls).
  // Optional bounds describe the box the camera must stay inside.
  flyToRoom(camPos, lookAt, bounds) {
    if (bounds) this.setCameraBounds(bounds);
    this.camera.position.copy(camPos);
    this.controls.target.copy(lookAt);
    this.controls.update();
    this._clampCamera();
  }

  _flyToZone(zone) {
    const a = zone.angle * Math.PI / 180;
    const r = 13;
    const tx=Math.cos(a)*r, tz=Math.sin(a)*r;
    const p0=this.camera.position.clone();
    const p1=new THREE.Vector3(Math.cos(a)*8,7,Math.sin(a)*8);
    const t0=this.controls.target.clone();
    const t1=new THREE.Vector3(tx,1,tz);
    let f=0;
    const ease=t=>t<0.5?2*t*t:-1+(4-2*t)*t;
    const fly=()=>{ f++; if(f>60) return; const k=ease(f/60); this.camera.position.lerpVectors(p0,p1,k); this.controls.target.lerpVectors(t0,t1,k); this.controls.update(); requestAnimationFrame(fly); };
    fly();
  }

  flyHome() {
    // Restore hub camera bounds (we may be returning from an immersive room).
    this.resetCameraBounds();
    // Fly back to the same arrival spot we use on first load
    // (this.spawnPoint, set in _initCamera) so "go home" and "boot
    // up" feel like the same homecoming.
    const sp = this.spawnPoint || new THREE.Vector3(0, 0, 16);
    const p0=this.camera.position.clone(), p1=new THREE.Vector3(sp.x, 6, sp.z);
    const t0=this.controls.target.clone(), t1=new THREE.Vector3(0, 1.5, 0);
    // In VR (headset only), pull the rig back to the spawn so the
    // user doesn't pop out inside the fountain. In desktop mode the
    // rig MUST stay at origin or OrbitControls' world-space math
    // breaks (camera is parented to playerGroup).
    if (this.renderer?.xr?.isPresenting) {
      this.playerGroup.position.set(sp.x, 0, sp.z);
    } else {
      this.playerGroup.position.set(0, 0, 0);
    }
    let f=0;
    const ease=t=>t<0.5?2*t*t:-1+(4-2*t)*t;
    const fly=()=>{ f++; if(f>60) return; const k=ease(f/60); this.camera.position.lerpVectors(p0,p1,k); this.controls.target.lerpVectors(t0,t1,k); this.controls.update(); requestAnimationFrame(fly); };
    fly();
  }

  setActiveZone(zoneId) {
    this.activeZoneId = zoneId || null;
    this.clickables.forEach(m => {
      if (m.material?.emissiveIntensity !== undefined)
        m.material.emissiveIntensity = (zoneId && m.userData.zoneId === zoneId) ? 0.35 : 0.12;
    });
    // Show/hide cinema
    this.showCinema(zoneId === 'leisure');
    // Show/hide chat room (VR mode)
    this.showChatRoom(zoneId === 'chat' && this.renderer.xr.isPresenting);
  }

  // ── Render loop (WebXR-compatible) ────────────────────────
  _onFrame(ts, frame) {
    const t = (ts || 0) * 0.001;
    const isXR = this.renderer.xr.isPresenting;

    // Desktop controls (with per-room camera bounds enforcement)
    if (!isXR && this.controls) {
      this.controls.update();
      this._clampCamera();
    }

    // Portal animations
    this.portalPlanes.forEach(({ tex }) => this._drawPortalFrame(tex, t));

    // Portal decoration animations: orbiting motes, pulsing studs, breathing
    // crystals and gate light, hovering foot dots.
    if (this.portalAnims) {
      for (const p of this.portalAnims) {
        // Slow torus shimmer
        if (p.torus) p.torus.material.emissiveIntensity = 0.45 + Math.sin(t*1.3)*0.18;

        // Rune studs pulse around the gate
        for (const s of p.studs) {
          const k = 0.7 + Math.sin(t*2.2 + s.userData.studPhase*Math.PI*2)*0.5;
          s.material.emissiveIntensity = 1.0 + k*0.6;
          s.scale.setScalar(0.85 + k*0.25);
        }

        // Energy motes drift in a forward slab in front of the gate, inside
        // the pillar span, so they never pierce the columns or back-side.
        for (const m of p.motes) {
          const ang = t * m.userData.speed + m.userData.phase;
          m.position.set(
            Math.sin(ang) * m.userData.xAmp,
            m.userData.yBase + Math.sin(ang*1.7) * m.userData.yAmp,
            m.userData.zBase + Math.sin(ang*2.3) * 0.15
          );
          m.material.opacity = 0.55 + Math.sin(ang*3)*0.35;
        }

        // Foot dots gentle hover
        for (const d of p.footDots) {
          d.position.y = d.userData.basey + Math.sin(t*1.6 + d.userData.phase)*0.06;
        }

        // Capital crystals + keystone gem breathing rotation
        const cb = 1.1 + Math.sin(t*1.4)*0.4;
        if (p.leftCrystal)  { p.leftCrystal.material.emissiveIntensity = cb;  p.leftCrystal.rotation.y  = t*0.6; }
        if (p.rightCrystal) { p.rightCrystal.material.emissiveIntensity = cb; p.rightCrystal.rotation.y = -t*0.6; }
        if (p.keyGem)       { p.keyGem.material.emissiveIntensity = 0.9 + Math.sin(t*1.8)*0.5; p.keyGem.rotation.y = t*0.8; }

        // Subtle gate light breathing — matched to the new higher base
        // intensities so each portal gently pulses without going dark.
        if (p.portalLight) p.portalLight.intensity = 1.7 + Math.sin(t*1.2)*0.5;
        if (p.portalHalo)  p.portalHalo.intensity  = 0.7 + Math.sin(t*1.2 + 0.6)*0.3;
      }
    }

    // Billboard labels
    const camWorld = new THREE.Vector3();
    this.camera.getWorldPosition(camWorld);
    this.labels.forEach(l => l.lookAt(camWorld));

    // Zone ring pulse
    this.zoneRings.forEach(({ ring, zoneId }) => {
      ring.material.emissiveIntensity = this.activeZoneId === zoneId
        ? 0.55 + Math.sin(t*3)*0.2
        : 0.55 + Math.sin(t*1.5)*0.08;
    });

    // Water ripple (lower + upper basins)
    if (this.waterMesh) this.waterMesh.rotation.z = Math.sin(t*0.4)*0.01;
    if (this.upperWaterMesh) this.upperWaterMesh.rotation.z = -Math.sin(t*0.55)*0.015;

    // Glowing finial orb pulse
    if (this.fountainOrb) {
      const k = 0.5 + Math.sin(t*1.2)*0.25;
      this.fountainOrb.material.emissiveIntensity = k;
      if (this.fountainLight) this.fountainLight.intensity = 0.9 + k*0.5;
    }

    // Water droplets travel along their curves and fade as they fall
    if (this.fountainStreams) {
      for (const drop of this.fountainStreams) {
        const p = (t*0.55 + drop.userData.offset) % 1;
        const pt = drop.userData.curve.getPoint(p);
        drop.position.copy(pt);
        drop.material.opacity = 0.95 * (1 - p*p*0.7);
      }
    }

    // (Avatar idle sway removed — humanoid placeholder retired in
    //  favour of the AI companion orb tracked via updateHubCompanion.)

    // Healing particles float
    if (this.healingParticles) {
      const pos = this.healingParticles.geometry.attributes.position;
      const base = this.healingParticles._basePositions;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, base[i*3+1] + Math.sin(t*0.8 + i*0.4)*0.18);
      }
      pos.needsUpdate = true;
    }

    // XR manager tick (controllers, teleport)
    if (this.xrManager) this.xrManager.update();

    // Call external frame update (for VR room manager, etc.)
    if (this.onFrameUpdate) {
      const delta = this.clock.getDelta();
      this.onFrameUpdate(delta, isXR, camWorld);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
