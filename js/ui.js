// --- CarSim HTML UI 및 DOM 매니저 ---

import { State } from './state.js';
import { updateCargoBoxes } from './trucks.js';

// --- 안전한 DOM 수정 헬퍼 함수들 ---
export function safeSetDisabled(id, disabled) {
  const el = document.getElementById(id);
  if (el) el.disabled = disabled;
}

export function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

export function safeSetHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export function safeSetStyleDisplay(id, display) {
  const el = document.getElementById(id);
  if (el) el.style.display = display;
}

export function safeSetStyleWidth(id, width) {
  const el = document.getElementById(id);
  if (el) el.style.width = width;
}

export function safeSetClass(id, className) {
  const el = document.getElementById(id);
  if (el) el.className = className;
}

/**
 * 대시보드 실시간 정보 갱신
 */
export function updateDashboard(currentSpeedValKmh) {
  const displaySpeed = currentSpeedValKmh !== undefined ? currentSpeedValKmh : State.initialSpeedKmh;
  const displaySpeedMps = displaySpeed / 3.6;

  // 운동에너지 계산 (E = 0.5 * m * v^2)
  const energyJoules = 0.5 * State.mass * Math.pow(displaySpeedMps, 2);
  const energyKiloJoules = energyJoules / 1000;

  safeSetText('energy-value', energyKiloJoules.toFixed(1));

  // 운동에너지 그래프 게이지바 업데이트 (최대 에너지 4340 kJ 대비 비율)
  const maxEnergy = 4340;
  const energyPercent = Math.min(100, (energyKiloJoules / maxEnergy) * 100);
  safeSetStyleWidth('energy-bar', `${energyPercent}%`);

  // 상태 배지 업데이트
  const badge = document.getElementById('status-badge');
  if (badge) {
    badge.className = 'status-badge';

    if (State.simulationState === 'idle') {
      badge.innerText = '대기 중';
      badge.classList.add('state-idle');
    } else if (State.simulationState === 'driving') {
      badge.innerText = '가속 주행';
      badge.classList.add('state-driving');
    } else if (State.simulationState === 'braking') {
      badge.innerText = '제동 감속';
      badge.classList.add('state-braking');
    } else if (State.simulationState === 'stopped') {
      badge.innerText = '정지 완료';
      badge.classList.add('state-stopped');
    }
  }

  // 실시간 예상 제동 거리 계산 및 반영 (d = mv^2 / 200,000)
  const predDist = (State.mass * Math.pow(displaySpeed, 2)) / 200000;
  safeSetText('predicted-distance-value', predDist.toFixed(1));
}

/**
 * 결과 안내 모달 노출
 */
export function showResultModal(actualDist, targetDist, diff, absDiff) {
  const modal = document.getElementById('result-modal');
  const modalTitle = document.getElementById('modal-result-title');
  const modalActual = document.getElementById('modal-actual-dist');
  const modalTarget = document.getElementById('modal-target-dist-result');
  const modalFeedback = document.getElementById('modal-result-feedback');

  if (!modal) return;

  modalActual.innerText = `${actualDist.toFixed(2)}m`;
  modalTarget.innerText = `${targetDist.toFixed(1)}m`;

  if (absDiff <= 0.6) {
    modalFeedback.className = 'result-feedback-box success';
    modalTitle.innerText = '🎯 미션 성공!';
    modalFeedback.innerHTML = `목표 정지선 오차 <strong>${absDiff.toFixed(2)}m</strong> 이내로 <strong>정확히 정차</strong>했습니다!`;
  } else {
    modalFeedback.className = 'result-feedback-box fail';
    if (diff > 0) {
      modalTitle.innerText = '💥 정지선 초과 (오버런)';
      modalFeedback.innerHTML = `목표 정지선보다 <strong>${diff.toFixed(2)}m 지나쳤습니다</strong>.`;
    } else {
      modalTitle.innerText = '⚠️ 제동 거리 미달 (조기 정지)';
      modalFeedback.innerHTML = `목표 정지선에 <strong>${Math.abs(diff).toFixed(2)}m 모자라게 멈췄습니다</strong>.`;
    }
  }

  modal.style.display = 'flex';
}

/**
 * 결과 안내 모달 닫기
 */
export function closeResultModal() {
  safeSetStyleDisplay('result-modal', 'none');
}

/**
 * 반투명 목표 거리 안내 모달 노출
 */
export function showTargetModal(dist) {
  const modal = document.getElementById('target-modal');
  const modalText = document.getElementById('modal-target-dist');
  if (modal && modalText) {
    modalText.innerText = dist.toFixed(1);
    modal.style.display = 'flex';
  }
}

/**
 * 목표 거리 안내 모달 닫기
 */
export function closeTargetModal() {
  safeSetStyleDisplay('target-modal', 'none');
}

/**
 * 교사용 대기실 참여 학생 명단 갱신
 */
export function updateStudentLobbyUI() {
  const container = document.getElementById('student-list-container');
  const countSpan = document.getElementById('connected-count');
  if (!container || !countSpan) return;

  countSpan.innerText = State.students.length;
  container.innerHTML = '';

  if (State.students.length === 0) {
    container.innerHTML = '<p class="empty-list-msg">학생 접속 대기 중...</p>';
    return;
  }

  State.students.forEach(student => {
    const isReady = State.studentReadyStates[student.id]?.isReady || false;
    const tag = document.createElement('div');
    tag.className = `student-tag ${isReady ? 'ready' : ''}`;
    tag.innerHTML = `<span class="status-dot"></span>${student.nickname}`;
    container.appendChild(tag);
  });
}

/**
 * 교사 화면의 학생 준비 상태 수 표시 갱신
 */
export function updateTeacherReadyStatus() {
  let readyCount = 0;
  State.activeStudents.forEach(student => {
    if (State.studentReadyStates[student.id]?.isReady) {
      readyCount++;
    }
  });

  safeSetText('ready-count', readyCount);
  safeSetText('total-count', State.activeStudents.length);

  // 로비 UI도 함께 갱신
  updateStudentLobbyUI();
}

/**
 * 강제 출발 시 수집 중인 학생 수 상태 표시 갱신
 */
export function updateTeacherCollectionStatus() {
  const total = State.activeStudents.length;
  const collected = State.collectedStudentIds.size;
  const btn = document.getElementById('btn-teacher-force-start');
  if (btn) {
    btn.innerHTML = `<i class="bi bi-play-fill"></i> 데이터 수집 및 즉시 강제 시작 (${collected}/${total})`;
  }
}

/**
 * 교사용 리더보드 테이블 UI 렌더링
 */
export function updateLeaderboardUI() {
  const tbody = document.getElementById('leaderboard-rows');
  if (!tbody) return;
  tbody.innerHTML = '';

  State.studentResults.forEach((res, index) => {
    const tr = document.createElement('tr');

    const rank = index + 1;
    if (rank === 1) tr.className = 'rank-1';
    else if (rank === 2) tr.className = 'rank-2';
    else if (rank === 3) tr.className = 'rank-3';

    let rankLabel = `${rank}위`;
    if (rank === 1) rankLabel = '🥇 1위';
    else if (rank === 2) rankLabel = '🥈 2위';
    else if (rank === 3) rankLabel = '🥉 3위';

    const setValues = `${res.mass}kg, ${res.speed}km/h`;

    tr.innerHTML = `
      <td class="badge-cell">${rankLabel}</td>
      <td style="font-weight:700;">${res.nickname}</td>
      <td>${setValues}</td>
      <td>${res.actualDistance.toFixed(2)}m</td>
      <td><span style="font-weight:700;">${res.offsetDistance >= 0 ? '+' : ''}${res.offsetDistance.toFixed(2)}m</span></td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * 학생 인풋 락 설정/해제
 */
export function toggleInputs(disabled) {
  safeSetDisabled('mass-slider', disabled);
  safeSetDisabled('mass-input', disabled);
  safeSetDisabled('speed-slider', disabled);
  safeSetDisabled('speed-input', disabled);
}

/**
 * UI 슬라이더 및 수치 입력 바인딩 설정
 */
export function setupUIEventListeners() {
  const massInput = document.getElementById('mass-input');
  if (massInput) {
    massInput.addEventListener('blur', () => {
      let val = parseInt(massInput.value);
      if (isNaN(val)) val = 1500;
      val = Math.max(1000, Math.min(5000, val));
      massInput.value = val;
      State.mass = val;
      const massSlider = document.getElementById('mass-slider');
      if (massSlider) massSlider.value = val;
      updateCargoBoxes(State.mass);
      updateDashboard();
    });
  }
  const speedInput = document.getElementById('speed-input');
  if (speedInput) {
    speedInput.addEventListener('blur', () => {
      let val = parseInt(speedInput.value);
      if (isNaN(val)) val = 50;
      val = Math.max(10, Math.min(150, val));
      speedInput.value = val;
      State.initialSpeedKmh = val;
      const speedSlider = document.getElementById('speed-slider');
      if (speedSlider) speedSlider.value = val;
      updateDashboard();
    });
  }
}
