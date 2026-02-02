-- [마이그레이션] 현장 지도 이미지 다중 등록 지원

-- 1. mapImages 컬럼 추가 (배열 타입)
ALTER TABLE public.markets 
ADD COLUMN IF NOT EXISTS "mapImages" text[] DEFAULT '{}';

-- 2. 기존 데이터 마이그레이션 (mapImage -> mapImages)
-- mapImage에 값이 있는 경우, mapImages 배열의 첫 번째 요소로 이동
UPDATE public.markets
SET "mapImages" = ARRAY["mapImage"]
WHERE "mapImage" IS NOT NULL AND ("mapImages" IS NULL OR "mapImages" = '{}');

-- 3. (옵션) 기존 mapImage 컬럼은 호환성을 위해 유지하거나 나중에 삭제
-- ALTER TABLE public.markets DROP COLUMN "mapImage";