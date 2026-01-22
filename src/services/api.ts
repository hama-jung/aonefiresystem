import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor, Store, WorkLog, Receiver, Repeater, Detector, Transmitter, Alarm, MenuItemDB, CommonCode, FireLog, DeviceStatusLog, DataReceptionLog, RawUartLog, FireHistoryItem, DeviceStatusItem, DataReceptionItem } from '../types';

/**
 * [서버 연동 가이드]
 * Supabase 연동이 우선 적용되며, 연동 실패 시 MOCK 데이터를 반환합니다.
 */

// --- 1. MOCK DATA (Fallback) ---

// 요청된 기본 역할 4개
let MOCK_ROLES: RoleItem[] = [
  { id: 1, code: '7777', name: '지자체', description: '구단위', status: '사용' },
  { id: 2, code: '9999', name: '시스템관리자', description: '시스템관리자', status: '사용' },
  { id: 3, code: '8000', name: '총판관리자', description: '총판관리자', status: '사용' },
  { id: 4, code: '1000', name: '시장관리자', description: '시장관리자', status: '사용' },
];

// 사용자 데이터
let MOCK_USERS: User[] = [
  { id: 1, userId: 'admin', password: '12341234!', name: '관리자', role: '시스템관리자', phone: '010-1234-5678', department: '본사', status: '사용', smsReceive: '수신' },
  { id: 2, userId: 'dist01', password: '12341234!', name: '김총판', role: '총판관리자', phone: '010-9876-5432', department: '경기남부', status: '사용', smsReceive: '미수신' },
  { id: 3, userId: 'market01', password: '12341234!', name: '박시장', role: '시장관리자', phone: '010-5555-4444', department: '부평시장', status: '사용', smsReceive: '수신' },
  { id: 4, userId: 'store01', password: '12341234!', name: '이상인', role: '시장관리자', phone: '010-1111-2222', department: '진라도김치', status: '미사용', smsReceive: '수신' },
];

// 시장 데이터
let MOCK_MARKETS: Market[] = [
  { 
    id: 1, name: '부평자유시장', address: '인천광역시 부평구 시장로 11', addressDetail: '', 
    latitude: '37.4924', longitude: '126.7234', 
    managerName: '홍길동', managerPhone: '010-1234-1234', status: 'Normal',
    distributorId: 1
  },
  { 
    id: 2, name: '대전중앙시장', address: '대전광역시 동구 중교로 12', addressDetail: '', 
    latitude: '36.3288', longitude: '127.4268',
    managerName: '김철수', managerPhone: '010-9876-5432', status: 'Fire',
    distributorId: 1
  },
  { 
    id: 3, name: '서울광장시장', address: '서울특별시 종로구 창경궁로 88', addressDetail: '', 
    latitude: '37.5701', longitude: '126.9997',
    managerName: '이영희', managerPhone: '010-1111-2222', status: 'Normal',
    distributorId: 2
  },
  { 
    id: 4, name: '부산자갈치시장', address: '부산광역시 중구 자갈치해안로 52', addressDetail: '', 
    latitude: '35.0967', longitude: '129.0305',
    managerName: '박민수', managerPhone: '010-3333-4444', status: 'Error',
    distributorId: 2
  },
  { 
    id: 5, name: '대구서문시장', address: '대구광역시 중구 큰장로26길 45', addressDetail: '', 
    latitude: '35.8690', longitude: '128.5815',
    managerName: '최지원', managerPhone: '010-5555-6666', status: 'Normal',
    distributorId: 2
  }
];

let MOCK_DISTRIBUTORS: Distributor[] = [
  { 
    id: 1, name: '미창', address: '경기도 부천시 원미구 도약로 294', addressDetail: '5,7F', 
    latitude: '37.5102443', longitude: '126.7822721', 
    managerName: '미창AS', managerPhone: '01074158119', managerEmail: '', memo: '', status: '사용',
    managedMarkets: ['원주자유시장', '원주시민시장', '원주남부시장', '사직시장', '상동시장']
  },
  { 
    id: 2, name: '디지털허브', address: '서울특별시 성동구 아차산로 17', addressDetail: '101호', 
    latitude: '37.541', longitude: '127.056', 
    managerName: '정진욱팀장', managerPhone: '01071512644', managerEmail: '', memo: '', status: '사용',
    managedMarkets: []
  },
];

// --- 기본 메뉴 데이터 (DB가 비어있을 때 사용) ---
const DEFAULT_MENUS: MenuItemDB[] = [
  { id: 1, label: '대시보드', path: null, icon: 'Home', sortOrder: 10, isVisiblePc: true, isVisibleMobile: true },
  { id: 11, parentId: 1, label: '대시보드1', path: '/dashboard', icon: undefined, sortOrder: 10, isVisiblePc: true, isVisibleMobile: true },
  { id: 12, parentId: 1, label: '대시보드2', path: '/dashboard2', icon: undefined, sortOrder: 20, isVisiblePc: true, isVisibleMobile: true },
  { id: 2, label: '시스템 관리', path: null, icon: 'Settings', sortOrder: 20, isVisiblePc: true, isVisibleMobile: false },
  { id: 21, parentId: 2, label: '사용자 관리', path: '/users', icon: undefined, sortOrder: 10, isVisiblePc: true, isVisibleMobile: false },
  { id: 22, parentId: 2, label: '총판 관리', path: '/distributors', icon: undefined, sortOrder: 20, isVisiblePc: true, isVisibleMobile: false },
  { id: 23, parentId: 2, label: '시장 관리', path: '/markets', icon: undefined, sortOrder: 30, isVisiblePc: true, isVisibleMobile: false },
  { id: 24, parentId: 2, label: '상가 관리', path: '/stores', icon: undefined, sortOrder: 40, isVisiblePc: true, isVisibleMobile: false },
  { id: 25, parentId: 2, label: '문자 전송', path: '/sms', icon: undefined, sortOrder: 50, isVisiblePc: true, isVisibleMobile: false },
  { id: 26, parentId: 2, label: '작업일지', path: '/work-logs', icon: undefined, sortOrder: 60, isVisiblePc: true, isVisibleMobile: true },
  { id: 27, parentId: 2, label: '롤 관리', path: '/roles', icon: undefined, sortOrder: 70, isVisiblePc: true, isVisibleMobile: false },
  { id: 28, parentId: 2, label: '공통코드 관리', path: '/common-codes', icon: undefined, sortOrder: 75, isVisiblePc: true, isVisibleMobile: false },
  { id: 29, parentId: 2, label: '메뉴 관리', path: '/menus', icon: undefined, sortOrder: 80, isVisiblePc: true, isVisibleMobile: false },
  { id: 3, label: '기기 관리', path: null, icon: 'Cpu', sortOrder: 30, isVisiblePc: true, isVisibleMobile: false },
  { id: 31, parentId: 3, label: 'R형 수신기 관리', path: '/receivers', icon: undefined, sortOrder: 10, isVisiblePc: true, isVisibleMobile: false },
  { id: 32, parentId: 3, label: '중계기 관리', path: '/repeaters', icon: undefined, sortOrder: 20, isVisiblePc: true, isVisibleMobile: false },
  { id: 33, parentId: 3, label: '화재감지기 관리', path: '/detectors', icon: undefined, sortOrder: 30, isVisiblePc: true, isVisibleMobile: false },
  { id: 34, parentId: 3, label: '발신기 관리', path: '/transmitters', icon: undefined, sortOrder: 40, isVisiblePc: true, isVisibleMobile: false },
  { id: 35, parentId: 3, label: '경종 관리', path: '/alarms', icon: undefined, sortOrder: 50, isVisiblePc: true, isVisibleMobile: false },
  { id: 4, label: '데이터 관리', path: null, icon: 'Activity', sortOrder: 40, isVisiblePc: true, isVisibleMobile: true },
  { id: 41, parentId: 4, label: '화재 이력 관리', path: '/fire-history', icon: undefined, sortOrder: 10, isVisiblePc: true, isVisibleMobile: true },
  { id: 42, parentId: 4, label: '기기 상태 관리', path: '/device-status', icon: undefined, sortOrder: 20, isVisiblePc: true, isVisibleMobile: true },
  { id: 43, parentId: 4, label: '데이터 수신 관리', path: '/data-reception', icon: undefined, sortOrder: 30, isVisiblePc: true, isVisibleMobile: true },
  { id: 44, parentId: 4, label: 'UART 통신', path: '/uart-communication', icon: undefined, sortOrder: 40, isVisiblePc: true, isVisibleMobile: true },
];

// --- 2. Helper Utilities ---
const simulateDelay = <T>(data: T): Promise<T> => {
  return new Promise(resolve => {
    setTimeout(() => resolve(data), 300 + Math.random() * 300);
  });
};

export const AuthAPI = {
  login: async (id: string, pw: string) => {
    try {
      // 1. Supabase에서 사용자 조회
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('userId', id)
        .single();

      if (!error && data) {
        if (data.password === pw && data.status === '사용') {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { password, ...userInfo } = data;
          return {
            success: true,
            token: 'supabase-session-token', // 실제로는 Supabase Auth Session 사용 권장
            user: userInfo
          };
        }
      }
    } catch (e) {
      console.warn("Supabase login failed, trying mock...", e);
    }

    // 2. Fallback to Mock
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const user = MOCK_USERS.find(u => u.userId === id);
        if (user && user.password === pw && user.status === '사용') {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { password, ...userInfo } = user;
          resolve({
            success: true,
            token: 'mock-jwt-token-12345',
            user: userInfo
          });
        } else {
          reject(new Error('Invalid credentials'));
        }
      }, 500);
    });
  },
  changePassword: async (userId: string, currentPw: string, newPw: string) => {
    // 1. Try Supabase
    try {
      const { data } = await supabase.from('users').select('*').eq('userId', userId).single();
      if (data) {
        if (data.password !== currentPw) throw new Error('현재 비밀번호가 일치하지 않습니다.');
        const { error } = await supabase.from('users').update({ password: newPw }).eq('userId', userId);
        if (!error) return { success: true };
      }
    } catch (e) {
      console.warn("Supabase password update failed, trying mock...", e);
    }

    // 2. Fallback Mock
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const userIndex = MOCK_USERS.findIndex(u => u.userId === userId);
        if (userIndex === -1) { reject(new Error('사용자를 찾을 수 없습니다.')); return; }
        if (MOCK_USERS[userIndex].password !== currentPw) { reject(new Error('현재 비밀번호가 일치하지 않습니다.')); return; }
        MOCK_USERS[userIndex].password = newPw;
        resolve({ success: true });
      }, 500);
    });
  }
};

export const UserAPI = {
  getList: async (params?: { userId?: string, name?: string, role?: string, department?: string }) => {
    try {
      let query = supabase.from('users').select('*').order('id', { ascending: true });
      if (params?.userId) query = query.ilike('userId', `%${params.userId}%`);
      if (params?.name) query = query.ilike('name', `%${params.name}%`);
      if (params?.role && params.role !== '전체') query = query.eq('role', params.role);
      if (params?.department) query = query.ilike('department', `%${params.department}%`);

      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as User[];
    } catch (e) { console.warn("UserAPI fetch failed, using mock"); }

    // Fallback
    let data = [...MOCK_USERS];
    if (params) {
      if (params.userId) data = data.filter(u => u.userId.includes(params.userId!));
      if (params.name) data = data.filter(u => u.name.includes(params.name!));
      if (params.role) data = data.filter(u => u.role === params.role);
      if (params.department) data = data.filter(u => u.department?.includes(params.department!));
    }
    return simulateDelay(data);
  },
  checkDuplicate: async (userId: string) => {
    try {
      const { data } = await supabase.from('users').select('userId').eq('userId', userId);
      if (data && data.length > 0) return true;
    } catch(e) {}
    
    const exists = MOCK_USERS.some(u => u.userId === userId);
    return simulateDelay(exists);
  },
  save: async (user: User) => {
    try {
      if (user.id) {
        // Update
        const { error } = await supabase.from('users').update(user).eq('id', user.id);
        if (!error) return user;
      } else {
        // Insert
        const { error } = await supabase.from('users').insert(user);
        if (!error) return user;
      }
    } catch (e) {}

    // Fallback
    if (user.id) {
      const existing = MOCK_USERS.find(u => u.id === user.id);
      const updatedUser = { ...existing, ...user, password: user.password || existing?.password };
      MOCK_USERS = MOCK_USERS.map(u => u.id === user.id ? updatedUser : u);
      return simulateDelay(updatedUser);
    } else {
      const newUser = { ...user, id: Math.max(...MOCK_USERS.map(u => u.id)) + 1, password: user.password || '12341234!' };
      MOCK_USERS.push(newUser);
      return simulateDelay(newUser);
    }
  },
  delete: async (id: number) => {
    try { await supabase.from('users').delete().eq('id', id); return true; } catch(e) {}
    MOCK_USERS = MOCK_USERS.filter(u => u.id !== id);
    return simulateDelay(true);
  }
};

export const RoleAPI = {
  getList: async (params?: { code?: string, name?: string }) => {
    try {
      let query = supabase.from('roles').select('*').order('id', { ascending: true });
      if (params?.code) query = query.ilike('code', `%${params.code}%`);
      if (params?.name) query = query.ilike('name', `%${params.name}%`);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as RoleItem[];
    } catch (e) {}

    let data = [...MOCK_ROLES];
    if (params) {
      if (params.code) data = data.filter(r => r.code.includes(params.code!));
      if (params.name) data = data.filter(r => r.name.includes(params.name!));
    }
    return simulateDelay(data);
  },
  save: async (role: RoleItem) => {
    try {
      if (role.id) await supabase.from('roles').update(role).eq('id', role.id);
      else await supabase.from('roles').insert(role);
      return role;
    } catch (e) {}

    if (role.id) {
      MOCK_ROLES = MOCK_ROLES.map(r => r.id === role.id ? role : r);
      return simulateDelay(role);
    } else {
      const newRole = { ...role, id: Math.max(...MOCK_ROLES.map(r => r.id)) + 1 };
      MOCK_ROLES.push(newRole);
      return simulateDelay(newRole);
    }
  },
  delete: async (id: number) => {
    try { await supabase.from('roles').delete().eq('id', id); return true; } catch(e) {}
    MOCK_ROLES = MOCK_ROLES.filter(r => r.id !== id);
    return simulateDelay(true);
  }
};

export const CommonAPI = {
  getCompanyList: async (searchName?: string) => {
    // Try Supabase Distributors and Markets
    try {
      const { data: dists } = await supabase.from('distributors').select('id, name, managerName, managerPhone');
      const { data: mkts } = await supabase.from('markets').select('id, name, managerName, managerPhone');
      
      if (dists && mkts) {
        const dList = dists.map((d: any) => ({ id: `D_${d.id}`, name: d.name, type: '총판', manager: d.managerName, phone: d.managerPhone }));
        const mList = mkts.map((m: any) => ({ id: `M_${m.id}`, name: m.name, type: '시장', manager: m.managerName, phone: m.managerPhone }));
        let all = [...dList, ...mList];
        if (searchName) all = all.filter(c => c.name.includes(searchName));
        if (all.length > 0) return all;
      }
    } catch (e) {}

    const distributors = MOCK_DISTRIBUTORS.map(d => ({
      id: `D_${d.id}`, name: d.name, type: '총판', manager: d.managerName, phone: d.managerPhone
    }));
    const markets = MOCK_MARKETS.map(m => ({
      id: `M_${m.id}`, name: m.name, type: '시장', manager: m.managerName, phone: m.managerPhone
    }));
    let all = [...distributors, ...markets];
    if (searchName) {
      all = all.filter(c => c.name.includes(searchName));
    }
    return simulateDelay(all);
  }
};

export const MarketAPI = {
  getList: async (params?: { name?: string, address?: string, managerName?: string }) => {
    try {
      let query = supabase.from('markets').select('*').order('id', { ascending: true });
      if (params?.name) query = query.ilike('name', `%${params.name}%`);
      if (params?.address) query = query.ilike('address', `%${params.address}%`);
      if (params?.managerName) query = query.ilike('managerName', `%${params.managerName}%`);
      
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as Market[];
    } catch(e) {}

    let data = [...MOCK_MARKETS];
    if (params) {
      if (params.name) data = data.filter(m => m.name.includes(params.name!));
      if (params.address) data = data.filter(m => m.address.includes(params.address!));
      if (params.managerName) data = data.filter(m => m.managerName?.includes(params.managerName!));
    }
    return simulateDelay(data);
  },
  save: async (market: Market) => {
    try {
      if (market.id) await supabase.from('markets').update(market).eq('id', market.id);
      else await supabase.from('markets').insert(market);
      return market;
    } catch(e) {}

    if (market.id) {
      MOCK_MARKETS = MOCK_MARKETS.map(m => m.id === market.id ? market : m);
      return simulateDelay(market);
    } else {
      const newMarket = { ...market, id: Math.max(...MOCK_MARKETS.map(m => m.id)) + 1 };
      MOCK_MARKETS.push(newMarket);
      return simulateDelay(newMarket);
    }
  },
  delete: async (id: number) => {
    try { await supabase.from('markets').delete().eq('id', id); return true; } catch(e) {}
    MOCK_MARKETS = MOCK_MARKETS.filter(m => m.id !== id);
    return simulateDelay(true);
  },
  uploadMapImage: async (file: File) => {
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('market-maps').upload(fileName, file);
      if (data) {
        const { data: urlData } = supabase.storage.from('market-maps').getPublicUrl(fileName);
        return urlData.publicUrl;
      }
    } catch(e) {}
    return simulateDelay("https://via.placeholder.com/800x600?text=MarketMap");
  }
};

export const DistributorAPI = {
  getList: async (params?: { address?: string, name?: string, managerName?: string }) => {
    try {
      let query = supabase.from('distributors').select('*').order('id', { ascending: true });
      if (params?.name) query = query.ilike('name', `%${params.name}%`);
      if (params?.managerName) query = query.ilike('managerName', `%${params.managerName}%`);
      // address filtering can be complex, skipping for brevity in try block
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as Distributor[];
    } catch(e) {}

    let data = [...MOCK_DISTRIBUTORS];
    if (params) {
      if (params.address && params.address !== '전체') data = data.filter(d => d.address.includes(params.address!));
      if (params.name) data = data.filter(d => d.name.includes(params.name!));
      if (params.managerName) data = data.filter(d => d.managerName.includes(params.managerName!));
    }
    return simulateDelay(data);
  },
  save: async (dist: Distributor) => {
    try {
      if (dist.id) await supabase.from('distributors').update(dist).eq('id', dist.id);
      else await supabase.from('distributors').insert(dist);
      return dist;
    } catch(e) {}

    if (dist.id) {
      MOCK_DISTRIBUTORS = MOCK_DISTRIBUTORS.map(d => d.id === dist.id ? dist : d);
      return simulateDelay(dist);
    } else {
      const newDist = { ...dist, id: Math.max(...MOCK_DISTRIBUTORS.map(d => d.id), 0) + 1 };
      MOCK_DISTRIBUTORS.push(newDist);
      return simulateDelay(newDist);
    }
  },
  delete: async (id: number) => {
    try { await supabase.from('distributors').delete().eq('id', id); return true; } catch(e) {}
    MOCK_DISTRIBUTORS = MOCK_DISTRIBUTORS.filter(d => d.id !== id);
    return simulateDelay(true);
  }
};

export const StoreAPI = { getList: async (q:any) => simulateDelay([]), save: async (s:any) => simulateDelay(s), delete: async (id:any) => simulateDelay(true), uploadStoreImage: async (f:any) => simulateDelay("url"), saveBulk: async (d:any) => simulateDelay(true) };
export const ReceiverAPI = { getList: async (q?:any) => simulateDelay([]), save: async (r:any) => simulateDelay(r), delete: async (id:any) => simulateDelay(true), uploadImage: async (f:any) => simulateDelay("url"), saveBulk: async (d:any) => simulateDelay(true) };
export const RepeaterAPI = { getList: async (q?:any) => simulateDelay([]), save: async (r:any) => simulateDelay(r), delete: async (id:any) => simulateDelay(true), uploadImage: async (f:any) => simulateDelay("url"), saveBulk: async (d:any) => simulateDelay(true) };
export const DetectorAPI = { getList: async (q?:any) => simulateDelay([]), save: async (d:any) => simulateDelay(d), delete: async (id:any) => simulateDelay(true), saveBulk: async (d:any) => simulateDelay(true) };
export const TransmitterAPI = { getList: async (q?:any) => simulateDelay([]), save: async (t:any) => simulateDelay(t), delete: async (id:any) => simulateDelay(true) };
export const AlarmAPI = { getList: async (q?:any) => simulateDelay([]), save: async (a:any) => simulateDelay(a), delete: async (id:any) => simulateDelay(true) };
export const WorkLogAPI = { getList: async (q?:any) => simulateDelay([]), save: async (l:any) => simulateDelay(l), delete: async (id:any) => simulateDelay(true), uploadAttachment: async (f:any) => simulateDelay("url") };
export const FireHistoryAPI = { getList: async (q?:any) => simulateDelay([]), save: async (id:any, t:any, m:any) => simulateDelay(true), delete: async (id:any) => simulateDelay(true) };
export const DeviceStatusAPI = { getList: async (q?:any) => simulateDelay([]), save: async (id:any, s:any, n:any) => simulateDelay(true), delete: async (id:any) => simulateDelay(true) };
export const DataReceptionAPI = { getList: async (q?:any) => simulateDelay([]), delete: async (id:any) => simulateDelay(true) };
export const CommonCodeAPI = { getList: async (q?:any) => simulateDelay([]), save: async (c:any) => simulateDelay(c), saveBulk: async (c:any) => simulateDelay(true), delete: async (id:any) => simulateDelay(true) };

// --- Menu API 수정: Supabase 연동 및 기본값 제공 ---
export const MenuAPI = { 
  getAll: async () => {
    try {
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .order('sortOrder', { ascending: true });
      
      if (error) {
        console.warn("Menu fetch error, using default:", error);
        return DEFAULT_MENUS;
      }
      
      // DB가 비어있으면 기본값 반환
      if (!data || data.length === 0) {
        return DEFAULT_MENUS;
      }
      
      return data as MenuItemDB[];
    } catch (e) {
      console.error("Supabase connection error, using default menus", e);
      return DEFAULT_MENUS;
    }
  },
  
  getTree: async () => {
    // getAll을 재사용하여 트리 구조 생성
    const list = await MenuAPI.getAll();
    
    const buildTree = (items: MenuItemDB[], parentId: number | null = null): MenuItemDB[] => {
      return items
        .filter(item => (item.parentId || null) === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    };
    
    return buildTree(list);
  },

  toggleVisibility: async () => simulateDelay(true), 
  updateVisibilities: async (updates: any) => simulateDelay(true), 
  save: async (m:any) => simulateDelay(m), 
  delete: async (id:any) => simulateDelay(true) 
};

export const DashboardAPI = { getData: async () => simulateDelay({ stats: [], fireLogs: [], faultLogs: [], mapPoints: [] }) };
