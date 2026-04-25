/**
 * VR Rooms - With interactive features
 */
import * as THREE from 'three';
import { AICompanion } from './ai-companion.js';
import { VRVideoPanel } from './vr-interactive.js';
import { mountTripoModel } from './tripo-loader.js';

// ============================================================
//  Base VR Room Class
// ============================================================
class VRRoom {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.roomPosition = options.position || new THREE.Vector3(0, 0, 0);
    this.onReady = options.onReady || (() => {});
    this.onExit = null;
    this.isActive = false;
    
    this.group = new THREE.Group();
    this.group.position.copy(this.roomPosition);
    this.group.visible = false;
    this.scene.add(this.group);
    
    this.companion = null;
    this.exitPortal = null;
    this.interactables = [];
  }

  enter() {
    this.group.visible = true;
    this.isActive = true;
  }

  exit() {
    this.group.visible = false;
    this.isActive = false;
  }

  update(delta, camWorld) {
    if (!this.isActive) return;
    if (this.companion) this.companion.update(delta, camWorld);
  }

  getSpawnPoint() {
    return this.roomPosition.clone().add(new THREE.Vector3(0, 0, 5));
  }

  getLookAtPoint() {
    return this.roomPosition.clone().add(new THREE.Vector3(0, 1.5, -3));
  }

  getExitPortal() { return this.exitPortal; }
  getCompanion() { return this.companion; }
  getInteractables() { return this.interactables; }

  // Returns the bounding box of the room (width, depth, height) so the desktop
  // camera can be clamped inside its walls.
  getRoomSize() { return this.roomSize || { width: 16, depth: 16, height: 5 }; }
  getRoomPosition() { return this.roomPosition.clone(); }
  
  onStudentMessage(msg) {
    if (this.companion) {
      this.companion.setMode('listening');
      this.companion.setExpression('thinking');
    }
  }
  
  onAIStartResponse() {
    if (this.companion) {
      this.companion.setMode('speaking');
      this.companion.setExpression('happy');
    }
  }
  
  onAIEndResponse() {
    if (this.companion) {
      this.companion.setMode('idle');
      this.companion.setExpression('idle');
    }
  }
  
  updateStudentPosition(pos) {
    if (this.companion) {
      this.companion.lookAtStudent(pos.clone().sub(this.roomPosition));
    }
  }

  _buildRoom(width, depth, height, floorColor, wallColor) {
    this.roomSize = { width, depth, height };
    // Floor
    const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9, side: THREE.DoubleSide });
    
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    backWall.position.set(0, height / 2, -depth / 2);
    this.group.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat.clone());
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-width / 2, height / 2, 0);
    this.group.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat.clone());
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(width / 2, height / 2, 0);
    this.group.add(rightWall);

    // Ceiling
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height;
    this.group.add(ceiling);

    // Lighting
    const light = new THREE.PointLight(0xffffff, 1, 30);
    light.position.set(0, height - 0.5, 0);
    this.group.add(light);
    
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.group.add(ambient);
  }

  _buildExitDoor(x, y, z) {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, y, z);

    // Door frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.7 });
    
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.15), frameMat);
    leftFrame.position.set(-0.6, 1.2, 0);
    doorGroup.add(leftFrame);

    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.15), frameMat);
    rightFrame.position.set(0.6, 1.2, 0);
    doorGroup.add(rightFrame);

    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.12, 0.15), frameMat);
    topFrame.position.set(0, 2.34, 0);
    doorGroup.add(topFrame);

    // Exit portal (glowing)
    const portalMat = new THREE.MeshBasicMaterial({ 
      color: 0x00FF88, 
      transparent: true, 
      opacity: 0.4, 
      side: THREE.DoubleSide 
    });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 2.16), portalMat);
    portal.position.set(0, 1.2, 0);
    portal.userData.isExitPortal = true;
    portal.userData.onClick = () => { if (this.onExit) this.onExit(); };
    doorGroup.add(portal);

    // "EXIT" sign
    const signMat = new THREE.MeshBasicMaterial({ color: 0x00FF88 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.02), signMat);
    sign.position.set(0, 2.6, 0);
    doorGroup.add(sign);

    this.exitPortal = portal;
    this.group.add(doorGroup);
  }

  _buildAICompanion(x, y, z, color) {
    this.companion = new AICompanion(this.group, {
      position: new THREE.Vector3(x, y, z),
      scale: 0.8,
      color: color,
      onReady: () => {}
    });
  }
}

// ============================================================
//  Chat Room (谈心区)
// ============================================================
class ChatVRRoom extends VRRoom {
  constructor(scene, options = {}) {
    super(scene, options);

    // Companion behaviour state
    this._studentLocal   = new THREE.Vector3();   // last known player pos in room-local space
    this._hasStudent     = false;
    this._followOffset   = new THREE.Vector3(1.4, -0.3, 1.0); // beside + slightly forward
    this._lastSpokeAt    = 0;
    this._idlePromptDone = false;
    this._isThinking     = false;

    // Voice loop state
    this._rec       = null;
    this._listening = false;

    this.build();
  }

  build() {
    // 自定义壳 —— 木地板纹理、灰泥墙纹理、左右两面挖洞带玻璃窗
    // （窗外漆黑夜色），并且没有顶部 PointLight，光全部交给
    // 壁炉 + 两盏落地灯。
    this._buildChatShell(16, 20, 5);

    // Companion starts a few metres in front of the spawn point — it will
    // then walk over to the user once they appear. Original sphere model with
    // breathing/floating animations and speech bubble (no Tripo replacement).
    this._buildAICompanion(0, 1.3, 2, 0xE8A898);
    this._buildExitDoor(0, 0, 9);

    // ── 朝向规则（约定）─────────────────────────────────────
    // Tripo 生成的 GLB 默认正面朝 -Z（GLTF/Three.js 相机朝向约定）。
    // rotationY = 0       → 物体正面朝 -Z（朝向房间深处的后墙）
    // rotationY = Math.PI → 物体正面朝 +Z（朝向玩家进门方向）
    // rotationY = -π/2    → 物体正面朝 +X（朝向右侧）
    // rotationY = +π/2    → 物体正面朝 -X（朝向左侧）
    //
    // ����家从 z=+9 入场，朝 -Z 走。所以��望玩家看到正面的物件用 π，
    // 朝向沙发/壁炉那侧（-Z）的物件用 0。

    // ── 地毯（用 PlaneGeometry + Canvas 纹理，确保完全平铺地面）─
    const rugTex = this._makePersianRugTexture();
    rugTex.anisotropy = 8;
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 3.6),
      new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.02, 1);
    rug.receiveShadow = true;
    this.group.add(rug);

    // ── Front of room (玩家进门近景：扶手椅+茶几+茶具) ───────

    // 两把扶手椅靠近门口，正面朝 -Z（看向沙发/壁炉），与沙发对话。
    mountTripoModel(this.group, 'armchair_beige',
      { position: [-2.4, 0, 3.8], rotationY: 0,
        targetSize: 1.2, yAlign: 'bottom' });
    mountTripoModel(this.group, 'armchair_beige',
      { position: [2.4, 0, 3.8], rotationY: 0,
        targetSize: 1.2, yAlign: 'bottom' });

    // 圆茶几放在扶手椅与沙发之间（圆形对称，无方向）.
    mountTripoModel(this.group, 'coffee_table_round',
      { position: [0, 0, 1], targetSize: 1.1, yAlign: 'bottom' });

    // 茶具摆在茶几上（茶壶嘴朝玩家好看一些）.
    mountTripoModel(this.group, 'tea_set_porcelain',
      { position: [0, 0.45, 1], rotationY: Math.PI,
        targetSize: 0.55, yAlign: 'bottom' });

    // 地毯上的两个软垫（圆形，无方向）.
    mountTripoModel(this.group, 'floor_cushion_round',
      { position: [-1.2, 0, 2.4], targetSize: 0.7, yAlign: 'bottom' });
    mountTripoModel(this.group, 'floor_cushion_round',
      { position: [1.2, 0, 2.4], targetSize: 0.7, yAlign: 'bottom' });

    // ── Middle of room (沙发组朝玩家) ──────────────────────

    // 大沙发，正面朝 +Z（朝向玩家、朝向前面的扶手椅）.
    mountTripoModel(this.group, 'sofa_coral',
      { position: [0, 0, -2], rotationY: Math.PI,
        targetSize: 3.0, yAlign: 'bottom' });

    // 沙发左右边几（方形，朝向不重要，与沙发对齐就用 π）.
    mountTripoModel(this.group, 'side_table_walnut',
      { position: [-2.6, 0, -2], rotationY: Math.PI,
        targetSize: 0.6, yAlign: 'bottom' });
    mountTripoModel(this.group, 'side_table_walnut',
      { position: [2.6, 0, -2], rotationY: Math.PI,
        targetSize: 0.6, yAlign: 'bottom' });

    // 黑胶唱机正面朝玩家.
    mountTripoModel(this.group, 'vinyl_record_player',
      { position: [-2.6, 0.6, -2], rotationY: Math.PI,
        targetSize: 0.55, yAlign: 'bottom' });

    // 相框组正面朝玩家.
    mountTripoModel(this.group, 'photo_frames_set',
      { position: [2.6, 0.6, -2], rotationY: Math.PI,
        targetSize: 0.5, yAlign: 'bottom' });

    // 沙发两端的落地灯（圆灯罩，无方向）.
    mountTripoModel(this.group, 'floor_lamp_brass',
      { position: [-4.0, 0, -2], targetSize: 1.9, yAlign: 'bottom' });
    mountTripoModel(this.group, 'floor_lamp_brass',
      { position: [4.0, 0, -2], targetSize: 1.9, yAlign: 'bottom' });

    // ── Back wall (后墙焦点：壁炉 + 书架，全部朝玩家) ─────

    // 石砌壁炉，正面朝 +Z（朝玩家）.
    mountTripoModel(this.group, 'fireplace_stone',
      { position: [0, 0, -9.4], rotationY: Math.PI,
        targetSize: 3.4, yAlign: 'bottom' });

    // 两个书架贴后墙、面朝房间内（玩家方向）.
    mountTripoModel(this.group, 'bookshelf_walnut',
      { position: [-6.5, 0, -9.4], rotationY: Math.PI,
        targetSize: 2.6, yAlign: 'bottom' });
    mountTripoModel(this.group, 'bookshelf_walnut',
      { position: [6.5, 0, -9.4], rotationY: Math.PI,
        targetSize: 2.6, yAlign: 'bottom' });

    // 风景画挂在壁炉上方，画面朝玩家.
    mountTripoModel(this.group, 'wall_art_landscape',
      { position: [0, 4.0, -9.85], rotationY: Math.PI,
        targetSize: 1.4, yAlign: 'center' });

    // 古董挂钟挂在壁炉右上方，钟面朝玩家.
    mountTripoModel(this.group, 'wall_clock_antique',
      { position: [4.5, 3.0, -9.85], rotationY: Math.PI,
        targetSize: 0.7, yAlign: 'center' });

    // 壁炉旁地上一摞桌游盒，标签轻微斜对玩家.
    mountTripoModel(this.group, 'board_games_stack',
      { position: [-2.6, 0, -7.2], rotationY: Math.PI + Math.PI / 8,
        targetSize: 0.75, yAlign: 'bottom' });

    // ── Side walls (每窗一帘，宽度严丝合缝对齐窗框两侧) ─
    // 窗户内宽 3.0m + 左右木窗框各 0.10m → 窗框外宽 = 3.20m。
    // 窗范围 y=1..4，外加顶框 0.10、窗台 0.14 → 外高 ~3.24m。
    // 窗帘左右紧贴窗框外缘（fitWidth 3.20），高度从 y=0.30 起、
    // 总高 3.90m 略高于窗顶约 0.16m，遮住整个木窗框上沿。
    mountTripoModel(this.group, 'window_curtain',
      { position: [-7.82, 0.30, -3], rotationY: -Math.PI / 2,
        fitWidth: 3.20, fitHeight: 3.90, yAlign: 'bottom' });
    mountTripoModel(this.group, 'window_curtain',
      { position: [7.82, 0.30, -3], rotationY: Math.PI / 2,
        fitWidth: 3.20, fitHeight: 3.90, yAlign: 'bottom' });

    // 后墙左上角悬挂吊兰（圆形植物，无方向；从挂钩 y 向下垂）.
    mountTripoModel(this.group, 'plant_pothos_hanging',
      { position: [-6.5, 4.6, -8.8], targetSize: 1.3, yAlign: 'top' });

    // 进门两侧的绿植（圆形，无方向）.
    mountTripoModel(this.group, 'plant_leafy',
      { position: [6.5, 0, 7.5], targetSize: 0.95, yAlign: 'bottom' });
    mountTripoModel(this.group, 'plant_leafy',
      { position: [-6.5, 0, 7.5], targetSize: 0.95, yAlign: 'bottom' });

    this.onReady();
  }

  // ── 房间外壳（地板/墙/天花板/带窗户的两侧墙/灯光）──────
  _buildChatShell(width, depth, height) {
    this.roomSize = { width, depth, height };

    // 地板：木地板纹理
    const floorTex = this._makeWoodFloorTexture();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.repeat.set(2, 2.5);
    floorTex.anisotropy = 8;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.78, metalness: 0.04 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // 墙壁纹理（共享 canvas，每面墙单独 clone 控制 repeat）
    const wallTex = this._makeWallTexture();
    const _setWallMap = (mesh, rx, ry) => {
      const m = wallTex.clone();
      m.wrapS = m.wrapT = THREE.RepeatWrapping;
      m.colorSpace = THREE.SRGBColorSpace;
      m.repeat.set(rx, ry);
      m.needsUpdate = true;
      mesh.material.map = m;
      mesh.material.needsUpdate = true;
    };

    const wallMatProto = () =>
      new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide });

    // 后墙
    const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMatProto());
    back.position.set(0, height / 2, -depth / 2);
    _setWallMap(back, width / 4, height / 4);
    this.group.add(back);

    // 前墙（出口门那侧）
    const front = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMatProto());
    front.position.set(0, height / 2, depth / 2);
    front.rotation.y = Math.PI;
    _setWallMap(front, width / 4, height / 4);
    this.group.add(front);

    // 左 / 右墙（带挖洞窗户 + 木窗框 + 漆黑夜色）
    this._buildWindowWall(-1, width, depth, height, wallTex);
    this._buildWindowWall(+1, width, depth, height, wallTex);

    // 天花板（暖白）
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: 0xFAF0DC, roughness: 0.95 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = height;
    this.group.add(ceil);

    // ── 灯光：去���所有顶光，全靠壁炉 + 落地灯 ─────────────
    // 极弱暖色环境光，避免完全死黑.
    const ambient = new THREE.AmbientLight(0xFFE0B5, 0.20);
    this.group.add(ambient);

    // 壁炉橙红色 PointLight（位置在壁炉前方约 0.4m，update 中 flicker）.
    const fire = new THREE.PointLight(0xFF6A26, 2.6, 14, 1.6);
    fire.position.set(0, 1.1, -8.2);
    this.group.add(fire);
    this._fireLight = fire;
    this._fireLightBase = 2.6;

    // 两盏落地灯暖光（位置与 floor_lamp_brass 模型对齐 y≈灯罩高度）.
    const lampL = new THREE.PointLight(0xFFC880, 1.9, 9, 1.5);
    lampL.position.set(-4.0, 1.7, -2);
    this.group.add(lampL);
    const lampR = new THREE.PointLight(0xFFC880, 1.9, 9, 1.5);
    lampR.position.set(4.0, 1.7, -2);
    this.group.add(lampR);
    this._lampL = lampL;
    this._lampR = lampR;
    this._lampBase = 1.9;
  }

  // 在 -1 / +1 侧墙挖一个矩形窗洞，加木窗框，外侧贴黑色 plane 当夜色.
  _buildWindowWall(side, width, depth, height, wallTex) {
    const halfDepth = depth / 2;
    const winW = 3.0;
    const winH = 3.0;
    const winZ = -3;             // 窗中心沿 z 的位置（房间深度方向）
    const winY = 1.0 + winH / 2; // 窗中心高度（底 1.0m → 顶 4.0m）

    // wall 平面 shape，X 对应世界 z，Y 对应世界 y.
    const shape = new THREE.Shape();
    shape.moveTo(-halfDepth, 0);
    shape.lineTo(halfDepth, 0);
    shape.lineTo(halfDepth, height);
    shape.lineTo(-halfDepth, height);
    shape.closePath();

    // 平面是 local XY，整体绕 Y 轴旋转 ±π/2 后：
    //   side = -1 (左墙, rotation.y = +π/2): local +X → world -Z
    //   side = +1 (右墙, rotation.y = -π/2): local +X → world +Z
    // 所以让 hole 落在世界 z = winZ 处，hole 的 local X 中心必须等于
    // side * winZ（左墙为 +3、右墙为 -3）。
    const winLocalX = side * winZ;
    const hole = new THREE.Path();
    hole.moveTo(winLocalX - winW / 2, winY - winH / 2);
    hole.lineTo(winLocalX + winW / 2, winY - winH / 2);
    hole.lineTo(winLocalX + winW / 2, winY + winH / 2);
    hole.lineTo(winLocalX - winW / 2, winY + winH / 2);
    hole.closePath();
    shape.holes.push(hole);

    const geom = new THREE.ShapeGeometry(shape);
    // ShapeGeometry 默认 UV = 形状 XY；映射到 [0..1] × [0..1]，让纹理能 repeat.
    const uv = geom.attributes.uv.array;
    for (let i = 0; i < uv.length; i += 2) {
      uv[i]     = (uv[i]     + halfDepth) / 4;
      uv[i + 1] = uv[i + 1] / 4;
    }
    geom.attributes.uv.needsUpdate = true;

    const wallMap = wallTex.clone();
    wallMap.wrapS = wallMap.wrapT = THREE.RepeatWrapping;
    wallMap.colorSpace = THREE.SRGBColorSpace;
    wallMap.needsUpdate = true;

    const wall = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.95, side: THREE.DoubleSide })
    );
    wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(side * width / 2, 0, 0);
    this.group.add(wall);

    // 窗外漆黑夜色（黑色 Plane 放在墙外侧 0.25m 处）.
    const night = new THREE.Mesh(
      new THREE.PlaneGeometry(winW * 1.05, winH * 1.05),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    night.position.set(side * (width / 2 + 0.25), winY, winZ);
    night.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    this.group.add(night);

    // 木质窗框 + 十字格.
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4E342E, roughness: 0.6, metalness: 0.05 });
    const T = 0.10;
    const D = 0.08;
    const frame = new THREE.Group();

    const top = new THREE.Mesh(new THREE.BoxGeometry(winW + T * 2, T, D), frameMat);
    top.position.set(0, winH / 2 + T / 2, 0); frame.add(top);

    // 较厚的窗台
    const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + T * 4, T * 1.4, D * 1.8), frameMat);
    sill.position.set(0, -winH / 2 - T * 0.7, D * 0.4); frame.add(sill);

    const lf = new THREE.Mesh(new THREE.BoxGeometry(T, winH + T * 2, D), frameMat);
    lf.position.set(-winW / 2 - T / 2, 0, 0); frame.add(lf);

    const rf = new THREE.Mesh(new THREE.BoxGeometry(T, winH + T * 2, D), frameMat);
    rf.position.set(winW / 2 + T / 2, 0, 0); frame.add(rf);

    // 十字 mullion
    const vM = new THREE.Mesh(new THREE.BoxGeometry(T * 0.55, winH, D * 0.6), frameMat);
    frame.add(vM);
    const hM = new THREE.Mesh(new THREE.BoxGeometry(winW, T * 0.55, D * 0.6), frameMat);
    frame.add(hM);

    frame.position.set(side * (width / 2 - 0.02), winY, winZ);
    frame.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    this.group.add(frame);
  }

  // ── 程序化木地板纹理 ──────────────────────────────────
  _makeWoodFloorTexture() {
    const W = 1024, H = 1024;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#7A5A3A';
    ctx.fillRect(0, 0, W, H);

    const planks = 8;
    const ph = H / planks;
    const baseColors = ['#8a6843', '#9a7651', '#7d5d3c', '#a5825c', '#876442', '#946f49'];

    for (let i = 0; i < planks; i++) {
      ctx.fillStyle = baseColors[i % baseColors.length];
      ctx.fillRect(0, i * ph, W, ph);

      // 长木纹（多条 bezier）
      for (let g = 0; g < 14; g++) {
        ctx.strokeStyle = 'rgba(40,25,15,' + (0.04 + Math.random() * 0.06) + ')';
        ctx.lineWidth = 1 + Math.random() * 1.2;
        ctx.beginPath();
        const y = i * ph + Math.random() * ph;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(
          W * 0.33, y + (Math.random() - 0.5) * 6,
          W * 0.66, y + (Math.random() - 0.5) * 6,
          W,        y + (Math.random() - 0.5) * 6
        );
        ctx.stroke();
      }

      // 板间深缝
      ctx.strokeStyle = 'rgba(20,10,5,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, i * ph);
      ctx.lineTo(W, i * ph);
      ctx.stroke();

      // 板内一两道纵向短缝（错落）
      const seamCount = 1 + Math.floor(Math.random() * 2);
      for (let s = 0; s < seamCount; s++) {
        const x = ((s + 1) / (seamCount + 1)) * W +
                  (Math.random() - 0.5) * (W / (seamCount + 1)) * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, i * ph);
        ctx.lineTo(x, (i + 1) * ph);
        ctx.stroke();
      }
    }

    return new THREE.CanvasTexture(c);
  }

  // ── 程序化奶油色灰泥墙纹理 ────────────────────────────
  _makeWallTexture() {
    const W = 512, H = 512;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#F1DDB6';
    ctx.fillRect(0, 0, W, H);

    // 灰泥噪点
    const img = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() - 0.5) * 14;
      img.data[i]     = Math.max(0, Math.min(255, img.data[i]     + v));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + v));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + v));
    }
    ctx.putImageData(img, 0, 0);

    // 长条柔和的灰泥纹路
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = 'rgba(120,90,60,' + (0.03 + Math.random() * 0.04) + ')';
      ctx.lineWidth = 1 + Math.random() * 1.5;
      const x = Math.random() * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(
        x + (Math.random() - 0.5) * 40, H * 0.3,
        x + (Math.random() - 0.5) * 40, H * 0.7,
        x + (Math.random() - 0.5) * 60, H
      );
      ctx.stroke();
    }

    return new THREE.CanvasTexture(c);
  }

  // ── 火焰 / 落地灯 flicker ─────────────────────────────
  update(delta, camWorld) {
    super.update(delta, camWorld);
    const t = performance.now() * 0.001;
    if (this._fireLight) {
      const flicker =
        0.85 +
        Math.sin(t * 7.3) * 0.08 +
        Math.sin(t * 13.1) * 0.05 +
        Math.random() * 0.10;
      this._fireLight.intensity = this._fireLightBase * flicker;
    }
    if (this._lampL && this._lampR) {
      const lf = 0.96 + Math.sin(t * 2.1) * 0.02 + (Math.random() - 0.5) * 0.02;
      this._lampL.intensity = this._lampBase * lf;
      this._lampR.intensity = this._lampBase * (lf + 0.01);
    }
  }

  // ── Persian rug procedural texture ────────────────────────
  // 程序化生成一张波斯地毯纹理：深红底 + 米色/深蓝边框 + 中央椭圆纹章 +
  // 角花。比 Tripo 生成的"立体地毯"更适合贴在 PlaneGeometry 上。
  _makePersianRugTexture() {
    const W = 768, H = 480;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    // 主色：深红羊毛
    ctx.fillStyle = '#8b1f2b';
    ctx.fillRect(0, 0, W, H);

    // 流苏边（短米色条纹，仅左右两端）
    ctx.fillStyle = '#e8d4a8';
    for (let i = 0; i < W; i += 6) {
      ctx.fillRect(i, 0, 3, 14);
      ctx.fillRect(i, H - 14, 3, 14);
    }

    // 外框：米色宽带
    ctx.strokeStyle = '#e8d4a8';
    ctx.lineWidth = 18;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    // 内框：深蓝
    ctx.strokeStyle = '#1f3a5f';
    ctx.lineWidth = 8;
    ctx.strokeRect(58, 58, W - 116, H - 116);

    // 米色细线分隔
    ctx.strokeStyle = '#e8d4a8';
    ctx.lineWidth = 2;
    ctx.strokeRect(72, 72, W - 144, H - 144);

    // 中央椭圆纹章
    const cx = W / 2, cy = H / 2;
    ctx.fillStyle = '#1f3a5f';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 130, 78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8d4a8';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 88, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b1f2b';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 54, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    // 中心小米色十字
    ctx.fillStyle = '#e8d4a8';
    ctx.fillRect(cx - 3, cy - 16, 6, 32);
    ctx.fillRect(cx - 16, cy - 3, 32, 6);

    // 四角花朵
    const corners = [
      [110, 110], [W - 110, 110],
      [110, H - 110], [W - 110, H - 110],
    ];
    for (const [x, y] of corners) {
      ctx.fillStyle = '#1f3a5f';
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8d4a8';
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * 14, y + Math.sin(ang) * 14, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 边带上的小菱形点缀
    ctx.fillStyle = '#1f3a5f';
    for (let x = 110; x < W - 90; x += 80) {
      this._diamond(ctx, x, 45, 6);
      this._diamond(ctx, x, H - 45, 6);
    }
    for (let y = 110; y < H - 90; y += 80) {
      this._diamond(ctx, 45, y, 6);
      this._diamond(ctx, W - 45, y, 6);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  _diamond(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
  }

  getSpawnPoint() {
    return this.roomPosition.clone().add(new THREE.Vector3(0, 0, 6));
  }

  // ── Lifecycle ─────────────────────────────────────────────
  enter() {
    super.enter();
    if (typeof Agent !== 'undefined' && Agent.setZone) Agent.setZone('chat');
    this._idlePromptDone = false;
    this._lastSpokeAt = performance.now();

    // Greet shortly after entry, once the companion has had time to walk over.
    setTimeout(() => {
      if (!this.isActive) return;
      this.companion?.say('嘿，我在这儿陪着你。\n想聊点什么都可以——只要按下说话就行。');
      this._lastSpokeAt = performance.now();
      this._startListening();
    }, 1500);
  }

  exit() {
    super.exit();
    this._stopListening();
    this._releaseMicStream();
    this.companion?.hideBubble();
    this.companion?.setMode('idle');
  }

  // Called every frame with the player's world position.
  updateStudentPosition(worldPos) {
    if (!this.companion) return;
    // Convert world → room-local (same space companion lives in).
    const local = this._studentLocal.copy(worldPos).sub(this.roomPosition);
    this._hasStudent = true;
    // Tell companion to gaze at the student.
    this.companion.lookAtStudent(local.clone());

    // Compute a follow target a comfortable distance to the side of the user,
    // clamped inside the room so the ball never tries to walk through walls.
    const tgt = local.clone().add(this._followOffset);
    const half = (this.roomSize?.width || 16) / 2 - 1.0;
    const halfD = (this.roomSize?.depth || 20) / 2 - 1.0;
    tgt.x = Math.max(-half, Math.min(half, tgt.x));
    tgt.z = Math.max(-halfD, Math.min(halfD, tgt.z));
    tgt.y = 1.3;
    this.companion.setFollowTarget(tgt);
  }

  // ── Voice loop ────────────────────────────────────────────
  // Pick the audio input most likely to be the VR headset's microphone.
  // On Quest Browser standalone there's only one device (the headset mic) so
  // this trivially returns it. On PC + Quest Link, this prefers a device
  // whose label mentions Quest/Oculus/Meta/headset/VR/communications, so
  // SpeechRecognition (which follows the active getUserMedia stream's
  // routing) reads from the headset mic instead of the laptop mic.
  async _pickHeadsetDeviceId() {
    if (!navigator.mediaDevices?.enumerateDevices) return null;
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const mics = devs.filter(d => d.kind === 'audioinput');
      if (mics.length === 0) return null;
      const score = (label) => {
        const s = (label || '').toLowerCase();
        let pts = 0;
        if (/quest|oculus|meta/.test(s)) pts += 5;
        if (/headset|head[\s-]?mounted|hmd|vr/.test(s)) pts += 4;
        if (/communications/.test(s)) pts += 2;   // Windows "Communications" default
        if (/usb|wireless|bluetooth/.test(s)) pts += 1;
        return pts;
      };
      mics.sort((a, b) => score(b.label) - score(a.label));
      return mics[0].deviceId || null;
    } catch (e) {
      return null;
    }
  }

  // Acquire and pin a mic stream to the chosen (headset) device. Holding the
  // stream open while SpeechRecognition is active reliably routes recognition
  // through the same physical mic on Chromium/WebView platforms.
  async _ensureMicStream() {
    if (this._micStream) return this._micStream;
    if (!navigator.mediaDevices?.getUserMedia) return null;
    // First request without a deviceId so device labels become readable
    // (browsers hide labels until permission has been granted at least once).
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach(t => t.stop());
    } catch (e) {
      console.warn('[ChatRoom] mic permission denied:', e);
      return null;
    }
    const deviceId = await this._pickHeadsetDeviceId();
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    };
    try {
      this._micStream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = this._micStream.getAudioTracks()[0];
      console.log('[ChatRoom] mic in use:', track?.label || '(unlabeled)');
      return this._micStream;
    } catch (e) {
      // Fall back to any mic if the explicit deviceId failed.
      try {
        this._micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return this._micStream;
      } catch (e2) {
        console.warn('[ChatRoom] mic acquire failed:', e2);
        return null;
      }
    }
  }

  _releaseMicStream() {
    if (this._micStream) {
      try { this._micStream.getTracks().forEach(t => t.stop()); } catch (_) {}
      this._micStream = null;
    }
  }

  _ensureRecognizer() {
    if (this._rec) return this._rec;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { console.warn('[ChatRoom] SpeechRecognition not supported'); return null; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'zh-CN';
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (last.isFinal) {
        const text = (last[0].transcript || '').trim();
        if (text) this._onUserSpeech(text);
      }
    };
    rec.onend = () => {
      // Auto-restart while the room is active and we're not awaiting a reply.
      if (this._listening && this.isActive && !this._isThinking) {
        try { rec.start(); } catch (_) { /* race: ignore */ }
      }
    };
    rec.onerror = (e) => {
      // 'no-speech' / 'aborted' are normal in a continuous loop — silently retry.
      if (this._listening && this.isActive && e.error !== 'not-allowed') {
        setTimeout(() => { try { rec.start(); } catch (_) {} }, 400);
      }
    };
    this._rec = rec;
    return rec;
  }

  async _startListening() {
    // Make sure the headset mic is open BEFORE recognition starts so the
    // recognition engine binds to that audio device.
    await this._ensureMicStream();
    if (!this.isActive) return;
    const rec = this._ensureRecognizer();
    if (!rec) return;
    this._listening = true;
    this.companion?.setMode('listening');
    try { rec.start(); } catch (_) { /* already started */ }
  }

  _stopListening() {
    this._listening = false;
    try { this._rec?.stop(); } catch (_) {}
  }

  async _onUserSpeech(text) {
    if (!this.isActive) return;
    this._isThinking = true;
    try { this._rec?.stop(); } catch (_) {}
    this.companion?.setMode('idle');
    this.companion?.setExpression('thinking');
    this.companion?.say('嗯……让我想想怎么回应你。');

    let reply;
    try {
      reply = (typeof Agent !== 'undefined' && Agent.chat) ? await Agent.chat(text) : '我在听。';
    } catch (e) {
      reply = '我刚走神了，能再说一遍吗？';
    }
    if (!this.isActive) return;
    this.companion?.say(reply);
    this._lastSpokeAt = performance.now();

    // Resume listening after the bubble has had time to read.
    const dur = Math.min(8000, 2200 + (reply?.length || 0) * 60);
    setTimeout(() => {
      this._isThinking = false;
      if (this.isActive) this._startListening();
      else this.companion?.hideBubble();
    }, dur);
  }
}

// ============================================================
//  Study Room (学习区)
// ============================================================
class StudyVRRoom extends VRRoom {
  constructor(scene, options = {}) {
    super(scene, options);
    this.build();
  }

  build() {
    this._buildRoom(16, 18, 5, 0xE8E0D0, 0xF0F8FF);
    this._buildAICompanion(0, 0.5, -4, 0x98B8D8);
    this._buildExitDoor(0, 0, 8);
    
    // Cool lighting
    const coolLight = new THREE.PointLight(0xE0E8FF, 0.6, 15);
    coolLight.position.set(0, 4, -2);
    this.group.add(coolLight);
    
    // Whiteboard
    const boardFrameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(5, 2.5, 0.1), boardFrameMat);
    boardFrame.position.set(0, 2.5, -8.9);
    this.group.add(boardFrame);
    
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.3 });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.3), boardMat);
    board.position.set(0, 2.5, -8.84);
    this.group.add(board);
    
    // Student desks + chairs (cached → 1 fetch for all 6 seats).
    for (let row = 0; row < 2; row++) {
      for (let col = -1; col <= 1; col++) {
        mountTripoModel(this.group, 'student_desk_chair', {
          position: [col * 2.5, 0, 3 + row * 2],
          rotationY: Math.PI,           // face the whiteboard
          targetSize: 1.4,
          yAlign: 'bottom',
        });
      }
    }

    // Teacher lectern.
    mountTripoModel(this.group, 'lectern_oak',
      { position: [0, 0, -5], targetSize: 2.0, yAlign: 'bottom' });

    // Two side bookshelves (cached).
    mountTripoModel(this.group, 'bookshelf_classroom',
      { position: [-7, 0, 0], rotationY: Math.PI / 2, targetSize: 2.6, yAlign: 'bottom' });
    mountTripoModel(this.group, 'bookshelf_classroom',
      { position: [7, 0, 0], rotationY: -Math.PI / 2, targetSize: 2.6, yAlign: 'bottom' });

    this.onReady();
  }

  getSpawnPoint() {
    return this.roomPosition.clone().add(new THREE.Vector3(0, 0, 5));
  }
}

// ============================================================
//  Leisure Room (休闲区)
// ============================================================
class LeisureVRRoom extends VRRoom {
  constructor(scene, options = {}) {
    super(scene, options);
    this.build();
  }

  build() {
    this._buildRoom(18, 16, 6, 0x1a1a1a, 0x12121a);
    this._buildAICompanion(-3, 0.5, 1, 0xC0A0D8);
    this._buildExitDoor(0, 0, 7);
    
    // Theater ambient lighting
    const ambLight = new THREE.AmbientLight(0x6060a0, 0.15);
    this.group.add(ambLight);
    
    const leftLight = new THREE.PointLight(0x6040a0, 0.5, 10);
    leftLight.position.set(-8, 3, 0);
    this.group.add(leftLight);
    
    const rightLight = new THREE.PointLight(0x4060a0, 0.5, 10);
    rightLight.position.set(8, 3, 0);
    this.group.add(rightLight);
    
    // Movie screen with frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9, 5.5, 0.2), frameMat);
    frame.position.set(0, 3, -7.8);
    this.group.add(frame);
    
    const screenMat = new THREE.MeshStandardMaterial({ 
      color: 0x2a2a3a, 
      emissive: 0x4040FF, 
      emissiveIntensity: 0.3 
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 5), screenMat);
    screen.position.set(0, 3, -7.7);
    this.group.add(screen);
    
    // Screen glow
    const screenLight = new THREE.PointLight(0x6666FF, 0.6, 10);
    screenLight.position.set(0, 3, -5);
    this.group.add(screenLight);
    
    // Cinema seats (cached → 1 fetch for all 10 seats).
    for (let row = 0; row < 2; row++) {
      for (let col = -2; col <= 2; col++) {
        mountTripoModel(this.group, 'cinema_seat_red', {
          position: [col * 1.5, 0, 3 + row * 2],
          rotationY: Math.PI,
          targetSize: 0.95,
          yAlign: 'bottom',
        });
      }
    }

    // Side table for the popcorn bucket.
    mountTripoModel(this.group, 'side_table_bistro',
      { position: [7, 0, 2], targetSize: 0.9, yAlign: 'bottom' });

    // Popcorn bucket on top of the side table (~0.85m high).
    mountTripoModel(this.group, 'popcorn_bucket',
      { position: [7, 0.85, 2], targetSize: 0.45, yAlign: 'bottom' });
    
    // Video panel on the big screen
    this.videoPanel = new VRVideoPanel(this.group, {
      position: new THREE.Vector3(0, 3, -7.5),
      width: 8,
      height: 4.5,
      onInteract: (action, data) => {
        if (this.companion && action === 'play' && data.playing) {
          this.companion.setExpression('happy');
        }
      }
    });
    this.interactables.push(...this.videoPanel.getInteractables());
    
    this.onReady();
  }

  update(delta) {
    super.update(delta);
    if (this.videoPanel) this.videoPanel.update(delta);
  }

  getSpawnPoint() {
    return this.roomPosition.clone().add(new THREE.Vector3(0, 0, 5));
  }
}

// ============================================================
//  Healing Room (疗愈区)
// ============================================================
class HealingVRRoom extends VRRoom {
  constructor(scene, options = {}) {
    super(scene, options);
    this.build();
  }

  build() {
    this._buildRoom(18, 18, 5, 0xE8DCC8, 0xD4E6D4);
    this._buildAICompanion(2, 0.5, 0, 0x98C8A0);
    this._buildExitDoor(0, 0, 8);
    
    // Soft natural lighting
    const warmLight = new THREE.PointLight(0xFFF5E1, 0.6, 15);
    warmLight.position.set(0, 4, 0);
    this.group.add(warmLight);
    
    // Zen rock garden composition.
    mountTripoModel(this.group, 'zen_rock_garden',
      { position: [-3, 0, -4], targetSize: 3.0, yAlign: 'bottom' });

    // Meditation cushions (cached → 1 fetch for all 3).
    mountTripoModel(this.group, 'cushion_zafu',
      { position: [0, 0, 4], targetSize: 0.6, yAlign: 'bottom' });
    mountTripoModel(this.group, 'cushion_zafu',
      { position: [-2, 0, 3], targetSize: 0.6, yAlign: 'bottom' });
    mountTripoModel(this.group, 'cushion_zafu',
      { position: [2, 0, 3], targetSize: 0.6, yAlign: 'bottom' });

    // Bamboo plants in clay pots (cached).
    for (let i = 0; i < 3; i++) {
      mountTripoModel(this.group, 'bamboo_pot', {
        position: [-8 + i * 0.8, 0, -8],
        rotationY: Math.random() * Math.PI * 2,
        targetSize: 1.6,
        yAlign: 'bottom',
      });
    }

    // Bonsai tree centerpiece.
    mountTripoModel(this.group, 'bonsai_tree',
      { position: [0, 0, -7], targetSize: 1.2, yAlign: 'bottom' });

    // Stone water feature.
    mountTripoModel(this.group, 'tsukubai',
      { position: [5, 0, -5], targetSize: 1.4, yAlign: 'bottom' });

    this.onReady();
  }

  getSpawnPoint() {
    return this.roomPosition.clone().add(new THREE.Vector3(0, 0, 5));
  }
}

// ============================================================
//  Games Room (游戏区)
// ============================================================
class GamesVRRoom extends VRRoom {
  constructor(scene, options = {}) {
    super(scene, options);
    this.build();
  }

  build() {
    this._buildRoom(16, 16, 5, 0x4A4A6A, 0xFFF0E0);
    this._buildAICompanion(2, 0.5, 1, 0xE8D090);
    this._buildExitDoor(0, 0, 7);
    
    // Colorful party lighting
    const light1 = new THREE.PointLight(0xFFAA00, 0.6, 12);
    light1.position.set(-4, 4, 0);
    this.group.add(light1);
    
    const light2 = new THREE.PointLight(0x00AAFF, 0.6, 12);
    light2.position.set(4, 4, 0);
    this.group.add(light2);
    
    const light3 = new THREE.PointLight(0xFF00AA, 0.4, 12);
    light3.position.set(0, 4, -4);
    this.group.add(light3);
    
    // ── Wall-hugging Tripo decorations ───────────────────────────
    // Floor items are pulled away from the walls (x = ±8, z = ±8) by a
    // generous half-depth margin so deep cabinets — especially the
    // pinball — never poke through the wall plane.

    // Two arcade cabinets on the back wall — screens face the player (+Z),
    // each cabinet tilted slightly inward toward room center.
    mountTripoModel(this.group, 'arcade_blue',
      { position: [-6, 0, -7.4], rotationY: Math.PI + Math.PI / 8,
        targetSize: 2.2, yAlign: 'bottom' });
    mountTripoModel(this.group, 'arcade_pink',
      { position: [6, 0, -7.4], rotationY: Math.PI - Math.PI / 8,
        targetSize: 2.2, yAlign: 'bottom' });

    // Pinball machine — slightly smaller and pulled in, since this model
    // is by far the deepest. Sits between the arcades, faces +Z.
    mountTripoModel(this.group, 'pinball_machine',
      { position: [0, 0, -7.35], rotationY: Math.PI,
        targetSize: 1.5, yAlign: 'bottom' });

    // Glowing "GAME ON" neon sign high on the back wall, flat decoration.
    mountTripoModel(this.group, 'neon_game_sign',
      { position: [0, 3.6, -7.92], rotationY: Math.PI,
        targetSize: 2.4, yAlign: 'center' });

    // Dartboard cabinet wall-mounted on the left wall, faces +X.
    mountTripoModel(this.group, 'dartboard_cabinet',
      { position: [-7.92, 1.9, -3.5], rotationY: -Math.PI / 2,
        targetSize: 1.1, yAlign: 'center' });

    // Snack & soda vending machine on the right wall (entrance side).
    mountTripoModel(this.group, 'vending_machine_snacks',
      { position: [7.45, 0, 5], rotationY: Math.PI / 2,
        targetSize: 2.0, yAlign: 'bottom' });

    // Trophy shelf on the left wall (entrance side).
    mountTripoModel(this.group, 'trophy_shelf',
      { position: [-7.45, 0, 5], rotationY: -Math.PI / 2,
        targetSize: 1.4, yAlign: 'bottom' });

    // ── Giant floor game board ──────────────────────────────────
    // 13.6 × 13.6 ≈ 184.96 m² / 256 m² ≈ 72.3% of floor area.
    // Slightly smaller than before so its edges (±6.8) clear all
    // wall-furniture footprints (deepest is the pinball front ≈ z -6.85).
    this._buildFloorBoard(13.6);

    // ── Four wall control buttons ───────────────────────────────
    // Left pair → choose floor-board mode (Go / Chess).
    // Right pair → control gameplay (Start / End).
    // Each button has an icon plate floating just above it.
    const Z_WALL = -7.86;
    const Y_BTN  = 2.55;
    this._buildWallButton({
      position: new THREE.Vector3(-4.5, Y_BTN, Z_WALL),
      label: '五子棋 / 围棋',
      sublabel: 'GO BOARD',
      icon: 'go',
      accent: 0xFFAA00,
      onSelect: () => this._setBoardMode('go'),
    });
    this._buildWallButton({
      position: new THREE.Vector3(-1.8, Y_BTN, Z_WALL),
      label: '国际象棋',
      sublabel: 'CHESS BOARD',
      icon: 'chess',
      accent: 0x00C8FF,
      onSelect: () => this._setBoardMode('chess'),
    });
    this._buildWallButton({
      position: new THREE.Vector3(1.8, Y_BTN, Z_WALL),
      label: '开始游戏',
      sublabel: 'START',
      icon: 'play',
      accent: 0x35E07A,
      onSelect: () => this._startGame(),
    });
    this._buildWallButton({
      position: new THREE.Vector3(4.5, Y_BTN, Z_WALL),
      label: '结束游戏',
      sublabel: 'END',
      icon: 'stop',
      accent: 0xFF5566,
      onSelect: () => this._endGame(),
    });

    this.onReady();
  }

  // ────────────────────────────────────────────────────────────
  //  Game lifecycle stubs — wired up later. Right now they just
  //  give the player a friendly cue so the buttons feel alive.
  // ────────────────────────────────────────────────────────────
  _startGame() {
    if (this.companion) {
      this.companion.setExpression('happy');
      setTimeout(() => this.companion.setExpression('idle'), 1200);
    }
    // TODO: hook into actual game logic when implemented.
  }

  _endGame() {
    if (this.companion) {
      this.companion.setExpression('empathy');
      setTimeout(() => this.companion.setExpression('idle'), 1200);
    }
    // TODO: hook into actual game logic when implemented.
  }

  // ────────────────────────────────────────────────────────────
  //  Floor board: a single thin slab whose top texture is swappable
  //  between Go (19×19 wood + grid) and Chess (8×8 walnut + cream).
  // ────────────────────────────────────────────────────────────
  _buildFloorBoard(side) {
    // Pre-bake two high-resolution canvas textures; swap material.map
    // when the player presses a mode button.
    this._boardTextures = {
      go: this._makeGoBoardTexture(),
      chess: this._makeChessBoardTexture(),
    };

    // Slab body — slim ply giving the board a real edge, like furniture.
    const slabGeom = new THREE.BoxGeometry(side, 0.06, side);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.55,
      metalness: 0.0,
    });
    const slab = new THREE.Mesh(slabGeom, slabMat);
    slab.position.set(0, 0.04, 0);
    this.group.add(slab);

    // Separate top mesh that owns the texture so the slab sides keep a
    // neutral colour even after we swap board art.
    const topGeom = new THREE.PlaneGeometry(side, side);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.55,
      metalness: 0.0,
      map: this._boardTextures.go,
    });
    const top = new THREE.Mesh(topGeom, topMat);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, 0.071, 0);
    this.group.add(top);

    this._boardTopMesh = top;
    this._boardMode = 'go';
  }

  _setBoardMode(mode) {
    if (!this._boardTopMesh || !this._boardTextures?.[mode]) return;
    if (this._boardMode === mode) return;
    this._boardMode = mode;
    this._boardTopMesh.material.map = this._boardTextures[mode];
    this._boardTopMesh.material.needsUpdate = true;

    // Friendly companion reaction so the swap feels alive.
    if (this.companion) {
      this.companion.setExpression('happy');
      setTimeout(() => this.companion.setExpression('idle'), 1200);
    }
  }

  _makeGoBoardTexture() {
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Warm tatami-yellow wood gradient — slightly lighter at centre.
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.7);
    grad.addColorStop(0, '#E9C28B');
    grad.addColorStop(1, '#C99A5B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Subtle wood-grain streaks.
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#7A4A1F';
    ctx.lineWidth = 2;
    for (let i = 0; i < 60; i++) {
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.33, y + (Math.random() - 0.5) * 30,
                        size * 0.66, y + (Math.random() - 0.5) * 30,
                        size, y + (Math.random() - 0.5) * 20);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 19×19 grid (standard go board), inset with a clear margin.
    const margin = size * 0.06;
    const inner = size - margin * 2;
    const cells = 18; // 19 lines → 18 cells
    const step = inner / cells;
    ctx.strokeStyle = '#1A1208';
    ctx.lineWidth = 4;
    for (let i = 0; i <= cells; i++) {
      const p = margin + i * step;
      ctx.beginPath(); ctx.moveTo(margin, p); ctx.lineTo(size - margin, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, margin); ctx.lineTo(p, size - margin); ctx.stroke();
    }

    // Hoshi star points (9 standard positions on a 19×19 board).
    ctx.fillStyle = '#1A1208';
    [3, 9, 15].forEach(ix => {
      [3, 9, 15].forEach(iy => {
        const x = margin + ix * step;
        const y = margin + iy * step;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Decorative outer frame.
    ctx.strokeStyle = '#5C3A14';
    ctx.lineWidth = 14;
    ctx.strokeRect(margin / 2, margin / 2, size - margin, size - margin);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  _makeChessBoardTexture() {
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Dark walnut frame.
    ctx.fillStyle = '#3B2412';
    ctx.fillRect(0, 0, size, size);

    // Inset 8×8 board.
    const margin = size * 0.05;
    const inner = size - margin * 2;
    const cell = inner / 8;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const dark = (r + c) % 2 === 1;
        ctx.fillStyle = dark ? '#7A4A1F' : '#F1DBA8';
        ctx.fillRect(margin + c * cell, margin + r * cell, cell, cell);
      }
    }

    // Subtle wood-grain shading on light squares.
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#7A4A1F';
    for (let i = 0; i < 200; i++) {
      const x = margin + Math.random() * inner;
      const y = margin + Math.random() * inner;
      ctx.fillRect(x, y, 4 + Math.random() * 6, 1);
    }
    ctx.globalAlpha = 1;

    // Gold trim around the playing area.
    ctx.strokeStyle = '#D9B16A';
    ctx.lineWidth = 8;
    ctx.strokeRect(margin, margin, inner, inner);

    // File/rank labels (a–h, 1–8).
    ctx.fillStyle = '#E9D7B0';
    ctx.font = `bold ${Math.floor(size * 0.022)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let i = 0; i < 8; i++) {
      const cx = margin + cell * (i + 0.5);
      ctx.fillText(files[i], cx, margin / 2);
      ctx.fillText(files[i], cx, size - margin / 2);
      const cy = margin + cell * (i + 0.5);
      ctx.fillText(String(8 - i), margin / 2, cy);
      ctx.fillText(String(8 - i), size - margin / 2, cy);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  // ────────────────────────────────────────────────────────────
  //  Wall buttons: arcade-style plates with a separate icon plate
  //  floating just above. The plate physically depresses on click
  //  and the controller pulses (via xr.pulseController). Hooked into
  //  both VR (xr.registerInteractable) and desktop (scene.addClickable)
  //  through userData.onClick — the same handler serves both.
  // ────────────────────────────────────────────────────────────
  _buildWallButton({ position, label, sublabel, icon, accent, onSelect }) {
    const w = 1.5, h = 0.78, d = 0.10;
    const accentHex = `#${accent.toString(16).padStart(6, '0')}`;

    // Root group sits on the back wall and faces the player (+Z).
    const panel = new THREE.Group();
    panel.position.copy(position);
    panel.rotation.y = Math.PI;
    this.group.add(panel);

    // ── Recessed housing (dark frame the button sinks into) ────
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x14141C, roughness: 0.85, metalness: 0.1,
    });
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.04),
      housingMat
    );
    housing.position.set(0, 0, 0.02);
    panel.add(housing);

    // ── Glow halo behind everything ───────────────────────────
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.22, h * 1.32),
      new THREE.MeshBasicMaterial({
        color: accent, transparent: true, opacity: 0.32,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    halo.position.set(0, 0, 0.001);
    panel.add(halo);

    // ── Movable button cap (depresses on click) ───────────────
    const tex = this._makeButtonTexture(label, sublabel, accentHex);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF, map: tex,
      roughness: 0.45, metalness: 0.15,
      emissive: accent, emissiveIntensity: 0.22,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x222230, roughness: 0.7, metalness: 0.25,
      emissive: accent, emissiveIntensity: 0.14,
    });
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat],
    );
    const restZ = d * 0.65;          // resting (out) position
    const pressZ = restZ - 0.045;    // pressed (in)  position
    cap.position.set(0, 0, restZ);
    panel.add(cap);

    // ── Icon plate floating above the button ──────────────────
    const iconTex = this._makeIconTexture(icon, accentHex);
    const iconPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({
        map: iconTex, transparent: true, side: THREE.DoubleSide,
      })
    );
    iconPlate.position.set(0, h / 2 + 0.36, 0.06);
    panel.add(iconPlate);

    // Tiny support stem behind the icon plate so it reads as an
    // attached label rather than a floating sticker.
    const stem = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.16, 0.02),
      housingMat,
    );
    stem.position.set(0, h / 2 + 0.13, 0.04);
    panel.add(stem);

    // ── Accent point light for the "neon" look ────────────────
    const buttonLight = new THREE.PointLight(accent, 0.55, 3.2);
    buttonLight.position.set(0, 0, 0.55);
    panel.add(buttonLight);

    // ── Click handler with press-down + light pulse + haptics ─
    const baseLight = buttonLight.intensity;
    const baseEmit = faceMat.emissiveIntensity;
    let animId = 0;
    const pressVisual = () => {
      // Cancel any in-flight animation so rapid clicks don't fight.
      if (animId) clearTimeout(animId);
      cap.position.z = pressZ;
      buttonLight.intensity = baseLight * 2.6;
      faceMat.emissiveIntensity = 0.85;
      animId = setTimeout(() => {
        cap.position.z = restZ;
        buttonLight.intensity = baseLight;
        faceMat.emissiveIntensity = baseEmit;
        animId = 0;
      }, 180);
    };

    // The interaction systems walk up the parent chain looking for
    // userData.onClick, so registering the cap is enough.
    cap.userData.onClick = (_mesh, ctx) => {
      pressVisual();
      // Haptic kick — XR auto-pulses too, but a stronger custom pulse
      // gives the button a punchier feel than the default tap.
      if (ctx?.xr && ctx?.controller) {
        ctx.xr.pulseController(ctx.controller, 0.85, 110);
      }
      onSelect();
    };
    this.interactables.push(cap);
  }

  // ── Button face texture: title + sublabel only (icon is separate) ──
  _makeButtonTexture(label, sublabel, accentHex) {
    const w = 1024, h = 540;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Dark plate background with a soft vertical gradient.
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#101019');
    bg.addColorStop(1, '#1F1F2C');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Glowing inner border ring in the accent colour.
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 10;
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 24;
    ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.shadowBlur = 0;

    // Title (Chinese).
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 96px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(label, w / 2, h / 2 - 38);

    // Subtitle (English) in accent colour.
    ctx.fillStyle = accentHex;
    ctx.font = 'bold 56px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(sublabel, w / 2, h / 2 + 60);

    // Tiny instruction hint.
    ctx.fillStyle = '#8A8AA0';
    ctx.font = '28px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('点击  ·  TAP', w / 2, h - 46);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  // ── Icon plate texture: dark rounded backing + accent symbol ──
  //   kind: 'go' | 'chess' | 'play' | 'stop'
  _makeIconTexture(kind, accentHex) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Rounded dark backing.
    const r = size * 0.18;
    ctx.fillStyle = '#0E0E16';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r); ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);        ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);           ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    // Glowing accent border.
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 10;
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 22;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Symbol drawing happens inside an inset square.
    const cx = size / 2, cy = size / 2;
    const inset = size * 0.22;

    if (kind === 'go') {
      // 3×3 mini grid with two stones (one black, one white) — instantly
      // reads as "board game with stones".
      const innerL = inset, innerR = size - inset;
      const span = innerR - innerL;
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 6;
      for (let i = 0; i < 3; i++) {
        const p = innerL + (span * i) / 2;
        ctx.beginPath(); ctx.moveTo(innerL, p); ctx.lineTo(innerR, p); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p, innerL); ctx.lineTo(p, innerR); ctx.stroke();
      }
      // Black stone
      ctx.fillStyle = '#0A0A10';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(innerL + span * 0.0, innerL + span * 0.0, span * 0.18, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // White stone
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0A0A10';
      ctx.beginPath();
      ctx.arc(innerL + span * 1.0, innerL + span * 1.0, span * 0.18, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

    } else if (kind === 'chess') {
      // Stylised chess king silhouette.
      ctx.fillStyle = accentHex;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      // Cross on top
      ctx.fillRect(cx - 12, cy - 170, 24, 60);
      ctx.fillRect(cx - 36, cy - 146, 72, 24);
      // Crown band
      ctx.beginPath();
      ctx.moveTo(cx - 90, cy - 90);
      ctx.lineTo(cx + 90, cy - 90);
      ctx.lineTo(cx + 70, cy - 50);
      ctx.lineTo(cx - 70, cy - 50);
      ctx.closePath();
      ctx.fill();
      // Body
      ctx.beginPath();
      ctx.moveTo(cx - 70, cy - 50);
      ctx.lineTo(cx + 70, cy - 50);
      ctx.lineTo(cx + 50, cy + 70);
      ctx.lineTo(cx - 50, cy + 70);
      ctx.closePath();
      ctx.fill();
      // Base
      ctx.fillRect(cx - 100, cy + 70, 200, 32);
      ctx.fillRect(cx - 120, cy + 102, 240, 24);

    } else if (kind === 'play') {
      // Play triangle — equilateral, optically centred (slight x shift).
      ctx.fillStyle = accentHex;
      ctx.beginPath();
      const s = size * 0.34;
      ctx.moveTo(cx - s * 0.55, cy - s);
      ctx.lineTo(cx + s,        cy);
      ctx.lineTo(cx - s * 0.55, cy + s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      ctx.stroke();

    } else if (kind === 'stop') {
      // Stop square.
      ctx.fillStyle = accentHex;
      const s = size * 0.36;
      ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  getSpawnPoint() {
    return this.roomPosition.clone().add(new THREE.Vector3(0, 0, 5));
  }
}

// ============================================================
//  VR Room Manager
// ============================================================
export class VRRoomManager {
  constructor(scene, playerGroup, options = {}) {
    this.scene = scene;
    this.playerGroup = playerGroup;
    this.onRoomEnter = options.onRoomEnter || (() => {});
    this.onRoomExit = options.onRoomExit || (() => {});
    
    this.rooms = new Map();
    this.activeRoom = null;
    this.savedPlayerPos = new THREE.Vector3();
    
    // Room configurations for lazy loading
    this.roomConfigs = {
      chat: { position: new THREE.Vector3(0, 0, -100), RoomClass: ChatVRRoom },
      study: { position: new THREE.Vector3(-100, 0, 0), RoomClass: StudyVRRoom },
      leisure: { position: new THREE.Vector3(100, 0, 0), RoomClass: LeisureVRRoom },
      healing: { position: new THREE.Vector3(0, 0, 100), RoomClass: HealingVRRoom },
      games: { position: new THREE.Vector3(0, 0, 200), RoomClass: GamesVRRoom }
    };
  }

  _getOrCreateRoom(zoneId) {
    if (this.rooms.has(zoneId)) {
      return this.rooms.get(zoneId);
    }

    const config = this.roomConfigs[zoneId];
    if (!config) return null;

    const room = new config.RoomClass(this.scene, {
      position: config.position
    });
    this.rooms.set(zoneId, room);
    return room;
  }

  // Public accessor used by desktop entry flow (no playerGroup mutation).
  getOrCreateRoom(zoneId) {
    return this._getOrCreateRoom(zoneId);
  }

  enterRoom(zoneId) {
    const room = this._getOrCreateRoom(zoneId);
    if (!room) return null;

    // Always (re)bind exit handler — desktop flow may have replaced it.
    room.onExit = () => this.exitRoom();

    if (this.activeRoom) {
      this.activeRoom.exit();
    }

    this.savedPlayerPos.copy(this.playerGroup.position);

    const spawnPoint = room.getSpawnPoint();
    this.playerGroup.position.copy(spawnPoint);

    room.enter();
    this.activeRoom = room;
    
    this.onRoomEnter(zoneId, room);
    return room;
  }

  exitRoom() {
    if (!this.activeRoom) return;

    this.activeRoom.exit();
    this.onRoomExit(this.activeRoom);
    this.activeRoom = null;

    this.playerGroup.position.copy(this.savedPlayerPos);
  }

  update(delta, camWorld) {
    if (this.activeRoom) {
      this.activeRoom.update(delta, camWorld);
    }
  }

  getActiveRoom() {
    return this.activeRoom;
  }
}
