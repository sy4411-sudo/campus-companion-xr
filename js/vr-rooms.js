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
    // ����家从 z=+9 入场���朝 -Z 走。所以��望玩家看到正面的物件用 π，
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

  // ── 火焰 / 落地灯 flicker ─────���������─────────────────────
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
    // Vivid teal-cyan: complementary to the warm tatami-yellow Go board
    // (#E9C28B → #C99A5B) for the highest contrast against the floor,
    // and distinct from the other four zones' companions.
    this._buildAICompanion(2, 0.5, 1, 0x2EC4D8);
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

    // ── Gomoku game state container ─────────────────────────────
    // Geometry constants come straight from _buildFloorBoard so the
    // grid, stones, and click handler all stay in sync if the board
    // is ever resized.
    const GRID = 19;                  // 19 lines on the standard go board
    const sideLen = 13.6;
    const margin = sideLen * 0.06;    // matches _makeGoBoardTexture
    const inner = sideLen - 2 * margin;
    const step = inner / (GRID - 1);
    const stoneR = step * 0.42;       // ~22mm ÷ 26mm cell on a real board
    const stoneT = stoneR * 0.85;     // biconvex thickness (≈9mm/22mm)
    this._gomoku = {
      GRID, step, inner, margin,
      sideLen,
      stoneR, stoneT,
      active: false,
      turn: null,                     // 'player' | 'ai' | null
      board: null,                    // Int8Array[GRID][GRID]: 0/1/2
      stonesGroup: null,              // THREE.Group holding placed stones
      lastMarker: null,               // small ring above last move
      banner: null,                   // victory banner group
      confetti: null,                 // confetti Points + velocities
      stoneGeo: null,
      blackMat: null,
      whiteMat: null,
      thinking: false,
    };
    this._buildGomokuAssets();
    this._enableBoardClick();

    // ── Chess game state container ──────────────────────────────
    // Chess shares the same floor slab as gomoku — only the texture
    // and click semantics change. The 8×8 grid is laid out by the
    // chess board art:  margin = 5%  →  inner = 90%  →  cell = inner/8.
    const chessMargin = sideLen * 0.05;
    const chessInner  = sideLen - 2 * chessMargin;
    const chessCell   = chessInner / 8;
    this._chess = {
      sideLen,
      margin: chessMargin,
      inner: chessInner,
      cell: chessCell,
      active: false,
      turn: null,                     // 'white' | 'black' | null
      board: null,                    // 8×8 of {type:'p|n|b|r|q|k', color}
      pieceMeshes: null,              // 8×8 of THREE.Group (or null)
      selected: null,                 // {r,c} of currently picked piece
      validMoves: null,               // [{from,to,captured?,promotion?}]
      thinking: false,
      anims: [],                      // active piece animations
      piecesGroup: null,
      highlightGroup: null,
      aiCursor: null,
      aiCursorState: 'hidden',        // 'hidden' | 'fadeIn' | 'visible' | 'fadeOut'
      // Asset cache (filled by _buildChessAssets):
      pieceFactories: null,
      whiteMat: null, blackMat: null,
      whiteAccent: null, blackAccent: null,
    };
    this._buildChessAssets();

    // ── Companion personality (童童 / Tongtong) ─────────────────
    // Speech-bubble lines only — every utterance goes through
    // `this.companion.say()` so it appears in the same 3D bubble the
    // chat zone uses, never in the desktop chat panel. Lines are short
    // and bratty/playful to match the Game-Zone systemPrompt.
    // Every line is bilingual (中文 / English) on two stacked rows so the
    // bubble reads naturally for both audiences. Inner emphasis uses the
    // 「 」 brackets — using straight " inside this " - delimited string
    // would terminate the literal and break parsing.
    this._gomokuLines = {
      greet: [
        '嘿嘿~我是童童！来下五子棋吗？\nHi! I\'m Tongtong — wanna play gomoku?',
        '欢迎来轻游戏区！按「开始游戏」开局~\nWelcome! Hit START to begin~',
      ],
      start: [
        '开局啦！你执黑先手~\nGame on! You\'re black, you go first.',
        '准备好啦~黑棋你先来！\nReady! Black moves first — go!',
        '童童准备就绪！\nTongtong\'s ready — let\'s go!',
      ],
      playerMove: [
        '嗯…让我想想~\nHmm… let me think.',
        '哎呀好棋！\nNice move!',
        '嘿嘿，看我接招！\nHeh, watch this!',
        '这步有意思~\nInteresting move~',
        '让童童算一算……\nLet me calculate…',
      ],
      playerThreat: [          // player just made an open-3 / four-threat
        '欸！这步我得堵——\nWhoa! Gotta block that!',
        '不行不行，得防一下！\nNope nope — defending!',
        '危险危险~童童得小心了！\nDanger! Time to be careful~',
      ],
      aiMove: [
        '看童童这一手！\nCheck out my move!',
        '嘿嘿，这里！\nHeh — right here!',
        '猜猜我下一步~\nGuess my next move~',
        '哼哼，没那么容易赢哦~\nNot gonna let you win that easy~',
      ],
      aiThreat: [              // AI just built an open-3 of its own
        '嘿嘿，童童快连成线啦！\nHeh, almost five in a row!',
        '快了快了——你能挡住吗？\nAlmost there — can you block me?',
      ],
      playerWin: [
        '哇！你赢啦！再来一局？\nWow, you win! Another round?',
        '太厉害啦！童童认输~\nAmazing! I give up — rematch?',
      ],
      aiWin: [
        '这局童童赢啦~ 嘿嘿！\nI win this round — heh heh!',
        '哈哈！童童赢咯~ 再战一局？\nHaha I won! Wanna try again?',
      ],
      end: [
        '好的，下次再来一局！\nOk! Come back for another match~',
        '辛苦啦~随时回来玩~\nNice game! Drop by anytime~',
      ],
    };

    // Chess-specific lines (用 _say 时按 _boardMode 自动切换台词池)。
    this._chessLines = {
      greet: [
        '想下国际象棋吗？\nWanna play some chess?',
        '童童陪你来一局国际象棋~\nLet me play chess with you!',
      ],
      start: [
        '开局啦！你执白先手~\nGame on! You\'re white, you go first.',
        '白棋你先来！加油~\nWhite moves first! Good luck~',
      ],
      playerMove: [
        '嗯…让我想想~\nHmm… let me think.',
        '哎呀好棋！\nNice move!',
        '这步不错~\nNot bad~',
        '让童童算算……\nLet me calculate…',
      ],
      playerCapture: [
        '欸！你吃了我一颗~\nYou took my piece!',
        '哼哼，等我反击！\nHmph, I\'ll get you back!',
      ],
      check: [
        '哎呀，将军！我得救国王~\nUh oh, check! I gotta save my king~',
        '童童被将军啦！\nI\'m in check!',
      ],
      aiMove: [
        '看童童这一手！\nCheck out my move!',
        '嘿嘿，到这里~\nHeh, right here.',
        '没那么容易赢哦~\nNot gonna let you win that easy~',
      ],
      aiCapture: [
        '童童吃啦！\nGotcha!',
        '嘿嘿，这子归我了~\nThis piece is mine now~',
      ],
      aiCheck: [
        '将军！\nCheck!',
        '嘿嘿，将军啦~ 接招~\nCheck~ defend yourself!',
      ],
      playerWin: [
        '哇！将死啦！你赢了！\nCheckmate! You won!',
        '太厉害啦！童童认输~\nAmazing! I give up — rematch?',
      ],
      aiWin: [
        '将死~ 童童赢咯！\nCheckmate! I win this time~',
        '哈哈，再来一局？\nHaha, wanna play again?',
      ],
      end: [
        '好的，下次再来一局！\nOk! Come back for another match~',
        '辛苦啦~随时回来玩~\nNice game! Drop by anytime~',
      ],
    };

    this.onReady();
  }

  // ── Override enter so 童童 greets the player on each visit. ──
  enter() {
    super.enter();
    // Slight delay so the bubble appears after the camera has settled.
    setTimeout(() => {
      // Don't talk over an active match — only greet when idle.
      if (this._gomoku?.active || this._chess?.active) return;
      this._say('greet');
    }, 700);
  }

  // ────────────────────────────────────────────────────────────
  //  Update hook — animate confetti / banner / chess pieces.
  // ────────────────────────────────────────────────────────────
  update(delta, camWorld) {
    super.update(delta, camWorld);
    this._tickConfetti(delta);
    this._billboardBanner(camWorld);
    this._tickChessAnimations(delta);
    this._tickAICursor(delta);
  }

  // ────────────────────────────────────────────────────────────
  //  Game lifecycle
  // ────────────────────────────────────────────────────────────
  // ── Speech bubble helper ────────────────────────────────────
  // Pick a random line from `category` and route it through the
  // companion's 3D speech bubble (same widget the chat zone uses).
  // ALL in-game chatter goes through this so nothing leaks into the
  // desktop chat panel.
  _say(category) {
    // Dispatch lines pool by current floor-board mode so 童童 always
    // says the right thing for whichever game is running.
    const lines = this._boardMode === 'chess' ? this._chessLines : this._gomokuLines;
    const pool = lines?.[category];
    if (!pool || !this.companion?.say) return;
    const text = pool[(Math.random() * pool.length) | 0];
    this.companion.say(text);
  }

  // The wall START / END buttons feed both gomoku and chess; we route
  // by the currently selected board mode.
  _startGame() {
    if (this._boardMode === 'chess') return this._startChessGame();
    return this._startGomokuGame();
  }
  _endGame() {
    if (this._boardMode === 'chess') return this._endChessGame();
    return this._endGomokuGame();
  }

  _startGomokuGame() {
    const g = this._gomoku;
    // Always restart cleanly — pressing START mid-game resets the position.
    this._clearStones();
    this._hideVictoryBanner();
    // Five-in-a-row uses the 19×19 line grid printed on the Go board, so
    // make sure that board art is showing even if Chess was last selected.
    this._setBoardMode('go');

    g.board = Array.from({ length: g.GRID }, () =>
      new Int8Array(g.GRID));
    g.active = true;
    g.turn = 'player';                // player always moves first (黑棋)
    g.thinking = false;

    if (this.companion) this.companion.setExpression('happy');
    this._say('start');
  }

  _endGomokuGame() {
    const g = this._gomoku;
    g.active = false;
    g.turn = null;
    g.board = null;
    g.thinking = false;
    this._clearStones();
    this._hideVictoryBanner();
    if (this.companion) this.companion.setExpression('idle');
    this._say('end');
  }

  // ────────────────────────────────────────────────────────────
  //  One-time GPU asset prep so click→spawn doesn't allocate.
  // ────────────────────────────────────────────────────────────
  _buildGomokuAssets() {
    const g = this._gomoku;

    // Biconvex stone profile via LatheGeometry — proportional to a real
    // Yunzi stone (R ≈ 0.42×cell, T ≈ 0.36×R). The silhouette is one
    // sphere arc on top, mirrored on the bottom, meeting at the equator.
    //
    // Place the sphere centre on the y-axis at y = halfT − arcR (below
    // the equator) and sweep the angle a from the +y axis:
    //   x(a) = arcR · sin(a),   y(a) = (halfT − arcR) + arcR · cos(a)
    //
    // a = 0       → top pole at (0, halfT)
    // a = asin(R/arcR) → equator at (R, 0)
    const R = g.stoneR;
    const halfT = g.stoneT / 2;
    // Sphere radius such that the arc passes through (0, halfT) and (R, 0).
    const arcR = (R * R + halfT * halfT) / g.stoneT;
    const SEG = 24;
    const startA = 0;
    const endA = Math.asin(R / arcR);
    const profile = [];
    for (let i = 0; i <= SEG; i++) {
      const a = startA + (i / SEG) * (endA - startA);
      const x = arcR * Math.sin(a);
      const y = (halfT - arcR) + arcR * Math.cos(a);
      profile.push(new THREE.Vector2(x, y));
    }
    // Mirror the top profile to build the bottom dome (skip the equator
    // point at index SEG, which is shared between halves).
    for (let i = SEG - 1; i >= 0; i--) {
      const top = profile[i];
      profile.push(new THREE.Vector2(top.x, -top.y));
    }
    g.stoneGeo = new THREE.LatheGeometry(profile, 36);

    g.blackMat = new THREE.MeshStandardMaterial({
      color: 0x0E0E14, roughness: 0.28, metalness: 0.1,
    });
    g.whiteMat = new THREE.MeshStandardMaterial({
      color: 0xF5EFD7, roughness: 0.32, metalness: 0.05,
    });

    g.stonesGroup = new THREE.Group();
    this.group.add(g.stonesGroup);

    // Small last-move marker — a thin red ring that hovers just above
    // the most recent stone. Re-used for every move.
    const ringGeo = new THREE.RingGeometry(R * 0.32, R * 0.5, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xFF3A50, side: THREE.DoubleSide,
      transparent: true, opacity: 0.9, depthTest: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    ring.renderOrder = 5;
    this.group.add(ring);
    g.lastMarker = ring;
  }

  // ──────────────────────────────────────���─────────────────────
  //  Make the giant floor board itself a click target. The handler
  //  is always installed but only does work while a game is active.
  // ────────────────────────────────────────────────────────────
  _enableBoardClick() {
    const top = this._boardTopMesh;
    if (!top) return;
    top.userData.onClick = (mesh, ctx) => this._handleBoardClick(ctx);
    if (!this.interactables.includes(top)) this.interactables.push(top);
  }

  _handleBoardClick(ctx) {
    if (!ctx?.point) return false;
    // Returning `false` lets XR / desktop continue to the next handler
    // (teleport for VR, or zone navigation for desktop) so the giant
    // floor board never blocks normal locomotion when no game is on.
    if (this._boardMode === 'chess') return this._handleChessClick(ctx);
    return this._handleGomokuClick(ctx);
  }

  _handleGomokuClick(ctx) {
    const g = this._gomoku;
    if (!g.active || g.turn !== 'player' || g.thinking) return false;

    // Convert world hit point → room-local board coords. The board top
    // sits centred at room-local origin in x,z, so this is a direct
    // shift by the room's world position.
    const local = this.group.worldToLocal(ctx.point.clone());
    const half = g.inner / 2;
    const col = Math.round((local.x + half) / g.step);
    const row = Math.round((local.z + half) / g.step);
    // Out-of-grid clicks fall through (e.g. trying to teleport on the
    // wood margin around the printed board).
    if (row < 0 || row >= g.GRID || col < 0 || col >= g.GRID) return false;
    // Reject clicks too far from a line intersection — fall through so
    // the player can still teleport on the cell interiors.
    const targetX = -half + col * g.step;
    const targetZ = -half + row * g.step;
    const dx = local.x - targetX, dz = local.z - targetZ;
    if (Math.hypot(dx, dz) > g.step * 0.45) return false;
    // Hit a real intersection. Consume the click (haptic + no teleport)
    // but bail out if the spot is occupied.
    if (g.board[row][col] !== 0) return;

    this._placeStone(row, col, 1);            // 1 = player (black)
    if (this._checkWin(row, col, 1)) {
      this._onWin('player');
      return;
    }
    // 童童 reacts: if the player just made an aggressive move
    // (open-3 or stronger) she warns she'll have to defend; otherwise
    // a regular acknowledgement. We bubble these intermittently so it
    // doesn't feel spammy.
    if (this._isThreatMove(row, col, 1)) {
      this._say('playerThreat');
    } else if (Math.random() < 0.55) {
      this._say('playerMove');
    }
    g.turn = 'ai';
    g.thinking = true;
    if (this.companion) this.companion.setExpression('thinking');
    // Small think-delay so the AI feels deliberate rather than instant.
    setTimeout(() => this._aiMove(), 480);
  }

  // A move counts as a "threat" if it creates an open-3 or any 4-in-a-row
  // along any axis, mirroring how a real opponent would react.
  _isThreatMove(row, col, who) {
    const g = this._gomoku;
    const N = g.GRID;
    const board = g.board;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      let lc = 0, lb = false, rc = 0, rb = false;
      for (let k = 1; k <= 4; k++) {
        const rr = row - dr * k, cc = col - dc * k;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) { lb = true; break; }
        const v = board[rr][cc];
        if (v === who) lc++;
        else if (v !== 0) { lb = true; break; }
        else break;
      }
      for (let k = 1; k <= 4; k++) {
        const rr = row + dr * k, cc = col + dc * k;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) { rb = true; break; }
        const v = board[rr][cc];
        if (v === who) rc++;
        else if (v !== 0) { rb = true; break; }
        else break;
      }
      const cnt = lc + rc + 1;
      const open = (lb ? 0 : 1) + (rb ? 0 : 1);
      if (cnt >= 4) return true;
      if (cnt === 3 && open === 2) return true;
    }
    return false;
  }

  // ────────────────────────────────────────────────────────────
  //  Place a stone at (row, col) for player (1=black, 2=white).
  //  Records the move on the logical board, spawns the 3D mesh, and
  //  moves the last-move ring on top.
  // ────────────────────────────────────────────────────────────
  _placeStone(row, col, who) {
    const g = this._gomoku;
    g.board[row][col] = who;

    const half = g.inner / 2;
    const x = -half + col * g.step;
    const z = -half + row * g.step;
    // Slab body top sits at y = 0.07 and the texture mesh at y ≈ 0.071.
    // The stone's lathe geometry is centred on its equator, so the bottom
    // pole is at local y = -halfT. Lift the centre to halfT + a 2 mm
    // clearance so the dome can never poke into the texture plane.
    const y = 0.073 + g.stoneT / 2;

    const stone = new THREE.Mesh(
      g.stoneGeo,
      who === 1 ? g.blackMat : g.whiteMat,
    );
    stone.position.set(x, y, z);
    stone.castShadow = false;
    stone.receiveShadow = false;
    g.stonesGroup.add(stone);

    g.lastMarker.position.set(x, y + g.stoneT * 0.55, z);
    g.lastMarker.visible = true;
  }

  _clearStones() {
    const g = this._gomoku;
    if (g.stonesGroup) {
      // Dispose just the children; the shared geometry/material live on g.
      while (g.stonesGroup.children.length) {
        g.stonesGroup.remove(g.stonesGroup.children[0]);
      }
    }
    if (g.lastMarker) g.lastMarker.visible = false;
  }

  // ────────────────────────────────────────────────────────────
  //  Win detection — scan from the just-placed stone in 4 axes.
  // ────────────────────────────────────────────────────────────
  _checkWin(row, col, who) {
    const g = this._gomoku;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      let n = 1;
      for (let k = 1; k < 5; k++) {
        const r = row + dr * k, c = col + dc * k;
        if (r < 0 || r >= g.GRID || c < 0 || c >= g.GRID) break;
        if (g.board[r][c] !== who) break;
        n++;
      }
      for (let k = 1; k < 5; k++) {
        const r = row - dr * k, c = col - dc * k;
        if (r < 0 || r >= g.GRID || c < 0 || c >= g.GRID) break;
        if (g.board[r][c] !== who) break;
        n++;
      }
      if (n >= 5) return true;
    }
    return false;
  }

  // ────────────────────────────────────────────────────────────
  //  Heuristic AI: classic gomoku threat-and-defend scoring.
  //  For every empty cell, score the offensive value of placing AI
  //  there + the defensive value of denying the opponent. We only
  //  evaluate cells within 2 of an existing stone for performance.
  // ────────────────────────────────────────────────────────────
  _aiMove() {
    const g = this._gomoku;
    // Bail if the game ended OR the player restarted while this move was
    // queued in setTimeout — that flips turn back to 'player' and a stale
    // AI move would clobber the fresh board.
    if (!g.active || g.turn !== 'ai') return;

    const AI = 2, P = 1;
    const N = g.GRID;
    const board = g.board;

    // Has any stone been placed? If not, AI plays the centre.
    let any = false;
    outer: for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) if (board[r][c]) { any = true; break outer; }
    }
    if (!any) {
      this._finishAIMove(9, 9);
      return;
    }

    const scoreLine = (count, open) => {
      if (count >= 5) return 1_000_000;
      if (count === 4) return open === 2 ? 80_000 : open === 1 ? 1_500 : 0;
      if (count === 3) return open === 2 ? 2_500 : open === 1 ? 220 : 0;
      if (count === 2) return open === 2 ? 180 : open === 1 ? 18 : 0;
      if (count === 1) return open === 2 ? 6 : open === 1 ? 1 : 0;
      return 0;
    };
    const evalCell = (r, c, who) => {
      let total = 0;
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (const [dr, dc] of dirs) {
        let lc = 0, lb = false, rc = 0, rb = false;
        for (let k = 1; k <= 4; k++) {
          const rr = r - dr * k, cc = c - dc * k;
          if (rr < 0 || rr >= N || cc < 0 || cc >= N) { lb = true; break; }
          const v = board[rr][cc];
          if (v === who) lc++;
          else if (v !== 0) { lb = true; break; }
          else break;
        }
        for (let k = 1; k <= 4; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= N || cc < 0 || cc >= N) { rb = true; break; }
          const v = board[rr][cc];
          if (v === who) rc++;
          else if (v !== 0) { rb = true; break; }
          else break;
        }
        const cnt = lc + rc + 1;
        const open = (lb ? 0 : 1) + (rb ? 0 : 1);
        total += scoreLine(cnt, open);
      }
      return total;
    };
    const hasNeighbour = (r, c) => {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr][cc]) return true;
        }
      }
      return false;
    };

    let best = -Infinity, choices = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (board[r][c] !== 0) continue;
        if (!hasNeighbour(r, c)) continue;
        const off = evalCell(r, c, AI);
        const def = evalCell(r, c, P) * 0.92;     // slight tilt toward attack
        const s = off + def;
        if (s > best) { best = s; choices = [[r, c]]; }
        else if (s === best) choices.push([r, c]);
      }
    }
    let move = choices[(Math.random() * choices.length) | 0];
    if (!move) move = [9, 9];
    this._finishAIMove(move[0], move[1]);
  }

  _finishAIMove(row, col) {
    const g = this._gomoku;
    if (!g.active) return;
    this._placeStone(row, col, 2);
    g.thinking = false;
    if (this._checkWin(row, col, 2)) {
      this._onWin('ai');
      return;
    }
    // 童童 trash-talks softly. If she just built her own open-3/4, she
    // warns the player; otherwise an occasional generic quip.
    if (this._isThreatMove(row, col, 2)) {
      this._say('aiThreat');
    } else if (Math.random() < 0.45) {
      this._say('aiMove');
    }
    g.turn = 'player';
    if (this.companion) this.companion.setExpression('idle');
  }

  // ────────────────────────────────────────────────────────────
  //  Victory: freeze input, raise banner + confetti, set companion mood.
  // ────────────────────────────────────────────────────────────
  _onWin(winner) {
    const g = this._gomoku;
    g.active = false;
    g.thinking = false;
    g.turn = null;
    this._showVictoryBanner(winner);
    if (this.companion) {
      if (winner === 'player') {
        this.companion.setExpression('happy');
        this._say('playerWin');
      } else {
        this.companion.setExpression('empathy');
        this._say('aiWin');
      }
    }
  }

  _showVictoryBanner(winner) {
    const g = this._gomoku;
    if (!g.banner) {
      const banner = new THREE.Group();
      banner.position.set(0, 3.6, 0);     // floats above board centre
      this.group.add(banner);
      g.banner = banner;
    }
    // Rebuild the texture each time so winner-specific copy lands fresh.
    while (g.banner.children.length) {
      const c = g.banner.children[0];
      g.banner.remove(c);
      c.material?.map?.dispose?.();
      c.material?.dispose?.();
      c.geometry?.dispose?.();
    }

    const tex = this._makeVictoryBannerTexture(winner);
    const w = 6, h = 2.2;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    g.banner.add(plate);

    // Glow halo behind the plate.
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.18, h * 1.32),
      new THREE.MeshBasicMaterial({
        color: winner === 'player' ? 0xFFD86B : 0x7AB6FF,
        transparent: true, opacity: 0.32, depthWrite: false,
      }),
    );
    glow.position.z = -0.02;
    g.banner.add(glow);

    g.banner.visible = true;
    this._spawnConfetti();
  }

  _hideVictoryBanner() {
    const g = this._gomoku;
    if (g.banner) g.banner.visible = false;
    if (g.confetti) {
      this.group.remove(g.confetti.points);
      g.confetti.points.geometry.dispose();
      g.confetti.points.material.dispose();
      g.confetti = null;
    }
  }

  _makeVictoryBannerTexture(winner) {
    const W = 1536, H = 560;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Rounded glossy plate with gold/blue trim.
    const r = 56;
    ctx.fillStyle = 'rgba(15, 12, 22, 0.92)';
    this._roundRect(ctx, 0, 0, W, H, r);
    ctx.fill();

    const accent = winner === 'player' ? '#FFD86B' : '#7AB6FF';
    ctx.lineWidth = 10;
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 26;
    this._roundRect(ctx, 14, 14, W - 28, H - 28, r - 10);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Big bilingual headline.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 156px "PingFang SC", "Microsoft YaHei", sans-serif';
    const cn = winner === 'player' ? '恭喜获胜！' : '电脑赢啦~';
    ctx.fillText(cn, W / 2, H / 2 - 56);

    ctx.fillStyle = accent;
    ctx.font = 'bold 78px "Helvetica Neue", Arial, sans-serif';
    const en = winner === 'player' ? 'CONGRATULATIONS' : 'COMPUTER WINS';
    ctx.fillText(en, W / 2, H / 2 + 70);

    ctx.fillStyle = '#A8A8C0';
    ctx.font = '40px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('按"开始游戏"再来一局  ·  TAP START FOR REMATCH',
      W / 2, H - 60);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _spawnConfetti() {
    const g = this._gomoku;
    if (g.confetti) {
      this.group.remove(g.confetti.points);
      g.confetti.points.geometry.dispose();
      g.confetti.points.material.dispose();
    }
    const N = 240;
    const positions = new Float32Array(N * 3);
    const velocities = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const palette = [
      [1.0, 0.85, 0.36], [1.0, 0.35, 0.42], [0.36, 0.95, 0.55],
      [0.46, 0.78, 1.00], [1.00, 0.55, 0.95], [0.95, 0.95, 1.00],
    ];
    for (let i = 0; i < N; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 7;
      positions[i * 3 + 1] = 4.6 + Math.random() * 1.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 7;
      velocities[i * 3]     = (Math.random() - 0.5) * 0.7;
      velocities[i * 3 + 1] = -0.7 - Math.random() * 0.9;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
      const cp = palette[(Math.random() * palette.length) | 0];
      colors[i * 3] = cp[0]; colors[i * 3 + 1] = cp[1]; colors[i * 3 + 2] = cp[2];
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.18, vertexColors: true,
      transparent: true, opacity: 0.95, depthWrite: false,
    });
    const points = new THREE.Points(geom, mat);
    points.renderOrder = 6;
    this.group.add(points);

    g.confetti = { points, velocities, life: 0, maxLife: 7.5 };
  }

  _tickConfetti(delta) {
    const c = this._gomoku?.confetti;
    if (!c) return;
    c.life += delta;
    const pos = c.points.geometry.attributes.position.array;
    const vel = c.velocities;
    const N = pos.length / 3;
    for (let i = 0; i < N; i++) {
      pos[i * 3]     += vel[i * 3]     * delta;
      pos[i * 3 + 1] += vel[i * 3 + 1] * delta;
      pos[i * 3 + 2] += vel[i * 3 + 2] * delta;
      // Gentle drag + gravity wobble.
      vel[i * 3 + 1] -= 0.15 * delta;
      // Recycle once a flake hits the floor.
      if (pos[i * 3 + 1] < 0.1) {
        pos[i * 3]     = (Math.random() - 0.5) * 7;
        pos[i * 3 + 1] = 4.6 + Math.random() * 1.5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 7;
        vel[i * 3 + 1] = -0.7 - Math.random() * 0.9;
      }
    }
    c.points.geometry.attributes.position.needsUpdate = true;

    // Fade confetti out over time so it doesn't loop forever.
    const fade = Math.max(0, 1 - c.life / c.maxLife);
    c.points.material.opacity = 0.95 * fade;
    if (c.life >= c.maxLife) {
      this.group.remove(c.points);
      c.points.geometry.dispose();
      c.points.material.dispose();
      this._gomoku.confetti = null;
    }
  }

  _billboardBanner(camWorld) {
    const g = this._gomoku;
    if (!g?.banner || !g.banner.visible || !camWorld) return;
    // Rotate to face the camera in the XZ plane so text is always legible.
    const local = this.group.worldToLocal(camWorld.clone());
    const dx = local.x - g.banner.position.x;
    const dz = local.z - g.banner.position.z;
    g.banner.rotation.y = Math.atan2(dx, dz);
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

    // Switching boards mid-match aborts the old game so pieces / stones
    // from a different ruleset never linger on the floor texture.
    if (this._gomoku?.active) {
      this._gomoku.active = false;
      this._gomoku.turn = null;
      this._gomoku.board = null;
      this._gomoku.thinking = false;
      this._clearStones();
      this._hideVictoryBanner();
    }
    if (this._chess?.active) {
      this._chess.active = false;
      this._chess.turn = null;
      this._chess.thinking = false;
      this._clearChessPieces();
      this._clearChessHighlights();
      this._hideAICursor();
      this._hideVictoryBanner();
    }

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

    // ── Movable button cap (depresses on click) ─────────────��─
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

  // ════════════════════════════════════════════════════════════
  //  CHESS — full implementation, modeled after Windows 3D Chess.
  //  Player plays white (closer to the camera at z = +) and moves
  //  first; AI plays black at z = -. All piece geometries and
  //  materials are created once in `_buildChessAssets()` and cloned
  //  per-piece so first move is responsive (no run-time alloc).
  // ════════════════════════════════════════════════════════════

  // ── Asset prep: lathe-based bodies + composite tops ────────
  _buildChessAssets() {
    const c = this._chess;

    // Materials. The board art is cream + walnut, so pieces use a
    // slightly off-white marble and a deep onyx — both with a touch of
    // metalness so they catch the room's neon lights nicely.
    c.whiteMat = new THREE.MeshStandardMaterial({
      color: 0xF1E5C7, roughness: 0.35, metalness: 0.18,
    });
    c.blackMat = new THREE.MeshStandardMaterial({
      color: 0x1A1310, roughness: 0.32, metalness: 0.22,
    });
    // Subtle accent bands on collars / crowns so silhouettes pop.
    c.whiteAccent = new THREE.MeshStandardMaterial({
      color: 0xC8B388, roughness: 0.5, metalness: 0.3,
    });
    c.blackAccent = new THREE.MeshStandardMaterial({
      color: 0x2A2018, roughness: 0.5, metalness: 0.3,
    });

    // Build piece factory closures. Each factory builds a Group with
    // base at local y = 0 so it can be positioned with just an x/z
    // offset on the slab top.
    c.pieceFactories = {
      p: (color) => this._buildPawnMesh(color),
      r: (color) => this._buildRookMesh(color),
      n: (color) => this._buildKnightMesh(color),
      b: (color) => this._buildBishopMesh(color),
      q: (color) => this._buildQueenMesh(color),
      k: (color) => this._buildKingMesh(color),
    };

    // Container groups so we can clear all pieces / highlights cleanly.
    c.piecesGroup = new THREE.Group();
    c.highlightGroup = new THREE.Group();
    this.group.add(c.piecesGroup);
    this.group.add(c.highlightGroup);

    // AI "cursor" — a downward chevron with a glowing ring that
    // hovers over the board to telegraph where 童童 is moving.
    c.aiCursor = this._buildAICursor();
    c.aiCursor.visible = false;
    this.group.add(c.aiCursor);

    // Pre-build one of every piece type so geometry caches are warm.
    // We discard the meshes immediately — what matters is the buffer
    // upload to the GPU on first paint.
    for (const t of ['p', 'r', 'n', 'b', 'q', 'k']) {
      const warm = c.pieceFactories[t]('white');
      warm.position.set(0, -10, 0);             // off-screen
      this.group.add(warm);
      this.group.remove(warm);
    }
  }

  _matFor(color) {
    return color === 'white' ? this._chess.whiteMat : this._chess.blackMat;
  }
  _accentFor(color) {
    return color === 'white' ? this._chess.whiteAccent : this._chess.blackAccent;
  }

  // Common pedestal — wide ring at the bottom that all pieces share.
  // Returns a list of Vector2 points usable as the start of a lathe profile.
  _chessPedestalPoints(topR, neckY) {
    return [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.30,  0),
      new THREE.Vector2(0.32,  0.012),
      new THREE.Vector2(0.30,  0.04),
      new THREE.Vector2(0.22,  0.06),
      new THREE.Vector2(topR,  neckY),
    ];
  }

  _buildPawnMesh(color) {
    const profile = [
      ...this._chessPedestalPoints(0.13, 0.10),
      new THREE.Vector2(0.13, 0.18),
      new THREE.Vector2(0.16, 0.22),  // collar
      new THREE.Vector2(0.10, 0.25),
      new THREE.Vector2(0.14, 0.28),  // head base
      new THREE.Vector2(0.14, 0.34),
      new THREE.Vector2(0.10, 0.40),
      new THREE.Vector2(0.001, 0.42),
    ];
    const geo = new THREE.LatheGeometry(profile, 28);
    return this._wrapPiece(new THREE.Mesh(geo, this._matFor(color)));
  }

  _buildRookMesh(color) {
    const profile = [
      ...this._chessPedestalPoints(0.18, 0.10),
      new THREE.Vector2(0.18, 0.30),
      new THREE.Vector2(0.21, 0.34),  // shoulder
      new THREE.Vector2(0.21, 0.40),  // top edge
      new THREE.Vector2(0.001, 0.40), // close top
    ];
    const geo = new THREE.LatheGeometry(profile, 28);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, this._matFor(color)));

    // 4 crenellation notches around the top: stand 4 small cubes on
    // the rim with 90° gaps so the "battlements" silhouette reads.
    const battle = new THREE.BoxGeometry(0.10, 0.10, 0.10);
    const battleMat = this._accentFor(color);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const m = new THREE.Mesh(battle, battleMat);
      m.position.set(Math.cos(a) * 0.16, 0.45, Math.sin(a) * 0.16);
      grp.add(m);
    }
    return this._wrapPiece(grp);
  }

  _buildBishopMesh(color) {
    const profile = [
      ...this._chessPedestalPoints(0.15, 0.10),
      new THREE.Vector2(0.13, 0.20),
      new THREE.Vector2(0.16, 0.26),  // collar bulge
      new THREE.Vector2(0.10, 0.30),
      new THREE.Vector2(0.13, 0.40),  // body
      new THREE.Vector2(0.05, 0.50),  // mitre taper
      new THREE.Vector2(0.07, 0.55),  // tip ball
      new THREE.Vector2(0.001, 0.60),
    ];
    const geo = new THREE.LatheGeometry(profile, 28);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, this._matFor(color)));

    // The classic mitre slit — a thin black box across the top.
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.02, 0.04),
      this._accentFor(color),
    );
    slit.position.set(0, 0.46, 0);
    grp.add(slit);
    return this._wrapPiece(grp);
  }

  _buildQueenMesh(color) {
    const profile = [
      ...this._chessPedestalPoints(0.17, 0.10),
      new THREE.Vector2(0.15, 0.22),
      new THREE.Vector2(0.19, 0.30),  // collar
      new THREE.Vector2(0.13, 0.36),
      new THREE.Vector2(0.17, 0.50),  // body
      new THREE.Vector2(0.21, 0.58),  // crown base disk
      new THREE.Vector2(0.21, 0.62),
      new THREE.Vector2(0.001, 0.62),
    ];
    const geo = new THREE.LatheGeometry(profile, 32);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, this._matFor(color)));

    // 8 small spheres ringing the crown rim.
    const pearl = new THREE.SphereGeometry(0.038, 12, 8);
    const pearlMat = this._accentFor(color);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      const m = new THREE.Mesh(pearl, pearlMat);
      m.position.set(Math.cos(a) * 0.18, 0.66, Math.sin(a) * 0.18);
      grp.add(m);
    }
    // Central spire pearl
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), pearlMat);
    top.position.set(0, 0.69, 0);
    grp.add(top);
    return this._wrapPiece(grp);
  }

  _buildKingMesh(color) {
    const profile = [
      ...this._chessPedestalPoints(0.18, 0.10),
      new THREE.Vector2(0.16, 0.22),
      new THREE.Vector2(0.20, 0.30),  // collar
      new THREE.Vector2(0.14, 0.36),
      new THREE.Vector2(0.18, 0.55),  // body
      new THREE.Vector2(0.22, 0.62),  // crown base
      new THREE.Vector2(0.22, 0.66),
      new THREE.Vector2(0.001, 0.66),
    ];
    const geo = new THREE.LatheGeometry(profile, 32);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, this._matFor(color)));

    // Cross on top — 2 thin boxes.
    const accent = this._accentFor(color);
    const vert = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.20, 0.05), accent);
    vert.position.set(0, 0.78, 0);
    grp.add(vert);
    const horiz = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.05), accent);
    horiz.position.set(0, 0.80, 0);
    grp.add(horiz);
    return this._wrapPiece(grp);
  }

  _buildKnightMesh(color) {
    // Lathed pedestal so the base matches every other piece.
    const baseProfile = [
      ...this._chessPedestalPoints(0.17, 0.10),
      new THREE.Vector2(0.18, 0.18),
      new THREE.Vector2(0.001, 0.18),
    ];
    const baseGeo = new THREE.LatheGeometry(baseProfile, 28);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(baseGeo, this._matFor(color)));

    // Stylised horse-head silhouette extruded along z. Built in xy
    // with the snout pointing -x; we orient pieces by rotating the
    // group later so white/black both face their opponent.
    const s = new THREE.Shape();
    s.moveTo( 0.20, 0.18);    // start at back-bottom of head
    s.lineTo(-0.10, 0.18);    // front-bottom (under chest)
    s.lineTo(-0.18, 0.26);    // throat
    s.lineTo(-0.22, 0.36);    // chin
    s.lineTo(-0.20, 0.42);    // mouth
    s.lineTo(-0.10, 0.46);    // nose bridge
    s.lineTo(-0.04, 0.54);    // forehead
    s.lineTo( 0.00, 0.62);    // forward ear tip
    s.lineTo( 0.06, 0.54);    // dip between ears
    s.lineTo( 0.10, 0.60);    // back ear tip
    s.lineTo( 0.16, 0.54);    // back of head
    s.lineTo( 0.20, 0.30);    // mane back curve
    s.lineTo( 0.20, 0.18);    // close
    const headGeo = new THREE.ExtrudeGeometry(s, {
      depth: 0.18, bevelEnabled: true,
      bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2,
    });
    headGeo.translate(0, 0, -0.09);   // centre on z-axis
    const head = new THREE.Mesh(headGeo, this._matFor(color));
    grp.add(head);

    // Tiny eye dot for character.
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 6),
      this._accentFor(color === 'white' ? 'black' : 'white'),
    );
    eye.position.set(-0.10, 0.40, 0.10);
    grp.add(eye);
    const eye2 = eye.clone();
    eye2.position.z = -0.10;
    grp.add(eye2);

    return this._wrapPiece(grp);
  }

  // Wrap any mesh / group in a "carrier" Group whose origin is at the
  // square centre. This lets us animate position/lift uniformly and
  // also rotate knights to face the opponent without touching geometry.
  _wrapPiece(child) {
    const carrier = new THREE.Group();
    carrier.add(child);
    return carrier;
  }

  // ── AI cursor: a glowing chevron + ring above a target square ──
  _buildAICursor() {
    const grp = new THREE.Group();

    // Bright translucent ring.
    const ringGeo = new THREE.RingGeometry(0.55, 0.72, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xFF6B7A, side: THREE.DoubleSide,
      transparent: true, opacity: 0.0, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.075;
    ring.renderOrder = 4;
    grp.add(ring);

    // Downward-pointing chevron (a small cone) hovering above the square.
    const chevGeo = new THREE.ConeGeometry(0.15, 0.30, 12);
    const chevMat = new THREE.MeshBasicMaterial({
      color: 0xFF6B7A, transparent: true, opacity: 0.0, depthWrite: false,
    });
    const chev = new THREE.Mesh(chevGeo, chevMat);
    chev.rotation.x = Math.PI;          // tip points -y
    chev.position.y = 0.95;             // hovers ~0.3m above tallest pieces
    chev.renderOrder = 4;
    grp.add(chev);

    grp.userData = { ring, chev, ringMat, chevMat };
    return grp;
  }

  _setAICursorOpacity(o) {
    const u = this._chess.aiCursor?.userData;
    if (!u) return;
    u.ringMat.opacity = o * 0.9;
    u.chevMat.opacity = o;
  }

  _hideAICursor() {
    const c = this._chess;
    if (!c.aiCursor) return;
    c.aiCursor.visible = false;
    this._setAICursorOpacity(0);
    c.aiCursorState = 'hidden';
    c.aiCursorAnim = null;
  }

  _tickAICursor(delta) {
    const c = this._chess;
    if (!c.aiCursor || c.aiCursorState === 'hidden') return;
    // Gentle bob so the chevron looks alive even when idle.
    const t = (performance.now() % 1200) / 1200;
    c.aiCursor.userData.chev.position.y = 0.95 + Math.sin(t * Math.PI * 2) * 0.04;
  }

  // ────────────────────────────────────────────────────────────
  //  Coordinate helpers
  // ────────────────────────────────────────────────────────────
  _chessSquareCentre(r, c) {
    const ch = this._chess;
    const half = ch.inner / 2;
    const x = -half + ch.cell * (c + 0.5);
    const z = -half + ch.cell * (r + 0.5);
    return { x, z };
  }
  _chessSquareFromPoint(localPoint) {
    const ch = this._chess;
    const half = ch.inner / 2;
    const c = Math.floor((localPoint.x + half) / ch.cell);
    const r = Math.floor((localPoint.z + half) / ch.cell);
    if (r < 0 || r >= 8 || c < 0 || c >= 8) return null;
    return { r, c };
  }

  // ────────────────────────────────────────────────────────────
  //  Game lifecycle
  // ────────────────────────────────────────────────────────────
  _startChessGame() {
    const ch = this._chess;
    this._setBoardMode('chess');
    this._clearChessPieces();
    this._clearChessHighlights();
    this._hideAICursor();
    this._hideVictoryBanner();

    // Standard chess starting position. White at rows 6 (pawns) & 7
    // (majors); black at rows 0 & 1. Player ALWAYS plays white.
    const back = ['r','n','b','q','k','b','n','r'];
    ch.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    ch.pieceMeshes = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      this._placeChessPiece(0, c, { type: back[c], color: 'black' });
      this._placeChessPiece(1, c, { type: 'p',     color: 'black' });
      this._placeChessPiece(6, c, { type: 'p',     color: 'white' });
      this._placeChessPiece(7, c, { type: back[c], color: 'white' });
    }

    ch.active = true;
    ch.turn = 'white';
    ch.thinking = false;
    ch.selected = null;
    ch.validMoves = null;
    ch.anims.length = 0;

    if (this.companion) this.companion.setExpression('happy');
    this._say('start');
  }

  _endChessGame() {
    const ch = this._chess;
    ch.active = false;
    ch.turn = null;
    ch.thinking = false;
    ch.selected = null;
    ch.validMoves = null;
    ch.anims.length = 0;
    this._clearChessPieces();
    this._clearChessHighlights();
    this._hideAICursor();
    this._hideVictoryBanner();
    if (this.companion) this.companion.setExpression('idle');
    this._say('end');
  }

  // Place a piece in both the logical board and the 3D scene.
  _placeChessPiece(r, c, piece) {
    const ch = this._chess;
    ch.board[r][c] = piece;
    const factory = ch.pieceFactories[piece.type];
    const mesh = factory(piece.color);
    const { x, z } = this._chessSquareCentre(r, c);
    // Slab top sits at y = 0.07; pedestal bases at local y = 0, so 0.073
    // gives a 3 mm clearance to avoid z-fighting with the texture plane.
    mesh.position.set(x, 0.073, z);
    // Knights face their opponent. White faces -z (toward row 0),
    // black faces +z (toward row 7). The shape's snout points -x, so
    // we rotate +PI/2 (white) or -PI/2 (black) around y.
    if (piece.type === 'n') {
      mesh.rotation.y = piece.color === 'white' ? Math.PI / 2 : -Math.PI / 2;
    }
    ch.piecesGroup.add(mesh);
    ch.pieceMeshes[r][c] = mesh;
  }

  _clearChessPieces() {
    const ch = this._chess;
    if (!ch.piecesGroup) return;
    while (ch.piecesGroup.children.length) {
      ch.piecesGroup.remove(ch.piecesGroup.children[0]);
    }
    if (ch.pieceMeshes) {
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) ch.pieceMeshes[r][c] = null;
    }
  }

  _clearChessHighlights() {
    const ch = this._chess;
    if (!ch.highlightGroup) return;
    while (ch.highlightGroup.children.length) {
      const m = ch.highlightGroup.children[0];
      ch.highlightGroup.remove(m);
      m.geometry?.dispose?.();
      m.material?.dispose?.();
    }
  }

  // Add a translucent square overlay (selected = green, valid = yellow,
  // capturable = red).
  _addSquareHighlight(r, c, color, opacity = 0.45) {
    const ch = this._chess;
    const { x, z } = this._chessSquareCentre(r, c);
    const w = ch.cell * 0.92;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.0735, z);
    mesh.renderOrder = 3;
    ch.highlightGroup.add(mesh);
  }

  _showSelection(r, c, validMoves) {
    this._clearChessHighlights();
    this._addSquareHighlight(r, c, 0x35E07A, 0.55);
    for (const m of validMoves) {
      const tgtPiece = this._chess.board[m.to.r][m.to.c];
      const colour = tgtPiece ? 0xFF5566 : 0xFFD86B;
      this._addSquareHighlight(m.to.r, m.to.c, colour, 0.45);
    }
  }

  // ────────────────────────────────────────────────────────────
  //  Click handling — Windows-3D-Chess style 2-tap selection.
  // ────────────────────────────────────────────────────────────
  _handleChessClick(ctx) {
    const ch = this._chess;
    if (!ch.active || ch.thinking || ch.anims.length > 0) return false;
    if (ch.turn !== 'white') return false;

    const local = this.group.worldToLocal(ctx.point.clone());
    const sq = this._chessSquareFromPoint(local);
    if (!sq) return false;

    const piece = ch.board[sq.r][sq.c];

    // Phase 1 — pick a piece. If we already have one selected, the
    // click is interpreted as an attempted move (or a re-select).
    if (ch.selected) {
      const matchedMove = ch.validMoves?.find(
        m => m.to.r === sq.r && m.to.c === sq.c,
      );
      if (matchedMove) {
        this._clearChessHighlights();
        ch.selected = null;
        ch.validMoves = null;
        this._executePlayerMove(matchedMove);
        return;
      }
      // Re-select if the click landed on another own piece.
      if (piece && piece.color === 'white') {
        this._selectAt(sq.r, sq.c);
        return;
      }
      // Otherwise treat as deselect.
      this._clearChessHighlights();
      ch.selected = null;
      ch.validMoves = null;
      return;
    }

    // No selection yet. Only pick own pieces; let other clicks fall
    // through (so VR teleport on empty squares still works).
    if (!piece || piece.color !== 'white') return false;
    this._selectAt(sq.r, sq.c);
  }

  _selectAt(r, c) {
    const ch = this._chess;
    const moves = this._chessLegalMoves(ch.board, 'white').filter(
      m => m.from.r === r && m.from.c === c,
    );
    if (!moves.length) {
      // No legal moves → flash a dim red highlight as feedback.
      this._clearChessHighlights();
      this._addSquareHighlight(r, c, 0xFF5566, 0.5);
      setTimeout(() => {
        if (this._chess.selected === null) this._clearChessHighlights();
      }, 600);
      return;
    }
    ch.selected = { r, c };
    ch.validMoves = moves;
    this._showSelection(r, c, moves);
  }

  // Apply a player move: animate piece, capture, check for end, hand off to AI.
  _executePlayerMove(move) {
    const ch = this._chess;
    this._applyMoveToBoard(move);
    this._animateMove(move, () => {
      // Reactions: capture / check / win.
      const opp = 'black';
      const oppKing = this._chessFindKing(ch.board, opp);
      const oppInCheck = oppKing && this._chessIsAttacked(ch.board, oppKing.r, oppKing.c, 'white');
      const oppMoves = this._chessLegalMoves(ch.board, opp);
      if (oppMoves.length === 0) {
        if (oppInCheck) {
          this._onWin('player');
        } else {
          // Stalemate — treat as a draw, but still end the match.
          this._onWin('player');     // banner-only outcome; rare anyway
        }
        return;
      }
      if (move.captured) this._say('playerCapture');
      else if (oppInCheck) this._say('check');
      else if (Math.random() < 0.45) this._say('playerMove');

      ch.turn = 'black';
      ch.thinking = true;
      if (this.companion) this.companion.setExpression('thinking');
      // Slight think delay so the AI feels deliberate.
      setTimeout(() => this._chessAITurn(), 550);
    });
  }

  _applyMoveToBoard(move) {
    const ch = this._chess;
    const piece = ch.board[move.from.r][move.from.c];
    const finalType = move.promotion || piece.type;
    ch.board[move.from.r][move.from.c] = null;
    ch.board[move.to.r][move.to.c] = { type: finalType, color: piece.color };
  }

  // ────────────────────────────────────────────────────────────
  //  Animations: piece move (player or AI), with optional AI cursor.
  //  All animations advance in `_tickChessAnimations(delta)`.
  // ────────────────────────────────────────────────────────────
  _animateMove(move, onComplete, opts = {}) {
    const ch = this._chess;
    const fromMesh = ch.pieceMeshes[move.from.r][move.from.c];
    const toCapture = ch.pieceMeshes[move.to.r][move.to.c];

    if (!fromMesh) { onComplete?.(); return; }

    const start = fromMesh.position.clone();
    const end = this._chessSquareCentre(move.to.r, move.to.c);
    const endVec = new THREE.Vector3(end.x, 0.073, end.z);

    // Capture: have the captured piece sink + fade then disappear.
    if (toCapture) {
      this._animateCapture(toCapture);
    }

    // Update the mesh-grid bookkeeping immediately. The mesh is the
    // same instance that started at `move.from` — we just retag it.
    ch.pieceMeshes[move.from.r][move.from.c] = null;
    ch.pieceMeshes[move.to.r][move.to.c] = fromMesh;

    // Promotions: swap the mesh for the promoted piece's mesh once
    // the move animation completes (clean visual transition).
    const promotion = move.promotion;
    const colorOfMover = ch.board[move.to.r][move.to.c].color;

    ch.anims.push({
      kind: 'piece',
      mesh: fromMesh,
      from: start,
      to: endVec,
      arc: 0.45,                         // metres lifted at apex
      duration: opts.duration ?? 0.7,
      t: 0,
      onComplete: () => {
        if (promotion) {
          ch.piecesGroup.remove(fromMesh);
          this._placeChessPiece(move.to.r, move.to.c, {
            type: promotion, color: colorOfMover,
          });
        }
        onComplete?.();
      },
    });
  }

  _animateCapture(mesh) {
    const ch = this._chess;
    ch.anims.push({
      kind: 'capture',
      mesh,
      t: 0,
      duration: 0.45,
      onComplete: () => {
        ch.piecesGroup.remove(mesh);
      },
    });
  }

  _animateAICursorTo(targetR, targetC, duration, onComplete, opts = {}) {
    const ch = this._chess;
    const { x, z } = this._chessSquareCentre(targetR, targetC);
    const fromVec = ch.aiCursor.position.clone();
    const toVec = new THREE.Vector3(x, 0, z);
    if (ch.aiCursorState === 'hidden') {
      ch.aiCursor.position.copy(toVec);    // snap on first show
      ch.aiCursor.visible = true;
      ch.aiCursorState = 'fadeIn';
    }
    ch.anims.push({
      kind: 'cursor',
      from: fromVec,
      to: toVec,
      t: 0,
      duration: duration ?? 0.55,
      fadeIn: opts.fadeIn ?? false,
      fadeOut: opts.fadeOut ?? false,
      onComplete,
    });
  }

  _tickChessAnimations(delta) {
    const ch = this._chess;
    if (!ch?.anims?.length) return;
    const remaining = [];
    for (const a of ch.anims) {
      a.t = Math.min(1, a.t + delta / a.duration);
      const e = this._easeInOut(a.t);
      if (a.kind === 'piece') {
        const x = a.from.x + (a.to.x - a.from.x) * e;
        const z = a.from.z + (a.to.z - a.from.z) * e;
        // Parabolic lift — sin(πt) gives 0 at endpoints, 1 at midpoint.
        const lift = Math.sin(Math.PI * e) * a.arc;
        a.mesh.position.set(x, 0.073 + lift, z);
      } else if (a.kind === 'capture') {
        // Captured piece sinks AND shrinks. We avoid touching material
        // opacity here because piece factories share materials across
        // every piece of the same colour — fading the material would
        // ghost out the entire army on capture.
        a.mesh.position.y = 0.073 - 0.45 * e;
        const s = Math.max(0.001, 1 - e);
        a.mesh.scale.set(s, s, s);
      } else if (a.kind === 'cursor') {
        ch.aiCursor.position.x = a.from.x + (a.to.x - a.from.x) * e;
        ch.aiCursor.position.z = a.from.z + (a.to.z - a.from.z) * e;
        if (a.fadeIn) this._setAICursorOpacity(e);
        else if (a.fadeOut) this._setAICursorOpacity(1 - e);
      }
      if (a.t >= 1) {
        a.onComplete?.();
      } else {
        remaining.push(a);
      }
    }
    ch.anims = remaining;
  }

  _easeInOut(t) {
    // Smooth acceleration / deceleration for piece travel.
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // ────────────────────────────────────────────────────────────
  //  AI turn:  pick best move via 2-ply minimax, then animate
  //  (1) cursor approaches the source square,
  //  (2) cursor + piece travel to destination,
  //  (3) cursor fades out.
  // ────────────────────────────────────────────────────────────
  _chessAITurn() {
    const ch = this._chess;
    if (!ch.active || ch.turn !== 'black') return;

    const move = this._chessAIChooseMove();
    if (!move) {
      // No legal moves — checkmate (player wins) or stalemate.
      const king = this._chessFindKing(ch.board, 'black');
      const inCheck = king && this._chessIsAttacked(ch.board, king.r, king.c, 'white');
      ch.thinking = false;
      this._onWin(inCheck ? 'player' : 'player');   // stalemate counts as player conclusion
      return;
    }

    // Phase 1: cursor approaches source square. Fades in if hidden.
    this._animateAICursorTo(move.from.r, move.from.c, 0.55, () => {
      // Phase 2: cursor + piece travel to destination together.
      this._animateAICursorTo(move.to.r, move.to.c, 0.65);
      this._applyMoveToBoard(move);
      this._animateMove(move, () => {
        // Phase 3: cursor fades out.
        this._animateAICursorTo(move.to.r, move.to.c, 0.4, () => {
          this._hideAICursor();
          this._chessFinishAITurn(move);
        }, { fadeOut: true });
      }, { duration: 0.65 });
    }, { fadeIn: ch.aiCursorState === 'hidden' });
  }

  _chessFinishAITurn(move) {
    const ch = this._chess;
    ch.thinking = false;
    if (this.companion) this.companion.setExpression('idle');

    // Reactions
    const playerKing = this._chessFindKing(ch.board, 'white');
    const playerInCheck = playerKing &&
      this._chessIsAttacked(ch.board, playerKing.r, playerKing.c, 'black');
    const playerMoves = this._chessLegalMoves(ch.board, 'white');
    if (playerMoves.length === 0) {
      this._onWin(playerInCheck ? 'ai' : 'ai');     // stalemate ends match
      return;
    }
    if (move.captured) this._say('aiCapture');
    else if (playerInCheck) this._say('aiCheck');
    else if (Math.random() < 0.4) this._say('aiMove');

    ch.turn = 'white';
  }

  // 2-ply minimax — for each AI candidate, evaluate the WORST response
  // the player could make, then pick the move whose worst response is
  // best. Quick (≈1k-2k evals) and good enough for casual play.
  _chessAIChooseMove() {
    const ch = this._chess;
    const moves = this._chessLegalMoves(ch.board, 'black');
    if (!moves.length) return null;

    let best = -Infinity, candidates = [];
    for (const m of moves) {
      const undo = this._applySimulated(ch.board, m);
      const playerMoves = this._chessLegalMoves(ch.board, 'white');
      let worst;
      if (playerMoves.length === 0) {
        const king = this._chessFindKing(ch.board, 'white');
        const inCheck = king && this._chessIsAttacked(ch.board, king.r, king.c, 'black');
        worst = inCheck ? 1e7 : 0;     // mate or stalemate
      } else {
        worst = Infinity;
        for (const m2 of playerMoves) {
          const undo2 = this._applySimulated(ch.board, m2);
          const e = this._chessEval(ch.board);
          undo2();
          if (e < worst) worst = e;
          if (worst < best) break;       // alpha-beta-ish prune
        }
      }
      undo();
      if (worst > best) { best = worst; candidates = [m]; }
      else if (worst === best) candidates.push(m);
    }
    return candidates[(Math.random() * candidates.length) | 0];
  }

  // Apply a move in-place; returns an undo closure.
  _applySimulated(board, move) {
    const captured = board[move.to.r][move.to.c];
    const piece = board[move.from.r][move.from.c];
    const finalP = move.promotion
      ? { type: move.promotion, color: piece.color }
      : piece;
    board[move.to.r][move.to.c] = finalP;
    board[move.from.r][move.from.c] = null;
    return () => {
      board[move.from.r][move.from.c] = piece;
      board[move.to.r][move.to.c] = captured;
    };
  }

  // Evaluation: positive = favour BLACK (the AI). Material + small
  // positional bonuses for centre and pawn advancement.
  _chessEval(board) {
    const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const sign = p.color === 'black' ? 1 : -1;
      let bonus = 0;
      if (r >= 2 && r <= 5 && c >= 2 && c <= 5) bonus += 6;
      if (r >= 3 && r <= 4 && c >= 3 && c <= 4) bonus += 6;
      if (p.type === 'p') {
        bonus += p.color === 'black' ? r * 2 : (7 - r) * 2;
      }
      // Develop knights/bishops slightly off back rank.
      if ((p.type === 'n' || p.type === 'b')) {
        if (p.color === 'black' && r > 0) bonus += 4;
        if (p.color === 'white' && r < 7) bonus += 4;
      }
      s += sign * (VAL[p.type] + bonus);
    }
    return s;
  }

  // ────────────────────────────────────────────────────────────
  //  Move generation + check detection
  // ────────────────────────────────────────────────────────────
  _chessLegalMoves(board, color) {
    const moves = this._chessGenPseudoMoves(board, color);
    const opp = color === 'white' ? 'black' : 'white';
    const legal = [];
    for (const m of moves) {
      const undo = this._applySimulated(board, m);
      const king = this._chessFindKing(board, color);
      const inCheck = king
        ? this._chessIsAttacked(board, king.r, king.c, opp)
        : true;
      undo();
      if (!inCheck) legal.push(m);
    }
    return legal;
  }

  _chessGenPseudoMoves(board, color) {
    const moves = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      this._appendPieceMoves(board, r, c, p, moves);
    }
    return moves;
  }

  _appendPieceMoves(board, r, c, p, out) {
    switch (p.type) {
      case 'p': {
        // White starts at row 7 → moves toward row 0 (dr = -1).
        // Black starts at row 0 → moves toward row 7 (dr = +1).
        const dir = p.color === 'white' ? -1 : 1;
        const startRow = p.color === 'white' ? 6 : 1;
        const lastRow = p.color === 'white' ? 0 : 7;
        const r1 = r + dir;
        if (r1 >= 0 && r1 < 8 && !board[r1][c]) {
          if (r1 === lastRow) out.push({ from:{r,c}, to:{r:r1,c}, promotion:'q' });
          else out.push({ from:{r,c}, to:{r:r1,c} });
          const r2 = r + 2 * dir;
          if (r === startRow && !board[r2][c]) {
            out.push({ from:{r,c}, to:{r:r2,c} });
          }
        }
        for (const dc of [-1, 1]) {
          const tr = r + dir, tc = c + dc;
          if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) continue;
          const tgt = board[tr][tc];
          if (tgt && tgt.color !== p.color) {
            if (tr === lastRow) out.push({ from:{r,c}, to:{r:tr,c:tc}, captured:tgt, promotion:'q' });
            else out.push({ from:{r,c}, to:{r:tr,c:tc}, captured:tgt });
          }
        }
        break;
      }
      case 'n': {
        const off = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of off) {
          const tr = r + dr, tc = c + dc;
          if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) continue;
          const tgt = board[tr][tc];
          if (!tgt) out.push({ from:{r,c}, to:{r:tr,c:tc} });
          else if (tgt.color !== p.color) out.push({ from:{r,c}, to:{r:tr,c:tc}, captured:tgt });
        }
        break;
      }
      case 'b': case 'r': case 'q': {
        const dirs = [];
        if (p.type === 'b' || p.type === 'q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
        if (p.type === 'r' || p.type === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
        for (const [dr, dc] of dirs) {
          let tr = r + dr, tc = c + dc;
          while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const tgt = board[tr][tc];
            if (!tgt) {
              out.push({ from:{r,c}, to:{r:tr,c:tc} });
            } else {
              if (tgt.color !== p.color) out.push({ from:{r,c}, to:{r:tr,c:tc}, captured:tgt });
              break;
            }
            tr += dr; tc += dc;
          }
        }
        break;
      }
      case 'k': {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const tr = r + dr, tc = c + dc;
          if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) continue;
          const tgt = board[tr][tc];
          if (!tgt) out.push({ from:{r,c}, to:{r:tr,c:tc} });
          else if (tgt.color !== p.color) out.push({ from:{r,c}, to:{r:tr,c:tc}, captured:tgt });
        }
        break;
      }
    }
  }

  _chessFindKing(board, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === 'k') return { r, c };
    }
    return null;
  }

  _chessIsAttacked(board, r, c, attacker) {
    // Pawn attacks. A pawn at (r ± dir, c ± 1) attacks (r, c). White
    // pawns move -r (so attack from r+1 toward r); black move +r
    // (so attack from r-1 toward r).
    const pdir = attacker === 'white' ? 1 : -1;
    for (const dc of [-1, 1]) {
      const pr = r + pdir, pc = c + dc;
      if (pr < 0 || pr >= 8 || pc < 0 || pc >= 8) continue;
      const p = board[pr][pc];
      if (p && p.color === attacker && p.type === 'p') return true;
    }
    // Knight attacks.
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const tr = r + dr, tc = c + dc;
      if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) continue;
      const p = board[tr][tc];
      if (p && p.color === attacker && p.type === 'n') return true;
    }
    // Bishop / queen diagonals.
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      let tr = r + dr, tc = c + dc;
      while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        const p = board[tr][tc];
        if (p) {
          if (p.color === attacker && (p.type === 'b' || p.type === 'q')) return true;
          break;
        }
        tr += dr; tc += dc;
      }
    }
    // Rook / queen straights.
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      let tr = r + dr, tc = c + dc;
      while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        const p = board[tr][tc];
        if (p) {
          if (p.color === attacker && (p.type === 'r' || p.type === 'q')) return true;
          break;
        }
        tr += dr; tc += dc;
      }
    }
    // King attacks.
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const tr = r + dr, tc = c + dc;
      if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) continue;
      const p = board[tr][tc];
      if (p && p.color === attacker && p.type === 'k') return true;
    }
    return false;
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
