// --- CarSim 3D 트럭 모델링 및 업데이트 매니저 ---

import { State } from './state.js';
import { WHEEL_RADIUS, START_Z } from './constants.js';

/**
 * 차선 번호에 따른 X 좌표 계산
 */
export function getLaneX(index, total) {
  if (total <= 1) return 0;
  const laneWidth = 3.5;
  return - (total - 1) * laneWidth / 2 + index * laneWidth;
}

/**
 * 학생용 정밀 3D 픽업 트럭 메쉬 조립
 */
export function createPickupTruck() {
  State.truckGroup = new THREE.Group();

  // 1. 차체 섀시 (어두운 금속 바닥)
  const chassisGeo = new THREE.BoxGeometry(2.3, 0.3, 5.2);
  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.4 });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.y = 0.45;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  State.truckGroup.add(chassis);

  // 2. 엔진 보닛 (앞코)
  const hoodGeo = new THREE.BoxGeometry(2.1, 0.75, 1.4);
  const bodyPaintMat = new THREE.MeshStandardMaterial({
    color: 0x00a8ff, // 메탈릭 브라이트 블루
    metalness: 0.8,
    roughness: 0.2
  });
  const hood = new THREE.Mesh(hoodGeo, bodyPaintMat);
  hood.position.set(0, 0.45 + 0.15 + 0.375, 1.8);
  hood.castShadow = true;
  hood.receiveShadow = true;
  State.truckGroup.add(hood);

  // 3. 운전석 캐빈 (Cab)
  const cabGeo = new THREE.BoxGeometry(2.0, 1.0, 1.8);
  const cab = new THREE.Mesh(cabGeo, bodyPaintMat);
  cab.position.set(0, 0.45 + 0.15 + 0.5, 0.3);
  cab.castShadow = true;
  cab.receiveShadow = true;
  State.truckGroup.add(cab);

  // 유리창 (유광 블랙 검정색 바)
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.1, metalness: 0.9 });

  // 앞 유리창
  const frontWindshield = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), glassMat);
  frontWindshield.position.set(0, 1.2, 1.21);
  frontWindshield.rotation.x = -Math.PI / 10;
  State.truckGroup.add(frontWindshield);

  // 옆면 창문들
  const leftWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), glassMat);
  leftWindow.position.set(-1.01, 1.15, 0.3);
  leftWindow.rotation.y = -Math.PI / 2;
  State.truckGroup.add(leftWindow);

  const rightWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), glassMat);
  rightWindow.position.set(1.01, 1.15, 0.3);
  rightWindow.rotation.y = Math.PI / 2;
  State.truckGroup.add(rightWindow);

  // 뒷창문
  const backWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), glassMat);
  backWindow.position.set(0, 1.15, -0.61);
  State.truckGroup.add(backWindow);

  // 3.5. 정지 기준 가로줄 (Stop Line - 교사용과 동일한 6m 노란색 라인)
  const stopLineGeo = new THREE.BoxGeometry(6.0, 0.02, 0.2);
  const stopLineMat = new THREE.MeshBasicMaterial({
    color: 0xffd600,       // 노란색
    depthWrite: false      // 지면 깜빡임 방지 보조
  });
  const stopLine = new THREE.Mesh(stopLineGeo, stopLineMat);
  stopLine.position.set(0, 0.015, 2.5); // 트럭 로컬 앞범퍼 기준 정렬
  State.truckGroup.add(stopLine);

  // 4. 전면 그릴 및 헤드라이트
  const grillGeo = new THREE.BoxGeometry(1.8, 0.4, 0.1);
  const grillMat = new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.9, roughness: 0.1 });
  const grill = new THREE.Mesh(grillGeo, grillMat);
  grill.position.set(0, 0.85, 2.51);
  State.truckGroup.add(grill);

  // 헤드라이트
  const headlightGeo = new THREE.BoxGeometry(0.3, 0.2, 0.05);
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfffacd });

  const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  leftHeadlight.position.set(-0.85, 0.9, 2.53);
  State.truckGroup.add(leftHeadlight);

  const rightHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
  rightHeadlight.position.set(0.85, 0.9, 2.53);
  State.truckGroup.add(rightHeadlight);

  // 5. 트럭 적재함 (Cargo Bed) 울타리 형태
  const bedWallMat = bodyPaintMat;

  // 바닥판
  const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 2.6), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }));
  bedFloor.position.set(0, 0.65, -1.9);
  bedFloor.receiveShadow = true;
  State.truckGroup.add(bedFloor);

  // 적재함 좌측 벽
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 2.6), bedWallMat);
  leftWall.position.set(-1.0, 0.95, -1.9);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  State.truckGroup.add(leftWall);

  // 적재함 우측 벽
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 2.6), bedWallMat);
  rightWall.position.set(1.0, 0.95, -1.9);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  State.truckGroup.add(rightWall);

  // 적재함 후면 문
  const tailGate = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.1), bedWallMat);
  tailGate.position.set(0, 0.95, -3.2);
  tailGate.castShadow = true;
  tailGate.receiveShadow = true;
  State.truckGroup.add(tailGate);

  // 6. 후미 브레이크등 (Brake Lights)
  const brakeLightGeo = new THREE.BoxGeometry(0.2, 0.25, 0.05);
  const initialBrakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x3a0000,
    emissive: 0x000000,
    roughness: 0.3
  });

  State.leftBrakeLight = new THREE.Mesh(brakeLightGeo, initialBrakeLightMat.clone());
  State.leftBrakeLight.position.set(-0.85, 0.95, -3.26);
  State.truckGroup.add(State.leftBrakeLight);

  State.rightBrakeLight = new THREE.Mesh(brakeLightGeo, initialBrakeLightMat.clone());
  State.rightBrakeLight.position.set(0.85, 0.95, -3.26);
  State.truckGroup.add(State.rightBrakeLight);

  // 7. 4개의 바퀴 (Wheels) 장착
  const wheelPositions = [
    { x: -1.15, y: 0.35, z: 1.5, isLeft: true },
    { x: 1.15, y: 0.35, z: 1.5, isLeft: false },
    { x: -1.15, y: 0.35, z: -1.6, isLeft: true },
    { x: 1.15, y: 0.35, z: -1.6, isLeft: false }
  ];

  const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.45, 24);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8, roughness: 0.2 });

  State.wheels = [];
  wheelPositions.forEach((pos) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(pos.x, pos.y, pos.z);

    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.47, 16), rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    const spoke1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.08), rimMat);
    spoke1.position.x = pos.isLeft ? -0.24 : 0.24;
    wheelGroup.add(spoke1);

    const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.65), rimMat);
    spoke2.position.x = pos.isLeft ? -0.24 : 0.24;
    wheelGroup.add(spoke2);

    State.truckGroup.add(wheelGroup);
    State.wheels.push(wheelGroup);
  });

  // 8. 짐 관리 그룹 생성
  State.cargoGroup = new THREE.Group();
  State.cargoGroup.position.set(0, 0.7, -1.9);
  State.truckGroup.add(State.cargoGroup);

  // 9. 초기 질량에 따른 짐 업데이트
  updateCargoBoxes(State.mass);

  State.scene.add(State.truckGroup);
}

/**
 * 질량 변화에 따라 적재함의 박스를 실시간 추가/감소시킵니다.
 */
export function updateCargoBoxes(currentMass) {
  if (!State.cargoGroup) return;

  while (State.cargoGroup.children.length > 0) {
    State.cargoGroup.remove(State.cargoGroup.children[0]);
  }

  const addedWeight = currentMass - 1000;
  const numBoxes = Math.min(16, Math.floor(addedWeight / 250));

  const boxSize = 0.45;
  const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0xcd853f,
    roughness: 0.9
  });

  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.7 });
  const tapeGeo = new THREE.BoxGeometry(0.08, 0.01, boxSize + 0.01);

  const boxSlots = [];
  for (let layer = 0; layer < 2; layer++) {
    const yOffset = (boxSize / 2) + layer * (boxSize + 0.02);
    for (let col = 0; col < 4; col++) {
      const zOffset = 0.9 - col * 0.6;
      for (let row = 0; row < 2; row++) {
        const xOffset = -0.45 + row * 0.9;
        boxSlots.push({ x: xOffset, y: yOffset, z: zOffset });
      }
    }
  }

  for (let i = 0; i < numBoxes; i++) {
    const slot = boxSlots[i];
    const singleBoxGroup = new THREE.Group();
    singleBoxGroup.position.set(slot.x, slot.y, slot.z);

    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    singleBoxGroup.add(boxMesh);

    const tapeMesh = new THREE.Mesh(tapeGeo, tapeMat);
    tapeMesh.position.y = boxSize / 2 + 0.005;
    singleBoxGroup.add(tapeMesh);

    singleBoxGroup.rotation.y = (Math.random() - 0.5) * 0.12;
    State.cargoGroup.add(singleBoxGroup);
  }
}

/**
 * 학생용 트럭 브레이크 등 활성화/비활성화
 */
export function setBrakeLightsActive(active) {
  if (!State.leftBrakeLight || !State.rightBrakeLight || !State.brakePointLight) return;

  if (active) {
    State.leftBrakeLight.material.color.setHex(0xff0000);
    State.leftBrakeLight.material.emissive.setHex(0xff0000);
    State.leftBrakeLight.material.emissiveIntensity = 3.0;

    State.rightBrakeLight.material.color.setHex(0xff0000);
    State.rightBrakeLight.material.emissive.setHex(0xff0000);
    State.rightBrakeLight.material.emissiveIntensity = 3.0;

    State.brakePointLight.color.setHex(0xff0000);
    State.brakePointLight.intensity = 4.0;
    if (State.truckGroup) {
      State.brakePointLight.position.set(0, 0.8, State.truckGroup.position.z - 3.3);
    }
  } else {
    State.leftBrakeLight.material.color.setHex(0x400000);
    State.leftBrakeLight.material.emissive.setHex(0x000000);
    State.leftBrakeLight.material.emissiveIntensity = 0;

    State.rightBrakeLight.material.color.setHex(0x400000);
    State.rightBrakeLight.material.emissive.setHex(0x000000);
    State.rightBrakeLight.material.emissiveIntensity = 0;

    State.brakePointLight.intensity = 0;
  }
}

/**
 * 교사용 다차선 InstancedMesh 구조체 생성
 */
export function setupTeacherInstancedTrucks(count) {
  if (State.instancedChassis) State.scene.remove(State.instancedChassis);
  if (State.instancedHood) State.scene.remove(State.instancedHood);
  if (State.instancedCab) State.scene.remove(State.instancedCab);
  if (State.instancedWheels) State.scene.remove(State.instancedWheels);
  if (State.instancedFakeShadows) State.scene.remove(State.instancedFakeShadows);
  if (State.instancedCargo) State.scene.remove(State.instancedCargo);
  if (State.instancedStopLines) State.scene.remove(State.instancedStopLines);

  const chassisGeo = new THREE.BoxGeometry(2.3, 0.3, 5.2);
  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.4 });
  State.instancedChassis = new THREE.InstancedMesh(chassisGeo, chassisMat, count);
  State.instancedChassis.castShadow = false;
  State.instancedChassis.receiveShadow = false;
  State.scene.add(State.instancedChassis);

  const hoodGeo = new THREE.BoxGeometry(2.1, 0.75, 1.4);
  const bodyPaintMat = new THREE.MeshStandardMaterial({ metalness: 0.8, roughness: 0.2 });
  State.instancedHood = new THREE.InstancedMesh(hoodGeo, bodyPaintMat, count);
  State.instancedHood.castShadow = false;
  State.instancedHood.receiveShadow = false;
  State.scene.add(State.instancedHood);

  const cabGeo = new THREE.BoxGeometry(2.0, 1.0, 1.8);
  State.instancedCab = new THREE.InstancedMesh(cabGeo, bodyPaintMat, count);
  State.instancedCab.castShadow = false;
  State.instancedCab.receiveShadow = false;
  State.scene.add(State.instancedCab);

  const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.45, 16);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
  State.instancedWheels = new THREE.InstancedMesh(tireGeo, tireMat, count * 4);
  State.instancedWheels.castShadow = false;
  State.instancedWheels.receiveShadow = false;
  State.scene.add(State.instancedWheels);

  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.3,
    depthWrite: false
  });
  State.instancedFakeShadows = new THREE.InstancedMesh(shadowGeo, shadowMat, count);
  State.scene.add(State.instancedFakeShadows);

  const boxSize = 0.45;
  const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xcd853f, roughness: 0.9 });
  State.instancedCargo = new THREE.InstancedMesh(boxGeo, boxMat, count * 16);
  State.instancedCargo.castShadow = false;
  State.instancedCargo.receiveShadow = false;
  State.scene.add(State.instancedCargo);

  // 교사용 차량 앞 정지 기준 가로줄 (Stop Line) Geometry: 폭 6.0m, 높이 0.02m, 두께 0.2m
  const stopLineGeo = new THREE.BoxGeometry(6.0, 0.02, 0.2);
  const stopLineMat = new THREE.MeshBasicMaterial({
    color: 0xffd600,       // 노란색으로 복구
    depthWrite: false      // 지면 깜빡임 방지 보조
  });
  State.instancedStopLines = new THREE.InstancedMesh(stopLineGeo, stopLineMat, count);
  State.scene.add(State.instancedStopLines);

  // 고유 색상 설정
  const colors = [0x00a8ff, 0xff1744, 0x00e676, 0xffea00, 0xd500f9, 0xff6d00, 0x00e5ff, 0xf50057];
  for (let i = 0; i < count; i++) {
    const color = new THREE.Color(colors[i % colors.length]);
    State.instancedChassis.setColorAt(i, color);
    State.instancedHood.setColorAt(i, color);
    State.instancedCab.setColorAt(i, color);
  }

  if (State.instancedChassis.instanceColor) State.instancedChassis.instanceColor.needsUpdate = true;
  if (State.instancedHood.instanceColor) State.instancedHood.instanceColor.needsUpdate = true;
  if (State.instancedCab.instanceColor) State.instancedCab.instanceColor.needsUpdate = true;

  // 꼬리표 DOM 생성 및 할당
  if (State.nameTagsContainer) State.nameTagsContainer.innerHTML = '';
  State.studentDomElements = {};
  State.activeStudents.forEach((student, index) => {
    const tag = document.createElement('div');
    tag.innerText = student.nickname;

    tag.style.position = 'absolute';
    tag.style.transform = 'translate(-50%, -100%)';
    const hexColor = colors[index % colors.length].toString(16).padStart(6, '0');
    tag.style.background = 'rgba(18, 22, 33, 0.92)';
    tag.style.border = `2px solid #${hexColor}`;
    tag.style.borderRadius = '20px';
    tag.style.padding = '4px 12px';
    tag.style.color = '#ffffff';
    tag.style.fontSize = '12px';
    tag.style.fontWeight = 'bold';
    tag.style.whiteSpace = 'nowrap';
    tag.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    tag.style.pointerEvents = 'none';
    tag.style.display = 'none';

    if (State.nameTagsContainer) State.nameTagsContainer.appendChild(tag);
    State.studentDomElements[student.id] = tag;
  });
}

/**
 * 교사용 다차선 트럭 및 화살표 매트릭스 업데이트
 */
export function updateInstancedTrucks() {
  if (!State.instancedChassis) return;

  const dummy = new THREE.Object3D();
  let boxIndex = 0;

  State.activeStudents.forEach((student, index) => {
    const zPos = State.studentCarPositions[student.id] !== undefined ? State.studentCarPositions[student.id] : START_Z;
    const xPos = getLaneX(index, State.activeStudents.length);

    // 1. Chassis
    dummy.position.set(xPos, 0.45, zPos);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    State.instancedChassis.setMatrixAt(index, dummy.matrix);

    // 2. Hood
    dummy.position.set(xPos, 0.45 + 0.15 + 0.375, zPos + 1.8);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    State.instancedHood.setMatrixAt(index, dummy.matrix);

    // 3. Cab
    dummy.position.set(xPos, 0.45 + 0.15 + 0.5, zPos + 0.3);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    State.instancedCab.setMatrixAt(index, dummy.matrix);

    // 4. Wheels (바퀴 회전)
    const distanceTravelled = zPos - START_Z;
    const rotationAngle = distanceTravelled / WHEEL_RADIUS;

    const wheelOffsets = [
      { x: -1.15, z: 1.5 },
      { x: 1.15, z: 1.5 },
      { x: -1.15, z: -1.6 },
      { x: 1.15, z: -1.6 }
    ];

    wheelOffsets.forEach((offset, wIdx) => {
      dummy.position.set(xPos + offset.x, 0.35, zPos + offset.z);
      dummy.rotation.set(rotationAngle, 0, Math.PI / 2);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      State.instancedWheels.setMatrixAt(index * 4 + wIdx, dummy.matrix);
    });

    // 5. Fake Shadow
    dummy.position.set(xPos, 0.012, zPos + 0.1);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(2.4, 5.4, 1);
    dummy.updateMatrix();
    State.instancedFakeShadows.setMatrixAt(index, dummy.matrix);

    // 6. 상자 짐
    const state = State.studentReadyStates[student.id] || { mass: 2500 };
    const addedWeight = state.mass - 1000;
    const numBoxes = Math.min(16, Math.floor(addedWeight / 250));

    const boxSize = 0.45;
    const boxSlots = [];
    for (let layer = 0; layer < 2; layer++) {
      const yOffset = 0.7 + (boxSize / 2) + layer * (boxSize + 0.02);
      for (let col = 0; col < 4; col++) {
        const zOffset = -1.9 + 0.9 - col * 0.6;
        for (let row = 0; row < 2; row++) {
          const xOffset = -0.45 + row * 0.9;
          boxSlots.push({ x: xOffset, y: yOffset, z: zOffset });
        }
      }
    }

    for (let bIdx = 0; bIdx < 16; bIdx++) {
      if (bIdx < numBoxes) {
        const slot = boxSlots[bIdx];
        dummy.position.set(xPos + slot.x, slot.y, zPos + slot.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        State.instancedCargo.setMatrixAt(boxIndex, dummy.matrix);
      } else {
        dummy.position.set(0, -999, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        State.instancedCargo.setMatrixAt(boxIndex, dummy.matrix);
      }
      boxIndex++;
    }
  });

  State.instancedChassis.instanceMatrix.needsUpdate = true;
  State.instancedHood.instanceMatrix.needsUpdate = true;
  State.instancedCab.instanceMatrix.needsUpdate = true;
  State.instancedWheels.instanceMatrix.needsUpdate = true;
  State.instancedFakeShadows.instanceMatrix.needsUpdate = true;
  State.instancedCargo.instanceMatrix.needsUpdate = true;

  // 7. 정지 가로줄(StopLine) 위치 갱신 (트럭 앞 범퍼 끝단 정렬)
  if (State.instancedStopLines) {
    State.activeStudents.forEach((student, index) => {
      const zPos = State.studentCarPositions[student.id] !== undefined ? State.studentCarPositions[student.id] : START_Z;
      const xPos = getLaneX(index, State.activeStudents.length);
      dummy.position.set(xPos, 0.015, zPos + 2.5); // X=xPos(차선 한가운데), Y=0.015(노면보다 약간 위), Z=zPos+2.5(앞범퍼 정렬)
      dummy.rotation.set(0, 0, 0); // BoxGeometry 이므로 회전 필요 없음
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      State.instancedStopLines.setMatrixAt(index, dummy.matrix);
    });
    State.instancedStopLines.instanceMatrix.needsUpdate = true;
  }
}
