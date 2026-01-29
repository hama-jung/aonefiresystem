
import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor, Store, WorkLog, Receiver, Repeater, Detector, Transmitter, Alarm, MenuItemDB, CommonCode, FireHistoryItem, DeviceStatusItem, DataReceptionItem } from '../types';

// --- Helper Utilities ---

// 파일명 안전하게 변환
const generateSafeFileName = (prefix: string, originalName: string) => {
  const parts = originalName.split('.');
  let ext = parts.length > 1 ? parts.pop() : 'png';
  if (!ext || !/^[a-zA-Z0-9]+$/.test(ext)) { ext = 'png'; }
  const randomStr = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now();
  return `${prefix}_${timestamp}_${randomStr}.${ext}`;
};

// [CRITICAL] DB 저장 전 불필요한 필드 제거 (오류 방지)
// marketId(CamelCase)나 Join된 객체(markets, distributors) 등이 포함되어 있으면 DB 에러 발생함
function cleanPayload<T>(item: T): Partial<T> {
  const payload: any = { ...item };
  
  // 제거할 필드 목록
  const keysToRemove = [
    'marketName', 'distributorName', 'stores', // UI 표시용 Join 필드
    'marketId', // Legacy CamelCase 필드 (DB는 market_id 사용)
    'markets', 'distributors', // Supabase Join 결과 객체
    'users', 'roles' // 기타 Join 객체
  ];
  
  keysToRemove.forEach(key => {
    delete payload[key];
  });
  
  return payload;
}

// 공통 조회 함수 (Reader)
async function supabaseReader<T>(table: string, params?: Record<string, any>, searchFields?: string[], fallbackData: T[] = []) {
  try {
    let query = supabase.from(table).select('*').order('id', { ascending: false });
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all') {
          if (searchFields?.includes(key)) {
            query = query.ilike(key, `%${value}%`);
          } else {
            // market_id 등 정확한 매칭이 필요한 필드 처리
            query = query.eq(key, value);
          }
        }
      });
    }
    const { data, error } = await query;
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      return fallbackData;
    }
    return data as T[];
  } catch (e) {
    console.error(`Exception in reader for ${table}:`, e);
    return fallbackData;
  }
}

// 공통 저장 함수 (Saver - Upsert)
async function supabaseSaver<T extends { id: number }>(table: string, item: T): Promise<T> {
  const { id, ...rest } = item;
  // Payload 정제 (marketId 등 제거)
  const dbData = cleanPayload(rest);
  
  let query;
  if (id && id > 0) {
    query = supabase.from(table).update(dbData).eq('id', id).select();
  } else {
    query = supabase.from(table).insert(dbData).select();
  }
  
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  
  return data[0] as T;
}

// 공통 삭제 함수 (Deleter)
async function supabaseDeleter(table: string, id: number) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

// --- API Services ---

export const AuthAPI = {
  login: async (id: string, pw: string) => {
    try {
      // 실제 DB 사용자 테이블 조회
      const { data } = await supabase.from('users').select('*').eq('userId', id).single();
      
      // 비밀번호 검증 (실제 운영시에는 해시 비교 필요, 현재는 평문 비교)
      if (data && data.password === pw && data.status === '사용') {
        const { password, ...userInfo } = data;
        return { success: true, user: userInfo };
      }
    } catch (e) {
      console.error("Login failed", e);
    }
    throw new Error('아이디나 비밀번호가 틀립니다.');
  },
  changePassword: async (userId: string, currentPw: string, newPw: string) => {
    // 1. 현재 비밀번호 확인
    const { data } = await supabase.from('users').select('password').eq('userId', userId).single();
    if (!data || data.password !== currentPw) {
      throw new Error('현재 비밀번호가 일치하지 않습니다.');
    }
    // 2. 비밀번호 변경
    const { error } = await supabase.from('users').update({ password: newPw }).eq('userId', userId);
    if (error) throw error;
    return { success: true };
  }
};

export const RoleAPI = {
  getList: async (params?: any) => supabaseReader<RoleItem>('roles', params, ['code', 'name']),
  save: async (role: RoleItem) => supabaseSaver('roles', role),
  delete: async (id: number) => supabaseDeleter('roles', id)
};

export const CommonAPI = {
  getCompanyList: async (searchName?: string) => {
    try {
      let dQuery = supabase.from('distributors').select('id, name, managerName, managerPhone');
      if (searchName) dQuery = dQuery.ilike('name', `%${searchName}%`);
      const { data: dists } = await dQuery;

      let mQuery = supabase.from('markets').select('id, name, managerName, managerPhone');
      if (searchName) mQuery = mQuery.ilike('name', `%${searchName}%`);
      const { data: mkts } = await mQuery;
      
      const dList = (dists || []).map((d: any) => ({
        id: `D_${d.id}`, name: d.name, type: '총판', manager: d.managerName, phone: d.managerPhone
      }));
      const mList = (mkts || []).map((m: any) => ({
        id: `M_${m.id}`, name: m.name, type: '시장', manager: m.managerName, phone: m.managerPhone
      }));
      
      return [...dList, ...mList];
    } catch (e) {
      return [];
    }
  }
};

export const UserAPI = {
  getList: async (params?: { userId?: string, name?: string, role?: string, department?: string }) => {
    try {
      // Join distributors and markets to get names
      let query = supabase.from('users')
        .select('*, distributors(name), markets(name)')
        .order('id', { ascending: false });

      if (params?.userId) query = query.ilike('userId', `%${params.userId}%`);
      if (params?.name) query = query.ilike('name', `%${params.name}%`);
      if (params?.role) query = query.eq('role', params.role);
      
      const { data, error } = await query;
      if (error) throw error;

      // Map joined names to 'department' field for UI display
      return (data || []).map((u: any) => ({
        ...u,
        department: u.distributors?.name || u.markets?.name || u.department
      })) as User[];
    } catch (e) {
      return [];
    }
  },
  checkDuplicate: async (id: string) => {
    const { data } = await supabase.from('users').select('id').eq('userId', id);
    return data && data.length > 0;
  },
  save: async (user: User) => supabaseSaver('users', user),
  delete: async (id: number) => supabaseDeleter('users', id)
};

export const MarketAPI = {
  getList: async (params?: { name?: string, address?: string, managerName?: string }) => {
    return supabaseReader<Market>('markets', params, ['name', 'address', 'managerName']);
  },
  save: async (market: Market) => supabaseSaver('markets', market),
  delete: async (id: number) => supabaseDeleter('markets', id),
  uploadMapImage: async (file: File) => {
    const fileName = generateSafeFileName('market', file.name);
    const { data, error } = await supabase.storage.from('market-maps').upload(fileName, file);
    if (error) throw error;
    return supabase.storage.from('market-maps').getPublicUrl(fileName).data.publicUrl;
  }
};

export const DistributorAPI = {
  getList: async (params?: any) => supabaseReader<Distributor>('distributors', params, ['name', 'address', 'managerName']),
  save: async (d: Distributor) => supabaseSaver('distributors', d),
  delete: async (id: number) => supabaseDeleter('distributors', id)
};

export const StoreAPI = {
  getList: async (params?: { address?: string, marketName?: string, storeName?: string, market_id?: number }) => {
    try {
      // markets 테이블과 Join하여 시장 이름 가져오기
      let query = supabase.from('stores')
        .select('*, markets(name)')
        .order('id', { ascending: false });
      
      if (params?.storeName) query = query.ilike('name', `%${params.storeName}%`);
      if (params?.address) query = query.ilike('address', `%${params.address}%`);
      // market_id 필터링 (Snake Case)
      if (params?.market_id) query = query.eq('market_id', params.market_id);
      
      const { data, error } = await query;
      if (error) throw error;

      // Join된 결과 매핑
      return (data || []).map((s: any) => ({
        ...s,
        marketName: s.markets?.name || '-'
      })) as Store[];
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  save: async (store: Store) => {
    // 저장 시에는 반드시 market_id 사용 (payload 정제)
    return supabaseSaver('stores', store);
  },
  delete: async (id: number) => supabaseDeleter('stores', id),
  uploadStoreImage: async (file: File) => {
    const fileName = generateSafeFileName('store', file.name);
    const { data, error } = await supabase.storage.from('store-images').upload(fileName, file);
    if (error) throw error;
    return supabase.storage.from('store-images').getPublicUrl(fileName).data.publicUrl;
  },
  saveBulk: async (stores: Store[]) => {
    const dataToInsert = stores.map(store => cleanPayload(store));
    const { error } = await supabase.from('stores').insert(dataToInsert);
    if (error) throw error;
    return true;
  }
};

export const CommonCodeAPI = {
  getList: async (params?: any) => supabaseReader<CommonCode>('common_codes', params, ['name', 'groupName']),
  save: async (c: CommonCode) => supabaseSaver('common_codes', c),
  saveBulk: async (codes: CommonCode[]) => {
    const dataToInsert = codes.map(c => cleanPayload(c));
    const { error } = await supabase.from('common_codes').insert(dataToInsert);
    if (error) throw error;
    return true;
  },
  delete: async (id: number) => supabaseDeleter('common_codes', id)
};

// Generic device list with market join
async function getDeviceListWithMarket<T>(table: string, params: any) {
  try {
    let query = supabase.from(table).select('*, markets(name)').order('id', { ascending: false });
    
    // Apply filters
    if (params) {
        Object.keys(params).forEach(key => {
            if (params[key] && key !== 'marketName') {
                if(key === 'receiverMac') query = query.ilike(key, `%${params[key]}%`);
                else if (key === 'market_id') query = query.eq('market_id', params[key]);
                else query = query.eq(key, params[key]);
            }
        });
    }
    
    const { data, error } = await query;
    if (error) return [];

    let result = (data || []).map((item: any) => ({
        ...item,
        marketName: item.markets?.name || '-'
    }));

    if (params?.marketName) {
        result = result.filter((item: any) => item.marketName.includes(params.marketName));
    }
    return result as T[];
  } catch(e) { return []; }
}

export const ReceiverAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<Receiver>('receivers', params),
  save: async (r: Receiver) => supabaseSaver('receivers', r),
  saveCoordinates: async (id: number, x: number, y: number) => { 
    await supabase.from('receivers').update({ x_pos: x, y_pos: y }).eq('id', id); 
    return true; 
  },
  delete: async (id: number) => supabaseDeleter('receivers', id),
  uploadImage: async (file: File) => {
    const fileName = generateSafeFileName('rcv', file.name);
    const { data } = await supabase.storage.from('receiver-images').upload(fileName, file);
    return data ? supabase.storage.from('receiver-images').getPublicUrl(fileName).data.publicUrl : '';
  },
  saveBulk: async (data: Receiver[]) => {
      const insertData = data.map(d => cleanPayload(d));
      const { error } = await supabase.from('receivers').insert(insertData);
      if(error) throw error; return true;
  }
};

export const RepeaterAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<Repeater>('repeaters', params),
  save: async (r: Repeater) => supabaseSaver('repeaters', r),
  saveCoordinates: async (id: number, x: number, y: number) => { 
    await supabase.from('repeaters').update({ x_pos: x, y_pos: y }).eq('id', id); 
    return true; 
  },
  delete: async (id: number) => supabaseDeleter('repeaters', id),
  uploadImage: async (file: File) => {
    const fileName = generateSafeFileName('rpt', file.name);
    const { data } = await supabase.storage.from('repeater-images').upload(fileName, file);
    return data ? supabase.storage.from('repeater-images').getPublicUrl(fileName).data.publicUrl : '';
  },
  saveBulk: async (data: Repeater[]) => {
      const insertData = data.map(d => cleanPayload(d));
      const { error } = await supabase.from('repeaters').insert(insertData);
      if(error) throw error; return true;
  }
};

export const DetectorAPI = {
  getList: async (params?: any) => {
    const baseList = await getDeviceListWithMarket<Detector>('detectors', params);
    // Note: Store mapping logic needs to be implemented separately if needed
    // For now, returning base list with market join
    return baseList;
  },
  save: async (detector: Detector) => {
    const { stores, ...rest } = detector;
    const savedDetector = await supabaseSaver('detectors', rest as Detector);
    
    // Update store mapping
    if (savedDetector.id) {
        await supabase.from('detector_stores').delete().eq('detectorId', savedDetector.id);
        if (stores && stores.length > 0) {
            const junctions = stores.map(s => ({ detectorId: savedDetector.id, storeId: s.id }));
            await supabase.from('detector_stores').insert(junctions);
        }
    }
    return savedDetector;
  },
  saveCoordinates: async (id: number, x: number, y: number) => { 
    await supabase.from('detectors').update({ x_pos: x, y_pos: y }).eq('id', id); 
    return true; 
  },
  delete: async (id: number) => supabaseDeleter('detectors', id),
  saveBulk: async (data: Detector[]) => {
      const insertData = data.map(d => cleanPayload(d));
      const { error } = await supabase.from('detectors').insert(insertData);
      if(error) throw error; return true;
  }
};

export const TransmitterAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<Transmitter>('transmitters', params),
  save: async (t: Transmitter) => supabaseSaver('transmitters', t),
  delete: async (id: number) => supabaseDeleter('transmitters', id)
};

export const AlarmAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<Alarm>('alarms', params),
  save: async (a: Alarm) => supabaseSaver('alarms', a),
  delete: async (id: number) => supabaseDeleter('alarms', id)
};

export const WorkLogAPI = {
  getList: async (params?: { marketName?: string }) => getDeviceListWithMarket<WorkLog>('work_logs', params),
  save: async (log: WorkLog) => supabaseSaver('work_logs', log),
  delete: async (id: number) => supabaseDeleter('work_logs', id),
  uploadAttachment: async (file: File) => {
    const fileName = generateSafeFileName('log', file.name);
    const { data } = await supabase.storage.from('work-log-images').upload(fileName, file);
    return data ? supabase.storage.from('work-log-images').getPublicUrl(fileName).data.publicUrl : '';
  }
};

export const DashboardAPI = {
  getData: async () => {
    try {
      const { data: markets } = await supabase.from('markets').select('*');
      
      // Dashboard Stats - Real Counts
      const { count: fireCount } = await supabase.from('fire_history').select('*', { count: 'exact', head: true }).in('falseAlarmStatus', ['화재', '등록']);
      const { count: faultCount } = await supabase.from('device_status').select('*', { count: 'exact', head: true }).eq('deviceStatus', '에러');
      const { count: commCount } = await supabase.from('device_status').select('*', { count: 'exact', head: true }).eq('errorCode', '04'); // Assuming 04 is comm error

      const { data: fireEvents } = await supabase.from('fire_history').select('*, markets(name)').order('registeredAt', { ascending: false }).limit(5);
      const { data: faultEvents } = await supabase.from('device_status').select('*, markets(name)').eq('deviceStatus', '에러').order('registeredAt', { ascending: false }).limit(5);
      
      const mappedFire = (fireEvents || []).map((e: any) => ({
        id: e.id,
        msg: `${e.markets?.name || '알수없음'} ${e.detectorInfoChamber || '화재감지'}`,
        time: e.registeredAt,
        marketId: e.market_id
      }));

      const mappedFault = (faultEvents || []).map((e: any) => ({
        id: e.id,
        msg: `${e.markets?.name || '알수없음'} ${e.deviceType} ${e.deviceId} 에러`,
        time: e.registeredAt,
        marketId: e.market_id
      }));

      // Map Data - Status Calculation
      const mapData = (markets || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        x: m.latitude,
        y: m.longitude,
        address: m.address,
        status: m.status || 'Normal'
      }));

      return {
        stats: [
          { label: '최근 화재 발생', value: fireCount || 0, type: 'fire', color: 'bg-red-500' },
          { label: '최근 고장 발생', value: faultCount || 0, type: 'fault', color: 'bg-orange-500' },
          { label: '통신 이상', value: commCount || 0, type: 'error', color: 'bg-gray-500' },
        ],
        fireEvents: mappedFire,
        faultEvents: mappedFault,
        commEvents: [], // Comm logs not fully implemented in mock view
        mapData: mapData
      };
    } catch (e) {
      console.error(e);
      return { stats: [], fireEvents: [], faultEvents: [], commEvents: [], mapData: [] };
    }
  }
};

export const MenuAPI = {
  getAll: async () => supabaseReader<MenuItemDB>('menus', undefined, undefined, []),
  getTree: async () => { return []; }, // simplified for flat list usage in some contexts
  save: async (m: MenuItemDB) => supabaseSaver('menus', m),
  delete: async (id: number) => supabaseDeleter('menus', id),
  updateVisibilities: async (u: any) => { await supabase.from('menus').upsert(u); return true; }
};

export const FireHistoryAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<FireHistoryItem>('fire_history', params),
  save: async (id: number, status: string, note: string) => {
    await supabase.from('fire_history').update({ falseAlarmStatus: status, note: note }).eq('id', id);
    return true;
  },
  delete: async (id: number) => supabaseDeleter('fire_history', id)
};

export const DeviceStatusAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<DeviceStatusItem>('device_status', params),
  save: async (id: number, status: string, note: string) => {
    await supabase.from('device_status').update({ processStatus: status, note: note }).eq('id', id);
    return true;
  },
  delete: async (id: number) => supabaseDeleter('device_status', id)
};

export const DataReceptionAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<DataReceptionItem>('data_reception', params),
  delete: async (id: number) => supabaseDeleter('data_reception', id)
};
