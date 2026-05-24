// --- CarSim 시뮬레이션 물리 및 환경 상수 ---

export const F_BRAKE = 7716.05;      // 고정 제동력 (Newton) - 500kg, 20km/h 일때 제동거리가 정확히 1m가 되도록 보정
export const START_Z = -30;          // 차량 출발 위치 (m)
export const BRAKE_Z = 0;            // 브레이크 시작 검은색 선 위치 (m)
export const WHEEL_RADIUS = 0.6;     // 바퀴 반지름 (m)
export const DEFAULTS = {
  fixedMass: 2500,
  fixedSpeed: 40
};
