// ============================================================
//  Campus Companion XR — WebXR Manager
//  Handles immersive-vr and immersive-ar sessions.
//  Designed for Meta Quest 3S (and any WebXR-compatible device).
// ============================================================

import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export class XRManager {
  /**
   * @param {object} opts
   *   renderer    THREE.WebGLRenderer
   *   scene       THREE.Scene
   *   camera      THREE.Camera (must be child of playerGroup)
   *   playerGroup THREE.Group  (move this to teleport)
   *   floorMesh   THREE.Mesh   (raycasted for teleport target)
   *   portalMeshes THREE.Mesh[] (clickable portals)
   *   onZoneEnter (zone) => void
   *   onExitXR    () => void
   */
  constructor(opts) {
    Object.assign(this, opts);
    this.controllers   = [];
    this.grips         = [];
    this.raycaster     = new THREE.Raycaster();
    this.tempMatrix    = new THREE.Matrix4();
    this.teleportPos   = new THREE.Vector3();
    this.activeCtrl    = null;
    this.isTeleporting = false;
    this._teleportIndicator = null;
    this._interactables = [];   // portal meshes for hover highlight

    // Thumbstick locomotion state
    this.moveSpeed       = 2.8;        // m/s — comfortable game-walking pace
    this.snapTurnAngle   = Math.PI/6;  // 30°
    this._snapTurnPrimed = true;       // ready for the next snap-turn
    this._lastFrameTime  = 0;

    // ── Smooth (velocity-based) forward/back locomotion ──────
    // _currentMoveSpeed is a signed scalar in m/s along the user's
    // current head-forward direction. Each frame it eases toward a
    // target speed derived from the left stick's Y axis, giving real
    // ramp-up when the player pushes the stick and ramp-down (coast)
    // when they let go — no more on/off teleport-style movement.
    this._currentMoveSpeed = 0;
    this.moveAccel         = 9.0;   // m/s² when stick is pushed
    this.moveDecel         = 12.0;  // m/s² when stick is released (faster stop)
    // Reusable vectors so the per-frame loop doesn't allocate
    this._tmpFwd   = new THREE.Vector3();
    this._tmpRight = new THREE.Vector3();
    this._tmpMove  = new THREE.Vector3();
    this._tmpHead  = new THREE.Vector3();
    this._tmpHead2 = new THREE.Vector3();
    this._yAxis    = new THREE.Vector3(0, 1, 0);

    // Movement bounds (clamps the user's head inside walls). Set via
    // setMovementBounds(); when null, no clamping is performed.
    //   { type:'cylinder', cx, cz, maxRadius, minY, maxY }
    //   { type:'box', minX, maxX, minZ, maxZ, minY, maxY }
    this.movementBounds = null;

    this._setupXR();
    this._setupControllers();
    this._setupTeleportIndicator();
  }

  // ── Renderer xr flag ─────────────────────────────────────
  _setupXR() {
    this.renderer.xr.enabled = true;
    this.renderer.xr.addEventListener('sessionstart', () => {
      // In VR, hide all HTML panels
      document.getElementById('chat-panel')?.classList.add('hidden');
      document.getElementById('nav-hint')?.classList.add('hidden');
      document.getElementById('top-nav')?.classList.add('hidden');
      document.getElementById('zone-indicator')?.classList.add('hidden');
      // Push the VR rig to the lobby spawn point so the headset user
      // arrives outside the fountain. The desktop OrbitControls path
      // requires the rig to remain at origin (parent transforms break
      // its math), so we only translate it once XR actually starts.
      const sp = this.spawnPoint;
      if (sp) this.playerGroup.position.set(sp.x, 0, sp.z);
    });
    this.renderer.xr.addEventListener('sessionend', () => {
      // Restore HTML panels
      document.getElementById('top-nav')?.classList.remove('hidden');
      document.getElementById('nav-hint')?.classList.remove('hidden');
      // Park the rig back at origin so desktop OrbitControls works
      // again on exit.
      this.playerGroup.position.set(0, 0, 0);
      if (this.onExitXR) this.onExitXR();
    });
  }

  // ── Controllers ───────────────────────────────────────────
  _setupControllers() {
    const factory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i++) {
      // Event source
      const ctrl = this.renderer.xr.getController(i);
      ctrl.addEventListener('selectstart', () => this._onSelectStart(ctrl));
      ctrl.addEventListener('selectend',   () => this._onSelectEnd(ctrl));
      this.playerGroup.add(ctrl);
      this.controllers.push(ctrl);

      // Physical grip model
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip));
      this.playerGroup.add(grip);
      this.grips.push(grip);

      // Ray line
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -6)];
      const ray = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.55 }),
      );
      ray.name = 'ray';
      ctrl.add(ray);
    }
  }

  // ── Teleport indicator ────────────────────────────────────
  _setupTeleportIndicator() {
    const g = new THREE.Group();
    // Outer ring
    g.add(new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.36, 32),
      new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    ));
    // Inner dot
    g.add(new THREE.Mesh(
      new THREE.CircleGeometry(0.09, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.95 }),
    ));
    g.rotation.x = -Math.PI / 2;
    g.position.y = 0.02;
    g.visible = false;
    this.scene.add(g);
    this._teleportIndicator = g;
  }

  // ── Haptics ───────────────────────────────────────────────
  /**
   * Pulse the haptic actuator on the gamepad backing `ctrl`.
   * Quietly no-ops when the runtime / controller doesn't expose haptics.
   * @param {THREE.Group} ctrl   one of this.controllers
   * @param {number} intensity   0..1
   * @param {number} duration    milliseconds (typical 30-150)
   */
  pulseController(ctrl, intensity = 0.6, duration = 70) {
    try {
      const idx = this.controllers.indexOf(ctrl);
      if (idx < 0) return;
      const session = this.renderer.xr.getSession();
      // inputSources order matches the controller index three.js exposes.
      const src = session?.inputSources?.[idx];
      const pad = src?.gamepad;
      const actuator = pad?.hapticActuators?.[0];
      if (actuator?.pulse) actuator.pulse(intensity, duration);
    } catch (_) { /* haptics are best-effort */ }
  }

  // ── Select (trigger pull) ─────────────────────────────────
  _onSelectStart(ctrl) {
    // 1. Check interactable buttons/panels (VR UI) - highest priority
    const btnHit = this._cast(ctrl, this._interactables);
    if (btnHit) {
      const hitObj = btnHit.object;
      
      // Check for interactive panels with UV coordinates (games, etc.)
      if (hitObj.userData?.isInteractive && hitObj.userData?.onPointerDown && btnHit.uv) {
        hitObj.userData.onPointerDown(btnHit.uv);
        this.pulseController(ctrl, 0.45, 50);
        return;
      }
      
      // Walk up to find onClick handler (buttons)
      let mesh = hitObj;
      while (mesh && !mesh.userData.onClick) mesh = mesh.parent;
      if (mesh?.userData?.onClick) {
        const result = mesh.userData.onClick(mesh, {
          source: 'xr',
          controller: ctrl,
          xr: this,
          point: btnHit.point ? btnHit.point.clone() : null,
          uv: btnHit.uv ? btnHit.uv.clone() : null,
          hitObject: hitObj,
        });
        // Handlers can return `false` to opt out (e.g. floor-board when no
        // game is active) and let the trigger fall through to teleport.
        if (result !== false) {
          this.pulseController(ctrl, 0.7, 80);
          return;
        }
      }
      
      // Check for exit portal
      if (hitObj.userData?.isExitPortal && hitObj.userData?.onClick) {
        this.pulseController(ctrl, 0.5, 60);
        hitObj.userData.onClick();
        return;
      }
    }

    // 2. Check portal hit → enter zone
    const portalHit = this._cast(ctrl, this.portalMeshes);
    if (portalHit) {
      let obj = portalHit.object;
      // Walk up to find zone userData
      while (obj && !obj.userData.zone) obj = obj.parent;
      const zone = obj?.userData?.zone;
      if (zone && this.onZoneEnter) {
        this.onZoneEnter(zone);
        return;
      }
    }

    // 3. Start teleport targeting
    this.isTeleporting = true;
    this.activeCtrl = ctrl;
  }

  _onSelectEnd(ctrl) {
    if (this.isTeleporting && this._teleportIndicator.visible) {
      this.playerGroup.position.copy(this.teleportPos);
    }
    this.isTeleporting = false;
    this.activeCtrl = null;
    this._teleportIndicator.visible = false;
  }

  // ── Per-frame update ──────────────────────────────────────
  update() {
    if (!this.renderer.xr.isPresenting) {
      this._lastFrameTime = 0;
      return;
    }
    const now = performance.now();
    const dt  = this._lastFrameTime ? Math.min(0.05, (now - this._lastFrameTime) / 1000) : 0;
    this._lastFrameTime = now;

    this._updateTeleport();
    this._updateLocomotion(dt);
    this._updateHover();
  }

  // ── Public: movement bounds ───────────────────────────────
  setMovementBounds(b) { this.movementBounds = b || null; }
  clearMovementBounds() { this.movementBounds = null; }

  // Read a thumbstick from a gamepad. Different Quest controller mappings put
  // the stick on either axes[2,3] (WebXR standard) or axes[0,1] (legacy). We
  // pick whichever pair has the larger magnitude so movement works on both.
  _readStick(gp) {
    if (!gp || !gp.axes || gp.axes.length === 0) return [0, 0];
    const a0 = gp.axes[0] || 0, a1 = gp.axes[1] || 0;
    const a2 = gp.axes[2] || 0, a3 = gp.axes[3] || 0;
    const m01 = a0*a0 + a1*a1;
    const m23 = a2*a2 + a3*a3;
    return m23 >= m01 ? [a2, a3] : [a0, a1];
  }

  // ── Thumbstick locomotion ─────────────────────────────────
  //   Left stick Y →  smooth forward/back along current head facing
  //                   (no strafe — only the axis the player is looking).
  //   Right stick X → comfort snap-turn (30°), flicked.
  // Movement uses velocity-based easing (acceleration on push,
  // deceleration on release) so motion ramps in and out gently
  // instead of snapping on/off — much more comfortable for VR.
  // Movement is clamped against this.movementBounds so the user can't walk
  // through walls.
  _updateLocomotion(dt) {
    if (dt <= 0) return;
    const session = this.renderer.xr.getSession?.();
    if (!session?.inputSources) {
      // No active session = make sure the velocity is parked at 0.
      this._currentMoveSpeed = 0;
      return;
    }

    const dead = 0.18;
    const xrCam = this.renderer.xr.getCamera();

    // Find the left-controller stick Y (the only stick driving translation
    // now). If the runtime doesn't report handedness yet we fall back to
    // whichever input source has the largest |Y| magnitude so the player
    // is never stranded.
    let stickY = 0;
    let leftSrc = null, fallbackY = 0;
    for (const src of session.inputSources) {
      const [, y] = this._readStick(src.gamepad);
      if (src.handedness === 'left') { leftSrc = src; stickY = y; }
      else if (!src.handedness && Math.abs(y) > Math.abs(fallbackY)) fallbackY = y;
    }
    if (!leftSrc) stickY = fallbackY;

    // Convert stick deflection → desired speed (m/s). ay > 0 when the
    // user pulls the stick toward themselves, which feels like
    // "backward", so we flip the sign: forward = -y.
    let targetSpeed = 0;
    if (Math.abs(stickY) > dead) {
      const norm = (Math.abs(stickY) - dead) / (1 - dead);   // 0..1
      const eased = norm * norm;                             // ease-in fine control
      targetSpeed = -Math.sign(stickY) * eased * this.moveSpeed;
    }

    // Ease the actual speed toward the target. Use a faster decel rate
    // when the player has released the stick so the avatar doesn't
    // coast forever, but a softer accel rate when ramping up so VR
    // motion sickness is minimised.
    const slowingDown = (Math.abs(targetSpeed) < Math.abs(this._currentMoveSpeed));
    const rate = slowingDown ? this.moveDecel : this.moveAccel;
    const maxStep = rate * dt;
    const diff = targetSpeed - this._currentMoveSpeed;
    if (Math.abs(diff) <= maxStep) this._currentMoveSpeed = targetSpeed;
    else                           this._currentMoveSpeed += Math.sign(diff) * maxStep;

    // If we still have any meaningful velocity, translate the rig
    // along the *current* head facing (so turning your head while
    // moving curves the path naturally).
    if (Math.abs(this._currentMoveSpeed) > 1e-3) {
      xrCam.getWorldDirection(this._tmpFwd);
      this._tmpFwd.y = 0;
      if (this._tmpFwd.lengthSq() >= 1e-6) {
        this._tmpFwd.normalize();
        this._tmpMove.copy(this._tmpFwd).multiplyScalar(this._currentMoveSpeed * dt);
        this._applyMoveWithCollision(xrCam, this._tmpMove);
      }
    }

    // Right-stick branch (snap turn) is independent of locomotion.
    for (const src of session.inputSources) {
      const [ax] = this._readStick(src.gamepad);
      if (src.handedness === 'right') {
        // Snap turn on flick; require return to centre before re-firing.
        const fireT = 0.7, resetT = 0.3;
        if (this._snapTurnPrimed && Math.abs(ax) > fireT) {
          const angle = -Math.sign(ax) * this.snapTurnAngle;
          // Rotate around the user's head XZ position so the world doesn't
          // visibly translate when turning.
          xrCam.getWorldPosition(this._tmpHead);
          const px = this._tmpHead.x, pz = this._tmpHead.z;
          this.playerGroup.position.x -= px;
          this.playerGroup.position.z -= pz;
          this.playerGroup.position.applyAxisAngle(this._yAxis, angle);
          this.playerGroup.position.x += px;
          this.playerGroup.position.z += pz;
          this.playerGroup.rotation.y += angle;
          this._snapTurnPrimed = false;
        } else if (!this._snapTurnPrimed && Math.abs(ax) < resetT) {
          this._snapTurnPrimed = true;
        }
      }
    }
  }

  // Move the player by `delta`, but clamp so the user's HEAD never crosses
  // wall bounds. Translates the player in two independent axes (X and Z)
  // so sliding along a wall still works (i.e. blocked on +X doesn't kill -Z).
  _applyMoveWithCollision(xrCam, delta) {
    const b = this.movementBounds;
    if (!b) {
      this.playerGroup.position.add(delta);
      return;
    }

    // Where is the head right now in world space?
    xrCam.getWorldPosition(this._tmpHead);
    // Try X then Z so we slide along walls instead of getting stuck.
    const tryAxis = (axis /* 'x'|'z' */) => {
      const d = delta[axis];
      if (d === 0) return;
      this._tmpHead2.copy(this._tmpHead);
      this._tmpHead2[axis] += d;
      if (this._isHeadInsideBounds(this._tmpHead2, b)) {
        this.playerGroup.position[axis] += d;
        this._tmpHead[axis] += d;
      } else {
        // Try clamping to the bound surface so we slide right up to the wall.
        const clamped = this._clampHeadToBounds(this._tmpHead2, b);
        const allowed = clamped[axis] - this._tmpHead[axis];
        if (Math.abs(allowed) > 1e-4) {
          this.playerGroup.position[axis] += allowed;
          this._tmpHead[axis] += allowed;
        }
      }
    };
    tryAxis('x');
    tryAxis('z');
    // Y is left alone — the user's height is whatever the headset reports.
  }

  _isHeadInsideBounds(pos, b) {
    if (b.type === 'cylinder') {
      const dx = pos.x - b.cx, dz = pos.z - b.cz;
      return (dx*dx + dz*dz) <= (b.maxRadius * b.maxRadius);
    }
    if (b.type === 'box') {
      return pos.x >= b.minX && pos.x <= b.maxX
          && pos.z >= b.minZ && pos.z <= b.maxZ;
    }
    return true;
  }

  _clampHeadToBounds(pos, b) {
    const out = this._tmpHead2.copy(pos);
    if (b.type === 'cylinder') {
      const dx = pos.x - b.cx, dz = pos.z - b.cz;
      const r = Math.hypot(dx, dz);
      if (r > b.maxRadius && r > 1e-6) {
        const k = b.maxRadius / r;
        out.x = b.cx + dx * k;
        out.z = b.cz + dz * k;
      }
    } else if (b.type === 'box') {
      out.x = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX);
      out.z = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
    }
    return out;
  }

  _updateTeleport() {
    if (!this.isTeleporting || !this.activeCtrl) return;

    this.tempMatrix.identity().extractRotation(this.activeCtrl.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(this.activeCtrl.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

    const hits = this.raycaster.intersectObject(this.floorMesh, true);
    if (hits.length > 0) {
      const p = hits[0].point;
      this._teleportIndicator.position.set(p.x, 0.02, p.z);
      this._teleportIndicator.visible = true;
      this.teleportPos.set(p.x, 0, p.z);
    } else {
      this._teleportIndicator.visible = false;
    }
  }

  _updateHover() {
    const allTargets = [...(this.portalMeshes || []), ...this._interactables];
    // Reset all
    allTargets.forEach(m => {
      if (m.material?.emissiveIntensity !== undefined) m.material.emissiveIntensity = 0.3;
      if (m._draw) m._draw(false);
    });

    for (const ctrl of this.controllers) {
      const hit = this._cast(ctrl, allTargets);
      if (!hit) continue;
      const m = hit.object;
      if (m.material?.emissiveIntensity !== undefined) m.material.emissiveIntensity = 0.9;
      if (m._draw) m._draw(true);

      // Shorten ray to hit point
      const ray = ctrl.getObjectByName('ray');
      if (ray) {
        const pos = ray.geometry.attributes.position;
        pos.setXYZ(1, 0, 0, -hit.distance);
        pos.needsUpdate = true;
      }
    }
  }

  // ── Raycasting helper ─────────────────────────────────────
  _cast(ctrl, objects) {
    if (!objects || objects.length === 0) return null;
    this.tempMatrix.identity().extractRotation(ctrl.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
    const hits = this.raycaster.intersectObjects(objects, true);
    return hits.length > 0 ? hits[0] : null;
  }

  // ── Register interactable VR buttons ─────────────────────
  registerInteractable(mesh) { this._interactables.push(mesh); }
  unregisterInteractable(mesh) {
    this._interactables = this._interactables.filter(m => m !== mesh);
  }
  clearInteractables() { this._interactables = []; }

  // ── VR Session ────────────────────────────────────────────
  async requestVRSession() {
    const supported = await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false);
    if (!supported) throw new Error('VR not supported on this device/browser');

    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    });
    await this.renderer.xr.setSession(session);
    return session;
  }

  // ── AR Session (Study Room) ───────────────────────────────
  async requestARSession(overlayEl) {
    const supported = await navigator.xr?.isSessionSupported('immersive-ar').catch(() => false);
    if (!supported) throw new Error('AR not supported on this device');

    const sessionOpts = {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'hand-tracking', 'local-floor'],
    };
    if (overlayEl) sessionOpts.domOverlay = { root: overlayEl };

    const session = await navigator.xr.requestSession('immersive-ar', sessionOpts);
    await this.renderer.xr.setSession(session);
    if (overlayEl) overlayEl.classList.remove('hidden');

    session.addEventListener('end', () => {
      if (overlayEl) overlayEl.classList.add('hidden');
    });

    return session;
  }

  isPresenting() { return this.renderer.xr.isPresenting; }
}
