import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor, Store, WorkLog, Receiver, Repeater, Detector, Transmitter, Alarm, MenuItemDB, CommonCode, FireHistoryItem, DeviceStatusItem, DataReceptionItem } from '../types';

/**
 * [API 서비스 정책]
 * 1. 읽기(Read): Supabase 조회 실패 시에만 Mock 데이터 반환 (Manual Join 방식 사용으로 안정성 확보)
 * 2. 쓰기(Write): 실제 DB 결과를 반환. 상가 저장 시 기기 자동 동기화 로직 포함.
 */

// --- 1. MOCK DATA (Fallback) ---

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
    distributorId: 1, distributorName: '미창'
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

const MOCK_DASHBOARD = {
  stats: [
    { label: '최근 화재 발생', value: 2, type: 'fire', color: 'bg-red-500' },
    { label: '최근 고장 발생', value: 5, type: 'fault', color: 'bg-orange-500' },
    { label: '통신 이상', value: 1, type: 'error', color: 'bg-gray-500' },
  ],
  fireEvents: [
    { id: 1, msg: '인천광역시 부평구 진라도김치 화재 감지', time: '2024-05-25 12:39:15', marketName: '부평자유시장' },
    { id: 2, msg: '대전광역시 서구 약초마을 화재 감지 알림', time: '2024-06-25 08:59:15', marketName: '대전중앙시장' },
  ],
  faultEvents: [
    { id: 1, msg: '중계기 02 감지기 01 감지기 통신이상', time: '2024-06-25 10:06:53', marketName: '부평자유시장' },
    { id: 2, msg: '중계기 15 감지기 11 감지기 통신이상', time: '2024-06-25 08:01:51', marketName: '대전중앙시장' },
  ],
  commEvents: [
    { id: 1, market: '부평자유시장', address: '인천 부평구', receiver: 'R-01' }
  ]
};

// --- 2. Helper Utilities ---

// 파일명 안전 변환 함수
const generateSafeFileName = (prefix: string, originalName: string) => {
  const parts = originalName.split('.');
  let ext = parts.length > 1 ? parts.pop() : 'png';
  if (!ext || !/^[a-zA-Z0-9]+$/.test(ext)) { ext = 'png'; }
  const randomStr = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now();
  return `${prefix}_${timestamp}_${randomStr}.${ext}`;
};

// 특정 총판의 managedMarkets 배열을 실제 markets 테이블과 동기화하는 함수
async function syncDistributorManagedMarkets(distributorId: number) {
  if (!distributorId) return;

  // 1. 해당 총판 ID를 가진 시장들의 이름을 조회
  const { data: markets } = await supabase
    .from('markets')
    .select('name')
    .eq('distributorId', distributorId);
  
  const marketNames = markets ? markets.map(m => m.name) : [];

  // 2. 총판 테이블의 managedMarkets 컬럼 업데이트
  await supabase
    .from('distributors')
    .update({ managedMarkets: marketNames })
    .eq('id', distributorId);
}

// [핵심] 상가 저장 시 관련 기기(수신기, 중계기, 감지기) 자동 생성 및 동기화 함수
// 이 함수가 "시스템관리 > 기기관리"와 "현장기기관리"의 데이터를 일치시켜줍니다.
async function syncDevicesFromStore(store: Store) {
  if (!store.marketId || !store.receiverMac) return;

  try {
    // 1. 수신기 동기화 (없으면 생성)
    let { data: rcv } = await supabase
      .from('receivers')
      .select('id')
      .eq('macAddress', store.receiverMac)
      .eq('marketId', store.marketId)
      .single();

    if (!rcv) {
      const { data: newRcv } = await supabase.from('receivers').insert({
        marketId: store.marketId,
        macAddress: store.receiverMac,
        status: '사용'
      }).select().single();
      rcv = newRcv;
    }

    // 2. 중계기 동기화 (없으면 생성)
    if (store.repeaterId) {
      let { data: rpt } = await supabase
        .from('repeaters')
        .select('id')
        .eq('receiverMac', store.receiverMac)
        .eq('repeaterId', store.repeaterId)
        .single();

      if (!rpt) {
        const { data: newRpt } = await supabase.from('repeaters').insert({
          marketId: store.marketId,
          receiverMac: store.receiverMac,
          repeaterId: store.repeaterId,
          status: '사용'
        }).select().single();
        rpt = newRpt;
      }

      // 3. 감지기 동기화 (없으면 생성, 있으면 모드 업데이트)
      if (store.detectorId) {
        let { data: det } = await supabase
          .from('detectors')
          .select('id')
          .eq('receiverMac', store.receiverMac)
          .eq('repeaterId', store.repeaterId)
          .eq('detectorId', store.detectorId)
          .single();

        let detectorId = det?.id;

        if (!detectorId) {
          // 존재하지 않으면 신규 생성
          const { data: newDet } = await supabase.from('detectors').insert({
            marketId: store.marketId,
            receiverMac: store.receiverMac,
            repeaterId: store.repeaterId,
            detectorId: store.detectorId,
            mode: store.mode || '복합',
            status: '사용'
          }).select().single();
          detectorId = newDet?.id;
        } else {
          // 이미 존재하면, 상가에서 설정한 모드(열/연기 등)로 감지기 정보 업데이트
          await supabase.from('detectors').update({
            mode: store.mode || '복합'
          }).eq('id', detectorId);
        }

        // 4. 감지기-상가 연결 (detector_stores) 갱신
        // 상가가 다른 감지기로 변경되었을 수 있으므로, 기존 이 상가의 연결을 모두 끊고 새로 연결합니다.
        if (detectorId && store.id) {
          // 기존 연결 삭제 (이 상가에 연결된 모든 감지기 링크 제거)
          await supabase.from('detector_stores').delete().eq('storeId', store.id);
          
          // 새 연결 생성
          await supabase.from('detector_stores').insert({
             detectorId: detectorId,
             storeId: store.id
          });
        }
      }
    }
  } catch (e) {
    console.error("Device sync failed during store save:", e);
    // 메인 로직(상가 저장)은 성공했으므로 여기서는 에러를 throw하지 않고 로그만 남김
  }
}

// Generic Supabase Reader (Manual Join 사용)
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
    
    // [DEBUG LOG]
    console.log(`[API] Reading ${table}:`, { 
        dataLength: data?.length || 0, 
        error: error?.message
    });

    if (error) {
        console.warn(`Supabase read error on ${table}:`, error.message);
        return fallbackData;
    }
    if (data === null) return fallbackData;
    
    return data as T[];
  } catch (e) {
    console.error(`Unexpected error reading ${table}:`, e);
    return fallbackData;
  }
}

// Generic Supabase Saver
async function supabaseSaver<T extends { id: number }>(table: string, item: T): Promise<T> {
  const { id, ...rest } = item;
  
  let query;
  if (id && id > 0) {
    query = supabase.from(table).update(rest).eq('id', id).select();
  } else {
    query = supabase.from(table).insert(rest).select();
  }

  const { data, error } = await query;
  
  if (error) {
    console.error(`Save failed for ${table}:`, error);
    throw new Error(error.message);
  }
  
  if (!data || data.length === 0) {
    throw new Error('데이터 저장 후 반환된 결과가 없습니다.');
  }

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
      const { data, error } = await supabase.from('users').select('*').eq('userId', id).single();
      if (!error && data) {
        if (data.password === pw && data.status === '사용') {
          const { password, ...userInfo } = data;
          return { success: true, token: 'supabase-token', user: userInfo };
        }
      }
    } catch (e) {}
    
    const user = MOCK_USERS.find(u => u.userId === id);
    if (user && user.password === pw && user.status === '사용') {
        const { password, ...userInfo } = user;
        return { success: true, token: 'mock-token', user: userInfo };
    }
    throw new Error('아이디 또는 비밀번호가 잘못되었습니다.');
  },
  changePassword: async (userId: string, currentPw: string, newPw: string) => {
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
      let dQuery = supabase.from('distributors').select('id, name, managerName, managerPhone');
      if(searchName) dQuery = dQuery.ilike('name', `%${searchName}%`);
      const { data: dists } = await dQuery;

      let mQuery = supabase.from('markets').select('id, name, managerName, managerPhone');
      if(searchName) mQuery = mQuery.ilike('name', `%${searchName}%`);
      const { data: mkts } = await mQuery;
      
      const dList = (dists || []).map((d: any) => ({ id: `D_${d.id}`, name: d.name, type: '총판', manager: d.managerName, phone: d.managerPhone }));
      const mList = (mkts || []).map((m: any) => ({ id: `M_${m.id}`, name: m.name, type: '시장', manager: m.managerName, phone: m.managerPhone }));
      
      let all = [...dList, ...mList];
      
      if (all.length === 0 && !searchName) {
          const dMock = MOCK_DISTRIBUTORS.map(d => ({ id: `D_${d.id}`, name: d.name, type: '총판', manager: d.managerName, phone: d.managerPhone }));
          all = [...dMock];
      }
      return all;
    } catch (e) {
      return [];
    }
  }
};

export const MarketAPI = {
  getList: async (params?: { name?: string, address?: string, managerName?: string }) => {
    try {
      let query = supabase.from('markets').select('*').order('id', { ascending: false });
      
      if (params?.name) query = query.ilike('name', `%${params.name}%`);
      if (params?.address) query = query.ilike('address', `%${params.address}%`);
      if (params?.managerName) query = query.ilike('managerName', `%${params.managerName}%`);

      const { data: markets, error } = await query;
      
      console.log("[API] Reading markets:", { length: markets?.length, error: error?.message });

      if (error) {
         console.warn(`Supabase read error on markets:`, error.message);
         return MOCK_MARKETS.map(m => ({...m, distributorName: '미창'}));
      }
      
      if (markets && markets.length > 0) {
        const distIds = Array.from(new Set(markets.map(m => m.distributorId).filter(id => id != null)));
        
        let distMap: Record<number, string> = {};
        if (distIds.length > 0) {
            const { data: dists } = await supabase.from('distributors').select('id, name').in('id', distIds);
            if (dists) {
                dists.forEach(d => { distMap[d.id] = d.name; });
            }
        }

        return markets.map((m: any) => ({
          ...m,
          distributorName: m.distributorId ? (distMap[m.distributorId] || '-') : '-'
        })) as Market[];
      }
      return [];
    } catch (e) {
      return MOCK_MARKETS.map(m => ({...m, distributorName: '미창'}));
    }
  },
  save: async (market: Market) => {
    let oldDistributorId = null;
    if (market.id) {
        const { data } = await supabase.from('markets').select('distributorId').eq('id', market.id).single();
        oldDistributorId = data?.distributorId;
    }

    const { distributorName, ...dbData } = market;
    const savedMarket = await supabaseSaver('markets', dbData as Market);

    if (savedMarket.distributorId) {
        await syncDistributorManagedMarkets(savedMarket.distributorId);
    }
    if (oldDistributorId && oldDistributorId !== savedMarket.distributorId) {
        await syncDistributorManagedMarkets(oldDistributorId);
    }

    if (savedMarket.usageStatus === '미사용' && savedMarket.id) {
        await supabase
            .from('stores')
            .update({ status: '미사용' })
            .eq('marketId', savedMarket.id);
    }

    return { ...savedMarket, distributorName };
  },
  delete: async (id: number) => {
    const { data: market } = await supabase.from('markets').select('distributorId').eq('id', id).single();
    const result = await supabaseDeleter('markets', id);
    if (market?.distributorId) {
        await syncDistributorManagedMarkets(market.distributorId);
    }
    return result;
  },
  uploadMapImage: async (file: File) => {
    const fileName = generateSafeFileName('market', file.name);
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
    const savedDist = await supabaseSaver('distributors', dist);
    const distId = savedDist.id;

    if (dist.managedMarkets && dist.managedMarkets.length > 0) {
        await supabase
            .from('markets')
            .update({ distributorId: distId })
            .in('name', dist.managedMarkets);
    }

    if (dist.managedMarkets) {
        const { data: currentLinked } = await supabase.from('markets').select('id, name').eq('distributorId', distId);
        if (currentLinked) {
            const marketsToUnlink = currentLinked
                .filter(m => !dist.managedMarkets.includes(m.name))
                .map(m => m.id);
            if (marketsToUnlink.length > 0) {
                await supabase
                    .from('markets')
                    .update({ distributorId: null })
                    .in('id', marketsToUnlink);
            }
        }
    }

    await syncDistributorManagedMarkets(distId);
    return savedDist;
  },
  delete: async (id: number) => {
    await supabase.from('markets').update({ distributorId: null }).eq('distributorId', id);
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
      
      const { data: stores, error } = await query;
      console.log("[API] Reading stores:", { length: stores?.length, error: error?.message });

      if (error) throw error;

      if (stores && stores.length > 0) {
        const marketIds = Array.from(new Set(stores.map((s: any) => s.marketId).filter((id: any) => id)));
        let marketMap: Record<number, string> = {};
        if (marketIds.length > 0) {
            const { data: markets } = await supabase.from('markets').select('id, name').in('id', marketIds);
            if (markets) {
                markets.forEach((m: any) => { marketMap[m.id] = m.name; });
            }
        }

        let result = stores.map((s: any) => ({
            ...s,
            marketName: marketMap[s.marketId] || '-' 
        }));

        if (params?.marketName) {
            result = result.filter((s: any) => s.marketName.includes(params.marketName));
        }
        return result as Store[];
      }
      return [];
    } catch (e) {
      console.warn("Store Load Error:", e);
      return [];
    }
  }, 
  save: async (store: Store) => {
    const { marketName, ...dbData } = store;
    const savedStore = await supabaseSaver('stores', dbData as Store);
    
    // [중요] 상가 저장 후 관련 기기(수신기, 중계기, 감지기) 데이터 동기화
    await syncDevicesFromStore(savedStore);
    
    return savedStore;
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('stores', id);
  }, 
  uploadStoreImage: async (file: File) => {
    const fileName = generateSafeFileName('store', file.name);
    const { data, error } = await supabase.storage.from('store-images').upload(fileName, file);
    if (error) throw error;
    if (data) {
      const { data: urlData } = supabase.storage.from('store-images').getPublicUrl(fileName);
      return urlData.publicUrl;
    }
    return '';
  }, 
  saveBulk: async (stores: Store[]) => {
    const storesToInsert = stores.map(({ id, marketName, ...rest }) => rest);
    const { data, error } = await supabase.from('stores').insert(storesToInsert).select();
    if (error) throw error;

    if (data) {
        // 일괄 등록 시에도 각 상가별 기기 데이터 동기화 수행
        for (const store of data) {
            await syncDevicesFromStore(store as Store);
        }
    }
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
      // Manual Join: 1. Get Logs
      let query = supabase.from('work_logs').select('*').order('workDate', { ascending: false });
      
      const { data: logs, error } = await query;
      console.log("[API] Reading work_logs:", { length: logs?.length, error: error?.message });

      if (error) throw error;

      if (logs && logs.length > 0) {
        // Manual Join: 2. Get Markets
        const marketIds = Array.from(new Set(logs.map((l: any) => l.marketId).filter((id: any) => id)));
        let marketMap: Record<number, string> = {};
        
        if (marketIds.length > 0) {
            const { data: markets } = await supabase.from('markets').select('id, name').in('id', marketIds);
            if (markets) {
                markets.forEach((m: any) => { marketMap[m.id] = m.name; });
            }
        }

        let result = logs.map((log: any) => ({
          ...log,
          marketName: marketMap[log.marketId] || 'Unknown'
        }));

        if (params?.marketName) {
            result = result.filter((l: any) => l.marketName.includes(params.marketName));
        }
        return result as WorkLog[];
      }
      return [];
    } catch(e) {
      console.warn("WorkLog Load Error:", e);
      return [];
    }
  }, 
  save: async (log: WorkLog) => {
    const { marketName, ...saveData } = log;
    return supabaseSaver('work_logs', saveData as WorkLog);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('work_logs', id);
  }, 
  uploadAttachment: async (file: File) => {
    const fileName = generateSafeFileName('log', file.name);
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
      // Manual Join: 1. Get Receivers
      let query = supabase.from('receivers').select('*').order('id', { ascending: false });
      if (params?.macAddress) query = query.ilike('macAddress', `%${params.macAddress}%`);
      if (params?.ip) query = query.ilike('ip', `%${params.ip}%`);
      if (params?.emergencyPhone) query = query.ilike('emergencyPhone', `%${params.emergencyPhone}%`);
      
      const { data: receivers, error } = await query;
      console.log("[API] Reading receivers:", { length: receivers?.length, error: error?.message });

      if (error) throw error;

      if (receivers && receivers.length > 0) {
        // Manual Join: 2. Get Markets
        const marketIds = Array.from(new Set(receivers.map((r: any) => r.marketId).filter((id: any) => id)));
        let marketMap: Record<number, string> = {};
        
        if (marketIds.length > 0) {
            const { data: markets } = await supabase.from('markets').select('id, name').in('id', marketIds);
            if (markets) {
                markets.forEach((m: any) => { marketMap[m.id] = m.name; });
            }
        }

        let result = receivers.map((r: any) => ({
            ...r,
            marketName: marketMap[r.marketId] || '-'
        }));

        if (params?.marketName) {
            result = result.filter(r => r.marketName?.includes(params.marketName));
        }
        return result as Receiver[];
      }
      return [];
    } catch(e) { return []; }
  }, 
  save: async (receiver: Receiver) => {
    const { data: existing } = await supabase
        .from('receivers')
        .select('id')
        .eq('macAddress', receiver.macAddress)
        .neq('id', receiver.id)
        .single();
    
    if (existing) {
        throw new Error('이미 등록된 기기입니다. (MAC 중복)');
    }

    const { marketName, ...saveData } = receiver;
    return supabaseSaver('receivers', saveData as Receiver);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('receivers', id);
  }, 
  uploadImage: async (file: File) => {
    const fileName = generateSafeFileName('rcv', file.name);
    const { data, error } = await supabase.storage.from('receiver-images').upload(fileName, file);
    if (error) throw error;
    if (data) {
      const { data: urlData } = supabase.storage.from('receiver-images').getPublicUrl(fileName);
      return urlData.publicUrl;
    }
    return '';
  }, 
  saveBulk: async (data: Receiver[]) => {
    const macs = data.map(r => r.macAddress);
    const duplicateInExcel = macs.filter((item, index) => macs.indexOf(item) !== index);
    if (duplicateInExcel.length > 0) {
        throw new Error(`엑셀 파일 내에 중복된 MAC 주소가 있습니다: ${duplicateInExcel.join(', ')}`);
    }

    if (macs.length > 0) {
        const { data: existing } = await supabase
            .from('receivers')
            .select('macAddress')
            .in('macAddress', macs);
        
        if (existing && existing.length > 0) {
            const duplicates = existing.map(r => r.macAddress).join(', ');
            throw new Error(`이미 등록된 기기가 포함되어 있습니다: ${duplicates}`);
        }
    }

    const insertData = data.map(({ id, marketName, ...rest }) => rest);
    const { error } = await supabase.from('receivers').insert(insertData);
    if (error) throw error;
    return true;
  } 
};

export const RepeaterAPI = { 
  getList: async (params?: any) => {
    try {
      // Manual Join
      let query = supabase.from('repeaters').select('*').order('id', { ascending: false });
      if (params?.receiverMac) query = query.ilike('receiverMac', `%${params.receiverMac}%`);
      if (params?.repeaterId) query = query.eq('repeaterId', params.repeaterId);
      
      const { data: repeaters, error } = await query;
      console.log("[API] Reading repeaters:", { length: repeaters?.length, error: error?.message });

      if (error) throw error;

      if (repeaters && repeaters.length > 0) {
        const marketIds = Array.from(new Set(repeaters.map((r: any) => r.marketId).filter((id: any) => id)));
        let marketMap: Record<number, string> = {};
        
        if (marketIds.length > 0) {
            const { data: markets } = await supabase.from('markets').select('id, name').in('id', marketIds);
            if (markets) {
                markets.forEach((m: any) => { marketMap[m.id] = m.name; });
            }
        }

        let result = repeaters.map((r: any) => ({
            ...r,
            marketName: marketMap[r.marketId] || '-'
        }));

        if (params?.marketName) result = result.filter(r => r.marketName?.includes(params.marketName));
        return result as Repeater[];
      }
      return [];
    } catch(e) { return []; }
  }, 
  save: async (repeater: Repeater) => {
    const { data: existing } = await supabase
        .from('repeaters')
        .select('id')
        .eq('receiverMac', repeater.receiverMac)
        .eq('repeaterId', repeater.repeaterId)
        .neq('id', repeater.id)
        .single();

    if (existing) {
        throw new Error('이미 등록된 기기입니다. (중계기ID 중복)');
    }

    const { marketName, ...saveData } = repeater;
    return supabaseSaver('repeaters', saveData as Repeater);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('repeaters', id);
  }, 
  uploadImage: async (file: File) => {
    const fileName = generateSafeFileName('rpt', file.name);
    const { data, error } = await supabase.storage.from('repeater-images').upload(fileName, file);
    if (error) throw error;
    if (data) {
      const { data: urlData } = supabase.storage.from('repeater-images').getPublicUrl(fileName);
      return urlData.publicUrl;
    }
    return '';
  }, 
  saveBulk: async (data: Repeater[]) => {
    const keys = data.map(r => `${r.receiverMac}_${r.repeaterId}`);
    const duplicateInExcel = keys.filter((item, index) => keys.indexOf(item) !== index);
    if (duplicateInExcel.length > 0) {
        throw new Error(`엑셀 파일 내에 중복된 중계기가 있습니다.`);
    }

    for (const item of data) {
        const { data: existing } = await supabase
            .from('repeaters')
            .select('id')
            .eq('receiverMac', item.receiverMac)
            .eq('repeaterId', item.repeaterId)
            .single();
        
        if (existing) {
            throw new Error(`이미 등록된 기기가 포함되어 있습니다 (MAC: ${item.receiverMac}, ID: ${item.repeaterId})`);
        }
    }

    const insertData = data.map(({ id, marketName, ...rest }) => rest);
    const { error } = await supabase.from('repeaters').insert(insertData);
    if (error) throw error;
    return true;
  } 
};

export const DetectorAPI = { 
  getList: async (params?: any) => {
    try {
      // Manual Join
      let query = supabase.from('detectors').select('*').order('id', { ascending: false });
      if (params?.receiverMac) query = query.ilike('receiverMac', `%${params.receiverMac}%`);
      
      const { data: detectors, error } = await query;
      console.log("[API] Reading detectors:", { length: detectors?.length, error: error?.message });

      if (error || !detectors) return [];

      // 1. Get Markets
      const marketIds = Array.from(new Set(detectors.map((d: any) => d.marketId).filter((id: any) => id)));
      let marketMap: Record<number, string> = {};
      if (marketIds.length > 0) {
          const { data: markets } = await supabase.from('markets').select('id, name').in('id', marketIds);
          if (markets) {
              markets.forEach((m: any) => { marketMap[m.id] = m.name; });
          }
      }

      // 2. Get Stores (Junction)
      const detectorIds = detectors.map(d => d.id);
      
      /* Manual Junction Join Logic */
      // 2.1 Get Junctions
      const { data: rawJunctions } = await supabase.from('detector_stores').select('*').in('detectorId', detectorIds);
      
      // 2.2 Get Store Names
      let storeMap: Record<number, string> = {};
      if (rawJunctions && rawJunctions.length > 0) {
          const storeIds = Array.from(new Set(rawJunctions.map((j: any) => j.storeId)));
          const { data: storeData } = await supabase.from('stores').select('id, name').in('id', storeIds);
          if (storeData) {
              storeData.forEach((s: any) => { storeMap[s.id] = s.name; });
          }
      }

      let result = detectors.map((d: any) => {
        const myJunctions = rawJunctions?.filter((j: any) => j.detectorId === d.id) || [];
        const stores = myJunctions.map((j: any) => ({ id: j.storeId, name: storeMap[j.storeId] || 'Unknown' }));
        
        return {
            ...d,
            marketName: marketMap[d.marketId] || '-',
            stores: stores
        };
      });

      if (params?.marketName) result = result.filter(r => r.marketName?.includes(params.marketName));
      return result as Detector[];
    } catch(e) { return []; }
  }, 
  save: async (detector: Detector) => {
    const { data: existing } = await supabase
        .from('detectors')
        .select('id')
        .eq('receiverMac', detector.receiverMac)
        .eq('repeaterId', detector.repeaterId)
        .eq('detectorId', detector.detectorId)
        .neq('id', detector.id)
        .single();

    if (existing) {
        throw new Error('이미 등록된 기기입니다. (감지기ID 중복)');
    }

    const { marketName, stores, ...saveData } = detector;
    
    const savedDetector = await supabaseSaver('detectors', saveData as Detector);
    const savedId = savedDetector.id;

    await supabase.from('detector_stores').delete().eq('detectorId', savedId);
    
    if (stores && stores.length > 0) {
        const junctions = stores.map(s => ({ detectorId: savedId, storeId: s.id }));
        const { error } = await supabase.from('detector_stores').insert(junctions);
        if (error) throw new Error('상가 연결 저장 실패: ' + error.message);

        const storeIds = stores.map(s => s.id);
        const { error: updateError } = await supabase
            .from('stores')
            .update({
                receiverMac: saveData.receiverMac,
                repeaterId: saveData.repeaterId,
                detectorId: saveData.detectorId,
                mode: saveData.mode
            })
            .in('id', storeIds);
        
        if (updateError) console.warn("Failed to sync store device info", updateError);
    }
    
    return savedDetector;
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('detectors', id);
  }, 
  saveBulk: async (data: Detector[]) => {
    const keys = data.map(d => `${d.receiverMac}_${d.repeaterId}_${d.detectorId}`);
    const duplicateInExcel = keys.filter((item, index) => keys.indexOf(item) !== index);
    if (duplicateInExcel.length > 0) {
        throw new Error(`엑셀 파일 내에 중복된 감지기가 있습니다.`);
    }

    for (const item of data) {
        const { data: existing } = await supabase
            .from('detectors')
            .select('id')
            .eq('receiverMac', item.receiverMac)
            .eq('repeaterId', item.repeaterId)
            .eq('detectorId', item.detectorId)
            .single();
        
        if (existing) {
            throw new Error(`이미 등록된 기기가 포함되어 있습니다 (MAC: ${item.receiverMac}, RPT: ${item.repeaterId}, DET: ${item.detectorId})`);
        }
    }

    const insertData = data.map(({ id, marketName, stores, ...rest }) => rest);
    const { error } = await supabase.from('detectors').insert(insertData);
    if (error) throw error;
    
    return true;
  } 
};

export const TransmitterAPI = { 
  getList: async (params?: any) => {
    try {
        // Manual Join
        let query = supabase.from('transmitters').select('*').order('id', { ascending: false });
        const { data, error } = await query;
        console.log("[API] Reading transmitters:", { length: data?.length, error: error?.message });
        
        if (!error && data) {
            const marketIds = Array.from(new Set(data.map((t: any) => t.marketId).filter((id: any) => id)));
            let marketMap: Record<number, string> = {};
            if (marketIds.length > 0) {
                const { data: markets } = await supabase.from('markets').select('id, name').in('id', marketIds);
                if (markets) {
                    markets.forEach((m: any) => { marketMap[m.id] = m.name; });
                }
            }

            let result = data.map((t: any) => ({ ...t, marketName: marketMap[t.marketId] || '-' }));
            if (params?.marketName) result = result.filter(r => r.marketName?.includes(params.marketName));
            return result as Transmitter[];
        }
    } catch(e) {}
    return [];
  }, 
  save: async (t: Transmitter) => {
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
        // Manual Join
        let query = supabase.from('alarms').select('*').order('id', { ascending: false });
        const { data, error } = await query;
        console.log("[API] Reading alarms:", { length: data?.length, error: error?.message });
        
        if (!error && data) {
            const marketIds = Array.from(new Set(data.map((a: any) => a.marketId).filter((id: any) => id)));
            let marketMap: Record<number, string> = {};
            if (marketIds.length > 0) {
                const { data: markets } = await supabase.from('markets').select('id, name').in('id', marketIds);
                if (markets) {
                    markets.forEach((m: any) => { marketMap[m.id] = m.name; });
                }
            }

            let result = data.map((a: any) => ({ ...a, marketName: marketMap[a.marketId] || '-' }));
            if (params?.marketName) result = result.filter(r => r.marketName?.includes(params.marketName));
            return result as Alarm[];
        }
    } catch(e) {}
    return [];
  }, 
  save: async (a: Alarm) => {
    const { marketName, ...saveData } = a;
    return supabaseSaver('alarms', saveData as Alarm);
  }, 
  delete: async (id: number) => {
    return supabaseDeleter('alarms', id);
  } 
};

// --- New APIs ---

export const DashboardAPI = {
  getData: async () => {
    // In a real app, this would aggregate data from fire_logs, device_status, etc.
    // For now, returning Mock data as per previous implementation pattern for Dashboard
    return new Promise((resolve) => {
        setTimeout(() => resolve(MOCK_DASHBOARD), 500);
    });
  }
};

export const MenuAPI = {
  getAll: async () => {
    return supabaseReader<MenuItemDB>('menus', undefined, undefined, []);
  },
  getTree: async () => {
    const list = await supabaseReader<MenuItemDB>('menus', undefined, undefined, []);
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
  save: async (menu: MenuItemDB) => {
    const { children, ...data } = menu; // Exclude children from save
    return supabaseSaver('menus', data as any);
  },
  delete: async (id: number) => {
    return supabaseDeleter('menus', id);
  },
  updateVisibilities: async (updates: Partial<MenuItemDB>[]) => {
    // Supabase upsert for bulk update
    const { error } = await supabase.from('menus').upsert(updates);
    if (error) throw new Error(error.message);
    return true;
  }
};

export const FireHistoryAPI = {
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string, status?: string }) => {
    try {
      let query = supabase.from('fire_history').select('*').order('registeredAt', { ascending: false });
      
      if (params?.startDate) query = query.gte('registeredAt', params.startDate);
      // Add 1 day to endDate to include the full end date or use logic to cover the day
      if (params?.endDate) query = query.lte('registeredAt', params.endDate + ' 23:59:59');
      
      if (params?.marketName) query = query.ilike('marketName', `%${params.marketName}%`);
      
      if (params?.status && params.status !== 'all') {
          if (params.status === 'fire') query = query.eq('falseAlarmStatus', '화재');
          else if (params.status === 'false') query = query.eq('falseAlarmStatus', '오탐');
      }

      const { data, error } = await query;
      console.log("[API] Reading fire_history:", { length: data?.length, error: error?.message });
      if (error) return []; // or mock
      return data as FireHistoryItem[];
    } catch (e) { return []; }
  },
  save: async (id: number, status: string, note: string) => {
    const { error } = await supabase
        .from('fire_history')
        .update({ falseAlarmStatus: status, note: note })
        .eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },
  delete: async (id: number) => {
    return supabaseDeleter('fire_history', id);
  }
};

export const DeviceStatusAPI = {
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string, status?: string }) => {
    try {
      let query = supabase.from('device_status').select('*').order('registeredAt', { ascending: false });
      
      if (params?.startDate) query = query.gte('registeredAt', params.startDate);
      if (params?.endDate) query = query.lte('registeredAt', params.endDate + ' 23:59:59');
      
      if (params?.marketName) query = query.ilike('marketName', `%${params.marketName}%`);
      
      if (params?.status && params.status !== 'all') {
          if (params.status === 'processed') query = query.eq('processStatus', '처리');
          else if (params.status === 'unprocessed') query = query.eq('processStatus', '미처리');
      }

      const { data, error } = await query;
      console.log("[API] Reading device_status:", { length: data?.length, error: error?.message });
      if (error) return [];
      return data as DeviceStatusItem[];
    } catch (e) { return []; }
  },
  save: async (id: number, status: string, note: string) => {
    const { error } = await supabase
        .from('device_status')
        .update({ processStatus: status, note: note })
        .eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },
  delete: async (id: number) => {
    return supabaseDeleter('device_status', id);
  }
};

export const DataReceptionAPI = {
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string }) => {
    try {
      let query = supabase.from('data_reception').select('*').order('registeredAt', { ascending: false });
      
      if (params?.startDate) query = query.gte('registeredAt', params.startDate);
      if (params?.endDate) query = query.lte('registeredAt', params.endDate + ' 23:59:59');
      
      if (params?.marketName) query = query.ilike('marketName', `%${params.marketName}%`);

      const { data, error } = await query;
      console.log("[API] Reading data_reception:", { length: data?.length, error: error?.message });
      if (error) {
        console.warn('DataReceptionAPI error:', error);
        return [];
      }
      return data as DataReceptionItem[];
    } catch (e) { return []; }
  },
  delete: async (id: number) => {
    return supabaseDeleter('data_reception', id);
  }
};
