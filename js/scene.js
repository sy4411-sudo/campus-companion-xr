// ============================================================
//  Campus Companion XR — Three.js Scene
//  First-person VR + Desktop orbit camera.
//  Circular hub + 5 radial zones + animated portals.
//  Zone sub-environments: VR cinema (leisure), AR study, etc.
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mountTripoModel } from './tripo-loader.js';

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
    this.avatarGroup  = null;
    this.xrManager    = null;   // set by main.js after XR init

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
    this._buildPlaceholderAvatar('female');
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
    // Desktop start — keep camera inside the cylindrical room (r=21, ceiling y≈9.2)
    this.camera.position.set(0, 6, 16);
    this.camera.lookAt(0, 1.5, 0);
    // VR start: playerGroup at origin, camera at eye height
    this.playerGroup.position.set(0, 0, 0);
  }

  // ── Lights ────────────────────────────────────────────────
  _initLights() {
    this.scene.add(new THREE.AmbientLight(0xfff0d8, 0.45));
    const center = new THREE.PointLight(0xffd070, 2.5, 45);
    center.position.set(0, 8.5, 0); center.castShadow = true;
    center.shadow.mapSize.set(512, 512);
    this.scene.add(center);
    ZONES.forEach(z => {
      const a = z.angle * Math.PI / 180;
      const l = new THREE.PointLight(z.color, 1.2, 18);
      l.position.set(Math.cos(a)*13, 2.5, Math.sin(a)*13);
      this.scene.add(l);
    });
    const fill = new THREE.DirectionalLight(0xffe8c8, 0.4);
    fill.position.set(8, 18, 8);
    this.scene.add(fill);
    this.scene.fog = new THREE.FogExp2(0x1a120a, 0.018);
  }

  // ── Floor ─────────────────────────────────────────────────
  _buildFloor() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 0.3, 72), mat);
    floor.position.y = -0.15; floor.receiveShadow = true;
    this.scene.add(floor);
    this.floorMesh = floor; // exposed for XR teleport

    // Inner circle
    const innerMat = new THREE.MeshStandardMaterial({ color: 0xa07848, roughness: 0.75 });
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.32, 64), innerMat);
    inner.position.y = -0.14; this.scene.add(inner);

    // Compass rose ring
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xd4a84a, metalness: 0.4, roughness: 0.5 });
    const rose = new THREE.Mesh(new THREE.TorusGeometry(5, 0.12, 8, 64), ringMat);
    rose.rotation.x = Math.PI/2; rose.position.y = 0.02; this.scene.add(rose);
  }

  // ── Walls & Ceiling ───────────────────────────────────────
  _buildWallsAndCeiling() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.92, side: THREE.BackSide });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 9, 72, 1, true), wallMat);
    wall.position.y = 4.5; this.scene.add(wall);

    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xfaf4ec, roughness: 0.9 });
    const ceil = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 0.4, 72), ceilMat);
    ceil.position.y = 9.2; this.scene.add(ceil);

    const chandMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 });
    const chand = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 40), chandMat);
    chand.rotation.x = Math.PI/2; chand.position.y = 8.8; this.scene.add(chand);
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.4,6), chandMat);
      chain.position.set(Math.cos(a)*1.2, 8.5, Math.sin(a)*1.2); this.scene.add(chain);
    }
  }

  // ── Central fountain ──────────────────────────────────────
  // Tripo-generated marble fountain at the hub centre, surrounded by four
  // tropical potted plants. A warm pulsing point light remains regardless of
  // whether the GLB has finished loading so the room is always lit.
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

    // Four lush potted plants ringing the fountain (cached → 1 fetch).
    // Radius pushed out so the plants stay clear of the larger fountain base.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      mountTripoModel(this.scene, 'plant_tropical', {
        position: [Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6],
        rotationY: Math.random() * Math.PI * 2,
        targetSize: 1.0,
        yAlign: 'bottom',
      });
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

    // Warm down-light always present (room stays lit while Tripo generates).
    const lamp = new THREE.PointLight(0xFFD89A, 1.1, 18, 1.4);
    lamp.position.set(0, lampY - 0.1, 0);
    group.add(lamp);

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

      // Soft colored point light pushed forward of the gate so it lights the
      // front face cleanly without back-illuminating the lintel.
      const portalLight = new THREE.PointLight(zone.color, 0.9, 8, 2.0);
      portalLight.position.set(0, 2.0, 0.6);
      g.add(portalLight);

      this.scene.add(g);
      this.portalMeshes.push(g);   // XR raycasts against these
      this.clickables.push(plane); // desktop click
      plane.userData = { isPortal: true, zone };

      this.portalAnims.push({
        torus, outerRing, studs, motes, footDots,
        leftCrystal: left.crystal, rightCrystal: right.crystal,
        keyGem, portalLight, color: zone.color
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

  // ── Chat Room (VR Enhanced for 谈心区) ─────────────────────
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
  _makeZoneLabel(zone) {
    // Use a higher-resolution canvas (same 3.2:1.4 aspect) so text stays crisp,
    // and pass maxWidth to fillText so long names auto-shrink instead of clipping.
    const w=640,h=280,c=document.createElement('canvas'); c.width=w; c.height=h;
    const ctx=c.getContext('2d');
    const pad=24;
    ctx.fillStyle='rgba(255,248,235,0.92)'; this._rrect(ctx,12,12,w-24,h-24,28); ctx.fill();
    ctx.strokeStyle='rgba(180,140,80,0.5)'; ctx.lineWidth=4; ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='#4a3020'; ctx.font='bold 52px "Segoe UI Emoji",Arial';
    ctx.fillText(`${zone.emoji}  ${zone.name}`, w/2, 110, w-pad*2);
    ctx.font='40px "Microsoft YaHei",Arial'; ctx.fillStyle='#7a5840';
    ctx.fillText(zone.nameZh, w/2, 170, w-pad*2);
    ctx.font='26px Arial'; ctx.fillStyle='#a08060';
    ctx.fillText('Click to enter · 点击进入', w/2, 220, w-pad*2);
    const tex=new THREE.CanvasTexture(c); tex.anisotropy=4;
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide});
    return new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.4),mat);
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

  // ── Avatar ────────────────────────────────────────────────
  setAvatarGender(gender) { this._buildPlaceholderAvatar(gender); }

  _buildPlaceholderAvatar(gender) {
    if (this.avatarGroup) this.scene.remove(this.avatarGroup);
    const g = new THREE.Group();
    const skin=new THREE.MeshStandardMaterial({color:0xffcb99,roughness:0.8});
    const hair=new THREE.MeshStandardMaterial({color:gender==='female'?0x1a0c06:0x0a0604,roughness:0.9});
    const top =new THREE.MeshStandardMaterial({color:gender==='female'?0xe8a0b0:0x4880c0,roughness:0.85});
    const btm =new THREE.MeshStandardMaterial({color:gender==='female'?0x6080d0:0x303858,roughness:0.85});
    const shoe=new THREE.MeshStandardMaterial({color:0x303030,roughness:0.8});
    const add=(geo,mat,x,y,z,rx=0,rz=0)=>{const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.rotation.set(rx,0,rz); m.castShadow=true; g.add(m); return m;};
    add(new THREE.SphereGeometry(0.21,18,14),skin,0,1.72,0);
    add(new THREE.SphereGeometry(0.225,16,10,0,Math.PI*2,0,gender==='female'?Math.PI*0.7:Math.PI*0.45),hair,0,1.72,0);
    add(new THREE.CylinderGeometry(0.16,0.18,0.72,14),top,0,1.14,0);
    add(new THREE.CylinderGeometry(0.06,0.055,0.52,8),top,0.27,1.24,0,0,0.3);
    add(new THREE.CylinderGeometry(0.06,0.055,0.52,8),top,-0.27,1.24,0,0,-0.3);
    add(new THREE.SphereGeometry(0.07,8,7),skin,0.38,0.96,0);
    add(new THREE.SphereGeometry(0.07,8,7),skin,-0.38,0.96,0);
    add(new THREE.CylinderGeometry(0.08,0.07,0.65,10),btm,0.09,0.44,0);
    add(new THREE.CylinderGeometry(0.08,0.07,0.65,10),btm,-0.09,0.44,0);
    add(new THREE.BoxGeometry(0.14,0.08,0.25),shoe,0.09,0.08,0.05);
    add(new THREE.BoxGeometry(0.14,0.08,0.25),shoe,-0.09,0.08,0.05);
    if (gender==='female') {
      add(new THREE.CylinderGeometry(0.06,0.04,0.45,8),hair,0.17,1.5,0,0.15,0.1);
      add(new THREE.CylinderGeometry(0.06,0.04,0.45,8),hair,-0.17,1.5,0,0.15,-0.1);
    }
    g.position.set(0,0,4); g.rotation.y = Math.PI;
    this.scene.add(g);
    this.avatarGroup = g;
  }

  loadGLBAvatar(url) {
    if (this.avatarGroup) this.scene.remove(this.avatarGroup);
    this.gltfLoader.load(url, gltf => {
      this.avatarGroup = gltf.scene;
      const box = new THREE.Box3().setFromObject(this.avatarGroup);
      this.avatarGroup.scale.setScalar(1.8 / (box.max.y - box.min.y));
      this.avatarGroup.position.set(0, 0, 4);
      this.scene.add(this.avatarGroup);
    }, undefined, err => console.warn('[Scene] GLB load failed:', err));
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
    const obj = hits[0].object;

    // 1) Walk up to find a userData.onClick handler (e.g. exit portal in VR rooms).
    let m = obj;
    while (m && !m.userData?.onClick) m = m.parent;
    if (m?.userData?.onClick) { m.userData.onClick(m, { source: 'desktop' }); return; }

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
    // Keep the home camera INSIDE the room.
    // Room is a cylinder of radius 21 with ceiling at y≈9.2,
    // so we place the camera at (0, 6, 16) looking at the central fountain.
    const p0=this.camera.position.clone(), p1=new THREE.Vector3(0,6,16);
    const t0=this.controls.target.clone(), t1=new THREE.Vector3(0,1.5,0);
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

        // Subtle gate light breathing
        if (p.portalLight) p.portalLight.intensity = 0.7 + Math.sin(t*1.2)*0.3;
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

    // Avatar idle sway
    if (this.avatarGroup) this.avatarGroup.rotation.y = Math.PI + Math.sin(t*0.6)*0.08;

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
