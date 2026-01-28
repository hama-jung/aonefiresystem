import React, { useState, useEffect, useRef } from 'react';
import { PageHeader, Pagination, Modal, Button } from '../components/CommonUI';
import { AlertTriangle, WifiOff, ArrowRight, BatteryWarning, MapPin, Search, RefreshCw, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SIDO_LIST, getSigungu } from '../utils/addressData';
import { MarketAPI, DashboardAPI } from '../services/api'; 
import { Market } from '../types';

declare global {
  interface Window {
    kakao: any;
  }
}

const ITEMS_PER_LIST_PAGE = 4;

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
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-sm overflow-hidden flex flex-col transition-all duration-300">
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
  // --- WIP Modal State ---
  const [isWipModalOpen, setIsWipModalOpen] = useState(true);

  // --- Timer State ---
  const [now, setNow] = useState(new Date());
  const [secondsLeft, setSecondsLeft] = useState(60);
  
  // --- Data State ---
  const [fireData, setFireData] = useState<any[]>([]);
  const [faultData, setFaultData] = useState<any[]>([]);
  const [commErrorData, setCommErrorData] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([
    { label: '최근 화재 발생', value: 0, color: 'bg-red-600', icon: <AlertTriangle size={20} /> },
    { label: '최근 고장 발생', value: 0, color: 'bg-orange-500', icon: <BatteryWarning size={20} /> },
    { label: '통신 이상', value: 0, color: 'bg-slate-600', icon: <WifiOff size={20} /> },
  ]);
  const [markets, setMarkets] = useState<Market[]>([]);

  // --- Map State ---
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [infowindows, setInfowindows] = useState<any[]>([]);
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
            // 1. 시장 목록 로드
            const allMarkets = await MarketAPI.getList();
            
            // 2. 대시보드 이벤트 데이터 로드 (화재, 고장, 통신)
            const dashboardData: any = await DashboardAPI.getData();
            
            setFireData(dashboardData.fireEvents || []);
            setFaultData(dashboardData.faultEvents || []);
            setCommErrorData(dashboardData.commEvents || []);
            
            if (dashboardData.stats && dashboardData.stats.length === 3) {
                setStats([
                    { label: '최근 화재 발생', value: dashboardData.stats[0].value, color: 'bg-red-600', icon: <AlertTriangle size={20} /> },
                    { label: '최근 고장 발생', value: dashboardData.stats[1].value, color: 'bg-orange-500', icon: <BatteryWarning size={20} /> },
                    { label: '통신 이상', value: dashboardData.stats[2].value, color: 'bg-slate-600', icon: <WifiOff size={20} /> },
                ]);
            }

            // 3. 시장 상태 업데이트 (이벤트 데이터 기반으로 시장 상태 결정)
            // - 화재 목록에 있는 시장 -> Status: Fire
            // - 고장/통신 목록에 있는 시장 -> Status: Error
            // - 그 외 -> Normal
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
  }, [now]); // Timer reset triggers reload

  // 3. Map Initialization (With Retry Logic)
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

  // 4. Map Markers Update (Status Linked)
  useEffect(() => {
    if (mapInstance && markets.length > 0) {
        markers.forEach(m => m.setMap(null));
        infowindows.forEach(iw => iw.close());
        setMarkers([]);
        setInfowindows([]);

        const newMarkers: any[] = [];
        const newInfowindows: any[] = [];

        markets.forEach((market) => {
            if (market.latitude && market.longitude) {
                const lat = parseFloat(market.latitude);
                const lng = parseFloat(market.longitude);
                const markerPosition = new window.kakao.maps.LatLng(lat, lng);

                // 마커 이미지 (상태별 색상 구분은 카카오맵 기본 마커로는 제한적이므로, 필요시 커스텀 이미지 사용)
                // 여기서는 기본 마커를 쓰고 인포윈도우로 상태 강조
                const marker = new window.kakao.maps.Marker({
                    position: markerPosition,
                    map: mapInstance,
                    title: market.name
                });

                const isFire = market.status === 'Fire';
                const statusColor = isFire ? 'text-red-600' : (market.status === 'Error' ? 'text-orange-500' : 'text-green-600');
                const statusText = isFire ? '화재발생' : (market.status === 'Error' ? '장애발생' : '정상운영');
                
                const iwContent = `
                    <div style="padding:10px; min-width:200px; color:black; font-size:12px; border-radius:4px;">
                        <strong style="font-size:14px;">${market.name}</strong>
                        <div style="margin-top:4px; color:#666;">${market.address}</div>
                        <div style="margin-top:4px;">담당자: ${market.managerName || '-'}</div>
                        <div style="margin-top:6px; font-weight:bold;" class="${statusColor}">
                            상태: ${statusText}
                        </div>
                    </div>
                `;

                const infowindow = new window.kakao.maps.InfoWindow({
                    content: iwContent,
                    removable: true
                });

                window.kakao.maps.event.addListener(marker, 'click', function() {
                    newInfowindows.forEach(iw => iw.close());
                    infowindow.open(mapInstance, marker);
                });

                // 화재 발생 시 인포윈도우 자동 오픈
                if (isFire) {
                    infowindow.open(mapInstance, marker);
                }

                newMarkers.push(marker);
                newInfowindows.push(infowindow);
            }
        });

        setMarkers(newMarkers);
        setInfowindows(newInfowindows);
    }
  }, [mapInstance, markets]);

  const handlePanToMarket = (marketName: string) => {
      if (!mapInstance || !markets.length) return;

      const target = markets.find(m => m.name.includes(marketName) || marketName.includes(m.name));
      if (target && target.latitude && target.longitude) {
          const moveLatLon = new window.kakao.maps.LatLng(parseFloat(target.latitude), parseFloat(target.longitude));
          mapInstance.setLevel(3);
          mapInstance.panTo(moveLatLon);
      }
  };

  const timerContent = (
    <div className="flex items-center gap-3 text-xs md:text-sm text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded border border-slate-700">
        <span>기준 시각 : <span className="text-white font-mono ml-1">{now.toLocaleTimeString()}</span></span>
        <div className="w-px h-3 bg-slate-600"></div>
        <span>
            <span className="text-blue-400 font-bold font-mono w-5 inline-block text-right">{secondsLeft}</span>
            초 후 새로고침
        </span>
    </div>
  );

  return (
    <div className="flex flex-col h-full text-slate-200">
      <PageHeader title="대시보드" rightContent={timerContent} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Left Column: Lists */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
          <div className="grid grid-cols-3 gap-3">
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
            renderItem={(item) => (
              <div className="flex items-center justify-between px-2 py-2 transition-colors text-sm">
                 <div className="flex items-center gap-2 min-w-0">
                    <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 animate-pulse">화재</span>
                    <span className="font-medium text-slate-200 truncate group-hover:text-white" title={item.msg}>{item.msg}</span>
                 </div>
                 <div className="text-xs text-slate-500 shrink-0 ml-2 font-mono">
                    {item.time ? new Date(item.time).toLocaleTimeString() : '-'}
                 </div>
              </div>
            )}
          />

          <DashboardListSection 
            title="최근 고장 발생현황"
            icon={<BatteryWarning size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-orange-900 to-slate-800"
            data={faultData}
            linkTo="/device-status"
            renderItem={(item) => (
              <div className="flex items-center justify-between px-2 py-2 transition-colors text-sm">
                 <div className="flex items-center gap-2 min-w-0">
                    <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0">고장</span>
                    <span className="font-medium text-slate-200 truncate group-hover:text-white" title={item.msg}>{item.msg}</span>
                 </div>
                 <div className="text-xs text-slate-500 shrink-0 ml-2 font-mono">
                    {item.time ? new Date(item.time).toLocaleTimeString() : '-'}
                 </div>
              </div>
            )}
          />

          <DashboardListSection 
            title="수신기 통신 이상 내역"
            icon={<WifiOff size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-slate-700 to-slate-800"
            data={commErrorData}
            linkTo="/device-status"
            renderItem={(item) => (
              <div className="flex items-center justify-between px-2 py-2 transition-colors text-sm">
                 <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-200 truncate group-hover:text-white">{item.market}</span>
                    <span className="text-xs text-slate-400 truncate hidden sm:inline">({item.address})</span>
                 </div>
                 <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-orange-300 font-mono text-xs bg-orange-900/30 px-1.5 py-0.5 rounded">R:{item.receiver}</span>
                 </div>
              </div>
            )}
          />
        </div>

        {/* Right Column: Map */}
        <div className="bg-slate-900 rounded-xl overflow-hidden relative shadow-inner border border-slate-700 flex flex-col h-full">
          {/* Map Controls */}
          <div className="absolute top-0 left-0 right-0 z-20 p-3 flex gap-2 bg-gradient-to-b from-slate-900/90 to-transparent pointer-events-none">
             <div className="flex gap-2 w-full max-w-2xl pointer-events-auto">
                <select 
                    className="bg-slate-800 text-white text-xs border border-slate-600 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 shadow-lg appearance-none pr-6"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23e2e8f0' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 0.25rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.2em 1.2em'
                    }}
                    value={selectedSido}
                    onChange={(e) => { setSelectedSido(e.target.value); setSelectedSigungu(''); }}
                >
                    <option value="">시/도 선택</option>
                    {SIDO_LIST.map(sido => <option key={sido} value={sido}>{sido}</option>)}
                </select>
                
                <select 
                    className="bg-slate-800 text-white text-xs border border-slate-600 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 shadow-lg appearance-none pr-6"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23e2e8f0' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 0.25rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.2em 1.2em'
                    }}
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
                        placeholder="시장명 검색"
                        className="w-full bg-slate-800 text-white text-xs border border-slate-600 rounded pl-2 pr-8 py-1.5 focus:outline-none focus:border-blue-500 shadow-lg placeholder-slate-500"
                        value={searchMarketMap}
                        onChange={(e) => setSearchMarketMap(e.target.value)}
                        onKeyDown={(e) => {
                            if(e.key === 'Enter') handlePanToMarket(searchMarketMap);
                        }}
                    />
                    <Search size={14} className="absolute right-2 top-2 text-slate-400 cursor-pointer" onClick={() => handlePanToMarket(searchMarketMap)} />
                </div>
             </div>
          </div>

          {/* Map Container & Error Handling */}
          <div ref={mapContainer} className="w-full h-full relative z-0">
             {mapError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900 -z-10 p-6 text-center">
                   <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 max-w-md shadow-xl">
                       <MapPin size={48} className="mx-auto mb-4 text-red-500 opacity-80" />
                       <h3 className="text-lg font-bold text-white mb-2">지도를 불러올 수 없습니다.</h3>
                       <p className="text-sm mb-4">
                         설정된 도메인과 API 키가 일치하지 않거나,<br/>
                         카카오 개발자 센터의 허용 도메인 설정이 누락되었습니다.
                       </p>
                       <button 
                         onClick={() => window.location.reload()}
                         className="flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm transition-colors"
                       >
                         <RefreshCw size={14} /> 새로고침
                       </button>
                   </div>
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

      {/* WIP Modal */}
      <Modal 
        isOpen={isWipModalOpen} 
        onClose={() => setIsWipModalOpen(false)} 
        title="시스템 알림"
        width="max-w-sm"
        icon={<Info size={24} className="text-blue-400" />}
      >
         <div className="flex flex-col items-center justify-center p-4 gap-6">
            <div className="text-lg font-bold text-white">작업중입니다</div>
            <Button onClick={() => setIsWipModalOpen(false)} className="w-full">
               확인
            </Button>
         </div>
      </Modal>
    </div>
  );
};
