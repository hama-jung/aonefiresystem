import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Pagination } from '../components/CommonUI';
import { AlertTriangle, WifiOff, Video, Map as MapIcon, BatteryWarning, Shield, Activity, RefreshCw, ArrowRight } from 'lucide-react';
import { DashboardAPI } from '../services/api';
import { Market } from '../types';
import { VisualMapConsole } from '../components/VisualMapConsole';
import { SIDO_LIST, getSigungu } from '../utils/addressData';

// --- 지도 좌표 데이터 (시/도 중심점) ---
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

declare global {
  interface Window {
    kakao: any;
  }
}

// --- 지도 컴포넌트 ---
const MapContainer: React.FC<{ 
  markets: any[];
  sido: string;
  onMarketSelect: (market: Market) => void;
}> = ({ markets, sido, onMarketSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [clusterer, setClusterer] = useState<any>(null);
  
  // 1. 지도 초기화
  useEffect(() => {
    if (!mapRef.current || !window.kakao) return;

    const container = mapRef.current;
    const options = {
      center: new window.kakao.maps.LatLng(36.5, 127.5),
      level: 13
    };
    const map = new window.kakao.maps.Map(container, options);
    setMapInstance(map);

    // 줌 컨트롤
    const zoomControl = new window.kakao.maps.ZoomControl();
    map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

    // 클러스터러
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

  // 2. 마커 및 이동 처리
  useEffect(() => {
    if (!mapInstance || !clusterer) return;

    clusterer.clear();

    // 필터링: 시/도가 선택되었다면 해당 지역만
    const filteredMarkets = markets.filter(m => {
        if (!m.x || !m.y) return false;
        if (sido && !m.address.startsWith(sido)) return false;
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

        // 인포윈도우 (툴팁)
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

        // 비정상 상태면 툴팁을 미리 열어둠
        if (market.status !== 'Normal') {
            infowindow.open(mapInstance, marker);
        }

        return marker;
    });

    clusterer.addMarkers(newMarkers);

    // 지도 이동
    if (sido && SIDO_COORDINATES[sido]) {
        const { lat, lng, level } = SIDO_COORDINATES[sido];
        const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
        setTimeout(() => {
            mapInstance.setLevel(level);
            mapInstance.panTo(moveLatLon);
        }, 100);
    } else {
        // 전체 보기
        mapInstance.setCenter(new window.kakao.maps.LatLng(36.5, 127.5));
        mapInstance.setLevel(13);
    }

  }, [mapInstance, markets, sido, clusterer]);

  return <div ref={mapRef} className="w-full h-full rounded-xl" />;
};

// --- 메인 대시보드 컴포넌트 ---
export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSido, setSelectedSido] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

  const navigate = useNavigate();

  // 데이터 로드
  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await DashboardAPI.getData();
      setData(result);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30초 갱신
    return () => clearInterval(interval);
  }, []);

  const handleSidoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSido(e.target.value);
  };

  if (loading || !data) {
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

  // 데이터 매핑 (API 구조 -> UI용 변수)
  const { stats, fireEvents, faultEvents, commEvents, mapData } = data;

  return (
    <div className="flex flex-col h-full text-slate-200">
      <PageHeader title="대시보드" />

      {/* 4단 그리드 레이아웃 (좌1: 패널, 우3: 지도) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
        
        {/* [Left Sidebar] Event Logs & Stats */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar pb-4">
          
          {/* 1. Stats Summary Cards */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-red-600 text-white p-3 rounded-lg text-center shadow-lg border border-red-500 hover:scale-105 transition-transform">
                <div className="text-xs opacity-90 mb-1 font-medium">화재 발생</div>
                <div className="text-2xl font-black">{stats[0]?.value || 0}</div>
            </div>
            <div className="bg-orange-500 text-white p-3 rounded-lg text-center shadow-lg border border-orange-400 hover:scale-105 transition-transform">
                <div className="text-xs opacity-90 mb-1 font-medium">고장 발생</div>
                <div className="text-2xl font-black">{stats[1]?.value || 0}</div>
            </div>
            <div className="bg-slate-600 text-white p-3 rounded-lg text-center shadow-lg border border-slate-500 hover:scale-105 transition-transform">
                <div className="text-xs opacity-90 mb-1 font-medium">통신 이상</div>
                <div className="text-2xl font-black">{stats[2]?.value || 0}</div>
            </div>
          </div>

          {/* 2. 지역 필터 (Dashboard-1에는 없었지만, 기능 유지를 위해 추가) */}
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm flex gap-2">
             <MapIcon size={18} className="text-slate-400 mt-1" />
             <select 
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                value={selectedSido}
                onChange={handleSidoChange}
             >
                <option value="">전국 보기</option>
                {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>

          {/* 3. Fire Log (화재 발생 현황) */}
          <div className="bg-slate-800 border border-red-900/50 rounded-lg shadow-sm overflow-hidden flex flex-col flex-1 min-h-[150px]">
            <div className="bg-red-900/30 px-4 py-3 border-b border-red-900/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <h3 className="text-sm font-bold text-red-200">최근 화재 발생현황</h3>
              </div>
              <button onClick={() => navigate('/fire-history')} className="text-red-400 hover:text-white transition-colors">
                  <ArrowRight size={14} />
              </button>
            </div>
            <div className="p-2 space-y-2 overflow-y-auto custom-scrollbar flex-1">
              {fireEvents.length === 0 && <div className="text-center text-slate-500 text-xs py-4">화재 내역이 없습니다.</div>}
              {fireEvents.map((log: any) => (
                <div key={log.id} className="bg-red-950/40 p-2.5 rounded border border-red-900/40 cursor-pointer hover:bg-red-900/60 transition-colors group">
                  <div className="flex justify-between items-start mb-1">
                     <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                        </span>
                        <span className="text-sm font-bold text-slate-200 group-hover:text-white">{log.msg}</span>
                     </div>
                     <span className="text-[10px] text-red-300 border border-red-800 px-1 rounded bg-red-900/50">소방</span>
                  </div>
                  <div className="text-[11px] text-slate-500 text-right font-mono">
                      {new Date(log.time).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Fault Log (고장 발생 현황) */}
          <div className="bg-slate-800 border border-orange-900/50 rounded-lg shadow-sm overflow-hidden flex flex-col flex-1 min-h-[150px]">
            <div className="bg-orange-900/30 px-4 py-3 border-b border-orange-900/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                  <BatteryWarning size={16} className="text-orange-400" />
                  <h3 className="text-sm font-bold text-orange-200">최근 고장 발생현황</h3>
              </div>
              <button onClick={() => navigate('/device-status')} className="text-orange-400 hover:text-white transition-colors">
                  <ArrowRight size={14} />
              </button>
            </div>
            <div className="p-2 space-y-2 overflow-y-auto custom-scrollbar flex-1">
              {faultEvents.length === 0 && <div className="text-center text-slate-500 text-xs py-4">고장 내역이 없습니다.</div>}
              {faultEvents.map((log: any) => (
                <div key={log.id} className="bg-orange-950/40 p-2.5 rounded border border-orange-900/40 cursor-pointer hover:bg-orange-900/60 transition-colors group">
                  <div className="flex justify-between items-start mb-1">
                     <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        <span className="text-sm font-medium text-slate-300 group-hover:text-white">{log.msg}</span>
                     </div>
                     <span className="text-[10px] text-orange-300 border border-orange-800 px-1 rounded bg-orange-900/50">고장</span>
                  </div>
                  <div className="text-[11px] text-slate-500 text-right font-mono">
                      {new Date(log.time).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Comm Error Log (통신 장애) */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[100px]">
             <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
              <WifiOff size={16} className="text-slate-400" />
              <h3 className="text-sm font-bold text-slate-300">수신기 통신 이상 내역</h3>
            </div>
            <div className="p-2 text-xs text-slate-500 text-center py-4 flex-1 flex items-center justify-center">
              {commEvents.length === 0 ? '현재 통신 이상 내역이 없습니다.' : `${commEvents.length}건의 장애가 있습니다.`}
            </div>
          </div>
        </div>

        {/* [Right Content] Map Visualization */}
        <div className="lg:col-span-3 bg-slate-900 rounded-xl overflow-hidden relative shadow-2xl border border-slate-700 flex flex-col group">
          
          {/* Map Header Controls (Overlay) */}
          <div className="absolute top-4 right-4 z-20 flex gap-2">
             <button className="bg-slate-800/90 backdrop-blur text-white px-3 py-1.5 rounded text-sm border border-slate-600 hover:bg-slate-700 shadow-lg flex items-center gap-2 transition-all">
                <MapIcon size={14} className="text-blue-400"/> 화재감지기보기
             </button>
             <button className="bg-slate-800/90 backdrop-blur text-white px-3 py-1.5 rounded text-sm border border-slate-600 hover:bg-slate-700 shadow-lg flex items-center gap-2 transition-all">
                <Video size={14} className="text-red-400"/> CCTV
             </button>
             <button onClick={fetchData} className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 shadow-lg transition-all" title="새로고침">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>

          {/* Map Status Overlay (Left Top) */}
          <div className="absolute top-4 left-4 z-20 bg-slate-900/80 backdrop-blur p-3 rounded-lg border border-slate-700 shadow-lg pointer-events-none">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Live Status</div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  실시간 모니터링 중
              </div>
              <div className="mt-2 text-xs text-slate-400">
                  {selectedSido ? `${selectedSido} 지역 관제` : '전국 17개 시/도 관제'}
              </div>
          </div>

          {/* Map Visualization Area */}
          <div className="flex-1 relative w-full h-full bg-[#1e293b]">
             <MapContainer 
                markets={mapData}
                sido={selectedSido}
                onMarketSelect={(m) => setSelectedMarket(m)}
             />
          </div>
          
          {/* Bottom Accent Line */}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 opacity-50"></div>
        </div>
      </div>

      {/* Visual Console Modal (When market is selected) */}
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