import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor } from '../types';

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

    if (fetchError || !user) throw new Error('사용자를 찾을 수 없습니다.');
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
    // 1. 파일명 생성 (충돌 방지를 위해 타임스탬프 추가)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `maps/${fileName}`;

    // 2. Supabase Storage에 업로드 (버킷명: 'market-maps')
    const { error: uploadError } = await supabase.storage
      .from('market-maps')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Image Upload Error:', uploadError);
      // 구체적인 에러 메시지를 포함하여 throw
      throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
    }

    // 3. 공개 URL 가져오기
    const { data } = supabase.storage
      .from('market-maps')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  save: async (market: Market) => {
    // 변환 로직 제거: 프론트엔드의 Market 객체 그대로 DB에 전송
    // (distributorId 등 CamelCase 필드명이 DB 컬럼명과 일치한다고 가정)
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