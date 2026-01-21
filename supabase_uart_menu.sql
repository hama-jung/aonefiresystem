-- Insert Menu Item (Data Management > UART Communication)
-- ParentID 4 is Data Management
-- SortOrder 40 makes it the 4th item (after Fire History 10, Device Status 20, Data Reception 30)

INSERT INTO public.menus ("parentId", label, path, "sortOrder", "isVisiblePc", "isVisibleMobile")
SELECT 4, 'UART 통신', '/uart-communication', 40, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.menus WHERE path = '/uart-communication');