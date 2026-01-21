-- 1. Reset Table (Clear all data and restart sequence)
TRUNCATE TABLE public.menus RESTART IDENTITY CASCADE;

-- 2. Insert Root Menus (Explicit IDs 1-4)
-- Dashboard (ID: 1)
INSERT INTO public.menus (id, label, path, icon, "sortOrder", "isVisiblePc", "isVisibleMobile")
VALUES (1, '대시보드', '/dashboard', 'Home', 10, true, true);

-- System Management (ID: 2)
INSERT INTO public.menus (id, label, path, icon, "sortOrder", "isVisiblePc", "isVisibleMobile")
VALUES (2, '시스템 관리', null, 'Settings', 20, true, false);

-- Device Management (ID: 3)
INSERT INTO public.menus (id, label, path, icon, "sortOrder", "isVisiblePc", "isVisibleMobile")
VALUES (3, '기기 관리', null, 'Cpu', 30, true, false);

-- Data Management (ID: 4)
INSERT INTO public.menus (id, label, path, icon, "sortOrder", "isVisiblePc", "isVisibleMobile")
VALUES (4, '데이터 관리', null, 'Activity', 40, true, true);

-- 3. CRITICAL: Advance sequence to avoid ID collision for subsequent inserts
-- Since we manually inserted IDs up to 4, we must tell the sequence to start from 5.
SELECT setval('menus_id_seq', 4, true);

-- 4. Insert Children (Using implicit IDs via sequence)

-- System Management Children (ParentID: 2)
INSERT INTO public.menus ("parentId", label, path, "sortOrder", "isVisiblePc", "isVisibleMobile") VALUES
(2, '사용자 관리', '/users', 10, true, false),
(2, '총판 관리', '/distributors', 20, true, false),
(2, '시장 관리', '/markets', 30, true, false),
(2, '상가 관리', '/stores', 40, true, false),
(2, '문자 전송', '/sms', 50, true, false),
(2, '작업일지', '/work-logs', 60, true, true),
(2, '롤 관리', '/roles', 70, true, false),
(2, '메뉴 관리', '/menus', 80, true, false),
(2, '공통코드 관리', '/common-codes', 75, true, false);

-- Device Management Children (ParentID: 3)
INSERT INTO public.menus ("parentId", label, path, "sortOrder", "isVisiblePc", "isVisibleMobile") VALUES
(3, 'R형 수신기 관리', '/receivers', 10, true, false),
(3, '중계기 관리', '/repeaters', 20, true, false),
(3, '화재감지기 관리', '/detectors', 30, true, false),
(3, '발신기 관리', '/transmitters', 40, true, false),
(3, '경종 관리', '/alarms', 50, true, false);

-- Data Management Children (ParentID: 4)
INSERT INTO public.menus ("parentId", label, path, "sortOrder", "isVisiblePc", "isVisibleMobile") VALUES
(4, '화재 이력 관리', '/fire-history', 10, true, true),
(4, '기기 상태 관리', '/device-status', 20, true, true),
(4, '데이터 수신 관리', '/data-reception', 30, true, true);

-- 5. Final Sequence Sync (Just to be safe)
SELECT setval('menus_id_seq', (SELECT MAX(id) FROM public.menus));