// --- CarSim 3D 그래픽스 및 환경 매니저 ---

import { State } from './state.js';
import { START_Z, BRAKE_Z } from './constants.js';

/**
 * Three.js 씬, 카메라, 렌더러, 라이트를 초기화하고 State에 등록합니다.
 * @param {HTMLElement} container 3D 캔버스가 들어갈 부모 컨테이너
 */
export function initScene(container) {
  // 1. 씬 (Scene) 설정
  State.scene = new THREE.Scene();
  State.scene.background = new THREE.Color(0xbae1ff); // 밝고 청량한 하늘색
  State.scene.fog = new THREE.FogExp2(0xbae1ff, 0.0035); // 하늘빛 안개

  // 2. 카메라 (Camera) 설정
  State.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);

  // 3. 렌더러 (Renderer) 설정
  State.renderer = new THREE.WebGLRenderer({ antialias: true });
  State.renderer.setSize(container.clientWidth, container.clientHeight);
  State.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 성능 최적화: 초고해상도 기기에서 픽셀 레이쇼 상한을 1.5로 하향
  State.renderer.shadowMap.enabled = true;
  State.renderer.shadowMap.type = THREE.PCFShadowMap; // 성능 최적화: PCFShadowMap 적용
  container.appendChild(State.renderer.domElement);

  // 4. 마우스 컨트롤 (OrbitControls) 설정
  State.controls = new THREE.OrbitControls(State.camera, State.renderer.domElement);
  State.controls.enableDamping = true;
  State.controls.dampingFactor = 0.05;
  State.controls.maxPolarAngle = Math.PI / 2 - 0.05; // 땅밑으로 카메라가 내려가지 않도록 차단
  State.controls.minDistance = 5;
  State.controls.maxDistance = 80;

  // 5. 조명 (Lighting)
  const ambientLight = new THREE.AmbientLight(0xe0f2fe, 0.9); // 밝은 주간 하늘색 앰비언트광
  State.scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.3); // 눈부신 백색 태양광
  sunLight.position.set(-30, 40, -10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024); // 성능 최적화: 그림자 맵 해상도 1024로 하향
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 150;

  // 그림자 영역 조절 (픽업 트럭 이동 경로 커버)
  const d = 40;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  State.scene.add(sunLight);

  // 차량 제동 시 후미등 불빛을 바닥에 비추기 위한 포인트 라이트
  State.brakePointLight = new THREE.PointLight(0xff0000, 0, 10);
  State.scene.add(State.brakePointLight);

  // 환경 그룹 초기화 및 추가
  State.environmentGroup = new THREE.Group();
  State.scene.add(State.environmentGroup);
}

/**
 * 창 크기 변경에 따른 뷰포트 반응형 제어
 * @param {HTMLElement} container 3D 캔버스가 들어간 부모 컨테이너
 */
export function handleWindowResize(container) {
  if (!State.camera || !State.renderer) return;
  State.camera.aspect = container.clientWidth / container.clientHeight;
  State.camera.updateProjectionMatrix();
  State.renderer.setSize(container.clientWidth, container.clientHeight);
}

/**
 * 도로 노면 글씨 텍스처 생성 헬퍼
 */
function createRoadTextTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 2048, 256);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 110px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineWidth = 20;

  const xPos = 2048 - 80;
  ctx.strokeText(text, xPos, 128);
  ctx.fillText(text, xPos, 128);

  return new THREE.CanvasTexture(canvas);
}

/**
 * 텍스트 표지판 생성 헬퍼
 */
export function createSignpost(text, textColorHex, borderColorHex, scale = 1.0) {
  const group = new THREE.Group();

  // 지지대 쇠기둥
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.2 * scale, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 });
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.y = (2.2 * scale) / 2;
  post.castShadow = true;
  group.add(post);

  // 표지판 뒷면 판데기
  const boardWidth = 1.6 * scale;
  const boardHeight = 0.9 * scale;
  const boardGeo = new THREE.BoxGeometry(boardWidth, boardHeight, 0.06);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = (2.2 * scale) - (boardHeight / 2);
  board.castShadow = true;
  group.add(board);

  // 2D 캔버스로 글자 쓰기
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(0, 0, 256, 128);

  ctx.strokeStyle = borderColorHex;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px "Outfit", "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const labelGeo = new THREE.PlaneGeometry(boardWidth - 0.05, boardHeight - 0.05);
  const labelMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });

  const labelFront = new THREE.Mesh(labelGeo, labelMat);
  labelFront.position.set(0, board.position.y, 0.035);
  group.add(labelFront);

  const labelBack = new THREE.Mesh(labelGeo, labelMat);
  labelBack.position.set(0, board.position.y, -0.035);
  labelBack.rotation.y = Math.PI;
  group.add(labelBack);

  return group;
}

/**
 * 가로등 생성 헬퍼
 */
function createStreetLight(x, z, rotateLeft = false) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const poleHeight = 6.0;
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.14, poleHeight, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = poleHeight / 2;
  pole.castShadow = true;
  group.add(pole);

  const armLength = 2.0;
  const armGeo = new THREE.CylinderGeometry(0.05, 0.05, armLength, 8);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(rotateLeft ? -armLength / 2 : armLength / 2, poleHeight, 0);
  group.add(arm);

  const headGeo = new THREE.BoxGeometry(0.6, 0.15, 0.4);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(rotateLeft ? -armLength : armLength, poleHeight - 0.05, 0);
  group.add(head);

  const lightSourceGeo = new THREE.BoxGeometry(0.5, 0.02, 0.3);
  const lightSourceMat = new THREE.MeshBasicMaterial({ color: 0xfffee6 });
  const lightSource = new THREE.Mesh(lightSourceGeo, lightSourceMat);
  lightSource.position.set(rotateLeft ? -armLength : armLength, poleHeight - 0.13, 0);
  group.add(lightSource);

  State.environmentGroup.add(group);
}

/**
 * 나무 인스턴싱 생성 헬퍼 (THREE.InstancedMesh 적용)
 */
function createInstancedTrees(currentRoadWidth = 10) {
  const roadWidth = currentRoadWidth;
  const treePositions = [];

  for (let z = -60; z < 300; z += 15) {
    const heightScaleL = 0.8 + Math.random() * 0.5;
    const xL = -roadWidth / 2 - 3 - Math.random() * 4;
    const zL = z + (Math.random() - 0.5) * 5;
    const leavesColors = [0x2e7d32, 0x388e3c, 0x4caf50];
    const colorL = new THREE.Color(leavesColors[Math.floor(Math.random() * leavesColors.length)]);

    treePositions.push({ x: xL, y: 0, z: zL, scale: heightScaleL, color: colorL });

    const heightScaleR = 0.8 + Math.random() * 0.5;
    const xR = roadWidth / 2 + 3 + Math.random() * 4;
    const zR = z + (Math.random() - 0.5) * 5;
    const colorR = new THREE.Color(leavesColors[Math.floor(Math.random() * leavesColors.length)]);

    treePositions.push({ x: xR, y: 0, z: zR, scale: heightScaleR, color: colorR });
  }

  const count = treePositions.length;

  const baseTrunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.0, 8);
  baseTrunkGeo.translate(0, 0.5, 0);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const trunkInstancedMesh = new THREE.InstancedMesh(baseTrunkGeo, trunkMat, count);
  trunkInstancedMesh.castShadow = true;
  trunkInstancedMesh.receiveShadow = true;

  const baseLeavesGeo = new THREE.ConeGeometry(1.0, 1.0, 7);
  baseLeavesGeo.translate(0, 0.5, 0);

  const leavesMat = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    flatShading: true
  });
  const leavesInstancedMesh = new THREE.InstancedMesh(baseLeavesGeo, leavesMat, count * 3);
  leavesInstancedMesh.castShadow = true;
  leavesInstancedMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i++) {
    const tree = treePositions[i];
    const trunkHeight = 1.0 * tree.scale;

    dummy.position.set(tree.x, tree.y, tree.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, trunkHeight, 1);
    dummy.updateMatrix();
    trunkInstancedMesh.setMatrixAt(i, dummy.matrix);

    for (let layer = 0; layer < 3; layer++) {
      const coneRadius = (0.9 - layer * 0.2) * tree.scale;
      const coneHeight = (1.1 - layer * 0.1) * tree.scale;
      const coneY = trunkHeight + (layer * 0.7 * tree.scale);

      dummy.position.set(tree.x, tree.y + coneY, tree.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(coneRadius, coneHeight, coneRadius);
      dummy.updateMatrix();

      const leafIndex = i * 3 + layer;
      leavesInstancedMesh.setMatrixAt(leafIndex, dummy.matrix);
      leavesInstancedMesh.setColorAt(leafIndex, tree.color);
    }
  }

  trunkInstancedMesh.instanceMatrix.needsUpdate = true;
  leavesInstancedMesh.instanceMatrix.needsUpdate = true;
  if (leavesInstancedMesh.instanceColor) {
    leavesInstancedMesh.instanceColor.needsUpdate = true;
  }

  State.environmentGroup.add(trunkInstancedMesh);
  State.environmentGroup.add(leavesInstancedMesh);
}

/**
 * 다차선 환경 재구성 (교사용 다차선 및 학생 1차선 겸용)
 * @param {number} numLanes 차선 수
 */
export function rebuildEnvironment(numLanes = 1) {
  if (State.environmentGroup) {
    while (State.environmentGroup.children.length > 0) {
      const obj = State.environmentGroup.children[0];
      State.environmentGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
  }

  const roadWidth = numLanes === 1 ? 10 : numLanes * 3.5 + 4;
  const roadLength = 400;

  // 0. 넓은 초록색 잔디밭 지면
  const groundGeo = new THREE.PlaneGeometry(1000, 1000);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x7da87b,
    roughness: 0.95,
    metalness: 0.1
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  State.environmentGroup.add(ground);

  // 1. 대형 바닥 그리드
  const gridHelper = new THREE.GridHelper(1000, 100, 0x648a61, 0x99bda8);
  gridHelper.position.y = -0.01;
  State.environmentGroup.add(gridHelper);

  // 2. 아스팔트 도로
  const roadGeo = new THREE.BoxGeometry(roadWidth, 0.1, roadLength);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x2b323c,
    roughness: 0.85
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.position.set(0, -0.05, roadLength / 2 - 50);
  road.receiveShadow = true;
  State.environmentGroup.add(road);

  // 3. 중앙 점선 및 갓길 실선
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });

  const leftLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, roadLength), yellowLineMat);
  leftLine.rotation.x = -Math.PI / 2;
  leftLine.position.set(-roadWidth / 2 + 0.3, 0.01, roadLength / 2 - 50);
  State.environmentGroup.add(leftLine);

  const rightLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, roadLength), yellowLineMat);
  rightLine.rotation.x = -Math.PI / 2;
  rightLine.position.set(roadWidth / 2 - 0.3, 0.01, roadLength / 2 - 50);
  State.environmentGroup.add(rightLine);

  if (numLanes === 1) {
    for (let z = -50; z < 350; z += 8) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 4), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.01, z + 2);
      State.environmentGroup.add(dash);
    }
  } else {
    for (let i = 1; i < numLanes; i++) {
      const laneX = - (numLanes * 3.5) / 2 + i * 3.5;
      for (let z = -50; z < 350; z += 8) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 4), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(laneX, 0.01, z + 2);
        State.environmentGroup.add(dash);
      }
    }
  }

  // 4. 브레이크 시작선
  const brakeLineMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00a3cc,
    emissiveIntensity: 0.8,
    roughness: 0.2
  });
  const brakeLine = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.02, 0.15), brakeLineMat);
  brakeLine.position.set(0, 0.01, BRAKE_Z);
  brakeLine.receiveShadow = true;
  State.environmentGroup.add(brakeLine);

  // 도로 노면 글씨
  const roadTextTexture = createRoadTextTexture("명인중학교 VR 실험실");
  const roadTextGeo = new THREE.PlaneGeometry(40, 4.2);
  const roadTextMat = new THREE.MeshBasicMaterial({
    map: roadTextTexture,
    transparent: true,
    depthWrite: false
  });
  State.roadText = new THREE.Mesh(roadTextGeo, roadTextMat);
  State.roadText.rotation.x = -Math.PI / 2;
  State.roadText.rotation.z = -Math.PI / 2;

  const textX = numLanes === 1 ? -2.8 : 0;
  State.roadText.position.set(textX, 0.012, State.targetDistance - 18.4);
  State.environmentGroup.add(State.roadText);

  // START 표지판
  const startSign = createSignpost("START", 0xffffff, "#00e5ff");
  startSign.position.set(roadWidth / 2 + 1.5, 0, BRAKE_Z);
  State.environmentGroup.add(startSign);

  // 5. 목표 정지선 (빨간선)
  const redLineMat = new THREE.MeshStandardMaterial({
    color: 0xff1744,
    emissive: 0xaa0012,
    emissiveIntensity: 0.5,
    roughness: 0.6
  });
  State.redLineMesh = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.02, 0.15), redLineMat);
  State.redLineMesh.position.set(0, 0.01, State.targetDistance);
  State.redLineMesh.receiveShadow = true;
  State.environmentGroup.add(State.redLineMesh);

  // GOAL 표지판
  State.redLineSignpost = createSignpost("GOAL", 0xffffff, "#ff1744");
  State.redLineSignpost.position.set(roadWidth / 2 + 1.5, 0, State.targetDistance);
  State.environmentGroup.add(State.redLineSignpost);

  // 6. 10m 단위 알림판 및 가이드라인
  State.signboardMarkers = [];
  for (let d = 10; d <= 200; d += 10) {
    const guideLine = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth - 1, 0.05), new THREE.MeshBasicMaterial({ color: 0xcbd5e1 }));
    guideLine.rotation.x = -Math.PI / 2;
    guideLine.position.set(0, 0.005, d);
    State.environmentGroup.add(guideLine);

    const sign = createSignpost(`${d}m`, 0x94a3b8, "#475569", 0.7);
    sign.position.set(roadWidth / 2 + 1.2, 0, d);
    State.environmentGroup.add(sign);
    State.signboardMarkers.push({ mesh: sign, distance: d });
  }

  // 7. 가로등 배치
  for (let z = -30; z <= 240; z += 40) {
    createStreetLight(roadWidth / 2 + 0.8, z, false);
    createStreetLight(-roadWidth / 2 - 0.8, z + 20, true);
  }

  // 8. 나무 배치
  createInstancedTrees(roadWidth);
}
