
import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor, Store, WorkLog, Receiver, Repeater, Detector, Transmitter, Alarm, MenuItemDB, CommonCode, FireHistoryItem, DeviceStatusItem, DataReceptionItem } from '../types';

// Mock Data Updated for Consistency
const MOCK_ROLES: RoleItem[] = [];
// MOCK_USERS updated to use snake_case IDs for fallback/test
const MOCK_USERS: User[] = [
  { id: 1, userId: 'admin', password: '12341234!', name: '관리자', role: '시스템관리자', phone: '010-1234-5678', department: '본사', status: '사용', smsReceive: '수신' },
];
const MOCK_MARKETS: Market[] = [];
const MOCK_DISTRIBUTORS: Distributor[] = [];
const MOCK_DASHBOARD = { stats: [], fireEvents: [], faultEvents: [], commEvents: [], mapData: [] };

// --- Helper Utilities ---
const generateSafeFileName = (prefix: string, originalName: string) => {
  const parts = originalName.split('.');
  let ext = parts.length > 1 ? parts.pop() : 'png';
  if (!ext || !/^[a-zA-Z0-9]+$/.test(ext)) { ext = 'png'; }
  const randomStr = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now();
  return `${prefix}_${timestamp}_${randomStr}.${ext}`;
};

// --- Payload Sanitizer ---
// DB에 없는 필드(Join된 필드 등)를 제거하여 "Column not found" 에러 방지
function cleanPayload<T>(item: T): Partial<T> {
  const payload = { ...item };
  const keysToRemove = [
    'marketName', 'distributorName', 'stores', // Custom Display Fields
    'marketId', // Legacy CamelCase field removal
    // [CRITICAL] Remove Joined Objects coming from Supabase select
    'distributors', 'markets' 
  ];
  
  keysToRemove.forEach(key => {
    delete (payload as any)[key];
  });
  
  return payload;
}

async function syncDistributorManagedMarkets(distributorId: number) {
  if (!distributorId) return;
  const { data: markets } = await supabase.from('markets').select('name').eq('distributorId', distributorId);
  const marketNames = markets ? markets.map(m => m.name) : [];
  await supabase.from('distributors').update({ managedMarkets: marketNames }).eq('id', distributorId);
}

async function syncDevicesFromStore(store: Store) {
  if (!store.market_id || !store.receiverMac) return;
  try {
    let { data: rcv } = await supabase.from('receivers').select('id').eq('macAddress', store.receiverMac).eq('market_id', store.market_id).single();
    if (!rcv) {
      await supabase.from('receivers').insert({
        market_id: store.market_id, macAddress: store.receiverMac, status: '사용'
      });
    }
    // ... (rest of sync logic same as before)
    if (store.repeaterId) {
      let { data: rpt } = await supabase.from('repeaters').select('id').eq('receiverMac', store.receiverMac).eq('repeaterId', store.repeaterId).single();
      if (!rpt) {
        await supabase.from('repeaters').insert({
          market_id: store.market_id, receiverMac: store.receiverMac, repeaterId: store.repeaterId, status: '사용'
        });
      }
      if (store.detectorId) {
        let { data: det } = await supabase.from('detectors').select('id').eq('receiverMac', store.receiverMac).eq('repeaterId', store.repeaterId).eq('detectorId', store.detectorId).single();
        let detectorId = det?.id;
        if (!detectorId) {
          const { data: newDet } = await supabase.from('detectors').insert({
            market_id: store.market_id, receiverMac: store.receiverMac, repeaterId: store.repeaterId, detectorId: store.detectorId, mode: store.mode || '복합', status: '사용'
          }).select().single();
          detectorId = newDet?.id;
        }
        if (detectorId && store.id) {
          await supabase.from('detector_stores').delete().eq('storeId', store.id);
          await supabase.from('detector_stores').insert({ detectorId: detectorId, storeId: store.id });
        }
      }
    }
  } catch (e) { console.error("Device sync failed", e); }
}

// Generic Reader
async function supabaseReader<T>(table: string, params?: Record<string, string | number>, searchFields?: string[], fallbackData: T[] = []) {
  try {
    let query = supabase.from(table).select('*').order('id', { ascending: false });
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all') {
          if (searchFields?.includes(key)) {
            query = query.ilike(key, `%${value}%`);
          } else {
            query = query.eq(key, value);
          }
        }
      });
    }
    const { data, error } = await query;
    if (error) return fallbackData;
    return data as T[];
  } catch (e) { return fallbackData; }
}

async function supabaseSaver<T extends { id: number }>(table: string, item: T): Promise<T> {
  const { id, ...rest } = item;
  // Clean payload to remove non-DB fields (including joined objects)
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

async function supabaseDeleter(table: string, id: number) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

// --- API IMPLEMENTATIONS ---

export const AuthAPI = { 
  login: async (id: string, pw: string) => { 
    try { 
      const { data } = await supabase.from('users').select('*').eq('userId', id).single(); 
      if (data && data.password === pw) { return { success: true, user: data }; } 
    } catch(e){} 
    return { success: false }; 
  }, 
  changePassword: async (userId: string, currentPw: string, newPw: string) => { return { success: true }; } 
};

export const UserAPI = {
  getList: async (params?: { userId?: string, name?: string, role?: string, department?: string }) => {
    try {
        let query = supabase.from('users')
            .select('*, distributors(name), markets(name)')
            .order('id', { ascending: false });

        if (params?.userId) query = query.ilike('userId', `%${params.userId}%`);
        if (params?.name) query = query.ilike('name', `%${params.name}%`);
        if (params?.role) query = query.eq('role', params.role);

        const { data, error } = await query;
        if (error) throw error;

        // NOTE: The spread `...u` includes 'distributors' and 'markets' objects.
        // cleanPayload in save() MUST remove these before update.
        return (data || []).map((u: any) => ({
            ...u,
            // Priority: Linked Name > Static Text
            department: u.distributors?.name || u.markets?.name || u.department
        })) as User[];
    } catch (e) { return MOCK_USERS; }
  },
  checkDuplicate: async (id: string) => {
    const { data } = await supabase.from('users').select('id').eq('userId', id);
    return data && data.length > 0;
  },
  save: async (user: User) => {
    return supabaseSaver('users', user);
  },
  delete: async (id: number) => supabaseDeleter('users', id)
};

export const RoleAPI = { getList: async (params?: any) => supabaseReader<RoleItem>('roles', params, ['name']), save: async (r: RoleItem) => supabaseSaver('roles', r), delete: async (id: number) => supabaseDeleter('roles', id) };

export const CommonAPI = {
  getCompanyList: async (searchName?: string) => {
    try {
      let dQuery = supabase.from('distributors').select('id, name, managerName, managerPhone');
      if(searchName) dQuery = dQuery.ilike('name', `%${searchName}%`);
      const { data: dists } = await dQuery;

      let mQuery = supabase.from('markets').select('id, name, managerName, managerPhone');
      if(searchName) mQuery = mQuery.ilike('name', `%${searchName}%`);
      const { data: mkts } = await mQuery;
      
      const dList = (dists || []).map((d: any) => ({ id: `D_${d.id}`, name: d.name, type: '총판', manager: d.managerName, phone: d.managerPhone }));
      const mList = (mkts || []).map((m: any) => ({ id: `M_${m.id}`, name: m.name, type: '시장', manager: m.managerName, phone: m.managerPhone }));
      
      return [...dList, ...mList];
    } catch (e) { return []; }
  }
};

export const MarketAPI = {
  getList: async (params?: { name?: string, address?: string, managerName?: string }) => {
    // Market table also uses distributorId (CamelCase in DB schema), so standard reader works
    return supabaseReader<Market>('markets', params as any, ['name', 'address', 'managerName']);
  },
  save: async (market: Market) => {
    return supabaseSaver('markets', market);
  },
  delete: async (id: number) => supabaseDeleter('markets', id),
  uploadMapImage: async (file: File) => {
    const fileName = generateSafeFileName('market', file.name);
    const { data } = await supabase.storage.from('market-maps').upload(fileName, file);
    if(data) return supabase.storage.from('market-maps').getPublicUrl(fileName).data.publicUrl;
    return '';
  }
};

export const DistributorAPI = {
  getList: async (params?: any) => supabaseReader<Distributor>('distributors', params, ['name']),
  save: async (d: Distributor) => supabaseSaver('distributors', d),
  delete: async (id: number) => supabaseDeleter('distributors', id)
};

export const StoreAPI = { 
  getList: async (params?: { address?: string, marketName?: string, storeName?: string, market_id?: number }) => {
    try {
      let query = supabase.from('stores').select('*, markets(name)').order('id', { ascending: false });
      
      if (params?.storeName) query = query.ilike('name', `%${params.storeName}%`);
      if (params?.address) query = query.ilike('address', `%${params.address}%`);
      if (params?.market_id) query = query.eq('market_id', params.market_id);
      
      const { data: stores, error } = await query;
      if (error) throw error;

      if (stores) {
        let result = stores.map((s: any) => ({
            ...s,
            marketName: s.markets?.name || '-' // Join Result
        }));

        if (params?.marketName) {
            result = result.filter((s: any) => s.marketName.includes(params.marketName));
        }
        return result as Store[];
      }
      return [];
    } catch (e) { return []; }
  }, 
  save: async (store: Store) => {
    const savedStore = await supabaseSaver('stores', store);
    await syncDevicesFromStore(savedStore);
    return savedStore;
  }, 
  delete: async (id: number) => supabaseDeleter('stores', id), 
  uploadStoreImage: async (file: File) => {
    const fileName = generateSafeFileName('store', file.name);
    const { data } = await supabase.storage.from('store-images').upload(fileName, file);
    return data ? supabase.storage.from('store-images').getPublicUrl(fileName).data.publicUrl : '';
  },
  saveBulk: async (stores: Store[]) => {
    const dataToInsert = stores.map(store => cleanPayload(store));
    const { data, error } = await supabase.from('stores').insert(dataToInsert).select();
    if (error) throw error;
    if (data) {
        for (const store of data) {
            await syncDevicesFromStore(store as Store);
        }
    }
    return true;
  }
};

export const CommonCodeAPI = { 
  getList: async (params?: any) => supabaseReader<CommonCode>('common_codes', params, ['name']), 
  save: async (c: CommonCode) => supabaseSaver('common_codes', c), 
  saveBulk: async (codes: CommonCode[]) => { 
      const dataToInsert = codes.map(c => cleanPayload(c));
      const { error } = await supabase.from('common_codes').insert(dataToInsert); 
      if(error) throw error; return true; 
  },
  delete: async (id: number) => supabaseDeleter('common_codes', id) 
};

// Generic device list with market join
async function getDeviceListWithMarket<T>(table: string, params: any) {
    let query = supabase.from(table).select('*, markets(name)').order('id', { ascending: false });
    
    // Apply filters
    Object.keys(params).forEach(key => {
        if (params[key] && key !== 'marketName') {
            if(key === 'receiverMac') query = query.ilike(key, `%${params[key]}%`);
            else query = query.eq(key, params[key]);
        }
    });
    
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
}

export const ReceiverAPI = { 
  getList: async (params?: any) => getDeviceListWithMarket<Receiver>('receivers', params), 
  save: async (r: Receiver) => supabaseSaver('receivers', r), 
  saveCoordinates: async (id: number, x: number, y: number) => { await supabase.from('receivers').update({ x_pos: x, y_pos: y }).eq('id', id); return true; },
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
  saveCoordinates: async (id: number, x: number, y: number) => { await supabase.from('repeaters').update({ x_pos: x, y_pos: y }).eq('id', id); return true; }, 
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
      const detectorIds = baseList.map(d => d.id);
      
      // Fetch detector_stores mapping
      if (detectorIds.length > 0) {
          const { data: rawJunctions } = await supabase.from('detector_stores').select('*').in('detectorId', detectorIds);
          
          let storeMap: Record<number, string> = {};
          if (rawJunctions && rawJunctions.length > 0) {
              const storeIds = Array.from(new Set(rawJunctions.map((j: any) => j.storeId)));
              const { data: storeData } = await supabase.from('stores').select('id, name').in('id', storeIds);
              if (storeData) storeData.forEach((s: any) => { storeMap[s.id] = s.name; });
          }

          return baseList.map(d => {
              const myJunctions = rawJunctions?.filter((j: any) => j.detectorId === d.id) || [];
              const stores = myJunctions.map((j: any) => ({ id: j.storeId, name: storeMap[j.storeId] || 'Unknown' }));
              return { ...d, stores };
          });
      }
      return baseList;
  }, 
  save: async (detector: Detector) => {
    const { stores, ...rest } = detector;
    const savedDetector = await supabaseSaver('detectors', rest as Detector);
    
    // Update store mapping
    await supabase.from('detector_stores').delete().eq('detectorId', savedDetector.id);
    if (stores && stores.length > 0) {
        const junctions = stores.map(s => ({ detectorId: savedDetector.id, storeId: s.id }));
        await supabase.from('detector_stores').insert(junctions);
    }
    return savedDetector;
  },
  saveCoordinates: async (id: number, x: number, y: number) => { await supabase.from('detectors').update({ x_pos: x, y_pos: y }).eq('id', id); return true; },
  delete: async (id: number) => supabaseDeleter('detectors', id),
  saveBulk: async (data: Detector[]) => {
      // Note: Bulk save for detectors does not handle store mapping deeply here for simplicity, or should be added
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
        const { data: fireData } = await supabase.from('fire_history').select('*, markets(name)').in('falseAlarmStatus', ['화재', '등록']).order('registeredAt', { ascending: false }).limit(10);
        const { data: faultData } = await supabase.from('device_status').select('*, markets(name)').eq('deviceStatus', '에러').neq('errorCode', '04').order('registeredAt', { ascending: false }).limit(10);
        const { data: commData } = await supabase.from('device_status').select('*, markets(name)').eq('errorCode', '04').order('registeredAt', { ascending: false }).limit(10);

        const mappedFireLogs = (fireData || []).map((log: any) => ({
            id: log.id,
            msg: `${log.markets?.name || '알수없음'} ${log.detectorInfoChamber || '화재감지'}`,
            time: log.registeredAt,
            market_id: log.market_id,
            marketName: log.markets?.name || ''
        }));

        const mappedFaultLogs = (faultData || []).map((log: any) => ({
            id: log.id,
            msg: `${log.markets?.name || '알수없음'} ${log.deviceType} ${log.deviceId}번 고장`,
            time: log.registeredAt,
            market_id: log.market_id,
            marketName: log.markets?.name || ''
        }));

        const mappedCommLogs = (commData || []).map((log: any) => ({
            id: log.id,
            market: log.markets?.name || '알수없음',
            address: log.markets?.name || '알수없음',
            receiver: log.receiverMac,
            time: log.registeredAt
        }));

        const { count: fireCount } = await supabase.from('fire_history').select('*', { count: 'exact', head: true }).in('falseAlarmStatus', ['화재', '등록']);
        const { count: faultCount } = await supabase.from('device_status').select('*', { count: 'exact', head: true }).eq('deviceStatus', '에러').neq('errorCode', '04');
        const { count: commCount } = await supabase.from('device_status').select('*', { count: 'exact', head: true }).eq('errorCode', '04');

        const fireMarketIds = new Set(mappedFireLogs.map((l: any) => l.market_id));
        const faultMarketIds = new Set(mappedFaultLogs.map((l: any) => l.market_id));

        const mapData = (markets || []).map((m: Market) => {
            let status = 'Normal';
            if (fireMarketIds.has(m.id)) status = 'Fire';
            else if (faultMarketIds.has(m.id)) status = 'Error';

            return {
                id: m.id,
                name: m.name,
                x: m.latitude,
                y: m.longitude,
                status: status,
                address: m.address
            };
        });

        return {
            stats: [
                { label: '최근 화재 발생', value: fireCount || 0, type: 'fire', color: 'bg-red-500' },
                { label: '최근 고장 발생', value: faultCount || 0, type: 'fault', color: 'bg-orange-500' },
                { label: '통신 이상', value: commCount || 0, type: 'error', color: 'bg-gray-500' },
            ],
            fireEvents: mappedFireLogs,
            faultEvents: mappedFaultLogs,
            commEvents: mappedCommLogs,
            mapData: mapData
        };

    } catch (e) {
        return { ...MOCK_DASHBOARD, mapData: [] };
    }
  }
};

export const MenuAPI = {
  getAll: async () => supabaseReader<MenuItemDB>('menus', undefined, undefined, []),
  getTree: async () => { return []; }, // simplified
  save: async (m: MenuItemDB) => supabaseSaver('menus', m),
  delete: async (id: number) => supabaseDeleter('menus', id),
  updateVisibilities: async (u: any) => { await supabase.from('menus').upsert(u); return true; }
};

export const FireHistoryAPI = {
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string, status?: string }) => {
    try {
      let query = supabase.from('fire_history').select('*, markets(name)').order('registeredAt', { ascending: false });
      
      if (params?.startDate) query = query.gte('registeredAt', params.startDate);
      if (params?.endDate) query = query.lte('registeredAt', params.endDate + ' 23:59:59');
      if (params?.status && params.status !== 'all') {
          if (params.status === 'fire') query = query.eq('falseAlarmStatus', '화재');
          else if (params.status === 'false') query = query.eq('falseAlarmStatus', '오탐');
      }

      const { data, error } = await query;
      if (error) return [];

      let result = data.map((item: any) => ({
          ...item,
          market_id: item.market_id,
          marketName: item.markets?.name || '-'
      }));

      if (params?.marketName) {
          result = result.filter((item: any) => item.marketName.includes(params.marketName));
      }
      return result as FireHistoryItem[];
    } catch (e) { return []; }
  },
  save: async (id: number, status: string, note: string) => {
    await supabase.from('fire_history').update({ falseAlarmStatus: status, note: note }).eq('id', id); return true;
  },
  delete: async (id: number) => supabaseDeleter('fire_history', id)
};

export const DeviceStatusAPI = {
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string, status?: string }) => {
    try {
      let query = supabase.from('device_status').select('*, markets(name)').order('registeredAt', { ascending: false });
      
      if (params?.startDate) query = query.gte('registeredAt', params.startDate);
      if (params?.endDate) query = query.lte('registeredAt', params.endDate + ' 23:59:59');
      if (params?.status && params.status !== 'all') {
          if (params.status === 'processed') query = query.eq('processStatus', '처리');
          else if (params.status === 'unprocessed') query = query.eq('processStatus', '미처리');
      }

      const { data, error } = await query;
      if (error) return [];

      let result = data.map((item: any) => ({
          ...item,
          market_id: item.market_id,
          marketName: item.markets?.name || '-'
      }));

      if (params?.marketName) {
          result = result.filter((item: any) => item.marketName.includes(params.marketName));
      }
      return result as DeviceStatusItem[];
    } catch (e) { return []; }
  },
  save: async (id: number, status: string, note: string) => {
    await supabase.from('device_status').update({ processStatus: status, note: note }).eq('id', id); return true;
  },
  delete: async (id: number) => supabaseDeleter('device_status', id)
};

export const DataReceptionAPI = {
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string }) => {
    try {
      let query = supabase.from('data_reception').select('*, markets(name)').order('registeredAt', { ascending: false });
      
      if (params?.startDate) query = query.gte('registeredAt', params.startDate);
      if (params?.endDate) query = query.lte('registeredAt', params.endDate + ' 23:59:59');

      const { data, error } = await query;
      if (error) return [];

      let result = data.map((item: any) => ({
          ...item,
          market_id: item.market_id,
          marketName: item.markets?.name || '-'
      }));

      if (params?.marketName) {
          result = result.filter((item: any) => item.marketName.includes(params.marketName));
      }
      return result as DataReceptionItem[];
    } catch (e) { return []; }
  },
  delete: async (id: number) => supabaseDeleter('data_reception', id)
};
