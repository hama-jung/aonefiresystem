-- 1. 대시보드(ID: 1)를 상위 메뉴 폴더로 변경 (path 제거)
UPDATE public.menus
SET path = NULL
WHERE id = 1;

-- 2. 하위 메뉴 추가 (대시보드1, 대시보드2)
-- 이미 존재하는지 확인 후 삽입 (중복 방지)
INSERT INTO public.menus ("parentId", label, path, "sortOrder", "isVisiblePc", "isVisibleMobile")
SELECT 1, '대시보드1', '/dashboard', 10, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.menus WHERE "parentId" = 1 AND path = '/dashboard');

INSERT INTO public.menus ("parentId", label, path, "sortOrder", "isVisiblePc", "isVisibleMobile")
SELECT 1, '대시보드2', '/dashboard2', 20, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.menus WHERE "parentId" = 1 AND path = '/dashboard2');