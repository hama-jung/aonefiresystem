
-- [마이그레이션 스크립트: 사용자 소속 ID 통합]

BEGIN;

-- 1. 사용자 테이블에 참조 컬럼 추가
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "distributor_id" bigint REFERENCES public.distributors(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "market_id" bigint REFERENCES public.markets(id);

-- 2. 기존 데이터 마이그레이션 (이름 매칭 -> ID 연결)

-- 2-1. 총판관리자: department(이름)와 일치하는 distributors 찾아서 ID 연결
UPDATE public.users u
SET "distributor_id" = d.id
FROM public.distributors d
WHERE u.role = '총판관리자' AND u.department = d.name;

-- 2-2. 시장관리자/상가관리자: department(이름)와 일치하는 markets 찾아서 ID 연결
UPDATE public.users u
SET "market_id" = m.id
FROM public.markets m
WHERE (u.role = '시장관리자' OR u.role = '상가관리자') AND u.department = m.name;

-- 3. (선택사항) 기존 department 컬럼은 '표시용'으로 남겨두거나, 
-- 추후 뷰(View)를 통해 대체할 수 있으나, 현재는 호환성을 위해 유지합니다.

COMMIT;
