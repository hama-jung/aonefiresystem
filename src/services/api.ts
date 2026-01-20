import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor, Store, WorkLog, Receiver, Repeater, Detector, Transmitter, Alarm, MenuItemDB } from '../types';

/**
 * [Supabase 연동 완료]
 * 실제 Supabase DB와 통신합니다.
 */

// --- Helper: 에러 처리 ---
const handleError = (error: any) => {
  console.error("Supabase Error:", error);
  throw new Error(error.message || "데이터 처리 중 오류가 발생했습니다.");
};

// --- Helper: 기기 데이터 동기화 (상가 -> 기기) ---
// 상가 정보(MAC, 중계기ID, 감지기ID)가 저장될 때, 해당 기기가 없으면 자동 생성합니다.
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

  // [New] 일괄 노출 설정 업데이트
  updateVisibilities: async (updates: {id: number, isVisiblePc: boolean, isVisibleMobile: boolean}[]) => {
    // Supabase JS에는 bulk update 기능이 제한적이므로 Promise.all로 병렬 처리
    // 트랜잭션 처리는 아니지만, 메뉴 설정의 특성상 허용 가능한 수준
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
  // ... (이하 동일)
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

      // [Cascade Logic] If market usageStatus is updated, cascade update to all child tables
      if (market.usageStatus === '미사용' || market.usageStatus === '사용') {
        const marketId = market.id;
        const targetStatus = market.usageStatus; // '사용' or '미사용'
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

export const StoreAPI = {
  getList: async (params?: { address?: string, marketName?: string, storeName?: string, marketId?: number }) => {
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
    if (params?.marketId) {
      query = query.eq('marketId', params.marketId);
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

    // [중요] 상가 정보 저장 후, 기기 정보(수신기, 중계기, 감지기) 동기화
    await syncDevicesFromStoreData(savedData);

    return savedData;
  },

  // 엑셀 일괄 등록용 (bulk insert)
  saveBulk: async (stores: Store[]) => {
    if (stores.length === 0) return;

    // 1. 순차적으로 저장하여 동기화 로직 수행 (Bulk insert는 트리거 없이는 로직 수행 불가하므로 반복문 사용)
    for (const store of stores) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, marketName, ...rest } = store;
        const { data, error } = await supabase.from('stores').insert(rest).select().single();
        if (error) {
            console.error("Bulk Save Error for store:", store.name, error);
            // 하나 실패해도 나머지는 진행
            continue; 
        }
        // 기기 동기화 (기기 자동 생성)
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
  // ... (이하 동일)
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
    // 1. 중복 체크 (MAC Address)
    if (receiver.macAddress) {
      let checkQuery = supabase.from('receivers').select('id').eq('macAddress', receiver.macAddress);
      
      // 수정 시에는 자기 자신 제외
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

    // 1. 엑셀 파일 내 중복 검사 & DB 중복 검사 (Batch)
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

        // DB 중복 확인
        const { count } = await supabase.from('receivers')
            .select('id', { count: 'exact', head: true })
            .eq('macAddress', row.macAddress);
        
        if (count && count > 0) {
            errors.push(`[${rowNum}행] 이미 시스템에 등록된 기기입니다: ${row.macAddress}`);
        }
    }

    // 에러가 하나라도 있으면 전체 중단
    if (errors.length > 0) {
        throw new Error(`데이터 검증 실패 (${errors.length}건):\n` + errors.slice(0, 5).join('\n') + (errors.length > 5 ? '\n...외 다수' : ''));
    }

    // 2. 일괄 등록 수행
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
    // 1. 중복 체크 (ReceiverMAC + RepeaterID)
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
    const seenIds = new Set<string>(); // Key: ReceiverMAC_RepeaterID

    // 1. 검증 Loop
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
    // 상가명 검색은 조인된 detector_stores를 필터링해야 하는데, 
    // Supabase의 !inner 조인 필터링이 복잡하므로 여기서는 간단한 필터링만 구현하거나
    // detector_stores.stores.name에 대해 필터를 걸어야 함.
    
    if (params?.receiverMac) query = query.ilike('receiverMac', `%${params.receiverMac}%`);
    if (params?.repeaterId) query = query.eq('repeaterId', params.repeaterId);
    if (params?.detectorId) query = query.eq('detectorId', params.detectorId);

    const { data, error } = await query;
    if (error) handleError(error);

    return (data || []).map((item: any) => ({
      ...item,
      marketName: item.markets?.name,
      // detector_stores 배열을 stores 배열로 매핑
      stores: item.detector_stores?.map((ds: any) => ds.stores) || []
    }));
  },

  save: async (detector: Detector) => {
    // 1. 중복 체크 (ReceiverMAC + RepeaterID + DetectorID)
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

    // 1. 순수 Detector 데이터만 추출 (DB 컬럼에 맞게)
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

    // 2. Detector 저장 (Insert / Update)
    if (detector.id === 0) {
      const { data, error } = await supabase.from('detectors').insert(detectorPayload).select().single();
      if (error) handleError(error);
      savedDetectorId = data.id;
    } else {
      const { error } = await supabase.from('detectors').update(detectorPayload).eq('id', detector.id);
      if (error) handleError(error);
    }

    // 3. 연결된 상가 저장 (Junction Table)
    const { error: deleteError } = await supabase.from('detector_stores').delete().eq('detectorId', savedDetectorId);
    if (deleteError) handleError(deleteError);

    if (detector.stores && detector.stores.length > 0) {
      const storeInserts = detector.stores.map(s => ({
        detectorId: savedDetectorId,
        storeId: s.id
      }));
      const { error: insertError } = await supabase.from('detector_stores').insert(storeInserts);
      if (insertError) handleError(insertError);

      // [중요] 연결된 상가들의 Device 정보를 역으로 업데이트
      // 상가 관리 메뉴에서도 해당 감지기 정보가 보이도록 동기화
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
    const seenIds = new Set<string>(); // Key: ReceiverMAC_RepeaterID_DetectorID

    // 1. 검증 Loop (전체 데이터 무결성 체크)
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

    // 2. 등록 실행 (순차 등록하여 상가 매핑 로직 수행)
    for (const d of detectors) {
        // 감지기 기본 정보 저장
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
            // 위에서 검증했더라도 동시성 이슈 등으로 실패할 수 있음
            console.error("Bulk Insert Error:", error);
            continue;
        }

        // 상가 연동
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
  getList: async (params?: { marketName?: string, receiverMac?: string, usageStatus?: string }) => {
    let query = supabase
      .from('transmitters')
      .select('*, markets!inner(name)')
      .order('id', { ascending: false });

    if (params?.marketName) query = query.ilike('markets.name', `%${params.marketName}%`);
    if (params?.receiverMac) query = query.ilike('receiverMac', `%${params.receiverMac}%`);
    if (params?.usageStatus && params.usageStatus !== '전체') query = query.eq('status', params.usageStatus); // Query against 'status'

    const { data, error } = await query;
    if (error) handleError(error);

    return (data || []).map((item: any) => ({
      ...item,
      marketName: item.markets?.name
    }));
  },

  save: async (transmitter: Transmitter) => {
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
    if (params?.usageStatus && params.usageStatus !== '전체') query = query.eq('status', params.usageStatus); // Query against 'status'

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