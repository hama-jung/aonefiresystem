import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, Users, Cpu, Activity, Menu, 
  ChevronDown, ChevronRight, LogOut, Settings, Bell, Key, HelpCircle, User
} from 'lucide-react';
import { MenuItem } from '../types';
import { Modal, InputGroup, Button } from './CommonUI';
import { AuthAPI } from '../services/api';

// 비밀번호 정규식 (영문, 숫자, 특수문자 포함 6~12자) - UserManagement와 동일
const PW_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{6,12}$/;

const menuItems: MenuItem[] = [
  { 
    label: '대시보드', 
    path: '/dashboard', 
    icon: <Home size={16} /> 
  },
  { 
    label: '시스템 관리', 
    icon: <Settings size={16} />,
    children: [
      { label: '사용자 관리', path: '/users' },
      { label: '총판 관리', path: '/distributors' },
      { label: '시장 관리', path: '/markets' },
      { label: '상가 관리', path: '/stores' },
      { label: '문자 전송', path: '/sms' },
      { label: '롤 관리', path: '/roles' },
      { label: '접속 로그', path: '/access-logs' },
    ]
  },
  { 
    label: '기기 관리', 
    icon: <Cpu size={16} />,
    children: [
      { label: 'R형 수신기', path: '/receivers' },
      { label: '중계기 관리', path: '/repeaters' },
      { label: '화재감지기', path: '/detectors' },
    ]
  },
  { 
    label: '데이터 관리', 
    icon: <Activity size={16} />,
    children: [
      { label: '화재 이력 관리', path: '/fire-history' },
      { label: '기기 상태 관리', path: '/device-status' },
    ]
  },
];

const SidebarItem: React.FC<{ item: MenuItem; level?: number }> = ({ item, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();
  const hasChildren = item.children && item.children.length > 0;
  
  const isActive = item.path ? location.pathname === item.path : false;
  // const isChildActive = item.children?.some(child => child.path === location.pathname);

  // 폰트 크기: text-[14px]
  const baseClasses = "w-full flex items-center gap-3 px-5 py-2.5 text-[14px] font-medium transition-all duration-200";

  if (hasChildren) {
    return (
      <div className="mb-1">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`${baseClasses} justify-between text-gray-300 hover:text-white hover:bg-[#3e4b61]`}
        >
          <div className="flex items-center gap-3">
            {item.icon}
            <span>{item.label}</span>
          </div>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {isOpen && (
          <div className="bg-[#232d3f] py-1">
            {item.children?.map((child, idx) => (
              <SidebarItem key={idx} item={child} level={level + 1} />
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
      {!level && item.icon}
      <span>{item.label}</span>
    </NavLink>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // 비밀번호 변경 모달 상태
  const [isPwModalOpen, setIsPwModalOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });

  const [currentUser, setCurrentUser] = useState<{name: string, userId: string} | null>(null);

  useEffect(() => {
    // 로컬 스토리지에서 사용자 정보 로드
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
      } catch (e) {
        console.error("Failed to parse user info");
      }
    }
  }, []);

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

    if (!pwForm.current || !pwForm.new || !pwForm.confirm) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    if (pwForm.new !== pwForm.confirm) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!PW_REGEX.test(pwForm.new)) {
      alert('비밀번호는 영문, 숫자, 특수문자 포함 6자 ~ 12자로 생성해 주세요.');
      return;
    }

    try {
      await AuthAPI.changePassword(currentUser.userId, pwForm.current, pwForm.new);
      alert('비밀번호가 성공적으로 변경되었습니다.\n새로운 비밀번호로 다시 로그인해주세요.');
      setIsPwModalOpen(false);
      handleLogout(); // 변경 후 재로그인 유도
    } catch (e: any) {
      alert(e.message || '비밀번호 변경에 실패했습니다.');
    }
  };

  return (
    <div className="flex h-screen bg-[#0f172a] overflow-hidden text-slate-200">
      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-60 bg-[#2f3b52] text-white transform transition-transform duration-300 ease-in-out shadow-xl border-r border-slate-800
          lg:translate-x-0 lg:static lg:inset-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand Header */}
        <div className="h-20 flex flex-col justify-center px-5 bg-[#263245] shadow-sm border-b border-[#3e4b61]">
          {/* Logo Font Size: 20px */}
          <div className="text-[20px] font-black text-white tracking-wide leading-none mb-1">
            A-ONE 에이원
          </div>
          {/* Subtext Font Size: 12px */}
          <div className="text-[12px] font-bold text-red-500 tracking-tight">
            화재감지 모니터링
          </div>
        </div>

        {/* Menu Area */}
        <div className="overflow-y-auto h-[calc(100vh-5rem)] custom-scrollbar py-3">
          <nav className="space-y-0.5">
            {menuItems.map((item, idx) => (
              <SidebarItem key={idx} item={item} />
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-[#2f3b52] text-white shadow-md flex items-center justify-between px-4 lg:px-6 z-40 border-b border-[#1e293b]">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-gray-300 hover:bg-[#3e4b61] rounded-md"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu size={22} />
            </button>
            
            {/* Left Side: Fire Status Alert */}
            <div className="hidden md:flex items-center gap-2 text-red-500 font-bold px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
               <Bell size={16} className="animate-pulse" />
               <span className="text-[13px]">현재 전국 화재 상황 (0건)</span>
            </div>
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-2">
             {/* User Profile */}
             <div className="flex items-center gap-2 mr-3 px-3 py-1 rounded-full bg-[#3e4b61]/50 border border-[#4b5563]">
                <div className="p-1 bg-gray-600 rounded-full">
                  <User size={12} className="text-white" />
                </div>
                <span className="text-[13px] text-gray-200">
                  {currentUser ? (
                    <>
                      <span className="font-bold text-white">{currentUser.name}</span> ({currentUser.userId})
                    </>
                  ) : (
                    <span className="font-bold text-white">Guest</span>
                  )}
                </span>
             </div>

             {/* Action Buttons */}
             <button 
               onClick={handleOpenPwModal}
               className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-600 hover:bg-[#3e4b61] text-gray-300 hover:text-white transition-colors text-[12px]"
             >
               <Key size={12} />
               <span>비밀번호 변경</span>
             </button>

             <button className="p-1.5 rounded-full hover:bg-[#3e4b61] text-gray-400 hover:text-white transition-colors">
               <HelpCircle size={18} />
             </button>

             <button 
               className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-600 hover:bg-[#3e4b61] text-gray-300 hover:text-white transition-colors text-[12px]"
               onClick={handleLogout}
             >
               <LogOut size={12} />
               <span>로그아웃</span>
             </button>
          </div>
        </header>

        {/* Content Body (Dark bg) - Padding adjustment to 60px */}
        <main className="flex-1 overflow-auto py-5 px-[60px] bg-[#0f172a] custom-scrollbar">
          <div className="w-full h-full flex flex-col max-w-[1920px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Password Change Modal */}
      {isPwModalOpen && (
        <Modal 
          isOpen={isPwModalOpen} 
          onClose={() => setIsPwModalOpen(false)}
          title="비밀번호 변경"
          icon={<Key size={20} className="text-blue-500" />}
        >
          <form onSubmit={handlePwChangeSubmit} className="flex flex-col gap-6">
            <div className="space-y-5">
              <InputGroup 
                label="현재 비밀번호" 
                type="password" 
                placeholder="현재 비밀번호 입력"
                value={pwForm.current}
                onChange={(e) => setPwForm({...pwForm, current: e.target.value})}
                inputClassName="!bg-slate-900 border-slate-600 focus:border-blue-500"
              />
              <InputGroup 
                label="새 비밀번호" 
                type="password" 
                placeholder="새 비밀번호 입력"
                value={pwForm.new}
                onChange={(e) => setPwForm({...pwForm, new: e.target.value})}
                inputClassName="!bg-slate-900 border-slate-600 focus:border-blue-500"
              />
              <div className="flex flex-col gap-1">
                <InputGroup 
                  label="새 비밀번호 확인" 
                  type="password" 
                  placeholder="새 비밀번호 다시 입력"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({...pwForm, confirm: e.target.value})}
                  inputClassName="!bg-slate-900 border-slate-600 focus:border-blue-500"
                />
                {pwForm.new && pwForm.confirm && pwForm.new !== pwForm.confirm && (
                    <p className="text-xs text-red-400 font-medium">비밀번호가 일치하지 않습니다.</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
               <Button type="submit" variant="primary" className="w-full py-2.5">
                 변경하기
               </Button>
               <Button 
                 type="button" 
                 variant="secondary" 
                 onClick={() => setIsPwModalOpen(false)} 
                 className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200"
               >
                 취소
               </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};