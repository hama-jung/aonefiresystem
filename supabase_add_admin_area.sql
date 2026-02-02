-- [마이그레이션] 사용자 테이블에 담당 행정 구역 컬럼 추가

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS "administrativeArea" text;

-- 예: 기존 데이터가 있다면 NULL 또는 기본값 처리 (필요시)
-- UPDATE public.users SET "administrativeArea" = '' WHERE "administrativeArea" IS NULL;