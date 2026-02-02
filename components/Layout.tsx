import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  ChevronDown, ChevronRight, LogOut, Menu, Bell, Key, User
} from 'lucide-react';
import { MenuItemDB } from '../types';
import { Modal, InputGroup, Button } from './CommonUI';
import { AuthAPI, MenuAPI } from '../services/api';
import { getIcon } from '../utils/iconMapper';

const PW_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{6,12}$/;

const MenuContext = createContext<MenuItemDB[]>([]);

export const usePageTitle = (defaultTitle: string) => {
  const menus = useContext(MenuContext);
  const location = useLocation();
  const currentMenu = menus.find(m => m.path === location.pathname);
  
  if (currentMenu?.label.includes('수신기 관리')) return 'R형 수신기 현황';
  if (currentMenu?.label.includes('중계기 관리')) return '중계기 현황';
  if (currentMenu?.label.includes('감지기 관리')) return '화재감지기 현황';
  if (currentMenu?.label.includes('발신기 관리')) return '발신기 현황';
  if (currentMenu?.label.includes('경종 관리')) return '경종 현황';
  
  return currentMenu ? currentMenu.label : defaultTitle;
};

const SidebarItem: React.FC<{ item: MenuItemDB; level?: number }> = ({ item, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();
  const hasChildren = item.children && item.children.length > 0;
  
  const isActive = item.path ? location.pathname === item.path : false;
  const baseClasses = "w-full flex items-center gap-3 px-5 py-2.5 text-[14px] font-medium transition-all duration-200";

  let displayLabel = item.label;
  if (displayLabel === 'R형 수신기 관리') displayLabel = 'R형 수신기 현황';
  if (displayLabel === '중계기 관리') displayLabel = '중계기 현황';
  if (displayLabel === '화재감지기 관리') displayLabel = '화재감지기 현황';
  if (displayLabel === '발신기 관리') displayLabel = '발신기 현황';
  if (displayLabel === '경종 관리') displayLabel = '경종 현황';

  if (hasChildren) {
    return (
      <div className="mb-1">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`${baseClasses} justify-between text-gray-300 hover:text-white hover:bg-[#3e4b61]`}
        >
          <div className="flex items-center gap-3">
            {getIcon(item.icon)}
            <span>{displayLabel}</span>
          </div>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {isOpen && (
          <div className="bg-[#232d3f] py-1">
            {item.children?.map((child, idx) => (
              <SidebarItem key={child.id} item={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path || '#'}
      className={`
        ${baseClasses}
        ${level > 0 ? 'pl-12' : ''}
        ${isActive 
          ? 'bg-[#2563eb] text-white shadow-md'
          : 'text-gray-400 hover:text-white hover:bg-[#3e4b61]'}
      `}
    >
      {!level && getIcon(item.icon)}
      <span>{displayLabel}</span>
    </NavLink>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [allMenus, setAllMenus] = useState<MenuItemDB[]>([]);
  const [menuTree, setMenuTree] = useState<MenuItemDB[]>([]);
  const [isPwModalOpen, setIsPwModalOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
  const [currentUser, setCurrentUser] = useState<{name: string, userId: string, role: string} | null>(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadMenus = useCallback(async () => {
    try {
        const list = await MenuAPI.getAll(); 
        setAllMenus(list);
        const buildTree = (items: MenuItemDB[], parentId: number | null = null): MenuItemDB[] => {
          return items
            .filter(item => (item.parentId || null) === parentId)
            .map(item => ({ ...item, children: buildTree(items, item.id) }))
            .sort((a, b) => a.sortOrder - b.sortOrder);
        };
        setMenuTree(buildTree(list));
    } catch (e) { console.error("Failed to load menus"); }
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try { setCurrentUser(JSON.parse(userStr)); } catch (e) {}
    }
    loadMenus();
    const handleMenuUpdate = () => loadMenus();
    window.addEventListener('menu-update', handleMenuUpdate);
    return () => window.removeEventListener('menu-update', handleMenuUpdate);
  }, [loadMenus]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/');
  };

  const handleOpenPwModal = () => {
    setPwForm({ current: '', new: '', confirm: '' });
    setIsPwModalOpen(true);
  };

  const handlePwChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!pwForm.current || !pwForm.new || !pwForm.confirm) { alert('모든 항목을 입력해주세요.'); return; }
    if (pwForm.new !== pwForm.confirm) { alert('새 비밀번호가 일치하지 않습니다.'); return; }
    if (!PW_REGEX.test(pwForm.new)) { alert('비밀번호는 영문, 숫자, 특수문자 포함 6자 ~ 12자로 생성해 주세요.'); return; }

    try {
      await AuthAPI.changePassword(currentUser.userId, pwForm.current, pwForm.new);
      alert('비밀번호가 성공적으로 변경되었습니다.\n새로운 비밀번호로 다시 로그인해주세요.');
      setIsPwModalOpen(false);
      handleLogout();
    } catch (e: any) { alert(e.message || '비밀번호 변경에 실패했습니다.'); }
  };

  const getVisibleMenus = (menus: MenuItemDB[]): MenuItemDB[] => {
    const role = currentUser?.role || 'Guest';
    return menus.filter(item => {
        if (isMobileView) { if (!item.isVisibleMobile) return false; } 
        else { if (!item.isVisiblePc) return false; }
        if (role === '총판관리자' && item.allowDistributor === false) return false;
        if (role === '시장관리자' && item.allowMarket === false) return false;
        if (role === '지자체' && item.allowLocal === false) return false;
        return true;
      }).map(item => ({ ...item, children: item.children ? getVisibleMenus(item.children) : undefined }));
  };

  const visibleMenuItems = getVisibleMenus(menuTree);

  return (
    <MenuContext.Provider value={allMenus}>
      <div className="flex h-screen bg-[#0f172a] overflow-hidden text-slate-200">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-[#2f3b52] text-white transform transition-transform duration-300 ease-in-out shadow-xl border-r border-slate-800 lg:translate-x-0 lg:static lg:inset-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-20 flex flex-col justify-center px-5 bg-[#263245] shadow-sm border-b border-[#3e4b61]">
            <div className="text-[20px] font-black text-white tracking-wide leading-none mb-1">AI 화재알림</div>
            <div className="text-[12px] font-bold text-red-500 tracking-tight">모니터링 시스템</div>
          </div>
          <div className="flex flex-col h-[calc(100vh-5rem)]">
            <div className="flex-1 overflow-y-auto custom-scrollbar py-3">
              <nav className="space-y-0.5">
                {visibleMenuItems.map((item) => (
                  <SidebarItem key={item.id} item={item} />
                ))}
              </nav>
            </div>
            {/* BUILD SUCCESS INDICATOR */}
            <div className="p-3 text-center border-t border-slate-700 bg-indigo-900 text-indigo-100 font-bold text-xs">
               v3.1 (Build Fixed)
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 bg-[#2f3b52] text-white shadow-md flex items-center justify-between px-4 lg:px-6 z-40 border-b border-[#1e293b] flex-shrink-0">
            <div className="flex items-center gap-3">
              <button className="lg:hidden p-2 text-gray-300 hover:bg-[#3e4b61] rounded-md transition-colors" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                <Menu size={22} />
              </button>
              <div className="flex items-center gap-2 text-red-500 font-bold px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
                 <Bell size={16} className="animate-pulse" />
                 <span className="text-[13px] hidden sm:inline">현재 전국 화재 상황 (0건)</span>
                 <span className="text-[13px] sm:hidden">화재 (0)</span>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-4">
               <div className="flex items-center gap-2 px-2 py-1">
                  <div className="p-1.5 bg-gray-600 rounded-full lg:hidden"><User size={14} className="text-white" /></div>
                  <div className="text-sm flex flex-col lg:flex-row lg:items-center lg:gap-1.5 text-right lg:text-left">
                    <span className="font-bold text-white leading-tight">{currentUser?.name || 'Guest'}</span>
                    {currentUser?.userId && <span className="text-xs lg:text-sm text-gray-400 font-normal leading-tight">({currentUser.userId})</span>}
                  </div>
               </div>
               <div className="hidden lg:block w-px h-4 bg-gray-600"></div>
               <button onClick={handleOpenPwModal} className="flex items-center gap-2 p-2 lg:px-3 lg:py-1.5 rounded-full lg:rounded hover:bg-[#3e4b61] text-gray-300 hover:text-white transition-colors lg:border lg:border-gray-600/50 lg:bg-[#3e4b61]/30" title="비밀번호 변경">
                 <Key size={16} />
                 <span className="hidden lg:inline text-[13px] font-medium pt-0.5">비밀번호 변경</span>
               </button>
               <button onClick={handleLogout} className="flex items-center gap-2 p-2 lg:px-3 lg:py-1.5 rounded-full lg:rounded hover:bg-[#3e4b61] text-gray-300 hover:text-white transition-colors lg:border lg:border-gray-600/50 lg:bg-[#3e4b61]/30" title="로그아웃">
                 <LogOut size={16} />
                 <span className="hidden lg:inline text-[13px] font-medium pt-0.5">로그아웃</span>
               </button>
            </div>
          </header>
          <main className="flex-1 overflow-auto pt-5 px-[60px] pb-0 bg-[#0f172a] custom-scrollbar relative">
            <div className="w-full min-h-full flex flex-col max-w-[1920px] mx-auto">
              {children}
            </div>
          </main>
        </div>
        {isMobileMenuOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
        {isPwModalOpen && (
          <Modal isOpen={isPwModalOpen} onClose={() => setIsPwModalOpen(false)} title="비밀번호 변경" icon={<Key size={20} className="text-blue-500" />}>
            <form onSubmit={handlePwChangeSubmit} className="flex flex-col gap-6">
              <div className="space-y-5">
                <InputGroup label="현재 비밀번호" type="password" placeholder="현재 비밀번호 입력" value={pwForm.current} onChange={(e) => setPwForm({...pwForm, current: e.target.value})} inputClassName="!bg-slate-900 border-slate-600 focus:border-blue-500" />
                <InputGroup label="새 비밀번호" type="password" placeholder="새 비밀번호 입력" value={pwForm.new} onChange={(e) => setPwForm({...pwForm, new: e.target.value})} inputClassName="!bg-slate-900 border-slate-600 focus:border-blue-500" />
                <div className="flex flex-col gap-1">
                  <InputGroup label="새 비밀번호 확인" type="password" placeholder="새 비밀번호 다시 입력" value={pwForm.confirm} onChange={(e) => setPwForm({...pwForm, confirm: e.target.value})} inputClassName="!bg-slate-900 border-slate-600 focus:border-blue-500" />
                  {pwForm.new && pwForm.confirm && pwForm.new !== pwForm.confirm && <p className="text-xs text-red-400 font-medium">비밀번호가 일치하지 않습니다.</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                 <Button type="submit" variant="primary" className="w-full py-2.5">변경하기</Button>
                 <Button type="button" variant="secondary" onClick={() => setIsPwModalOpen(false)} className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200">취소</Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </MenuContext.Provider>
  );
};