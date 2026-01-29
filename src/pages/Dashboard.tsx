import React, { useState, useEffect, useRef } from 'react';
import { PageHeader, Pagination, Button } from '../components/CommonUI';
import { AlertTriangle, WifiOff, ArrowRight, BatteryWarning, MapPin, Search, RefreshCw, X, RotateCcw, Map as MapIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SIDO_LIST, getSigungu } from '../utils/addressData';
import { MarketAPI, DashboardAPI } from '../services/api'; 
import { Market } from '../types';
import { VisualMapConsole } from '../components/VisualMapConsole';

declare global {
  interface Window {
    kakao: any;
  }
}

const ITEMS_PER_LIST_PAGE = 4;

// --- Helper: Date Formatter ---
const formatDateTime = (isoString: string) => {
  if (!isoString) return { date: '-', time: '-' };
  const dateObj = new Date(isoString);
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const date = `${yyyy}-${mm}-${dd}`;
  const time = dateObj.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { date, time };
};

// --- Sub Component: Dashboard List Section ---
const DashboardListSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  headerColorClass: string;
  data: any[];
  renderItem: (item: any) => React.ReactNode;
  linkTo: string;
  onItemClick?: (item: any) => void;
}> = ({ title, icon, headerColorClass, data, renderItem, linkTo, onItemClick }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  
  const currentItems = data.slice((page - 1) * ITEMS_PER_LIST_PAGE, page * ITEMS_PER_LIST_PAGE);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-sm overflow-hidden flex flex-col transition-all duration-300 flex-shrink-0">
      <div className={`px-4 py-3 border-b border-slate-700/50 flex items-center justify-between ${headerColorClass}`}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>
        <button 
          onClick={() => navigate(linkTo)}
          className="text-white/70 hover:text-white hover:bg-white/10 p-1 rounded transition-colors group"
          title="자세히 보기"
        >
          <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
      
      <div className="p-2 space-y-1">
        {currentItems.map((item) => (
           <div 
             key={item.id} 
             onClick={() => onItemClick && onItemClick(item)}
             className={`border-b border-slate-700/50 last:border-0 pb-1 mb-1 last:mb-0 last:pb-0 ${onItemClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
           >
             {renderItem(item)}
           </div>
        ))}
        {currentItems.length === 0 && (
            <div className="py-8 flex items-center justify-center text-slate-500 text-xs">
                데이터가 없습니다.
            </div>
        )}
      </div>

      {data.length > ITEMS_PER_LIST_PAGE && (
        <div className="py-2 border-t border-slate-700 bg-slate-800/50 min-h-[40px] flex items-center justify-center">
             <Pagination 
                totalItems={data.length} 
                itemsPerPage={ITEMS_PER_LIST_PAGE} 
                currentPage={page} 
                onPageChange={setPage} 
             />
        </div>
      )}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  // --- Mobile Map State ---
  const [showMobileMap, setShowMobileMap] = useState(false);

  // --- Visual Console State ---
  const [selectedMapMarket, setSelectedMapMarket] = useState<Market | null>(null); 

  // --- Timer State ---
  const [now, setNow] = useState(new Date());
  const [secondsLeft, setSecondsLeft] = useState(60);
  
  // --- Data State ---
  const [fireData, setFireData] = useState<any[]>([]);
  const [faultData, setFaultData] = useState<any[]>([]);
  const [commErrorData, setCommErrorData] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([
    { label: '화재발생', value: 0, color: 'bg-red-600', icon: <AlertTriangle size={20} /> },
    { label: '고장발생', value: 0, color: 'bg-orange-500', icon: <BatteryWarning size={20} /> },
    { label: '통신 이상', value: 0, color: 'bg-slate-600', icon: <WifiOff size={20} /> },
  ]);
  const [markets, setMarkets] = useState<Market[]>([]);

  // --- Map State (Kakao) ---
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  // [수정] 마커 관리를 위해 useRef 사용 (Stale Closure 방지)
  const markersRef = useRef<any[]>([]);
  const [mapError, setMapError] = useState(false);

  const [selectedSido, setSelectedSido] = useState('');
  const [selectedSigungu, setSelectedSigungu] = useState('');
  const [searchMarketMap, setSearchMarketMap] = useState('');

  // 1. Timer Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setNow(new Date());
          return 60; 
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 2. Data Load (Real Data from DB)
  useEffect(() => {
    const loadData = async () => {
        try {
            const allMarkets = await MarketAPI.getList();
            const dashboardData: any = await DashboardAPI.getData();
            
            setFireData(dashboardData.fireEvents || []);
            setFaultData(dashboardData.faultEvents || []);
            setCommErrorData(dashboardData.commEvents || []);
            
            if (dashboardData.stats && dashboardData.stats.length === 3) {
                setStats([
                    { label: '화재발생', value: dashboardData.stats[0].value, color: 'bg-red-600', icon: <AlertTriangle size={20} /> },
                    { label: '고장발생', value: dashboardData.stats[1].value, color: 'bg-orange-500', icon: <BatteryWarning size={20} /> },
                    { label: '통신 이상', value: dashboardData.stats[2].value, color: 'bg-slate-600', icon: <WifiOff size={20} /> },
                ]);
            }

            const fireMarkets = new Set(dashboardData.fireEvents?.map((e: any) => e.marketName));
            const errorMarkets = new Set([
                ...(dashboardData.faultEvents?.map((e: any) => e.marketName) || []),
                ...(dashboardData.commEvents?.map((e: any) => e.market) || [])
            ]);

            const updatedMarkets = allMarkets.map(m => {
                let dynamicStatus: 'Normal' | 'Fire' | 'Error' = 'Normal';
                if (fireMarkets.has(m.name)) dynamicStatus = 'Fire';
                else if (errorMarkets.has(m.name)) dynamicStatus = 'Error';
                
                return { ...m, status: dynamicStatus };
            });

            setMarkets(updatedMarkets);

        } catch (e) {
            console.error("Dashboard data load failed", e);
        }
    };
    loadData();
  }, [now]);

  // 3. Map Initialization
  useEffect(() => {
    let intervalId: any;
    let timeoutId: any;

    const initMap = () => {
      if (!window.kakao || !window.kakao.maps) return false;
      if (mapInstance) return true;
      if (!mapContainer.current) return false;

      try {
        window.kakao.maps.load(() => {
            const options = {
                center: new window.kakao.maps.LatLng(36.3504119, 127.3845475), // 대전 시청 부근
                level: 12
            };
            const map = new window.kakao.maps.Map(mapContainer.current, options);
            const zoomControl = new window.kakao.maps.ZoomControl();
            map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
            setMapInstance(map);
            setMapError(false);
        });
        return true;
      } catch (e) {
        return false;
      }
    };

    if (!initMap()) {
      intervalId = setInterval(() => {
        if (initMap()) {
          clearInterval(intervalId);
          clearTimeout(timeoutId);
        }
      }, 500);

      timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        if (!mapInstance && !window.kakao?.maps) {
            setMapError(true);
        }
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Map Resize Observer
  useEffect(() => {
    if (!mapInstance || !mapContainer.current) return;
    const resizeObserver = new ResizeObserver(() => {
      mapInstance.relayout();
    });
    resizeObserver.observe(mapContainer.current);
    return () => resizeObserver.disconnect();
  }, [mapInstance]);

  // 4. Map Markers Update (Material Icon Style)
  useEffect(() => {
    if (mapInstance) {
        // [수정] 기존 마커 제거 시 markersRef 사용
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        const filteredMarkets = markets.filter(market => {
            if (selectedSido && !market.address.includes(selectedSido)) return false;
            if (selectedSigungu && !market.address.includes(selectedSigungu)) return false;
            return true;
        });

        const bounds = new window.kakao.maps.LatLngBounds();

        filteredMarkets.forEach((market) => {
            if (market.latitude && market.longitude) {
                const lat = parseFloat(market.latitude);
                const lng = parseFloat(market.longitude);
                const markerPosition = new window.kakao.maps.LatLng(lat, lng);

                bounds.extend(markerPosition);

                const isFire = market.status === 'Fire';
                const isError = market.status === 'Error';
                
                const iconName = isFire ? 'local_fire_department' : (isError ? 'warning_amber' : 'storefront');
                const bgColor = isFire ? 'bg-red-600' : (isError ? 'bg-orange-500' : 'bg-slate-600');
                const ringColor = isFire ? 'bg-red-500' : (isError ? 'bg-orange-400' : 'bg-slate-400');
                
                const content = document.createElement('div');
                content.innerHTML = `
                  <div class="relative flex flex-col items-center justify-center w-12 h-12 group cursor-pointer" title="${market.name} (클릭하여 관제화면 진입)">
                    ${(isFire || isError) ? `<div class="absolute inset-0 rounded-full ${ringColor} opacity-75 animate-ping"></div>` : ''}
                    <div class="relative z-10 w-10 h-10 rounded-full ${bgColor} border-2 border-white shadow-lg flex items-center justify-center text-white transition-transform transform group-hover:scale-110">
                        <span class="material-icons-round text-[22px] leading-none">${iconName}</span>
                    </div>
                    <div class="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 
                                bg-slate-900/90 backdrop-blur-md text-white text-xs px-3 py-2 rounded-lg 
                                border border-slate-600/50 shadow-2xl opacity-0 group-hover:opacity-100 
                                transition-all duration-300 translate-y-2 group-hover:translate-y-0
                                whitespace-nowrap pointer-events-none z-50 flex flex-col items-center min-w-[120px]">
                      <span class="font-bold text-[13px] tracking-wide">${market.name}</span>
                      <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800/90"></div>
                    </div>
                  </div>
                `;

                const customOverlay = new window.kakao.maps.CustomOverlay({
                    position: markerPosition,
                    content: content,
                    yAnchor: 0.5,
                    zIndex: isFire ? 100 : (isError ? 50 : 1)
                });

                content.onclick = () => {
                    setSelectedMapMarket(market);
                };

                customOverlay.setMap(mapInstance);
                markersRef.current.push(customOverlay);
            }
        });

        // [수정] 마커가 1개 이상이면 해당 영역으로 지도 이동
        if (markersRef.current.length > 0) {
            mapInstance.setBounds(bounds);
        } else if (selectedSido && !selectedSigungu) {
            // 마커는 없지만 시/도만 선택된 경우 해당 지역 센터로 이동 (예시 좌표 사용)
            // 실제 구현에서는 행정구역별 중심좌표 데이터가 필요함. 여기선 일단 유지.
        }
    }
  }, [mapInstance, markets, selectedSido, selectedSigungu]); 

  // --- Handlers ---
  const isSearchActive = selectedSido !== '' || selectedSigungu !== '' || searchMarketMap !== '';

  const handleResetMap = () => {
      setSelectedSido('');
      setSelectedSigungu('');
      setSearchMarketMap('');
      if (mapInstance) {
          const moveLatLon = new window.kakao.maps.LatLng(36.3504119, 127.3845475);
          mapInstance.setLevel(12);
          mapInstance.panTo(moveLatLon);
      }
  };

  const handlePanToMarket = (keyword: string) => {
      if (!mapInstance || !markets.length || !keyword.trim()) return;
      const target = markets.find(m => m.name.includes(keyword));
      if (target && target.latitude && target.longitude) {
          const moveLatLon = new window.kakao.maps.LatLng(parseFloat(target.latitude), parseFloat(target.longitude));
          mapInstance.setLevel(3);
          mapInstance.panTo(moveLatLon);
          if (window.innerWidth < 1024) setShowMobileMap(true);
      } else {
          alert('찾는 현장이 없습니다.');
      }
  };

  const timerContent = (
    <div className="flex items-center gap-3 text-xs md:text-sm text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded border border-slate-700">
        <span>기준 시각 : <span className="text-white ml-1">{now.toLocaleTimeString()}</span></span>
        <div className="w-px h-3 bg-slate-600"></div>
        <span>
            <span className="text-blue-400 font-bold w-5 inline-block text-right">{secondsLeft}</span>
            초 후 새로고침
        </span>
    </div>
  );

  return (
    <div className="flex flex-col h-full text-slate-200">
      <PageHeader title="대시보드" rightContent={timerContent} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-160px)] min-h-[500px]">
        
        {/* Left Column: Lists */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar pb-20 lg:pb-0">
          <div className="grid grid-cols-3 gap-3 flex-shrink-0">
            {stats.map((stat, idx) => (
              <div key={idx} className={`${stat.color} text-white px-4 h-20 rounded-lg shadow-lg border border-white/10 flex flex-row items-center justify-between transform transition-transform hover:scale-105`}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-full">{stat.icon}</div>
                    <div className="text-xs md:text-sm font-bold opacity-90 leading-tight break-keep">{stat.label}</div>
                </div>
                <div className="text-2xl md:text-3xl font-black">{stat.value}</div>
              </div>
            ))}
          </div>

          <DashboardListSection 
            title="최근 화재 발생현황"
            icon={<AlertTriangle size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-red-900 to-slate-800"
            data={fireData}
            linkTo="/fire-history"
            onItemClick={(item) => handlePanToMarket(item.marketName || '')}
            renderItem={(item) => {
              const dt = formatDateTime(item.time);
              return (
                <div className="flex items-center justify-between px-2 py-2 transition-colors text-sm">
                   <div className="flex items-center gap-2 min-w-0">
                      <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 animate-pulse">화재</span>
                      <span className="font-medium text-slate-200 truncate group-hover:text-white" title={item.msg}>{item.msg}</span>
                   </div>
                   <div className="text-xs lg:text-sm text-slate-500 shrink-0 ml-2 flex flex-col lg:flex-row lg:items-center lg:gap-2 leading-tight">
                      <span className="text-slate-400">{dt.date}</span>
                      <span>{dt.time}</span>
                   </div>
                </div>
              );
            }}
          />

          <DashboardListSection 
            title="최근 고장 발생현황"
            icon={<BatteryWarning size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-orange-900 to-slate-800"
            data={faultData}
            linkTo="/device-status"
            renderItem={(item) => {
              const dt = formatDateTime(item.time);
              return (
                <div className="flex items-center justify-between px-2 py-2 transition-colors text-sm">
                   <div className="flex items-center gap-2 min-w-0">
                      <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0">고장</span>
                      <span className="font-medium text-slate-200 truncate group-hover:text-white" title={item.msg}>{item.msg}</span>
                   </div>
                   <div className="text-xs lg:text-sm text-slate-500 shrink-0 ml-2 flex flex-col lg:flex-row lg:items-center lg:gap-2 leading-tight">
                      <span className="text-slate-400">{dt.date}</span>
                      <span>{dt.time}</span>
                   </div>
                </div>
              );
            }}
          />

          <DashboardListSection 
            title="수신기 통신 이상 내역"
            icon={<WifiOff size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-slate-700 to-slate-800"
            data={commErrorData}
            linkTo="/device-status"
            renderItem={(item) => {
              const dt = formatDateTime(item.time);
              return (
                <div className="flex items-center justify-between px-2 py-2 transition-colors text-sm">
                   <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-slate-200 truncate group-hover:text-white">{item.market}</span>
                      <span className="text-xs text-slate-400 truncate hidden sm:inline">({item.address})</span>
                   </div>
                   <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-orange-300 font-mono text-[10px] bg-orange-900/30 px-1.5 py-0.5 rounded mr-1">R:{item.receiver}</span>
                      <div className="text-xs lg:text-sm text-slate-500 flex flex-col lg:flex-row lg:items-center lg:gap-2 leading-tight">
                        <span className="text-slate-400">{dt.date}</span>
                        <span>{dt.time}</span>
                      </div>
                   </div>
                </div>
              );
            }}
          />
        </div>

        {/* Right Column: Map (Kakao Map) */}
        <div className={`
            bg-slate-900 rounded-xl overflow-hidden relative shadow-inner border border-slate-700 flex flex-col h-full
            ${showMobileMap ? 'fixed inset-0 z-50 m-0 rounded-none' : 'hidden lg:flex'}
        `}>
            {/* Mobile Close Button */}
            <div className="lg:hidden absolute top-4 left-4 z-50">
                <button onClick={() => setShowMobileMap(false)} className="bg-slate-800/90 text-white p-2 rounded-full border border-slate-600 shadow-lg">
                    <X size={24} />
                </button>
            </div>

            {/* Map Controls */}
            <div className="absolute top-0 left-0 right-0 z-20 p-3 flex gap-2 bg-gradient-to-b from-slate-900/90 to-transparent pointer-events-none lg:pt-3 pt-16">
                <div className="flex gap-2 w-full max-w-3xl pointer-events-auto">
                    <select 
                        className="bg-slate-800 text-white text-xs border border-slate-600 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 shadow-lg"
                        value={selectedSido}
                        onChange={(e) => { setSelectedSido(e.target.value); setSelectedSigungu(''); }}
                    >
                        <option value="">시/도 선택</option>
                        {SIDO_LIST.map(sido => <option key={sido} value={sido}>{sido}</option>)}
                    </select>
                    
                    <select 
                        className="bg-slate-800 text-white text-xs border border-slate-600 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 shadow-lg"
                        value={selectedSigungu}
                        onChange={(e) => setSelectedSigungu(e.target.value)}
                        disabled={!selectedSido}
                    >
                        <option value="">시/군/구 선택</option>
                        {selectedSido && getSigungu(selectedSido).map(sgg => (
                            <option key={sgg} value={sgg}>{sgg}</option>
                        ))}
                    </select>

                    <div className="relative flex-1">
                        <input 
                            type="text" 
                            placeholder="현장명 검색"
                            className="w-full bg-slate-800 text-white text-xs border border-slate-600 rounded pl-2 pr-8 py-1.5 focus:outline-none focus:border-blue-500 shadow-lg"
                            value={searchMarketMap}
                            onChange={(e) => setSearchMarketMap(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter') handlePanToMarket(searchMarketMap); }}
                        />
                        <Search size={14} className="absolute right-2 top-2 text-slate-400 cursor-pointer" onClick={() => handlePanToMarket(searchMarketMap)} />
                    </div>

                    {isSearchActive && (
                        <button onClick={handleResetMap} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded shadow-lg flex items-center gap-1">
                            <RotateCcw size={12} />
                            <span className="hidden sm:inline">전체보기</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Map Container */}
            <div ref={mapContainer} className="w-full h-full relative z-0">
                {mapError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900 -z-10 p-6 text-center">
                        <MapPin size={48} className="mx-auto mb-4 text-red-500 opacity-80" />
                        <h3 className="text-lg font-bold text-white mb-2">지도를 불러올 수 없습니다.</h3>
                        <button onClick={() => window.location.reload()} className="flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm mt-4">
                            <RefreshCw size={14} /> 새로고침
                        </button>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 bg-slate-900 -z-10">
                        <div className="text-center p-4">
                            <MapPin size={48} className="mx-auto mb-4 opacity-50 animate-bounce" />
                            <p className="mb-2 text-lg font-bold">지도 로딩 중...</p>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-600 px-3 py-1.5 rounded-full text-xs text-slate-300 shadow-lg flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${fireData.length > 0 ? 'bg-red-400' : 'bg-green-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${fireData.length > 0 ? 'bg-red-500' : 'bg-green-500'}`}></span>
                </span>
                실시간 관제 중 ({markets.length}개 시장 연동)
            </div>
        </div>
      </div>

      {/* Mobile Floating Map Button */}
      {!showMobileMap && !selectedMapMarket && (
        <button
            onClick={() => setShowMobileMap(true)}
            className="lg:hidden fixed bottom-6 right-6 z-40 bg-blue-600 text-white p-4 rounded-full shadow-2xl border-2 border-blue-400 hover:bg-blue-500 transition-transform active:scale-95 animate-bounce-slow"
        >
            <MapIcon size={28} />
        </button>
      )}

      {/* --- Visual Console Modal (Full Screen) --- */}
      {selectedMapMarket && (
          <VisualMapConsole 
             market={selectedMapMarket}
             onClose={() => setSelectedMapMarket(null)}
             initialMode="monitoring"
          />
      )}
    </div>
  );
};
