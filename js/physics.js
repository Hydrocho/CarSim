// --- CarSim 물리 연산 엔진 ---

import { F_BRAKE } from './constants.js';

/**
 * 차량의 질량에 따른 감속도(a = F/m)를 계산합니다.
 * @param {number} mass 차량 질량 (kg)
 * @returns {number} 감속도 (m/s^2)
 */
export function getDeceleration(mass) {
  return F_BRAKE / mass;
}

/**
 * 감속도와 초기 속도에 따른 완전 정지까지 걸리는 시간(t = v/a)을 계산합니다.
 * @param {number} initialSpeedMps 초기 속도 (m/s)
 * @param {number} deceleration 감속도 (m/s^2)
 * @returns {number} 정지 시간 (초)
 */
export function getStopTime(initialSpeedMps, deceleration) {
  if (deceleration <= 0) return 0;
  return initialSpeedMps / deceleration;
}

/**
 * 초기 속도와 감속도에 따른 이론적 제동 거리(d = v^2 / 2a)를 계산합니다.
 * @param {number} initialSpeedMps 초기 속도 (m/s)
 * @param {number} deceleration 감속도 (m/s^2)
 * @returns {number} 제동 거리 (m)
 */
export function getBrakingDistance(initialSpeedMps, deceleration) {
  if (deceleration <= 0) return 0;
  return Math.pow(initialSpeedMps, 2) / (2 * deceleration);
}

/**
 * 제동 경과 시간에 따른 현재 차량의 Z 위치를 계산합니다 (앞 범퍼 기준 Z=0 시작 기준 적용).
 * @param {number} initialSpeedMps 초기 속도 (m/s)
 * @param {number} deceleration 감속도 (m/s^2)
 * @param {number} elapsedSec 제동 경과 시간 (초)
 * @returns {number} 기준 Z 위치 (m)
 */
export function getBrakingPositionZ(initialSpeedMps, deceleration, elapsedSec) {
  // x(t) = v0*t - 0.5*a*t^2 (앞 범퍼 Z=0 기점으로 셋팅하기 위해 기본 -2.5m 오프셋 포함)
  return -2.5 + (initialSpeedMps * elapsedSec) - (0.5 * deceleration * Math.pow(elapsedSec, 2));
}

/**
 * 제동 경과 시간에 따른 현재 차량의 속도(m/s)를 계산합니다.
 * @param {number} initialSpeedMps 초기 속도 (m/s)
 * @param {number} deceleration 감속도 (m/s^2)
 * @param {number} elapsedSec 제동 경과 시간 (초)
 * @returns {number} 현재 속도 (m/s)
 */
export function getBrakingSpeed(initialSpeedMps, deceleration, elapsedSec) {
  const currentSpeed = initialSpeedMps - (deceleration * elapsedSec);
  return Math.max(0, currentSpeed); // 속도가 음수가 되지 않도록 방지
}
