// ============================================================
//  Campus Companion XR — AI Companion 3D Model & Animation
//  A friendly AI companion with spherical body and hands.
//  Provides idle animations, speaking animations, and
//  gesture responses for immersive VR chat experiences.
// ============================================================

import * as THREE from 'three';

export class AICompanion {
  /**
   * @param {THREE.Scene} scene - The Three.js scene to add the companion to
   * @param {object} options
   *   position: THREE.Vector3 - Initial position
   *   color: number - Main body color (default: warm coral for chat zone)
   *   scale: number - Overall scale (default: 1)
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'aiCompanion';
    
    // Configuration
    this.position = options.position || new THREE.Vector3(0, 1.2, -2);
    this.bodyColor = options.color || 0xE8A898;  // Warm coral (chat zone color)
    this.scale = options.scale || 1;
    this.onReady = options.onReady || (() => {});

    // Animation state
    this.clock = new THREE.Clock();
    this.isSpeaking = false;
    this.isListening = false;
    this.emotionState = 'idle'; // idle, happy, thinking, empathy
    this.targetLookAt = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    
    // Mesh references
    this.body = null;
    this.leftHand = null;
    this.rightHand = null;
    this.face = null;
    this.eyes = [];
    this.mouth = null;
    this.aura = null;
    
    // Animation parameters
    this.breathPhase = 0;
    this.bobPhase = 0;
    this.handWavePhase = 0;
    this.speakPhase = 0;

    // Follow / speech-bubble state
    this.followTarget = null;            // THREE.Vector3 in parent-local space, or null
    this.followSpeed  = options.followSpeed || 1.4;  // m/s — gentle walking pace
    this.followStop   = 0.05;            // dead-band so it doesn't jitter at the target
    this.bubble       = null;            // bubble plane mesh
    this.bubbleCanvas = null;
    this.bubbleCtx    = null;
    this.bubbleTex    = null;
    this.bubbleTargetOpacity = 0;
    this.bubbleOpacity       = 0;

    this._build();
    this._buildSpeechBubble();
  }

  // ── Build the 3D model ────────────────────────────────────
  _build() {
    // Main body - large sphere
    const bodyGeom = new THREE.SphereGeometry(0.35, 32, 24);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.bodyColor,
      roughness: 0.4,
      metalness: 0.1,
      emissive: this.bodyColor,
      emissiveIntensity: 0.15,
    });
    this.body = new THREE.Mesh(bodyGeom, bodyMat);
    this.body.castShadow = true;
    this.body.position.y = 0;
    this.group.add(this.body);

    // Inner glow sphere
    const glowGeom = new THREE.SphereGeometry(0.38, 24, 18);
    const glowMat = new THREE.MeshBasicMaterial({
      color: this.bodyColor,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    this.aura = new THREE.Mesh(glowGeom, glowMat);
    this.group.add(this.aura);

    // Face container (slightly forward from body center)
    this.face = new THREE.Group();
    this.face.position.z = 0.28;
    this.group.add(this.face);

    // Eyes - two small spheres
    const eyeGeom = new THREE.SphereGeometry(0.045, 16, 12);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a10,
      roughness: 0.3,
    });
    
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(-0.1, 0.08, 0);
    this.face.add(leftEye);
    this.eyes.push(leftEye);

    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(0.1, 0.08, 0);
    this.face.add(rightEye);
    this.eyes.push(rightEye);

    // Eye highlights (white dots)
    const highlightGeom = new THREE.SphereGeometry(0.015, 8, 6);
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const leftHighlight = new THREE.Mesh(highlightGeom, highlightMat);
    leftHighlight.position.set(-0.09, 0.095, 0.035);
    this.face.add(leftHighlight);

    const rightHighlight = new THREE.Mesh(highlightGeom, highlightMat);
    rightHighlight.position.set(0.11, 0.095, 0.035);
    this.face.add(rightHighlight);

    // Mouth - small curved line (made with torus segment)
    const mouthGeom = new THREE.TorusGeometry(0.06, 0.012, 8, 12, Math.PI * 0.6);
    const mouthMat = new THREE.MeshStandardMaterial({
      color: 0x8a4030,
      roughness: 0.5,
    });
    this.mouth = new THREE.Mesh(mouthGeom, mouthMat);
    this.mouth.position.set(0, -0.06, 0);
    this.mouth.rotation.z = Math.PI; // Smile curve
    this.face.add(this.mouth);

    // Blush cheeks
    const blushGeom = new THREE.CircleGeometry(0.04, 12);
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xffb0a0,
      transparent: true,
      opacity: 0.4,
    });
    
    const leftBlush = new THREE.Mesh(blushGeom, blushMat);
    leftBlush.position.set(-0.16, -0.02, 0.01);
    this.face.add(leftBlush);

    const rightBlush = new THREE.Mesh(blushGeom, blushMat);
    rightBlush.position.set(0.16, -0.02, 0.01);
    this.face.add(rightBlush);

    // Hands - two small spheres
    const handGeom = new THREE.SphereGeometry(0.08, 16, 12);
    const handMat = new THREE.MeshStandardMaterial({
      color: this.bodyColor,
      roughness: 0.4,
      metalness: 0.1,
      emissive: this.bodyColor,
      emissiveIntensity: 0.1,
    });

    // Left hand
    this.leftHand = new THREE.Group();
    const leftHandMesh = new THREE.Mesh(handGeom, handMat);
    leftHandMesh.castShadow = true;
    this.leftHand.add(leftHandMesh);
    
    // Add small fingers (3 tiny spheres)
    this._addFingers(this.leftHand, handMat);
    
    this.leftHand.position.set(-0.45, -0.05, 0.1);
    this.group.add(this.leftHand);

    // Right hand
    this.rightHand = new THREE.Group();
    const rightHandMesh = new THREE.Mesh(handGeom, handMat);
    rightHandMesh.castShadow = true;
    this.rightHand.add(rightHandMesh);
    
    this._addFingers(this.rightHand, handMat);
    
    this.rightHand.position.set(0.45, -0.05, 0.1);
    this.group.add(this.rightHand);

    // Arm connectors (subtle lines connecting body to hands)
    const armMat = new THREE.MeshStandardMaterial({
      color: this.bodyColor,
      roughness: 0.5,
      transparent: true,
      opacity: 0.6,
    });

    const leftArmGeom = new THREE.CylinderGeometry(0.02, 0.025, 0.25, 8);
    const leftArm = new THREE.Mesh(leftArmGeom, armMat);
    leftArm.position.set(-0.32, -0.02, 0.05);
    leftArm.rotation.z = Math.PI / 6;
    this.group.add(leftArm);

    const rightArm = new THREE.Mesh(leftArmGeom.clone(), armMat);
    rightArm.position.set(0.32, -0.02, 0.05);
    rightArm.rotation.z = -Math.PI / 6;
    this.group.add(rightArm);

    // Apply scale and position
    this.group.scale.setScalar(this.scale);
    this.group.position.copy(this.position);

    // Add to scene
    this.scene.add(this.group);
    
    // Call ready callback
    this.onReady();
  }

  // ── Speech bubble above head ──────────────────────────────
  // Uses THREE.Sprite, which is intrinsically camera-facing AND draws the
  // texture upright/non-mirrored at every angle. This avoids the manual
  // billboard math previously needed for a flat plane (which inverted the
  // text whenever the camera viewed it from the back side).
  _buildSpeechBubble() {
    const w = 1024, h = 384;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    this.bubbleCanvas = canvas;
    this.bubbleCtx = canvas.getContext('2d');

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    this.bubbleTex = tex;

    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    // Match previous plane size (1024:384 → 2.0m × 0.75m)
    sprite.scale.set(2.0, 0.75, 1);
    sprite.position.set(0, 0.95, 0);
    sprite.renderOrder = 999;
    sprite.visible = false;
    this.bubble = sprite;
    this.group.add(sprite);
  }

  _drawBubbleText(text) {
    const ctx = this.bubbleCtx;
    if (!ctx) return;
    const w = this.bubbleCanvas.width, h = this.bubbleCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Rounded bubble with downward tail
    const pad = 28;
    const rectX = pad, rectY = pad, rectW = w - pad*2, rectH = h - pad*2 - 30;
    const r = 36;
    ctx.beginPath();
    ctx.moveTo(rectX + r, rectY);
    ctx.lineTo(rectX + rectW - r, rectY);
    ctx.quadraticCurveTo(rectX + rectW, rectY, rectX + rectW, rectY + r);
    ctx.lineTo(rectX + rectW, rectY + rectH - r);
    ctx.quadraticCurveTo(rectX + rectW, rectY + rectH, rectX + rectW - r, rectY + rectH);
    // Tail
    ctx.lineTo(w/2 + 36, rectY + rectH);
    ctx.lineTo(w/2,      rectY + rectH + 40);
    ctx.lineTo(w/2 - 36, rectY + rectH);
    ctx.lineTo(rectX + r, rectY + rectH);
    ctx.quadraticCurveTo(rectX, rectY + rectH, rectX, rectY + rectH - r);
    ctx.lineTo(rectX, rectY + r);
    ctx.quadraticCurveTo(rectX, rectY, rectX + r, rectY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 250, 240, 0.96)';
    ctx.fill();
    ctx.strokeStyle = `#${this.bodyColor.toString(16).padStart(6,'0')}`;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Wrapped text
    ctx.fillStyle = '#3a2818';
    ctx.font = 'bold 44px "Microsoft YaHei", "Segoe UI", Arial';
    ctx.textBaseline = 'top';
    const lines = this._wrapText(ctx, String(text || ''), rectW - 60);
    const lineH = 56;
    const maxLines = Math.max(1, Math.floor((rectH - 40) / lineH));
    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines) shown[maxLines - 1] = shown[maxLines - 1].slice(0, -1) + '…';
    shown.forEach((ln, i) => ctx.fillText(ln, rectX + 30, rectY + 20 + i * lineH));

    this.bubbleTex.needsUpdate = true;
  }

  _wrapText(ctx, text, maxWidth) {
    const out = [];
    // Split on whitespace AND keep CJK characters atomic.
    const tokens = text.split(/(\s+|[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])/).filter(Boolean);
    let line = '';
    for (const tok of tokens) {
      const test = line + tok;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line.trim());
        line = tok.replace(/^\s+/, '');
      } else {
        line = test;
      }
      // Hard wrap on newlines too
      if (/\n/.test(tok)) {
        const parts = line.split('\n');
        for (let i = 0; i < parts.length - 1; i++) out.push(parts[i].trim());
        line = parts[parts.length - 1] || '';
      }
    }
    if (line.trim()) out.push(line.trim());
    return out;
  }

  /**
   * Show a speech bubble above the companion. Pass null/empty to hide.
   * The bubble fades in/out smoothly and is billboarded toward the camera.
   *
   * @param {string} text          Bubble text. Supports '\n' for line breaks.
   * @param {number} [duration]    Optional ms to keep the bubble up before
   *                               auto-hiding. If omitted, scales with the
   *                               text length so short quips dismiss quickly
   *                               and longer bilingual lines stay readable.
   */
  say(text, duration) {
    // Cancel any pending auto-hide from a previous utterance so back-to-back
    // calls don't fight each other.
    if (this._sayTimer) {
      clearTimeout(this._sayTimer);
      this._sayTimer = null;
    }
    if (!text) { this.hideBubble(); return; }
    this._drawBubbleText(text);
    if (this.bubble) {
      this.bubble.visible = true;
      this.bubbleTargetOpacity = 1;
    }
    this.startSpeaking();
    this.setEmotion('happy');

    // Heuristic: 1.8s base + ~70ms per visible character, capped at 7s.
    // This roughly matches a comfortable reading pace for bilingual lines
    // ("好棋！ / Nice move!" ≈ 2.4s, longer multi-line greetings ≈ 5–7s).
    if (typeof duration !== 'number') {
      const len = text.replace(/\s+/g, '').length;
      duration = Math.min(7000, Math.max(2200, 1800 + len * 70));
    }
    this._sayTimer = setTimeout(() => {
      this._sayTimer = null;
      this.hideBubble();
    }, duration);
  }

  hideBubble() {
    if (this._sayTimer) {
      clearTimeout(this._sayTimer);
      this._sayTimer = null;
    }
    this.bubbleTargetOpacity = 0;
    this.stopSpeaking();
  }

  /**
   * Set a follow target in parent-local space. The companion will smoothly
   * walk toward this point each frame at `followSpeed` m/s.
   */
  setFollowTarget(localPos) {
    if (!localPos) { this.followTarget = null; return; }
    if (!this.followTarget) this.followTarget = new THREE.Vector3();
    this.followTarget.copy(localPos);
  }

  _addFingers(handGroup, material) {
    const fingerGeom = new THREE.SphereGeometry(0.025, 8, 6);
    const angles = [-0.4, 0, 0.4];
    angles.forEach((angle, i) => {
      const finger = new THREE.Mesh(fingerGeom, material);
      finger.position.set(
        Math.sin(angle) * 0.09,
        0.06 - i * 0.01,
        Math.cos(angle) * 0.09
      );
      handGroup.add(finger);
    });
  }

  // ── Animation Update ──────────────────────────────────────
  update(deltaTime, camWorld) {
    const t = this.clock.getElapsedTime();

    // Breathing animation (body scale pulse)
    this.breathPhase = t * 1.2;
    const breathScale = 1 + Math.sin(this.breathPhase) * 0.03;
    this.body.scale.setScalar(breathScale);
    this.aura.scale.setScalar(breathScale * 1.1);

    // Smooth follow toward target (in parent-local space)
    if (this.followTarget) {
      const dx = this.followTarget.x - this.position.x;
      const dz = this.followTarget.z - this.position.z;
      const dy = this.followTarget.y - this.position.y;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > this.followStop) {
        const step = Math.min(dist, this.followSpeed * Math.max(deltaTime, 0));
        const k = step / dist;
        this.position.x += dx * k;
        this.position.y += dy * k;
        this.position.z += dz * k;
      }
    }

    // Floating bob animation (relative to current logical position)
    this.bobPhase = t * 0.8;
    const bobY = Math.sin(this.bobPhase) * 0.05;
    this.group.position.set(this.position.x, this.position.y + bobY, this.position.z);

    // Speech bubble: fade only — Sprite handles billboarding natively.
    if (this.bubble) {
      const op = this.bubbleOpacity + (this.bubbleTargetOpacity - this.bubbleOpacity) * Math.min(1, deltaTime * 6);
      this.bubbleOpacity = op;
      this.bubble.material.opacity = op;
      if (op < 0.01 && this.bubbleTargetOpacity === 0) {
        this.bubble.visible = false;
      }
    }

    // Aura pulse
    if (this.aura.material) {
      this.aura.material.opacity = 0.12 + Math.sin(t * 2) * 0.05;
    }

    // Hand idle animation
    this._animateHands(t);

    // Speaking animation
    if (this.isSpeaking) {
      this._animateSpeaking(t);
    }

    // Listening animation
    if (this.isListening) {
      this._animateListening(t);
    }

    // Look at target (smooth lerp)
    this._updateLookAt(deltaTime);

    // Emotion-based expressions
    this._updateExpression(t);
  }

  _animateHands(t) {
    // Gentle hand float
    const leftFloat = Math.sin(t * 1.5) * 0.03;
    const rightFloat = Math.sin(t * 1.5 + Math.PI) * 0.03;

    this.leftHand.position.y = -0.05 + leftFloat;
    this.rightHand.position.y = -0.05 + rightFloat;

    // Slight rotation
    this.leftHand.rotation.z = Math.sin(t * 0.8) * 0.1;
    this.rightHand.rotation.z = -Math.sin(t * 0.8 + 0.5) * 0.1;
  }

  _animateSpeaking(t) {
    this.speakPhase = t * 8;
    
    // Mouth movement
    const mouthOpen = 0.5 + Math.abs(Math.sin(this.speakPhase)) * 0.5;
    this.mouth.scale.y = mouthOpen;

    // Body slight bounce when speaking
    const speakBounce = Math.sin(this.speakPhase * 0.5) * 0.02;
    this.body.position.y = speakBounce;

    // Hands gesture while speaking
    this.leftHand.position.x = -0.45 + Math.sin(t * 2) * 0.05;
    this.rightHand.position.x = 0.45 - Math.sin(t * 2 + 1) * 0.05;
    
    this.leftHand.position.z = 0.1 + Math.sin(t * 3) * 0.08;
    this.rightHand.position.z = 0.1 + Math.sin(t * 3 + 0.5) * 0.08;
  }

  _animateListening(t) {
    // Tilt head slightly
    this.face.rotation.z = Math.sin(t * 0.5) * 0.08;

    // Hands come together (attentive pose)
    this.leftHand.position.x = -0.35;
    this.rightHand.position.x = 0.35;
    this.leftHand.position.z = 0.2;
    this.rightHand.position.z = 0.2;
  }

  _updateLookAt(deltaTime) {
    // Smooth look-at interpolation
    this.currentLookAt.lerp(this.targetLookAt, deltaTime * 3);
    
    // Calculate rotation to look at target
    const direction = new THREE.Vector3()
      .subVectors(this.currentLookAt, this.group.position)
      .normalize();
    
    if (direction.length() > 0.1) {
      const targetRotationY = Math.atan2(direction.x, direction.z);
      this.group.rotation.y += (targetRotationY - this.group.rotation.y) * deltaTime * 2;
    }
  }

  _updateExpression(t) {
    switch (this.emotionState) {
      case 'happy':
        // Bigger smile
        this.mouth.scale.x = 1.2;
        this.mouth.rotation.z = Math.PI;
        // Squint eyes slightly
        this.eyes.forEach(eye => {
          eye.scale.y = 0.7 + Math.sin(t * 2) * 0.1;
        });
        break;

      case 'thinking':
        // Slight frown, one eye bigger
        this.mouth.scale.x = 0.8;
        this.eyes[0].scale.setScalar(0.9);
        this.eyes[1].scale.setScalar(1.1);
        break;

      case 'empathy':
        // Soft, understanding expression
        this.mouth.scale.x = 0.9;
        this.eyes.forEach(eye => {
          eye.scale.y = 0.85;
        });
        // Slight head tilt
        this.face.rotation.z = -0.1;
        break;

      default: // idle
        // Reset to normal
        this.mouth.scale.set(1, 1, 1);
        this.eyes.forEach(eye => {
          eye.scale.set(1, 1, 1);
        });
        this.face.rotation.z = 0;
    }
  }

  // ── Public API ────────────────────────────────────────────
  
  /**
   * Set the companion to speaking mode (animates mouth and gestures)
   */
  startSpeaking() {
    this.isSpeaking = true;
    this.isListening = false;
  }

  /**
   * Stop speaking animation
   */
  stopSpeaking() {
    this.isSpeaking = false;
    this.mouth.scale.y = 1;
  }

  /**
   * Set to listening mode (attentive pose)
   */
  startListening() {
    this.isListening = true;
    this.isSpeaking = false;
  }

  /**
   * Stop listening mode
   */
  stopListening() {
    this.isListening = false;
  }

  /**
   * Set emotion state for expression changes
   * @param {string} emotion - 'idle' | 'happy' | 'thinking' | 'empathy'
   */
  setEmotion(emotion) {
    this.emotionState = emotion;
  }

  /**
   * Make the companion look at a world position
   * @param {THREE.Vector3} target - World position to look at
   */
  lookAt(target) {
    this.targetLookAt.copy(target);
  }

  /**
   * Wave hand gesture
   */
  wave() {
    const startTime = this.clock.getElapsedTime();
    const originalPos = this.rightHand.position.clone();
    
    const waveAnimation = () => {
      const elapsed = this.clock.getElapsedTime() - startTime;
      if (elapsed > 2) {
        this.rightHand.position.copy(originalPos);
        return;
      }
      
      this.rightHand.position.y = originalPos.y + 0.3;
      this.rightHand.position.x = originalPos.x + Math.sin(elapsed * 10) * 0.1;
      this.rightHand.rotation.z = Math.sin(elapsed * 10) * 0.3;
      
      requestAnimationFrame(waveAnimation);
    };
    
    waveAnimation();
  }

  /**
   * Set companion color (useful when changing zones)
   * @param {number} color - Hex color
   */
  setColor(color) {
    this.bodyColor = color;
    this.body.material.color.setHex(color);
    this.body.material.emissive.setHex(color);
    this.aura.material.color.setHex(color);
    
    // Update hands
    this.leftHand.children.forEach(child => {
      if (child.material) {
        child.material.color.setHex(color);
        child.material.emissive?.setHex(color);
      }
    });
    this.rightHand.children.forEach(child => {
      if (child.material) {
        child.material.color.setHex(color);
        child.material.emissive?.setHex(color);
      }
    });
  }

  /**
   * Move companion to a new position
   * @param {THREE.Vector3} newPosition 
   * @param {number} duration - Animation duration in seconds
   */
  moveTo(newPosition, duration = 1) {
    const startPos = this.position.clone();
    const startTime = this.clock.getElapsedTime();
    
    const moveAnimation = () => {
      const elapsed = this.clock.getElapsedTime() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out
      
      this.position.lerpVectors(startPos, newPosition, easeT);
      this.group.position.copy(this.position);
      
      if (t < 1) {
        requestAnimationFrame(moveAnimation);
      }
    };
    
    moveAnimation();
  }

  /**
   * Show/hide the companion
   * @param {boolean} visible 
   */
  setVisible(visible) {
    this.group.visible = visible;
  }

  /**
   * Remove from scene
   */
  dispose() {
    this.scene.remove(this.group);
    // Dispose geometries and materials
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  /**
   * Set companion mode
   * @param {string} mode - 'idle' | 'speaking' | 'listening'
   */
  setMode(mode) {
    switch (mode) {
      case 'speaking':
        this.startSpeaking();
        break;
      case 'listening':
        this.startListening();
        break;
      default:
        this.stopSpeaking();
        this.stopListening();
    }
  }

  /**
   * Set expression (alias for setEmotion)
   * @param {string} expression - 'idle' | 'happy' | 'thinking' | 'empathy'
   */
  setExpression(expression) {
    this.setEmotion(expression);
  }

  /**
   * Make companion look at student position
   * @param {THREE.Vector3} position - Student position in local coordinates
   */
  lookAtStudent(position) {
    // Convert local position to world if needed
    const worldPos = position.clone();
    if (this.group.parent) {
      this.group.parent.localToWorld(worldPos);
    }
    this.lookAt(worldPos);
  }
}
