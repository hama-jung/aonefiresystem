-- [메뉴명 일괄 변경 스크립트]
-- 이 스크립트를 SQL Editor에서 실행하면 좌측 메뉴바의 명칭이 즉시 변경됩니다.

BEGIN;

-- 1. 상위 메뉴 변경
-- 현장기기관리 -> 기기현황
UPDATE public.menus 
SET label = '기기현황' 
WHERE label = '현장기기관리';

-- 2. 하위 메뉴 변경 (기기 관리 관련)
-- 관리 -> 현황 으로 변경

UPDATE public.menus 
SET label = 'R형 수신기 현황' 
WHERE label = 'R형 수신기 관리';

UPDATE public.menus 
SET label = '중계기 현황' 
WHERE label = '중계기 관리';

UPDATE public.menus 
SET label = '화재감지기 현황' 
WHERE label = '화재감지기 관리';

UPDATE public.menus 
SET label = '발신기 현황' 
WHERE label = '발신기 관리';

UPDATE public.menus 
SET label = '경종 현황' 
WHERE label = '경종 관리';

COMMIT;

-- [확인]
-- SELECT * FROM public.menus ORDER BY id, "sortOrder";