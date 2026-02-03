import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/CommonUI';
import { AlertTriangle, WifiOff, BatteryWarning, ArrowRight, Search, ChevronLeft, ChevronRight, AlertCircle, RotateCcw, Map as MapIcon } from 'lucide-react';
import { DashboardAPI } from '../services/api';
import { Market } from '../types';
import { VisualMapConsole } from '../components/VisualMapConsole';
import { SIDO_LIST, getSigungu } from '../utils/addressData';

// --- Helper: Region Alias Mapping ---
const getSidoAliases = (sido: string): string[] => {
  const map: Record<string, string[]> = {
    "서울특별시": ["서울", "서울특별시"],
    "부산광역시": ["부산", "부산광역시"],
    "대구광역시": ["대구", "대구광역시"],
    "인천광역시": ["인천", "인천광역시"],
    "광주광역시": ["광주", "광주광역시"],
    "대전광역시": ["대전", "대전광역시"],
    "울산광역시": ["울산", "울산광역시"],
    "세종특별자치시": ["세종", "세종시", "세종특별자치시"],
    "경기도": ["경기", "경기도"],
    "강원특별자치도": ["강원", "강원도", "강원특별자치도"],
    "충청북도": ["충북", "충청북도"],
    "충청남도": ["충남", "충청남도"],
    "전북특별자치도": ["전북", "전라북도", "전북특별자치도"],
    "전라남도": ["전남", "전라남도"],
    "경상북도": ["경북", "경상북도"],
    "경상남도": ["경남", "경상남도"],
    "제주특별자치도": ["제주", "제주도", "제주특별자치도"]
  };
  return map[sido] || [sido];
};

// --- Helper: Pagination Control ---
const ListPagination: React.FC<{ 
    total: number, 
    limit: number, 
    page: number, 
    setPage: (p: number) => void 
}> = ({ total, limit, page, setPage }) => {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return null;

    return (
        <div className="flex justify-center items-center gap-1.5 py-2 mt-auto border-t border-slate-700/50">
            <button 
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 text-slate-400"
            >
                <ChevronLeft size={14} />
            </button>
            <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-6 h-6 flex items-center justify-center text-xs rounded border ${
                            page === p 
                            ? 'bg-blue-600 border-blue-500 text-white font-bold' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        {p}
                    </button>
                ))}
            </div>
            <button 
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 text-slate-400"
            >
                <ChevronRight size={14} />
            </button>
        </div>
    );
};

export const Dashboard2: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  
  // Timer State
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeLeft, setTimeLeft] = useState(60);

  // Auto Open Control States
  const [isAutoMovePaused, setIsAutoMovePaused] = useState(false);
  const [hasAutoMoved, setHasAutoMoved] = useState(false);

  // Pagination States (Left Panel)
  const [firePage, setFirePage] = useState(1);
  const [faultPage, setFaultPage] = useState(1);
  const [commPage, setCommPage] = useState(1);
  const ITEMS_LIMIT = 4;

  // Map/List Filter States (Right Panel)
  const [mapSido, setMapSido] = useState('');
  const [mapSigun, setMapSigun] = useState('');
  const [mapKeyword, setMapKeyword] = useState('');
  const [mapSigunguList, setMapSigunguList] = useState<string[]>([]);

  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const result = await DashboardAPI.getData();
      setData(result);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchData();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  // Auto Navigation Effect
  useEffect(() => {
      let autoMoveTimer: NodeJS.Timeout;

      if (data?.fireEvents && data.fireEvents.length > 0 && !isAutoMovePaused && !hasAutoMoved) {
          autoMoveTimer = setTimeout(() => {
              const latestFire = data.fireEvents[0];
              if (latestFire && data.mapData) {
                  const targetMarket = data.mapData.find((m: any) => m.id === latestFire.marketId);
                  if (targetMarket) {
                      setSelectedMarket(targetMarket);
                      setHasAutoMoved(true);
                  }
              }
          }, 3000);
      }

      return () => {
          if (autoMoveTimer) clearTimeout(autoMoveTimer);
      };
  }, [data, isAutoMovePaused, hasAutoMoved]);

  // Update Sigungu list when Sido changes
  useEffect(() => {
      if (mapSido) {
          setMapSigunguList(getSigungu(mapSido));
          setMapSigun('');
      } else {
          setMapSigunguList([]);
          setMapSigun('');
      }
  }, [mapSido]);

  const handleLogClick = (marketId: number) => {
      if (!data || !data.mapData) return;
      const targetMarket = data.mapData.find((m: any) => m.id === marketId);
      if (targetMarket) {
          setSelectedMarket(targetMarket);
      }
  };

  // Reset Filter Function
  const handleResetMapFilter = () => {
      setMapSido('');
      setMapSigun('');
      setMapKeyword('');
      setMapSigunguList([]);
  };

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-500 font-bold animate-pulse">시스템 데이터 로딩 중...</div>
      </div>
    );
  }

  const { stats, fireEvents, faultEvents, commEvents, mapData } = data || { stats: [], fireEvents: [], faultEvents: [], commEvents: [], mapData: [] };

  const currentFireEvents = fireEvents.slice((firePage - 1) * ITEMS_LIMIT, firePage * ITEMS_LIMIT);
  const currentFaultEvents = faultEvents.slice((faultPage - 1) * ITEMS_LIMIT, faultPage * ITEMS_LIMIT);
  const currentCommEvents = commEvents.slice((commPage - 1) * ITEMS_LIMIT, commPage * ITEMS_LIMIT);

  // [Step 1] 실시간 상태 동기화
  const activeFireMarketIds = new Set(fireEvents.map((e: any) => e.marketId));
  const activeFaultMarketIds = new Set([
      ...faultEvents.map((e: any) => e.marketId),
      ...commEvents.map((e: any) => e.marketId)
  ]);

  const processedMapData = (mapData || []).map((m: any) => {
      let dynamicStatus = m.status || 'Normal'; 
      if (activeFireMarketIds.has(m.id)) {
          dynamicStatus = 'Fire'; 
      } else if (activeFaultMarketIds.has(m.id)) {
          dynamicStatus = 'Error';
      }
      return { ...m, status: dynamicStatus };
  });

  // [Step 2] 필터링 로직
  const filteredMapData = processedMapData.filter((m: any) => {
      const addr = m.address || '';
      const sidoAliases = mapSido ? getSidoAliases(mapSido) : [];
      const matchSido = mapSido ? sidoAliases.some(alias => addr.includes(alias)) : true;
      const matchSigun = mapSigun ? addr.includes(mapSigun) : true;
      const matchName = mapKeyword ? m.name.includes(mapKeyword) : true;
      return matchSido && matchSigun && matchName;
  });

  const isFilterActive = !!(mapSido || mapSigun || mapKeyword);

  // Header Right Content
  const refreshControlUI = (
    <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 mr-2">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                <input 
                    type="checkbox" 
                    checked={isAutoMovePaused} 
                    onChange={(e) => setIsAutoMovePaused(e.target.checked)} 
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                />
                <span className="text-xs font-bold">화재 자동 이동 중지</span>
            </label>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-600 rounded-md px-4 py-1.5 text-xs shadow-lg">
            <span className="text-slate-400">
                기준 시각 : <span className="text-slate-200 font-bold ml-1 tracking-wide">{lastUpdated.toLocaleTimeString()}</span>
            </span>
            <div className="w-px h-3 bg-slate-600"></div>
            <span className="text-slate-400 flex items-center">
                <span className="text-blue-400 font-bold w-5 text-right mr-1">{timeLeft}</span>초 후 새로고침
            </span>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full text-slate-200">
      <PageHeader title="대시보드2" rightContent={refreshControlUI} />

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] min-h-[600px]">
        
        {/* [Left Panel] 50% Width (1:1 Ratio) */}
        <div className="w-full lg:flex-1 flex flex-col gap-4 h-full overflow-hidden">
          
          {/* 1. Status Cards */}
          <div className="grid grid-cols-3 gap-3 flex-shrink-0">
             {/* Fire */}
             <div className="bg-[#D32F2F] rounded-lg p-4 shadow-lg flex items-center justify-between group h-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <AlertTriangle size={20} className="text-white" />
                    </div>
                    <div className="text-white font-bold text-sm leading-tight">화재발생</div>
                </div>
                <div className="text-4xl font-black text-white">{stats[0]?.value || 0}</div>
             </div>

             {/* Fault */}
             <div className="bg-[#F57C00] rounded-lg p-4 shadow-lg flex items-center justify-between group h-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <AlertCircle size={20} className="text-white" />
                    </div>
                    <div className="text-white font-bold text-sm leading-tight">고장발생</div>
                </div>
                <div className="text-4xl font-black text-white">{stats[1]?.value || 0}</div>
             </div>

             {/* Comm */}
             <div className="bg-[#475569] rounded-lg p-4 shadow-lg flex items-center justify-between group h-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <WifiOff size={20} className="text-white" />
                    </div>
                    <div className="text-white font-bold text-sm leading-tight">통신 이상</div>
                </div>
                <div className="text-4xl font-black text-white">{stats[2]?.value || 0}</div>
             </div>
          </div>

          {/* 2. Log Lists */}
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1">
             
             {/* Fire History List */}
             <div className="bg-[#1e293b] border border-slate-700 rounded-lg shadow-sm flex flex-col shrink-0">
                <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                   <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                      <AlertTriangle size={16} /> 최근 화재 발생현황
                   </div>
                   <button onClick={() => navigate('/fire-history')} className="text-slate-500 hover:text-white transition-colors">
                      <ArrowRight size={16} />
                   </button>
                </div>
                <div className="p-0 flex flex-col">
                   {currentFireEvents.length === 0 ? (
                      <div className="flex items-center justify-center text-slate-500 text-sm py-4">내역이 없습니다.</div>
                   ) : (
                      currentFireEvents.map((log: any) => (
                         <div key={log.id} onClick={() => handleLogClick(log.marketId)} className="px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer flex justify-between items-center last:border-0">
                            <div className="flex items-center gap-3 overflow-hidden">
                               <span className="bg-[#D32F2F] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0 animate-pulse">화재</span>
                               <span className="text-sm text-slate-200 font-medium truncate">
                                   {log.marketName} <span className="text-slate-400 font-normal">{log.detail}</span>
                               </span>
                            </div>
                            <span className="text-xs text-slate-500 flex-shrink-0">
                                {new Date(log.time).toISOString().replace('T', ' ').substring(0, 19)}
                            </span>
                         </div>
                      ))
                   )}
                </div>
                <ListPagination total={fireEvents.length} limit={ITEMS_LIMIT} page={firePage} setPage={setFirePage} />
             </div>

             {/* Fault History List */}
             <div className="bg-[#1e293b] border border-slate-700 rounded-lg shadow-sm flex flex-col shrink-0">
                <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                   <div className="flex items-center gap-2 text-orange-400 font-bold text-sm">
                      <AlertCircle size={16} /> 최근 고장 발생현황
                   </div>
                   <button onClick={() => navigate('/device-status')} className="text-slate-500 hover:text-white transition-colors">
                      <ArrowRight size={16} />
                   </button>
                </div>
                <div className="p-0 flex flex-col">
                   {currentFaultEvents.length === 0 ? (
                      <div className="flex items-center justify-center text-slate-500 text-sm py-4">내역이 없습니다.</div>
                   ) : (
                      currentFaultEvents.map((log: any) => (
                         <div key={log.id} onClick={() => handleLogClick(log.marketId)} className="px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer flex justify-between items-center last:border-0">
                            <div className="flex items-center gap-3 overflow-hidden">
                               <span className="bg-[#F57C00] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0">고장</span>
                               <span className="text-sm text-slate-200 font-medium truncate">
                                   {log.marketName} <span className="text-slate-400 font-normal">{log.deviceType} {log.deviceId}번 {log.errorName}</span>
                               </span>
                            </div>
                            <span className="text-xs text-slate-500 flex-shrink-0">
                                {new Date(log.time).toISOString().replace('T', ' ').substring(0, 19)}
                            </span>
                         </div>
                      ))
                   )}
                </div>
                <ListPagination total={faultEvents.length} limit={ITEMS_LIMIT} page={faultPage} setPage={setFaultPage} />
             </div>

             {/* Comm Error List */}
             <div className="bg-[#1e293b] border border-slate-700 rounded-lg shadow-sm flex flex-col shrink-0">
                <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                   <div className="flex items-center gap-2 text-slate-300 font-bold text-sm">
                      <WifiOff size={16} /> 수신기 통신 이상 내역
                   </div>
                   <button onClick={() => navigate('/device-status')} className="text-slate-500 hover:text-white transition-colors">
                      <ArrowRight size={16} />
                   </button>
                </div>
                <div className="p-0 flex flex-col">
                   {currentCommEvents.length === 0 ? (
                      <div className="flex items-center justify-center text-slate-500 text-sm py-4">내역이 없습니다.</div>
                   ) : (
                      currentCommEvents.map((log: any) => (
                         <div key={log.id} onClick={() => handleLogClick(log.marketId)} className="px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer flex justify-between items-center last:border-0">
                            <div className="flex items-center gap-3 overflow-hidden">
                               <span className="text-sm text-slate-200 font-bold truncate">
                                   {log.marketName} <span className="text-slate-400 font-normal">({log.receiverMac})</span>
                               </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] bg-amber-900/30 text-amber-500 border border-amber-800/50 px-1 rounded">R:{log.receiverMac}</span>
                                <span className="text-xs text-slate-500 flex-shrink-0">
                                    {new Date(log.time).toISOString().replace('T', ' ').substring(0, 19)}
                                </span>
                            </div>
                         </div>
                      ))
                   )}
                </div>
                <ListPagination total={commEvents.length} limit={ITEMS_LIMIT} page={commPage} setPage={setCommPage} />
             </div>

          </div>
        </div>

        {/* [Right Panel] 50% Width - List Area (Replaced Map) */}
        <div className="w-full lg:flex-1 flex flex-col h-full rounded-xl overflow-hidden border border-slate-700 bg-[#1a1a1a] relative">
           
           {/* Top Filter Bar (Fixed) */}
           <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex gap-2 items-center flex-wrap">
               <select 
                   value={mapSido} 
                   onChange={(e) => setMapSido(e.target.value)} 
                   className="bg-slate-700 text-white text-sm border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500 min-w-[120px]"
               >
                   <option value="">시/도 선택</option>
                   {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
               <select 
                   value={mapSigun} 
                   onChange={(e) => setMapSigun(e.target.value)} 
                   className="bg-slate-700 text-white text-sm border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500 min-w-[120px]"
               >
                   <option value="">시/군/구 선택</option>
                   {mapSigunguList.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
               <div className="relative flex-1 min-w-[200px]">
                   <input 
                       type="text" 
                       placeholder="현장명 검색" 
                       value={mapKeyword}
                       onChange={(e) => setMapKeyword(e.target.value)}
                       className="bg-slate-700 text-white text-sm border border-slate-600 rounded pl-3 pr-8 py-2 focus:outline-none focus:border-blue-500 w-full"
                   />
                   <Search size={16} className="absolute right-2.5 top-2.5 text-slate-400" />
               </div>
               {isFilterActive && (
                    <button 
                        onClick={handleResetMapFilter} 
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                        <RotateCcw size={16} />
                        초기화
                    </button>
               )}
           </div>

           {/* Market List */}
           <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
               <table className="min-w-full divide-y divide-slate-700/50">
                   <thead className="bg-slate-800 sticky top-0 z-10">
                       <tr>
                           <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 w-16">No</th>
                           <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">현장명</th>
                           <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">주소</th>
                           <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 w-24">상태</th>
                           <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 w-24">관리</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-700/30">
                       {filteredMapData.length === 0 ? (
                           <tr>
                               <td colSpan={5} className="px-4 py-10 text-center text-slate-500 text-sm">
                                   검색된 현장이 없습니다.
                               </td>
                           </tr>
                       ) : (
                           filteredMapData.map((market: any, index: number) => {
                               const isFire = market.status === 'Fire' || market.status === '화재';
                               const isError = market.status === 'Error' || market.status === '고장' || market.status === '에러';
                               
                               return (
                                   <tr key={market.id} className="hover:bg-slate-800/50 transition-colors group">
                                       <td className="px-4 py-3 text-center text-slate-500 text-sm">{index + 1}</td>
                                       <td className="px-4 py-3 text-slate-200 text-sm font-bold">
                                           {market.name}
                                       </td>
                                       <td className="px-4 py-3 text-slate-400 text-sm">
                                           {market.address}
                                       </td>
                                       <td className="px-4 py-3 text-center">
                                           {isFire ? (
                                               <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-red-900/50 text-red-400 border border-red-800 animate-pulse">화재</span>
                                           ) : isError ? (
                                               <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-orange-900/50 text-orange-400 border border-orange-800">고장</span>
                                           ) : (
                                               <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-green-900/50 text-green-400 border border-green-800">정상</span>
                                           )}
                                       </td>
                                       <td className="px-4 py-3 text-center">
                                           <button 
                                               onClick={() => setSelectedMarket(market)}
                                               className="text-xs bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white px-2 py-1 rounded transition-colors border border-slate-600"
                                           >
                                               <MapIcon size={14} className="inline mr-1" />
                                               관제
                                           </button>
                                       </td>
                                   </tr>
                               );
                           })
                       )}
                   </tbody>
               </table>
           </div>

           {/* Bottom Status Bar */}
           <div className="p-3 border-t border-slate-700 bg-slate-800/80 flex justify-between items-center text-xs text-slate-400">
               <span>총 <strong>{filteredMapData.length}</strong>개 현장</span>
               <span>* 목록을 클릭하여 상세 관제를 할 수 있습니다.</span>
           </div>
        </div>

      </div>

      {/* Visual Map Console Modal */}
      {selectedMarket && (
          <VisualMapConsole 
             market={selectedMarket} 
             initialMode="monitoring" 
             onClose={() => setSelectedMarket(null)} 
          />
      )}
    </div>
  );
};