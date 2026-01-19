import { supabase } from '../lib/supabaseClient';
import { User, RoleItem, Market, Distributor } from '../types';

/**
 * [Supabase 연동 완료]
 * 이제 메모리(MOCK) 데이터 대신 실제 Supabase DB와 통신합니다.
 * UI 코드는 변경할 필요가 없습니다.
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
    // (보안상 실제 서비스에선 Supabase Auth를 쓰는게 좋지만, 현재 구조 유지를 위해 테이블 조회 방식 사용)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('userId', id) // "userId" 대소문자 주의 (따옴표로 생성했으므로)
      .eq('password', pw)
      .single();

    if (error || !data) {
      throw new Error('아이디나 비밀번호가 틀립니다.');
    }

    if (data.status !== '사용') {
      throw new Error('사용 중지된 계정입니다. 관리자에게 문의하세요.');
    }

    // 비밀번호 제외하고 리턴
    const { password, ...userInfo } = data;
    return {
      success: true,
      token: 'supabase-session-token', // 실제 토큰 대신 더미 토큰
      user: userInfo
    };
  },

  changePassword: async (userId: string, currentPw: string, newPw: string) => {
    // 1. 현재 비밀번호 확인
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password')
      .eq('userId', userId)
      .single();

    if (fetchError || !user) throw new Error('사용자를 찾을 수 없습니다.');
    if (user.password !== currentPw) throw new Error('현재 비밀번호가 일치하지 않습니다.');

    // 2. 비밀번호 업데이트
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
    // id가 0이면 신규, 아니면 수정
    if (role.id === 0) {
      // 신규 등록 (id 제외)
      const { id, ...newRole } = role;
      const { data, error } = await supabase.from('roles').insert(newRole).select().single();
      if (error) handleError(error);
      return data;
    } else {
      // 수정
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
  // 총판 + 시장 목록 통합 조회 (부서/업체명 검색용)
  getCompanyList: async (searchName?: string) => {
    // 병렬로 조회
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
    if (params?.role && params.role !== '전체') query = query.eq('role', params.role); // role은 정확히 일치
    if (params?.department) query = query.ilike('department', `%${params.department}%`);

    const { data, error } = await query;
    if (error) handleError(error);
    return data || [];
  },

  checkDuplicate: async (userId: string) => {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true }) // 데이터 없이 개수만 조회
      .eq('userId', userId);
    
    if (error) handleError(error);
    return (count || 0) > 0;
  },

  save: async (user: User) => {
    if (user.id === 0) {
      // 신규
      const { id, ...newUser } = user;
      const { data, error } = await supabase.from('users').insert(newUser).select().single();
      if (error) handleError(error);
      return data;
    } else {
      // 수정
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

  save: async (market: Market) => {
    if (market.id === 0) {
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
    // 1. 통계 데이터 (병렬 처리)
    const [fireRes, faultRes] = await Promise.all([
      supabase.from('fire_events').select('*', { count: 'exact', head: true }).eq('type', 'fire'), // type='fire'인 수
      supabase.from('fire_events').select('*', { count: 'exact', head: true }).eq('type', 'fault'), // type='fault'인 수
    ]);

    const fireCount = fireRes.count || 0;
    const faultCount = faultRes.count || 0;

    // 2. 로그 데이터 가져오기 (가상의 테이블 fire_events에서 최근 5개)
    const { data: logs } = await supabase
      .from('fire_events')
      .select('*')
      .order('time', { ascending: false })
      .limit(5);

    const fireLogs = (logs || []).filter(l => l.type === 'fire');
    const faultLogs = (logs || []).filter(l => l.type === 'fault');

    // 맵 포인트는 아직 DB에 없으므로 고정값 사용 (또는 DB화 가능)
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