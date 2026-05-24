// --- CarSim 메인 엔트리 스크립트 (Orchestrator) ---

import { State, CAMERA_OFFSETS } from './js/state.js';
import { START_Z, BRAKE_Z, WHEEL_RADIUS } from './js/constants.js';
import { getDeceleration, getStopTime, getBrakingPositionZ, getBrakingSpeed } from './js/physics.js';
import { initScene, handleWindowResize, rebuildEnvironment } from './js/graphics.js';
import { getLaneX, createPickupTruck, updateCargoBoxes, setBrakeLightsActive, setupTeacherInstancedTrucks, updateInstancedTrucks } from './js/trucks.js';
import { supabaseClient, isConnected, deleteSession, insertSession, updateSessionSettings, updateSessionStatus, insertResult, fetchSession } from './js/supabase.js';
import {
  safeSetDisabled,
  safeSetText,
  safeSetHTML,
  safeSetStyleDisplay,
  safeSetStyleWidth,
  updateDashboard,
  showResultModal,
  closeResultModal,
  showTargetModal,
  closeTargetModal,
  updateStudentLobbyUI,
  updateTeacherReadyStatus,
  updateTeacherCollectionStatus,
  updateLeaderboardUI,
  toggleInputs,
  setupUIEventListeners
} from './js/ui.js';

// --- 앱 초기화 ---
function init() {
  const container = document.getElementById('canvas-container');

  // 1. 3D 그래픽스 초기화 (Scene, Camera, Renderer 등)
  initScene(container);

  // 1.5. 기본 1차선 도로 노면 및 환경 구축
  rebuildEnvironment(1);

  // 2. 단일 주행용 픽업 트럭 생성
  createPickupTruck();

  // 3. 카메라 초기 위치 설정
  resetCamera();

  // 4. UI 이벤트 리스너 등록
  setupUIEventListeners();

  // 5. 첫 챌린지 생성 및 초기화
  generateNewChallenge();

  // 6. 브라우저 리사이즈 대응 및 애니메이션 루프 시작
  window.addEventListener('resize', () => handleWindowResize(container));
  State.clock = new THREE.Clock();
  State.renderer.setAnimationLoop(update);
}

// --- 카메라 기본 위치 리셋 ---
function resetCamera() {
  if (!State.truckGroup || !State.camera || !State.controls) return;
  State.truckGroup.position.set(0, 0, START_Z);

  // 3/4 뒷모습 오프셋 적용
  const offset = new THREE.Vector3(CAMERA_OFFSETS.rear.x, CAMERA_OFFSETS.rear.y, CAMERA_OFFSETS.rear.z);
  State.camera.position.copy(State.truckGroup.position).add(offset);
  State.controls.enabled = true;
  State.controls.target.set(0, 0.8, START_Z + 1.5);
  State.controls.update();
}

// --- 챌린지용 새로운 목표 생성 ---
function generateNewChallenge() {
  if (State.simulationState !== 'idle' && State.simulationState !== 'stopped') return;

  // 25m에서 95m 사이의 임의 정수 생성
  State.targetDistance = Math.floor(Math.random() * (95 - 25 + 1)) + 25;

  // 빨간 목표선 Z 위치 업데이트
  if (State.redLineMesh) State.redLineMesh.position.z = State.targetDistance;
  if (State.redLineSignpost) State.redLineSignpost.position.set(10 / 2 + 1.5, 0, State.targetDistance);
  if (State.roadText) State.roadText.position.z = State.targetDistance - 18.4;

  safeSetText('target-distance-value', State.targetDistance.toFixed(1));

  // 안내 모달 팝업 노출
  showTargetModal(State.targetDistance);

  resetSimulation();
}

// --- 시뮬레이션 출발 ---
function startSimulation() {
  if (State.simulationState !== 'idle') return;

  closeTargetModal();
  toggleInputs(true);

  State.simulationState = 'driving';
  State.initialSpeedMps = State.initialSpeedKmh / 3.6;
  State.currentSpeedMps = State.initialSpeedMps;
  State.brakingElapsedTime = 0;

  // 카메라 조작 락
  State.controls.enabled = false;

  safeSetDisabled('btn-start', true);
  safeSetDisabled('btn-reset', false);
  safeSetDisabled('btn-new-target', true);

  safeSetStyleDisplay('result-box', 'none');
  State.clock.getDelta();
}

// --- 시뮬레이션 정지 및 원상 복구 ---
function resetSimulation() {
  State.simulationState = 'idle';
  State.currentSpeedMps = 0;

  closeResultModal();
  setBrakeLightsActive(false);

  safeSetText('actual-distance-value', '0.0');
  safeSetStyleDisplay('result-box', 'none');

  resetCamera();
  toggleInputs(false);

  safeSetDisabled('btn-start', false);
  safeSetDisabled('btn-reset', true);
  safeSetDisabled('btn-new-target', false);

  updateDashboard();
  showTargetModal(State.targetDistance);
}

// --- 제동 완수 및 결과 판정 ---
function showResults() {
  const finalDistance = State.truckGroup.position.z + 2.5; // 앞 범퍼 기준 제동 거리
  safeSetText('actual-distance-value', finalDistance.toFixed(2));

  // 카메라 조작 해제
  State.controls.target.copy(State.truckGroup.position).add(new THREE.Vector3(0, 0.8, 1.5));
  State.controls.enabled = true;
  State.controls.update();

  const diff = finalDistance - State.targetDistance;
  const absDiff = Math.abs(diff);

  const resultBox = document.getElementById('result-box');
  if (resultBox) {
    if (absDiff <= 0.6) {
      resultBox.className = 'result-box success';
      safeSetText('result-title', '🎯 미션 성공!');
      safeSetHTML('result-desc', `목표: ${State.targetDistance.toFixed(1)}m | 실제 제동: ${finalDistance.toFixed(2)}m<br>오차: <span style="font-weight:700; color:#4caf50;">${diff >= 0 ? '+' : ''}${diff.toFixed(2)}m</span>`);
    } else {
      resultBox.className = 'result-box fail';
      if (diff > 0) {
        safeSetText('result-title', '💥 정지선 초과 (오버런)');
        safeSetHTML('result-desc', `목표를 <span style="font-weight:700;">${diff.toFixed(2)}m</span> 초과했습니다.`);
      } else {
        safeSetText('result-title', '⚠️ 제동 거리 미달 (조기 정지)');
        safeSetHTML('result-desc', `목표보다 <span style="font-weight:700;">${Math.abs(diff).toFixed(2)}m</span> 덜 갔습니다.`);
      }
    }
    resultBox.style.display = 'block';
  }

  updateDashboard(0);

  if (State.isMultiplayer) {
    reportStudentResult(finalDistance, diff);
  } else {
    showResultModal(finalDistance, State.targetDistance, diff, absDiff);
  }
}

// --- 메인 업데이트 루프 (애니메이션 프레임) ---
function update() {
  let dt = State.clock.getDelta();
  if (dt > 0.05) dt = 0.05; // 캡핑

  if (State.userRole === 'teacher') {
    updateTeacherPhysics(dt);
  } else {
    if (State.simulationState === 'driving') {
      State.truckGroup.position.z += State.initialSpeedMps * dt;

      // 바퀴 회전
      const wheelRotSpeed = State.initialSpeedMps / WHEEL_RADIUS;
      State.wheels.forEach(w => w.rotation.x += wheelRotSpeed * dt);

      // 카메라 뷰 스윕 보간
      const progress = Math.max(0, Math.min(1, (State.truckGroup.position.z - START_Z) / (BRAKE_Z - 2.5 - START_Z)));
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2; // easeInOutQuad
      
      const offsetRearVec = new THREE.Vector3(CAMERA_OFFSETS.rear.x, CAMERA_OFFSETS.rear.y, CAMERA_OFFSETS.rear.z);
      const offsetSideVec = new THREE.Vector3(CAMERA_OFFSETS.side.x, CAMERA_OFFSETS.side.y, CAMERA_OFFSETS.side.z);
      const currentOffset = new THREE.Vector3().lerpVectors(offsetRearVec, offsetSideVec, eased);
      State.camera.position.copy(State.truckGroup.position).add(currentOffset);

      const targetLook = State.truckGroup.position.clone().add(new THREE.Vector3(0, 0.8, 1.5));
      State.camera.lookAt(targetLook);

      // 브레이크 라인 진입 감지
      if (State.truckGroup.position.z + 2.5 >= BRAKE_Z) {
        State.truckGroup.position.z = BRAKE_Z - 2.5;
        State.simulationState = 'braking';
        setBrakeLightsActive(true);
        updateDashboard();
      }
    }
    else if (State.simulationState === 'braking') {
      const deceleration = getDeceleration(State.mass);
      State.brakingElapsedTime += dt;

      const t = State.brakingElapsedTime;
      const stopTime = getStopTime(State.initialSpeedMps, deceleration);

      if (t >= stopTime) {
        // 완전 정차
        State.truckGroup.position.z = (Math.pow(State.initialSpeedMps, 2) / (2 * deceleration)) - 2.5;
        State.currentSpeedMps = 0;
        State.simulationState = 'stopped';
        showResults();
      } else {
        // 제동 감속 공식
        State.truckGroup.position.z = getBrakingPositionZ(State.initialSpeedMps, deceleration, t);
        State.currentSpeedMps = getBrakingSpeed(State.initialSpeedMps, deceleration, t);

        // 바퀴 감속 회전
        const wheelRotSpeed = State.currentSpeedMps / WHEEL_RADIUS;
        State.wheels.forEach(w => w.rotation.x += wheelRotSpeed * dt);

        safeSetText('actual-distance-value', (State.truckGroup.position.z + 2.5).toFixed(2));
        updateDashboard(State.currentSpeedMps * 3.6);
      }

      // 사이드 뷰 고정
      const offsetSideVec = new THREE.Vector3(CAMERA_OFFSETS.side.x, CAMERA_OFFSETS.side.y, CAMERA_OFFSETS.side.z);
      State.camera.position.copy(State.truckGroup.position).add(offsetSideVec);
      State.camera.lookAt(State.truckGroup.position.clone().add(new THREE.Vector3(0, 0.8, 1.5)));

      if (State.simulationState === 'braking' && State.brakePointLight) {
        State.brakePointLight.position.set(0, 0.8, State.truckGroup.position.z - 3.3);
      }
    }
    else {
      State.controls.update();
    }
  }

  State.renderer.render(State.scene, State.camera);
}

// --- 교사용 실시간 물리학 프레임 업데이트 ---
function updateTeacherPhysics(dt) {
  if (State.simulationState === 'idle') {
    State.controls.update();
    updateInstancedTrucks();
    updateStudentNameTags();
    return;
  }

  let allStopped = true;

  State.activeStudents.forEach((student) => {
    const state = State.studentReadyStates[student.id] || { mass: 1500, speed: 50 };
    const initialSpeedMps = state.speed / 3.6;
    const deceleration = getDeceleration(state.mass);

    let curState = State.studentCarStates[student.id] || 'idle';
    let curZ = State.studentCarPositions[student.id] !== undefined ? State.studentCarPositions[student.id] : START_Z;
    let curSpeed = State.studentCarSpeeds[student.id] !== undefined ? State.studentCarSpeeds[student.id] : initialSpeedMps;
    let curTime = State.studentCarTimes[student.id] || 0;

    if (curState === 'driving') {
      allStopped = false;
      curZ += initialSpeedMps * dt;

      if (curZ + 2.5 >= BRAKE_Z) {
        curZ = BRAKE_Z - 2.5;
        curState = 'braking';
        curTime = 0;
      }
    } else if (curState === 'braking') {
      allStopped = false;
      curTime += dt;
      const stopTime = getStopTime(initialSpeedMps, deceleration);

      if (curTime >= stopTime) {
        curZ = (Math.pow(initialSpeedMps, 2) / (2 * deceleration)) - 2.5;
        curSpeed = 0;
        curState = 'stopped';

        // 리더보드 결과 누적
        const finalDistance = curZ + 2.5;
        const offset = finalDistance - State.targetDistance;
        addStudentResult({
          studentId: student.id,
          nickname: student.nickname,
          mass: state.mass,
          speed: state.speed,
          actualDistance: finalDistance,
          offsetDistance: offset
        });
      } else {
        curZ = getBrakingPositionZ(initialSpeedMps, deceleration, curTime);
        curSpeed = getBrakingSpeed(initialSpeedMps, deceleration, curTime);
      }
    }

    State.studentCarStates[student.id] = curState;
    State.studentCarPositions[student.id] = curZ;
    State.studentCarSpeeds[student.id] = curSpeed;
    State.studentCarTimes[student.id] = curTime;
  });

  updateInstancedTrucks();
  updateStudentNameTags();

  let totalZ = 0;
  State.activeStudents.forEach(student => {
    totalZ += State.studentCarPositions[student.id] !== undefined ? State.studentCarPositions[student.id] : START_Z;
  });
  const avgZ = State.activeStudents.length > 0 ? (totalZ / State.activeStudents.length) : START_Z;

  const roadWidth = State.activeStudents.length === 1 ? 10 : State.activeStudents.length * 3.5 + 4;
  const camX = - (roadWidth / 2 + 18);
  const camY = 12;

  if (State.simulationState === 'driving' || State.simulationState === 'braking') {
    State.camera.position.set(camX, camY, avgZ + 5);
    State.camera.lookAt(new THREE.Vector3(0, 1.5, avgZ));
    State.controls.target.set(0, 1.5, avgZ);
  } else {
    State.controls.update();
  }

  // 모든 차량이 멈췄을 때 리더보드 전환
  if (allStopped && State.activeStudents.length > 0 && (State.simulationState === 'driving' || State.simulationState === 'braking')) {
    State.simulationState = 'stopped';
    safeSetStyleDisplay('teacher-active', 'none');
    safeSetStyleDisplay('teacher-leaderboard-section', 'flex');

    State.controls.enabled = true;
    State.controls.target.set(0, 1.5, avgZ);
    State.controls.update();
  }
}

// --- 교사용 학생 이름표 2D 오버레이 갱신 ---
function updateStudentNameTags() {
  if (State.userRole !== 'teacher' || State.activeStudents.length === 0 || !State.nameTagsContainer) {
    if (State.nameTagsContainer) State.nameTagsContainer.style.display = 'none';
    return;
  }
  State.nameTagsContainer.style.display = 'block';

  const widthHalf = State.renderer.domElement.clientWidth / 2;
  const heightHalf = State.renderer.domElement.clientHeight / 2;
  const tempV = new THREE.Vector3();

  State.activeStudents.forEach((student, index) => {
    const domEl = State.studentDomElements[student.id];
    if (!domEl) return;

    const zPos = State.studentCarPositions[student.id] !== undefined ? State.studentCarPositions[student.id] : START_Z;
    const xPos = getLaneX(index, State.activeStudents.length);

    tempV.set(xPos, 2.8, zPos);
    tempV.project(State.camera);

    if (tempV.z > 1) {
      domEl.style.display = 'none';
      return;
    }

    const x = (tempV.x * widthHalf) + widthHalf;
    const y = -(tempV.y * heightHalf) + heightHalf;

    domEl.style.display = 'block';
    domEl.style.left = `${x}px`;
    domEl.style.top = `${y}px`;
  });
}

// --- 실시간 멀티플레이어 채널 바인딩 및 세션 제어 ---
let realtimeChannel = null;

function selectRole(role) {
  State.userRole = role;
  State.isMultiplayer = true;
  safeSetStyleDisplay('role-overlay', 'none');
  safeSetStyleDisplay('main-ui', 'grid');

  if (role === 'teacher') {
    safeSetStyleDisplay('teacher-panel', 'flex');
    safeSetStyleDisplay('student-panel', 'none');
    if (State.truckGroup) State.truckGroup.visible = false;

    initTeacherSession();
  } else {
    safeSetStyleDisplay('teacher-panel', 'none');
    safeSetStyleDisplay('student-panel', 'flex');
    safeSetStyleDisplay('student-login-overlay', 'flex');
  }
}

async function initTeacherSession() {
  if (!isConnected()) {
    alert("수파베이스가 연결되지 않았습니다.");
    return;
  }

  try {
    // 1. 해당 PIN의 기존 세션이 있는지 먼저 조회 (SELECT는 anon 허용)
    const existingSession = await fetchSession(State.sessionPin);

    if (existingSession) {
      // 2-A. 세션이 이미 존재하면 DELETE 권한 부족을 고려하여 지우지 않고 바로 LOBBY 상태로 업데이트(리셋)
      await updateSessionSettings(State.sessionPin, State.targetDistance, State.controlMode);
      await updateSessionStatus(State.sessionPin, 'LOBBY');
    } else {
      // 2-B. 세션이 존재하지 않을 때만 최초 1회 신규 등록 (INSERT)
      const { error } = await insertSession(State.sessionPin, State.targetDistance, State.controlMode);
      if (error) {
        console.warn("기본 PIN 신규 등록 실패:", error);
      }
    }

    safeSetText('teacher-pin-value', State.sessionPin);
    setupTeacherRealtime();
    setControlMode('BOTH');

  } catch (err) {
    console.error("세션 등록 오류:", err);
  }
}

function setupTeacherRealtime() {
  realtimeChannel = supabaseClient.channel(`room_${State.sessionPin}`, {
    config: { presence: { key: State.sessionPin } }
  });

  realtimeChannel
    .on('presence', { event: 'sync' }, () => {
      const state = realtimeChannel.presenceState();
      State.students = [];
      Object.keys(state).forEach(key => {
        state[key].forEach(p => {
          if (p.role === 'student') {
            State.students.push({ id: p.id, nickname: p.nickname });
          }
        });
      });
      updateStudentLobbyUI();
    })
    .on('broadcast', { event: 'student-ready' }, ({ payload }) => {
      State.studentReadyStates[payload.studentId] = {
        mass: payload.mass,
        speed: payload.speed,
        isReady: payload.isReady
      };
      if (State.isCollectingData) {
        State.collectedStudentIds.add(payload.studentId);
        updateTeacherCollectionStatus();
        if (State.collectedStudentIds.size >= State.activeStudents.length) {
          if (State.collectionTimeout) {
            clearTimeout(State.collectionTimeout);
            State.collectionTimeout = null;
          }
          proceedActualLaunch();
        }
      } else {
        updateTeacherReadyStatus();
      }
    })
    .on('broadcast', { event: 'student-result' }, ({ payload }) => {
      addStudentResult(payload);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await realtimeChannel.track({ role: 'teacher', id: 'teacher' });
      }
    });
}

function updateTeacherTargetDist(val) {
  State.targetDistance = parseFloat(val);
  safeSetText('teacher-target-val-label', `${State.targetDistance.toFixed(1)}m`);

  if (State.redLineMesh) {
    State.redLineMesh.position.z = State.targetDistance;
    State.redLineSignpost.position.set(5 + 1.5, 0, State.targetDistance);
    if (State.roadText) State.roadText.position.z = State.targetDistance - 18.4;
  }
}

function updateTeacherTargetSliderRange(mode) {
  const slider = document.getElementById('teacher-target-distance');
  const minLabel = document.getElementById('teacher-target-min-label');
  const maxLabel = document.getElementById('teacher-target-max-label');
  
  if (!slider) return;

  let minVal = 25;
  let maxVal = 95;
  let stepVal = 1;

  if (mode === 'MASS_ONLY') {
    minVal = 12.5;
    maxVal = 62.5;
    stepVal = 0.5;
  } else if (mode === 'SPEED_ONLY') {
    minVal = 2.5;
    maxVal = 112.5;
    stepVal = 0.5;
  }

  slider.min = minVal;
  slider.max = maxVal;
  slider.step = stepVal;

  if (minLabel) minLabel.innerText = `${minVal.toFixed(1)}m`;
  if (maxLabel) maxLabel.innerText = `${maxVal.toFixed(1)}m`;

  const rangeGuide = document.getElementById('teacher-range-guide');
  if (rangeGuide) {
    rangeGuide.innerText = `도달 가능 범위: ${minVal.toFixed(1)}m ~ ${maxVal.toFixed(1)}m`;
  }

  if (State.targetDistance < minVal) {
    State.targetDistance = minVal;
  } else if (State.targetDistance > maxVal) {
    State.targetDistance = maxVal;
  }

  slider.value = State.targetDistance;
  updateTeacherTargetDist(State.targetDistance);
}

function setControlMode(mode) {
  State.controlMode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));

  let guideText = '';
  if (mode === 'BOTH') {
    document.getElementById('mode-btn-both').classList.add('active');
    guideText = '학생들이 질량과 속력을 모두 자유롭게 변경할 수 있습니다.';
  } else if (mode === 'MASS_ONLY') {
    document.getElementById('mode-btn-mass').classList.add('active');
    guideText = '속력이 50 km/h로 잠기며, 학생들이 차량 질량만 변경할 수 있습니다. (설정 가능 거리: 12.5m ~ 62.5m)';
  } else if (mode === 'SPEED_ONLY') {
    document.getElementById('mode-btn-speed').classList.add('active');
    guideText = '질량이 1500 kg으로 잠기며, 학생들이 초기 속력만 변경할 수 있습니다. (설정 가능 거리: 2.5m ~ 112.5m)';
  }
  
  const guideEl = document.getElementById('mode-guide-text');
  if (guideEl) guideEl.innerText = guideText;

  updateTeacherTargetSliderRange(mode);
}

async function lockSessionSettings() {
  State.activeStudents = [...State.students];

  safeSetStyleDisplay('teacher-lobby', 'none');
  safeSetStyleDisplay('teacher-active', 'flex');

  safeSetText('active-target-dist', `${State.targetDistance}m`);
  
  let modeLabel = '질량+속력';
  if (State.controlMode === 'MASS_ONLY') modeLabel = '질량만 조작';
  if (State.controlMode === 'SPEED_ONLY') modeLabel = '속력만 조작';
  safeSetText('active-control-mode', modeLabel);

  rebuildEnvironment(State.activeStudents.length || 1);
  setupTeacherInstancedTrucks(State.activeStudents.length || 1);

  State.studentCarPositions = {};
  State.studentCarSpeeds = {};
  State.studentCarStates = {};
  State.studentCarTimes = {};
  State.activeStudents.forEach(s => {
    State.studentCarPositions[s.id] = START_Z;
    State.studentCarSpeeds[s.id] = 0;
    State.studentCarStates[s.id] = 'idle';
  });
  updateInstancedTrucks();

  const payload = {
    targetDistance: State.targetDistance,
    controlMode: State.controlMode,
    fixedMass: 1500,
    fixedSpeed: 50
  };

  if (isConnected() && realtimeChannel) {
    await updateSessionSettings(State.sessionPin, State.targetDistance, State.controlMode);
    await updateSessionStatus(State.sessionPin, 'READY');

    realtimeChannel.send({
      type: 'broadcast',
      event: 'lock-settings',
      payload
    });
  }

  updateTeacherReadyStatus();
}

async function unlockSessionSettings() {
  safeSetStyleDisplay('teacher-active', 'none');
  safeSetStyleDisplay('teacher-lobby', 'flex');

  State.students.forEach(s => {
    if (State.studentReadyStates[s.id]) {
      State.studentReadyStates[s.id].isReady = false;
    }
  });
  updateStudentLobbyUI();

  if (isConnected() && realtimeChannel) {
    await updateSessionStatus(State.sessionPin, 'LOBBY');

    realtimeChannel.send({
      type: 'broadcast',
      event: 'unlock-settings'
    });
  }
}

async function triggerLaunchAll() {
  const total = State.activeStudents.length;
  
  if (State.isCollectingData) {
    if (State.collectionTimeout) {
      clearTimeout(State.collectionTimeout);
      State.collectionTimeout = null;
    }
    proceedActualLaunch();
    return;
  }

  let readyCount = 0;
  State.activeStudents.forEach(s => {
    if (State.studentReadyStates[s.id]?.isReady) readyCount++;
  });

  if (readyCount < total) {
    State.isCollectingData = true;
    State.collectedStudentIds.clear();
    
    State.activeStudents.forEach(s => {
      if (State.studentReadyStates[s.id]?.isReady) {
        State.collectedStudentIds.add(s.id);
      }
    });

    updateTeacherCollectionStatus();

    if (isConnected() && realtimeChannel) {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'request-slider-values'
      });
    }

    State.collectionTimeout = setTimeout(() => {
      State.collectionTimeout = null;
      proceedActualLaunch();
    }, 3000);

  } else {
    proceedActualLaunch();
  }
}

async function proceedActualLaunch() {
  State.isCollectingData = false;
  State.collectedStudentIds.clear();
  
  const startBtn = document.getElementById('btn-teacher-start');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>🚀 출발!`;
    startBtn.className = 'btn btn-primary';
  }

  State.simulationState = 'driving';

  State.activeStudents.forEach(s => {
    const state = State.studentReadyStates[s.id] || { mass: 1500, speed: 50 };
    State.studentCarPositions[s.id] = START_Z;
    State.studentCarSpeeds[s.id] = state.speed / 3.6;
    State.studentCarStates[s.id] = 'driving';
    State.studentCarTimes[s.id] = 0;
  });

  State.studentResults = [];

  if (isConnected() && realtimeChannel) {
    await updateSessionStatus(State.sessionPin, 'PLAYING');

    realtimeChannel.send({
      type: 'broadcast',
      event: 'launch'
    });
  }
}

function joinSession() {
  const pinInput = document.getElementById('student-pin');
  const nickInput = document.getElementById('student-nickname');

  State.sessionPin = "802935";
  if (pinInput) {
    pinInput.value = State.sessionPin;
  }
  State.myNickname = nickInput.value.trim();

  if (!State.myNickname) {
    alert("이름을 입력해 주세요.");
    return;
  }

  if (!isConnected()) {
    alert("수파베이스가 연결되지 않았습니다.");
    return;
  }

  setupStudentRealtime();
}

function setupStudentRealtime() {
  realtimeChannel = supabaseClient.channel(`room_${State.sessionPin}`);

  realtimeChannel
    .on('broadcast', { event: 'lock-settings' }, ({ payload }) => {
      onTeacherLockSettings(payload);
    })
    .on('broadcast', { event: 'unlock-settings' }, () => {
      showStudentLobbyWait();
    })
    .on('broadcast', { event: 'launch' }, () => {
      onLaunchTriggered();
    })
    .on('broadcast', { event: 'request-slider-values' }, () => {
      respondWithCurrentValues();
    })
    .on('broadcast', { event: 'next-round' }, () => {
      onNextRoundTriggered();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        State.myStudentId = 'student_' + Math.random().toString(36).substring(2, 9);

        await realtimeChannel.track({
          role: 'student',
          id: State.myStudentId,
          nickname: State.myNickname
        });

        safeSetStyleDisplay('student-login-overlay', 'none');
        showStudentLobbyWait();
      } else if (status === 'CHANNEL_ERROR') {
        alert("서버 연결 오류가 발생했습니다.");
      }
    });
}

function showStudentLobbyWait() {
  safeSetStyleDisplay('student-wait-message', 'flex');
  safeSetStyleDisplay('student-dashboard', 'none');
}

function onTeacherLockSettings(config) {
  safeSetStyleDisplay('student-wait-message', 'none');
  safeSetStyleDisplay('student-dashboard', 'flex');

  State.targetDistance = config.targetDistance;
  State.controlMode = config.controlMode;
  const fixedMass = config.fixedMass;
  const fixedSpeed = config.fixedSpeed;

  if (State.redLineMesh) {
    State.redLineMesh.position.z = State.targetDistance;
  }
  if (State.redLineSignpost) {
    State.redLineSignpost.position.set(10 / 2 + 1.5, 0, State.targetDistance);
  }
  if (State.roadText) {
    State.roadText.position.z = State.targetDistance - 18.4;
  }

  safeSetText('student-target-display', `${State.targetDistance.toFixed(1)}m`);

  const massSlider = document.getElementById('mass-slider');
  const massInput = document.getElementById('mass-input');
  const speedSlider = document.getElementById('speed-slider');
  const speedInput = document.getElementById('speed-input');

  const massGroup = document.getElementById('student-mass-group');
  const speedGroup = document.getElementById('student-speed-group');

  if (State.controlMode === 'MASS_ONLY') {
    if (speedSlider) {
      speedSlider.value = fixedSpeed;
      speedSlider.disabled = true;
    }
    if (speedInput) {
      speedInput.value = fixedSpeed;
      speedInput.disabled = true;
    }
    State.initialSpeedKmh = fixedSpeed;

    if (massSlider) massSlider.disabled = false;
    if (massInput) massInput.disabled = false;

    if (speedGroup) speedGroup.classList.add('locked');
    if (massGroup) massGroup.classList.remove('locked');
  }
  else if (State.controlMode === 'SPEED_ONLY') {
    if (massSlider) {
      massSlider.value = fixedMass;
      massSlider.disabled = true;
    }
    if (massInput) {
      massInput.value = fixedMass;
      massInput.disabled = true;
    }
    State.mass = fixedMass;
    updateCargoBoxes(State.mass);

    if (speedSlider) speedSlider.disabled = false;
    if (speedInput) speedInput.disabled = false;

    if (massGroup) massGroup.classList.add('locked');
    if (speedGroup) speedGroup.classList.remove('locked');
  }
  else {
    if (massSlider) massSlider.disabled = false;
    if (massInput) massInput.disabled = false;
    if (speedSlider) speedSlider.disabled = false;
    if (speedInput) speedInput.disabled = false;

    if (massGroup) massGroup.classList.remove('locked');
    if (speedGroup) speedGroup.classList.remove('locked');
  }

  updateDashboard();

  const readyBtn = document.getElementById('btn-student-ready');
  if (readyBtn) {
    readyBtn.disabled = false;
    readyBtn.className = 'btn btn-primary';
    readyBtn.innerText = '👍 준비 완료 (Ready)';
  }
  safeSetStyleDisplay('student-status-text', 'none');
}

function toggleStudentReady() {
  const readyBtn = document.getElementById('btn-student-ready');
  const isReadyNow = !readyBtn.classList.contains('btn-success');

  if (isReadyNow) {
    readyBtn.className = 'btn btn-success';
    readyBtn.innerText = '✅ 준비 완료됨';
    safeSetStyleDisplay('student-status-text', 'block');

    safeSetDisabled('mass-slider', true);
    safeSetDisabled('mass-input', true);
    safeSetDisabled('speed-slider', true);
    safeSetDisabled('speed-input', true);
  } else {
    readyBtn.className = 'btn btn-primary';
    readyBtn.innerText = '👍 준비 완료 (Ready)';
    safeSetStyleDisplay('student-status-text', 'none');

    if (State.controlMode !== 'SPEED_ONLY') {
      safeSetDisabled('mass-slider', false);
      safeSetDisabled('mass-input', false);
    }
    if (State.controlMode !== 'MASS_ONLY') {
      safeSetDisabled('speed-slider', false);
      safeSetDisabled('speed-input', false);
    }
  }

  const payload = {
    studentId: State.myStudentId,
    mass: State.mass,
    speed: State.initialSpeedKmh,
    isReady: isReadyNow
  };

  if (isConnected() && realtimeChannel) {
    realtimeChannel.send({
      type: 'broadcast',
      event: 'student-ready',
      payload
    });
  } else {
    State.studentReadyStates[State.myStudentId] = payload;
    updateTeacherReadyStatus();
  }
}

function respondWithCurrentValues() {
  const payload = {
    studentId: State.myStudentId,
    mass: State.mass,
    speed: State.initialSpeedKmh,
    isReady: true
  };
  if (isConnected() && realtimeChannel) {
    realtimeChannel.send({
      type: 'broadcast',
      event: 'student-ready',
      payload
    });
  } else {
    State.studentReadyStates[State.myStudentId] = payload;
    updateTeacherReadyStatus();
  }
}

function onLaunchTriggered() {
  closeStudentResultModal();
  safeSetDisabled('btn-student-ready', true);

  State.simulationState = 'driving';
  State.initialSpeedMps = State.initialSpeedKmh / 3.6;
  State.currentSpeedMps = State.initialSpeedMps;
  State.brakingElapsedTime = 0;

  if (State.truckGroup) {
    State.truckGroup.position.set(0, 0, START_Z);
  }
}

function reportStudentResult(actual, offset) {
  const payload = {
    studentId: State.myStudentId,
    nickname: State.myNickname,
    mass: State.mass,
    speed: State.initialSpeedKmh,
    actualDistance: actual,
    offsetDistance: offset
  };

  if (isConnected() && realtimeChannel) {
    realtimeChannel.send({
      type: 'broadcast',
      event: 'student-result',
      payload
    });

    recordResultToDB(payload);
  } else {
    addStudentResult(payload);
  }

  showStudentResultDetail(actual, offset);
}

async function recordResultToDB(payload) {
  try {
    await insertResult({
      session_pin: State.sessionPin,
      student_id: State.myStudentId,
      nickname: State.myNickname,
      selected_mass: payload.mass,
      selected_speed: payload.speed,
      actual_distance: payload.actualDistance,
      offset_distance: payload.offsetDistance
    });
  } catch (err) {
    console.warn("DB 저장 에러:", err);
  }
}

function showStudentResultDetail(actual, offset) {
  const modal = document.getElementById('student-result-modal');
  const actualText = document.getElementById('student-actual-dist');
  const targetText = document.getElementById('student-target-dist-result');
  const offsetText = document.getElementById('student-offset-dist');
  const feedbackBox = document.getElementById('student-result-feedback');

  if (actualText) actualText.innerText = `${actual.toFixed(2)}m`;
  if (targetText) targetText.innerText = `${State.targetDistance.toFixed(1)}m`;

  const absDiff = Math.abs(offset);
  if (offsetText) {
    const sign = offset >= 0 ? '+' : '';
    offsetText.innerText = `${sign}${offset.toFixed(2)}m`;
    if (absDiff <= 0.6) {
      offsetText.style.color = '#4caf50';
    } else {
      offsetText.style.color = '#ff1744';
    }
  }

  if (feedbackBox) {
    if (absDiff <= 0.6) {
      feedbackBox.className = 'result-feedback-box success';
      feedbackBox.innerHTML = `🏆 <strong>축하합니다!</strong> 오차 <strong>${absDiff.toFixed(2)}m</strong> 이내로 <strong>정확히 정차</strong>하여 미션을 해결했습니다!`;
    } else {
      feedbackBox.className = 'result-feedback-box fail';
      let tip = '';
      if (State.controlMode === 'MASS_ONLY') {
        if (offset > 0) {
          tip = `<br><span style="font-size:0.8rem; color:#ff8a80; display:block; margin-top:8px; font-weight:500;">💡 과학 팁: 질량(m)이 감소하면 운동에너지가 작아져 제동 거리가 줄어듭니다. 질량을 더 낮춰 보세요!</span>`;
        } else {
          tip = `<br><span style="font-size:0.8rem; color:#ff8a80; display:block; margin-top:8px; font-weight:500;">💡 과학 팁: 질량(m)이 증가하면 운동에너지가 커져 제동 거리가 늘어납니다. 질량을 더 높여 보세요!</span>`;
        }
      } else if (State.controlMode === 'SPEED_ONLY') {
        if (offset > 0) {
          tip = `<br><span style="font-size:0.8rem; color:#ff8a80; display:block; margin-top:8px; font-weight:500;">💡 과학 팁: 초기 속력(v)이 느려지면 제동 거리가 제곱 비례하여 줄어듭니다. 속력을 더 낮춰 보세요!</span>`;
        } else {
          tip = `<br><span style="font-size:0.8rem; color:#ff8a80; display:block; margin-top:8px; font-weight:500;">💡 과학 팁: 초기 속력(v)이 빨라지면 제동 거리가 제곱 비례하여 늘어납니다. 속력을 더 높여 보세요!</span>`;
        }
      } else {
        if (offset > 0) {
          tip = `<br><span style="font-size:0.8rem; color:#ff8a80; display:block; margin-top:8px; font-weight:500;">💡 과학 팁: 질량을 낮추거나 속력을 줄여서 운동에너지를 감소시켜 보세요!</span>`;
        } else {
          tip = `<br><span style="font-size:0.8rem; color:#ff8a80; display:block; margin-top:8px; font-weight:500;">💡 과학 팁: 질량을 높이거나 속력을 늘려서 운동에너지를 증가시켜 보세요!</span>`;
        }
      }

      if (offset > 0) {
        feedbackBox.innerHTML = `💥 <strong>정지선 초과!</strong> 목표 지점을 <strong>${offset.toFixed(2)}m 오버런</strong>했습니다.${tip}`;
      } else {
        feedbackBox.innerHTML = `⚠️ <strong>제동거리 미달!</strong> 목표선에 <strong>${absDiff.toFixed(2)}m 도달하지 못하고</strong> 정차했습니다.${tip}`;
      }
    }
  }

  if (modal) modal.style.display = 'flex';
}

function closeStudentResultModal() {
  safeSetStyleDisplay('student-result-modal', 'none');
}

function addStudentResult(res) {
  if (State.studentResults.some(r => r.studentId === res.studentId)) return;
  State.studentResults.push(res);
  State.studentResults.sort((a, b) => Math.abs(a.offsetDistance) - Math.abs(b.offsetDistance));
  updateLeaderboardUI();
}

async function resetForNextRound() {
  safeSetStyleDisplay('teacher-leaderboard-section', 'none');
  safeSetStyleDisplay('teacher-lobby', 'flex');

  State.students.forEach(s => {
    if (State.studentReadyStates[s.id]) {
      State.studentReadyStates[s.id].isReady = false;
    }
  });
  State.studentResults = [];
  updateStudentLobbyUI();

  State.simulationState = 'idle';

  if (isConnected() && realtimeChannel) {
    await updateSessionStatus(State.sessionPin, 'LOBBY');

    realtimeChannel.send({
      type: 'broadcast',
      event: 'next-round'
    });
  }
}

function onNextRoundTriggered() {
  closeStudentResultModal();
  State.simulationState = 'idle';

  const readyBtn = document.getElementById('btn-student-ready');
  if (readyBtn) {
    readyBtn.className = 'btn btn-primary';
    readyBtn.innerText = '👍 준비 완료 (Ready)';
  }
  safeSetStyleDisplay('student-status-text', 'none');

  if (State.controlMode !== 'SPEED_ONLY') {
    safeSetDisabled('mass-slider', false);
    safeSetDisabled('mass-input', false);
  }
  if (State.controlMode !== 'MASS_ONLY') {
    safeSetDisabled('speed-slider', false);
    safeSetDisabled('speed-input', false);
  }

  showStudentLobbyWait();
}

function syncInputs(type, value) {
  let val = parseInt(value);
  if (isNaN(val)) return;

  const massSlider = document.getElementById('mass-slider');
  const massInput = document.getElementById('mass-input');
  const speedSlider = document.getElementById('speed-slider');
  const speedInput = document.getElementById('speed-input');

  if (type === 'mass') {
    if (val >= 1000 && val <= 5000) {
      State.mass = val;
      if (massSlider) massSlider.value = val;
      if (massInput && document.activeElement !== massInput) massInput.value = val;
      updateCargoBoxes(State.mass);
    } else {
      State.mass = Math.max(1000, Math.min(5000, val));
      if (massSlider) massSlider.value = State.mass;
      if (massInput && document.activeElement !== massInput) massInput.value = State.mass;
      updateCargoBoxes(State.mass);
    }
  } else if (type === 'speed') {
    if (val >= 10 && val <= 150) {
      State.initialSpeedKmh = val;
      if (speedSlider) speedSlider.value = val;
      if (speedInput && document.activeElement !== speedInput) speedInput.value = val;
    } else {
      State.initialSpeedKmh = Math.max(10, Math.min(150, val));
      if (speedSlider) speedSlider.value = State.initialSpeedKmh;
      if (speedInput && document.activeElement !== speedInput) speedInput.value = State.initialSpeedKmh;
    }
  }
  updateDashboard();
}

// --- 인라인 HTML 바인딩 노출 ---
window.selectRole = selectRole;
window.joinSession = joinSession;
window.toggleStudentReady = toggleStudentReady;
window.triggerLaunchAll = triggerLaunchAll;
window.lockSessionSettings = lockSessionSettings;
window.unlockSessionSettings = unlockSessionSettings;
window.resetForNextRound = resetForNextRound;
window.closeStudentResultModal = closeStudentResultModal;
window.closeTargetModal = closeTargetModal;
window.closeResultModal = closeResultModal;
window.updateTeacherTargetDist = updateTeacherTargetDist;
window.setControlMode = setControlMode;
window.syncInputs = syncInputs;
window.startSimulation = startSimulation;
window.resetSimulation = resetSimulation;

// --- 앱 로드 시작 ---
window.onload = () => {
  // nameTagsContainer 전역 바인딩
  State.nameTagsContainer = document.getElementById('student-names-container');
  init();
};
