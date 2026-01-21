import React, { useState, useEffect, useRef } from 'react';
import { PageHeader, Pagination } from '../components/CommonUI';
import { AlertTriangle, WifiOff, ArrowRight, BatteryWarning, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

declare global {
  interface Window {
    kakao: any;
  }
}

// --- Mock Data Generators ---
const generateMockData = (count: number, type: 'fire' | 'fault' | 'comm') => {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    const now = new Date();
    now.setMinutes(now.getMinutes() - i * 15); // Stagger times
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 19);

    if (type === 'fire') {
      return {
        id,
        msg: `화재 감지: ${['대전광역시 서구 흥부과일', '전라남도 강진군 신세계건강원', '경상북도 상주시 B-8자매수선', '서울 성북구 길음시장', '부산 사상구 덕포시장'][i % 5]} 화재발생`,
        time: timeStr,
        location: ['대전', '전남', '경북', '서울', '부산'][i % 5]
      };
    } else if (type === 'fault') {
      return {
        id,
        msg: `중계기 ${(i % 20) + 1} 감지기 ${(i % 10) + 1} 화재감지기 배터리 이상 [${['부평 문화의 거리', '대구능금시장', '안양 중앙시장', '모래내시장', '석바위시장'][i % 5]}]`,
        time: timeStr,
      };
    } else {
      return {
        id,
        market: ['길음시장', '남부전통시장', '덕포시장', '산격종합시장', '솔매로50길 상가번영회', '오정시장', '조암시장'][i % 7],
        receiver: `01${(i + 10).toString(16).toUpperCase()}`,
        address: ['서울특별시 성북구 동소문로 227', '경상북도 포항시 남구 상공로 43', '부산광역시 사상구 사상로293번길 15', '대구광역시 북구 동북로 164', '서울특별시 강북구 도봉로46길 13', '경기도 부천시 부천로470번길 50', '경기도 화성시 우정읍 조암서로22번길 22'][i % 7],
        time: timeStr
      };
    }
  });
};

const ITEMS_PER_LIST_PAGE = 5;

// --- Sub Component: Dashboard List Section ---
const DashboardListSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  headerColorClass: string;
  data: any[];
  renderItem: (item: any) => React.ReactNode;
  linkTo: string;
}> = ({ title, icon, headerColorClass, data, renderItem, linkTo }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  
  const totalPages = Math.ceil(data.length / ITEMS_PER_LIST_PAGE);
  const currentItems = data.slice((page - 1) * ITEMS_PER_LIST_PAGE, page * ITEMS_PER_LIST_PAGE);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-sm overflow-hidden flex flex-col h-[340px]">
      <div className={`px-4 py-3 border-b border-slate-700/50 flex items-center justify-between ${headerColorClass}`}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>
        <button 
          onClick={() => navigate(linkTo)}
          className="text-white/70 hover:text-white hover:bg-white/10 p-1 rounded transition-colors"
          title="자세히 보기"
        >
          <ArrowRight size={18} />
        </button>
      </div>
      
      <div className="flex-1 overflow-hidden p-2 space-y-1">
        {currentItems.map((item) => (
           <div key={item.id} className="border-b border-slate-700/50 last:border-0 pb-2 mb-1 last:mb-0 last:pb-0">
             {renderItem(item)}
           </div>
        ))}
      </div>

      <div className="py-2 border-t border-slate-700 bg-slate-800/50">
         <Pagination 
            totalItems={data.length} 
            itemsPerPage={ITEMS_PER_LIST_PAGE} 
            currentPage={page} 
            onPageChange={setPage} 
         />
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // --- Timer State ---
  const [now, setNow] = useState(new Date());
  const [secondsLeft, setSecondsLeft] = useState(60);
  
  // --- Data State ---
  const [fireData, setFireData] = useState<any[]>([]);
  const [faultData, setFaultData] = useState<any[]>([]);
  const [commErrorData, setCommErrorData] = useState<any[]>([]);

  // --- Kakao Map ---
  const mapContainer = useRef<HTMLDivElement>(null);

  // 1. Timer Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Refresh Data Logic Here
          setNow(new Date());
          return 60; 
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 2. Initial Data Load (Mock)
  useEffect(() => {
    setFireData(generateMockData(15, 'fire'));
    setFaultData(generateMockData(20, 'fault'));
    setCommErrorData(generateMockData(12, 'comm'));
  }, [now]); // Re-generate on 'now' change (simulating refresh)

  // 3. Map Initialization
  useEffect(() => {
    // API 키가 없거나 로드되지 않았을 경우 안전 장치
    if (!window.kakao || !window.kakao.maps) {
      console.warn("Kakao Map API is not loaded.");
      return;
    }

    if (mapContainer.current) {
      const options = {
        center: new window.kakao.maps.LatLng(36.3504119, 127.3845475), // 대전 시청 부근 (대한민국 중심)
        level: 13 // 전국이 보이는 레벨
      };
      const map = new window.kakao.maps.Map(mapContainer.current, options);
      
      // 줌 컨트롤 추가
      const zoomControl = new window.kakao.maps.ZoomControl();
      map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

      // (Optional) Add some markers based on fireData
      fireData.forEach((fire: any) => {
         // Mock coords generation based on random offset from center
         const lat = 36.35 + (Math.random() - 0.5) * 3;
         const lng = 127.38 + (Math.random() - 0.5) * 2;
         const markerPosition  = new window.kakao.maps.LatLng(lat, lng); 
         
         // 마커 이미지 생성 (빨간색 경고)
         // 실제로는 이미지 URL을 사용하지만 여기서는 기본 마커 사용
         const marker = new window.kakao.maps.Marker({ position: markerPosition });
         marker.setMap(map);

         // 인포윈도우
         const iwContent = `<div style="padding:5px;color:black;font-size:12px;">${fire.location} 화재감지</div>`;
         const infowindow = new window.kakao.maps.InfoWindow({
             content : iwContent
         });
         
         window.kakao.maps.event.addListener(marker, 'mouseover', function() {
             infowindow.open(map, marker);
         });
         window.kakao.maps.event.addListener(marker, 'mouseout', function() {
             infowindow.close();
         });
      });
    }
  }, [fireData]); // Re-render map/markers when data refreshes

  const stats = [
    { label: '최근 화재 발생', value: fireData.length, color: 'bg-red-600', icon: <AlertTriangle size={24} /> },
    { label: '최근 고장 발생', value: faultData.length, color: 'bg-orange-500', icon: <BatteryWarning size={24} /> },
    { label: '통신 이상', value: commErrorData.length, color: 'bg-slate-600', icon: <WifiOff size={24} /> },
  ];

  return (
    <div className="flex flex-col h-full text-slate-200">
      <PageHeader title="대시보드" />

      {/* Top Timer Bar */}
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 mb-4 flex flex-col md:flex-row items-center justify-center text-sm md:text-base font-medium shadow-sm gap-2">
         <div className="flex items-center">
            <span className="text-slate-400 mr-2">기준 시각 :</span>
            <span className="text-white tracking-wide font-mono">
                {now.getFullYear()}-{String(now.getMonth()+1).padStart(2,'0')}-{String(now.getDate()).padStart(2,'0')} {String(now.getHours()).padStart(2,'0')}:{String(now.getMinutes()).padStart(2,'0')}:{String(now.getSeconds()).padStart(2,'0')}
            </span>
         </div>
         <div className="hidden md:block w-px h-4 bg-slate-600 mx-2"></div>
         <div className="flex items-center">
            <span className="text-blue-400 font-bold w-6 text-right mr-1">{secondsLeft}</span>
            <span className="text-slate-400">초 후 새로고침됩니다.</span>
         </div>
      </div>

      {/* Main Grid Layout (1:1 Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full pb-10">
        
        {/* --- Left Column: Lists --- */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-1 custom-scrollbar">
          
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-3">
            {stats.map((stat, idx) => (
              <div key={idx} className={`${stat.color} text-white p-4 rounded-lg text-center shadow-lg border border-white/10 flex flex-col justify-center items-center h-28 transform transition-transform hover:scale-105`}>
                <div className="mb-2 opacity-80">{stat.icon}</div>
                <div className="text-xs md:text-sm opacity-90 mb-1 font-medium">{stat.label}</div>
                <div className="text-2xl md:text-3xl font-black">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* 1. Recent Fire Occurrences */}
          <DashboardListSection 
            title="최근 화재 발생현황"
            icon={<AlertTriangle size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-red-900 to-slate-800"
            data={fireData}
            linkTo="/fire-history"
            renderItem={(item) => (
              <div className="flex flex-col gap-1 px-2 py-1.5 hover:bg-slate-700/30 rounded transition-colors cursor-pointer group">
                 <div className="flex items-start gap-2">
                    <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 mt-0.5">소방</span>
                    <span className="text-sm font-medium text-slate-200 line-clamp-1 group-hover:text-white transition-colors">{item.msg}</span>
                 </div>
                 <div className="text-xs text-slate-500 text-right group-hover:text-slate-400">{item.time}</div>
              </div>
            )}
          />

          {/* 2. Recent Fault Occurrences */}
          <DashboardListSection 
            title="최근 고장 발생현황"
            icon={<BatteryWarning size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-orange-900 to-slate-800"
            data={faultData}
            linkTo="/device-status"
            renderItem={(item) => (
              <div className="flex flex-col gap-1 px-2 py-1.5 hover:bg-slate-700/30 rounded transition-colors cursor-pointer group">
                 <div className="flex items-start gap-2">
                    <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 mt-0.5">고장</span>
                    <span className="text-sm font-medium text-slate-200 line-clamp-1 group-hover:text-white transition-colors">{item.msg}</span>
                 </div>
                 <div className="text-xs text-slate-500 text-right group-hover:text-slate-400">{item.time}</div>
              </div>
            )}
          />

          {/* 3. Communication Errors */}
          <DashboardListSection 
            title="수신기 통신 이상 내역"
            icon={<WifiOff size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-slate-700 to-slate-800"
            data={commErrorData}
            linkTo="/device-status"
            renderItem={(item) => (
              <div className="flex justify-between items-center px-2 py-2.5 hover:bg-slate-700/30 rounded transition-colors text-sm group cursor-pointer">
                 <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-slate-200 group-hover:text-white">{item.market}</span>
                    <span className="text-xs text-slate-400">{item.address}</span>
                 </div>
                 <div className="flex flex-col items-end gap-0.5">
                    <span className="text-orange-300 font-mono text-xs bg-orange-900/30 px-1.5 py-0.5 rounded">수신기: {item.receiver}</span>
                 </div>
              </div>
            )}
          />

        </div>

        {/* --- Right Column: Map --- */}
        <div className="bg-slate-900 rounded-xl overflow-hidden relative shadow-inner border border-slate-700 flex flex-col min-h-[500px] h-auto">
          {/* Map Container */}
          <div ref={mapContainer} className="w-full h-full relative z-0">
             {/* Placeholder if map fails to load */}
             <div className="absolute inset-0 flex items-center justify-center text-slate-500 bg-slate-900 -z-10">
                <div className="text-center p-4">
                   <MapPin size={48} className="mx-auto mb-4 opacity-50" />
                   <p className="mb-2 text-lg font-bold">지도 로딩 중...</p>
                   <p className="text-xs text-slate-400">카카오맵 API Key 설정을 확인해주세요.</p>
                </div>
             </div>
          </div>
          
          {/* Map Overlay Badge */}
          <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-600 px-3 py-1.5 rounded-full text-xs text-slate-300 shadow-lg">
             <span className="text-green-400 font-bold mr-1">●</span> 실시간 관제 중
          </div>
        </div>

      </div>
    </div>
  );
};
