import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 Supabase 설정 로드
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase 환경 변수가 설정되지 않았습니다. .env 파일을 확인해주세요.');
}

export const supabase = createClient(
  SUPABASE_URL || '', 
  SUPABASE_ANON_KEY || ''
);