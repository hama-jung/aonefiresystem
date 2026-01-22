
-- [중요] 이 스크립트를 Supabase SQL Editor에서 실행하세요.
-- 데이터는 존재하지만 웹사이트에서 보이지 않는 경우(빈 배열 반환), RLS 정책 문제입니다.

-- 1. 메뉴 테이블 읽기 권한 허용
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Select Menus" ON public.menus;
CREATE POLICY "Public Select Menus" ON public.menus FOR SELECT USING (true);

-- 2. 사용자 테이블 읽기 권한 허용
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Select Users" ON public.users;
CREATE POLICY "Public Select Users" ON public.users FOR SELECT USING (true);

-- 3. 시장/상가 테이블 읽기 권한 허용
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Select Markets" ON public.markets;
CREATE POLICY "Public Select Markets" ON public.markets FOR SELECT USING (true);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Select Stores" ON public.stores;
CREATE POLICY "Public Select Stores" ON public.stores FOR SELECT USING (true);

-- 4. 공통코드 읽기 권한 허용
ALTER TABLE public.common_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Select CommonCodes" ON public.common_codes;
CREATE POLICY "Public Select CommonCodes" ON public.common_codes FOR SELECT USING (true);

-- 5. 롤(Role) 읽기 권한 허용
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Select Roles" ON public.roles;
CREATE POLICY "Public Select Roles" ON public.roles FOR SELECT USING (true);
