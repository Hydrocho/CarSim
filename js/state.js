// --- CarSim 시뮬레이션 상태 관리자 (싱글톤) ---

export const State = {
  // Three.js 핵심 객체
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  clock: null,

  // 단일 차량 리소스
  truckGroup: null,
  wheels: [],
  cargoGroup: null,
  leftBrakeLight: null,
  rightBrakeLight: null,
  brakePointLight: null,

  // 환경 리소스
  redLineMesh: null,
  redLineSignpost: null,
  roadText: null,
  signboardMarkers: [],
  sunLight: null,
  teacherCamConfig: {
    posX: 0,
    posY: 20,
    posZ: -60,
    tarX: 0,
    tarY: 2,
    tarZ: 35
  },
  environmentGroup: null,

  // 멀티플레이어 연결 상태
  userRole: null,          // 'teacher' | 'student' | null
  isMultiplayer: false,
  sessionPin: '802935',    // 고정 PIN 번호 "802935"
  myNickname: '',
  myStudentId: null,
  students: [],            // 대기실 학생 리스트 [{ id, nickname }]
  activeStudents: [],      // 실험 잠금 시점의 학생 리스트
  studentReadyStates: {},  // studentId -> { mass, speed, isReady }
  studentCarPositions: {}, // studentId -> Z position
  studentCarSpeeds: {},    // studentId -> speed (mps)
  studentCarStates: {},    // studentId -> 'idle' | 'driving' | 'braking' | 'stopped'
  studentCarTimes: {},     // studentId -> elapsed time
  studentResults: [],      // 최종 리더보드 결과 목록

  // 세션 설정 모드
  controlMode: 'BOTH',     // 'BOTH' | 'MASS_ONLY' | 'SPEED_ONLY'
  isDemoMode: false,
  isCollectingData: false,
  collectedStudentIds: new Set(),
  collectionTimeout: null,

  // UI 요소
  nameTagsContainer: null,
  studentDomElements: {},

  // 교사용 35인 다차선 인스턴스 메쉬 객체
  instancedChassis: null,
  instancedHood: null,
  instancedCab: null,
  instancedWheels: null,
  instancedFakeShadows: null,
  instancedCargo: null,
  instancedStopLines: null,

  // 시뮬레이션 물리 제어 변수
  simulationState: 'idle', // 'idle' | 'driving' | 'braking' | 'stopped'
  currentMode: 'challenge', // 'challenge' 고정
  mass: 1500,             // kg
  initialSpeedKmh: 50,    // km/h
  currentSpeedMps: 0,     // m/s
  targetDistance: 45,     // m
  brakingElapsedTime: 0,  // s
  initialSpeedMps: 0,     // m/s (제동 진입 직전 실제 속력)
};

// 카메라 오프셋 상수 (State의 일부분으로 공유)
export const CAMERA_OFFSETS = {
  rear: { x: -7, y: 4.5, z: -10 },
  side: { x: -14, y: 3.5, z: 3 }
};
