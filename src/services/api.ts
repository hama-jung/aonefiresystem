import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor, Store, WorkLog } from '../types';

/**
 * [Supabase 연동 완료]
 * 실제 Supabase DB와 통신합니다.
 */

// --- Helper: 에러 처리 ---
const handleError = (error: any) => {
  console.error("Supabase Error:", error);
  throw new Error(error.message || "데이터 처리 중 오류가 발생했습니다.");
};

// --- API Services ---

export const AuthAPI = {
  login: async (id: string, pw: string) => {
    // 1. users 테이블에서 매칭되는 사용자 조회
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('userId', id) 
      .eq('password', pw)
      .single();

    if (error || !data) {
      throw new Error('아이디나 비밀번호가 틀립니다.');
    }

    if (data.status !== '사용') {
      throw new Error('사용 중지된 계정입니다. 관리자에게 문의하세요.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userInfo } = data;
    return {
      success: true,
      token: 'supabase-session-token',
      user: userInfo
    };
  },

  changePassword: async (userId: string, currentPw: string, newPw: string) => {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password')
      .eq('userId', userId)
      .single();

    if (fetchError || !user) throw new Error('사용자를 찾을 수 없습니다. (ID 불일치)');
    if (user.password !== currentPw) throw new Error('현재 비밀번호가 일치하지 않습니다.');

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: newPw })
      .eq('userId', userId);

    if (updateError) handleError(updateError);
    return { success: true };
  }
};

export const RoleAPI = {
  getList: async (params?: { code?: string, name?: string }) => {
    let query = supabase.from('roles').select('*').order('id', { ascending: true });

    if (params?.code) query = query.ilike('code', `%${params.code}%`);
    if (params?.name) query = query.ilike('name', `%${params.name}%`);

    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  save: async (role: RoleItem) => {
    if (role.id === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...newRole } = role;
      const { data, error } = await supabase.from('roles').insert(newRole).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('roles').update(role).eq('id', role.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const CommonAPI = {
  getCompanyList: async (searchName?: string) => {
    const [distRes, marketRes] = await Promise.all([
      supabase.from('distributors').select('id, name, managerName, managerPhone'),
      supabase.from('markets').select('id, name, managerName, managerPhone')
    ]);

    if (distRes.error) handleError(distRes.error);
    if (marketRes.error) handleError(marketRes.error);

    const distributors = (distRes.data || []).map(d => ({
      id: `D_${d.id}`,
      name: d.name,
      type: '총판',
      manager: d.managerName,
      phone: d.managerPhone
    }));

    const markets = (marketRes.data || []).map(m => ({
      id: `M_${m.id}`,
      name: m.name,
      type: '시장',
      manager: m.managerName,
      phone: m.managerPhone
    }));

    let all = [...distributors, ...markets];

    if (searchName) {
      all = all.filter(c => c.name.includes(searchName));
    }

    return all;
  }
};

export const UserAPI = {
  getList: async (params?: { userId?: string, name?: string, role?: string, department?: string }) => {
    let query = supabase.from('users').select('*').order('id', { ascending: false });

    if (params?.userId) query = query.ilike('userId', `%${params.userId}%`);
    if (params?.name) query = query.ilike('name', `%${params.name}%`);
    if (params?.role && params.role !== '전체') query = query.eq('role', params.role);
    if (params?.department) query = query.ilike('department', `%${params.department}%`);

    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  checkDuplicate: async (userId: string) => {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId);
    
    if (error) handleError(error);
    return (count || 0) > 0;
  },

  save: async (user: User) => {
    if (user.id === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...newUser } = user;
      const { data, error } = await supabase.from('users').insert(newUser).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('users').update(user).eq('id', user.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const MarketAPI = {
  getList: async (params?: { name?: string, address?: string, managerName?: string }) => {
    let query = supabase.from('markets').select('*').order('id', { ascending: false });

    if (params?.name) query = query.ilike('name', `%${params.name}%`);
    if (params?.address) query = query.ilike('address', `%${params.address}%`);
    if (params?.managerName) query = query.ilike('managerName', `%${params.managerName}%`);

    const { data, error } = await query;
    if (error) handleError(error);

    return data || [];
  },

  uploadMapImage: async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `maps/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('market-maps')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Image Upload Error:', uploadError);
      if (uploadError.message.includes('Bucket not found')) {
          throw new Error("스토리지 버킷(market-maps)이 없습니다. supabase_storage.sql을 실행해주세요.");
      }
      throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('market-maps')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  save: async (market: Market) => {
    if (market.id === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...newMarket } = market;
      const { data, error } = await supabase.from('markets').insert(newMarket).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('markets').update(market).eq('id', market.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('markets').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const StoreAPI = {
  getList: async (params?: { address?: string, marketName?: string, storeName?: string }) => {
    // 1. markets 테이블과 Join (Inner Join)
    let query = supabase
      .from('stores')
      .select('*, markets!inner(name, address, "addressDetail")'); 

    if (params?.marketName) {
      query = query.ilike('markets.name', `%${params.marketName}%`);
    }
    if (params?.address) {
      query = query.ilike('markets.address', `%${params.address}%`);
    }
    if (params?.storeName) {
      query = query.ilike('name', `%${params.storeName}%`);
    }

    query = query.order('id', { ascending: false });

    const { data, error } = await query;
    if (error) handleError(error);

    // 2. 결과 매핑
    const formattedData = (data || []).map((s: any) => ({
      id: s.id,
      marketId: s.marketId,
      marketName: s.markets?.name,
      name: s.name,
      managerName: s.managerName,
      managerPhone: s.managerPhone,
      status: s.status,
      storeImage: s.storeImage,
      memo: s.memo,
      receiverMac: s.receiverMac,
      repeaterId: s.repeaterId,
      detectorId: s.detectorId,
      mode: s.mode,
      // 새로 추가된 필드들 (Supabase DB에 컬럼이 존재해야 함)
      address: s.address,
      addressDetail: s.addressDetail,
      latitude: s.latitude,
      longitude: s.longitude,
      handlingItems: s.handlingItems,
    }));

    return formattedData as Store[];
  },

  uploadStoreImage: async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `stores/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('store-images')
      .upload(filePath, file);

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
          throw new Error("스토리지 버킷(store-images)이 없습니다. supabase_storage.sql을 실행해주세요.");
      }
      throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('store-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  save: async (store: Store) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, marketName, ...storeData } = store;

    if (store.id === 0) {
      const { data, error } = await supabase.from('stores').insert(storeData).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('stores').update(storeData).eq('id', store.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },

  // 엑셀 일괄 등록용 (bulk insert)
  saveBulk: async (stores: Store[]) => {
    if (stores.length === 0) return;

    // marketName 등 DB에 없는 필드 제거
    const dbDataList = stores.map(store => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, marketName, ...rest } = store;
      return rest;
    });

    const { error } = await supabase.from('stores').insert(dbDataList);
    if (error) handleError(error);
    return true;
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const DistributorAPI = {
  getList: async (params?: { address?: string, name?: string, managerName?: string }) => {
    let query = supabase.from('distributors').select('*').order('id', { ascending: false });

    if (params?.address && params.address !== '전체') query = query.ilike('address', `%${params.address}%`);
    if (params?.name) query = query.ilike('name', `%${params.name}%`);
    if (params?.managerName) query = query.ilike('managerName', `%${params.managerName}%`);

    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  save: async (dist: Distributor) => {
    if (dist.id === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...newDist } = dist;
      const { data, error } = await supabase.from('distributors').insert(newDist).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('distributors').update(dist).eq('id', dist.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('distributors').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const WorkLogAPI = {
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string }) => {
    let query = supabase
      .from('work_logs')
      .select('*, markets!inner(name)')
      .order('workDate', { ascending: false });

    if (params?.startDate) query = query.gte('workDate', params.startDate);
    if (params?.endDate) query = query.lte('workDate', params.endDate);
    if (params?.marketName) query = query.ilike('markets.name', `%${params.marketName}%`);

    const { data, error } = await query;
    if (error) handleError(error);

    return (data || []).map((item: any) => ({
      ...item,
      marketName: item.markets?.name
    }));
  },

  save: async (log: WorkLog) => {
    // Supabase에 저장할 때 join된 객체(markets)가 있으면 에러가 발생하므로,
    // 저장할 필드만 명시적으로 추출하여 전송합니다.
    const payload = {
      marketId: log.marketId,
      workDate: log.workDate,
      content: log.content,
      attachment: log.attachment
    };
    
    if (log.id === 0) {
      const { data, error } = await supabase.from('work_logs').insert(payload).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('work_logs').update(payload).eq('id', log.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('work_logs').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  },

  uploadAttachment: async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `work-logs/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('work-log-images')
      .upload(filePath, file);

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
          throw new Error("스토리지 버킷(work-log-images)이 없습니다. supabase_worklogs.sql을 실행해주세요.");
      }
      throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('work-log-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};

export const DashboardAPI = {
  getData: async () => {
    const [fireRes, faultRes] = await Promise.all([
      supabase.from('fire_events').select('*', { count: 'exact', head: true }).eq('type', 'fire'),
      supabase.from('fire_events').select('*', { count: 'exact', head: true }).eq('type', 'fault'),
    ]);

    const fireCount = fireRes.count || 0;
    const faultCount = faultRes.count || 0;

    const { data: logs } = await supabase
      .from('fire_events')
      .select('*')
      .order('time', { ascending: false })
      .limit(5);

    const fireLogs = (logs || []).filter(l => l.type === 'fire');
    const faultLogs = (logs || []).filter(l => l.type === 'fault');

    const mapPoints = [
      { id: 1, x: 30, y: 40, name: '서울/경기', status: 'normal' },
      { id: 2, x: 60, y: 50, name: '경상북도', status: fireCount > 0 ? 'fire' : 'normal' },
      { id: 3, x: 40, y: 70, name: '전라북도', status: 'normal' },
    ];

    return {
      stats: [
        { label: '최근 화재 발생', value: fireCount, type: 'fire', color: 'bg-red-500' },
        { label: '최근 고장 발생', value: faultCount, type: 'fault', color: 'bg-orange-500' },
        { label: '통신 이상', value: 0, type: 'error', color: 'bg-gray-500' },
      ],
      fireLogs: fireLogs,
      faultLogs: faultLogs,
      mapPoints: mapPoints
    };
  }
};