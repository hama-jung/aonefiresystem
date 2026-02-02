import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Pagination } from '../components/CommonUI';
import { AlertTriangle, WifiOff, ArrowRight, BatteryWarning, MapPin, Search, RefreshCw, Map as MapIcon, Activity, Shield, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SIDO_LIST, getSigungu } from '../utils/addressData';
import { DashboardAPI } from '../services/api'; 
import { Market } from '../types';
import { VisualMapConsole } from '../components/VisualMapConsole';

declare global {
  interface Window {
    kakao: any;
  }
}

const ITEMS_PER_LIST_PAGE = 4;

const SIDO_COORDINATES: { [key: string]: { lat: number, lng: number, level: number } } = {
  "서울특별시": { lat: 37.5665, lng: 126.9780, level: 9 },
  "부산광역시": { lat: 35.1796, lng: 129.0756, level: 9 },
  "대구광역시": { lat: 35.8714, lng: 128.6014, level: 9 },
  "인천광역시": { lat: 37.4563, lng: 126.7052, level: 9 },
  "광주광역시": { lat: 35.1601, lng: 126.8517, level: 9 },
  "대전광역시": { lat: 36.3504, lng: 127.3845, level: 9 },
  "울산광역시": { lat: 35.5384, lng: 129.3114, level: 9 },
  "세종특별자치시": { lat: 36.4800, lng: 127.2890, level: 10 },
  "경기도": { lat: 37.4138, lng: 127.5183, level: 10 },
  "강원특별자치도": { lat: 37.8228, lng: 128.1555, level: 11 },
  "충청북도": { lat: 36.6350, lng: 127.4914, level: 10 },
  "충청남도": { lat: 36.6588, lng: 126.6728, level: 10 },
  "전북특별자치도": { lat: 35.7175, lng: 127.1530, level: 10 },
  "전라남도": { lat: 34.8679, lng: 126.9910, level: 10 },
  "경상북도": { lat: 36.5760, lng: 128.5056, level: 11 },
  "경상남도": { lat: 35.4606, lng: 128.2132, level: 10 },
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

// --- Modern Styled Components ---

const StatCard = ({ label, value, color, icon: Icon }: any) => (
  <div className={`relative overflow-hidden rounded-2xl p-6 shadow-lg border border-slate-700/50 bg-slate-800/60 backdrop-blur-xl group transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-slate-600`}>
      {/* Glow Effect */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity ${color}`}></div>
      
      <div className="relative z-10 flex justify-between items-start">
          <div className="flex flex-col gap-1">
              <span className="text-slate-400 text-xs font-bold tracking-widest uppercase">{label}</span>
              <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-4xl font-black tracking-tighter ${color.replace('bg-', 'text-')}`}>{value}</span>
                  <span className="text-slate-500 text-xs font-bold">건</span>
              </div>
          </div>
          <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 shadow-inner ${color.replace('bg-', 'text-')}`}>
              <Icon size={24} strokeWidth={2} />
          </div>
      </div>
      
      {/* Animated Bar */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-700/30">
          <div className={`h-full ${color} opacity-70 transition-all duration-1000 ease-out`} style={{ width: value > 0 ? '100%' : '5%' }}></div>
      </div>
  </div>
);

const DashboardListSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  headerStyle: string;
  data: any[];
  renderItem: (item: any) => React.ReactNode;
  linkTo: string;
  onItemClick?: (item: any) => void;
}> = ({ title, icon, headerStyle, data, renderItem, linkTo, onItemClick }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  
  // Safe guard for data being undefined or null
  const safeData = Array.isArray(data) ? data : [];
  const currentItems = safeData.slice((page - 1) * ITEMS_PER_LIST_PAGE, page * ITEMS_PER_LIST_PAGE);

  return (
    <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden flex flex-col transition-all duration-300 hover:border-slate-600 group">
      <div className={`px-5 py-4 border-b flex items-center justify-between ${headerStyle}`}>
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-sm shadow-sm ring-1 ring-white/10">
            {icon}
          </div>
          <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
        </div>
        <button 
          onClick={() => navigate(linkTo)}
          className="text-white/40 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all group-hover:translate-x-1"
          title="더 보기"
        >
          <ArrowRight size={16} />
        </button>
      </div>
      
      <div className="p-3 space-y-2.5 min-h-[240px]">
        {currentItems.map((item) => (
           <div 
             key={item.id} 
             onClick={() => onItemClick && onItemClick(item)}
             className={`p-3.5 rounded-xl border border-slate-700/30 bg-slate-800/50 hover:bg-slate-700/80 hover:border-slate-600 transition-all duration-200 group/item ${onItemClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5' : ''}`}
           >
             {renderItem(item)}
           </div>
        ))}
        {currentItems.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-10 gap-3">
                <div className="p-4 rounded-full bg-slate-800/80 border border-slate-700/50"><Shield size={24} className="opacity-20"/></div>
                <span>데이터가 없습니다.</span>
            </div>
        )}
      </div>

      {safeData.length > ITEMS_PER_LIST_PAGE && (
        <div className="py-3 border-t border-slate-700/30 bg-slate-900/20 flex items-center justify-center">
             <Pagination 
                totalItems={safeData.length} 
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
  
  useEffect(() => {
    if (!mapRef.current || !window.kakao) return;

    const container = mapRef.current;
    const options = {
      center: new window.kakao.maps.LatLng(36.5, 127.5),
      level: 13
    };
    const map = new window.kakao.maps.Map(container, options);
    setMapInstance(map);

    // Zoom Control
    const zoomControl = new window.kakao.maps.ZoomControl();
    map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

    // Clusterer
    const cluster = new window.kakao.maps.MarkerClusterer({
        map: map,
        averageCenter: true,
        minLevel: 10,
        calculator: [10, 30, 50],
        styles: [{ 
            width : '50px', height : '50px',
            background: 'rgba(59, 130, 246, 0.9)',
            borderRadius: '50%',
            color: '#fff',
            textAlign: 'center',
            fontWeight: 'bold',
            lineHeight: '50px',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)',
            border: '2px solid rgba(255,255,255,0.3)'
        }]
    });
    setClusterer(cluster);

  }, []);

  useEffect(() => {
    if (!mapInstance || !clusterer) return;

    clusterer.clear();

    const filteredMarkets = (markets || []).filter(m => {
        if (!m.x || !m.y) return false;
        if (sido && !m.address.startsWith(sido)) return false;
        if (sigun && !m.address.includes(sigun)) return false;
        return true;
    });

    const newMarkers = filteredMarkets.map((market) => {
        const position = new window.kakao.maps.LatLng(market.x, market.y);
        
        let imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png'; // Default Blue
        
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

        // Infowindow Content
        const iwContent = `
            <div style="padding:10px; color:white; min-width:150px; border-radius:8px; background:#1e293b; border:1px solid #475569; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-family:sans-serif;">
               <div style="font-weight:bold; margin-bottom:6px; font-size:14px; color:#f1f5f9;">${market.name}</div>
               <div style="font-size:11px; color:#94a3b8; margin-bottom:6px;">${market.address}</div>
               <span style="padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; background:${market.status === 'Fire' || market.status === '화재' ? '#ef4444' : (market.status === 'Error' || market.status === '고장' ? '#f97316' : '#22c55e')}; color:white;">
                 ${market.status === 'Normal' ? '정상 운영 중' : (market.status === 'Fire' || market.status === '화재' ? '🔥 화재 감지됨' : '⚠️ 기기 점검 필요')}
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

    if (sido && SIDO_COORDINATES[sido]) {
        const { lat, lng, level } = SIDO_COORDINATES[sido];
        const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
        setTimeout(() => {
            mapInstance.setLevel(level);
            mapInstance.panTo(moveLatLon);
        }, 100);
    } else {
        // Center of Korea
        mapInstance.setCenter(new window.kakao.maps.LatLng(36.5, 127.5));
        mapInstance.setLevel(13);
    }

  }, [mapInstance, markets, sido, sigun, clusterer]);

  return <div ref={mapRef} className="w-full h-full" />;
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
      const targetMarket = data?.mapData?.find((m: any) => 
          (item.marketId && m.id === item.marketId) || m.name === (item.marketName || item.market)
      );
      
      if (targetMarket) {
          setSelectedMarket(targetMarket as Market);
          // Set dropdowns if possible
          const addrParts = targetMarket.address.split(' ');
          if (addrParts.length > 0 && SIDO_LIST.includes(addrParts[0])) {
              handleSidoChange(addrParts[0]);
          }
      } else {
          alert('해당 현장의 위치 정보가 등록되지 않았습니다.');
      }
  };

  const filteredMarketsForDropdown = useMemo(() => {
      if (!data?.mapData) return [];
      return data.mapData.filter((m: any) => {
          if (!m.address) return false;
          if (selectedSido && !m.address.startsWith(selectedSido)) return false;
          if (selectedSigun && !m.address.includes(selectedSigun)) return false;
          return true;
      });
  }, [data, selectedSido, selectedSigun]);

  if (!data) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-6 bg-[#0f172a]">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <Activity size={20} className="text-blue-500 animate-pulse" />
            </div>
        </div>
        <div className="text-slate-400 font-medium animate-pulse tracking-wide">AI 관제 시스템 연결 중...</div>
      </div>
    );
  }

  // Safe destructuring with default values
  const stats = data.stats || [];
  const fireEvents = data.fireEvents || [];
  const faultEvents = data.faultEvents || [];
  const commEvents = data.commEvents || [];
  const mapData = data.mapData || [];

  return (
    <div className="flex flex-col h-full text-slate-200 gap-5 pb-2">
      {/* 1. Top Control Bar (Stats & Filter) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
         <StatCard label="최근 화재 발생" value={stats[0]?.value || 0} color="bg-red-500" icon={AlertTriangle} />
         <StatCard label="최근 고장 발생" value={stats[1]?.value || 0} color="bg-orange-500" icon={BatteryWarning} />
         <StatCard label="통신 이상" value={stats[2]?.value || 0} color="bg-gray-400" icon={WifiOff} />
         
         {/* Filter Card */}
         <div className="flex flex-col justify-between bg-slate-800/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-700/50 shadow-lg relative overflow-hidden">
             {/* Decor */}
             <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 blur-2xl rounded-full pointer-events-none"></div>

             <div className="flex gap-2 relative z-10">
                 <select 
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer hover:bg-slate-800"
                    value={selectedSido}
                    onChange={(e) => handleSidoChange(e.target.value)}
                 >
                    <option value="">전국</option>
                    {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
                 <select 
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer hover:bg-slate-800"
                    value={selectedSigun}
                    onChange={(e) => setSelectedSigun(e.target.value)}
                    disabled={!selectedSido}
                 >
                    <option value="">전체</option>
                    {sigunList.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
             </div>
             
             <div className="mt-3 relative z-10">
                 <select 
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all cursor-pointer hover:bg-slate-800"
                    value=""
                    onChange={(e) => {
                        const marketId = Number(e.target.value);
                        const m = filteredMarketsForDropdown.find((mk: any) => mk.id === marketId);
                        if (m) setSelectedMarket(m);
                        e.target.value = "";
                    }}
                 >
                    <option value="" disabled>현장 바로가기</option>
                    {filteredMarketsForDropdown.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                 </select>
             </div>

             <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700/50">
                 <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400' : 'bg-green-500'} animate-pulse`}></span>
                    {lastUpdated.toLocaleTimeString()} 업데이트
                 </span>
                 <button 
                    onClick={fetchData} 
                    className={`p-1.5 rounded-full bg-slate-700/50 hover:bg-blue-600 text-slate-300 hover:text-white transition-all hover:scale-110 ${loading ? 'animate-spin text-blue-400' : ''}`}
                    title="새로고침"
                 >
                    <RefreshCw size={14} />
                 </button>
             </div>
         </div>
      </div>

      {/* 2. Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Left Side: Events Lists (Width 3/12) */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 pb-2">
            <DashboardListSection 
                title="화재 발생 로그" 
                icon={<AlertTriangle size={14} className="text-red-500"/>}
                headerStyle="border-b-red-500/30 bg-gradient-to-r from-red-900/20 via-slate-800/50 to-transparent"
                data={fireEvents}
                linkTo="/fire-history"
                onItemClick={handleMarketClick}
                renderItem={(log) => {
                    const { date, time } = formatDateTime(log.time);
                    return (
                        <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2.5">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                    <span className="text-sm font-bold text-slate-100 truncate">{log.msg}</span>
                                </div>
                                <span className="text-[10px] font-bold text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">화재</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500 pl-4 border-l border-slate-700 ml-1">
                                <span className="tracking-tighter">{date}</span>
                                <span className="font-mono text-slate-400">{time}</span>
                            </div>
                        </div>
                    );
                }}
            />

            <DashboardListSection 
                title="고장 발생 로그" 
                icon={<BatteryWarning size={14} className="text-orange-500"/>}
                headerStyle="border-b-orange-500/30 bg-gradient-to-r from-orange-900/20 via-slate-800/50 to-transparent"
                data={faultEvents}
                linkTo="/device-status"
                onItemClick={handleMarketClick}
                renderItem={(log) => {
                    const { date, time } = formatDateTime(log.time);
                    return (
                        <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></span>
                                    <span className="text-sm font-bold text-slate-200 truncate">{log.msg}</span>
                                </div>
                                <span className="text-[10px] font-bold text-orange-300 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">고장</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500 pl-4 border-l border-slate-700 ml-1">
                                <span className="tracking-tighter">{date}</span>
                                <span className="font-mono text-slate-400">{time}</span>
                            </div>
                        </div>
                    );
                }}
            />

            <DashboardListSection 
                title="통신 장애 로그" 
                icon={<WifiOff size={14} className="text-slate-400"/>}
                headerStyle="border-b-slate-500/30 bg-gradient-to-r from-slate-700/20 via-slate-800/50 to-transparent"
                data={commEvents}
                linkTo="/device-status"
                onItemClick={handleMarketClick}
                renderItem={(log) => {
                    const { date, time } = formatDateTime(log.time);
                    return (
                        <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-slate-300 font-medium">{log.address}</div>
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-1 rounded">{time}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 pl-2 border-l-2 border-slate-700 ml-1">
                                수신기: <span className="text-slate-300">{log.receiver}</span>
                            </div>
                        </div>
                    );
                }}
            />
        </div>

        {/* Right Side: Map (Width 9/12) */}
        <div className="lg:col-span-9 bg-[#1e293b] rounded-2xl overflow-hidden relative shadow-2xl border border-slate-700 flex flex-col group">
            {/* Map Overlay Controls */}
            <div className="absolute top-5 left-5 z-20 flex flex-col gap-3 pointer-events-none">
                <div className="bg-slate-900/90 backdrop-blur-md px-5 py-3 rounded-xl border border-slate-700 shadow-xl flex items-center gap-3 transform transition-transform group-hover:scale-105 origin-top-left">
                    <div className="p-2 bg-blue-500/20 rounded-full text-blue-400">
                        <MapIcon size={20} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Monitoring</div>
                        <span className="text-base font-bold text-white">실시간 전국 현황</span>
                    </div>
                </div>
                
                <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-xl pointer-events-auto w-64">
                    <div className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-wide flex justify-between">
                        <span>Status Overview</span>
                        <BarChart3 size={12}/>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-red-200 text-sm font-medium">
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                </span>
                                화재 감지
                            </div>
                            <span className="font-mono font-bold text-white">{mapData.filter((m:any) => m.status === 'Fire' || m.status === '화재').length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-orange-200 text-sm font-medium">
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></span>
                                기기 고장
                            </div>
                            <span className="font-mono font-bold text-white">{mapData.filter((m:any) => m.status === 'Error' || m.status === '고장').length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-blue-200 text-sm font-medium">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                정상 운영
                            </div>
                            <span className="font-mono font-bold text-white">{mapData.filter((m:any) => m.status === 'Normal' || m.status === '정상').length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative w-full h-full bg-[#1e293b]">
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
            </div>
            
            {/* Bottom Accent */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 opacity-50"></div>
        </div>
      </div>

      {/* Visual Console Modal */}
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