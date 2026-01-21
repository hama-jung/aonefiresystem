import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor, Store, WorkLog, Receiver, Repeater, Detector, Transmitter, Alarm, MenuItemDB, CommonCode, FireLog, DeviceStatusLog, DataReceptionLog, RawUartLog, FireHistoryItem, DeviceStatusItem, DataReceptionItem } from '../types';

/**
 * [Supabase 연동 완료]
 * 실제 Supabase DB와 통신합니다.
 */

// --- Helper: 에러 처리 ---
const handleError = (error: any) => {
  console.error("Supabase Error:", error);
  throw new Error(error.message || "데이터 처리 중 오류가 발생했습니다.");
};

// ... (existing syncDevicesFromStoreData code) ...
const syncDevicesFromStoreData = async (store: Store) => {
  if (!store.marketId || !store.receiverMac) return;

  try {
    // 1. 수신기 동기화 (Receiver)
    // 해당 MAC의 수신기가 있는지 확인
    const { data: existingReceiver } = await supabase
      .from('receivers')
      .select('id')
      .eq('macAddress', store.receiverMac)
      .limit(1)
      .maybeSingle();

    if (!existingReceiver) {
      // 없으면 생성
      await supabase.from('receivers').insert({
        marketId: store.marketId,
        macAddress: store.receiverMac,
        status: '사용',
        transmissionInterval: '01시간' // 기본값
      });
    }

    // 2. 중계기 동기화 (Repeater)
    if (store.repeaterId) {
      const { data: existingRepeater } = await supabase
        .from('repeaters')
        .select('id')
        .eq('receiverMac', store.receiverMac)
        .eq('repeaterId', store.repeaterId)
        .limit(1)
        .maybeSingle();

      if (!existingRepeater) {
        await supabase.from('repeaters').insert({
          marketId: store.marketId,
          receiverMac: store.receiverMac,
          repeaterId: store.repeaterId,
          status: '사용',
          alarmStatus: '사용'
        });
      }

      // 3. 감지기 동기화 (Detector)
      if (store.detectorId) {
        let detectorIdToLink: number | null = null;

        const { data: existingDetector } = await supabase
          .from('detectors')
          .select('id')
          .eq('receiverMac', store.receiverMac)
          .eq('repeaterId', store.repeaterId)
          .eq('detectorId', store.detectorId)
          .limit(1)
          .maybeSingle();

        if (!existingDetector) {
          // 감지기 생성
          const { data: newDetector, error: createError } = await supabase
            .from('detectors')
            .insert({
              marketId: store.marketId,
              receiverMac: store.receiverMac,
              repeaterId: store.repeaterId,
              detectorId: store.detectorId,
              mode: store.mode || '복합',
              status: '사용'
            })
            .select()
            .single();
          
          if (!createError && newDetector) {
            detectorIdToLink = newDetector.id;
          }
        } else {
          detectorIdToLink = existingDetector.id;
        }

        // 4. 감지기-상가 매핑 테이블 동기화 (Detector Stores)
        if (detectorIdToLink && store.id) {
          const { data: mapping } = await supabase
            .from('detector_stores')
            .select('id')
            .eq('detectorId', detectorIdToLink)
            .eq('storeId', store.id)
            .maybeSingle();

          if (!mapping) {
            await supabase.from('detector_stores').insert({
              detectorId: detectorIdToLink,
              storeId: store.id
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("Device Sync Failed:", err);
  }
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

export const MenuAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .order('sortOrder', { ascending: true });
    
    if (error) handleError(error);
    return data as MenuItemDB[];
  },

  toggleVisibility: async (id: number, field: 'isVisiblePc' | 'isVisibleMobile', value: boolean) => {
    const { error } = await supabase
      .from('menus')
      .update({ [field]: value })
      .eq('id', id);
    
    if (error) handleError(error);
    return true;
  },

  updateVisibilities: async (updates: {id: number, isVisiblePc: boolean, isVisibleMobile: boolean}[]) => {
    const promises = updates.map(u => 
        supabase
          .from('menus')
          .update({ isVisiblePc: u.isVisiblePc, isVisibleMobile: u.isVisibleMobile })
          .eq('id', u.id)
    );

    const results = await Promise.all(promises);
    
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
        console.error("Some updates failed", errors);
        throw new Error("일부 메뉴 설정을 저장하는 중 오류가 발생했습니다.");
    }
    return true;
  },

  save: async (menu: MenuItemDB) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, children, ...payload } = menu; 
    
    const dbPayload = {
        ...payload,
        parentId: payload.parentId ? payload.parentId : null
    };

    if (menu.id === 0) {
      const { data, error } = await supabase.from('menus').insert(dbPayload).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('menus').update(dbPayload).eq('id', menu.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('menus').delete().eq('id', id);
    if (error) {
       if (error.message.includes('foreign key constraint')) {
         throw new Error('하위 메뉴가 존재하는 메뉴는 삭제할 수 없습니다. 하위 메뉴를 먼저 삭제하거나 이동해주세요.');
       }
       handleError(error);
    }
    return true;
  },

  getTree: async () => {
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .order('sortOrder', { ascending: true });

    if (error) {
        console.warn("Menu fetch failed (might differ from schema):", error.message);
        return [];
    }

    const menus = data as MenuItemDB[];
    
    const buildTree = (parentId: number | null): MenuItemDB[] => {
      return menus
        .filter(menu => menu.parentId === parentId)
        .map(menu => ({
          ...menu,
          children: buildTree(menu.id)
        }));
    };

    return buildTree(null);
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

// --- 공통코드 API ---
export const CommonCodeAPI = {
  getList: async (params?: { groupName?: string, name?: string }) => {
    let query = supabase.from('common_codes').select('*').order('groupCode', { ascending: true }).order('code', { ascending: true });

    if (params?.groupName) query = query.ilike('groupName', `%${params.groupName}%`);
    if (params?.name) query = query.ilike('name', `%${params.name}%`);

    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  save: async (item: CommonCode) => {
    if (item.id === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...payload } = item;
      const { data, error } = await supabase.from('common_codes').insert(payload).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('common_codes').update(item).eq('id', item.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },

  saveBulk: async (items: CommonCode[]) => {
    if (items.length === 0) return;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const payload = items.map(({ id, ...rest }) => rest);
    const { error } = await supabase.from('common_codes').insert(payload);
    if (error) handleError(error);
    return true;
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('common_codes').delete().eq('id', id);
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
  // ... existing UserAPI methods ...
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

// ... (Other APIs remain unchanged: MarketAPI, DistributorAPI, StoreAPI, ReceiverAPI, RepeaterAPI, DetectorAPI, TransmitterAPI, AlarmAPI, WorkLogAPI, DashboardAPI, FireHistoryAPI, DeviceStatusAPI) ...

// ... (Export APIs)
export const MarketAPI = {
  // ... existing MarketAPI methods ...
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
    let savedMarket = null;

    if (market.id === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...newMarket } = market;
      const { data, error } = await supabase.from('markets').insert(newMarket).select().single();
      if (error) handleError(error);
      savedMarket = data;
    } else {
      const { data, error } = await supabase.from('markets').update(market).eq('id', market.id).select().single();
      if (error) handleError(error);
      savedMarket = data;

      if (market.usageStatus === '미사용' || market.usageStatus === '사용') {
        const marketId = market.id;
        const targetStatus = market.usageStatus; 
        try {
          const tables = ['stores', 'receivers', 'repeaters', 'detectors', 'transmitters', 'alarms'];
          
          await Promise.all(
            tables.map(table => 
              supabase.from(table).update({ status: targetStatus }).eq('marketId', marketId)
            )
          );
        } catch (cascadeError) {
          console.error(`Failed to cascade '${targetStatus}' status:`, cascadeError);
        }
      }
    }
    return savedMarket;
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('markets').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const DistributorAPI = {
  getList: async (params?: { address?: string, name?: string, managerName?: string }) => {
    let query = supabase.from('distributors').select('*').order('id', { ascending: false });

    if (params?.address && params.address !== '전체') {
      query = query.ilike('address', `%${params.address}%`);
    }
    if (params?.name) {
      query = query.ilike('name', `%${params.name}%`);
    }
    if (params?.managerName) {
      query = query.ilike('managerName', `%${params.managerName}%`);
    }

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

export const StoreAPI = {
  // ... existing StoreAPI methods ...
  getList: async (params?: { address?: string, marketName?: string, storeName?: string, marketId?: number }) => {
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
    if (params?.marketId) {
      query = query.eq('marketId', params.marketId);
    }

    query = query.order('id', { ascending: false });

    const { data, error } = await query;
    if (error) handleError(error);

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
    let savedData: Store;

    if (store.id === 0) {
      const { data, error } = await supabase.from('stores').insert(storeData).select().single();
      if (error) handleError(error);
      savedData = data as Store;
    } else {
      const { data, error } = await supabase.from('stores').update(storeData).eq('id', store.id).select().single();
      if (error) handleError(error);
      savedData = data as Store;
    }

    await syncDevicesFromStoreData(savedData);

    return savedData;
  },

  saveBulk: async (stores: Store[]) => {
    if (stores.length === 0) return;

    for (const store of stores) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, marketName, ...rest } = store;
        const { data, error } = await supabase.from('stores').insert(rest).select().single();
        if (error) {
            console.error("Bulk Save Error for store:", store.name, error);
            continue; 
        }
        await syncDevicesFromStoreData(data as Store);
    }
    return true;
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const ReceiverAPI = {
  // ... existing ReceiverAPI methods ...
  getList: async (params?: { marketName?: string, macAddress?: string, ip?: string, emergencyPhone?: string }) => {
    let query = supabase
      .from('receivers')
      .select('*, markets!inner(name)')
      .order('id', { ascending: false });

    if (params?.marketName) query = query.ilike('markets.name', `%${params.marketName}%`);
    if (params?.macAddress) query = query.ilike('macAddress', `%${params.macAddress}%`);
    if (params?.ip) query = query.ilike('ip', `%${params.ip}%`);
    if (params?.emergencyPhone) query = query.ilike('emergencyPhone', `%${params.emergencyPhone}%`);

    const { data, error } = await query;
    if (error) handleError(error);

    return (data || []).map((item: any) => ({
      ...item,
      marketName: item.markets?.name
    }));
  },

  save: async (receiver: Receiver) => {
    if (receiver.macAddress) {
      let checkQuery = supabase.from('receivers').select('id').eq('macAddress', receiver.macAddress);
      
      if (receiver.id !== 0) {
        checkQuery = checkQuery.neq('id', receiver.id);
      }
      
      const { data: duplicate } = await checkQuery.maybeSingle();
      if (duplicate) {
        throw new Error('이미 등록된 기기입니다. (MAC 주소 중복)');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, marketName, ...payload } = receiver;

    if (receiver.id === 0) {
      const { data, error } = await supabase.from('receivers').insert(payload).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('receivers').update(payload).eq('id', receiver.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },

  saveBulk: async (receivers: Receiver[]) => {
    if (receivers.length === 0) return;

    const errors: string[] = [];
    const seenMacs = new Set<string>();

    for (let i = 0; i < receivers.length; i++) {
        const row = receivers[i];
        const rowNum = i + 1;

        if (!row.macAddress) {
            errors.push(`[${rowNum}행] MAC 주소가 없습니다.`);
            continue;
        }

        if (seenMacs.has(row.macAddress)) {
            errors.push(`[${rowNum}행] 엑셀 파일 내 중복된 MAC 주소입니다: ${row.macAddress}`);
            continue;
        }
        seenMacs.add(row.macAddress);

        const { count } = await supabase.from('receivers')
            .select('id', { count: 'exact', head: true })
            .eq('macAddress', row.macAddress);
        
        if (count && count > 0) {
            errors.push(`[${rowNum}행] 이미 시스템에 등록된 기기입니다: ${row.macAddress}`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`데이터 검증 실패 (${errors.length}건):\n` + errors.slice(0, 5).join('\n') + (errors.length > 5 ? '\n...외 다수' : ''));
    }

    const payload = receivers.map(r => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, marketName, ...rest } = r;
      return rest;
    });
    
    const { error } = await supabase.from('receivers').insert(payload);
    if (error) handleError(error);
    return true;
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('receivers').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  },

  uploadImage: async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `receivers/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('receiver-images')
      .upload(filePath, file);

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
          throw new Error("스토리지 버킷(receiver-images)이 없습니다. supabase_receivers.sql을 실행해주세요.");
      }
      throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('receiver-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};

export const RepeaterAPI = {
  // ... existing RepeaterAPI methods ...
  getList: async (params?: { 
    marketName?: string, 
    receiverMac?: string, 
    repeaterId?: string, 
    alarmStatus?: string,
    status?: string 
  }) => {
    let query = supabase
      .from('repeaters')
      .select('*, markets!inner(name)')
      .order('id', { ascending: false });

    if (params?.marketName) query = query.ilike('markets.name', `%${params.marketName}%`);
    if (params?.receiverMac) query = query.ilike('receiverMac', `%${params.receiverMac}%`);
    if (params?.repeaterId) query = query.eq('repeaterId', params.repeaterId);
    if (params?.alarmStatus && params.alarmStatus !== '전체') query = query.eq('alarmStatus', params.alarmStatus);
    if (params?.status && params.status !== '전체') query = query.eq('status', params.status);

    const { data, error } = await query;
    if (error) handleError(error);

    return (data || []).map((item: any) => ({
      ...item,
      marketName: item.markets?.name
    }));
  },

  save: async (repeater: Repeater) => {
    if (repeater.receiverMac && repeater.repeaterId) {
      let checkQuery = supabase.from('repeaters')
        .select('id')
        .eq('receiverMac', repeater.receiverMac)
        .eq('repeaterId', repeater.repeaterId);
      
      if (repeater.id !== 0) {
        checkQuery = checkQuery.neq('id', repeater.id);
      }

      const { data: duplicate } = await checkQuery.maybeSingle();
      if (duplicate) {
        throw new Error('이미 등록된 기기입니다. (해당 수신기에 동일한 중계기 ID 존재)');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, marketName, ...payload } = repeater;

    if (repeater.id === 0) {
      const { data, error } = await supabase.from('repeaters').insert(payload).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('repeaters').update(payload).eq('id', repeater.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },

  saveBulk: async (repeaters: Repeater[]) => {
    if (repeaters.length === 0) return;

    const errors: string[] = [];
    const seenIds = new Set<string>(); 

    for (let i = 0; i < repeaters.length; i++) {
        const row = repeaters[i];
        const rowNum = i + 1;
        const key = `${row.receiverMac}_${row.repeaterId}`;

        if (!row.receiverMac || !row.repeaterId) {
            errors.push(`[${rowNum}행] 수신기MAC 또는 중계기ID가 없습니다.`);
            continue;
        }

        if (seenIds.has(key)) {
            errors.push(`[${rowNum}행] 엑셀 파일 내 중복된 중계기입니다: ${row.receiverMac} - ${row.repeaterId}`);
            continue;
        }
        seenIds.add(key);

        const { count } = await supabase.from('repeaters')
            .select('id', { count: 'exact', head: true })
            .eq('receiverMac', row.receiverMac)
            .eq('repeaterId', row.repeaterId);
        
        if (count && count > 0) {
            errors.push(`[${rowNum}행] 이미 등록된 기기입니다: ${row.receiverMac} - ${row.repeaterId}`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`데이터 검증 실패 (${errors.length}건):\n` + errors.slice(0, 5).join('\n') + (errors.length > 5 ? '\n...외 다수' : ''));
    }

    const payload = repeaters.map(r => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, marketName, ...rest } = r;
      return rest;
    });
    const { error } = await supabase.from('repeaters').insert(payload);
    if (error) handleError(error);
    return true;
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('repeaters').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  },

  uploadImage: async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `repeaters/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('repeater-images')
      .upload(filePath, file);

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
          throw new Error("스토리지 버킷(repeater-images)이 없습니다. supabase_repeaters.sql을 실행해주세요.");
      }
      throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('repeater-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};

export const DetectorAPI = {
  // ... existing DetectorAPI methods ...
  getList: async (params?: { 
    marketName?: string,
    storeName?: string, 
    receiverMac?: string, 
    repeaterId?: string, 
    detectorId?: string 
  }) => {
    // detector_stores 조인 추가
    let query = supabase
      .from('detectors')
      .select(`
        *,
        markets!inner(name),
        detector_stores (
          stores (id, name)
        )
      `)
      .order('id', { ascending: false });

    if (params?.marketName) query = query.ilike('markets.name', `%${params.marketName}%`);
    
    if (params?.receiverMac) query = query.ilike('receiverMac', `%${params.receiverMac}%`);
    if (params?.repeaterId) query = query.eq('repeaterId', params.repeaterId);
    if (params?.detectorId) query = query.eq('detectorId', params.detectorId);

    const { data, error } = await query;
    if (error) handleError(error);

    return (data || []).map((item: any) => ({
      ...item,
      marketName: item.markets?.name,
      stores: item.detector_stores?.map((ds: any) => ds.stores) || []
    }));
  },

  save: async (detector: Detector) => {
    if (detector.receiverMac && detector.repeaterId && detector.detectorId) {
      let checkQuery = supabase.from('detectors')
        .select('id')
        .eq('receiverMac', detector.receiverMac)
        .eq('repeaterId', detector.repeaterId)
        .eq('detectorId', detector.detectorId);
      
      if (detector.id !== 0) {
        checkQuery = checkQuery.neq('id', detector.id);
      }

      const { data: duplicate } = await checkQuery.maybeSingle();
      if (duplicate) {
        throw new Error('이미 등록된 기기입니다. (해당 중계기에 동일한 감지기 ID 존재)');
      }
    }

    const detectorPayload = {
      marketId: detector.marketId,
      receiverMac: detector.receiverMac,
      repeaterId: detector.repeaterId,
      detectorId: detector.detectorId,
      mode: detector.mode,
      cctvUrl: detector.cctvUrl,
      status: detector.status,
      smsList: detector.smsList,
      memo: detector.memo
    };

    let savedDetectorId = detector.id;

    if (detector.id === 0) {
      const { data, error } = await supabase.from('detectors').insert(detectorPayload).select().single();
      if (error) handleError(error);
      savedDetectorId = data.id;
    } else {
      const { error } = await supabase.from('detectors').update(detectorPayload).eq('id', detector.id);
      if (error) handleError(error);
    }

    const { error: deleteError } = await supabase.from('detector_stores').delete().eq('detectorId', savedDetectorId);
    if (deleteError) handleError(deleteError);

    if (detector.stores && detector.stores.length > 0) {
      const storeInserts = detector.stores.map(s => ({
        detectorId: savedDetectorId,
        storeId: s.id
      }));
      const { error: insertError } = await supabase.from('detector_stores').insert(storeInserts);
      if (insertError) handleError(insertError);

      try {
        await Promise.all(detector.stores.map(s => 
          supabase.from('stores').update({
            receiverMac: detector.receiverMac,
            repeaterId: detector.repeaterId,
            detectorId: detector.detectorId
          }).eq('id', s.id)
        ));
      } catch (syncError) {
        console.error("Failed to sync updated detector info to stores:", syncError);
      }
    }

    return true;
  },

  saveBulk: async (detectors: Detector[]) => {
    if (detectors.length === 0) return;
    
    const errors: string[] = [];
    const seenIds = new Set<string>(); 

    for (let i = 0; i < detectors.length; i++) {
        const row = detectors[i];
        const rowNum = i + 1;
        const key = `${row.receiverMac}_${row.repeaterId}_${row.detectorId}`;

        if (!row.receiverMac || !row.repeaterId || !row.detectorId) {
            errors.push(`[${rowNum}행] 수신기MAC, 중계기ID, 감지기ID는 필수입니다.`);
            continue;
        }

        if (seenIds.has(key)) {
            errors.push(`[${rowNum}행] 엑셀 파일 내 중복된 감지기입니다: ${key}`);
            continue;
        }
        seenIds.add(key);

        const { count } = await supabase.from('detectors')
            .select('id', { count: 'exact', head: true })
            .eq('receiverMac', row.receiverMac)
            .eq('repeaterId', row.repeaterId)
            .eq('detectorId', row.detectorId);
        
        if (count && count > 0) {
            errors.push(`[${rowNum}행] 이미 등록된 기기입니다: ${key}`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`데이터 검증 실패 (${errors.length}건):\n` + errors.slice(0, 5).join('\n') + (errors.length > 5 ? '\n...외 다수' : ''));
    }

    for (const d of detectors) {
        const payload = {
            marketId: d.marketId,
            receiverMac: d.receiverMac,
            repeaterId: d.repeaterId,
            detectorId: d.detectorId,
            mode: d.mode,
            cctvUrl: d.cctvUrl,
            status: d.status,
            memo: d.memo
        };
        const { data: savedDetector, error } = await supabase.from('detectors').insert(payload).select().single();
        
        if (error) {
            console.error("Bulk Insert Error:", error);
            continue;
        }

        if (d.stores && d.stores.length > 0) {
            const storeName = d.stores[0].name;
            const { data: storeData } = await supabase.from('stores')
                .select('id')
                .eq('marketId', d.marketId)
                .eq('name', storeName)
                .maybeSingle();

            if (storeData) {
                await supabase.from('detector_stores').insert({
                    detectorId: savedDetector.id,
                    storeId: storeData.id
                });
                await supabase.from('stores').update({
                    receiverMac: d.receiverMac,
                    repeaterId: d.repeaterId,
                    detectorId: d.detectorId
                }).eq('id', storeData.id);
            }
        }
    }
    return true;
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('detectors').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const TransmitterAPI = {
  // ... existing TransmitterAPI methods ...
  getList: async (params?: { marketName?: string, receiverMac?: string, usageStatus?: string }) => {
    let query = supabase
      .from('transmitters')
      .select('*, markets!inner(name)')
      .order('id', { ascending: false });

    if (params?.marketName) query = query.ilike('markets.name', `%${params.marketName}%`);
    if (params?.receiverMac) query = query.ilike('receiverMac', `%${params.receiverMac}%`);
    if (params?.usageStatus && params.usageStatus !== '전체') query = query.eq('status', params.usageStatus); 

    const { data, error } = await query;
    if (error) handleError(error);

    return (data || []).map((item: any) => ({
      ...item,
      marketName: item.markets?.name
    }));
  },
  save: async (transmitter: Transmitter) => {
    // ... same as before
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, marketName, ...payload } = transmitter;
    
    if (transmitter.id === 0) {
      const { data, error } = await supabase.from('transmitters').insert(payload).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('transmitters').update(payload).eq('id', transmitter.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },
  delete: async (id: number) => {
    const { error } = await supabase.from('transmitters').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const AlarmAPI = {
  getList: async (params?: { marketName?: string, receiverMac?: string, usageStatus?: string }) => {
    let query = supabase
      .from('alarms')
      .select('*, markets!inner(name)')
      .order('id', { ascending: false });

    if (params?.marketName) query = query.ilike('markets.name', `%${params.marketName}%`);
    if (params?.receiverMac) query = query.ilike('receiverMac', `%${params.receiverMac}%`);
    if (params?.usageStatus && params.usageStatus !== '전체') query = query.eq('status', params.usageStatus);

    const { data, error } = await query;
    if (error) handleError(error);

    return (data || []).map((item: any) => ({
      ...item,
      marketName: item.markets?.name
    }));
  },
  save: async (alarm: Alarm) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, marketName, ...payload } = alarm;
    
    if (alarm.id === 0) {
      const { data, error } = await supabase.from('alarms').insert(payload).select().single();
      if (error) handleError(error);
      return data;
    } else {
      const { data, error } = await supabase.from('alarms').update(payload).eq('id', alarm.id).select().single();
      if (error) handleError(error);
      return data;
    }
  },
  delete: async (id: number) => {
    const { error } = await supabase.from('alarms').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const WorkLogAPI = {
  getList: async (params?: { marketName?: string }) => {
    let query = supabase
      .from('work_logs')
      .select('*, markets!inner(name)')
      .order('workDate', { ascending: false });

    if (params?.marketName) query = query.ilike('markets.name', `%${params.marketName}%`);

    const { data, error } = await query;
    if (error) handleError(error);

    return (data || []).map((item: any) => ({
      ...item,
      marketName: item.markets?.name
    }));
  },

  uploadAttachment: async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `worklogs/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('work-log-images') // Make sure this bucket exists
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
  },

  save: async (log: WorkLog) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, marketName, ...payload } = log;

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
  }
};

export const DashboardAPI = {
  getData: async () => {
    // Mock Data for now as dashboard logic is complex (aggregation)
    // You can implement real queries here later
    return {
      stats: [
        { label: '최근 화재 발생', value: 0, type: 'fire', color: 'bg-red-500' },
        { label: '최근 고장 발생', value: 0, type: 'fault', color: 'bg-orange-500' },
        { label: '통신 이상', value: 0, type: 'error', color: 'bg-gray-500' },
      ],
      fireLogs: [],
      faultLogs: [],
      mapPoints: [
        { id: 1, x: 30, y: 40, name: '서울/경기', status: 'normal' },
        { id: 2, x: 60, y: 50, name: '경상북도', status: 'normal' },
        { id: 3, x: 40, y: 70, name: '전라북도', status: 'normal' },
      ]
    };
  }
};

export const FireHistoryAPI = {
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string, status?: string }) => {
    let query = supabase
      .from('fire_history')
      .select('*')
      .order('registeredAt', { ascending: false });

    // [Filter Logic Added]
    if (params) {
        if (params.startDate) {
            // startDate의 00:00:00 부터
            query = query.gte('registeredAt', `${params.startDate}T00:00:00`);
        }
        if (params.endDate) {
            // endDate의 23:59:59 까지
            query = query.lte('registeredAt', `${params.endDate}T23:59:59.999`);
        }
        if (params.marketName) {
            query = query.ilike('marketName', `%${params.marketName}%`);
        }
        if (params.status && params.status !== 'all') {
            const statusMap: Record<string, string> = {
                'fire': '화재',
                'false': '오탐'
            };
            if (statusMap[params.status]) {
                query = query.eq('falseAlarmStatus', statusMap[params.status]);
            }
        }
    }

    const { data, error } = await query;
    if (error) handleError(error);
    return data as FireHistoryItem[];
  },

  save: async (id: number, type: '화재' | '오탐', memo?: string) => {
    const { error } = await supabase
      .from('fire_history')
      .update({ 
        falseAlarmStatus: type,
        note: memo 
      })
      .eq('id', id);
    
    if (error) handleError(error);
    return true;
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('fire_history').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

export const DeviceStatusAPI = {
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string, status?: string }) => {
    let query = supabase
      .from('device_status')
      .select('*')
      .order('registeredAt', { ascending: false });

    if (params) {
        if (params.startDate) {
            query = query.gte('registeredAt', `${params.startDate}T00:00:00`);
        }
        if (params.endDate) {
            query = query.lte('registeredAt', `${params.endDate}T23:59:59.999`);
        }
        if (params.marketName) {
            query = query.ilike('marketName', `%${params.marketName}%`);
        }
        if (params.status && params.status !== 'all') {
            // 'all', 'processed' ('처리'), 'unprocessed' ('미처리')
            const statusMap: Record<string, string> = {
                'processed': '처리',
                'unprocessed': '미처리'
            };
            if (statusMap[params.status]) {
                query = query.eq('processStatus', statusMap[params.status]);
            }
        }
    }

    const { data, error } = await query;
    if (error) handleError(error);
    return data as DeviceStatusItem[];
  },

  save: async (id: number, status: '처리' | '미처리', note?: string) => {
    const { error } = await supabase
      .from('device_status')
      .update({ 
        processStatus: status,
        note: note 
      })
      .eq('id', id);
    
    if (error) handleError(error);
    return true;
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('device_status').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};

// [NEW] DataReceptionAPI
export const DataReceptionAPI = {
  getList: async (params?: { startDate?: string, endDate?: string, marketName?: string }) => {
    let query = supabase
      .from('data_reception')
      .select('*')
      .order('registeredAt', { ascending: false }); // Sort by latest

    if (params) {
        if (params.startDate) {
            query = query.gte('registeredAt', `${params.startDate}T00:00:00`);
        }
        if (params.endDate) {
            query = query.lte('registeredAt', `${params.endDate}T23:59:59.999`);
        }
        if (params.marketName) {
            query = query.ilike('marketName', `%${params.marketName}%`);
        }
    }

    const { data, error } = await query;
    if (error) handleError(error);
    return data as DataReceptionItem[];
  },

  delete: async (id: number) => {
    const { error } = await supabase.from('data_reception').delete().eq('id', id);
    if (error) handleError(error);
    return true;
  }
};
