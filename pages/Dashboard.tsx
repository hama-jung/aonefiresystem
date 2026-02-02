import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/CommonUI';
import { AlertTriangle, WifiOff, Video, Map as MapIcon, BatteryWarning, ArrowRight, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardAPI } from '../services/api';
import { Market } from '../types';
import { VisualMapConsole } from '../components/VisualMapConsole';
import { SIDO_LIST } from '../utils/addressData'; // Reuse SIDO list

declare global {
  interface Window {
    kakao: any;
  }
}

// --- Helper: Pagination Control for Lists ---
const ListPagination: React.FC<{ 
    total: number, 
    limit: number, 
    page: number, 
    setPage: (p: number) => void 
}> = ({ total, limit, page, setPage }) => {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return null;

    return (
        <div className="flex justify-center items-center gap-2 py-2 border-t border-slate-700/50">
            <button 
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-400"
            >
                <ChevronLeft size={14} />
            </button>
            <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-5 h-5 flex items-center justify-center text-[10px] rounded ${
                            page === p ? 'bg-blue-600 text-white font-bold' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                    >
                        {p}
                    </button>
                ))}
            </div>
            <button 
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-400"
            >
                <ChevronRight size={14} />
            </button>
        </div>
    );
};

// --- Component: Map Container with Filters ---
const MapSection: React.FC<{ 
  markets: any[];
  focusLocation: { lat: number, lng: number } | null;
  onMarketSelect: (market: Market) => void;
}> = ({ markets, focusLocation, onMarketSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [overlays, setOverlays] = useState<any[]>([]);
  
  // Filter States
  const [selectedSido, setSelectedSido] = useState('');
  const [selectedGugun, setSelectedGugun] = useState('');
  const [keyword, setKeyword] = useState('');

  // Filtered Markets
  const filteredMarkets = markets.filter(m => {
      const matchSido = selectedSido ? m.address.includes(selectedSido) : true;
      const matchGugun = selectedGugun ? m.address.includes(selectedGugun) : true;
      const matchName = keyword ? m.name.includes(keyword) : true;
      return matchSido && matchGugun && matchName;
  });

  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current || !window.kakao) return;

    const container = mapRef.current;
    const options = {
      center: new window.kakao.maps.LatLng(36.5, 127.8),
      level: 12
    };
    const map = new window.kakao.maps.Map(container, options);
    setMapInstance(map);

    const zoomControl = new window.kakao.maps.ZoomControl();
    map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
  }, []);

  // 2. Render Markers
  useEffect(() => {
    if (!mapInstance) return;

    // Clear existing
    overlays.forEach(o => o.setMap(null));
    const newOverlays: any[] = [];

    filteredMarkets.forEach((market) => {
        if (!market.x || !market.y) return;

        const position = new window.kakao.maps.LatLng(market.x, market.y);
        
        let iconName = 'check_circle';
        let bgColor = 'bg-blue-500'; // Normal color
        let borderColor = 'border-blue-300';
        let isFire = false;

        if (market.status === 'Fire' || market.status === '화재') {
             iconName = 'local_fire_department';
             bgColor = 'bg-red-600';
             borderColor = 'border-red-400';
             isFire = true;
        } else if (market.status === 'Error' || market.status === '고장') {
             iconName = 'error_outline';
             bgColor = 'bg-orange-500';
             borderColor = 'border-orange-300';
        } else {
             // Normal status
             bgColor = 'bg-white';
             borderColor = 'border-slate-300';
        }

        const content = document.createElement('div');
        content.className = 'relative flex items-center justify-center group cursor-pointer';
        content.onclick = () => onMarketSelect(market);
        
        // Google Icon Marker Style
        content.innerHTML = `
            ${isFire ? '<div class="absolute w-16 h-16 bg-red-500 rounded-full animate-ping opacity-60"></div>' : ''}
            <div class="relative z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-xl border-2 ${isFire ? 'bg-red-600 border-white' : (market.status === 'Error' ? 'bg-orange-500 border-white' : 'bg-white border-blue-500')} transition-transform group-hover:scale-110">
               <span class="material-icons ${isFire ? 'text-white animate-pulse' : (market.status === 'Error' ? 'text-white' : 'text-blue-600')} text-2xl">${iconName}</span>
            </div>
            <!-- Tooltip -->
            <div class="absolute bottom-12 left-1/2 -translate-x-1/2 w-max px-3 py-1.5 bg-slate-800/95 border border-slate-600 rounded text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg pointer-events-none">
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
  }, [mapInstance, filteredMarkets]); // Re-render when filtered list changes

  // 3. Focus Logic
  useEffect(() => {
    if (mapInstance && focusLocation) {
        const moveLatLon = new window.kakao.maps.LatLng(focusLocation.lat, focusLocation.lng);
        mapInstance.setLevel(4);
        mapInstance.panTo(moveLatLon);
    }
  }, [focusLocation, mapInstance]);

  return (
      <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-700 shadow-inner bg-slate-900 group">
          {/* Map Overlay Controls */}
          <div className="absolute top-4 left-4 z-20 flex flex-col md:flex-row gap-2 bg-slate-900/80 p-2 rounded-lg backdrop-blur-sm border border-slate-700 shadow-lg">
              <select 
                value={selectedSido}
                onChange={(e) => setSelectedSido(e.target.value)}
                className="bg-slate-800 text-white text-sm border border-slate-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              >
                  <option value="">시/도 선택</option>
                  {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              
              <select 
                value={selectedGugun}
                onChange={(e) => setSelectedGugun(e.target.value)}
                className="bg-slate-800 text-white text-sm border border-slate-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              >
                  <option value="">시/군/구 선택</option>
                  {/* Mock data for example */}
                  <option value="강남구">강남구</option>
                  <option value="안양시">안양시</option>
              </select>

              <div className="relative">
                  <input 
                    type="text" 
                    placeholder="현장명 검색" 
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="bg-slate-800 text-white text-sm border border-slate-600 rounded pl-2 pr-8 py-1 focus:outline-none focus:border-blue-500 w-40"
                  />
                  <Search size={14} className="absolute right-2 top-2 text-slate-400" />
              </div>
          </div>

          <div ref={mapRef} className="w-full h-full" />
      </div>
  );
};

// --- Main Dashboard ---
export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [focusLocation, setFocusLocation] = useState<{lat: number, lng: number} | null>(null);
  
  // Refresh Timer State
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeLeft, setTimeLeft] = useState(60);

  // Pagination States for Lists
  const [firePage, setFirePage] = useState(1);
  const [faultPage, setFaultPage] = useState(1);
  const [commPage, setCommPage] = useState(1);
  const ITEMS_LIMIT = 4;

  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const result = await DashboardAPI.getData();
      setData(result);
      setLastUpdated(new Date()); // Update timestamp
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  // Timer Effect: Countdown and Auto-refresh every 60s
  useEffect(() => {
    fetchData(); // Initial load

    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchData(); // Refresh data
          return 60;   // Reset timer
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  const handleLogClick = (marketId: number) => {
      if (!data || !data.mapData) return;
      const target = data.mapData.find((m: any) => m.id === marketId);
      if (target && target.x && target.y) {
          setFocusLocation({ lat: target.x, lng: target.y });
      }
  };

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-500 font-bold animate-pulse">시스템 데이터 로딩 중...</div>
      </div>
    );
  }

  const { stats, fireEvents, faultEvents, commEvents, mapData } = data || { stats: [], fireEvents: [], faultEvents: [], commEvents: [], mapData: [] };

  // Paginated Data
  const currentFireEvents = fireEvents.slice((firePage - 1) * ITEMS_LIMIT, firePage * ITEMS_LIMIT);
  const currentFaultEvents = faultEvents.slice((faultPage - 1) * ITEMS_LIMIT, faultPage * ITEMS_LIMIT);
  const currentCommEvents = commEvents.slice((commPage - 1) * ITEMS_LIMIT, commPage * ITEMS_LIMIT);

  // --- Header Refresh Control UI ---
  const refreshControlUI = (
    <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-600 rounded-md px-4 py-1.5 text-xs shadow-lg">
      <span className="text-slate-400">
        기준 시각 : <span className="text-slate-200 font-bold ml-1 tracking-wide">{lastUpdated.toLocaleTimeString()}</span>
      </span>
      <div className="w-px h-3 bg-slate-600"></div>
      <span className="text-slate-400 flex items-center">
        <span className="text-blue-400 font-bold w-5 text-right mr-1">{timeLeft}</span>초 후 새로고침
      </span>
    </div>
  );

  return (
    <div className="flex flex-col h-full text-slate-200">
      <PageHeader title="대시보드" rightContent={refreshControlUI} />

      {/* Main Layout Grid */}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
        
        {/* [Left Panel] Stats & Logs (Width fixed or proportional) */}
        <div className="lg:w-[450px] xl:w-[500px] flex-shrink-0 flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar pr-1">
          
          {/* 1. Status Cards (3 Columns) */}
          <div className="grid grid-cols-3 gap-3">
             {/* Fire Status */}
             <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-lg p-4 shadow-lg border border-red-500/50 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-red-500/30 group-hover:text-red-500/40 transition-colors">
                   <AlertTriangle size={64} />
                </div>
                <div className="text-red-100 text-xs font-bold mb-1 z-10 flex items-center gap-1">
                   <AlertTriangle size={12}/> 화재발생
                </div>
                <div className="text-3xl font-black text-white z-10">{stats[0]?.value || 0}</div>
             </div>

             {/* Fault Status */}
             <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-lg p-4 shadow-lg border border-orange-400/50 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-orange-400/30 group-hover:text-orange-400/40 transition-colors">
                   <BatteryWarning size={64} />
                </div>
                <div className="text-orange-100 text-xs font-bold mb-1 z-10 flex items-center gap-1">
                   <BatteryWarning size={12}/> 고장발생
                </div>
                <div className="text-3xl font-black text-white z-10">{stats[1]?.value || 0}</div>
             </div>

             {/* Comm Status */}
             <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg p-4 shadow-lg border border-slate-500/50 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-slate-400/30 group-hover:text-slate-400/40 transition-colors">
                   <WifiOff size={64} />
                </div>
                <div className="text-slate-200 text-xs font-bold mb-1 z-10 flex items-center gap-1">
                   <WifiOff size={12}/> 통신이상
                </div>
                <div className="text-3xl font-black text-white z-10">{stats[2]?.value || 0}</div>
             </div>
          </div>

          {/* 2. Log Lists Area */}
          <div className="flex-1 flex flex-col gap-4">
             
             {/* Fire History List */}
             <div className="bg-slate-800 border border-red-900/50 rounded-lg shadow-sm flex flex-col min-h-[220px]">
                <div className="bg-red-950/50 px-4 py-3 border-b border-red-900/50 flex justify-between items-center">
                   <div className="flex items-center gap-2 text-red-200 font-bold text-sm">
                      <AlertTriangle size={16} className="text-red-500 animate-pulse" /> 최근 화재 발생현황
                   </div>
                   <button onClick={() => navigate('/fire-history')} className="text-xs text-red-400 hover:text-white flex items-center gap-1">
                      더보기 <ArrowRight size={12} />
                   </button>
                </div>
                <div className="flex-1 p-2 flex flex-col gap-2">
                   {currentFireEvents.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">내역이 없습니다.</div>
                   ) : (
                      currentFireEvents.map((log: any) => (
                         <div key={log.id} onClick={() => handleLogClick(log.marketId)} className="bg-slate-900/50 p-2 rounded border border-slate-700 hover:border-red-500/50 cursor-pointer transition-colors flex justify-between items-center group">
                            <div className="flex items-center gap-2 overflow-hidden">
                               <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0"></span>
                               <span className="text-xs text-slate-300 group-hover:text-white truncate">{log.msg}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 flex-shrink-0">{new Date(log.time).toLocaleTimeString()}</span>
                         </div>
                      ))
                   )}
                </div>
                <ListPagination total={fireEvents.length} limit={ITEMS_LIMIT} page={firePage} setPage={setFirePage} />
             </div>

             {/* Fault History List */}
             <div className="bg-slate-800 border border-orange-900/50 rounded-lg shadow-sm flex flex-col min-h-[220px]">
                <div className="bg-orange-950/50 px-4 py-3 border-b border-orange-900/50 flex justify-between items-center">
                   <div className="flex items-center gap-2 text-orange-200 font-bold text-sm">
                      <BatteryWarning size={16} className="text-orange-500" /> 최근 고장 발생현황
                   </div>
                   <button onClick={() => navigate('/device-status')} className="text-xs text-orange-400 hover:text-white flex items-center gap-1">
                      더보기 <ArrowRight size={12} />
                   </button>
                </div>
                <div className="flex-1 p-2 flex flex-col gap-2">
                   {currentFaultEvents.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">내역이 없습니다.</div>
                   ) : (
                      currentFaultEvents.map((log: any) => (
                         <div key={log.id} onClick={() => handleLogClick(log.marketId)} className="bg-slate-900/50 p-2 rounded border border-slate-700 hover:border-orange-500/50 cursor-pointer transition-colors flex justify-between items-center group">
                            <div className="flex items-center gap-2 overflow-hidden">
                               <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0"></span>
                               <span className="text-xs text-slate-300 group-hover:text-white truncate">{log.msg}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 flex-shrink-0">{new Date(log.time).toLocaleTimeString()}</span>
                         </div>
                      ))
                   )}
                </div>
                <ListPagination total={faultEvents.length} limit={ITEMS_LIMIT} page={faultPage} setPage={setFaultPage} />
             </div>

             {/* Comm Error List */}
             <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-sm flex flex-col min-h-[220px]">
                <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-600 flex justify-between items-center">
                   <div className="flex items-center gap-2 text-slate-300 font-bold text-sm">
                      <WifiOff size={16} className="text-slate-400" /> 수신기 통신 이상 내역
                   </div>
                </div>
                <div className="flex-1 p-2 flex flex-col gap-2">
                   {currentCommEvents.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">내역이 없습니다.</div>
                   ) : (
                      currentCommEvents.map((log: any) => (
                         <div key={log.id} className="bg-slate-900/50 p-2 rounded border border-slate-700 flex justify-between items-center">
                            <span className="text-xs text-slate-400">{log.msg}</span>
                            <span className="text-[10px] text-slate-600">{new Date(log.time).toLocaleTimeString()}</span>
                         </div>
                      ))
                   )}
                </div>
                <ListPagination total={commEvents.length} limit={ITEMS_LIMIT} page={commPage} setPage={setCommPage} />
             </div>

          </div>
        </div>

        {/* [Right Panel] Map Area (Flexible Width) */}
        <div className="flex-1 flex flex-col h-full min-h-[500px]">
           <MapSection 
              markets={mapData}
              focusLocation={focusLocation}
              onMarketSelect={(m) => setSelectedMarket(m)}
           />
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