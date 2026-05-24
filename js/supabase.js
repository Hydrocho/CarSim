// --- CarSim Supabase 통신 모듈 ---

const SUPABASE_URL = "https://vdyvpsteofvhbvvrilxe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkeXZwc3Rlb2Z2aGJ2dnJpbHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzQ4ODMsImV4cCI6MjA5NTExMDg4M30.9kYsTmJGigMpanoj0CWFdHOZkDTUXqZo8neNuBxXIYU";

export let supabaseClient = null;

// CDN으로 전역 로드된 supabase 라이브러리 검출 및 빌드
if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * 수파베이스 연결 상태 반환
 */
export function isConnected() {
  return supabaseClient !== null;
}

/**
 * 세션 삭제 API
 */
export async function deleteSession(pinCode) {
  if (!supabaseClient) return null;

  // 외래 키 제약 조건(ON DELETE CASCADE 누락 대비) 우회: 자식 레코드(results) 선제 삭제
  await supabaseClient
    .from('results')
    .delete()
    .eq('session_pin', pinCode);

  // 부모 레코드(sessions) 삭제
  return await supabaseClient
    .from('sessions')
    .delete()
    .eq('pin_code', pinCode);
}

/**
 * 신규 세션 생성 API
 */
export async function insertSession(pinCode, targetDistance, controlMode = 'BOTH') {
  if (!supabaseClient) return null;
  return await supabaseClient
    .from('sessions')
    .insert([{
      pin_code: pinCode,
      target_distance: targetDistance,
      control_mode: controlMode,
      status: 'LOBBY'
    }]);
}

/**
 * 세션 정보 업데이트 API (거리 및 모드 동기화)
 */
export async function updateSessionSettings(pinCode, targetDistance, controlMode) {
  if (!supabaseClient) return null;
  return await supabaseClient
    .from('sessions')
    .update({
      target_distance: targetDistance,
      control_mode: controlMode
    })
    .eq('pin_code', pinCode);
}

/**
 * 세션 상태 업데이트 API (status: LOBBY | ACTIVE 등)
 */
export async function updateSessionStatus(pinCode, status) {
  if (!supabaseClient) return null;
  return await supabaseClient
    .from('sessions')
    .update({ status })
    .eq('pin_code', pinCode);
}

/**
 * 결과 데이터 추가 API
 */
export async function insertResult(payload) {
  if (!supabaseClient) return null;
  return await supabaseClient
    .from('results')
    .insert([payload]);
}

/**
 * 특정 세션의 결과 목록 조회 API
 */
export async function fetchResults(pinCode) {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from('results')
    .select('*')
    .eq('session_pin', pinCode);
  if (error) {
    console.error("결과 패치 실패:", error);
    return [];
  }
  return data;
}

/**
 * 특정 세션 정보 조회 API
 */
export async function fetchSession(pinCode) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('sessions')
    .select('*')
    .eq('pin_code', pinCode)
    .maybeSingle();
  if (error) {
    console.error("세션 조회 실패:", error);
    return null;
  }
  return data;
}
