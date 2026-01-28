-- [중요] 이 스크립트를 Supabase SQL Editor에서 실행하세요.
-- 상가 엑셀 일괄 등록 기능을 위해 stores 테이블에 누락된 컬럼을 추가합니다.

-- 1. Add Address Columns
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS "addressDetail" text,
ADD COLUMN IF NOT EXISTS "handlingItems" text;

-- 2. Update existing rows (optional cleanup)
-- UPDATE public.stores SET address = '' WHERE address IS NULL;
-- UPDATE public.stores SET "addressDetail" = '' WHERE "addressDetail" IS NULL;

-- 3. Check table definition (for verification)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stores';
