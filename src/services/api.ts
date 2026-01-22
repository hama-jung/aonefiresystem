import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor, Store, WorkLog, Receiver, Repeater, Detector, Transmitter, Alarm, MenuItemDB, CommonCode, FireHistoryItem, DeviceStatusItem, DataReceptionItem } from '../types';

/**
 * [API 서비스 정책 - 수정됨]
 * 1. 읽기(Read): Supabase 조회 실패 시에만 Mock 데이터 반환 (화면 꺼짐 방지)
 * 2. 쓰기(Write - Save/Update/Delete): 
 *    - 반드시 실제 DB 결과를 반환해야 함. 
 *    - Mock 데이터를 반환하면 ID가 0이 되거나 수정 사항이 반영되지 않는 치명적 오류 발생.
 *    - 따라서 쓰기 작업은 실패 시 에러를 throw하여 사용자가 인지하게 함.
 */

// --- 1. MOCK DATA (Fallback용 임시 데이터 - 읽기 실패 시에만 사용) ---

const MOCK_ROLES: RoleItem[] = [
  { id: 1, code: '7777', name: '지자체', description: '구단위', status: '사용' },
  { id: 2, code: '9999', name: '시스템관리자', description: '시스템관리자', status: '사용' },
  { id: 3, code: '8000', name: '총판관리자', description: '총판관리자', status: '사용' },
  { id: 4, code: '1000', name: '시장관리자', description: '시장관리자', status: '사용' },
];

const MOCK_USERS: User[] = [
  { id: 1, userId: 'admin', password: '12341234!', name: '관리자', role: '시스템관리자', phone: '010-1234-5678', department: '본사', status: '사용', smsReceive: '수신' },
  { id: 2, userId: 'dist01', password: '12341234!', name: '김총판', role: '총판관리자', phone: '010-9876-5432', department: '경기남부', status: '사용', smsReceive: '미수신' },
];

const MOCK_MARKETS: Market[] = [
  { 
    id: 1, name: '부평자유시장', address: '인천광역시 부평구 시장로 11', addressDetail: '', 
    latitude: '37.4924', longitude: '126.7234', 
    managerName: '홍길동', managerPhone: '010-1234-1234', status: 'Normal',
    distributorId: 1
  }
];

const MOCK_DISTRIBUTORS: Distributor[] = [
  { 
    id: 1, name: '미창', address: '경기도 부천시 원미구 도약로 294', addressDetail: '5,7F', 
    latitude: '37.5102443', longitude: '126.7822721', 
    managerName: '미창AS', managerPhone: '01074158119', managerEmail: '', memo: '', status: '사용',
    managedMarkets: ['원주자유시장']
  }
];

// Mock Menus: Updated with permission flags
const MOCK_MENUS: MenuItemDB[] = [
  { id: 1, label: '대시보드', path: '/dashboard', icon: 'Home', sortOrder: 1, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 2, label: '시스템 관리', icon: 'Settings', sortOrder: 2, isVisiblePc: true, isVisibleMobile: true, allowDistributor: false, allowMarket: false, allowLocal: false },
  { id: 3, parentId: 2, label: '사용자 관리', path: '/users', sortOrder: 1, isVisiblePc: true, isVisibleMobile: true, allowDistributor: false, allowMarket: false, allowLocal: false },
  { id: 4, parentId: 2, label: '총판 관리', path: '/distributors', sortOrder: 2, isVisiblePc: true, isVisibleMobile: true, allowDistributor: false, allowMarket: false, allowLocal: false },
  { id: 5, parentId: 2, label: '시장 관리', path: '/markets', sortOrder: 3, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: false, allowLocal: true },
  { id: 6, parentId: 2, label: '상가 관리', path: '/stores', sortOrder: 4, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 7, parentId: 2, label: '문자 전송', path: '/sms', sortOrder: 5, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: false },
  { id: 8, parentId: 2, label: '롤 관리', path: '/roles', sortOrder: 6, isVisiblePc: true, isVisibleMobile: true, allowDistributor: false, allowMarket: false, allowLocal: false },
  { id: 9, parentId: 2, label: '작업 일지', path: '/work-logs', sortOrder: 7, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 10, parentId: 2, label: '메뉴 관리', path: '/menus', sortOrder: 8, isVisiblePc: true, isVisibleMobile: true, allowDistributor: false, allowMarket: false, allowLocal: false },
  { id: 11, parentId: 2, label: '공통코드 관리', path: '/common-codes', sortOrder: 9, isVisiblePc: true, isVisibleMobile: true, allowDistributor: false, allowMarket: false, allowLocal: false },
  { id: 12, label: '기기 관리', icon: 'Cpu', sortOrder: 3, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 13, parentId: 12, label: 'R형 수신기', path: '/receivers', sortOrder: 1, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 14, parentId: 12, label: '중계기 관리', path: '/repeaters', sortOrder: 2, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 15, parentId: 12, label: '화재감지기', path: '/detectors', sortOrder: 3, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 16, parentId: 12, label: '발신기 관리', path: '/transmitters', sortOrder: 4, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 17, parentId: 12, label: '경종 관리', path: '/alarms', sortOrder: 5, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 18, label: '데이터 관리', icon: 'Activity', sortOrder: 4, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 19, parentId: 18, label: '화재 이력 관리', path: '/fire-history', sortOrder: 1, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 20, parentId: 18, label: '기기 상태 관리', path: '/device-status', sortOrder: 2, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 21, parentId: 18, label: '데이터 수신 관리', path: '/data-reception', sortOrder: 3, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: true, allowLocal: true },
  { id: 22, parentId: 18, label: 'UART 통신', path: '/uart-communication', sortOrder: 4, isVisiblePc: true, isVisibleMobile: true, allowDistributor: true, allowMarket: false, allowLocal: false },
];

// --- 2. Helper Utilities ---

// Generic Supabase Reader (읽기 전용)
async function supabaseReader<T>(
  table: string, 
  params?: Record<string, string>, 
  searchFields?: string[],
  fallbackData: T[] = []
) {
  try {
    let query = supabase.from(table).select('*').order('id', { ascending: false });
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all') { // 'all'은 전체 조회로 간주
          if (searchFields?.includes(key)) {
            query = query.ilike(key, `%${value}%`);
          } else {
            query = query.eq(key, value);
          }
        }
      });
    }
    
    const { data, error } = await query;
    if (error) {
        console.warn(`Supabase read error on ${table} (Using Mock):`, error.message);
        return fallbackData;
    }
    // 데이터가 [] (빈배열)인 경우는 실제 데이터가 없는 것이므로 빈배열 반환이 맞음.
    // 단, 테이블 자체가 없거나 연결 오류 시 undefined가 올 수 있음.
    if (data === null) return fallbackData;
    
    return data as T[];
  } catch (e) {
    console.error(`Unexpected error reading ${table}:`, e);
    return fallbackData;
  }
}

// Generic Supabase Saver (저장/수정 전용 - 중요!)
// 입력받은 ID가 0이면 Insert, 아니면 Update 수행 후 *실제 DB 데이터*를 반환
async function supabaseSaver<T extends { id: number }>(table: string, item: T): Promise<T> {
  // 1. ID 분리 (Insert 시 ID가 0이면 DB가 자동생성하도록 제외해야 함)
  const { id, ...rest } = item;
  
  let query;
  if (id && id > 0) {
    // Update: ID로 찾아서 업데이트하고, 업데이트된 행을 반환(.select())
    query = supabase.from(table).update(rest).eq('id', id).select();
  } else {
    // Insert: ID 제외하고 삽입, 삽입된 행을 반환(.select())
    query = supabase.from(table).insert(rest).select();
  }

  const { data, error } = await query;
  
  if (error) {
    console.error(`Save failed for ${table}:`, error);
    throw new Error(error.message); // 에러를 던져서 UI가 알게 함
  }
  
  if (!data || data.length === 0) {
    throw new Error('데이터 저장 후 반환된 결과가 없습니다.');
  }

  return data[0] as T; // 실제 저장된 데이터(ID 포함) 반환
}

async function supabaseDeleter(table: string, id: number) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

// --- API IMPLEMENTATIONS ---

export const AuthAPI = {
  login: async (id: string, pw: string) => {
    // 1. 실제 DB 로그인 시도
    try {
      const { data, error } = await supabase.from('users').select('*').eq('userId', id).single();
      if (!error && data) {
        if (data.password === pw && data.status === '사용') {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { password, ...userInfo } = data;
          return { success: true, token: 'supabase-token', user: userInfo };
        }
      }
    } catch (e) {}
    
    // 2. 실패 시 Mock 로그인 시도 (데모용)
    const user = MOCK_USERS.find(u => u.userId === id);
    if (user && user.password === pw && user.status === '사용') {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userInfo } = user;
        return { success: true, token: 'mock-token', user: userInfo };
    }
    throw new Error('아이디 또는 비밀번호가 잘못되었습니다.');
  },
  changePassword: async (userId: string, currentPw: string, newPw: string) => {
    // 비밀번호 변경은 실제 DB에만 적용
    const { data } = await supabase.from('users').select('*').eq('userId', userId).single();
    if (!data) throw new Error('사용자를 찾을 수 없습니다.');
    if (data.password !== currentPw) throw new Error('현재 비밀번호 불일치');
    
    const { error } = await supabase.from('users').update({ password: newPw }).eq('userId', userId);
    if (error) throw error;
    return { success: true };
  }
};

export const UserAPI = {
  getList: async (params?: { userId?: string, name?: string, role?: string, department?: string }) => {
    return supabaseReader<User>('users', params as any, ['userId', 'name', 'department'], MOCK_USERS);
  },
  checkDuplicate: async (userId: string) => {
    const { data } = await supabase.from('users').select('id').eq('userId', userId);
    return data && data.length > 0;
  },
  save: async (user: User) => {
    return supabaseSaver('users', user);
  },
  delete: async (id: number) => {
    return supabaseDeleter('users', id);
  }
};

export const RoleAPI = {
  getList: async (params?: { code?: string, name?: string }) => {
    return supabaseReader<RoleItem>('roles', params as any, ['code', 'name'], MOCK_ROLES);
  },
  save: async (role: RoleItem) => {
    return supabaseSaver('roles', role);
  },
  delete: async (id: number) => {
    return supabaseDeleter('roles', id);
  }
};

export const CommonAPI = {
  getCompanyList: async (searchName?: string) => {
    try {
      // 1. 총판 목록 조회
      let dQuery = supabase.from('distributors').select('id, name, managerName, managerPhone');
      if(searchName) dQuery = dQuery.ilike('name', `%${searchName}%`);
      const { data: dists } = await dQuery;

      // 2. 시장 목록 조회
      let mQuery = supabase.from('markets').select('id, name, managerName, managerPhone');
      if(searchName) mQuery = mQuery.ilike('name', `%${searchName}%`);
      const { data: mkts } = await mQuery;
      
      const dList = (dists || []).map((d: any) => ({ id: `D_${d.id}`, name: d.name, type: '총판', manager: d.managerName, phone: d.managerPhone }));
      const mList = (mkts || []).map((m: any) => ({ id: `M_${m.id}`, name: m.name, type: '시장', manager: m.managerName, phone: m.managerPhone }));
      
      let all = [...dList, ...mList];
      
      // 데이터 없으면 Mock 반환 (검색어가 없을때만)
      if (all.length === 0 && !searchName) {
          const dMock = MOCK_DISTRIBUTORS.map(d => ({ id: `D_${d.id}`, name: d.name, type: '총판', manager: d.managerName, phone: d.managerPhone }));
          const mMock = MOCK_MARKETS.map(m => ({ id: `M_${m.id}`, name: m.name, type: '시장', manager: m.managerName, phone: m.managerPhone }));
          all = [...dMock, ...mMock];
      }
      return all;
    } catch (e) {
      return [];
    }
  }
};

export const MarketAPI = {
  getList: async (params?: { name?: string, address?: string, managerName?: string }) => {
    return supabaseReader<Market>('markets', params as any, ['name', 'address', 'managerName'], MOCK_MARKETS);
  },
  save: async (market: Market) => {
    return supabaseSaver('markets', market);
  },
  delete: async (id: number) => {
    return supabaseDeleter('markets', id);
  },
  uploadMapImage: async (file: File) => {
    const fileName = `market_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('market-maps').upload(fileName, file);
    if (error) {
        console.error("Image Upload Error:", error);
        throw new Error('이미지 업로드 실패: ' + error.message);
    }
    if (data) {
      const { data: urlData } = supabase.storage.from('market-maps').getPublicUrl(fileName);
      return urlData.publicUrl;
    }
    return '';
  }
};

export const DistributorAPI = {
  getList: async (params?: { address?: string, name?: string, managerName?: string }) => {
    return supabaseReader<Distributor>('distributors', params as any, ['address', 'name', 'managerName'], MOCK_DISTRIBUTORS);
  },
  save: async (dist: Distributor) => {
    return supabaseSaver('distributors', dist);
  },
  delete: async (id: number) => {
    return supabaseDeleter('distributors', id);
  }
};

export const StoreAPI = { 
  getList: async (params?: { address?: string, marketName?: string, storeName?: string, marketId?: number }) => {
    try {
      let query = supabase.from('stores').select('*').order('id', { ascending: false });
      if (params?.storeName) query = query.ilike('name', `%${params.storeName}%`);
      if (params?.address) query = query.ilike('address', `%${params.address}%`);
      if (params?.marketId) query = query.eq('marketId', params.marketId);
      if (params?.marketName) query = query.ilike('marketName', `%${params.marketName}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Store[];
    } catch (e) {
      // Stores는 Mock 데이터가 없으므로 빈 배열 반환
      return [];
    }
  }, 
  save: async (store: Store) => {
    return supabaseSaver('stores', store);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('stores', id);
  }, 
  uploadStoreImage: async (file: File) => {
    const fileName = `store_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('store-images').upload(fileName, file);
    if (error) throw error;
    if (data) {
      const { data: urlData } = supabase.storage.from('store-images').getPublicUrl(fileName);
      return urlData.publicUrl;
    }
    return '';
  }, 
  saveBulk: async (stores: Store[]) => {
    // Bulk Insert (ID 제외)
    const storesToInsert = stores.map(({ id, ...rest }) => rest);
    const { error } = await supabase.from('stores').insert(storesToInsert);
    if (error) throw error;
    return true;
  } 
};

export const CommonCodeAPI = { 
  getList: async (params?: { groupName?: string, name?: string }) => {
    return supabaseReader<CommonCode>('common_codes', params as any, ['groupName', 'name', 'code']);
  }, 
  save: async (code: CommonCode) => {
    return supabaseSaver('common_codes', code);
  }, 
  saveBulk: async (codes: CommonCode[]) => {
    const dataToInsert = codes.map(({ id, ...rest }) => rest);
    const { error } = await supabase.from('common_codes').insert(dataToInsert);
    if (error) throw error;
    return true;
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('common_codes', id);
  } 
};

export const WorkLogAPI = { 
  getList: async (params?: { marketName?: string }) => {
    try {
      // Join Query: work_logs + markets(name)
      let query = supabase.from('work_logs').select('*, markets(name)').order('workDate', { ascending: false });
      // Note: Supabase complex filtering on joined table needs explicit handling or stored procedures.
      // Here we filter locally for simplicity if needed, or rely on client filtering.
      
      const { data, error } = await query;
      
      if (!error && data) {
        let result = data.map((log: any) => ({
          ...log,
          marketName: log.markets?.name || 'Unknown'
        }));
        if (params?.marketName) {
            result = result.filter((l: any) => l.marketName.includes(params.marketName));
        }
        return result as WorkLog[];
      }
      return [];
    } catch(e) {
      return [];
    }
  }, 
  save: async (log: WorkLog) => {
    // marketName은 Join된 필드이므로 저장 시 제외해야 함
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { marketName, ...saveData } = log;
    return supabaseSaver('work_logs', saveData as WorkLog);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('work_logs', id);
  }, 
  uploadAttachment: async (file: File) => {
    const fileName = `log_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('work-log-images').upload(fileName, file);
    if (error) throw error;
    if (data) {
      const { data: urlData } = supabase.storage.from('work-log-images').getPublicUrl(fileName);
      return urlData.publicUrl;
    }
    return '';
  } 
};

export const ReceiverAPI = { 
  getList: async (params?: { marketName?: string, macAddress?: string, ip?: string, emergencyPhone?: string }) => {
    try {
      let query = supabase.from('receivers').select('*, markets(name)').order('id', { ascending: false });
      if (params?.macAddress) query = query.ilike('macAddress', `%${params.macAddress}%`);
      if (params?.ip) query = query.ilike('ip', `%${params.ip}%`);
      if (params?.emergencyPhone) query = query.ilike('emergencyPhone', `%${params.emergencyPhone}%`);
      
      const { data, error } = await query;
      if (!error && data) {
        let result = data.map((r: any) => ({ ...r, marketName: r.markets?.name }));
        if (params?.marketName) {
            result = result.filter(r => r.marketName?.includes(params.marketName));
        }
        return result as Receiver[];
      }
      return [];
    } catch(e) { return []; }
  }, 
  save: async (receiver: Receiver) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { marketName, ...saveData } = receiver;
    return supabaseSaver('receivers', saveData as Receiver);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('receivers', id);
  }, 
  uploadImage: async (file: File) => {
    const fileName = `rcv_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('receiver-images').upload(fileName, file);
    if (error) throw error;
    if (data) {
      const { data: urlData } = supabase.storage.from('receiver-images').getPublicUrl(fileName);
      return urlData.publicUrl;
    }
    return '';
  }, 
  saveBulk: async (data: Receiver[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const insertData = data.map(({ id, marketName, ...rest }) => rest);
    const { error } = await supabase.from('receivers').insert(insertData);
    if (error) throw error;
    return true;
  } 
};

export const RepeaterAPI = { 
  getList: async (params?: any) => {
    try {
      let query = supabase.from('repeaters').select('*, markets(name)').order('id', { ascending: false });
      if (params?.receiverMac) query = query.ilike('receiverMac', `%${params.receiverMac}%`);
      if (params?.repeaterId) query = query.eq('repeaterId', params.repeaterId);
      
      const { data, error } = await query;
      if (!error && data) {
        let result = data.map((r: any) => ({ ...r, marketName: r.markets?.name }));
        if (params?.marketName) result = result.filter(r => r.marketName?.includes(params.marketName));
        return result as Repeater[];
      }
      return [];
    } catch(e) { return []; }
  }, 
  save: async (repeater: Repeater) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { marketName, ...saveData } = repeater;
    return supabaseSaver('repeaters', saveData as Repeater);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('repeaters', id);
  }, 
  uploadImage: async (file: File) => {
    const fileName = `rpt_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('repeater-images').upload(fileName, file);
    if (error) throw error;
    if (data) {
      const { data: urlData } = supabase.storage.from('repeater-images').getPublicUrl(fileName);
      return urlData.publicUrl;
    }
    return '';
  }, 
  saveBulk: async (data: Repeater[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const insertData = data.map(({ id, marketName, ...rest }) => rest);
    const { error } = await supabase.from('repeaters').insert(insertData);
    if (error) throw error;
    return true;
  } 
};

export const DetectorAPI = { 
  getList: async (params?: any) => {
    try {
      // 1. 감지기 정보 조회
      let query = supabase.from('detectors').select('*, markets(name)').order('id', { ascending: false });
      if (params?.receiverMac) query = query.ilike('receiverMac', `%${params.receiverMac}%`);
      
      const { data: detectors, error } = await query;
      if (error || !detectors) return [];

      // 2. 각 감지기의 상가 매핑 정보 조회 (junction table)
      const detectorIds = detectors.map(d => d.id);
      const { data: junctions } = await supabase
        .from('detector_stores')
        .select('detectorId, storeId, stores(name)')
        .in('detectorId', detectorIds);

      // 3. 데이터 병합
      let result = detectors.map((d: any) => {
        const myJunctions = junctions?.filter((j: any) => j.detectorId === d.id) || [];
        const stores = myJunctions.map((j: any) => ({ id: j.storeId, name: j.stores?.name }));
        
        return {
            ...d,
            marketName: d.markets?.name,
            stores: stores
        };
      });

      if (params?.marketName) result = result.filter(r => r.marketName?.includes(params.marketName));
      return result as Detector[];
    } catch(e) { return []; }
  }, 
  save: async (detector: Detector) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { marketName, stores, ...saveData } = detector;
    
    // 1. 감지기 기본 정보 저장 (ID 반환 중요)
    const savedDetector = await supabaseSaver('detectors', saveData as Detector);
    const savedId = savedDetector.id;

    // 2. 상가 연결 정보 저장 (다대다)
    // 기존 연결 모두 삭제 후 재생성 (간단한 처리)
    await supabase.from('detector_stores').delete().eq('detectorId', savedId);
    
    if (stores && stores.length > 0) {
        const junctions = stores.map(s => ({ detectorId: savedId, storeId: s.id }));
        const { error } = await supabase.from('detector_stores').insert(junctions);
        if (error) throw new Error('상가 연결 저장 실패: ' + error.message);
    }
    
    return savedDetector;
  }, 
  delete: async (id: number) => {
    // Junction 테이블은 Cascade Delete 설정되어 있으므로 부모만 지우면 됨
    return supabaseDeleter('detectors', id);
  }, 
  saveBulk: async (data: Detector[]) => {
    // Bulk Insert (Stores 연결은 제외하고 기본 정보만)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const insertData = data.map(({ id, marketName, stores, ...rest }) => rest);
    const { error } = await supabase.from('detectors').insert(insertData);
    if (error) throw error;
    return true;
  } 
};

export const TransmitterAPI = { 
  getList: async (params?: any) => {
    try {
        let query = supabase.from('transmitters').select('*, markets(name)').order('id', { ascending: false });
        const { data, error } = await query;
        if (!error && data) {
            let result = data.map((t: any) => ({ ...t, marketName: t.markets?.name }));
            if (params?.marketName) result = result.filter(r => r.marketName?.includes(params.marketName));
            return result as Transmitter[];
        }
    } catch(e) {}
    return [];
  }, 
  save: async (t: Transmitter) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { marketName, ...saveData } = t;
    return supabaseSaver('transmitters', saveData as Transmitter);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('transmitters', id);
  } 
};

export const AlarmAPI = { 
  getList: async (params?: any) => {
    try {
        let query = supabase.from('alarms').select('*, markets(name)').order('id', { ascending: false });
        const { data, error } = await query;
        if (!error && data) {
            let result = data.map((a: any) => ({ ...a, marketName: a.markets?.name }));
            if (params?.marketName) result = result.filter(r => r.marketName?.includes(params.marketName));
            return result as Alarm[];
        }
    } catch(e) {}
    return [];
  }, 
  save: async (a: Alarm) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { marketName, ...saveData } = a;
    return supabaseSaver('alarms', saveData as Alarm);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('alarms', id);
  } 
};

// --- Log & Data APIs ---

export const FireHistoryAPI = { 
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string, status?: string }) => {
    // Mock 데이터 대신 실제 DB만 조회
    let query = supabase.from('fire_history').select('*').order('registeredAt', { ascending: false });
    
    if (params?.startDate) query = query.gte('registeredAt', `${params.startDate}T00:00:00`);
    if (params?.endDate) query = query.lte('registeredAt', `${params.endDate}T23:59:59`);
    if (params?.marketName) query = query.ilike('marketName', `%${params.marketName}%`);
    if (params?.status && params.status !== 'all') {
        if (params.status === 'fire') query = query.eq('falseAlarmStatus', '화재');
        else if (params.status === 'false') query = query.eq('falseAlarmStatus', '오탐');
    }

    const { data, error } = await query;
    if (error) {
        console.warn(error);
        return [];
    }
    return data as FireHistoryItem[];
  }, 
  save: async (id: number, type: string, note: string) => {
    const { error } = await supabase.from('fire_history').update({ falseAlarmStatus: type, note }).eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('fire_history', id);
  } 
};

export const DeviceStatusAPI = { 
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string, status?: string }) => {
    let query = supabase.from('device_status').select('*').order('registeredAt', { ascending: false });
    
    if (params?.startDate) query = query.gte('registeredAt', `${params.startDate}T00:00:00`);
    if (params?.endDate) query = query.lte('registeredAt', `${params.endDate}T23:59:59`);
    if (params?.marketName) query = query.ilike('marketName', `%${params.marketName}%`);
    if (params?.status && params.status !== 'all') {
        if (params.status === 'processed') query = query.eq('processStatus', '처리');
        else if (params.status === 'unprocessed') query = query.eq('processStatus', '미처리');
    }

    const { data } = await query;
    return (data || []) as DeviceStatusItem[];
  }, 
  save: async (id: number, status: string, note: string) => {
    const { error } = await supabase.from('device_status').update({ processStatus: status, note }).eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('device_status', id);
  } 
};

export const DataReceptionAPI = { 
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string }) => {
    let query = supabase.from('data_reception').select('*').order('registeredAt', { ascending: false });
    
    if (params?.startDate) query = query.gte('registeredAt', `${params.startDate}T00:00:00`);
    if (params?.endDate) query = query.lte('registeredAt', `${params.endDate}T23:59:59`);
    if (params?.marketName) query = query.ilike('marketName', `%${params.marketName}%`);

    const { data } = await query;
    return (data || []) as DataReceptionItem[];
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('data_reception', id);
  } 
};

export const MenuAPI = { 
  getAll: async () => {
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .order('sortOrder', { ascending: true });
    
    if (error || !data || data.length === 0) {
      // 메뉴 테이블이 없을 때만 Mock 반환 (사이드바 깨짐 방지)
      return MOCK_MENUS;
    }
    return data as MenuItemDB[];
  },
  
  getTree: async () => {
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

  updateVisibilities: async (updates: any) => {
    // Upsert expects an array of objects to update/insert
    // We map the updates to match the DB schema
    const { error } = await supabase.from('menus').upsert(updates);
    if (error) throw new Error(error.message);
    return true;
  }, 
  save: async (m: MenuItemDB) => {
    return supabaseSaver('menus', m);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('menus', id);
  } 
};

export const DashboardAPI = { 
    getData: async () => {
        try {
            // [수정됨] 실제 DB 데이터 조회 (최근 20건 제한)
            
            // 1. 화재 건수 (등록 상태) & 리스트
            const { data: fireLogs, count: fireCount } = await supabase
                .from('fire_history')
                .select('*', { count: 'exact' })
                .eq('falseAlarmStatus', '등록') // '등록' 상태인 것만 대시보드에 화재 알림으로 표시 (필요시 '화재'로 변경)
                .order('registeredAt', { ascending: false })
                .limit(20);

            // 2. 고장 건수 & 리스트 (장치 상태 '에러')
            // - 통신이상(04)은 별도 분리, 그 외 에러만 조회
            const { data: faultLogs, count: faultCount } = await supabase
                .from('device_status')
                .select('*', { count: 'exact' })
                .eq('deviceStatus', '에러')
                .neq('errorCode', '04') // 통신이상 제외
                .order('registeredAt', { ascending: false })
                .limit(20);

            // 3. 통신 이상 건수 & 리스트 (에러코드 04)
            const { data: commLogs, count: commCount } = await supabase
                .from('device_status')
                .select('*', { count: 'exact' })
                .eq('errorCode', '04')
                .order('registeredAt', { ascending: false })
                .limit(20);

            return {
                stats: [
                    { label: '최근 화재 발생', value: fireCount || 0, type: 'fire', color: 'bg-red-600' },
                    { label: '최근 고장 발생', value: faultCount || 0, type: 'fault', color: 'bg-orange-500' },
                    { label: '통신 이상', value: commCount || 0, type: 'error', color: 'bg-slate-600' },
                ],
                // UI 형식으로 매핑
                fireEvents: (fireLogs || []).map((l: any) => ({
                    id: l.id,
                    msg: `${l.marketName} - ${l.detectorInfoChamber || '화재감지'}`,
                    time: l.registeredAt,
                    marketName: l.marketName,
                    type: 'fire'
                })),
                faultEvents: (faultLogs || []).map((l: any) => ({
                    id: l.id,
                    msg: `${l.marketName} ${l.deviceType} ${l.deviceId} 에러`,
                    time: l.registeredAt,
                    marketName: l.marketName,
                    type: 'fault'
                })),
                commEvents: (commLogs || []).map((l: any) => ({
                    id: l.id,
                    market: l.marketName,
                    address: `${l.deviceType} ${l.deviceId}`,
                    receiver: l.receiverMac,
                    time: l.registeredAt
                })),
            };
        } catch (e) {
            console.error("Dashboard Load Error:", e);
            // 에러 시 빈 객체 반환
            return {
                stats: [], fireEvents: [], faultEvents: [], commEvents: []
            };
        }
    } 
};