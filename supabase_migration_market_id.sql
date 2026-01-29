
-- [마이그레이션 스크립트: 현장 참조 ID 통합]
-- 주의: 실행 전 백업을 권장합니다.

BEGIN;

-- 1. device_status 테이블 마이그레이션 (marketName -> market_id)
-- 1-1. 컬럼 추가
ALTER TABLE public.device_status ADD COLUMN IF NOT EXISTS "market_id" bigint REFERENCES public.markets(id);

-- 1-2. 기존 이름(marketName)과 일치하는 markets의 id를 찾아 업데이트
UPDATE public.device_status
SET "market_id" = m.id
FROM public.markets m
WHERE public.device_status."marketName" = m.name;

-- 1-3. 기존 컬럼 삭제 (선택 사항: 데이터 검증 후 삭제 권장하지만, 요청에 따라 구조 변경)
-- 혹시 몰라 이름 컬럼은 남겨두되, nullable로 변경합니다. 나중에 삭제하세요.
ALTER TABLE public.device_status ALTER COLUMN "marketName" DROP NOT NULL;


-- 2. fire_history 테이블 마이그레이션 (marketName -> market_id)
ALTER TABLE public.fire_history ADD COLUMN IF NOT EXISTS "market_id" bigint REFERENCES public.markets(id);

UPDATE public.fire_history
SET "market_id" = m.id
FROM public.markets m
WHERE public.fire_history."marketName" = m.name;

ALTER TABLE public.fire_history ALTER COLUMN "marketName" DROP NOT NULL;


-- 3. data_reception 테이블 마이그레이션 (marketName -> market_id)
ALTER TABLE public.data_reception ADD COLUMN IF NOT EXISTS "market_id" bigint REFERENCES public.markets(id);

UPDATE public.data_reception
SET "market_id" = m.id
FROM public.markets m
WHERE public.data_reception."marketName" = m.name;

ALTER TABLE public.data_reception ALTER COLUMN "marketName" DROP NOT NULL;


-- 4. stores 테이블 컬럼명 변경 ("marketId" -> market_id)
-- 기존에 FK가 안 걸려있다면 추가
ALTER TABLE public.stores RENAME COLUMN "marketId" TO "market_id";
-- FK 제약조건이 없다면 추가 (기존 데이터 무결성을 위해 NO CHECK로 추가 후 유효성 검사 권장)
ALTER TABLE public.stores 
  DROP CONSTRAINT IF EXISTS stores_marketId_fkey; 

ALTER TABLE public.stores
  ADD CONSTRAINT stores_market_id_fkey
  FOREIGN KEY (market_id)
  REFERENCES public.markets(id)
  ON UPDATE CASCADE;


-- 5. 기타 기기 테이블 컬럼명 통일 (camelCase -> snake_case)
-- receivers
ALTER TABLE public.receivers RENAME COLUMN "marketId" TO "market_id";
ALTER TABLE public.receivers DROP CONSTRAINT IF EXISTS receivers_marketId_fkey;
ALTER TABLE public.receivers ADD CONSTRAINT receivers_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(id) ON UPDATE CASCADE;

-- repeaters
ALTER TABLE public.repeaters RENAME COLUMN "marketId" TO "market_id";
ALTER TABLE public.repeaters DROP CONSTRAINT IF EXISTS repeaters_marketId_fkey;
ALTER TABLE public.repeaters ADD CONSTRAINT repeaters_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(id) ON UPDATE CASCADE;

-- detectors
ALTER TABLE public.detectors RENAME COLUMN "marketId" TO "market_id";
ALTER TABLE public.detectors DROP CONSTRAINT IF EXISTS detectors_marketId_fkey;
ALTER TABLE public.detectors ADD CONSTRAINT detectors_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(id) ON UPDATE CASCADE;

-- transmitters
ALTER TABLE public.transmitters RENAME COLUMN "marketId" TO "market_id";
ALTER TABLE public.transmitters DROP CONSTRAINT IF EXISTS transmitters_marketId_fkey;
ALTER TABLE public.transmitters ADD CONSTRAINT transmitters_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(id) ON UPDATE CASCADE;

-- alarms
ALTER TABLE public.alarms RENAME COLUMN "marketId" TO "market_id";
ALTER TABLE public.alarms DROP CONSTRAINT IF EXISTS alarms_marketId_fkey;
ALTER TABLE public.alarms ADD CONSTRAINT alarms_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(id) ON UPDATE CASCADE;

-- work_logs
ALTER TABLE public.work_logs RENAME COLUMN "marketId" TO "market_id";
ALTER TABLE public.work_logs DROP CONSTRAINT IF EXISTS work_logs_marketId_fkey;
ALTER TABLE public.work_logs ADD CONSTRAINT work_logs_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets(id) ON UPDATE CASCADE;

COMMIT;
