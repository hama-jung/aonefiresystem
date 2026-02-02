import React, { useState, useEffect, useRef } from 'react';
import { PageHeader, Pagination, Button } from '../components/CommonUI';
import { AlertTriangle, WifiOff, ArrowRight, BatteryWarning, MapPin, Search, RefreshCw, X, RotateCcw, Map as MapIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SIDO_LIST, getSigungu } from '../utils/addressData';
import { MarketAPI, DashboardAPI } from '../services/api'; 
import { Market } from '../types';
import { VisualMapConsole } from '../components/VisualMapConsole';

// ... existing code (MapContainer etc.) ...
// (기존 코드 생략 - MapContainer는 props로 받은 markets 데이터를 그대로 렌더링하므로 변경 없음)
declare global {
  interface Window {
    kakao: any;
  }
}

const ITEMS_PER_LIST_PAGE = 4;

const SIDO_COORDINATES: { [key: string]: { lat: number, lng: number, level: number } } = {
  "서울특별시": { lat: 37.5665, lng: 126.9780, level: 9 },
  // ... (SIDO_COORDINATES content unchanged)
  "제주특별자치도": { lat: 33.4996, lng: 126.5312, level: 10 },
};

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

const MapContainer: React.FC<{ 
  level: number; 
  setLevel: (l: 1 | 2 | 3) => void;
  markets: any[];
  sido: string;
  setSido: (s: string) => void;
  sigun: string;
  setSigun: (s: string) => void;
  onMarketSelect: (market: Market) => void;
}> = ({ level, setLevel, markets, sido, setSido, sigun, setSigun, onMarketSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [clusterer, setClusterer] = useState<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current || !window.kakao) return;

    const container = mapRef.current;
    const options = {
      center: new window.kakao.maps.LatLng(36.5, 127.5),
      level: 13
    };
    const map = new window.kakao.maps.Map(container, options);
    setMapInstance(map);

    const zoomControl = new window.kakao.maps.ZoomControl();
    map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

    const cluster = new window.kakao.maps.MarkerClusterer({
        map: map,
        averageCenter: true,
        minLevel: 10,
        calculator: [10, 30, 50],
        styles: [{ 
            width : '50px', height : '50px',
            background: 'rgba(59, 130, 246, 0.8)',
            borderRadius: '25px',
            color: '#fff',
            textAlign: 'center',
            fontWeight: 'bold',
            lineHeight: '50px'
        }]
    });
    setClusterer(cluster);

  }, []);

  useEffect(() => {
    if (!mapInstance || !clusterer) return;

    clusterer.clear();
    markersRef.current = [];

    const filteredMarkets = markets.filter(m => {
        if (!m.x || !m.y) return false;
        if (sido && !m.address.startsWith(sido)) return false;
        if (sigun && !m.address.includes(sigun)) return false;
        return true;
    });

    const newMarkers = filteredMarkets.map((market) => {
        const position = new window.kakao.maps.LatLng(market.x, market.y);
        
        let imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png';
        
        if (market.status === 'Fire' || market.status === '화재') {
             imageSrc = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png';
        } else if (market.status === 'Error' || market.status === '고장') {
             imageSrc = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png';
        } else {
             imageSrc = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png'; 
        }

        const imageSize = new window.kakao.maps.Size(24, 35); 
        const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize);

        const marker = new window.kakao.maps.Marker({
            position: position,
            image: markerImage,
            title: market.name
        });

        const iwContent = `
            <div style="padding:5px; color:black; font-size:12px; border-radius:4px; background:white; border:1px solid #ccc;">
               <strong>${market.name}</strong><br/>
               <span style="color:${market.status === 'Fire' ? 'red' : (market.status === 'Error' ? 'orange' : 'green')}">
                 ${market.status === 'Normal' ? '정상' : (market.status === 'Fire' ? '🔥 화재' : '⚠️ 고장')}
               </span>
            </div>
        `;
        const infowindow = new window.kakao.maps.InfoWindow({
            content: iwContent,
            zIndex: 1
        });

        window.kakao.maps.event.addListener(marker, 'mouseover', () => infowindow.open(mapInstance, marker));
        window.kakao.maps.event.addListener(marker, 'mouseout', () => infowindow.close());
        window.kakao.maps.event.addListener(marker, 'click', () => {
            onMarketSelect(market);
        });

        if (market.status !== 'Normal') {
            infowindow.open(mapInstance, marker);
        }

        return marker;
    });

    clusterer.addMarkers(newMarkers);
    markersRef.current = newMarkers;

    if (sido && SIDO_COORDINATES[sido]) {
        const { lat, lng, level } = SIDO_COORDINATES[sido];
        const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
        setTimeout(() => {
            mapInstance.setLevel(level);
            mapInstance.panTo(moveLatLon);
            if (newMarkers.length > 0) {
                const bounds = new window.kakao.maps.LatLngBounds();
                newMarkers.forEach((m: any) => bounds.extend(m.getPosition()));
                mapInstance.setBounds(bounds);
            }
        }, 100);
    } else {
        mapInstance.setCenter(new window.kakao.maps.LatLng(36.5, 127.5));
        mapInstance.setLevel(13);
    }

  }, [mapInstance, markets, sido, sigun, clusterer]);

  return <div ref={mapRef} className="w-full h-full rounded-lg" />;
};

export const Dashboard: React.FC = () => {
  const [level, setLevel] = useState<1 | 2 | 3>(1); 
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const [selectedSido, setSelectedSido] = useState('');
  const [selectedSigun, setSelectedSigun] = useState('');
  const [sigunList, setSigunList] = useState<string[]>([]);

  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

  const fetchData = async () => {
    setLoading(true);
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSidoChange = (val: string) => {
    setSelectedSido(val);
    if (val) {
        setSigunList(getSigungu(val));
    } else {
        setSigunList([]);
    }
    setSelectedSigun('');
  };

  const handleMarketClick = (item: any) => {
      // API에서 marketId를 반환하므로, 이를 우선 사용. 없으면 이름으로 매칭 시도(Fallback)
      const targetMarket = data?.mapData?.find((m: any) => 
          (item.marketId && m.id === item.marketId) || m.name === (item.marketName || item.market)
      );
      
      if (targetMarket) {
          setSelectedMarket(targetMarket as Market);
          const addrParts = targetMarket.address.split(' ');
          if (addrParts.length > 0 && SIDO_LIST.includes(addrParts[0])) {
              handleSidoChange(addrParts[0]);
          }
      } else {
          alert('해당 현장의 위치 정보가 등록되지 않아 지도에 표시할 수 없습니다.\n현장 관리에서 주소/좌표를 확인해주세요.');
      }
  };

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-500 font-bold animate-pulse">시스템 데이터를 불러오는 중입니다...</div>
      </div>
    );
  }

  const { stats, fireEvents, faultEvents, commEvents, mapData } = data;

  return (
    <div className="flex flex-col h-full text-slate-200 gap-4">
      {/* 1. Header Stats (No changes) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {stats.map((stat: any, idx: number) => (
            <div key={idx} className={`relative overflow-hidden rounded-lg p-4 shadow-lg border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900`}>
                <div className={`absolute top-0 right-0 p-2 opacity-10`}>
                    <AlertTriangle size={64} /> 
                </div>
                <div className="relative z-10 flex flex-col">
                    <span className="text-slate-400 text-sm font-medium">{stat.label}</span>
                    <div className="flex items-end gap-2 mt-1">
                        <span className={`text-3xl font-bold ${stat.color.replace('bg-', 'text-')}`}>{stat.value}</span>
                        <span className="text-slate-500 text-sm mb-1">건</span>
                    </div>
                </div>
                <div className={`absolute bottom-0 left-0 h-1 w-full ${stat.color}`}></div>
            </div>
         ))}
         
         <div className="flex flex-col justify-between bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-lg">
             <div className="flex gap-2">
                 <select 
                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    value={selectedSido}
                    onChange={(e) => handleSidoChange(e.target.value)}
                 >
                    <option value="">전국</option>
                    {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
                 <select 
                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    value={selectedSigun}
                    onChange={(e) => setSelectedSigun(e.target.value)}
                    disabled={!selectedSido}
                 >
                    <option value="">전체</option>
                    {sigunList.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
             </div>
             <div className="flex justify-between items-end mt-2">
                 <span className="text-[11px] text-slate-500">
                    Update: {lastUpdated.toLocaleTimeString()}
                 </span>
                 <button 
                    onClick={fetchData} 
                    className={`p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors ${loading ? 'animate-spin' : ''}`}
                    title="새로고침"
                 >
                    <RefreshCw size={14} />
                 </button>
             </div>
         </div>
      </div>

      {/* 2. Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 pb-2">
            <DashboardListSection 
                title="최근 화재 발생현황" 
                icon={<AlertTriangle size={16} className="text-red-200"/>}
                headerColorClass="bg-red-900/40 border-red-900/50"
                data={fireEvents}
                linkTo="/fire-history"
                onItemClick={handleMarketClick}
                renderItem={(log) => {
                    const { date, time } = formatDateTime(log.time);
                    return (
                        <div className="flex justify-between items-start py-1">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse">화재</span>
                                    <span className="text-xs text-slate-300 font-medium truncate block">{log.msg}</span>
                                </div>
                                <div className="text-[10px] text-slate-500">{date} {time}</div>
                            </div>
                        </div>
                    );
                }}
            />

            <DashboardListSection 
                title="최근 고장 발생현황" 
                icon={<BatteryWarning size={16} className="text-orange-200"/>}
                headerColorClass="bg-orange-900/40 border-orange-900/50"
                data={faultEvents}
                linkTo="/device-status"
                onItemClick={handleMarketClick}
                renderItem={(log) => {
                    const { date, time } = formatDateTime(log.time);
                    return (
                        <div className="flex justify-between items-start py-1">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">고장</span>
                                    <span className="text-xs text-slate-300 font-medium truncate block">{log.msg}</span>
                                </div>
                                <div className="text-[10px] text-slate-500">{date} {time}</div>
                            </div>
                        </div>
                    );
                }}
            />

            <DashboardListSection 
                title="수신기 통신 이상 내역" 
                icon={<WifiOff size={16} className="text-gray-200"/>}
                headerColorClass="bg-slate-700/50 border-slate-600"
                data={commEvents}
                linkTo="/device-status"
                onItemClick={handleMarketClick}
                renderItem={(log) => {
                    const { date, time } = formatDateTime(log.time);
                    return (
                        <div className="flex justify-between items-center py-1">
                            <div className="flex-1">
                                <div className="text-xs text-slate-300 font-bold mb-0.5">{log.address}</div>
                                <div className="text-[11px] text-slate-400">수신기: {log.receiver}</div>
                            </div>
                            <div className="text-[10px] text-slate-500 text-right">
                                <div>{date}</div>
                                <div>{time}</div>
                            </div>
                        </div>
                    );
                }}
            />
        </div>

        <div className="lg:col-span-3 bg-slate-900 rounded-xl overflow-hidden relative shadow-inner border border-slate-700 flex flex-col">
            <div className="flex-1 relative">
                <MapContainer 
                    level={level} 
                    setLevel={setLevel} 
                    markets={mapData}
                    sido={selectedSido}
                    setSido={setSelectedSido}
                    sigun={selectedSigun}
                    setSigun={setSelectedSigun}
                    onMarketSelect={(m) => setSelectedMarket(m)}
                />
                
                <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm p-3 rounded border border-slate-700 shadow-lg z-10 pointer-events-none">
                    <div className="text-xs font-bold text-slate-300 mb-1">지도 표시 현황</div>
                    <div className="flex gap-3 text-xs">
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> 화재 {mapData.filter((m:any) => m.status === 'Fire').length}</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> 고장 {mapData.filter((m:any) => m.status === 'Error').length}</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 정상 {mapData.filter((m:any) => m.status === 'Normal').length}</div>
                    </div>
                </div>
            </div>
        </div>
      </div>

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