import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor, Store, WorkLog, Receiver, Repeater, Detector, Transmitter, Alarm, MenuItemDB, CommonCode, FireHistoryItem, DeviceStatusItem, DataReceptionItem } from '../types';

// --- DB Column Whitelists (CamelCase 기준) ---
const STORE_COLS = ['marketId', 'name', 'managerName', 'managerPhone', 'status', 'storeImage', 'memo', 'receiverMac', 'repeaterId', 'detectorId', 'mode', 'address', 'addressDetail', 'handlingItems'];
const USER_COLS = ['userId', 'password', 'name', 'role', 'phone', 'email', 'department', 'administrativeArea', 'distributorId', 'marketId', 'status', 'smsReceive'];
const MARKET_COLS = ['distributorId', 'name', 'address', 'addressDetail', 'zipCode', 'latitude', 'longitude', 'managerName', 'managerPhone', 'managerEmail', 'memo', 'enableMarketSms', 'enableStoreSms', 'enableMultiMedia', 'multiMediaType', 'usageStatus', 'enableDeviceFaultSms', 'enableCctvUrl', 'smsFire', 'smsFault', 'mapImage', 'mapImages', 'status'];
const DEVICE_BASE_COLS = ['marketId', 'receiverMac', 'repeaterId', 'status', 'memo', 'x_pos', 'y_pos'];

// --- Helper Utilities ---

// 1. 데이터 정규화: DB에서 market_id(snake)로 오든 marketId(camel)로 오든 Frontend에서는 marketId로 통일
function normalizeData(data: any[]): any[] {
  if (!data || !Array.isArray(data)) return [];
  return data.map(item => {
    const newItem = { ...item };
    // market_id -> marketId 매핑
    if (newItem.market_id !== undefined && newItem.marketId === undefined) {
      newItem.marketId = newItem.market_id;
    }
    // distributor_id -> distributorId 매핑
    if (newItem.distributor_id !== undefined && newItem.distributorId === undefined) {
      newItem.distributorId = newItem.distributor_id;
    }
    return newItem;
  });
}

function mapToWhitelist(item: any, columns: string[]): any {
  const payload: any = {};
  columns.forEach(col => {
    if (item[col] !== undefined) {
      payload[col] = item[col];
    }
  });
  return payload;
}

const generateSafeFileName = (prefix: string, originalName: string) => {
  const parts = originalName.split('.');
  let ext = parts.length > 1 ? parts.pop() : 'png';
  if (!ext || !/^[a-zA-Z0-9]+$/.test(ext)) { ext = 'png'; }
  const randomStr = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now();
  return `${prefix}_${timestamp}_${randomStr}.${ext}`;
};

// --- Generic Functions ---

async function supabaseSaver<T extends { id: number }>(table: string, item: any, columns: string[]): Promise<T> {
  const { id } = item;
  const dbData = mapToWhitelist(item, columns);
  
  let query;
  if (id && id > 0) {
    query = supabase.from(table).update(dbData).eq('id', id).select();
  } else {
    query = supabase.from(table).insert(dbData).select();
  }
  
  const { data, error } = await query;
  if (error) {
    console.error(`Error saving to ${table}:`, error);
    throw new Error(error.message);
  }
  
  return normalizeData(data)[0] as T;
}

async function supabaseReader<T>(table: string, params?: Record<string, any>, searchFields?: string[]) {
  try {
    let query = supabase.from(table).select('*').order('id', { ascending: false });
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all') {
          if (searchFields?.includes(key)) query = query.ilike(key, `%${value}%`);
          else query = query.eq(key, value);
        }
      });
    }
    const { data, error } = await query;
    if (error) {
        console.error(`Error reading from ${table}:`, error);
        return [];
    }
    return normalizeData(data) as T[];
  } catch (e) { return []; }
}

async function getDeviceListWithMarket<T>(table: string, params: any) {
    try {
      // marketId 관계를 통해 시장명 가져오기
      let query = supabase.from(table).select('*, markets(name)').order('id', { ascending: false });
      
      if (params) {
          Object.keys(params).forEach(key => {
              if (!params[key] || params[key] === 'all') return;
              if (['marketName', 'startDate', 'endDate'].includes(key)) return;

              if (key === 'receiverMac') query = query.ilike(key, `%${params[key]}%`);
              else query = query.eq(key, params[key]);
          });
      }
      
      const { data, error } = await query;
      if (error) return [];
      
      const normalizedData = normalizeData(data || []);
      
      let result = normalizedData.map((item: any) => ({
          ...item,
          marketName: item.markets?.name || '-'
      }));
      
      if (params?.marketName) {
          result = result.filter((item: any) => item.marketName.includes(params.marketName));
      }
      return result as T[];
    } catch(e) { return []; }
}

// --- API Services ---

export const AuthAPI = {
  login: async (id: string, pw: string) => {
    const { data } = await supabase.from('users').select('*').eq('userId', id).single();
    if (data && data.password === pw && data.status === '사용') {
      const { password, ...userInfo } = data;
      // 사용자 정보 정규화 (market_id -> marketId)
      const normalizedUser = normalizeData([userInfo])[0];
      return { success: true, user: normalizedUser };
    }
    throw new Error('아이디나 비밀번호가 틀립니다.');
  },
  changePassword: async (userId: string, currentPw: string, newPw: string) => {
    const { data } = await supabase.from('users').select('password').eq('userId', userId).single();
    if (!data || data.password !== currentPw) throw new Error('현재 비밀번호가 일치하지 않습니다.');
    const { error } = await supabase.from('users').update({ password: newPw }).eq('userId', userId);
    if (error) throw error;
    return { success: true };
  }
};

export const UserAPI = {
  getList: async (params?: any) => {
    const { data, error } = await supabase.from('users').select('*, distributors(name), markets(name)').order('id', { ascending: false });
    if(error) return [];

    const normalizedData = normalizeData(data || []);
    return normalizedData.map((u: any) => ({
      ...u,
      department: u.distributors?.name || u.markets?.name || u.department
    })) as User[];
  },
  checkDuplicate: async (id: string) => {
    const { data } = await supabase.from('users').select('id').eq('userId', id);
    return data && data.length > 0;
  },
  save: async (user: User) => supabaseSaver('users', user, USER_COLS),
  delete: async (id: number) => { await supabase.from('users').delete().eq('id', id); return true; }
};

export const MarketAPI = {
  getList: async (params?: any) => {
    let query = supabase.from('markets').select('*, distributors(name)').order('id', { ascending: false });
    if (params) {
        if (params.name) query = query.ilike('name', `%${params.name}%`);
        if (params.address) query = query.ilike('address', `%${params.address}%`);
        if (params.managerName) query = query.ilike('managerName', `%${params.managerName}%`);
    }
    const { data, error } = await query;
    if (error) return [];
    
    const normalizedData = normalizeData(data || []);
    return normalizedData.map((m: any) => ({
      ...m,
      distributorName: m.distributors?.name || '-'
    })) as Market[];
  },
  save: async (m: Market) => supabaseSaver('markets', m, MARKET_COLS),
  delete: async (id: number) => { await supabase.from('markets').delete().eq('id', id); return true; },
  uploadMapImage: async (file: File) => {
    const fileName = generateSafeFileName('mkt', file.name);
    const { error } = await supabase.storage.from('market-maps').upload(fileName, file);
    if (error) throw error;
    return supabase.storage.from('market-maps').getPublicUrl(fileName).data.publicUrl;
  }
};

export const StoreAPI = {
  getList: async (params?: any) => {
    // 시장명을 필터링하기 위해 !inner 조인을 사용할지 결정
    // marketName 검색어가 있으면 inner join으로 검색된 시장만 포함
    let selectStmt = '*, markets(name)';
    if (params?.marketName) {
        selectStmt = '*, markets!inner(name)';
    }

    let query = supabase.from('stores').select(selectStmt).order('id', { ascending: false });
    
    if (params?.marketId) query = query.eq('marketId', params.marketId);
    if (params?.storeName) query = query.ilike('name', `%${params.storeName}%`);
    if (params?.address) query = query.ilike('address', `%${params.address}%`);
    
    // Joined Table filtering
    if (params?.marketName) query = query.ilike('markets.name', `%${params.marketName}%`);
    
    const { data, error } = await query;
    if (error) {
        console.error("StoreAPI.getList error", error);
        return [];
    }
    
    const normalizedData = normalizeData(data || []);
    return normalizedData.map((s: any) => ({ 
        ...s,
        marketName: s.markets?.name || '-' 
    })) as Store[];
  },
  save: async (store: Store) => supabaseSaver('stores', store, STORE_COLS),
  delete: async (id: number) => { await supabase.from('stores').delete().eq('id', id); return true; },
  uploadStoreImage: async (file: File) => {
    const fileName = generateSafeFileName('str', file.name);
    const { error } = await supabase.storage.from('store-images').upload(fileName, file);
    if (error) throw error;
    return supabase.storage.from('store-images').getPublicUrl(fileName).data.publicUrl;
  },
  saveBulk: async (stores: Store[]) => {
    const payloads = stores.map(s => mapToWhitelist(s, STORE_COLS));
    const { error } = await supabase.from('stores').insert(payloads);
    if (error) throw error;
    return true;
  }
};

export const ReceiverAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<Receiver>('receivers', params),
  save: async (r: Receiver) => supabaseSaver('receivers', r, [...DEVICE_BASE_COLS, 'macAddress', 'ip', 'dns', 'emergencyPhone', 'transmissionInterval', 'image']),
  saveCoordinates: async (id: number, x: number, y: number) => { await supabase.from('receivers').update({ x_pos: x, y_pos: y }).eq('id', id); return true; },
  delete: async (id: number) => { await supabase.from('receivers').delete().eq('id', id); return true; },
  uploadImage: async (file: File) => {
    const fileName = generateSafeFileName('rcv', file.name);
    await supabase.storage.from('receiver-images').upload(fileName, file);
    return supabase.storage.from('receiver-images').getPublicUrl(fileName).data.publicUrl;
  }
};

export const RepeaterAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<Repeater>('repeaters', params),
  save: async (r: Repeater) => supabaseSaver('repeaters', r, [...DEVICE_BASE_COLS, 'repeaterId', 'alarmStatus', 'location', 'image']),
  saveCoordinates: async (id: number, x: number, y: number) => { await supabase.from('repeaters').update({ x_pos: x, y_pos: y }).eq('id', id); return true; },
  delete: async (id: number) => { await supabase.from('repeaters').delete().eq('id', id); return true; },
  uploadImage: async (file: File) => {
    const fileName = generateSafeFileName('rpt', file.name);
    await supabase.storage.from('repeater-images').upload(fileName, file);
    return supabase.storage.from('repeater-images').getPublicUrl(fileName).data.publicUrl;
  }
};

export const DetectorAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<Detector>('detectors', params),
  save: async (detector: Detector) => {
    const { stores, ...rest } = detector;
    const saved = await supabaseSaver('detectors', rest as any, [...DEVICE_BASE_COLS, 'detectorId', 'mode', 'cctvUrl', 'smsList']);
    
    if (saved.id && stores) {
        await supabase.from('detector_stores').delete().eq('detectorId', saved.id);
        const junctions = stores.map(s => ({ detectorId: saved.id, storeId: s.id }));
        if (junctions.length > 0) await supabase.from('detector_stores').insert(junctions);
    }
    return saved;
  },
  saveCoordinates: async (id: number, x: number, y: number) => { await supabase.from('detectors').update({ x_pos: x, y_pos: y }).eq('id', id); return true; },
  delete: async (id: number) => { await supabase.from('detectors').delete().eq('id', id); return true; }
};

export const TransmitterAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<Transmitter>('transmitters', params),
  save: async (t: Transmitter) => supabaseSaver('transmitters', t, [...DEVICE_BASE_COLS, 'transmitterId']),
  delete: async (id: number) => { await supabase.from('transmitters').delete().eq('id', id); return true; }
};

export const AlarmAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<Alarm>('alarms', params),
  save: async (a: Alarm) => supabaseSaver('alarms', a, [...DEVICE_BASE_COLS, 'alarmId']),
  delete: async (id: number) => { await supabase.from('alarms').delete().eq('id', id); return true; }
};

export const DistributorAPI = {
  getList: async (params?: any) => supabaseReader<Distributor>('distributors', params, ['name']),
  save: async (d: Distributor) => supabaseSaver('distributors', d, ['name', 'address', 'addressDetail', 'latitude', 'longitude', 'managerName', 'managerPhone', 'managerEmail', 'memo', 'status', 'managedMarkets']),
  delete: async (id: number) => { await supabase.from('distributors').delete().eq('id', id); return true; }
};

export const RoleAPI = {
  getList: async (params?: any) => supabaseReader<RoleItem>('roles', params, ['name']),
  save: async (r: RoleItem) => supabaseSaver('roles', r, ['code', 'name', 'description', 'status']),
  delete: async (id: number) => { await supabase.from('roles').delete().eq('id', id); return true; }
};

export const CommonCodeAPI = {
  getList: async (params?: any) => supabaseReader<CommonCode>('common_codes', params, ['name', 'groupName']),
  save: async (c: CommonCode) => supabaseSaver('common_codes', c, ['code', 'name', 'description', 'groupCode', 'groupName', 'status']),
  saveBulk: async (codes: CommonCode[]) => {
    const payloads = codes.map(c => mapToWhitelist(c, ['code', 'name', 'description', 'groupCode', 'groupName', 'status']));
    await supabase.from('common_codes').insert(payloads);
    return true;
  },
  delete: async (id: number) => { await supabase.from('common_codes').delete().eq('id', id); return true; }
};

export const CommonAPI = {
  getCompanyList: async (searchName?: string) => {
    const { data: dists } = await supabase.from('distributors').select('id, name, managerName, managerPhone');
    const { data: mkts } = await supabase.from('markets').select('id, name, managerName, managerPhone');
    
    const dList = (dists || []).map(d => ({ id: `D_${d.id}`, name: d.name, type: '총판', manager: d.managerName, phone: d.managerPhone }));
    const mList = (mkts || []).map(m => ({ id: `M_${m.id}`, name: m.name, type: '시장', manager: m.managerName, phone: m.managerPhone }));
    
    let all = [...dList, ...mList];
    if (searchName) {
      all = all.filter(c => c.name.includes(searchName));
    }
    return all;
  }
};

export const MenuAPI = {
  getAll: async () => {
    const { data } = await supabase.from('menus').select('*').order('sortOrder', { ascending: true });
    return normalizeData(data || []) as MenuItemDB[];
  },
  getTree: async () => {
    const list = await MenuAPI.getAll();
    const buildTree = (items: MenuItemDB[], parentId: number | null = null): MenuItemDB[] => {
      return items.filter(item => (item.parentId || null) === parentId).map(item => ({ ...item, children: buildTree(items, item.id) }));
    };
    return buildTree(list);
  },
  save: async (m: MenuItemDB) => supabaseSaver('menus', m, ['parentId', 'label', 'path', 'icon', 'sortOrder', 'isVisiblePc', 'isVisibleMobile', 'allowDistributor', 'allowMarket', 'allowLocal']),
  delete: async (id: number) => { await supabase.from('menus').delete().eq('id', id); return true; },
  updateVisibilities: async (menus: any[]) => {
    const payloads = menus.map(m => mapToWhitelist(m, ['id', 'isVisiblePc', 'isVisibleMobile', 'allowDistributor', 'allowMarket', 'allowLocal']));
    const { error } = await supabase.from('menus').upsert(payloads);
    if (error) throw error;
    return true;
  }
};

export const FireHistoryAPI = {
  getList: async (params?: any) => {
      let query = supabase.from('fire_history').select('*').order('registeredAt', { ascending: false });
      if(params?.startDate && params?.endDate) {
          query = query.gte('registeredAt', `${params.startDate}T00:00:00`).lte('registeredAt', `${params.endDate}T23:59:59`);
      }
      if(params?.status === 'fire') query = query.eq('falseAlarmStatus', '화재');
      if(params?.status === 'false') query = query.eq('falseAlarmStatus', '오탐');
      
      const { data, error } = await query;
      if(error) return [];
      return normalizeData(data) as FireHistoryItem[];
  },
  save: async (id: number, status: string, note: string) => {
    await supabase.from('fire_history').update({ falseAlarmStatus: status, note: note }).eq('id', id);
    return true;
  },
  delete: async (id: number) => { await supabase.from('fire_history').delete().eq('id', id); return true; }
};

export const DeviceStatusAPI = {
  getList: async (params?: any) => {
      let query = supabase.from('device_status').select('*').order('registeredAt', { ascending: false });
      if(params?.startDate && params?.endDate) {
          query = query.gte('registeredAt', `${params.startDate}T00:00:00`).lte('registeredAt', `${params.endDate}T23:59:59`);
      }
      if(params?.status === 'processed') query = query.eq('processStatus', '처리');
      if(params?.status === 'unprocessed') query = query.eq('processStatus', '미처리');
      
      const { data, error } = await query;
      if(error) return [];
      return normalizeData(data) as DeviceStatusItem[];
  },
  save: async (id: number, status: string, note: string) => {
    await supabase.from('device_status').update({ processStatus: status, note: note }).eq('id', id);
    return true;
  },
  delete: async (id: number) => { await supabase.from('device_status').delete().eq('id', id); return true; }
};

export const DataReceptionAPI = {
  getList: async (params?: any) => {
      let query = supabase.from('data_reception').select('*').order('registeredAt', { ascending: false });
      if(params?.startDate && params?.endDate) {
          query = query.gte('registeredAt', `${params.startDate}T00:00:00`).lte('registeredAt', `${params.endDate}T23:59:59`);
      }
      const { data, error } = await query;
      if(error) return [];
      return normalizeData(data) as DataReceptionItem[];
  },
  delete: async (id: number) => { await supabase.from('data_reception').delete().eq('id', id); return true; }
};

export const DashboardAPI = {
  getData: async () => {
    try {
      const { data: mkts } = await supabase.from('markets').select('*');
      const { count: fireCount } = await supabase.from('fire_history').select('*', { count: 'exact', head: true }).in('falseAlarmStatus', ['화재', '등록']);
      const { count: faultCount } = await supabase.from('device_status').select('*', { count: 'exact', head: true }).eq('deviceStatus', '에러');
      
      const { data: fH } = await supabase.from('fire_history').select('*, markets(name)').order('registeredAt', { ascending: false }).limit(5);
      const { data: dS } = await supabase.from('device_status').select('*, markets(name)').eq('deviceStatus', '에러').order('registeredAt', { ascending: false }).limit(5);

      const normalizedMkts = normalizeData(mkts || []);
      const normalizedFH = normalizeData(fH || []);
      const normalizedDS = normalizeData(dS || []);

      return {
        stats: [
          { label: '최근 화재 발생', value: fireCount || 0, type: 'fire', color: 'bg-red-500' },
          { label: '최근 고장 발생', value: faultCount || 0, type: 'fault', color: 'bg-orange-500' },
          { label: '통신 이상', value: 0, type: 'error', color: 'bg-gray-500' },
        ],
        fireEvents: normalizedFH.map((e: any) => ({ id: e.id, msg: `${e.markets?.name || e.marketName || '알수없음'} 화재감지`, time: e.registeredAt, marketId: e.marketId })),
        faultEvents: normalizedDS.map((e: any) => ({ id: e.id, msg: `${e.markets?.name || e.marketName || '알수없음'} 장비에러`, time: e.registeredAt, marketId: e.marketId })),
        commEvents: [],
        mapData: normalizedMkts.map((m: any) => ({ 
            id: m.id, 
            name: m.name, 
            x: m.latitude,  
            y: m.longitude, 
            address: m.address, 
            status: m.status || 'Normal',
            mapImage: m.mapImage,
            mapImages: m.mapImages
        }))
      };
    } catch (e) { return { stats: [], fireEvents: [], faultEvents: [], commEvents: [], mapData: [] }; }
  }
};

export const WorkLogAPI = {
  getList: async (params?: any) => getDeviceListWithMarket<WorkLog>('work_logs', params),
  save: async (log: WorkLog) => supabaseSaver('work_logs', log, ['marketId', 'workDate', 'content', 'attachment']),
  delete: async (id: number) => { await supabase.from('work_logs').delete().eq('id', id); return true; },
  uploadAttachment: async (file: File) => {
    const fileName = generateSafeFileName('log', file.name);
    await supabase.storage.from('work-log-images').upload(fileName, file);
    return supabase.storage.from('work-log-images').getPublicUrl(fileName).data.publicUrl;
  }
};