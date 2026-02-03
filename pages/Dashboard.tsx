import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/CommonUI';
import { AlertTriangle, WifiOff, Map as MapIcon, BatteryWarning, ArrowRight, Search, ChevronLeft, ChevronRight, AlertCircle, Radio, RotateCcw } from 'lucide-react';
import { DashboardAPI } from '../services/api';
import { Market } from '../types';
import { VisualMapConsole } from '../components/VisualMapConsole';
import { SIDO_LIST, getSigungu } from '../utils/addressData';

declare global {
  interface Window {
    kakao: any;
  }
}

// --- Helper: Region Alias Mapping ---
// DB에는 '서울', '경기' 등으로 저장되어 있고, 필터는 '서울특별시', '경기도'인 경우를 매칭하기 위함
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

// --- Component: Map Container ---
const MapSection: React.FC<{ 
  markets: any[];
  focusLocation: { lat: number, lng: number } | null;
  onMarketSelect: (market: Market) => void;
  viewRegion: string; // [New Prop] 현재 선택된 행정구역 문자열
  selectedMarketId: number | null; // [New Prop] 선택된 마커 ID
}> = ({ markets, focusLocation, onMarketSelect, viewRegion, selectedMarketId }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isKakaoLoaded, setIsKakaoLoaded] = useState(false);
  const [overlays, setOverlays] = useState<any[]>([]);

  // 1. Wait for Kakao Script Load
  useEffect(() => {
    const checkKakao = setInterval(() => {
      if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
        setIsKakaoLoaded(true);
        clearInterval(checkKakao);
      }
    }, 500); // Check every 500ms
    return () => clearInterval(checkKakao);
  }, []);

  // 2. Initialize Map
  useEffect(() => {
    if (!isKakaoLoaded || !mapRef.current) return;

    if (!mapInstance) {
      const container = mapRef.current;
      const options = {
        center: new window.kakao.maps.LatLng(36.5, 127.5), // Center of Korea
        level: 12 // [MODIFIED] Default Zoom Level increased from 14 to 12 (Zoom In)
      };
      const map = new window.kakao.maps.Map(container, options);
      
      const zoomControl = new window.kakao.maps.ZoomControl();
      map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
      
      setMapInstance(map);
    }
  }, [isKakaoLoaded]);

  // 3. Update Markers
  useEffect(() => {
    if (!mapInstance || !markets) return;

    // Clear existing
    overlays.forEach(o => o.setMap(null));
    const newOverlays: any[] = [];

    markets.forEach((market) => {
        // Safe coordinate parsing
        const lat = parseFloat(market.x);
        const lng = parseFloat(market.y);

        if (isNaN(lat) || isNaN(lng)) return;

        const position = new window.kakao.maps.LatLng(lat, lng);
        const isSelected = market.id === selectedMarketId;
        
        // --- Icon Logic (Requested Shapes) ---
        let iconName = 'store'; // Normal: Store
        let isFire = false;

        // Check status (Handling both English and Korean)
        const status = market.status || 'Normal';
        if (status === 'Fire' || status === '화재') {
             iconName = 'local_fire_department'; // Fire: Flame
             isFire = true;
        } else if (status === 'Error' || status === '고장') {
             iconName = 'build'; // Error: Pliers/Tool
        }

        const content = document.createElement('div');
        // group class ensures children (tooltip) only show on hover of THIS container
        // Added logic: if selected, bring to front (z-50), otherwise normal z-10
        content.className = `relative flex items-center justify-center group cursor-pointer ${isSelected ? 'z-50' : 'z-10 hover:z-50'}`;
        content.onclick = () => onMarketSelect(market);
        
        // [MODIFIED] 
        // 1. Marker Size: w-10 (40px)
        // 2. Icon Size: text-lg
        // 3. Tooltip Visibility: 
        //    - Default: opacity-0 invisible
        //    - Hover: group-hover:opacity-100 group-hover:visible
        //    - Selected: Always opacity-100 visible
        
        const tooltipVisibilityClass = isSelected 
            ? "opacity-100 visible" 
            : "opacity-0 invisible group-hover:opacity-100 group-hover:visible";

        content.innerHTML = `
            ${isFire ? `
                <div class="absolute -inset-6 bg-red-500 rounded-full animate-ping opacity-60"></div>
                <div class="absolute -inset-1 bg-red-600 rounded-full animate-pulse opacity-40"></div>
            ` : ''}
            <div class="relative z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-xl border-2 ${
                isFire ? 'bg-red-600 border-white' : 
                (status === 'Error' || status === '고장' ? 'bg-orange-500 border-white' : 'bg-white border-blue-500')
            } transition-transform group-hover:scale-110">
               <span class="material-icons ${isFire ? 'text-white' : (status === 'Error' || status === '고장' ? 'text-white' : 'text-blue-600')} text-lg">${iconName}</span>
            </div>
            <div class="absolute bottom-12 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800/95 border border-slate-600 rounded text-white text-[10px] ${tooltipVisibilityClass} transition-all duration-200 pointer-events-none shadow-lg z-20">
               <div class="font-bold text-center">${market.name}</div>
               <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800/95"></div>
            </div>
        `;

        const customOverlay = new window.kakao.maps.CustomOverlay({
            position: position,
            content: content,
            yAnchor: 0.5
        });

        customOverlay.setMap(mapInstance);
        newOverlays.push(customOverlay);
    });

    setOverlays(newOverlays);
  }, [mapInstance, markets, selectedMarketId]); // Added selectedMarketId dependency

  // 4. Handle View Region Change (Auto Zoom/Pan)
  useEffect(() => {
    if (!mapInstance || !window.kakao?.maps?.services) return;

    if (viewRegion) {
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.addressSearch(viewRegion, (result: any, status: any) => {
            if (status === window.kakao.maps.services.Status.OK) {
                const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
                // Determine zoom level: Sigungu (has space) -> 8, Sido -> 10
                const isSigun = viewRegion.indexOf(' ') > -1;
                const targetLevel = isSigun ? 8 : 10;
                
                // [MODIFIED] Use setCenter first to ensure correct positioning, then zoom
                mapInstance.setCenter(coords);
                mapInstance.setLevel(targetLevel, { animate: true });
            }
        });
    } else {
        // Reset to default (Korea center)
        const defaultCenter = new window.kakao.maps.LatLng(36.5, 127.5);
        mapInstance.setCenter(defaultCenter);
        mapInstance.setLevel(12, { animate: true });
    }
  }, [viewRegion, mapInstance]);

  // 5. Focus Location (Specific Market) overrides region view
  useEffect(() => {
    if (mapInstance && focusLocation) {
        const moveLatLon = new window.kakao.maps.LatLng(focusLocation.lat, focusLocation.lng);
        mapInstance.setCenter(moveLatLon);
        mapInstance.setLevel(4, { animate: true });
    }
  }, [focusLocation, mapInstance]);

  return (
      <div className="relative w-full h-full rounded-xl overflow-hidden shadow-inner bg-slate-900 group">
          {!isKakaoLoaded && (
             <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 z-10">
                <MapIcon className="animate-pulse mr-2" /> 지도 로딩 중...
             </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
      </div>
  );
};

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [focusLocation, setFocusLocation] = useState<{lat: number, lng: number} | null>(null);
  
  // Timer State
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeLeft, setTimeLeft] = useState(60);

  // Auto Open Logic Ref
  const initialCheckDone = useRef(false);

  // Pagination States
  const [firePage, setFirePage] = useState(1);
  const [faultPage, setFaultPage] = useState(1);
  const [commPage, setCommPage] = useState(1);
  const ITEMS_LIMIT = 4;

  // [New] Map Filter States
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

      // [MODIFIED] 최초 데이터 로드 시 화재 발생 건이 있다면 자동으로 관제 화면 오픈 (3초 지연)
      if (!initialCheckDone.current && result.fireEvents && result.fireEvents.length > 0) {
          const latestFire = result.fireEvents[0]; // 가장 최근 화재
          if (latestFire && result.mapData) {
              const targetMarket = result.mapData.find((m: any) => m.id === latestFire.marketId);
              if (targetMarket) {
                  // 3초 뒤에 모달 오픈
                  setTimeout(() => {
                      setSelectedMarket(targetMarket);
                  }, 3000);
              }
          }
          initialCheckDone.current = true;
      }

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

  // Update Sigungu list when Sido changes
  useEffect(() => {
      if (mapSido) {
          setMapSigunguList(getSigungu(mapSido));
          setMapSigun(''); // Reset sigungu when sido changes
          // Focus location is handled by MapSection via viewRegion
          setFocusLocation(null); // Release specific market focus
      } else {
          setMapSigunguList([]);
          setMapSigun('');
          setFocusLocation(null);
      }
  }, [mapSido]);

  useEffect(() => {
      // When Sigun changes, also release focus
      setFocusLocation(null);
  }, [mapSigun]);

  const handleLogClick = (marketId: number) => {
      if (!data || !data.mapData) return;
      const targetMarket = data.mapData.find((m: any) => m.id === marketId);
      if (targetMarket) {
          setSelectedMarket(targetMarket);
          // Log click should also focus the map
          if (targetMarket.x && targetMarket.y) {
              setFocusLocation({ lat: parseFloat(targetMarket.x), lng: parseFloat(targetMarket.y) });
          }
      }
  };

  const handleMapMarketSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const marketId = Number(e.target.value);
      if (marketId && data?.mapData) {
          const m = data.mapData.find((item: any) => item.id === marketId);
          if (m) {
              setSelectedMarket(m);
              // Focus map on select
              if (m.x && m.y) {
                  setFocusLocation({ lat: parseFloat(m.x), lng: parseFloat(m.y) });
              }
          }
      }
  };

  // Reset Filter Function
  const handleResetMapFilter = () => {
      setMapSido('');
      setMapSigun('');
      setMapKeyword('');
      setMapSigunguList([]);
      setFocusLocation(null); // Reset focus
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

  // [Step 1] 실시간 상태 동기화: 이벤트 데이터를 기반으로 현장 상태(Status) 계산
  // DB에 저장된 status보다 현재 발생한 이벤트(화재, 고장)가 우선하여 지도에 표시됩니다.
  const activeFireMarketIds = new Set(fireEvents.map((e: any) => e.marketId));
  const activeFaultMarketIds = new Set([
      ...faultEvents.map((e: any) => e.marketId),
      ...commEvents.map((e: any) => e.marketId)
  ]);

  const processedMapData = (mapData || []).map((m: any) => {
      let dynamicStatus = m.status || 'Normal'; // 기본 DB 상태

      // 우선순위: 화재 > 고장 > 정상
      if (activeFireMarketIds.has(m.id)) {
          dynamicStatus = 'Fire'; 
      } else if (activeFaultMarketIds.has(m.id)) {
          // 이미 화재가 아닌 경우에만 고장 처리
          dynamicStatus = 'Error';
      }
      
      return { ...m, status: dynamicStatus };
  });

  // [Step 2] 필터링 로직: 계산된 processedMapData를 기준으로 주소 및 검색어 필터링
  const filteredMapData = processedMapData.filter((m: any) => {
      const addr = m.address || '';
      // 주소 데이터가 비어있을 경우를 대비해 안전하게 처리
      
      // [Modified] Sido Alias Matching (e.g. 서울특별시 <-> 서울)
      const sidoAliases = mapSido ? getSidoAliases(mapSido) : [];
      const matchSido = mapSido ? sidoAliases.some(alias => addr.includes(alias)) : true;

      const matchSigun = mapSigun ? addr.includes(mapSigun) : true;
      const matchName = mapKeyword ? m.name.includes(mapKeyword) : true;
      
      return matchSido && matchSigun && matchName;
  });

  const isFilterActive = !!(mapSido || mapSigun || mapKeyword);

  // Construct View Region String for MapSection
  const viewRegionString = `${mapSido} ${mapSigun}`.trim();

  // Header Right Content (Timer Only)
  const refreshControlUI = (
    <div className="flex items-center gap-3">
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
      <PageHeader title="대시보드" rightContent={refreshControlUI} />

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
                                   {log.marketName} <span className="text-slate-400 font-normal">{log.device} 고장</span>
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
                                   {log.marketName} <span className="text-slate-400 font-normal">({log.marketName})</span>
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

        {/* [Right Panel] 50% Width Map Area */}
        <div className="w-full lg:flex-1 flex flex-col h-full rounded-xl overflow-hidden border border-slate-700 bg-[#1a1a1a] relative">
           
           {/* Top Filter Overlay (Floating) */}
           <div className="absolute top-4 left-4 right-4 z-20 flex justify-center pointer-events-none">
               <div className="flex gap-2 bg-slate-800/90 p-2 rounded-md border border-slate-600 shadow-xl items-center pointer-events-auto">
                   <select 
                       value={mapSido} 
                       onChange={(e) => setMapSido(e.target.value)} 
                       className="bg-slate-700 text-white text-xs border border-slate-600 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 min-w-[110px]"
                   >
                       <option value="">시/도 선택</option>
                       {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                   <select 
                       value={mapSigun} 
                       onChange={(e) => setMapSigun(e.target.value)} 
                       className="bg-slate-700 text-white text-xs border border-slate-600 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 min-w-[110px]"
                   >
                       <option value="">시/군/구 선택</option>
                       {mapSigunguList.map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                   <select 
                       onChange={handleMapMarketSelect}
                       className="bg-slate-700 text-white text-xs border border-slate-600 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 min-w-[150px] max-w-[200px]"
                       value=""
                   >
                       <option value="">현장 목록 ({filteredMapData.length})</option>
                       {filteredMapData.map((m: any) => (
                           <option key={m.id} value={m.id}>{m.name}</option>
                       ))}
                   </select>
                   <div className="relative">
                       <input 
                           type="text" 
                           placeholder="현장명 검색" 
                           value={mapKeyword}
                           onChange={(e) => setMapKeyword(e.target.value)}
                           className="bg-slate-700 text-white text-xs border border-slate-600 rounded pl-2 pr-7 py-1.5 focus:outline-none focus:border-blue-500 w-80"
                       />
                       <Search size={12} className="absolute right-2 top-2 text-slate-400" />
                   </div>
                   {isFilterActive && (
                        <button 
                            onClick={handleResetMapFilter} 
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-md border border-blue-500"
                        >
                            <RotateCcw size={14} />
                            전체보기
                        </button>
                   )}
               </div>
           </div>

           <MapSection 
              markets={filteredMapData}
              focusLocation={focusLocation}
              onMarketSelect={(m) => setSelectedMarket(m)}
              viewRegion={viewRegionString}
              selectedMarketId={selectedMarket?.id || null}
           />

           {/* Bottom Status Overlay (Floating) */}
           <div className="absolute bottom-8 left-4 z-20">
               <div className="bg-slate-800/90 text-white px-4 py-2 rounded-full border border-slate-600 shadow-xl flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                   <span className="text-sm font-bold tracking-wide">
                       실시간 관제 중 <span className="text-slate-400 font-normal text-xs ml-1">({filteredMapData.length}개 현장 연동)</span>
                   </span>
               </div>
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