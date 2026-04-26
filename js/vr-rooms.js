/**
 * VR Rooms - With interactive features
 */
import * as THREE from 'three';
import { AICompanion }     from './ai-companion.js?v=20260426-3';
import { mountTripoModel } from './tripo-loader.js?v=20260426-3';

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
    // ����家从 z=+9 入场����朝 -Z 走。所以��望玩家看到正面的物件用 π，
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

  // ── 火焰 / 落地灯 flicker ─────�����������─────────────────────
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
/**
 * StudyVRRoom — interactive classroom mirroring LeisureVRRoom's architecture.
 *
 * Layout (room is 18m × 16m × 6m, back wall at z = -8):
 *   • Back wall  — large 6×3m whiteboard driven by a CanvasTexture that
 *                  switches between idle / lesson / quiz / result modes.
 *   • Left wall  — six clickable "AR study cards" arranged in a 3×2 grid,
 *                  each picking a topic for the AI tutor to teach.
 *   • In front of the board — A/B/C/D answer pad (visible only in quiz
 *                  mode) plus a 4-button control bar (EXPLAIN / QUIZ /
 *                  HINT / NEXT) reachable via VR controller raycast.
 *   • Floor      — six tripo desks + chairs in two rows facing the board.
 *   • Companion  — 绘绘 (mint-teal AICompanion orb): patient teacher voice.
 *
 * The companion's bubble uses the same widget the chat zone uses; nothing
 * leaks to the desktop chat panel. A static lesson + quiz bank lives in
 * `_initLessons()` so the room works fully offline (no API calls needed).
 */
class StudyVRRoom extends VRRoom {
  constructor(scene, options = {}) {
    super(scene, options);

    // ── Companion follow + chatter state (mirror of leisure / chat) ──
    // Same shape as LeisureVRRoom: convert player world pos → room-local,
    // place 绘绘 at a comfortable side-and-slightly-forward offset so she
    // reads as walking the player through each lesson.
    this._studentLocal = new THREE.Vector3();
    this._followOffset = new THREE.Vector3(1.4, -0.45, 0.6);
    this._idleTimer    = null;
    this._greetTimer   = null;
    this._lastSaidAt   = 0;

    // ── Lesson / quiz state machine ───────────────────────────
    //  'idle'    — no topic selected; companion suggests picking a card.
    //  'lesson'  — board shows topic intro + key bullet points.
    //  'quiz'    — board shows current question + 4 options, A/B/C/D
    //              answer pad becomes visible / interactive.
    //  'result'  — feedback banner after a quiz answer; auto-returns to
    //              'quiz' on NEXT click.
    this._currentTopic    = null;     // full topic object
    this._currentMode     = 'idle';
    this._currentQuizIdx  = 0;
    this._lastResultOk    = null;     // last answer correct? (for result UI)

    // ── Whiteboard + answer-pad rendering refs (lazy) ─────────
    this._boardCanvas  = null;
    this._boardCtx     = null;
    this._boardTex     = null;
    this._boardMesh    = null;
    this._answerPad    = [];          // 4 button meshes, hidden by default

    // Build the static lesson + quiz bank and the dialogue pools.
    this._initLessons();
    this._initStudyLines();

    this.build();
  }

  // ── Room construction ──────────────────────────────────────
  build() {
    // Bespoke library shell (warm cream walls + oak floor + acoustic
    // ceiling tiles + cove halo). Replaces the cold base shell so the
    // room reads as a real seminar room before any prop loads.
    this._buildLibraryShell(18, 16, 6);

    // 绘绘 — mint-teal companion. Spawns near the right side of the
    // board so on entry the player sees her drift over toward them.
    this._buildAICompanion(-5.5, 1.2, 5.0, 0x7DD3C0);

    // Exit portal at the front of the room (z = +7 toward the
    // entrance), same convention as the other zone rooms.
    this._buildExitDoor(0, 0, 7);

    // Lighting rig — warm pendant key + soft hemisphere fill +
    // four pendant point lights along the ceiling for depth.
    this.group.add(new THREE.HemisphereLight(0xfff0d8, 0x3a2a1a, 0.42));
    this.group.add(new THREE.AmbientLight(0xffe6c8, 0.20));
    const pendantPositions = [
      [-4, 4.6, -3], [ 4, 4.6, -3], [-4, 4.6, 2], [ 4, 4.6, 2],
    ];
    for (const [x, y, z] of pendantPositions) {
      const l = new THREE.PointLight(0xffd9a0, 0.65, 9.0, 1.6);
      l.position.set(x, y, z);
      this.group.add(l);
    }

    // Interactive surfaces (registered via this.interactables so the
    // desktop click handler and the VR controller raycast both work):
    this._buildWhiteboard();
    this._buildAnswerPad();      // A/B/C/D row (hidden until quiz mode)
    this._buildControlBar();     // EXPLAIN / QUIZ / HINT / NEXT
    this._buildTopicCards();     // 6 clickable AR study cards on left wall

    // Furniture: six student desks + two flanking bookshelves + a
    // teacher's lectern up front. All cached on the tripo loader, so
    // the six desks share a single network fetch.
    this._buildStudyFurniture();

    // Initialise the whiteboard with the idle slate.
    this._setBoard('idle');

    this.onReady();
  }

  // Spawn the player a few metres in front of the entrance, well clear
  // of the seats and facing the whiteboard.
  getSpawnPoint() {
    return this.roomPosition.clone().add(new THREE.Vector3(0, 0, 5));
  }

  // ── Lifecycle ──────────────────────────────────────────────
  enter() {
    super.enter();
    if (this._greetTimer) clearTimeout(this._greetTimer);
    this._greetTimer = setTimeout(() => {
      this._greetTimer = null;
      if (!this.isActive) return;
      this._say('greet');
      this._scheduleIdleChatter(10000 + Math.random() * 7000);
    }, 1700);
  }

  exit() {
    super.exit();
    if (this._idleTimer)  { clearTimeout(this._idleTimer);  this._idleTimer  = null; }
    if (this._greetTimer) { clearTimeout(this._greetTimer); this._greetTimer = null; }
    this.companion?.hideBubble?.();
    this.companion?.setMode?.('idle');
    this.companion?.setExpression?.('idle');
    this.companion?.setFollowTarget?.(null);

    // Reset transient state so a re-entry starts fresh.
    this._currentTopic   = null;
    this._currentMode    = 'idle';
    this._currentQuizIdx = 0;
    this._lastResultOk   = null;
    if (this._boardTex) this._setBoard('idle');
    this._setAnswerPadVisible(false);
  }

  // Per-frame: pull 绘绘 to the side-of-player offset, clamped inside
  // the room. Mirrors LeisureVRRoom.updateStudentPosition exactly.
  updateStudentPosition(worldPos) {
    if (!this.companion) return;
    const local = this._studentLocal.copy(worldPos).sub(this.roomPosition);
    this.companion.lookAtStudent(local.clone());

    const tgt = local.clone().add(this._followOffset);
    const half  = (this.roomSize?.width || 18) / 2 - 1.0;
    const halfD = (this.roomSize?.depth || 16) / 2 - 1.0;
    tgt.x = Math.max(-half,  Math.min(half,  tgt.x));
    tgt.z = Math.max(-halfD, Math.min(halfD, tgt.z));
    tgt.y = Math.max(0.6, Math.min(1.6, tgt.y));
    this.companion.setFollowTarget(tgt);
  }

  // ── Static lesson + quiz bank ──────────────────────────────
  // Six topics × three quiz items each. Bilingual question copy keeps
  // the room useful for both audiences without a server round-trip.
  _initLessons() {
    this._topics = [
      {
        id: 'algebra', emoji: '➕',
        en: 'Algebra', zh: '代数 · 一元一次方程',
        accent: '#FFB870',
        intro:
          '我们来解一元一次方程。\n' +
          'Let\'s work through linear equations together.',
        keyPoints: [
          'Move terms across "=" → flip the sign',
          '左右两边同乘 / 同除一个非零数, 等式仍成立',
          'Goal: isolate x · 把未知数独立出来',
        ],
        quiz: [
          { q: 'Solve  2x + 5 = 13', zh: '解  2x + 5 = 13',
            options: ['x = 3', 'x = 4', 'x = 5', 'x = 6'], answer: 1,
            hint: '先两边同时减 5, 再除以 2.\nSubtract 5 first, then divide by 2.',
            explain: '2x = 8 → x = 4. 不难吧?' },
          { q: 'Solve  3(x − 2) = 9', zh: '解  3(x − 2) = 9',
            options: ['x = 1', 'x = 3', 'x = 5', 'x = 7'], answer: 2,
            hint: '先除以 3, 再两边加 2.\nDivide both sides by 3 first, then add 2.',
            explain: 'x − 2 = 3 → x = 5.' },
          { q: 'If  x + y = 10  and  y = 4, find x', zh: '若 x + y = 10, y = 4, 求 x',
            options: ['4', '5', '6', '7'], answer: 2,
            hint: '把 y 代入第一个式子.\nSubstitute y = 4 into the first equation.',
            explain: 'x + 4 = 10 → x = 6.' },
        ],
      },
      {
        id: 'geometry', emoji: '📐',
        en: 'Geometry', zh: '几何 · 三角形与圆',
        accent: '#9FD8E8',
        intro:
          '几何里, 三角形和圆是一切的起点。\n' +
          'Triangles and circles are where geometry begins.',
        keyPoints: [
          'Triangle interior angles sum to 180°',
          '圆面积 = π · r²; 周长 = 2π · r',
          'Right triangle: a² + b² = c² (Pythagoras)',
        ],
        quiz: [
          { q: 'Sum of interior angles of a triangle?', zh: '三角形的内角和是多少?',
            options: ['90°', '180°', '270°', '360°'], answer: 1,
            hint: '一张纸折成三角形, 三个角合起来是一条直线.',
            explain: '三角形的三个内角永远加起来是 180°.' },
          { q: 'Area of a circle with radius 3?', zh: '半径为 3 的圆面积是多少?',
            options: ['6π', '9π', '12π', '18π'], answer: 1,
            hint: 'Area = π · r².',
            explain: 'π · 3² = 9π.' },
          { q: 'In a right triangle with legs 3 and 4, hypotenuse = ?', zh: '直角三角形两直角边 3 与 4, 斜边是多少?',
            options: ['5', '6', '7', '√25 + 5'], answer: 0,
            hint: 'Pythagoras: a² + b² = c².',
            explain: '3² + 4² = 9 + 16 = 25 → c = 5.' },
        ],
      },
      {
        id: 'english', emoji: '📖',
        en: 'English Reading', zh: '英文阅读 · 词义与语法',
        accent: '#F0A8B8',
        intro:
          '阅读不是查每一个生字, 是抓住句子的骨架。\n' +
          'Reading well means catching the sentence\'s spine, not every word.',
        keyPoints: [
          'Skim first for the topic sentence',
          '注意上下文里的同义词 / 反义词',
          'Watch tone words — adjectives + adverbs',
        ],
        quiz: [
          { q: 'Choose the synonym of "happy".', zh: '选出 "happy" 的同义词.',
            options: ['sad', 'joyful', 'angry', 'tired'], answer: 1,
            hint: '想一想哪个词的情感色彩和 happy 最像.',
            explain: '"Joyful" 表示快乐的、欢喜的, 是 "happy" 最贴近的同义词.' },
          { q: '"She gave a brief speech." What does "brief" mean?', zh: '"brief" 在这里是什么意思?',
            options: ['long', 'short', 'loud', 'quiet'], answer: 1,
            hint: 'Brief 在描述时间长短.',
            explain: '"Brief" 表示简短的, 时间不长.' },
          { q: 'Pick the right preposition: "I am good ___ math."', zh: '选合适的介词: "I am good ___ math."',
            options: ['in', 'on', 'at', 'with'], answer: 2,
            hint: 'Good ___ + 学科 / 技能, 是个固定搭配.',
            explain: '固定搭配是 "good at + 名词", 表示擅长某事.' },
        ],
      },
      {
        id: 'biology', emoji: '🧬',
        en: 'Biology', zh: '生物 · 细胞与遗传',
        accent: '#A8E0A0',
        intro:
          '生物从细胞讲起, 再到遗传与生态。\n' +
          'Biology starts with cells, then heredity and ecosystems.',
        keyPoints: [
          'Plants make food via photosynthesis (CO₂ + H₂O + light)',
          '线粒体是细胞的"能量工厂" (Mitochondria → ATP)',
          'DNA 由 4 种碱基组成: A, T, C, G',
        ],
        quiz: [
          { q: 'Which organelle is the cell\'s "power plant"?', zh: '哪个细胞器被称作"能量工厂"?',
            options: ['Nucleus', 'Mitochondrion', 'Ribosome', 'Vacuole'], answer: 1,
            hint: '它把营养物质变成 ATP.',
            explain: '线粒体 (mitochondrion) 通过细胞呼吸生成 ATP, 是细胞的"发电站".' },
          { q: 'Photosynthesis needs all of these EXCEPT?', zh: '光合作用不需要下面哪一项?',
            options: ['Sunlight', 'Water', 'Carbon dioxide', 'Oxygen'], answer: 3,
            hint: '想想光合作用产物里有什么.',
            explain: '光合作用消耗 CO₂ + H₂O + 光, 释放出 O₂; O₂ 是产物而不是原料.' },
          { q: 'How many bases are in DNA?', zh: 'DNA 由几种碱基组成?',
            options: ['2', '3', '4', '5'], answer: 2,
            hint: '记一下: A/T/C/G.',
            explain: 'DNA 由腺嘌呤 A、胸腺嘧啶 T、胞嘧啶 C、鸟嘌呤 G 这 4 种碱基构成.' },
        ],
      },
      {
        id: 'history', emoji: '📜',
        en: 'World History', zh: '历史 · 古代与近代',
        accent: '#D9B879',
        intro:
          '历史不是背年份, 是看一群人为什么做了某个选择。\n' +
          'History is about why people made the choices they did.',
        keyPoints: [
          'Tang Dynasty 唐朝 begins in 618 CE',
          '活字印刷术: 北宋毕昇 (~1040 CE)',
          'Apollo 11 lunar landing: July 1969',
        ],
        quiz: [
          { q: 'Which year did the Tang Dynasty begin?', zh: '唐朝建立于哪一年?',
            options: ['581', '618', '907', '960'], answer: 1,
            hint: '李渊在隋末称帝, 那一年距 600 不远.',
            explain: '618 年, 李渊建立唐朝, 定都长安.' },
          { q: 'Who invented movable-type printing?', zh: '谁发明了活字印刷术?',
            options: ['蔡伦 Cai Lun', '毕昇 Bi Sheng', '张衡 Zhang Heng', '祖冲之 Zu Chongzhi'], answer: 1,
            hint: '北宋时期一位工匠.',
            explain: '北宋毕昇约在 1040 年用胶泥制活字, 大幅提高了印书效率.' },
          { q: 'Year of the first crewed Moon landing?', zh: '人类首次登月是哪一年?',
            options: ['1957', '1961', '1969', '1972'], answer: 2,
            hint: 'Apollo 11.',
            explain: '1969 年 7 月 20 日, Apollo 11 把 Armstrong 与 Aldrin 送上了月球.' },
        ],
      },
      {
        id: 'programming', emoji: '💻',
        en: 'Programming', zh: '编程 · JavaScript 入门',
        accent: '#A8B8E8',
        intro:
          'JavaScript 的有趣之处在于它的"宽松"——\n' +
          'JS is famously forgiving. That\'s a feature and a trap.',
        keyPoints: [
          'typeof null === "object"  (历史遗留 bug)',
          '"+" 遇到字符串时变成拼接 → "2" + 2 = "22"',
          'Recursion: 函数调用自己, 但要有终止条件',
        ],
        quiz: [
          { q: 'What does  typeof null  return?', zh: 'typeof null  的结果是什么?',
            options: ['"null"', '"object"', '"undefined"', '"number"'], answer: 1,
            hint: '这是一个历史遗留的"bug-as-feature".',
            explain: '出于历史原因, typeof null 返回 "object" —— 写规范的人当年没改回来.' },
          { q: 'Result of  2 + "2"  in JavaScript?', zh: 'JavaScript 中 2 + "2" 的结果是?',
            options: ['4', '"4"', '"22"', 'NaN'], answer: 2,
            hint: '+ 一旦遇到字符串就会变成拼接.',
            explain: '"+" 遇到字符串时是拼接而非加法, 数字 2 被转成字符串 "2", 拼接得到 "22".' },
          { q: 'Which is true about recursion?', zh: '关于递归, 下列哪一项正确?',
            options: [
              'It cannot have a base case',
              'It must call itself with smaller input until a base case',
              'It always uses less memory than a loop',
              'It cannot return a value',
            ], answer: 1,
            hint: '想想"什么时候停下来".',
            explain: '递归一定要有基线条件 (base case), 并且每次自调用要让问题规模变小, 否则会栈溢出.' },
        ],
      },
    ];
  }

  // Bilingual chatter pools for 绘绘. Mirrors leisure's `_idleLines`.
  _initStudyLines() {
    this._studyLines = {
      greet: [
        '欢迎来到学习区~ 我是绘绘.\n' +
        'Welcome! I\'m 绘绘. Pick a card on the left wall — I\'ll teach you.',
        '今天想学点什么? 左边墙上有六张课件卡.\n' +
        'There are six topic cards on the left wall — pick one to start.',
      ],
      idleNoTopic: [
        '想学什么都行, 选一张卡片我就开讲.\n' +
        'Pick any card and I\'ll explain it for you.',
        '我备课很久啦, 别让我闲着哦~\n' +
        'I\'ve been waiting to teach. Pick a topic anytime.',
      ],
      idleInLesson: [
        '看明白了再点 "QUIZ", 我来出题.\n' +
        'When you\'re ready, hit QUIZ and I\'ll test you.',
        '别急, 这一段我可以再讲一遍 —— 点 "EXPLAIN".\n' +
        'No rush. Click EXPLAIN to recap if you\'d like.',
      ],
      idleInQuiz: [
        '认真选选看~ 点 "HINT" 我会给个提示.\n' +
        'Take your time. HINT gives you a small clue.',
      ],
      pickTopicFirst: [
        '先选一张课件卡, 我才知道讲什么呢.\n' +
        'Pick a card first so I know what to teach.',
      ],
      explain: [
        '我来再讲一遍核心要点.\n' +
        'Let me walk through the key points again.',
        '记不住没关系, 我们再来一遍.\n' +
        'It\'s okay if it didn\'t click. Once more, slowly.',
      ],
      hintUsed: [
        '小提示送上 ✦\nHere\'s a hint.',
      ],
      noQuizYet: [
        '现在还没有题目哦, 先点 "QUIZ" 开始.\n' +
        'No active question yet — tap QUIZ to start one.',
      ],
      correct: [
        '答对啦! 漂亮 ✦\nNice — that\'s correct!',
        '没错! 这一题你拿下了.\n' +
        'Exactly. You got it.',
        '回答完美~\n' +
        'Perfect answer.',
      ],
      wrong: [
        '差一点点, 再看看选项.\n' +
        'Almost — give the options another look.',
        '别慌, 我们一起再分析一遍.\n' +
        'Don\'t worry. Let\'s think it through together.',
      ],
    };
  }

  // ── Speech helpers (mirror of LeisureVRRoom._say) ─────────
  _say(category, payload) {
    if (!this.companion?.say) return;
    const pool = this._studyLines?.[category];
    let text;
    if (Array.isArray(pool) && pool.length) {
      text = pool[(Math.random() * pool.length) | 0];
    } else if (typeof payload === 'string') {
      text = payload;
    }
    if (!text) return;
    this.companion.say(text);
    this._lastSaidAt = performance.now();
  }

  // Recursive idle-chatter scheduler (same shape as leisure).
  _scheduleIdleChatter(initialDelayMs) {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    const delay = initialDelayMs ?? (15000 + Math.random() * 9000);
    this._idleTimer = setTimeout(() => {
      this._idleTimer = null;
      if (!this.isActive) return;
      // Don't pile a fresh idle bubble on top of a recent reaction.
      if (performance.now() - this._lastSaidAt > 5000) {
        if      (this._currentMode === 'quiz')   this._say('idleInQuiz');
        else if (this._currentMode === 'lesson' ||
                 this._currentMode === 'result') this._say('idleInLesson');
        else                                     this._say('idleNoTopic');
      }
      this._scheduleIdleChatter();
    }, Math.max(2000, delay));
  }

  // ── Topic / quiz interactions ──────────────────────────────
  _startTopic(topic) {
    this._currentTopic    = topic;
    this._currentMode     = 'lesson';
    this._currentQuizIdx  = 0;
    this._lastResultOk    = null;
    this._setAnswerPadVisible(false);
    this._setBoard('lesson');
    this.companion?.setExpression?.('happy');
    this._say(null, topic.intro);
  }

  _startQuiz() {
    if (!this._currentTopic) {
      this.companion?.setExpression?.('thinking');
      this._say('pickTopicFirst');
      return;
    }
    this._currentMode    = 'quiz';
    this._currentQuizIdx = 0;
    this._lastResultOk   = null;
    this._setBoard('quiz');
    this._setAnswerPadVisible(true);
    this.companion?.setExpression?.('happy');
    this._say(null, '出题啦, 看清楚选项哦.\nHere\'s your first question — pick A, B, C or D.');
  }

  _explain() {
    if (!this._currentTopic) {
      this._say('pickTopicFirst');
      return;
    }
    this._currentMode  = 'lesson';
    this._lastResultOk = null;
    this._setAnswerPadVisible(false);
    this._setBoard('lesson');
    this.companion?.setExpression?.('thinking');
    this._say('explain');
  }

  _hint() {
    if (this._currentMode !== 'quiz' || !this._currentTopic) {
      this._say('noQuizYet');
      return;
    }
    const item = this._currentTopic.quiz[this._currentQuizIdx];
    this._say('hintUsed');
    setTimeout(() => {
      if (this.isActive) this.companion?.say?.(item.hint);
    }, 1700);
  }

  _next() {
    if (!this._currentTopic) {
      this._say('pickTopicFirst');
      return;
    }
    if (this._currentMode === 'lesson') { this._startQuiz(); return; }
    // 'quiz' or 'result' → advance to the next quiz item, cycling at the end.
    this._currentQuizIdx =
      (this._currentQuizIdx + 1) % this._currentTopic.quiz.length;
    this._currentMode  = 'quiz';
    this._lastResultOk = null;
    this._setBoard('quiz');
    this._setAnswerPadVisible(true);
    this.companion?.setExpression?.('happy');
    this._say(null, '下一题来咯~\nNext one!');
  }

  _answer(idx) {
    if (this._currentMode !== 'quiz' || !this._currentTopic) {
      this._say('noQuizYet');
      return;
    }
    const item = this._currentTopic.quiz[this._currentQuizIdx];
    const ok = (idx === item.answer);
    this._lastResultOk = ok;
    this._currentMode  = 'result';
    this._setBoard('result', { picked: idx });
    this._setAnswerPadVisible(false);
    if (ok) {
      this.companion?.setExpression?.('happy');
      this._say('correct');
      setTimeout(() => {
        if (this.isActive) this.companion?.say?.(item.explain);
      }, 1700);
    } else {
      this.companion?.setExpression?.('thinking');
      this._say('wrong');
      setTimeout(() => {
        if (this.isActive) this.companion?.say?.(item.explain);
      }, 1900);
    }
  }

  // ── Library shell (warm cream walls + oak floor + ceiling) ─
  _buildLibraryShell(width, depth, height) {
    this.roomSize = { width, depth, height };

    // Floor — warm oak
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x8a6038, roughness: 0.78, metalness: 0.05,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Walls — soft cream with slight warm tone
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf3eadb, roughness: 0.92, side: THREE.DoubleSide,
    });
    // Back wall (where the whiteboard mounts)
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height), wallMat);
    backWall.position.set(0, height / 2, -depth / 2);
    this.group.add(backWall);

    // Side walls
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height), wallMat.clone());
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-width / 2, height / 2, 0);
    this.group.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height), wallMat.clone());
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(width / 2, height / 2, 0);
    this.group.add(rightWall);

    // Front wall (opposite the board, around the exit door)
    const frontWall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height), wallMat.clone());
    frontWall.rotation.y = Math.PI;
    frontWall.position.set(0, height / 2, depth / 2);
    this.group.add(frontWall);

    // Ceiling — pale acoustic-tile look
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xfaf5ea, roughness: 0.95,
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height;
    this.group.add(ceiling);

    // Wood baseboard ring — subtle warmth at floor level.
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x4a3018, roughness: 0.7,
    });
    const front  = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.06), baseMat);
    front.position.set(0, 0.09,  depth / 2 - 0.03);
    this.group.add(front);
    const back   = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.06), baseMat);
    back.position.set(0, 0.09, -depth / 2 + 0.03);
    this.group.add(back);
    const lside  = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, depth), baseMat);
    lside.position.set(-width / 2 + 0.03, 0.09, 0);
    this.group.add(lside);
    const rside  = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, depth), baseMat);
    rside.position.set( width / 2 - 0.03, 0.09, 0);
    this.group.add(rside);
  }

  // ── Whiteboard ─────────────────────────────────────────────
  // Builds a 6×3m whiteboard on the back wall whose front face is a
  // CanvasTexture we redraw whenever the lesson state changes.
  _buildWhiteboard() {
    const wallZ = -this.roomSize.depth / 2 + 0.02;

    // Frame (dark walnut)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.6 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.4, 0.12), frameMat);
    frame.position.set(0, 2.5, wallZ + 0.08);
    this.group.add(frame);

    // Whiteboard surface — driven by canvas
    const W = 1280, H = 640;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const boardMat = new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex,
      emissiveIntensity: 0.18, roughness: 0.35, metalness: 0.05,
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.0), boardMat);
    board.position.set(0, 2.5, wallZ + 0.16);
    this.group.add(board);

    this._boardCanvas = cv;
    this._boardCtx    = ctx;
    this._boardTex    = tex;
    this._boardMesh   = board;

    // Tiny mounting tray below the board (decorative).
    const trayMat = new THREE.MeshStandardMaterial({ color: 0xc0a070, roughness: 0.4, metalness: 0.4 });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.06, 0.18), trayMat);
    tray.position.set(0, 0.95, wallZ + 0.18);
    this.group.add(tray);
  }

  // Re-render the whiteboard for a given mode.
  // mode: 'idle' | 'lesson' | 'quiz' | 'result'
  _setBoard(mode, payload) {
    if (!this._boardCtx) return;
    const ctx = this._boardCtx;
    const W = this._boardCanvas.width, H = this._boardCanvas.height;

    // Wipe with a slightly off-white "marker board" tone.
    ctx.fillStyle = '#fbfaf5';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid for a real-classroom feel.
    ctx.strokeStyle = 'rgba(0,0,0,0.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const topic = this._currentTopic;
    if (mode === 'idle' || !topic) {
      // Idle slate: classroom title + how-to.
      ctx.fillStyle = '#2a2418';
      ctx.font = '700 92px "Georgia", "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Study Room', W / 2, H * 0.30);

      ctx.font = '500 60px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#5a4830';
      ctx.fillText('学习区 · 互动课堂', W / 2, H * 0.46);

      // CTA line
      ctx.font = '500 38px "Inter","Helvetica Neue",sans-serif';
      ctx.fillStyle = '#7a5a30';
      ctx.fillText('← Pick a card on the left wall to start', W / 2, H * 0.66);
      ctx.font = '500 36px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#7a5a30';
      ctx.fillText('或选择左墙上的一张课件卡开始', W / 2, H * 0.78);

      this._boardTex.needsUpdate = true;
      return;
    }

    // Top accent bar in the topic colour for visual identity.
    ctx.fillStyle = topic.accent || '#FFB870';
    ctx.fillRect(0, 0, W, 14);

    // Topic title row (emoji + EN + ZH).
    ctx.fillStyle = '#2a2418';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '90px "Segoe UI Emoji", Arial';
    const emojiX = 60, titleY = 90;
    ctx.fillText(topic.emoji, emojiX, titleY);
    ctx.font = '700 64px "Georgia", "Times New Roman", serif';
    ctx.fillText(topic.en, emojiX + 110, titleY - 6);
    ctx.font = '500 44px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#6e4a26';
    ctx.fillText('· ' + topic.zh, emojiX + 110 + ctx.measureText(topic.en).width + 30, titleY + 4);

    // Mode-specific body
    if (mode === 'lesson') {
      this._drawLessonBody(ctx, W, H, topic);
    } else if (mode === 'quiz') {
      const q = topic.quiz[this._currentQuizIdx];
      this._drawQuizBody(ctx, W, H, q, this._currentQuizIdx, topic.quiz.length);
    } else if (mode === 'result') {
      const q = topic.quiz[this._currentQuizIdx];
      this._drawResultBody(ctx, W, H, q, this._lastResultOk, payload?.picked);
    }

    this._boardTex.needsUpdate = true;
  }

  _drawLessonBody(ctx, W, H, topic) {
    ctx.fillStyle = '#2a2418';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '500 36px "Inter","Helvetica Neue",sans-serif';

    let y = 180;
    const x = 80;
    ctx.fillStyle = '#3a2a18';
    ctx.font = '600 38px "Inter","Helvetica Neue",sans-serif';
    ctx.fillText('Key points · 核心要点', x, y);
    y += 60;

    ctx.font = '500 32px "Inter","PingFang SC",sans-serif';
    ctx.fillStyle = '#2a2418';
    for (const pt of topic.keyPoints) {
      // Bullet
      ctx.fillStyle = topic.accent || '#FFB870';
      ctx.beginPath(); ctx.arc(x + 10, y + 18, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2418';
      ctx.fillText(pt, x + 36, y);
      y += 56;
    }

    // Footer hint to encourage moving to quiz.
    y = H - 80;
    ctx.fillStyle = '#7a5a30';
    ctx.font = '500 28px "Inter","PingFang SC",sans-serif';
    ctx.fillText('Press QUIZ to test yourself · 按 QUIZ 让我出题', x, y);
  }

  _drawQuizBody(ctx, W, H, q, qIdx, qTotal) {
    const x = 80;
    let y = 180;

    // Question counter chip
    ctx.fillStyle = 'rgba(122, 90, 48, 0.15)';
    this._roundRect(ctx, x, y, 240, 46, 23); ctx.fill();
    ctx.fillStyle = '#7a5a30';
    ctx.font = '600 26px "Inter","PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Question ${qIdx + 1} / ${qTotal}`, x + 120, y + 23);

    // Question (EN over ZH)
    y += 80;
    ctx.fillStyle = '#2a2418';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '600 40px "Inter","Helvetica Neue",sans-serif';
    ctx.fillText(q.q, x, y);
    y += 55;
    ctx.fillStyle = '#5a4830';
    ctx.font = '500 32px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(q.zh, x, y);

    // Options as a 2×2 grid pinned to the lower half so it feels like
    // an exam paper rather than a wall of text.
    const labels = ['A', 'B', 'C', 'D'];
    const padX = 80, padY = 360;
    const colW = (W - padX * 2 - 30) / 2;
    const rowH = 110;
    for (let i = 0; i < 4; i++) {
      const cx = padX + (i % 2) * (colW + 30);
      const cy = padY + ((i / 2) | 0) * (rowH + 20);
      // Card
      ctx.fillStyle = 'rgba(255, 248, 234, 1)';
      this._roundRect(ctx, cx, cy, colW, rowH, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(122, 90, 48, 0.4)'; ctx.lineWidth = 2;
      this._roundRect(ctx, cx, cy, colW, rowH, 18); ctx.stroke();
      // Letter chip
      ctx.fillStyle = '#7a5a30';
      ctx.beginPath(); ctx.arc(cx + 38, cy + rowH / 2, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 32px "Inter",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], cx + 38, cy + rowH / 2 + 2);
      // Option text
      ctx.fillStyle = '#2a2418';
      ctx.font = '500 32px "Inter","PingFang SC",sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(q.options[i], cx + 80, cy + rowH / 2 + 2);
    }
  }

  _drawResultBody(ctx, W, H, q, ok, picked) {
    // Reuse the quiz layout, then overlay a result banner that highlights
    // the correct + picked options.
    const labels = ['A', 'B', 'C', 'D'];

    // Question echo (shorter, since result banner takes vertical space).
    let y = 180;
    const x = 80;
    ctx.fillStyle = '#2a2418';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '600 38px "Inter","Helvetica Neue",sans-serif';
    ctx.fillText(q.q, x, y);
    y += 50;
    ctx.fillStyle = '#5a4830';
    ctx.font = '500 30px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(q.zh, x, y);

    // Banner
    y = 290;
    ctx.fillStyle = ok ? 'rgba(72, 160, 110, 0.18)' : 'rgba(200, 80, 80, 0.18)';
    this._roundRect(ctx, x, y, W - x * 2, 70, 16); ctx.fill();
    ctx.fillStyle = ok ? '#2c8c5c' : '#a4423c';
    ctx.font = '700 36px "Inter","PingFang SC",sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      ok ? `✓  Correct! · 答对啦` : `✗  Not quite · 再试一次`,
      x + 24, y + 35);

    // Options grid with highlight
    const padX = 80, padY = 400;
    const colW = (W - padX * 2 - 30) / 2;
    const rowH = 100;
    for (let i = 0; i < 4; i++) {
      const cx = padX + (i % 2) * (colW + 30);
      const cy = padY + ((i / 2) | 0) * (rowH + 18);
      const isAnswer = (i === q.answer);
      const isPicked = (i === picked);
      // Card fill
      if (isAnswer) ctx.fillStyle = 'rgba(72, 160, 110, 0.28)';
      else if (isPicked && !ok) ctx.fillStyle = 'rgba(200, 80, 80, 0.20)';
      else ctx.fillStyle = 'rgba(255, 248, 234, 1)';
      this._roundRect(ctx, cx, cy, colW, rowH, 16); ctx.fill();
      // Border
      if (isAnswer) ctx.strokeStyle = '#2c8c5c';
      else if (isPicked && !ok) ctx.strokeStyle = '#a4423c';
      else ctx.strokeStyle = 'rgba(122, 90, 48, 0.3)';
      ctx.lineWidth = isAnswer || (isPicked && !ok) ? 3 : 2;
      this._roundRect(ctx, cx, cy, colW, rowH, 16); ctx.stroke();
      // Letter chip
      ctx.fillStyle = isAnswer ? '#2c8c5c' : (isPicked && !ok ? '#a4423c' : '#7a5a30');
      ctx.beginPath(); ctx.arc(cx + 36, cy + rowH / 2, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 28px "Inter",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], cx + 36, cy + rowH / 2 + 2);
      // Option text
      ctx.fillStyle = '#2a2418';
      ctx.font = '500 30px "Inter","PingFang SC",sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(q.options[i], cx + 76, cy + rowH / 2 + 2);
    }
  }

  // Tiny rounded-rectangle helper (canvas only).
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

  // ── A/B/C/D answer pad ─────────────────────────────────────
  // Four buttons in a row directly in front of the whiteboard. Each
  // one carries a label drawn into a small CanvasTexture and a
  // userData.onClick that calls _answer(idx). They're hidden until
  // a quiz is active and shown again on _startQuiz / _next.
  _buildAnswerPad() {
    const wallZ = -this.roomSize.depth / 2;
    const padW = 0.95, padH = 0.55, padD = 0.10;
    const gap  = 0.18;
    const barZ = wallZ + 4.4;
    const barY = 1.45;
    const labels = ['A', 'B', 'C', 'D'];
    const colors = ['#3aa56a', '#4a86e0', '#d99a3a', '#a45dc0'];
    const total = 4 * padW + 3 * gap;
    let x = -total / 2 + padW / 2;

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1c1a28, roughness: 0.55, metalness: 0.2,
    });

    for (let i = 0; i < 4; i++) {
      const tex = this._makeAnswerButtonTexture(labels[i], colors[i]);
      const faceMat = new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex,
        emissiveIntensity: 0.6, roughness: 0.6, metalness: 0.1,
      });
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(padW, padH, padD),
        [baseMat, baseMat, baseMat, baseMat, faceMat, baseMat],
      );
      pad.position.set(x, barY, barZ);
      pad.visible = false;
      pad.userData.onClick = () => {
        // Press feedback
        const z0 = pad.position.z;
        pad.position.z = z0 - 0.04;
        setTimeout(() => { pad.position.z = z0; }, 120);
        this._answer(i);
      };
      this.group.add(pad);
      this.interactables.push(pad);
      this._answerPad.push(pad);
      x += padW + gap;
    }
  }

  _setAnswerPadVisible(v) {
    for (const m of this._answerPad) m.visible = !!v;
  }

  _makeAnswerButtonTexture(letter, accent) {
    const W = 256, H = 144;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    // Vertical gradient body
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2a2438');
    grad.addColorStop(1, '#15101e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Inner border
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    // Big letter
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 90px "Inter","Helvetica Neue",sans-serif';
    ctx.fillText(letter, W / 2, H / 2);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ── Control bar (EXPLAIN / QUIZ / HINT / NEXT) ─────────────
  // Nearer the seats (higher z) than the answer pad so the player can
  // reach both rows comfortably with a VR controller.
  _buildControlBar() {
    const padW = 0.95, padH = 0.42, padD = 0.10;
    const gap  = 0.12;
    const barZ = -1.6;     // ~1.6m forward of room centre
    const barY = 1.45;
    const buttons = [
      { primary: 'EXPLAIN', secondary: '讲解', action: () => this._explain() },
      { primary: 'QUIZ',    secondary: '出题', action: () => this._startQuiz() },
      { primary: 'HINT',    secondary: '提示', action: () => this._hint() },
      { primary: 'NEXT',    secondary: '下一题', action: () => this._next() },
    ];
    const total = buttons.length * padW + (buttons.length - 1) * gap;
    let x = -total / 2 + padW / 2;

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1c1a28, roughness: 0.55, metalness: 0.2,
    });
    for (const def of buttons) {
      const tex = this._makeRemoteButtonTexture(def.primary, def.secondary);
      const faceMat = new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex,
        emissiveIntensity: 0.6, roughness: 0.6, metalness: 0.1,
      });
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(padW, padH, padD),
        [baseMat, baseMat, baseMat, baseMat, faceMat, baseMat],
      );
      pad.position.set(x, barY, barZ);
      pad.userData.onClick = () => {
        const z0 = pad.position.z;
        pad.position.z = z0 - 0.04;
        setTimeout(() => { pad.position.z = z0; }, 120);
        def.action?.();
      };
      this.group.add(pad);
      this.interactables.push(pad);
      x += padW + gap;
    }
  }

  // ── AR study cards (left wall, 3×2 grid) ───────────────────
  // Six clickable courseware cards. Each card is a thin plane facing
  // +X (player's right when entering) drawn from a CanvasTexture so
  // it shows the topic emoji + EN + ZH + a "Tap to start" footer.
  _buildTopicCards() {
    const wallX = -this.roomSize.width / 2 + 0.05;
    // 3 z-columns, 2 y-rows. Cards are 1.3w × 1.0h.
    const cols = [-3.2, 0, 3.2];
    const rows = [3.1, 1.7];
    const cardW = 1.3, cardH = 1.0;
    let i = 0;
    for (const y of rows) {
      for (const z of cols) {
        if (i >= this._topics.length) return;
        const topic = this._topics[i++];
        const tex = this._makeTopicCardTexture(topic);
        const mat = new THREE.MeshStandardMaterial({
          map: tex, emissive: 0xffffff, emissiveMap: tex,
          emissiveIntensity: 0.25, roughness: 0.45, metalness: 0.05,
          transparent: true,
        });
        // Frame plane (slightly larger, dark backing for depth)
        const frameMat = new THREE.MeshStandardMaterial({
          color: 0x2a2018, roughness: 0.6,
        });
        const frame = new THREE.Mesh(
          new THREE.PlaneGeometry(cardW + 0.08, cardH + 0.08), frameMat);
        frame.position.set(wallX + 0.01, y, z);
        frame.rotation.y = Math.PI / 2;        // face +X (into the room)
        this.group.add(frame);

        const card = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), mat);
        card.position.set(wallX + 0.025, y, z);
        card.rotation.y = Math.PI / 2;
        card.userData.onClick = () => {
          // Tiny pop animation: nudge forward then back.
          const x0 = card.position.x;
          card.position.x = x0 + 0.04;
          setTimeout(() => { card.position.x = x0; }, 140);
          this._startTopic(topic);
        };
        this.group.add(card);
        this.interactables.push(card);
      }
    }
  }

  _makeTopicCardTexture(topic) {
    const W = 384, H = 288;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // Card body — soft cream with a top accent stripe in topic colour.
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#fff5dd');
    grad.addColorStop(1, '#f0e1bf');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = topic.accent || '#FFB870';
    ctx.fillRect(0, 0, W, 12);

    // Frame
    ctx.strokeStyle = 'rgba(122, 90, 48, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);

    // Emoji medallion
    const medX = 70, medY = H * 0.42, medR = 38;
    ctx.fillStyle = topic.accent || '#FFB870';
    ctx.beginPath(); ctx.arc(medX, medY, medR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '50px "Segoe UI Emoji", Arial';
    ctx.fillText(topic.emoji, medX, medY + 4);

    // EN title
    ctx.fillStyle = '#2a2418';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '700 36px "Georgia", "Times New Roman", serif';
    ctx.fillText(topic.en, 130, 56);

    // ZH subtitle
    ctx.fillStyle = '#6e4a26';
    ctx.font = '500 24px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(topic.zh, 130, 102);

    // CTA chip
    const chipY = H - 64;
    ctx.fillStyle = topic.accent || '#FFB870';
    this._roundRect(ctx, 24, chipY, W - 48, 40, 20); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 22px "Inter","PingFang SC",sans-serif';
    ctx.fillText('Tap to start · 点我开课', W / 2, chipY + 20);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ── Furniture (desks + bookshelves + lectern) ─────────────
  _buildStudyFurniture() {
    // Six student desks + chairs in 2 rows × 3 cols, facing the board.
    // Tripo loader convention: rotationY = 0 → model front faces -Z, so
    // desks are placed with Y rotation = 0 to face the back wall.
    for (let row = 0; row < 2; row++) {
      for (let col = -1; col <= 1; col++) {
        mountTripoModel(this.group, 'student_desk_chair', {
          position: [col * 2.6, 0, 1.2 + row * 2.0],
          rotationY: 0,
          targetSize: 1.4,
          yAlign: 'bottom',
        });
      }
    }
    // Teacher's lectern up front, off-centre so it doesn't block the
    // whiteboard sightline from the desks.
    mountTripoModel(this.group, 'lectern_oak', {
      position: [4.0, 0, -4.5], rotationY: -Math.PI / 4,
      targetSize: 1.8, yAlign: 'bottom',
    });
    // Bookshelves on the right wall (left wall is taken by the cards).
    mountTripoModel(this.group, 'bookshelf_classroom', {
      position: [7.4, 0, -3.5], rotationY: -Math.PI / 2,
      targetSize: 2.6, yAlign: 'bottom',
    });
    mountTripoModel(this.group, 'bookshelf_classroom', {
      position: [7.4, 0,  3.5], rotationY: -Math.PI / 2,
      targetSize: 2.6, yAlign: 'bottom',
    });
  }

  // Reuse the same pill-button face texture style the leisure room
  // uses for its remote, so the two zones feel like the same product.
  _makeRemoteButtonTexture(primary, secondary) {
    const W = 256, H = 128;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2a2440');
    grad.addColorStop(1, '#171328');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(150, 145, 220, 0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.fillStyle = '#f1ecff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 38px "Segoe UI","Inter",Arial,sans-serif';
    ctx.fillText(primary, W / 2, H / 2 - 10);
    ctx.fillStyle = 'rgba(195, 188, 230, 0.78)';
    ctx.font = '500 22px "PingFang SC","Microsoft YaHei",Arial,sans-serif';
    ctx.fillText(secondary, W / 2, H / 2 + 28);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }
}

// ============================================================
//  Leisure Room (休闲区)
// ============================================================
class LeisureVRRoom extends VRRoom {
  constructor(scene, options = {}) {
    super(scene, options);

    // ── Companion behaviour state (mirror of ChatVRRoom) ─────
    // The leisure-room companion 灵灵 is a chatty, warm cinephile
    // friend who sits next to the player and reacts to the on-screen
    // movie. Personality: enthusiastic, gentle, a little philosophical;
    // talks bilingually (Chinese first, English alongside) so 童童-
    // style speech bubbles read naturally for both audiences.
    this._studentLocal = new THREE.Vector3();
    this._hasStudent   = false;
    // Sit a bit to the right of the player, level with the eyes when
    // seated. y=1.05 puts the companion at chest height for a 1.6m
    // standing user, perfect for a "sitting beside" feel.
    this._followOffset = new THREE.Vector3(0.95, -0.55, 0.4);

    // Last clip the companion has commented on, so we don't re-greet
    // each frame whenever ht:load fires repeatedly.
    this._lastClipIndex = -1;
    this._lastSaidAt    = 0;
    // Schedule of the next idle / mid-movie reaction.
    this._idleTimer     = null;
    // Timer for the initial "find the player & greet" sequence.
    this._greetTimer    = null;

    // Bound listeners (kept as fields so exit() can remove them).
    this._onHTPlay  = null;
    this._onHTPause = null;
    this._onHTLoad2 = null;

    // ── Per-clip reaction pools (keyed by SCREEN_CLIPS index) ──
    // Lines were authored to match each clip's tone: 天空之城 nostalgic,
    // 心灵捕手 introspective, 绿皮书 reflective on dignity & friendship.
    // Each array is randomised so re-watching never feels canned.
    this._clipLines = [
      { // 0 — 天空之城 / Castle in the Sky
        intro: [
          '《天空之城》！\nLaputa is one of my favourites — pure wonder.',
          '久石让的旋律一响起，整个房间都温柔了。\n这一段听一百次也不腻。',
        ],
        mid: [
          '飞行石发光的样子……\n像把童年的勇气重新点亮了。',
          'The sky here feels alive — clouds, ruins, courage.',
          '你看希达和帕祖，他们什么都没有，\n却拥有彼此 —— 已经是最大的财富。',
        ],
        closing: [
          '“天空之城”不是一个地方，\n是每个人心里那块没被现实折断的部分。',
        ],
      },
      { // 1 — Good Will Hunting / 心灵捕手
        intro: [
          '《心灵捕手》——\nthis one always makes me sit a little closer.',
          'Robin Williams 的眼神，\n比任何一句台词都更治愈。',
        ],
        mid: [
          '"It’s not your fault." 这一句台词\n值得被反反复复听见。',
          'Will 的天赋是真的，\n但他真正缺的是有人愿意慢下来听他说话。',
          '我有时候觉得，被理解\n比被解决更接近治愈。',
        ],
        closing: [
          'It is not your fault. \n你也值得这样温柔的一句。',
        ],
      },
      { // 2 — Green Book / 绿皮书
        intro: [
          '《绿皮书》——\nfriendship in unlikely places, my favourite kind.',
          'Don 博士那种克制的优雅，\n一开口就让整个画面安静下来。',
        ],
        mid: [
          'Tony 把炸鸡递过去的那一刻，\n两个世界第一次真的有了交集。',
          '"Dignity always prevails." \n这句话值得被一直记住。',
          '看他们在路上慢慢学着理解彼此，\n比任何一段独白都动人。',
        ],
        closing: [
          'Some roads change you forever.\n这就是看电影最好的样子。',
        ],
      },
    ];

    // Generic, mood-neutral lines used when no clip is selected, when
    // the player just walks around, or as filler between specific
    // reactions. Mixed with bilingual entries on purpose.
    this._idleLines = {
      greet: [
        '嘿，你来啦！\nI saved you the best seat. 想看哪一部？',
        '欢迎来到家庭影院~\nPick anything from the side menu and I’ll watch with you.',
      ],
      pickPrompt: [
        '想看点什么？我都陪你看。\nClassics, indie, whatever you’re in the mood for.',
        '点一下电影屏幕就能开始啦。\nOr tell me a vibe, I’ll help you pick.',
      ],
      noPlayback: [
        '我们就这样坐着也很好~\nSometimes silence is its own movie.',
      ],
      paused: [
        '暂停一下也好，\nlet the moment breathe. 喝口水？',
        '想聊聊刚才那段吗？\nI’ll wait — take your time.',
      ],
      resume: [
        '好，继续~ \nLet’s see where this goes.',
      ],
      followAlong: [
        '我就坐在你旁边喔。\nRight here with you.',
        '电影最棒的不只是画面，\n是身边有人一起看。',
      ],
    };

    this.build();
  }

  build() {
    // Bespoke cinema shell — burgundy walls + walnut floor + coffered
    // ceiling + emissive cove + center aisle strip. Replaces the cold
    // BaseVRRoom default so the room feels like a private screening room
    // before any prop is even loaded.
    this._buildTheaterShell(18, 16, 6);
    // Spawn 灵灵 floating near the right-side wall art so on-entry the
    // player sees her drift in from the side rather than popping in
    // beside the seats. The follow logic in updateStudentPosition()
    // will pull her toward the player smoothly.
    this._buildAICompanion(-5.5, 1.2, 5.0, 0xC0A0D8);
    this._buildExitDoor(0, 0, 7);

    // ── Cinema lighting rig (warm, layered) ───────────────────
    // 1) HemisphereLight: warm sky / dim mahogany floor — keeps
    //    shadows lifted without flattening them.
    // 2) Faint AmbientLight so very dark seat undersides don't
    //    crush to pure black on lower-end devices.
    // 3) Four warm wall-sconce PointLights paired with the sconce
    //    GLBs along the side walls — these are what give the room
    //    its cozy "movie palace" glow.
    this.group.add(new THREE.HemisphereLight(0xffd2a0, 0x3a1f12, 0.34));
    this.group.add(new THREE.AmbientLight(0xffe6c8, 0.18));

    const sconceLights = [
      [-8.55, 2.55, -3.5], [-8.55, 2.55, 3.5],
      [ 8.55, 2.55, -3.5], [ 8.55, 2.55, 3.5],
    ];
    for (const [x, y, z] of sconceLights) {
      const l = new THREE.PointLight(0xffb066, 0.55, 7.5, 1.6);
      l.position.set(x, y, z);
      this.group.add(l);
    }

    // ── Home theater rig (screen, bezel, speakers, controls) ──
    this._buildHomeTheater();

    // ── Seating (front-row chairs + back-row recliners) ──────
    // Project orientation convention (mirrors ChatVRRoom):
    //   rotationY = 0       → model front faces -Z (toward back wall)
    //   rotationY = Math.PI → model front faces +Z (toward entrance)
    // The screen sits on the back wall at z = -7.85, so chairs and
    // recliners use rotationY = 0 to put cushions and the sitter's
    // gaze straight at the screen.
    const frontZ = 2.0;
    const seatXs = [-3.2, -1.6, 0, 1.6, 3.2];
    for (const sx of seatXs) {
      mountTripoModel(this.group, 'cinema_seat_red', {
        position: [sx, 0, frontZ],
        rotationY: 0,
        targetSize: 0.95,
        yAlign: 'bottom',
      });
    }
    const backZ = 4.6;
    mountTripoModel(this.group, 'recliner_loveseat', {
      position: [-2.0, 0, backZ], rotationY: 0,
      targetSize: 1.7, yAlign: 'bottom',
    });
    mountTripoModel(this.group, 'recliner_loveseat', {
      position: [ 2.0, 0, backZ], rotationY: 0,
      targetSize: 1.7, yAlign: 'bottom',
    });

    // ── Snack zone (front-right, stays clear of the seats) ────
    // Front-right seat is at x=3.2, so the side table at x=6.0
    // leaves a comfortable 1.8m walking aisle around it. The
    // popcorn bucket sits on top of the table (~0.6m up).
    mountTripoModel(this.group, 'side_table_bistro',
      { position: [6.0, 0, 1.0], targetSize: 0.7, yAlign: 'bottom' });
    mountTripoModel(this.group, 'popcorn_bucket',
      { position: [6.0, 0.6, 1.0], targetSize: 0.35, yAlign: 'bottom' });

    // Popcorn cart against the right wall behind the recliners.
    // Right wall interior at x = +9; the cart's depth axis runs
    // along X after rotationY=+π/2, so its back rests near the
    // wall while the glass display faces the room (front = -X).
    mountTripoModel(this.group, 'popcorn_machine',
      { position: [8.0, 0, 5.0], rotationY: Math.PI / 2,
        targetSize: 1.4, yAlign: 'bottom' });

    // ── Wall art ─────────────────────────────────────────────
    // Mounted flush on the side walls (interior x=±9). Posters use
    // rotationY = ∓π/2 so the printed face points into the room
    // (left wall → +X, right wall → -X). Centre is offset from the
    // wall by 8cm so the GLB's small depth never punches through.
    mountTripoModel(this.group, 'movie_poster_classic', {
      position: [-8.92, 2.0, 0], rotationY: -Math.PI / 2,
      targetSize: 1.6, yAlign: 'center',
    });
    mountTripoModel(this.group, 'movie_poster_modern', {
      position: [ 8.92, 2.0, 0], rotationY:  Math.PI / 2,
      targetSize: 1.6, yAlign: 'center',
    });

    // ── Wall sconces (4): a pair flanking each poster ────────
    // Same +X / -X room-facing logic as the posters. Smaller
    // targetSize (0.5) so the mounting plate hugs the wall.
    const sconceSpec = [
      { p: [-8.92, 2.6, -3.0], r: -Math.PI / 2 },
      { p: [-8.92, 2.6,  3.0], r: -Math.PI / 2 },
      { p: [ 8.92, 2.6, -3.0], r:  Math.PI / 2 },
      { p: [ 8.92, 2.6,  3.0], r:  Math.PI / 2 },
    ];
    for (const s of sconceSpec) {
      mountTripoModel(this.group, 'wall_sconce_theater', {
        position: s.p, rotationY: s.r,
        targetSize: 0.5, yAlign: 'center',
      });
    }

    // ── Proscenium curtains — flanking the screen ────────────
    // Hung on the back wall (z = -7.4, just in front of the
    // wall plane at -8) and rotated to face the audience (front
    // = +Z, so rotationY = π). Inset just outside the screen
    // bezel (frame half-width 5.15) so they frame but never
    // cover the picture.
    const wallZ = -7.85;
    mountTripoModel(this.group, 'theater_curtain_red', {
      position: [-5.6, 0, wallZ + 0.45], rotationY: Math.PI,
      fitHeight: 4.5, yAlign: 'bottom',
    });
    mountTripoModel(this.group, 'theater_curtain_red', {
      position: [ 5.6, 0, wallZ + 0.45], rotationY: Math.PI,
      fitHeight: 4.5, yAlign: 'bottom',
    });

    this.onReady();
  }

  // ── Cinema shell ────────────────────────────────────────────
  // Walls: burgundy upper + walnut wainscot + gold chair-rail.
  // Floor: dark walnut with a center carpet runner + emissive aisle.
  // Ceiling: dark plum with a coffered grid + warm cove glow at edges.
  _buildTheaterShell(width, depth, height) {
    this.roomSize = { width, depth, height };

    // ── Floor — dark walnut planks (CanvasTexture) ──────────
    const floorTex = this._makeTheaterFloorTexture();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(3, 3);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({
        map: floorTex, roughness: 0.85, metalness: 0.04,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Plush red carpet runner down the center aisle.
    const carpetMat = new THREE.MeshStandardMaterial({
      color: 0x4d141b, roughness: 0.95, metalness: 0,
    });
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, depth - 1.0), carpetMat,
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.005;
    this.group.add(carpet);

    // Two warm aisle-light strips on either side of the carpet.
    const aisleMat = new THREE.MeshBasicMaterial({
      color: 0xffb066, transparent: true, opacity: 0.85,
    });
    for (const sx of [-1.55, 1.55]) {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.06, depth - 1.4), aisleMat,
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(sx, 0.012, 0);
      this.group.add(strip);
    }

    // ── Walls — wainscot + burgundy upper (CanvasTexture) ───
    const wallTex = this._makeTheaterWallTexture();
    const _wrap = (hRepeat) => {
      const t = wallTex.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(hRepeat, 1);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      return t;
    };
    const mkWall = (planeWidth) => new THREE.Mesh(
      new THREE.PlaneGeometry(planeWidth, height),
      new THREE.MeshStandardMaterial({
        map: _wrap(planeWidth / 4),
        roughness: 0.9, metalness: 0.06,
        side: THREE.DoubleSide,
      }),
    );

    const back = mkWall(width);
    back.position.set(0, height / 2, -depth / 2);
    this.group.add(back);

    const front = mkWall(width);
    front.rotation.y = Math.PI;
    front.position.set(0, height / 2, depth / 2);
    this.group.add(front);

    const left = mkWall(depth);
    left.rotation.y = Math.PI / 2;
    left.position.set(-width / 2, height / 2, 0);
    this.group.add(left);

    const right = mkWall(depth);
    right.rotation.y = -Math.PI / 2;
    right.position.set(width / 2, height / 2, 0);
    this.group.add(right);

    // ── Ceiling — coffered tile pattern (CanvasTexture) ─────
    const ceilTex = this._makeTheaterCeilingTexture();
    ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
    ceilTex.repeat.set(3, 3);
    ceilTex.colorSpace = THREE.SRGBColorSpace;
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({
        map: ceilTex, roughness: 0.92, metalness: 0.06,
      }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height;
    this.group.add(ceiling);

    // Cove glow strip — emissive frame inset just below the ceiling
    // to fake the warm hidden-LED uplight you find in real cinemas.
    const coveMat = new THREE.MeshBasicMaterial({
      color: 0xffb066, transparent: true, opacity: 0.55,
    });
    const coveSpec = [
      [width - 0.6, 0.06, 0,                height - 0.10,  0,            -depth / 2 + 0.06],
      [width - 0.6, 0.06, 0,                height - 0.10,  0,             depth / 2 - 0.06],
      [0.06, 0.06,        depth - 0.6,      height - 0.10, -width / 2 + 0.06, 0],
      [0.06, 0.06,        depth - 0.6,      height - 0.10,  width / 2 - 0.06, 0],
    ];
    for (const [w, h, d, py, px, pz] of coveSpec) {
      const cove = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), coveMat);
      cove.position.set(px, py, pz);
      this.group.add(cove);
    }
  }

  // ── Wall CanvasTexture: burgundy upper / walnut wainscot ──
  _makeTheaterWallTexture() {
    const W = 1024, H = 1280;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // Top crown moulding strip (warm walnut hint).
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(0, 0, W, H * 0.025);

    // Upper burgundy field with subtle vertical drape gradient.
    const upper = ctx.createLinearGradient(0, H * 0.025, 0, H * 0.62);
    upper.addColorStop(0, '#5a1f25');
    upper.addColorStop(1, '#3a1218');
    ctx.fillStyle = upper;
    ctx.fillRect(0, H * 0.025, W, H * 0.595);

    // Faint vertical fabric texture so the burgundy isn't dead.
    ctx.strokeStyle = 'rgba(255, 200, 150, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, H * 0.025);
      ctx.lineTo(x, H * 0.62);
      ctx.stroke();
    }

    // Damask diamond accents — luxe but quiet.
    ctx.strokeStyle = 'rgba(255, 200, 140, 0.08)';
    ctx.lineWidth = 1.5;
    const dW = 168, dH = 84;
    for (let y = H * 0.05; y < H * 0.58; y += dH) {
      for (let x = -dW / 2; x < W + dW; x += dW) {
        const off = ((y / dH) | 0) % 2 === 0 ? 0 : dW / 2;
        ctx.beginPath();
        ctx.moveTo(x + off,            y + dH / 2);
        ctx.lineTo(x + off + dW / 2,   y);
        ctx.lineTo(x + off + dW,       y + dH / 2);
        ctx.lineTo(x + off + dW / 2,   y + dH);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // ── Chair rail: gold beadwork + dark shadow band ────────
    ctx.fillStyle = '#1c0a08';
    ctx.fillRect(0, H * 0.62, W, H * 0.012);
    ctx.fillStyle = '#c0974a';
    ctx.fillRect(0, H * 0.632, W, H * 0.014);
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(0, H * 0.646, W, H * 0.014);

    // ── Wainscot — walnut panels with vertical seams ─────────
    const wainscot = ctx.createLinearGradient(0, H * 0.66, 0, H * 0.97);
    wainscot.addColorStop(0, '#3a2719');
    wainscot.addColorStop(1, '#1f1108');
    ctx.fillStyle = wainscot;
    ctx.fillRect(0, H * 0.66, W, H * 0.31);

    // Inset rectangular panel mouldings — 4 panels per tile.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 2;
    const panelMargin = 24;
    for (let i = 0; i < 4; i++) {
      const px = i * (W / 4) + panelMargin;
      const pw = W / 4 - panelMargin * 2;
      ctx.strokeRect(px, H * 0.685, pw, H * 0.27);
    }
    // Highlight stroke inside each panel for relief.
    ctx.strokeStyle = 'rgba(255, 200, 150, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const px = i * (W / 4) + panelMargin + 4;
      const pw = W / 4 - panelMargin * 2 - 8;
      ctx.strokeRect(px, H * 0.685 + 4, pw, H * 0.27 - 8);
    }

    // Walnut grain whispers.
    ctx.strokeStyle = 'rgba(255, 200, 130, 0.045)';
    ctx.lineWidth = 1;
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
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(0, H * 0.97, W, H * 0.03);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ── Floor CanvasTexture: dark walnut planks ─────────────
  _makeTheaterFloorTexture() {
    const W = 512, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#2c1d12');
    grad.addColorStop(1, '#180c06');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < W; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 256) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(180, 130, 80, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30 + Math.random() * 50, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ── Ceiling CanvasTexture: coffered tiles ───────────────
  _makeTheaterCeilingTexture() {
    const W = 512, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // Deep plum base.
    ctx.fillStyle = '#1a0e1c';
    ctx.fillRect(0, 0, W, H);

    // Coffered grid — each tile has a slightly lighter inset and a
    // central rosette dot, then dark seam lines around it.
    const rows = 4, cols = 4;
    const cw = W / cols, ch = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw, y = r * ch;
        // Inset panel
        const inset = ctx.createRadialGradient(
          x + cw / 2, y + ch / 2, 4,
          x + cw / 2, y + ch / 2, cw * 0.55,
        );
        inset.addColorStop(0, '#37223e');
        inset.addColorStop(1, '#1a0e1c');
        ctx.fillStyle = inset;
        ctx.fillRect(x + 6, y + 6, cw - 12, ch - 12);

        // Central rosette
        ctx.fillStyle = 'rgba(255, 195, 130, 0.18)';
        ctx.beginPath();
        ctx.arc(x + cw / 2, y + ch / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Dark seams.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cw, 0);
      ctx.lineTo(i * cw, H);
      ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * ch);
      ctx.lineTo(W, i * ch);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ── Build the wall-mounted screen, frame, bias-light and speakers.
  _buildHomeTheater() {
    // Geometry constants — keeps the wall composition consistent.
    const wallZ = -7.85;          // outer face of back wall
    const screenW = 9.6, screenH = 5.4;     // 16:9-ish (16:9 = 9.6:5.4)
    const frameW  = screenW + 0.7, frameH = screenH + 0.7;
    const screenY = 3.1;

    // Bias light — a soft glow PLANE behind the bezel painted on
    // the back wall. Switched from cold blue to warm amber so it
    // harmonises with the new burgundy walls and sconces rather
    // than fighting them.
    const biasMat = new THREE.MeshBasicMaterial({
      color: 0xffa566, transparent: true, opacity: 0.35,
    });
    const bias = new THREE.Mesh(
      new THREE.PlaneGeometry(frameW + 1.6, frameH + 1.6),
      biasMat,
    );
    bias.position.set(0, screenY, wallZ + 0.005);
    this.group.add(bias);

    // Bezel — thin matte-black frame around the screen.
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0d0d11, roughness: 0.55, metalness: 0.15,
    });
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(frameW, frameH, 0.18), frameMat,
    );
    frame.position.set(0, screenY, wallZ + 0.06);
    this.group.add(frame);

    // The screen itself — starts with an idle CanvasTexture slate.
    // Once the user picks a clip (or clicks the screen), we swap the
    // material's map/emissiveMap to a THREE.VideoTexture sampled from
    // HomeTheater's shared <video crossorigin="anonymous"> element.
    // Because VideoTexture works regardless of whether the <video>
    // node is on-screen, this is the path that lets video play on the
    // 3D cinema screen *in immersive VR* (where DOM iframes are gone).
    const idleTex = this._makeHomeTheaterIdleTexture();
    const screenMat = new THREE.MeshStandardMaterial({
      map: idleTex,
      emissive: 0xffffff,
      emissiveMap: idleTex,
      emissiveIntensity: 0.85,
      roughness: 0.95, metalness: 0,
    });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(screenW, screenH), screenMat,
    );
    screen.position.set(0, screenY, wallZ + 0.16);
    screen.userData.onClick = () => {
      // First click: load + play the first clip (also fires ht:load
      // so the texture swap below kicks in). Subsequent clicks toggle
      // play/pause directly. Works in desktop AND VR — no overlay
      // needed for basic playback.
      const HT = window.HomeTheater;
      if (!HT) return;
      if (!HT.isReady?.()) HT.playIndex(0);
      else                 HT.togglePlay();
      if (this.companion) this.companion.setExpression('happy');
    };
    this.group.add(screen);
    this.interactables.push(screen);
    this._theaterScreen = screen;
    this._theaterIdleTex = idleTex;

    // Build (lazily) and bind the VideoTexture once HomeTheater loads
    // its first source. We only need ONE VideoTexture for the lifetime
    // of the room — re-binding `video.src` keeps reusing the same
    // texture since the underlying HTMLVideoElement is shared.
    this._onHTLoad = () => {
      const HT = window.HomeTheater;
      if (!HT?.video) return;
      if (!this._videoTexture) {
        const tex = new THREE.VideoTexture(HT.video);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter  = THREE.LinearFilter;
        tex.magFilter  = THREE.LinearFilter;
        this._videoTexture = tex;
      }
      screenMat.map          = this._videoTexture;
      screenMat.emissiveMap  = this._videoTexture;
      screenMat.emissiveIntensity = 1.15;
      screenMat.needsUpdate  = true;
    };
    window.addEventListener('ht:load', this._onHTLoad);
    // If the player previously loaded a clip in another visit, the
    // shared <video> element already has a valid src — bind right
    // now so the screen doesn't sit on the idle slate while waiting
    // for the next ht:load event.
    if (window.HomeTheater?.isReady?.()) this._onHTLoad();

    // Glow accent in front of the screen — kept faintly cool so it
    // still reads as "powered on" video light, but lowered to 0.35
    // so it never overrides the warm sconce ambience.
    const screenLight = new THREE.PointLight(0x9aa6ff, 0.35, 12, 1.6);
    screenLight.position.set(0, screenY, wallZ + 3.5);
    this.group.add(screenLight);

    // ── Speakers ──────────────────────────────────────────────
    const speakerMat = new THREE.MeshStandardMaterial({
      color: 0x111114, roughness: 0.7, metalness: 0.18,
    });
    const grilleMat = new THREE.MeshStandardMaterial({
      color: 0x1d1d23, roughness: 0.95, metalness: 0,
    });
    const buildTower = (x) => {
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 2.4, 0.45), speakerMat,
      );
      tower.position.set(x, 1.2, wallZ + 0.4);
      this.group.add(tower);

      // Three driver "cones" — concentric matte rings.
      const cones = [
        { y: 1.95, r: 0.10 },
        { y: 1.55, r: 0.15 },
        { y: 0.95, r: 0.20 },
      ];
      for (const c of cones) {
        const cone = new THREE.Mesh(
          new THREE.CircleGeometry(c.r, 24), grilleMat,
        );
        cone.position.set(x, c.y, wallZ + 0.63);
        this.group.add(cone);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(c.r * 0.55, c.r * 0.7, 24),
          new THREE.MeshStandardMaterial({
            color: 0x2a2a33, roughness: 0.9, metalness: 0,
          }),
        );
        ring.position.set(x, c.y, wallZ + 0.64);
        this.group.add(ring);
      }
    };
    // Pushed out far enough (1.7m beyond the bezel edge) that they
    // sit clear of the proscenium curtains at x = ±5.6, leaving a
    // visible ~0.4m gap on each side of the screen.
    buildTower(-(frameW / 2 + 1.7));
    buildTower( (frameW / 2 + 1.7));

    // Subwoofer — squat box centred under the screen.
    const sub = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.8, 0.6), speakerMat,
    );
    sub.position.set(0, 0.4, wallZ + 0.5);
    this.group.add(sub);
    const subCone = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 28), grilleMat,
    );
    subCone.position.set(0, 0.4, wallZ + 0.81);
    this.group.add(subCone);

    // ── Floating control bar (3D, clickable in both modes) ────
    // Sits between the screen and the seats so VR users can switch
    // clips / pause without needing DOM overlays. Built as a row of
    // four CanvasTexture-labelled pill meshes facing the audience.
    this._buildHomeTheaterControls(wallZ);

    // Stash refs for the bias-light breathing animation.
    this._theaterBias = biasMat;
  }

  // Four-button remote bar floating between front-row seats and the
  // screen. Positions: y ≈ chest height for a standing user, z just
  // forward of the screen so it's reachable via VR controller raycast.
  _buildHomeTheaterControls(wallZ) {
    const buttons = [
      { label: 'PREV',  sub: '上一段', action: () => window.HomeTheater?.prev() },
      { label: 'PLAY',  sub: '播放/暂停', action: () => window.HomeTheater?.togglePlay() },
      { label: 'NEXT',  sub: '下一段', action: () => window.HomeTheater?.next() },
      { label: 'BROWSE', sub: '面板',  action: () => window.HomeTheater?.open() },
    ];

    const padW = 0.95, padH = 0.42, padD = 0.10;
    const gap  = 0.12;
    const barZ = wallZ + 4.2;        // 4.2m in front of the back wall
    const barY = 1.45;
    const totalW = buttons.length * padW + (buttons.length - 1) * gap;
    let x = -totalW / 2 + padW / 2;

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1c1a28, roughness: 0.55, metalness: 0.2,
    });

    for (const def of buttons) {
      // Front-face label texture
      const tex = this._makeRemoteButtonTexture(def.label, def.sub);
      const faceMat = new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex,
        emissiveIntensity: 0.6, roughness: 0.6, metalness: 0.1,
      });

      // Box: front face uses the label material, the rest matte black.
      // BoxGeometry's material order is [+x, -x, +y, -y, +z, -z].
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(padW, padH, padD),
        [baseMat, baseMat, baseMat, baseMat, faceMat, baseMat],
      );
      pad.position.set(x, barY, barZ);
      pad.userData.onClick = () => {
        def.action?.();
        // Tiny press animation: nudge the pad backward briefly.
        pad.position.z = barZ - 0.04;
        setTimeout(() => { pad.position.z = barZ; }, 120);
      };
      this.group.add(pad);
      this.interactables.push(pad);

      x += padW + gap;
    }
  }

  // Build a soft-glow pill button face with primary + sub-label.
  _makeRemoteButtonTexture(primary, secondary) {
    const W = 256, H = 128;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // Backdrop with subtle vertical gradient.
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2a2440');
    grad.addColorStop(1, '#171328');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Inner border for tactile look.
    ctx.strokeStyle = 'rgba(150, 145, 220, 0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);

    ctx.fillStyle = '#f1ecff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 38px "Segoe UI",Arial,sans-serif';
    ctx.fillText(primary, W / 2, H / 2 - 10);

    ctx.fillStyle = 'rgba(195, 188, 230, 0.78)';
    ctx.font = '500 22px "Segoe UI","PingFang SC",Arial,sans-serif';
    ctx.fillText(secondary, W / 2, H / 2 + 28);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // Idle slate drawn into a CanvasTexture so the screen looks like a
  // proper "Apple TV / smart-TV" launcher even before the iframe
  // overlay opens.
  _makeHomeTheaterIdleTexture() {
    const W = 1024, H = 576;        // 16:9
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // Gradient backdrop — deep navy → indigo so the screen feels alive.
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0e0a22');
    g.addColorStop(1, '#241546');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Soft purple aurora glow centre.
    const r = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W * 0.55);
    r.addColorStop(0, 'rgba(140,120,255,0.50)');
    r.addColorStop(1, 'rgba(140,120,255,0.0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, W, H);

    // Headline.
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '700 96px "Segoe UI","PingFang SC",Arial,sans-serif';
    ctx.fillText('HOME THEATER', W / 2, H / 2 - 30);
    ctx.font = '500 56px "Segoe UI","PingFang SC",Arial,sans-serif';
    ctx.fillStyle = 'rgba(220, 215, 255, 0.85)';
    ctx.fillText('家庭影院', W / 2, H / 2 + 38);

    // Logo pill row: Bilibili + YouTube placeholders.
    const pillY = H * 0.78, pillH = 70, pillR = pillH / 2;
    const drawPill = (x, label, fillStart, fillEnd) => {
      const wPill = 280;
      const grad = ctx.createLinearGradient(x - wPill / 2, 0, x + wPill / 2, 0);
      grad.addColorStop(0, fillStart); grad.addColorStop(1, fillEnd);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - wPill / 2 + pillR, pillY);
      ctx.arc(x - wPill / 2 + pillR, pillY + pillH / 2, pillR, -Math.PI / 2, Math.PI / 2, true);
      ctx.lineTo(x + wPill / 2 - pillR, pillY + pillH);
      ctx.arc(x + wPill / 2 - pillR, pillY + pillH / 2, pillR,  Math.PI / 2, -Math.PI / 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 30px "Segoe UI",Arial,sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, pillY + pillH / 2 + 2);
      ctx.textBaseline = 'alphabetic';
    };
    drawPill(W / 2 - 170, 'Bilibili', '#FF7BB5', '#FB9C3C');
    drawPill(W / 2 + 170, 'YouTube', '#FF4040', '#C50000');

    // Footer hint.
    ctx.fillStyle = 'rgba(220, 215, 255, 0.6)';
    ctx.font = '400 26px "Segoe UI","PingFang SC",Arial,sans-serif';
    ctx.fillText('Click the screen or PLAY to start · 点击屏幕或 PLAY 开始播放', W / 2, H - 32);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  update(delta) {
    super.update(delta);
    // Gentle bias-light breathing so the wall halo feels alive.
    if (this._theaterBias) {
      const t = performance.now() * 0.001;
      this._theaterBias.opacity = 0.30 + Math.sin(t * 0.8) * 0.07;
    }
  }

  // ── Lifecycle ────────────────────────────────────────────
  enter() {
    super.enter();

    // Greet the player after a beat so the companion has time to
    // float over to the seats. The first idle chatter is scheduled
    // from inside _say('greet') to avoid double-speaking on entry.
    if (this._greetTimer) clearTimeout(this._greetTimer);
    this._greetTimer = setTimeout(() => {
      if (!this.isActive) return;
      this._say('greet');
      // Kick off the recurring idle chatter loop.
      this._scheduleIdleChatter(8000 + Math.random() * 6000);
    }, 1800);

    // Subscribe to the home-theater player events so 灵灵 reacts in
    // real time when the player picks a clip / hits play / pause.
    this._onHTPlay  = () => this._onPlaybackStart();
    this._onHTPause = () => this._onPlaybackPause();
    this._onHTLoad2 = (e) => this._onClipLoaded(e);
    window.addEventListener('ht:play',  this._onHTPlay);
    window.addEventListener('ht:pause', this._onHTPause);
    window.addEventListener('ht:load',  this._onHTLoad2);

    // If the player previously left mid-movie and walked back in,
    // greet them with a "welcome back" specific to the current clip
    // instead of the generic intro.
    const HT = window.HomeTheater;
    if (HT?.isReady?.()) {
      this._lastClipIndex = HT.currentIndex;
      setTimeout(() => {
        if (!this.isActive) return;
        this._say('mid', HT.currentIndex);
      }, 4500);
    }
  }

  // Pause playback + close the overlay when the player walks back
  // to the hub, so audio doesn't follow them around the building.
  exit() {
    super.exit();
    const HT = window.HomeTheater;
    if (HT) {
      HT.close?.();
      HT.video?.pause?.();
    }
    // VideoTexture rebind listener
    if (this._onHTLoad) {
      window.removeEventListener('ht:load', this._onHTLoad);
      this._onHTLoad = null;
    }
    // Companion behaviour listeners
    if (this._onHTPlay)  window.removeEventListener('ht:play',  this._onHTPlay);
    if (this._onHTPause) window.removeEventListener('ht:pause', this._onHTPause);
    if (this._onHTLoad2) window.removeEventListener('ht:load',  this._onHTLoad2);
    this._onHTPlay = this._onHTPause = this._onHTLoad2 = null;

    // Stop chatter timers + reset companion state
    if (this._idleTimer)  { clearTimeout(this._idleTimer);  this._idleTimer  = null; }
    if (this._greetTimer) { clearTimeout(this._greetTimer); this._greetTimer = null; }
    this.companion?.hideBubble();
    this.companion?.setMode('idle');
    this.companion?.setExpression('idle');
    this.companion?.setFollowTarget(null);
  }

  // ── Per-frame: pull 灵灵 to a comfortable seat-mate offset ──
  // Same shape as ChatVRRoom.updateStudentPosition: convert player
  // world pos → room-local, look at them, and set a follow target a
  // small, clamped distance to the side. The y component drops below
  // standing eye level so 灵灵 reads as "sitting" beside the player.
  updateStudentPosition(worldPos) {
    if (!this.companion) return;
    const local = this._studentLocal.copy(worldPos).sub(this.roomPosition);
    this._hasStudent = true;

    this.companion.lookAtStudent(local.clone());

    const tgt = local.clone().add(this._followOffset);
    const half  = (this.roomSize?.width || 18) / 2 - 1.0;
    const halfD = (this.roomSize?.depth || 16) / 2 - 1.0;
    tgt.x = Math.max(-half,  Math.min(half,  tgt.x));
    tgt.z = Math.max(-halfD, Math.min(halfD, tgt.z));
    // Clamp Y so 灵灵 never sinks into the floor when the player
    // crouches and never floats into the chandelier when they stand.
    tgt.y = Math.max(0.6, Math.min(1.6, tgt.y));
    this.companion.setFollowTarget(tgt);
  }

  // ── Companion speech helpers ────────────────────────────
  /**
   * Speak a randomly-picked line from the matching pool. Categories:
   *   'greet'         — first hello on enter
   *   'pickPrompt'    — nudge user to choose a movie
   *   'noPlayback'    — chatter when nothing is playing
   *   'paused' / 'resume'
   *   'followAlong'   — "I'm right here" filler during long clips
   *   'intro' / 'mid' / 'closing' — clip-specific (need clipIndex)
   */
  _say(category, clipIndex) {
    if (!this.companion?.say) return;
    let pool;
    if (category === 'intro' || category === 'mid' || category === 'closing') {
      const idx = (typeof clipIndex === 'number')
        ? clipIndex : window.HomeTheater?.currentIndex;
      const clip = this._clipLines?.[idx];
      pool = clip?.[category];
    } else {
      pool = this._idleLines?.[category];
    }
    if (!pool || pool.length === 0) return;
    const text = pool[(Math.random() * pool.length) | 0];
    this.companion.say(text);
    this._lastSaidAt = performance.now();
  }

  // Recursive setTimeout loop — schedules itself again every time it
  // fires so we get a natural irregular cadence without setInterval
  // running while the room is hidden.
  _scheduleIdleChatter(initialDelayMs) {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    const delay = initialDelayMs ?? (14000 + Math.random() * 9000);
    this._idleTimer = setTimeout(() => {
      this._idleTimer = null;
      if (!this.isActive) return;
      this._fireIdleChatter();
      // Schedule the next one — slower while a clip is playing so we
      // don't spam the reading user with bubbles.
      const HT = window.HomeTheater;
      const playing = HT?.video && !HT.video.paused && !HT.video.ended;
      const nextDelay = playing
        ? 18000 + Math.random() * 12000
        : 11000 + Math.random() * 8000;
      this._scheduleIdleChatter(nextDelay);
    }, Math.max(1500, delay));
  }

  _fireIdleChatter() {
    const HT = window.HomeTheater;
    const ready   = HT?.isReady?.();
    const playing = ready && HT.video && !HT.video.paused && !HT.video.ended;

    if (playing && typeof HT.currentIndex === 'number') {
      // 50/50 between a clip-specific mid line and a generic
      // "I'm here with you" follow-along filler.
      if (Math.random() < 0.6) this._say('mid', HT.currentIndex);
      else                     this._say('followAlong');
    } else if (ready && HT.video?.paused) {
      this._say('paused');
    } else {
      // Nothing has been picked yet — gently encourage the player to
      // pick a clip from the side menu (or click the screen).
      if (Math.random() < 0.65) this._say('pickPrompt');
      else                      this._say('noPlayback');
    }
  }

  // ── Home Theater event handlers ─────────────────────────
  _onClipLoaded(e) {
    const HT = window.HomeTheater;
    const idx = HT?.currentIndex ?? -1;
    if (idx === this._lastClipIndex) return;     // same clip → skip
    this._lastClipIndex = idx;
    this.companion?.setExpression('happy');
    // Small delay so the speech bubble doesn't appear before the
    // playback actually starts.
    setTimeout(() => this._say('intro', idx), 600);
  }

  _onPlaybackStart() {
    // If we're resuming after a recent pause, say something resume-y;
    // otherwise let the intro handler (fired by ht:load) take over.
    const since = performance.now() - this._lastSaidAt;
    if (since < 1500) return;       // intro just ran, don't double up
    if (this._lastClipIndex < 0) return;  // first ever play handled by load
    this.companion?.setExpression('happy');
    this._say('resume');
  }

  _onPlaybackPause() {
    // Only react if there was a real pause (not the brief pause that
    // happens between loadSrc + autoplay during ht:load).
    const HT = window.HomeTheater;
    if (!HT?.video || HT.video.ended) return;
    setTimeout(() => {
      // Confirm it's still paused (debounce the load→autoplay pause).
      if (HT.video?.paused && !HT.video.ended && this.isActive) {
        this.companion?.setExpression('thinking');
        this._say('paused');
      }
    }, 700);
  }

  getSpawnPoint() {
    return this.roomPosition.clone().add(new THREE.Vector3(0, 0, 5));
  }
}

// ============================================================
//  Healing Room (疗愈区)
// ============================================================
/**
 * HealingVRRoom — guided breathing + mood journal + ambient particles.
 *
 * Architectural mirror of LeisureVRRoom / StudyVRRoom (custom shell, AI
 * companion, interactables registered via `userData.onClick`, per-frame
 * `update(delta)` hook). What's unique here:
 *
 *   • Breathing orb       — translucent sphere + emissive halo + a floor
 *                           guidance ring whose radius and brightness
 *                           track a 4-phase breathing pattern (inhale →
 *                           hold → exhale → hold). The on-screen phase
 *                           label reads "吸气 / Inhale" etc., and the
 *                           companion 莲莲 quietly cues the player at
 *                           each transition.
 *   • Pattern presets     — START / PAUSE / NATURAL (4-4-6-2) / BOX
 *                           (4-4-4-4) / 4-7-8 (Dr. Weil).
 *   • Mood stones         — five clickable floor stones (calm, happy,
 *                           tired, anxious, sad). Tapping logs the mood
 *                           into a session journal that's mirrored on a
 *                           wall plaque (tally bars + colour-dot
 *                           timeline). Session-only — no persistence,
 *                           per the project's "no localStorage" rule.
 *   • Particle ambience   — two THREE.Points layers: drifting cherry-
 *                           blossom petals (slow downward sway) and a
 *                           swirling firefly bokeh layer that gently
 *                           pulses with the breathing rhythm when a
 *                           session is active.
 *   • Companion 莲莲       — soft mint-sage orb, doesn't follow the
 *                           player around (a meditation guide should
 *                           hold the centre). She turns to watch the
 *                           player and speaks softly at phase changes.
 */
class HealingVRRoom extends VRRoom {
  constructor(scene, options = {}) {
    super(scene, options);

    // ── Breathing-session state machine ────────────────────────
    // Patterns are [inhale, holdIn, exhale, holdOut] in seconds.
    this._patterns = {
      natural: { id: 'natural', en: 'Natural', zh: '自然 4-4-6-2', durations: [4, 4, 6, 2] },
      box:     { id: 'box',     en: 'Box',     zh: '盒式 4-4-4-4', durations: [4, 4, 4, 4] },
      '478':   { id: '478',     en: '4-7-8',   zh: '4-7-8 法',     durations: [4, 7, 8, 1] },
    };
    this._sessionRunning = false;
    this._currentPattern = this._patterns.natural;
    this._phaseIdx       = 0;     // 0=inhale, 1=holdIn, 2=exhale, 3=holdOut
    this._phaseElapsed   = 0;     // seconds in the current phase
    this._cycleCount     = 0;     // completed full cycles so far

    // ── Mood log (session-only) ────────────────────────────────
    this._moodLog = {
      calm:    { count: 0, en: 'Calm',    zh: '平静', emoji: '🌿', color: '#7DC9A8' },
      happy:   { count: 0, en: 'Happy',   zh: '开心', emoji: '☀️', color: '#F4C36C' },
      tired:   { count: 0, en: 'Tired',   zh: '疲惫', emoji: '🌙', color: '#9FB0D8' },
      anxious: { count: 0, en: 'Anxious', zh: '焦虑', emoji: '🌧️', color: '#C9A8E0' },
      sad:     { count: 0, en: 'Sad',     zh: '低落', emoji: '💧', color: '#7AB8D8' },
    };
    this._moodTimeline = [];     // array of mood ids, oldest → newest
    this._moodMirrorDirty = true;

    // ── Companion follow / chatter timers ──────────────────────
    // 莲莲 stays put (meditation guide), so unlike Study / Leisure she
    // doesn't get a side-of-player follow target — only `lookAtStudent`
    // turns her head. Idle chatter is sparser and only when no session.
    this._studentLocal = new THREE.Vector3();
    this._idleTimer    = null;
    this._greetTimer   = null;
    this._lastSaidAt   = 0;

    // ── Visual refs filled in by build() ───────────────────────
    this._orbCore      = null;   // glowing core sphere
    this._orbHalo      = null;   // outer translucent shell
    this._orbHaloMat   = null;
    this._orbCoreMat   = null;
    this._floorRing    = null;   // expanding/contracting floor guide
    this._floorRingMat = null;
    this._phaseLabel   = null;   // floating canvas plane near orb
    this._phaseCanvas  = null;
    this._phaseCtx     = null;
    this._phaseTex     = null;
    this._mirrorCanvas = null;
    this._mirrorCtx    = null;
    this._mirrorTex    = null;
    this._petalPoints  = null;   // THREE.Points — drifting petals
    this._fireflyPoints = null;  // THREE.Points — bokeh fireflies
    this._patternBtns  = [];     // pattern preset buttons (for highlight)

    this._initLines();
    this.build();
  }

  // ── Room construction ──────────────────────────────────────
  build() {
    this._buildSerenityShell(20, 20, 5);

    // 莲莲 — soft mint-sage. Spawns on the player's right at standing
    // eye height so the moment the headset pops in, she's clearly in
    // peripheral vision, not 8m away in the centre of the room.
    this._buildAICompanion(1.4, 1.4, 2.5, 0xB8E0CE);
    this.companion?.setMode?.('idle');

    // Exit portal at the front of the room.
    this._buildExitDoor(0, 0, 9);

    // Lighting: warm hemisphere fill + four soft pendant lights.
    this.group.add(new THREE.HemisphereLight(0xfff2dc, 0x2a3a30, 0.55));
    this.group.add(new THREE.AmbientLight(0xffe8d0, 0.20));
    for (const [x, z] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) {
      const l = new THREE.PointLight(0xffe6c8, 0.5, 9, 1.6);
      l.position.set(x, 4.4, z);
      this.group.add(l);
    }

    // Breathing centerpiece + UI plaques + interactables.
    this._buildBreathingOrb();
    this._buildPhaseLabel();
    this._buildSessionControls();      // START / PAUSE / NATURAL / BOX / 4-7-8
    this._buildMoodStones();
    this._buildMoodMirror();           // wall plaque rendered from journal
    this._buildParticleField();        // drifting petals + bokeh fireflies

    // Garden props (carried over from the previous static layout, but
    // pulled to the perimeter so the breathing orb owns the centre).
    mountTripoModel(this.group, 'zen_rock_garden',
      { position: [-7.0, 0, -7.0], rotationY: Math.PI * 0.15,
        targetSize: 3.0, yAlign: 'bottom' });
    mountTripoModel(this.group, 'tsukubai',
      { position: [ 7.0, 0, -6.5], rotationY: -Math.PI * 0.25,
        targetSize: 1.4, yAlign: 'bottom' });
    mountTripoModel(this.group, 'bonsai_tree',
      { position: [ 0.0, 0, -8.5], targetSize: 1.2, yAlign: 'bottom' });
    for (let i = 0; i < 3; i++) {
      mountTripoModel(this.group, 'bamboo_pot', {
        position: [-9.2, 0, -3 + i * 3],
        rotationY: Math.random() * Math.PI * 2,
        targetSize: 1.6, yAlign: 'bottom',
      });
      mountTripoModel(this.group, 'bamboo_pot', {
        position: [ 9.2, 0, -3 + i * 3],
        rotationY: Math.random() * Math.PI * 2,
        targetSize: 1.6, yAlign: 'bottom',
      });
    }
    // Cushions in a small arc facing the orb so the player has a
    // visual cue for "this is where you sit and breathe".
    for (let i = -1; i <= 1; i++) {
      mountTripoModel(this.group, 'cushion_zafu', {
        position: [i * 1.6, 0, 1.5],
        rotationY: Math.PI,        // facing -Z (toward the orb)
        targetSize: 0.6, yAlign: 'bottom',
      });
    }

    this._setPattern('natural', /*announce=*/false);
    this._renderPhaseLabel();
    this._renderMoodMirror();

    this.onReady();
  }

  getSpawnPoint() {
    // Drop the player just behind the cushions, ~3.5m from the orb,
    // facing -Z. In VR an 8m gap to the orb made it look like a
    // distant marble; this brings it into intimate scale (~3.5m
    // means the 1.0m halo subtends a comfortable ~16° of view).
    return this.roomPosition.clone().add(new THREE.Vector3(0, 0, 3.5));
  }

  getLookAtPoint() {
    // Desktop camera framing: aim it directly at the breathing orb so
    // the centerpiece is what the player sees on entry.
    return this.roomPosition.clone().add(new THREE.Vector3(0, 1.6, -2.0));
  }

  // ── Lifecycle ──────────────────────────────────────────────
  enter() {
    super.enter();
    if (this._greetTimer) clearTimeout(this._greetTimer);
    this._greetTimer = setTimeout(() => {
      this._greetTimer = null;
      if (!this.isActive) return;
      this._say('greet');
      this._scheduleIdleChatter(14000 + Math.random() * 8000);
    }, 1800);
  }

  exit() {
    super.exit();
    if (this._idleTimer)  { clearTimeout(this._idleTimer);  this._idleTimer  = null; }
    if (this._greetTimer) { clearTimeout(this._greetTimer); this._greetTimer = null; }
    this._sessionRunning = false;
    this.companion?.hideBubble?.();
    this.companion?.setExpression?.('idle');
  }

  // Per-frame: drive the breathing orb, particles, mirror redraw, and
  // turn the companion to face the player. Mirror super.update so the
  // companion's own animation keeps running.
  update(delta, camWorld) {
    super.update(delta, camWorld);
    this._updateBreathing(delta);
    this._updateParticles(delta);
    if (this._moodMirrorDirty) {
      this._renderMoodMirror();
      this._moodMirrorDirty = false;
    }
  }

  // Companion turns (but doesn't translate) toward the player.
  updateStudentPosition(worldPos) {
    if (!this.companion) return;
    const local = this._studentLocal.copy(worldPos).sub(this.roomPosition);
    this.companion.lookAtStudent(local.clone());
  }

  // ── Speech helpers ─────────────────────────────────────────
  _initLines() {
    this._lines = {
      greet: [
        '欢迎来到疗愈花园~ 我是莲莲.\n' +
        'Welcome. I\'m 莲莲. Take a breath, you\'re safe here.',
        '想做几节呼吸吗? 按下 START, 我陪你.\n' +
        'Press START whenever you\'re ready — I\'ll pace it with you.',
      ],
      idle: [
        '随时按 START, 我陪你呼吸.\n' +
        'Whenever you\'re ready, hit START.',
        '左右两边的小石头可以记录心情, 试试看?\n' +
        'The stones around the orb log your mood — feel free to tap one.',
        '深呼吸一下, 慢一点也没关系.\n' +
        'Take a slow breath. There\'s no rush.',
      ],
      idleSession: [
        '跟着光圈, 慢慢地~\n' +
        'Just follow the ring. Slow and steady.',
      ],
      patternChanged: [
        '换成新的节奏啦.\n' +
        'New pattern set.',
      ],
      sessionStart: [
        '开始啦. 让肩膀放下来.\n' +
        'Beginning. Let your shoulders drop.',
        '一起来 — 鼻吸口呼.\n' +
        'Here we go — in through the nose, out through the mouth.',
      ],
      sessionPause: [
        '先停一下, 不急.\n' +
        'Pausing. Take your time.',
      ],
      // Cycle prompts — kept very short so they don't crowd the bubble.
      inhale:  ['吸气 ~\nBreathe in ~'],
      holdIn:  ['屏住 ~\nHold ~'],
      exhale:  ['呼气 ~\nLet it out ~'],
      holdOut: ['放松 ~\nRest ~'],
      cycleMilestone: [
        '已经做完五个回合啦, 你做得很好.\n' +
        'Five cycles done — beautifully paced.',
      ],
      moodAck: {
        calm:    '记下了, "平静" ✦\nLogged: calm. Glad to hear it.',
        happy:   '记下了, "开心" ☀\nLogged: happy. Hold onto this feeling.',
        tired:   '记下了, "疲惫" 🌙\nLogged: tired. Be gentle with yourself.',
        anxious: '记下了, "焦虑" ☁\n' +
                 'Logged: anxious. Try a few slow breaths with me?',
        sad:     '记下了, "低落" 💧\nLogged: sad. I\'m here.',
      },
    };
  }

  _say(category, payload) {
    if (!this.companion?.say) return;
    const pool = this._lines?.[category];
    let text;
    if (Array.isArray(pool) && pool.length) {
      text = pool[(Math.random() * pool.length) | 0];
    } else if (typeof payload === 'string') {
      text = payload;
    } else if (pool && typeof pool === 'object' && payload) {
      text = pool[payload];
    }
    if (!text) return;
    this.companion.say(text);
    this._lastSaidAt = performance.now();
  }

  _scheduleIdleChatter(initialDelayMs) {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    const delay = initialDelayMs ?? (18000 + Math.random() * 12000);
    this._idleTimer = setTimeout(() => {
      this._idleTimer = null;
      if (!this.isActive) return;
      // Avoid talking over a recent prompt.
      if (performance.now() - this._lastSaidAt > 6000) {
        this._say(this._sessionRunning ? 'idleSession' : 'idle');
      }
      this._scheduleIdleChatter();
    }, Math.max(2500, delay));
  }

  // ── Breathing session ──────────────────────────────────────
  _setPattern(id, announce = true) {
    const p = this._patterns[id] || this._patterns.natural;
    this._currentPattern = p;
    // Reset phase to start of cycle so the new rhythm starts cleanly.
    this._phaseIdx     = 0;
    this._phaseElapsed = 0;
    // Visual highlight on the pattern button row.
    for (const btn of this._patternBtns) {
      btn.userData.setActive?.(btn.userData.patternId === p.id);
    }
    this._renderPhaseLabel();
    if (announce) this._say('patternChanged');
  }

  _toggleSession(forceState) {
    const target = (typeof forceState === 'boolean')
      ? forceState : !this._sessionRunning;
    if (target === this._sessionRunning) return;
    this._sessionRunning = target;
    if (target) {
      this._phaseIdx     = 0;
      this._phaseElapsed = 0;
      this._cycleCount   = 0;
      this.companion?.setExpression?.('happy');
      this._say('sessionStart');
      // Speak the first inhale prompt half a second after the
      // "Beginning" line so they don't overlap.
      setTimeout(() => {
        if (this._sessionRunning && this.isActive) this._say('inhale');
      }, 1100);
    } else {
      this.companion?.setExpression?.('idle');
      this._say('sessionPause');
    }
    this._renderPhaseLabel();
  }

  _updateBreathing(delta) {
    const p = this._currentPattern;
    const dur = p.durations[this._phaseIdx] || 1;

    // Advance phase clock only when running.
    if (this._sessionRunning) {
      this._phaseElapsed += delta;
      if (this._phaseElapsed >= dur) {
        this._phaseElapsed = 0;
        this._phaseIdx = (this._phaseIdx + 1) % 4;
        if (this._phaseIdx === 0) {
          this._cycleCount += 1;
          // Quiet milestone at the 5th completed cycle, then again
          // every 5 — but only one per session block to avoid spam.
          if (this._cycleCount === 5) {
            setTimeout(() => {
              if (this._sessionRunning && this.isActive) {
                this._say('cycleMilestone');
              }
            }, 400);
          }
        }
        // Per-phase soft cue, only every other cycle so it doesn't
        // crowd the bubble. Cycle 0/2/4… speak; 1/3/5… stay silent.
        if (this._cycleCount % 2 === 0) {
          const key = ['inhale', 'holdIn', 'exhale', 'holdOut'][this._phaseIdx];
          this._say(key);
        }
        this._renderPhaseLabel();
      }
    }

    // Compute a 0..1 "fullness" used to drive scale and emission. We
    // ALWAYS produce a value: when a session is running, fullness is
    // phase-driven (eased); when paused, we synthesise a slow ambient
    // sine pulse (~6-second period) so the orb is visibly breathing on
    // entry — the user shouldn't have to find the START button before
    // they can recognise the centerpiece.
    const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
    let fullness;
    if (this._sessionRunning) {
      const t = this._phaseElapsed / dur;     // 0..1 within current phase
      switch (this._phaseIdx) {
        case 0: fullness = ease(t); break;          // inhale 0 → 1
        case 1: fullness = 1; break;                 // hold-in
        case 2: fullness = 1 - ease(t); break;       // exhale 1 → 0
        default: fullness = 0; break;                // hold-out
      }
    } else {
      // Ambient gentle breath — full sine wave, range 0.15 .. 0.95 so
      // the orb never collapses to nothing and never clips at full.
      const tNow = performance.now() * 0.001;
      const amb = 0.5 + 0.5 * Math.sin(tNow * (2 * Math.PI) / 6);   // 6s period
      fullness = 0.15 + amb * 0.80;
    }

    // Drive visuals.
    if (this._orbCore) {
      const s = 0.85 + 0.55 * fullness;
      this._orbCore.scale.setScalar(s);
      if (this._orbCoreMat) {
        this._orbCoreMat.emissiveIntensity = 0.55 + 1.30 * fullness;
      }
      this._orbHalo?.scale.setScalar(s * 1.2);
      if (this._orbHaloMat) this._orbHaloMat.opacity = 0.22 + 0.40 * fullness;
    }
    if (this._floorRing) {
      const r = 0.9 + 1.9 * fullness;
      this._floorRing.scale.setScalar(r);
      if (this._floorRingMat) {
        this._floorRingMat.opacity = 0.30 + 0.55 * fullness;
      }
    }
    // Pulse the cohabiting point light too so the wood floor + sage
    // walls visibly brighten on inhale, dim on exhale. This is the
    // strongest "the room is breathing with you" cue in VR.
    if (this._orbLight) {
      this._orbLight.intensity = 0.55 + 1.10 * fullness;
    }
    // Cache fullness for particles to pulse with.
    this._fullness = fullness;
  }

  // ── Mood logging ───────────────────────────────────────────
  _logMood(id) {
    const entry = this._moodLog[id];
    if (!entry) return;
    entry.count += 1;
    this._moodTimeline.push(id);
    if (this._moodTimeline.length > 60) this._moodTimeline.shift();
    this._moodMirrorDirty = true;
    this.companion?.setExpression?.('happy');
    this._say('moodAck', id);
  }

  // ── Serenity shell (sage walls + light wood floor + ceiling) ─
  _buildSerenityShell(width, depth, height) {
    this.roomSize = { width, depth, height };

    // Floor — pale honey wood.
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xc7a878, roughness: 0.82, metalness: 0.04,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Inner tatami circle for the meditation centre.
    const tatamiMat = new THREE.MeshStandardMaterial({
      color: 0xd9c187, roughness: 0.92, metalness: 0.0,
    });
    const tatami = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), tatamiMat);
    tatami.rotation.x = -Math.PI / 2;
    tatami.position.set(0, 0.005, -1.8);
    this.group.add(tatami);

    // Soft sage walls.
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xd6e2d2, roughness: 0.94, side: THREE.DoubleSide,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    back.position.set(0, height / 2, -depth / 2);
    this.group.add(back);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat.clone());
    front.rotation.y = Math.PI;
    front.position.set(0, height / 2, depth / 2);
    this.group.add(front);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat.clone());
    left.rotation.y = Math.PI / 2;
    left.position.set(-width / 2, height / 2, 0);
    this.group.add(left);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat.clone());
    right.rotation.y = -Math.PI / 2;
    right.position.set(width / 2, height / 2, 0);
    this.group.add(right);

    // Ceiling — pale ivory.
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xf3ecdf, roughness: 0.95,
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height;
    this.group.add(ceiling);

    // Subtle bamboo skirting line at floor level (decorative ring).
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x8c6c40, roughness: 0.6,
    });
    const ringGeom = new THREE.TorusGeometry(Math.min(width, depth) / 2 - 0.08, 0.04, 8, 96);
    const skirting = new THREE.Mesh(ringGeom, ringMat);
    skirting.rotation.x = Math.PI / 2;
    skirting.position.y = 0.04;
    this.group.add(skirting);
  }

  // ── Breathing orb (centerpiece) ─────────────────────────────
  _buildBreathingOrb() {
    // Floor guidance ring directly under the orb — fades in/out as the
    // user inhales / exhales so the breathing is also legible from the
    // floor up (helpful in VR where you're often looking down). Wider
    // and brighter so it reads from the player's spawn point.
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xb6e8d0, transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const ringGeom = new THREE.RingGeometry(1.05, 1.20, 96);
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.015, -2.0);
    this.group.add(ring);
    this._floorRing = ring;
    this._floorRingMat = ringMat;

    // Soft halo (large, translucent, additive-feeling). Bumped from
    // 0.85m to 1.05m radius so it still reads as an aura even when
    // the orb is at minimum exhale scale.
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xc6f0dc, transparent: true, opacity: 0.32,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 24), haloMat);
    halo.position.set(0, 1.6, -2.0);
    this.group.add(halo);
    this._orbHalo = halo;
    this._orbHaloMat = haloMat;

    // Glowing core sphere — emissive so it lights the room slightly.
    // 0.6m → 0.75m so it claims the centre at any spawn distance.
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xa8d8c0,
      emissive: 0xb8e8d0,
      emissiveIntensity: 0.7,
      roughness: 0.35, metalness: 0.05,
      transparent: true, opacity: 0.95,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.75, 48, 32), coreMat);
    core.position.set(0, 1.6, -2.0);
    this.group.add(core);
    this._orbCore = core;
    this._orbCoreMat = coreMat;

    // Brighter cohabiting point light so the breathing pulse visibly
    // washes the wood floor and sage walls each cycle.
    const orbLight = new THREE.PointLight(0xc8f0d8, 1.1, 9.0, 2.0);
    orbLight.position.set(0, 1.6, -2.0);
    this.group.add(orbLight);
    this._orbLight = orbLight;
  }

  // ── Phase label (canvas plane floating beside the orb) ────
  _buildPhaseLabel() {
    const W = 768, H = 384;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    this._phaseCanvas = cv;
    this._phaseCtx    = cv.getContext('2d');

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this._phaseTex = tex;

    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), mat);
    // Sits behind the orb so the orb reads as the focal point and the
    // text is unmistakable above it.
    plane.position.set(0, 3.1, -2.6);
    this.group.add(plane);
    this._phaseLabel = plane;
  }

  _renderPhaseLabel() {
    if (!this._phaseCtx) return;
    const ctx = this._phaseCtx;
    const W = this._phaseCanvas.width;
    const H = this._phaseCanvas.height;

    ctx.clearRect(0, 0, W, H);

    // Soft cream pill background with a sage trim.
    ctx.fillStyle = 'rgba(255, 250, 240, 0.92)';
    this._roundRect(ctx, 12, 12, W - 24, H - 24, 56); ctx.fill();
    ctx.strokeStyle = '#7DC9A8';
    ctx.lineWidth = 4;
    this._roundRect(ctx, 12, 12, W - 24, H - 24, 56); ctx.stroke();

    // Title (pattern + cycle counter).
    ctx.fillStyle = '#3a4a40';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 36px "Inter","PingFang SC",sans-serif';
    const p = this._currentPattern;
    ctx.fillText(`${p.en} · ${p.zh}`, W / 2, 64);

    // Phase headline.
    const phases = [
      { en: 'Inhale',  zh: '吸气' },
      { en: 'Hold',    zh: '屏息' },
      { en: 'Exhale',  zh: '呼气' },
      { en: 'Rest',    zh: '放松' },
    ];
    const ph = phases[this._phaseIdx];
    ctx.fillStyle = this._sessionRunning ? '#2c8c5c' : '#9aa39e';
    ctx.font = '700 110px "Georgia","Times New Roman",serif';
    ctx.fillText(ph.en, W / 2, H * 0.52);
    ctx.fillStyle = '#5a6a60';
    ctx.font = '500 56px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(ph.zh, W / 2, H * 0.78);

    // Footer (cycle counter or "Press START").
    ctx.fillStyle = '#7a8a80';
    ctx.font = '500 26px "Inter","PingFang SC",sans-serif';
    if (this._sessionRunning) {
      ctx.fillText(`Cycle ${this._cycleCount + 1} · 第 ${this._cycleCount + 1} 回合`, W / 2, H - 36);
    } else {
      ctx.fillText('Press START · 按 START 开始', W / 2, H - 36);
    }

    this._phaseTex.needsUpdate = true;
  }

  // ── Session controls (START / PAUSE / NATURAL / BOX / 4-7-8) ─
  _buildSessionControls() {
    const padW = 0.9, padH = 0.42, padD = 0.10;
    const gap  = 0.12;
    const barZ = 4.2;     // a couple metres in front of the orb
    const barY = 1.45;
    const buttons = [
      { primary: 'START',  secondary: '开始',     action: () => this._toggleSession(true)  },
      { primary: 'PAUSE',  secondary: '暂停',     action: () => this._toggleSession(false) },
      { primary: 'NATURAL', secondary: '自然 4-4-6-2', patternId: 'natural',
        action: () => this._setPattern('natural') },
      { primary: 'BOX',    secondary: '盒式 4-4-4-4', patternId: 'box',
        action: () => this._setPattern('box') },
      { primary: '4-7-8',  secondary: '4-7-8 法',     patternId: '478',
        action: () => this._setPattern('478') },
    ];
    const total = buttons.length * padW + (buttons.length - 1) * gap;
    let x = -total / 2 + padW / 2;

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x2a3a32, roughness: 0.55, metalness: 0.25,
    });
    for (const def of buttons) {
      const isActive = (def.patternId === this._currentPattern.id);
      const tex = this._makeHealingButtonTexture(def.primary, def.secondary, isActive);
      // Use a single-material box for the body and a separate front
      // plane for the face so xr.js#_updateHover (which only knows
      // how to bump `m.material.emissiveIntensity`) lands its hover
      // highlight on the plane's MeshStandardMaterial. Multi-material
      // boxes silently no-op the hover bump.
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(padW, padH, padD), baseMat);
      pad.position.set(x, barY, barZ);
      const faceMat = new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex,
        emissiveIntensity: 0.65, roughness: 0.55, metalness: 0.1,
      });
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(padW * 0.96, padH * 0.92), faceMat);
      face.position.set(0, 0, padD / 2 + 0.001);   // sit on +Z face of box
      pad.add(face);

      const press = () => {
        const z0 = pad.position.z;
        pad.position.z = z0 - 0.04;
        setTimeout(() => { pad.position.z = z0; }, 120);
        def.action?.();
      };
      // Both the box and the face register identical click handlers so
      // the VR ray hits whichever surface the cursor lands on first.
      pad.userData.onClick = press;
      face.userData.onClick = press;

      // Allow the pattern row to repaint highlight when the active
      // pattern changes. Dispose the old CanvasTexture so a long VR
      // session doesn't leak GPU textures every time a pattern is
      // swapped.
      if (def.patternId) {
        pad.userData.patternId = def.patternId;
        pad.userData.setActive = (active) => {
          const oldTex = faceMat.map;
          const newTex = this._makeHealingButtonTexture(def.primary, def.secondary, active);
          faceMat.map = newTex;
          faceMat.emissiveMap = newTex;
          faceMat.needsUpdate = true;
          oldTex?.dispose?.();
        };
        this._patternBtns.push(pad);
      }
      this.group.add(pad);
      this.interactables.push(pad);
      this.interactables.push(face);
      x += padW + gap;
    }
  }

  _makeHealingButtonTexture(primary, secondary, active) {
    const W = 256, H = 128;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (active) {
      grad.addColorStop(0, '#3aa78a');
      grad.addColorStop(1, '#1f6a55');
    } else {
      grad.addColorStop(0, '#2c4438');
      grad.addColorStop(1, '#1a2a22');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = active ? '#ffffff' : 'rgba(180, 220, 200, 0.6)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.fillStyle = '#f1faf3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 36px "Inter","Helvetica Neue",sans-serif';
    ctx.fillText(primary, W / 2, H / 2 - 12);
    ctx.fillStyle = active ? 'rgba(255,255,255,0.9)' : 'rgba(190, 220, 205, 0.78)';
    ctx.font = '500 22px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(secondary, W / 2, H / 2 + 26);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ── Mood stones (5 round pads on the floor) ────────────────
  _buildMoodStones() {
    const ids   = ['calm', 'happy', 'tired', 'anxious', 'sad'];
    const radius = 4.4;
    // Arc them around the orb's left/front so the player can reach
    // them after a session without losing sight of the orb.
    const startAngle = -Math.PI * 0.22;
    const endAngle   =  Math.PI * 1.22;
    const span = endAngle - startAngle;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const m  = this._moodLog[id];
      const a  = startAngle + (i / (ids.length - 1)) * span;
      // We only place stones in the front half-plane (z > -1) so the
      // player can see + reach them. Project the arc into that band.
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius * 0.7 + 1.0;

      // Stone body: short cylinder with rounded look from the bevel.
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x6a7a72, roughness: 0.85, metalness: 0.05,
      });
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.62, 0.18, 32), stoneMat);
      stone.position.set(x, 0.09, z);
      this.group.add(stone);

      // Top decal — circular CanvasTexture with emoji + label.
      const tex = this._makeStoneTexture(m);
      const decalMat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const decal = new THREE.Mesh(new THREE.CircleGeometry(0.52, 48), decalMat);
      decal.rotation.x = -Math.PI / 2;
      decal.position.set(x, 0.19, z);
      this.group.add(decal);

      // Capture each mesh's baseline Y once so the press animation
      // doesn't drift on rapid repeated taps.
      const stoneBaseY = stone.position.y;
      const decalBaseY = decal.position.y;
      const press = () => {
        stone.position.y = stoneBaseY - 0.04;
        decal.position.y = decalBaseY - 0.04;
        setTimeout(() => {
          stone.position.y = stoneBaseY;
          decal.position.y = decalBaseY;
        }, 130);
        this._logMood(id);
      };
      // Both the cylinder and the top decal register the same click —
      // so a slightly off VR ray that lands on either surface still
      // registers the mood entry.
      decal.userData.onClick = press;
      stone.userData.onClick = press;
      this.interactables.push(decal);
      this.interactables.push(stone);
    }
  }

  _makeStoneTexture(mood) {
    const D = 256;
    const cv = document.createElement('canvas');
    cv.width = D; cv.height = D;
    const ctx = cv.getContext('2d');

    // Soft mood-tint disc.
    const grad = ctx.createRadialGradient(D / 2, D / 2, 20, D / 2, D / 2, D / 2);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(1, mood.color);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(D / 2, D / 2, D / 2 - 4, 0, Math.PI * 2); ctx.fill();

    // Trim ring.
    ctx.strokeStyle = 'rgba(60, 70, 60, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(D / 2, D / 2, D / 2 - 6, 0, Math.PI * 2); ctx.stroke();

    // Emoji
    ctx.font = '88px "Segoe UI Emoji", Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(mood.emoji, D / 2, D * 0.43);

    // Label
    ctx.font = '700 28px "Inter","PingFang SC",sans-serif';
    ctx.fillStyle = '#2a2a2a';
    ctx.fillText(`${mood.en} · ${mood.zh}`, D / 2, D * 0.78);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ── Mood mirror (wall plaque rendered from the journal) ───
  _buildMoodMirror() {
    const W = 1024, H = 640;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    this._mirrorCanvas = cv;
    this._mirrorCtx    = cv.getContext('2d');

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this._mirrorTex = tex;

    // The previous version pinned the plaque to the back wall, ~13m
    // from the player's spawn — that worked on desktop but read as
    // an unreadable postage stamp in VR. Pull it forward into the
    // room as a freestanding plaque on the left of the breathing
    // orb (~5m from the player), framed in dark wood, and tilt it
    // gently toward the spawn so the camera can read it on entry.
    const plaqueX = -3.6, plaqueY = 1.55, plaqueZ = -0.6;
    const yawTowardSpawn = Math.PI * 0.18;     // face the player at +Z

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x6a4a30, roughness: 0.5, metalness: 0.1,
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 0.10), frameMat);
    frame.position.set(plaqueX, plaqueY, plaqueZ);
    frame.rotation.y = yawTowardSpawn;
    this.group.add(frame);

    // Plaque face — emissive so the parchment reads even in low light.
    const mat = new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex,
      emissiveIntensity: 0.30, roughness: 0.45, metalness: 0.08,
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 1.55), mat);
    plaque.position.set(plaqueX, plaqueY, plaqueZ + 0.06);
    plaque.rotation.y = yawTowardSpawn;
    // Apply the frame's offset to the plaque too: the plane needs to
    // sit on the +Z face of the frame in its rotated frame, so push it
    // forward along the rotated-+Z direction.
    const off = new THREE.Vector3(0, 0, 0.06).applyEuler(plaque.rotation);
    plaque.position.set(plaqueX + off.x, plaqueY, plaqueZ + off.z);
    this.group.add(plaque);

    // A small wooden stand beneath the plaque so it doesn't look like
    // it's hovering in space.
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x6a4a30, roughness: 0.6, metalness: 0.05,
    });
    const standBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.32, 0.10, 24), standMat);
    standBase.position.set(plaqueX, 0.05, plaqueZ);
    this.group.add(standBase);
    const standPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, plaqueY - 0.85, 16), standMat);
    standPole.position.set(plaqueX, (plaqueY - 0.85) / 2 + 0.10, plaqueZ);
    this.group.add(standPole);
  }

  _renderMoodMirror() {
    if (!this._mirrorCtx) return;
    const ctx = this._mirrorCtx;
    const W = this._mirrorCanvas.width;
    const H = this._mirrorCanvas.height;

    // Soft cream parchment.
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fbf3df');
    bg.addColorStop(1, '#ecdfc0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Sage trim.
    ctx.strokeStyle = '#7DC9A8';
    ctx.lineWidth = 6;
    this._roundRect(ctx, 14, 14, W - 28, H - 28, 32); ctx.stroke();

    // Title row.
    ctx.fillStyle = '#3a4a40';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '700 56px "Georgia","Times New Roman",serif';
    ctx.fillText('Mood Journal', 60, 50);
    ctx.fillStyle = '#5a6a60';
    ctx.font = '500 36px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('心情记录', 60, 116);

    // Total count chip on the top right.
    const total = this._moodTimeline.length;
    ctx.font = '500 28px "Inter",sans-serif';
    ctx.fillStyle = 'rgba(125, 201, 168, 0.18)';
    this._roundRect(ctx, W - 240, 60, 180, 50, 25); ctx.fill();
    ctx.fillStyle = '#2c8c5c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${total} entries`, W - 150, 86);

    // Tally bars.
    const ids = ['calm', 'happy', 'tired', 'anxious', 'sad'];
    const max = Math.max(1, ...ids.map((id) => this._moodLog[id].count));
    let y = 200;
    const barX = 220, barW = W - barX - 80, rowH = 56;
    for (const id of ids) {
      const m = this._moodLog[id];
      // Emoji + label
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '36px "Segoe UI Emoji", Arial';
      ctx.fillStyle = '#3a4a40';
      ctx.fillText(m.emoji, 60, y + rowH / 2);
      ctx.font = '600 26px "Inter","PingFang SC",sans-serif';
      ctx.fillText(`${m.en} · ${m.zh}`, 110, y + rowH / 2);
      // Bar background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      this._roundRect(ctx, barX, y + 14, barW, 28, 14); ctx.fill();
      // Bar fill
      const filled = (m.count / max) * barW;
      if (filled > 0) {
        ctx.fillStyle = m.color;
        this._roundRect(ctx, barX, y + 14, Math.max(filled, 28), 28, 14); ctx.fill();
      }
      // Count
      ctx.fillStyle = '#3a4a40';
      ctx.textAlign = 'right';
      ctx.font = '700 24px "Inter",sans-serif';
      ctx.fillText(String(m.count), W - 80, y + rowH / 2);
      y += rowH + 8;
    }

    // Timeline strip (bottom): last entries as colored dots.
    const stripY = H - 70;
    ctx.fillStyle = '#3a4a40';
    ctx.font = '500 22px "Inter","PingFang SC",sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Recent · 最近', 60, stripY);
    const dotsX0 = 220;
    const dotsW  = W - dotsX0 - 80;
    const recent = this._moodTimeline.slice(-30);
    if (recent.length > 0) {
      const step = Math.min(20, dotsW / Math.max(1, recent.length));
      for (let i = 0; i < recent.length; i++) {
        const m = this._moodLog[recent[i]];
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(dotsX0 + i * step + 8, stripY, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#9aa39e';
      ctx.font = '500 22px "Inter","PingFang SC",sans-serif';
      ctx.fillText('No entries yet · 还没有记录哦', dotsX0, stripY);
    }

    this._mirrorTex.needsUpdate = true;
  }

  // ── Particle ambience (drifting petals + bokeh fireflies) ─
  _buildParticleField() {
    // Shared sprite — a soft round disc — used by both layers as a
    // PointsMaterial map for that "bokeh" look.
    const sprite = this._makeSoftDiscTexture();

    // Petals — slow downward drift inside a 18×4×18 box.
    const petalCount = 140;
    const petalGeom = new THREE.BufferGeometry();
    const pPos = new Float32Array(petalCount * 3);
    const pCol = new Float32Array(petalCount * 3);
    const pVel = new Float32Array(petalCount * 3);
    const pPhase = new Float32Array(petalCount);
    for (let i = 0; i < petalCount; i++) {
      pPos[i * 3 + 0] = (Math.random() - 0.5) * 18;
      pPos[i * 3 + 1] = Math.random() * 4 + 0.5;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 18;
      // Soft cherry / cream / pink palette.
      const c = Math.random();
      if (c < 0.4)      { pCol[i*3]=0.99; pCol[i*3+1]=0.78; pCol[i*3+2]=0.85; } // pink
      else if (c < 0.75){ pCol[i*3]=1.00; pCol[i*3+1]=0.92; pCol[i*3+2]=0.78; } // cream
      else              { pCol[i*3]=0.78; pCol[i*3+1]=0.92; pCol[i*3+2]=0.82; } // mint
      pVel[i*3+0] = (Math.random() - 0.5) * 0.18;
      pVel[i*3+1] = -0.18 - Math.random() * 0.12;
      pVel[i*3+2] = (Math.random() - 0.5) * 0.18;
      pPhase[i]   = Math.random() * Math.PI * 2;
    }
    petalGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    petalGeom.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));
    // PointsMaterial with sizeAttenuation in VR scales sprites by
    // distance, so a 0.12m petal at 4m only paints ~3% of viewport
    // height — invisible against the wall. 0.30m gives a ~7-8%
    // footprint at 4m, which reads as a clear drifting petal.
    const petalMat = new THREE.PointsMaterial({
      size: 0.30, map: sprite, vertexColors: true,
      transparent: true, opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const petals = new THREE.Points(petalGeom, petalMat);
    this.group.add(petals);
    this._petalPoints = petals;
    this._petalVel    = pVel;
    this._petalPhase  = pPhase;

    // Fireflies — gentle orbital bokeh, additive yellow-green.
    const fireflyCount = 90;
    const ffGeom = new THREE.BufferGeometry();
    const fPos = new Float32Array(fireflyCount * 3);
    const fCol = new Float32Array(fireflyCount * 3);
    const fOrigin = new Float32Array(fireflyCount * 3);   // orbit centre
    const fPhase  = new Float32Array(fireflyCount);
    for (let i = 0; i < fireflyCount; i++) {
      const cx = (Math.random() - 0.5) * 14;
      const cy = 1.0 + Math.random() * 2.2;
      const cz = (Math.random() - 0.5) * 14;
      fOrigin[i*3] = cx; fOrigin[i*3+1] = cy; fOrigin[i*3+2] = cz;
      fPos[i*3] = cx; fPos[i*3+1] = cy; fPos[i*3+2] = cz;
      // Honey-yellow → mint.
      const c = Math.random();
      if (c < 0.5) { fCol[i*3]=1.00; fCol[i*3+1]=0.95; fCol[i*3+2]=0.65; }
      else         { fCol[i*3]=0.78; fCol[i*3+1]=0.98; fCol[i*3+2]=0.86; }
      fPhase[i] = Math.random() * Math.PI * 2;
    }
    ffGeom.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    ffGeom.setAttribute('color',    new THREE.BufferAttribute(fCol, 3));
    const ffMat = new THREE.PointsMaterial({
      size: 0.40, map: sprite, vertexColors: true,
      transparent: true, opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const fireflies = new THREE.Points(ffGeom, ffMat);
    this.group.add(fireflies);
    this._fireflyPoints = fireflies;
    this._fireflyOrigin = fOrigin;
    this._fireflyPhase  = fPhase;
    this._fireflyMat    = ffMat;
  }

  _updateParticles(delta) {
    // Petals: drift downward with subtle horizontal sway, recycle to
    // the top once they fall below the floor. Cheap O(n) update.
    const petals = this._petalPoints;
    if (petals) {
      const pos = petals.geometry.attributes.position.array;
      for (let i = 0; i < pos.length / 3; i++) {
        const ix = i * 3;
        // Sway from sin(phase) so the motion isn't a straight line.
        this._petalPhase[i] += delta * 0.6;
        const sway = Math.sin(this._petalPhase[i]) * 0.10;
        pos[ix + 0] += (this._petalVel[ix + 0] + sway) * delta;
        pos[ix + 1] += this._petalVel[ix + 1] * delta;
        pos[ix + 2] += this._petalVel[ix + 2] * delta;
        if (pos[ix + 1] < 0.05) {
          pos[ix + 0] = (Math.random() - 0.5) * 18;
          pos[ix + 1] = 4.5;
          pos[ix + 2] = (Math.random() - 0.5) * 18;
        }
      }
      petals.geometry.attributes.position.needsUpdate = true;
    }

    // Fireflies: orbit a fixed origin in a small circle. Pulse opacity
    // with the breathing rhythm when a session is running so the room
    // visibly "breathes" along with the orb.
    const ff = this._fireflyPoints;
    if (ff) {
      const pos = ff.geometry.attributes.position.array;
      for (let i = 0; i < pos.length / 3; i++) {
        const ix = i * 3;
        this._fireflyPhase[i] += delta * 0.5;
        const t = this._fireflyPhase[i];
        pos[ix + 0] = this._fireflyOrigin[ix + 0] + Math.cos(t) * 0.45;
        pos[ix + 1] = this._fireflyOrigin[ix + 1] + Math.sin(t * 1.3) * 0.18;
        pos[ix + 2] = this._fireflyOrigin[ix + 2] + Math.sin(t) * 0.45;
      }
      ff.geometry.attributes.position.needsUpdate = true;

      if (this._fireflyMat) {
        // Always pulse with the breathing rhythm — `_fullness` is now
        // synthesised from a slow ambient sine when no session is
        // running, so the room breathes whether or not the user has
        // pressed START. Range 0.50..0.95 keeps the bokeh visible even
        // at exhale.
        this._fireflyMat.opacity = 0.50 + 0.45 * (this._fullness ?? 0);
      }
    }
  }

  _makeSoftDiscTexture() {
    const D = 64;
    const cv = document.createElement('canvas');
    cv.width = D; cv.height = D;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(D / 2, D / 2, 1, D / 2, D / 2, D / 2);
    g.addColorStop(0,   'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, D, D);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Tiny rounded-rectangle helper (canvas only).
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
    // Bespoke arcade-lounge room: walnut wainscot + neon argyle upper
    // wall + cinema-style spotlight rig over the floor board.
    this._buildGamesRoom(16, 16, 5);

    // Vivid teal-cyan: complementary to the warm tatami-yellow Go board
    // (#E9C28B → #C99A5B) for the highest contrast against the floor,
    // and distinct from the other four zones' companions.
    this._buildAICompanion(2, 0.5, 1, 0x2EC4D8);
    this._buildExitDoor(0, 0, 7);
    
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

  // ── Override enter so 童童 greets the player on each visit. ��─
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
  // ─────────────────────────────────────────────────────��──────
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

    // Biconvex stone profile via LatheGeometry �� proportional to a real
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
  // ───────────────��───────���────────────────────────────────────
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
  // ──────────────────────────��─────────────────────────────────
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
  // ════════════════════════════════════════════════════���═══════

  // ── Asset prep: lathe-based bodies + composite tops ────────
  _buildChessAssets() {
    const c = this._chess;

    // Materials — matte / frosted (磨砂) finish. Very high roughness
    // and zero metalness so highlights are diffuse blobs rather than
    // sharp speculars; the pieces read as solid silhouettes from a
    // distance, which is what matters most for a 13m-wide floor board.
    // Colours are chosen for contrast against the cream / walnut
    // checkerboard: a warm ivory for white, a warm charcoal for black.
    c.whiteMat = new THREE.MeshStandardMaterial({
      color: 0xEFE6CF, roughness: 0.94, metalness: 0.0,
    });
    // Black pieces use a warm mahogany/espresso instead of cool charcoal
    // so the back-rank silhouette no longer melts into the deep-navy
    // upper wall (0x171028) when looking across the board.
    c.blackMat = new THREE.MeshStandardMaterial({
      color: 0x5A2E1C, roughness: 0.92, metalness: 0.0,
    });
    // Accent material — slightly different shade for crown rings,
    // cross arms, knight eyes etc. Same matte treatment.
    c.whiteAccent = new THREE.MeshStandardMaterial({
      color: 0xC9B98F, roughness: 0.95, metalness: 0.0,
    });
    c.blackAccent = new THREE.MeshStandardMaterial({
      color: 0x6E3C26, roughness: 0.95, metalness: 0.0,
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

  // Common pedestal — Staunton-style bell base. Heights and radii are
  // tuned for a 1.53m board cell: base radius ≈ 0.27 (≈ 0.35 × cell),
  // total bell height ≈ 0.14m. Pieces stack their column on top of
  // this so the visual mass at the bottom reads from across the room.
  _chessPedestalPoints(topR, neckY) {
    return [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.27,  0),
      new THREE.Vector2(0.27,  0.020),
      new THREE.Vector2(0.24,  0.052),
      new THREE.Vector2(0.18,  0.080),
      new THREE.Vector2(0.155, 0.110),
      new THREE.Vector2(topR,  neckY),
    ];
  }

  // ── Pawn (height ≈ 0.70m on a 1.53m square) ─────────────────
  _buildPawnMesh(color) {
    const profile = [
      ...this._chessPedestalPoints(0.135, 0.14),
      new THREE.Vector2(0.115, 0.24),  // slim column
      new THREE.Vector2(0.155, 0.28),  // collar bulge
      new THREE.Vector2(0.085, 0.32),  // collar dip
      new THREE.Vector2(0.140, 0.40),  // shoulder of head
      new THREE.Vector2(0.155, 0.48),  // head equator
      new THREE.Vector2(0.135, 0.56),
      new THREE.Vector2(0.080, 0.64),
      new THREE.Vector2(0.001, 0.70),
    ];
    const geo = new THREE.LatheGeometry(profile, 32);
    return this._wrapPiece(new THREE.Mesh(geo, this._matFor(color)));
  }

  // ── Rook (height ≈ 0.80m incl. crenellations) ───────────────
  _buildRookMesh(color) {
    const profile = [
      ...this._chessPedestalPoints(0.165, 0.14),
      new THREE.Vector2(0.155, 0.30),  // waist taper
      new THREE.Vector2(0.155, 0.50),  // shaft
      new THREE.Vector2(0.190, 0.55),  // shoulder ring
      new THREE.Vector2(0.220, 0.60),  // top widens
      new THREE.Vector2(0.220, 0.68),  // top edge
      new THREE.Vector2(0.001, 0.68),  // close
    ];
    const geo = new THREE.LatheGeometry(profile, 32);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, this._matFor(color)));

    // 4 crenellation cubes around the top so the battlement reads.
    const battle = new THREE.BoxGeometry(0.11, 0.12, 0.11);
    const battleMat = this._matFor(color);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const m = new THREE.Mesh(battle, battleMat);
      m.position.set(Math.cos(a) * 0.18, 0.74, Math.sin(a) * 0.18);
      m.rotation.y = a;
      grp.add(m);
    }
    return this._wrapPiece(grp);
  }

  // ── Bishop (height ≈ 0.95m) ─────────────────────────────────
  _buildBishopMesh(color) {
    const profile = [
      ...this._chessPedestalPoints(0.135, 0.14),
      new THREE.Vector2(0.120, 0.30),  // slim column
      new THREE.Vector2(0.165, 0.36),  // collar bulge
      new THREE.Vector2(0.085, 0.42),  // collar dip
      new THREE.Vector2(0.155, 0.55),  // body
      new THREE.Vector2(0.135, 0.68),  // narrowing toward mitre
      new THREE.Vector2(0.080, 0.78),  // mitre taper
      new THREE.Vector2(0.060, 0.86),  // tip
      new THREE.Vector2(0.075, 0.90),  // tip ball
      new THREE.Vector2(0.001, 0.95),
    ];
    const geo = new THREE.LatheGeometry(profile, 32);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, this._matFor(color)));

    // Classic mitre slit across the top, in the contrasting accent.
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.025, 0.06),
      this._accentFor(color === 'white' ? 'black' : 'white'),
    );
    slit.position.set(0, 0.84, 0);
    slit.rotation.y = Math.PI / 4;
    grp.add(slit);
    return this._wrapPiece(grp);
  }

  // ── Queen (height ≈ 1.10m, tip pearl at 1.06) ───────────────
  _buildQueenMesh(color) {
    const profile = [
      ...this._chessPedestalPoints(0.155, 0.14),
      new THREE.Vector2(0.135, 0.30),
      new THREE.Vector2(0.180, 0.36),  // collar
      new THREE.Vector2(0.100, 0.42),
      new THREE.Vector2(0.165, 0.65),  // body
      new THREE.Vector2(0.200, 0.85),  // crown rise
      new THREE.Vector2(0.220, 0.92),  // crown rim outer
      new THREE.Vector2(0.210, 0.98),
      new THREE.Vector2(0.001, 0.98),
    ];
    const geo = new THREE.LatheGeometry(profile, 36);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, this._matFor(color)));

    // 8 pearls ringing the crown.
    const pearl = new THREE.SphereGeometry(0.045, 14, 10);
    const pearlMat = this._matFor(color);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      const m = new THREE.Mesh(pearl, pearlMat);
      m.position.set(Math.cos(a) * 0.20, 1.02, Math.sin(a) * 0.20);
      grp.add(m);
    }
    // Central spire pearl.
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.060, 16, 12), pearlMat);
    top.position.set(0, 1.06, 0);
    grp.add(top);
    return this._wrapPiece(grp);
  }

  // ── King (height ≈ 1.22m incl. cross) ───────────────────────
  _buildKingMesh(color) {
    const profile = [
      ...this._chessPedestalPoints(0.165, 0.14),
      new THREE.Vector2(0.145, 0.30),
      new THREE.Vector2(0.195, 0.36),  // collar
      new THREE.Vector2(0.105, 0.42),
      new THREE.Vector2(0.180, 0.65),  // body
      new THREE.Vector2(0.210, 0.90),  // crown rise
      new THREE.Vector2(0.230, 0.98),  // crown wide
      new THREE.Vector2(0.225, 1.04),
      new THREE.Vector2(0.001, 1.04),
    ];
    const geo = new THREE.LatheGeometry(profile, 36);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, this._matFor(color)));

    // Cross on top — solid same-material so it reads at distance.
    const accent = this._matFor(color);
    const vert = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.20, 0.055), accent);
    vert.position.set(0, 1.14, 0);
    grp.add(vert);
    const horiz = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 0.055), accent);
    horiz.position.set(0, 1.10, 0);
    grp.add(horiz);
    return this._wrapPiece(grp);
  }

  // ── Knight (head silhouette extrusion, total height ≈ 0.92m) ─
  _buildKnightMesh(color) {
    // Lathed pedestal that matches every other piece.
    const baseProfile = [
      ...this._chessPedestalPoints(0.155, 0.14),
      new THREE.Vector2(0.170, 0.20),
      new THREE.Vector2(0.001, 0.20),
    ];
    const baseGeo = new THREE.LatheGeometry(baseProfile, 32);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(baseGeo, this._matFor(color)));

    // Stylised horse-head silhouette extruded along z. Y range 0.20 → 0.92,
    // so the head sits directly on the pedestal lip and reaches near
    // bishop height. Built in xy with the snout pointing -x.
    const s = new THREE.Shape();
    s.moveTo( 0.22, 0.20);    // start at back-bottom of head
    s.lineTo(-0.12, 0.20);    // front-bottom (under chest)
    s.lineTo(-0.22, 0.32);    // throat
    s.lineTo(-0.28, 0.46);    // chin
    s.lineTo(-0.26, 0.56);    // mouth
    s.lineTo(-0.13, 0.62);    // nose bridge
    s.lineTo(-0.05, 0.74);    // forehead
    s.lineTo( 0.00, 0.86);    // forward ear tip
    s.lineTo( 0.07, 0.74);    // dip between ears
    s.lineTo( 0.12, 0.84);    // back ear tip
    s.lineTo( 0.20, 0.74);    // back of head
    s.lineTo( 0.24, 0.42);    // mane back curve
    s.lineTo( 0.22, 0.20);    // close
    const headGeo = new THREE.ExtrudeGeometry(s, {
      depth: 0.22, bevelEnabled: true,
      bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2,
    });
    headGeo.translate(0, 0, -0.11);   // centre on z-axis
    const head = new THREE.Mesh(headGeo, this._matFor(color));
    grp.add(head);

    // Tiny eye dot on each side for character (matte, contrasting tone).
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 10, 8),
      this._accentFor(color === 'white' ? 'black' : 'white'),
    );
    eye.position.set(-0.13, 0.56, 0.13);
    grp.add(eye);
    const eye2 = eye.clone();
    eye2.position.z = -0.13;
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
    chev.position.y = 1.55;             // hovers ~0.3m above the king (tallest ≈ 1.22m)
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
    c.aiCursor.userData.chev.position.y = 1.55 + Math.sin(t * Math.PI * 2) * 0.04;
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
  // ──────────────────────────────────────────��─────────────────
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

  // ──────────────────────────────────────────────��─────────────
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

  // ���───────────────────────────────────────────────────────────
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

  // ════════════════════════════════════════════════════════════
  //  Bespoke games-room shell (walls + floor + ceiling + lights).
  //  Replaces BaseVRRoom._buildRoom with a unified arcade-lounge
  //  look: deep-plum upper walls with neon argyle, walnut wainscot
  //  with an amber chair-rail, walnut floor, and a cinematic
  //  spotlight rig that pools warm light over the floor board.
  // ══════════════════��═════════════════════════════════════════
  _buildGamesRoom(width, depth, height) {
    this.roomSize = { width, depth, height };

    // ── Floor — dark walnut so the giant board (covers ~72%) reads
    //   as a deliberately framed centerpiece rather than floating.
    const floorTex = this._makeArcadeFloorTexture();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(2, 2);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({
        map: floorTex, roughness: 0.85, metalness: 0.04,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // ── Walls — shared CanvasTexture, tiled per-wall so the
    //    pattern reads at consistent human scale on every face.
    //    The texture is ~4m wide → repeat = (wallWidth / 4, 1).
    const wallTex = this._makeArcadeWallTexture();
    const _wrap = (hRepeat) => {
      const t = wallTex.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(hRepeat, 1);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      return t;
    };
    const mkWall = (planeWidth) => new THREE.Mesh(
      new THREE.PlaneGeometry(planeWidth, height),
      new THREE.MeshStandardMaterial({
        map: _wrap(planeWidth / 4),
        roughness: 0.92, metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    );

    const back = mkWall(width);
    back.position.set(0, height / 2, -depth / 2);
    this.group.add(back);

    const left = mkWall(depth);
    left.rotation.y = Math.PI / 2;
    left.position.set(-width / 2, height / 2, 0);
    this.group.add(left);

    const right = mkWall(depth);
    right.rotation.y = -Math.PI / 2;
    right.position.set(width / 2, height / 2, 0);
    this.group.add(right);

    // ── Ceiling — deep plum so warm spot-pool feels like a stage.
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({
        color: 0x1A1428, roughness: 0.92, metalness: 0.05,
      }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height;
    this.group.add(ceiling);

    // ── Light rig ──────────────────────────────────────────────���─
    // 1. HemisphereLight (warm sky / cool floor) for natural fill —
    //    keeps shadows from going pitch-black without flattening.
    const hemi = new THREE.HemisphereLight(0xFFD4A8, 0x1F1730, 0.50);
    this.group.add(hemi);

    // 2. Faint AmbientLight floor — just enough to lift deep shadows.
    const amb = new THREE.AmbientLight(0xFFFFFF, 0.13);
    this.group.add(amb);

    // 3. Cinematic SpotLight from the centre of the ceiling, aimed
    //    straight down at the board. Wide cone + soft penumbra so
    //    the falloff looks like a real stage / billiards lamp.
    const spot = new THREE.SpotLight(
      0xFFEDC9,           // warm cream
      1.7,                // intensity
      18,                 // distance
      Math.PI / 3.4,      // cone half-angle ≈ 53°
      0.55,               // penumbra (soft edge)
      1.4,                // decay
    );
    spot.position.set(0, height - 0.2, 0);
    spot.target.position.set(0, 0, 0);
    this.group.add(spot);
    this.group.add(spot.target);

    // 4. Three coloured arcade accents tucked in the upper corners.
    //    Lower intensity than before so the SpotLight stays the hero
    //    and the chess pieces never get colour-cast into mush.
    const accents = [
      { color: 0xFFB04A, pos: [-6.4, height - 0.55, -6.4], i: 0.45 },
      { color: 0x36C8FF, pos: [ 6.4, height - 0.55, -6.4], i: 0.45 },
      { color: 0xFF63AA, pos: [ 0,   height - 0.55,  6.4], i: 0.30 },
    ];
    for (const a of accents) {
      const p = new THREE.PointLight(a.color, a.i, 14, 1.7);
      p.position.set(a.pos[0], a.pos[1], a.pos[2]);
      this.group.add(p);
    }
  }

  // ── Wall CanvasTexture: argyle upper wall + amber chair rail +
  //    walnut wainscot + thin black skirting. One canvas tiles to
  //    every wall so the pattern stays consistent.
  _makeArcadeWallTexture() {
    const W = 1024, H = 1280;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // ── Top LED hint strip (decorative — real LED is the SpotLight).
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.04);
    top.addColorStop(0, '#FFB04A');
    top.addColorStop(1, '#221932');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H * 0.04);

    // ── Upper wall — deep navy / plum base.
    ctx.fillStyle = '#171028';
    ctx.fillRect(0, H * 0.04, W, H * 0.62);

    // Argyle diamond grid in cool cyan, faint enough to not compete
    // with the floor board for the eye.
    ctx.strokeStyle = 'rgba(96, 200, 255, 0.16)';
    ctx.lineWidth = 1.5;
    const dW = 128, dH = 64;
    for (let y = H * 0.05; y < H * 0.66; y += dH) {
      for (let x = -dW / 2; x < W + dW; x += dW) {
        const off = ((y / dH) | 0) % 2 === 0 ? 0 : dW / 2;
        ctx.beginPath();
        ctx.moveTo(x + off,            y + dH / 2);
        ctx.lineTo(x + off + dW / 2,   y);
        ctx.lineTo(x + off + dW,       y + dH / 2);
        ctx.lineTo(x + off + dW / 2,   y + dH);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Sparse star-dots so the navy never looks dead.
    ctx.fillStyle = 'rgba(120, 220, 255, 0.45)';
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * W;
      const y = H * 0.05 + Math.random() * (H * 0.6);
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Chair rail: bright amber neon line + dark shadow band below.
    ctx.fillStyle = '#FFB04A';
    ctx.fillRect(0, H * 0.66, W, H * 0.012);
    ctx.fillStyle = '#3F2810';
    ctx.fillRect(0, H * 0.672, W, H * 0.028);

    // ── Wainscot — dark walnut planks with vertical seams + grain.
    const plank = ctx.createLinearGradient(0, H * 0.70, 0, H);
    plank.addColorStop(0, '#3A2719');
    plank.addColorStop(1, '#1F1108');
    ctx.fillStyle = plank;
    ctx.fillRect(0, H * 0.70, W, H * 0.30);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 156) {
      ctx.beginPath();
      ctx.moveTo(x, H * 0.70);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 200, 130, 0.045)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 80; i++) {
      const y = H * 0.70 + Math.random() * H * 0.30;
      const x = Math.random() * W;
      const len = 60 + Math.random() * 200;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }

    // ── Skirting board.
    ctx.fillStyle = '#0A0604';
    ctx.fillRect(0, H * 0.96, W, H * 0.04);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ── Floor CanvasTexture: dark walnut planks with subtle grain.
  _makeArcadeFloorTexture() {
    const W = 512, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#33231A');
    grad.addColorStop(1, '#1C1108');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < W; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 256) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(180, 130, 80, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30 + Math.random() * 50, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
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
    this.renderer = options.renderer || null;     // for renderer.xr.getCamera()
    this.onRoomEnter = options.onRoomEnter || (() => {});
    this.onRoomExit = options.onRoomExit || (() => {});

    this.rooms = new Map();
    this.activeRoom = null;
    this.savedPlayerPos = new THREE.Vector3();
    this.savedPlayerRotY = 0;

    // Reusable scratch vectors so enterRoom() doesn't allocate every call.
    this._tmpHeadPos    = new THREE.Vector3();
    this._tmpHeadFwd    = new THREE.Vector3();
    this._tmpDesired    = new THREE.Vector3();
    this._tmpQuat       = new THREE.Quaternion();
    this._tmpYAxis      = new THREE.Vector3(0, 1, 0);
    
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

    // Save the rig's world pose so exitRoom() can put the player back
    // in the lobby right where they came from.
    this.savedPlayerPos.copy(this.playerGroup.position);
    this.savedPlayerRotY = this.playerGroup.rotation.y;

    const spawnPoint = room.getSpawnPoint();
    const lookAt     = room.getLookAtPoint?.() ||
                       spawnPoint.clone().add(new THREE.Vector3(0, 1.5, -3));

    // Rotate + translate the rig so the headset's world position lands
    // on `spawnPoint` and its forward axis points at `lookAt`. Without
    // this the VR view differs from the desktop view because the HMD
    // sits at an arbitrary real-world offset from the rig origin and
    // faces wherever the player happens to be looking.
    if (!this._recenterRigToFace(spawnPoint, lookAt)) {
      // Fallback when no XR camera is available yet (e.g. desktop mode):
      // just place the rig itself on the spawn point.
      this.playerGroup.position.copy(spawnPoint);
    }

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
    this.playerGroup.rotation.y = this.savedPlayerRotY;
  }

  /**
   * Rotate + translate the rig so that the headset's world pose
   * (camera world position + camera world forward) ends up at
   * `(spawn, lookAt)` regardless of the player's physical pose in
   * their VR play space.
   *
   * Returns true on success, false when no XR camera is available
   * (typical for the desktop boot path before VR has been entered).
   *
   * Math:
   *   1. Read head world pos H and head forward F (XZ-projected).
   *   2. Compute desired forward D = normalize((lookAt - spawn).xz).
   *   3. Solve for yaw θ such that R(θ)·F = D where R is rotation
   *      around +Y in three.js' right-handed convention:
   *        F' = ( cosθ·Fx + sinθ·Fz, _ , -sinθ·Fx + cosθ·Fz )
   *      → sinθ = Dx·Fz - Dz·Fx
   *        cosθ = Dx·Fx + Dz·Fz
   *        θ    = atan2(sinθ, cosθ)
   *   4. Rotate the rig by θ around the world-space head point H
   *      (translate-rotate-translate), then offset the rig by
   *      (spawn - H).xz so the head ends up exactly at spawn.
   *      Y is left at 0 because the headset Y is HMD-driven.
   */
  _recenterRigToFace(spawn, lookAt) {
    // Desktop mode (or VR not yet started): there's no real headset
    // pose to recenter against — let the caller fall back to dropping
    // the rig at the spawn point.
    if (!this.renderer?.xr?.isPresenting) return false;
    const xrCam = this.renderer.xr.getCamera?.();
    if (!xrCam) return false;

    // 1. Head world pose.
    xrCam.getWorldPosition(this._tmpHeadPos);
    xrCam.getWorldQuaternion(this._tmpQuat);
    this._tmpHeadFwd.set(0, 0, -1).applyQuaternion(this._tmpQuat);
    this._tmpHeadFwd.y = 0;
    if (this._tmpHeadFwd.lengthSq() < 1e-6) this._tmpHeadFwd.set(0, 0, -1);
    this._tmpHeadFwd.normalize();

    // 2. Desired forward (XZ).
    this._tmpDesired.subVectors(lookAt, spawn);
    this._tmpDesired.y = 0;
    if (this._tmpDesired.lengthSq() < 1e-6) this._tmpDesired.set(0, 0, -1);
    this._tmpDesired.normalize();

    // 3. Yaw from headFwd → desired (around +Y, three.js convention).
    const sin = this._tmpDesired.x * this._tmpHeadFwd.z -
                this._tmpDesired.z * this._tmpHeadFwd.x;
    const cos = this._tmpDesired.x * this._tmpHeadFwd.x +
                this._tmpDesired.z * this._tmpHeadFwd.z;
    const yaw = Math.atan2(sin, cos);

    // 4. Rotate the rig around the head point, then translate so the
    //    head world pos becomes the spawn point.
    const rig = this.playerGroup;
    const Hx = this._tmpHeadPos.x;
    const Hz = this._tmpHeadPos.z;
    rig.position.x -= Hx;
    rig.position.z -= Hz;
    rig.position.applyAxisAngle(this._tmpYAxis, yaw);
    rig.position.x += Hx;
    rig.position.z += Hz;
    rig.rotation.y += yaw;
    rig.position.x += (spawn.x - Hx);
    rig.position.z += (spawn.z - Hz);
    rig.position.y = 0;
    return true;
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
