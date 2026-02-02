import { createClient } from '@supabase/supabase-js';

// Vite 환경 변수 직접 참조 (import.meta.env가 가장 확실함)
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase URL 또는 Key가 설정되지 않았습니다. .env 설정 혹은 Vercel 환경변수를 확인하세요.');
}

// 초기화 실패 시 에러가 아닌 경고만 띄우고 더미 클라이언트 반환 (에러 화면 방지)
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder'
);