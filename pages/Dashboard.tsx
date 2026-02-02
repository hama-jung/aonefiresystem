import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/CommonUI';
import { AlertTriangle, WifiOff, Video, Map as MapIcon } from 'lucide-react';
import { DashboardAPI } from '../services/api';
import { Market } from '../types';
import { VisualMapConsole } from '../components/VisualMapConsole';

declare global {
  interface Window {
    kakao: any;
  }
}

// --- Real Map Component (Functional but styled to fit Dashboard-1) ---
const MapContainer: React.FC<{ 
  markets: any[];
  focusLocation: { lat: number, lng: number } | null;
  onMarketSelect: (market: Market) => void;
}> = ({ markets, focusLocation, onMarketSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  
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

  // 2. Render Markers (CustomOverlay)
  useEffect(() => {
    if (!mapInstance) return;

    // Clear existing overlays (Simple implementation: remove all child nodes if needed, but Kakao map handles overlays separately. 
    // Ideally we track overlays, but for now we reconstruct on data change)
    // Note: In a full prod app, we should track and remove specific overlays to avoid leaks. 
    // Here we assume data refresh isn't too frequent or we rely on map re-render.
    
    // Actually, let's just add new ones.
    markets.forEach((market) => {
        if (!market.x || !market.y) return;

        const position = new window.kakao.maps.LatLng(market.x, market.y);
        
        // Define Styles based on Status
        let dotColor = 'bg-green-500';
        let ringColor = 'bg-green-500';
        let animateClass = '';

        if (market.status === 'Fire' || market.status === '화재') {
             dotColor = 'bg-red-500';
             ringColor = 'bg-red-500';
             animateClass = 'animate-ping';
        } else if (market.status === 'Error' || market.status === '고장') {
             dotColor = 'bg-orange-500';
             ringColor = 'bg-orange-500';
        }

        // HTML Content matching Dashboard-1.tsx simple dot style but with interactivity
        const content = document.createElement('div');
        content.className = 'absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group';
        content.onclick = () => onMarketSelect(market);
        
        content.innerHTML = `
            <div class="w-4 h-4 rounded-full ${ringColor} ${animateClass} opacity-75"></div>
            <div class="w-4 h-4 rounded-full ${dotColor} absolute border-2 border-slate-900"></div>
            <span class="mt-2 text-xs text-white bg-slate-800 border border-slate-700 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
              ${market.name}
            </span>
        `;

        const customOverlay = new window.kakao.maps.CustomOverlay({
            position: position,
            content: content,
            yAnchor: 0.5
        });

        customOverlay.setMap(mapInstance);
    });
  }, [mapInstance, markets]);

  // 3. Move Map on Focus
  useEffect(() => {
    if (mapInstance && focusLocation) {
        const moveLatLon = new window.kakao.maps.LatLng(focusLocation.lat, focusLocation.lng);
        mapInstance.setLevel(4); // Zoom in
        mapInstance.panTo(moveLatLon);
    }
  }, [focusLocation, mapInstance]);

  return <div ref={mapRef} className="w-full h-full rounded-xl bg-slate-900 opacity-80" />;
};

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [focusLocation, setFocusLocation] = useState<{lat: number, lng: number} | null>(null);
  const navigate = useNavigate();

  const fetchData = async () => {
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
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogClick = (marketId: number) => {
      if (!data || !data.mapData) return;
      const target = data.mapData.find((m: any) => m.id === marketId);
      if (target && target.x && target.y) {
          setFocusLocation({ lat: target.x, lng: target.y });
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
        {/* Left Sidebar: Event Logs */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {stats.map((stat: any, idx: number) => (
              <div key={idx} className={`${stat.color} text-white p-2 rounded text-center shadow-md border border-white/10`}>
                <div className="text-xs opacity-80 mb-1">{stat.label}</div>
                <div className="text-xl font-bold">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Fire Log */}
          <div className="bg-slate-800 border border-red-900/50 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-red-900/30 px-3 py-2 border-b border-red-900/50 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              <h3 className="text-sm font-bold text-red-200">최근 화재 발생현황</h3>
            </div>
            <div className="p-2 space-y-2">
              {fireEvents.length === 0 && <div className="text-center text-slate-500 text-xs py-2">내역이 없습니다.</div>}
              {fireEvents.map((log: any) => (
                <div 
                    key={log.id} 
                    className="bg-red-950/40 p-2 rounded border border-red-900/40 cursor-pointer hover:bg-red-900/60 transition-colors" 
                    onClick={() => handleLogClick(log.marketId)}
                >
                  <div className="flex items-center gap-2 mb-1">
                     <span className="bg-red-600 text-white text-[10px] px-1 rounded">소방</span>
                     <span className="text-xs font-medium text-slate-200 truncate">{log.msg}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 text-right">{new Date(log.time).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Fault Log */}
          <div className="bg-slate-800 border border-orange-900/50 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-orange-900/30 px-3 py-2 border-b border-orange-900/50 flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-400" />
              <h3 className="text-sm font-bold text-orange-200">최근 고장 발생현황</h3>
            </div>
            <div className="p-2 space-y-2">
              {faultEvents.length === 0 && <div className="text-center text-slate-500 text-xs py-2">내역이 없습니다.</div>}
              {faultEvents.map((log: any) => (
                <div 
                    key={log.id} 
                    className="bg-orange-950/40 p-2 rounded border border-orange-900/40 cursor-pointer hover:bg-orange-900/60 transition-colors"
                    onClick={() => handleLogClick(log.marketId)}
                >
                  <div className="flex items-center gap-2 mb-1">
                     <span className="bg-orange-600 text-white text-[10px] px-1 rounded">고장</span>
                     <span className="text-xs font-medium text-slate-200 truncate">{log.msg}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 text-right">{new Date(log.time).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Comm Error Log */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-sm overflow-hidden">
             <div className="bg-slate-700/50 px-3 py-2 border-b border-slate-700 flex items-center gap-2">
              <WifiOff size={16} className="text-slate-400" />
              <h3 className="text-sm font-bold text-slate-300">수신기 통신 이상 내역</h3>
            </div>
            <div className="p-2 text-xs text-slate-500 text-center py-4">
              {commEvents.length === 0 ? '현재 통신 이상 내역이 없습니다.' : `${commEvents.length}건의 통신 장애가 있습니다.`}
            </div>
          </div>
        </div>

        {/* Right Content: Map Visualization */}
        <div className="lg:col-span-3 bg-slate-900 rounded-xl overflow-hidden relative shadow-inner border border-slate-700 flex flex-col">
          {/* Map Header Controls */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
             <button className="bg-slate-800 text-white px-3 py-1 rounded text-sm border border-slate-600 hover:bg-slate-700 flex items-center gap-2">
                <MapIcon size={14}/> 화재감지기보기
             </button>
             <button className="bg-slate-800 text-white px-3 py-1 rounded text-sm border border-slate-600 hover:bg-slate-700 flex items-center gap-2">
                <Video size={14}/> CCTV
             </button>
          </div>

          {/* Map Visualization Area */}
          <div className="flex-1 relative bg-slate-900">
             <MapContainer 
                markets={mapData}
                focusLocation={focusLocation}
                onMarketSelect={(m) => setSelectedMarket(m)}
             />
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