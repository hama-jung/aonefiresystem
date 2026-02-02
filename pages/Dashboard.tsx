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

// --- Real Map Component ---
const MapContainer: React.FC<{ 
  markets: any[];
  focusLocation: { lat: number, lng: number } | null;
  onMarketSelect: (market: Market) => void;
}> = ({ markets, focusLocation, onMarketSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [overlays, setOverlays] = useState<any[]>([]);
  
  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current || !window.kakao) return;

    const container = mapRef.current;
    const options = {
      center: new window.kakao.maps.LatLng(36.5, 127.8), // Default Center (Korea)
      level: 13
    };
    const map = new window.kakao.maps.Map(container, options);
    setMapInstance(map);

    // Zoom Control
    const zoomControl = new window.kakao.maps.ZoomControl();
    map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
  }, []);

  // 2. Render Markers (CustomOverlay with Google Icons)
  useEffect(() => {
    if (!mapInstance) return;

    // Clear existing overlays
    overlays.forEach(overlay => overlay.setMap(null));
    const newOverlays: any[] = [];

    markets.forEach((market) => {
        // Validation for Lat/Lng
        if (!market.x || !market.y) return;

        const position = new window.kakao.maps.LatLng(market.x, market.y);
        
        // Define Styles based on Status
        let iconName = 'check_circle';
        let bgColor = 'bg-green-600';
        let borderColor = 'border-green-400';
        let isFire = false;
        let animateClass = '';

        if (market.status === 'Fire' || market.status === '화재') {
             iconName = 'local_fire_department';
             bgColor = 'bg-red-600';
             borderColor = 'border-red-400';
             isFire = true;
             animateClass = 'animate-pulse';
        } else if (market.status === 'Error' || market.status === '고장') {
             iconName = 'error_outline';
             bgColor = 'bg-orange-500';
             borderColor = 'border-orange-300';
        }

        // HTML Content for CustomOverlay
        const content = document.createElement('div');
        content.className = 'relative flex items-center justify-center group cursor-pointer';
        content.onclick = () => onMarketSelect(market);
        
        content.innerHTML = `
            ${isFire ? '<div class="absolute w-14 h-14 bg-red-500 rounded-full animate-ping opacity-75"></div>' : ''}
            
            <!-- Icon Circle -->
            <div class="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${bgColor} transition-transform group-hover:scale-110">
               <span class="material-icons text-white text-lg ${isFire ? 'animate-pulse' : ''}">${iconName}</span>
            </div>

            <!-- Tooltip (Hover) -->
            <div class="absolute bottom-11 left-1/2 -translate-x-1/2 w-max px-3 py-1.5 bg-slate-900/90 border border-slate-600 rounded text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
               <div class="font-bold">${market.name}</div>
               <div class="text-[10px] text-slate-400 mt-0.5">${market.status === 'Normal' ? '정상 운영' : market.status}</div>
               <!-- Arrow -->
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

  // 3. Move Map on Focus
  useEffect(() => {
    if (mapInstance && focusLocation) {
        const moveLatLon = new window.kakao.maps.LatLng(focusLocation.lat, focusLocation.lng);
        mapInstance.setLevel(4); // Zoom in
        mapInstance.panTo(moveLatLon);
    }
  }, [focusLocation, mapInstance]);

  return <div ref={mapRef} className="w-full h-full rounded-xl bg-slate-900" />;
};

// --- Main Dashboard Component ---
export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [focusLocation, setFocusLocation] = useState<{lat: number, lng: number} | null>(null);

  const navigate = useNavigate();

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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogClick = (marketId: number) => {
      // Find market by ID to get coordinates
      if (!data || !data.mapData) return;
      const target = data.mapData.find((m: any) => m.id === marketId);
      if (target && target.x && target.y) {
          setFocusLocation({ lat: target.x, lng: target.y });
      } else {
          alert("해당 현장의 위치 정보가 없습니다.");
      }
  };

  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-500 font-bold animate-pulse">데이터를 불러오는 중입니다...</div>
      </div>
    );
  }

  const { stats, fireEvents, faultEvents, commEvents, mapData } = data;

  return (
    <div className="flex flex-col h-full text-slate-200">
      <PageHeader title="대시보드" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
        
        {/* [Left Sidebar] 유지 (Dashboard-1.tsx 스타일) */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {stats.map((stat: any, idx: number) => (
              <div key={idx} className={`${stat.color} text-white p-2 rounded text-center shadow-md border border-white/10 hover:scale-105 transition-transform`}>
                <div className="text-xs opacity-80 mb-1">{stat.label}</div>
                <div className="text-xl font-bold">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Fire Log */}
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

          {/* Fault Log */}
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

          {/* Comm Error Log */}
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

        {/* [Right Content] Map Visualization - Dashboard-1.tsx style Container */}
        <div className="lg:col-span-3 bg-slate-900 rounded-xl overflow-hidden relative shadow-inner border border-slate-700 flex flex-col group">
          {/* Map Header Controls (Overlay - Dashboard-1.tsx Style) */}
          <div className="absolute top-4 right-4 z-20 flex gap-2">
             <button className="bg-slate-800 text-white px-3 py-1 rounded text-sm border border-slate-600 hover:bg-slate-700 shadow-md flex items-center gap-2">
                <MapIcon size={14}/> 화재감지기보기
             </button>
             <button className="bg-slate-800 text-white px-3 py-1 rounded text-sm border border-slate-600 hover:bg-slate-700 shadow-md flex items-center gap-2">
                <Video size={14}/> CCTV
             </button>
          </div>

          {/* Real Map Area */}
          <div className="flex-1 relative w-full h-full bg-[#1e293b]">
             <MapContainer 
                markets={mapData}
                focusLocation={focusLocation}
                onMarketSelect={(m) => setSelectedMarket(m)}
             />
          </div>
        </div>
      </div>

      {/* Visual Map Console Modal (When market is selected) */}
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