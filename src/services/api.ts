import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor, Store, WorkLog, Receiver, Repeater, Detector, Transmitter, Alarm, MenuItemDB, CommonCode, FireLog, DeviceStatusLog, DataReceptionLog, RawUartLog, FireHistoryItem, DeviceStatusItem, DataReceptionItem } from '../types';

/**
 * [서버 연동 가이드]
 * 현재는 메모리 상의 변수(MOCK_*)를 조작하여 서버 동작을 흉내내고 있습니다.
 * 실제 서버 연동 시에는 아래 함수들의 내부 로직을 axios나 fetch를 사용한 API 호출로 변경하면 됩니다.
 */

// --- 1. MOCK DATA ---

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

// 시장 데이터 (실제 좌표 추가 - 에이원 소방 관제용)
let MOCK_MARKETS: Market[] = [
  { 
    id: 1, name: '부평자유시장', address: '인천광역시 부평구 시장로 11', addressDetail: '', 
    latitude: '37.4924', longitude: '126.7234', // 부평역 인근
    managerName: '홍길동', managerPhone: '010-1234-1234', status: 'Normal',
    distributorId: 1
  },
  { 
    id: 2, name: '대전중앙시장', address: '대전광역시 동구 중교로 12', addressDetail: '', 
    latitude: '36.3288', longitude: '127.4268', // 대전역 인근
    managerName: '김철수', managerPhone: '010-9876-5432', status: 'Fire',
    distributorId: 1
  },
  { 
    id: 3, name: '서울광장시장', address: '서울특별시 종로구 창경궁로 88', addressDetail: '', 
    latitude: '37.5701', longitude: '126.9997', // 광장시장
    managerName: '이영희', managerPhone: '010-1111-2222', status: 'Normal',
    distributorId: 2
  },
  { 
    id: 4, name: '부산자갈치시장', address: '부산광역시 중구 자갈치해안로 52', addressDetail: '', 
    latitude: '35.0967', longitude: '129.0305', // 자갈치시장
    managerName: '박민수', managerPhone: '010-3333-4444', status: 'Error',
    distributorId: 2
  },
  { 
    id: 5, name: '대구서문시장', address: '대구광역시 중구 큰장로26길 45', addressDetail: '', 
    latitude: '35.8690', longitude: '128.5815', // 서문시장
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

// ... (이하 기존 API 코드 유지)

// --- 2. Helper Utilities ---
const simulateDelay = <T>(data: T): Promise<T> => {
  return new Promise(resolve => {
    setTimeout(() => resolve(data), 300 + Math.random() * 300);
  });
};

// ... (AuthAPI, RoleAPI, CommonAPI, UserAPI 등 기존 코드 유지)

export const AuthAPI = {
  login: async (id: string, pw: string) => {
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
    const exists = MOCK_USERS.some(u => u.userId === userId);
    return simulateDelay(exists);
  },
  save: async (user: User) => {
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
    MOCK_USERS = MOCK_USERS.filter(u => u.id !== id);
    return simulateDelay(true);
  }
};

export const RoleAPI = {
  getList: async (params?: { code?: string, name?: string }) => {
    let data = [...MOCK_ROLES];
    if (params) {
      if (params.code) data = data.filter(r => r.code.includes(params.code!));
      if (params.name) data = data.filter(r => r.name.includes(params.name!));
    }
    return simulateDelay(data);
  },
  save: async (role: RoleItem) => {
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
    MOCK_ROLES = MOCK_ROLES.filter(r => r.id !== id);
    return simulateDelay(true);
  }
};

export const CommonAPI = {
  getCompanyList: async (searchName?: string) => {
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
    let data = [...MOCK_MARKETS];
    if (params) {
      if (params.name) data = data.filter(m => m.name.includes(params.name!));
      if (params.address) data = data.filter(m => m.address.includes(params.address!));
      if (params.managerName) data = data.filter(m => m.managerName?.includes(params.managerName!));
    }
    return simulateDelay(data);
  },
  save: async (market: Market) => {
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
    MOCK_MARKETS = MOCK_MARKETS.filter(m => m.id !== id);
    return simulateDelay(true);
  },
  uploadMapImage: async (file: File) => {
    return simulateDelay("https://via.placeholder.com/800x600?text=MarketMap");
  }
};

export const DistributorAPI = {
  getList: async (params?: { address?: string, name?: string, managerName?: string }) => {
    let data = [...MOCK_DISTRIBUTORS];
    if (params) {
      if (params.address && params.address !== '전체') data = data.filter(d => d.address.includes(params.address!));
      if (params.name) data = data.filter(d => d.name.includes(params.name!));
      if (params.managerName) data = data.filter(d => d.managerName.includes(params.managerName!));
    }
    return simulateDelay(data);
  },
  save: async (dist: Distributor) => {
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
    MOCK_DISTRIBUTORS = MOCK_DISTRIBUTORS.filter(d => d.id !== id);
    return simulateDelay(true);
  }
};

// ... (나머지 API Stub들: StoreAPI, ReceiverAPI 등은 기존 파일 내용 유지)
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
export const MenuAPI = { getAll: async () => simulateDelay([] as MenuItemDB[]), getTree: async () => simulateDelay([] as MenuItemDB[]), toggleVisibility: async () => simulateDelay(true), updateVisibilities: async (updates: any) => simulateDelay(true), save: async (m:any) => simulateDelay(m), delete: async (id:any) => simulateDelay(true) };

// Dashboard API도 업데이트된 시장 데이터를 사용하도록 수정할 수 있으나, 
// 여기서는 기본 구조를 유지하고 Dashboard 페이지에서 직접 MarketAPI를 호출하여 마커를 그릴 것입니다.
export const DashboardAPI = { getData: async () => simulateDelay({ stats: [], fireLogs: [], faultLogs: [], mapPoints: [] }) };
