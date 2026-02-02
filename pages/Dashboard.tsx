import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/CommonUI';
import { AlertTriangle, WifiOff, Video, Map as MapIcon, BatteryWarning, ArrowRight } from 'lucide-react';
import { DashboardAPI } from '../services/api';
import { Market } from '../types';
import { VisualMapConsole } from '../components/VisualMapConsole';

declare global {
  interface Window {
    kakao: any;
  }
}

// --- [Component] 화재 발생 경보 모달 (Fire Alert Overlay) ---
const FireAlertOverlay: React.FC<{ fireEvents: any[] }> = ({ fireEvents }) => {
  if (!fireEvents || fireEvents.length === 0) return null;

  // 가장 최근 화재 건 표시
  const latestFire = fireEvents[0];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-950/90 backdrop-blur-sm animate-pulse-slow">
      <div className="flex flex-col items-center justify-center p-10 border-4 border-red-500 rounded-3xl bg-red-900 shadow-2xl animate-bounce-slight">
        <AlertTriangle size={120} className="text-white mb-6 animate-pulse" />
        <h1 className="text-6xl font-black text-white mb-4 tracking-tighter">화재 발생</h1>
        <div className="bg-white text-red-700 px-8 py-4 rounded-xl font-bold text-3xl mb-4 shadow-lg">
           {latestFire.msg}
        </div>
        <p className="text-red-200 text-xl font-medium animate-pulse">
           즉시 현장을 확인하고 조치하시기 바랍니다.
        </p>
        <p className="text-red-300/70 text-sm mt-8">
           * 현장 수신기에서 복구 신호 수신 시 이 화면은 자동으로 사라집니다.
        </p>
      </div>
    </div>
  );
};

// --- [Component] 실제 지도 (Kakao Map) ---
const MapContainer: React.FC<{ 
  markets: any[];
  focusLocation: { lat: number, lng: number } | null;
  onMarketSelect: (market: Market) => void;
}> = ({ markets, focusLocation, onMarketSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [overlays, setOverlays] = useState<any[]>([]);
  
  // 1. 지도 초기화
  useEffect(() => {
    if (!mapRef.current || !window.kakao) return;

    const container = mapRef.current;
    const options = {
      center: new window.kakao.maps.LatLng(36.5, 127.8), // 대한민국 중심
      level: 13
    };
    const map = new window.kakao.maps.Map(container, options);
    setMapInstance(map);

    // 줌 컨트롤 추가
    const zoomControl = new window.kakao.maps.ZoomControl();
    map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
  }, []);

  // 2. 마커 렌더링 (CustomOverlay)
  useEffect(() => {
    if (!mapInstance) return;

    // 기존 오버레이 제거
    overlays.forEach(overlay => overlay.setMap(null));
    const newOverlays: any[] = [];

    markets.forEach((market) => {
        if (!market.x || !market.y) return;

        const position = new window.kakao.maps.LatLng(market.x, market.y);
        
        // 상태별 스타일 정의
        let iconName = 'check_circle';
        let bgColor = 'bg-green-600';
        let isFire = false;

        if (market.status === 'Fire' || market.status === '화재') {
             iconName = 'local_fire_department';
             bgColor = 'bg-red-600';
             isFire = true;
        } else if (market.status === 'Error' || market.status === '고장') {
             iconName = 'error_outline';
             bgColor = 'bg-orange-500';
        }

        // HTML Content
        const content = document.createElement('div');
        content.className = 'relative flex items-center justify-center group cursor-pointer';
        content.onclick = () => onMarketSelect(market);
        
        content.innerHTML = `
            ${isFire ? '<div class="absolute w-14 h-14 bg-red-500 rounded-full animate-ping opacity-75"></div>' : ''}
            
            <div class="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${bgColor} transition-transform group-hover:scale-110">
               <span class="material-icons text-white text-lg ${isFire ? 'animate-pulse' : ''}">${iconName}</span>
            </div>

            <div class="absolute bottom-11 left-1/2 -translate-x-1/2 w-max px-3 py-1.5 bg-slate-900/90 border border-slate-600 rounded text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
               <div class="font-bold">${market.name}</div>
               <div class="text-[10px] text-slate-400 mt-0.5">${market.status === 'Normal' ? '정상 운영' : market.status}</div>
               <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900/90"></div>
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
  }, [mapInstance, markets]);

  // 3. 포커스 이동
  useEffect(() => {
    if (mapInstance && focusLocation) {
        const moveLatLon = new window.kakao.maps.LatLng(focusLocation.lat, focusLocation.lng);
        mapInstance.setLevel(4);
        mapInstance.panTo(moveLatLon);
    }
  }, [focusLocation, mapInstance]);

  return <div ref={mapRef} className="w-full h-full rounded-xl bg-slate-900" />;
};

// --- [Page] 메인 대시보드 ---
export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [focusLocation, setFocusLocation] = useState<{lat: number, lng: number} | null>(null);

  const navigate = useNavigate();

  const fetchData = async () => {
    // setLoading(true); // 깜빡임 방지를 위해 초기 로드 외에는 로딩 표시 생략
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
    fetchData(); // 초기 로드
    const interval = setInterval(fetchData, 5000); // 5초마다 갱신 (실시간성 강화)
    return () => clearInterval(interval);
  }, []);

  const handleLogClick = (marketId: number) => {
      if (!data || !data.mapData) return;
      const target = data.mapData.find((m: any) => m.id === marketId);
      if (target && target.x && target.y) {
          setFocusLocation({ lat: target.x, lng: target.y });
      } else {
          alert("해당 현장의 위치 정보가 없습니다.");
      }
  };

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f172a]">
        <div className="text-slate-500 font-bold animate-pulse">시스템 데이터 로딩 중...</div>
      </div>
    );
  }

  const { stats, fireEvents, faultEvents, commEvents, mapData } = data;

  return (
    <div className="flex flex-col h-full text-slate-200 relative">
      
      {/* 1. 화재 경보 모달 (최상위) */}
      <FireAlertOverlay fireEvents={fireEvents} />

      <PageHeader title="대시보드" />

      {/* 2. 메인 레이아웃 (좌:우 = 1:3 분할) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
        
        {/* [Left Sidebar] 통계 및 로그 패널 */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* (1) Stats Summary Cards */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {stats.map((stat: any, idx: number) => (
              <div key={idx} className={`${stat.color} text-white p-2 rounded text-center shadow-md border border-white/10 hover:scale-105 transition-transform`}>
                <div className="text-xs opacity-80 mb-1">{stat.label}</div>
                <div className="text-xl font-bold">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* (2) Fire Log Panel */}
          <div className="bg-slate-800 border border-red-900/50 rounded-lg shadow-sm overflow-hidden flex flex-col flex-1 min-h-[150px]">
            <div className="bg-red-900/30 px-3 py-2 border-b border-red-900/50 flex justify-between items-center">
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
                <div 
                    key={log.id} 
                    onClick={() => handleLogClick(log.marketId)}
                    className="bg-red-950/40 p-2 rounded border border-red-900/40 cursor-pointer hover:bg-red-900/60 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                     <span className="bg-red-600 text-white text-[10px] px-1 rounded animate-pulse">소방</span>
                     <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate">{log.msg}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 text-right">{new Date(log.time).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* (3) Fault Log Panel */}
          <div className="bg-slate-800 border border-orange-900/50 rounded-lg shadow-sm overflow-hidden flex flex-col flex-1 min-h-[150px]">
            <div className="bg-orange-900/30 px-3 py-2 border-b border-orange-900/50 flex justify-between items-center">
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
                <div 
                    key={log.id} 
                    onClick={() => handleLogClick(log.marketId)}
                    className="bg-orange-950/40 p-2 rounded border border-orange-900/40 cursor-pointer hover:bg-orange-900/60 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                     <span className="bg-orange-600 text-white text-[10px] px-1 rounded">고장</span>
                     <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate">{log.msg}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 text-right">{new Date(log.time).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* (4) Comm Error Log Panel */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-sm overflow-hidden flex-shrink-0">
             <div className="bg-slate-700/50 px-3 py-2 border-b border-slate-700 flex items-center gap-2">
              <WifiOff size={16} className="text-slate-400" />
              <h3 className="text-sm font-bold text-slate-300">수신기 통신 이상 내역</h3>
            </div>
            <div className="p-2 text-xs text-slate-500 text-center py-4">
              {commEvents.length === 0 ? '현재 통신 이상 내역이 없습니다.' : `${commEvents.length}건의 통신 장애가 있습니다.`}
            </div>
          </div>
        </div>

        {/* [Right Content] 지도 영역 */}
        <div className="lg:col-span-3 bg-slate-900 rounded-xl overflow-hidden relative shadow-inner border border-slate-700 flex flex-col group">
          
          {/* Map Header Controls (Overlay) */}
          <div className="absolute top-4 right-4 z-20 flex gap-2">
             <button className="bg-slate-800 text-white px-3 py-1 rounded text-sm border border-slate-600 hover:bg-slate-700 shadow-md flex items-center gap-2 transition-all">
                <MapIcon size={14}/> 화재감지기보기
             </button>
             <button className="bg-slate-800 text-white px-3 py-1 rounded text-sm border border-slate-600 hover:bg-slate-700 shadow-md flex items-center gap-2 transition-all">
                <Video size={14}/> CCTV
             </button>
          </div>

          {/* Map Logic */}
          <div className="flex-1 relative w-full h-full bg-[#1e293b]">
             <MapContainer 
                markets={mapData}
                focusLocation={focusLocation}
                onMarketSelect={(m) => setSelectedMarket(m)}
             />
          </div>
        </div>
      </div>

      {/* Visual Map Console Modal (현장 클릭 시 상세 보기) */}
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