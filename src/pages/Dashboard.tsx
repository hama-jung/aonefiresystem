import React, { useState, useEffect, useRef } from 'react';
import { PageHeader, Pagination } from '../components/CommonUI';
import { AlertTriangle, WifiOff, ArrowRight, BatteryWarning, MapPin, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SIDO_LIST, getSigungu } from '../utils/addressData';

declare global {
  interface Window {
    kakao: any;
  }
}

// --- Mock Data Generators ---
const generateMockData = (count: number, type: 'fire' | 'fault' | 'comm') => {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    // 시간 생성 (최근 시간부터 역순)
    const date = new Date();
    date.setMinutes(date.getMinutes() - i * 45); 
    const timeStr = date.toISOString().replace('T', ' ').substring(0, 19);

    if (type === 'fire') {
      const locations = ['대전광역시 서구 흥부과일', '전라남도 강진군 신세계건강원', '경상북도 상주시 B-8자매수선', '서울 성북구 길음시장', '부산 사상구 덕포시장'];
      return {
        id,
        msg: `${locations[i % locations.length]} 화재 감지`,
        time: timeStr,
        location: ['대전', '전남', '경북', '서울', '부산'][i % 5]
      };
    } else if (type === 'fault') {
      const markets = ['부평 문화의 거리', '대구능금시장', '안양 중앙시장', '모래내시장', '석바위시장'];
      return {
        id,
        msg: `중계기 ${(i % 10) + 1} 감지기 ${(i % 20) + 1} 배터리 이상 [${markets[i % markets.length]}]`,
        time: timeStr,
      };
    } else {
      const markets = ['길음시장', '남부전통시장', '덕포시장', '산격종합시장', '솔매로50길 상가번영회', '오정시장', '조암시장'];
      const addrs = ['서울특별시 성북구 동소문로 227', '경상북도 포항시 남구 상공로 43', '부산광역시 사상구 사상로', '대구광역시 북구 동북로', '서울특별시 강북구 도봉로', '경기도 부천시 부천로', '경기도 화성시 우정읍'];
      return {
        id,
        market: markets[i % markets.length],
        receiver: `01${(i + 10).toString(16).toUpperCase()}`,
        address: addrs[i % addrs.length],
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
  
  // 데이터 슬라이싱
  const currentItems = data.slice((page - 1) * ITEMS_PER_LIST_PAGE, page * ITEMS_PER_LIST_PAGE);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-sm overflow-hidden flex flex-col h-[320px]">
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
      
      <div className="flex-1 overflow-hidden p-2 space-y-1">
        {currentItems.map((item) => (
           <div key={item.id} className="border-b border-slate-700/50 last:border-0 pb-1 mb-1 last:mb-0 last:pb-0">
             {renderItem(item)}
           </div>
        ))}
        {currentItems.length === 0 && (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                데이터가 없습니다.
            </div>
        )}
      </div>

      <div className="py-2 border-t border-slate-700 bg-slate-800/50 min-h-[40px] flex items-center justify-center">
         {data.length > ITEMS_PER_LIST_PAGE && (
             <Pagination 
                totalItems={data.length} 
                itemsPerPage={ITEMS_PER_LIST_PAGE} 
                currentPage={page} 
                onPageChange={setPage} 
             />
         )}
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  // --- Timer State ---
  const [now, setNow] = useState(new Date());
  const [secondsLeft, setSecondsLeft] = useState(60);
  
  // --- Data State ---
  const [fireData, setFireData] = useState<any[]>([]);
  const [faultData, setFaultData] = useState<any[]>([]);
  const [commErrorData, setCommErrorData] = useState<any[]>([]);

  // --- Map State ---
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
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

  // 2. Data Load (Mock)
  useEffect(() => {
    setFireData(generateMockData(12, 'fire'));
    setFaultData(generateMockData(25, 'fault'));
    setCommErrorData(generateMockData(8, 'comm'));
  }, [now]); // now가 바뀔 때마다 데이터 갱신

  // 3. Map Initialization
  useEffect(() => {
    if (!window.kakao || !window.kakao.maps) {
      return;
    }

    if (mapContainer.current && !mapInstance) {
      const options = {
        center: new window.kakao.maps.LatLng(36.3504119, 127.3845475), // 대전 시청 부근 (대한민국 중심)
        level: 13 // 전국이 보이는 레벨
      };
      const map = new window.kakao.maps.Map(mapContainer.current, options);
      
      // 줌 컨트롤 추가
      const zoomControl = new window.kakao.maps.ZoomControl();
      map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
      
      setMapInstance(map);
    }
  }, []);

  // 4. Map Markers Update
  useEffect(() => {
    if (mapInstance && fireData.length > 0) {
        // 기존 마커 제거 로직은 생략 (간소화)
        fireData.slice(0, 5).forEach((fire: any) => {
            const lat = 36.35 + (Math.random() - 0.5) * 2;
            const lng = 127.38 + (Math.random() - 0.5) * 2;
            const markerPosition  = new window.kakao.maps.LatLng(lat, lng); 
            
            const marker = new window.kakao.maps.Marker({ position: markerPosition });
            marker.setMap(mapInstance);

            const iwContent = `<div style="padding:5px;color:black;font-size:12px;">${fire.location} 화재감지</div>`;
            const infowindow = new window.kakao.maps.InfoWindow({
                content : iwContent
            });
            
            window.kakao.maps.event.addListener(marker, 'mouseover', function() {
                infowindow.open(mapInstance, marker);
            });
            window.kakao.maps.event.addListener(marker, 'mouseout', function() {
                infowindow.close();
            });
        });
    }
  }, [mapInstance, fireData]);

  // 상단 타이머 JSX
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

  const stats = [
    { label: '최근 화재 발생', value: fireData.length, color: 'bg-red-600', icon: <AlertTriangle size={20} /> },
    { label: '최근 고장 발생', value: faultData.length, color: 'bg-orange-500', icon: <BatteryWarning size={20} /> },
    { label: '통신 이상', value: commErrorData.length, color: 'bg-slate-600', icon: <WifiOff size={20} /> },
  ];

  return (
    <div className="flex flex-col h-full text-slate-200">
      {/* Header with Timer (Right Content) */}
      <PageHeader title="대시보드" rightContent={timerContent} />

      {/* Main Grid Layout (1:1 Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full pb-10">
        
        {/* --- Left Column: Lists --- */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
          
          {/* Stats Summary (Compact Horizontal Cards) */}
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

          {/* 1. Recent Fire Occurrences (1-line item) */}
          <DashboardListSection 
            title="최근 화재 발생현황"
            icon={<AlertTriangle size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-red-900 to-slate-800"
            data={fireData}
            linkTo="/fire-history"
            renderItem={(item) => (
              <div className="flex items-center justify-between px-2 py-2 hover:bg-slate-700/30 rounded transition-colors cursor-pointer group text-sm">
                 <div className="flex items-center gap-2 min-w-0">
                    <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0">소방</span>
                    <span className="font-medium text-slate-200 truncate group-hover:text-white transition-colors" title={item.msg}>{item.msg}</span>
                 </div>
                 <div className="text-xs text-slate-500 shrink-0 ml-2 font-mono group-hover:text-slate-400">{item.time}</div>
              </div>
            )}
          />

          {/* 2. Recent Fault Occurrences (1-line item) */}
          <DashboardListSection 
            title="최근 고장 발생현황"
            icon={<BatteryWarning size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-orange-900 to-slate-800"
            data={faultData}
            linkTo="/device-status"
            renderItem={(item) => (
              <div className="flex items-center justify-between px-2 py-2 hover:bg-slate-700/30 rounded transition-colors cursor-pointer group text-sm">
                 <div className="flex items-center gap-2 min-w-0">
                    <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0">고장</span>
                    <span className="font-medium text-slate-200 truncate group-hover:text-white transition-colors" title={item.msg}>{item.msg}</span>
                 </div>
                 <div className="text-xs text-slate-500 shrink-0 ml-2 font-mono group-hover:text-slate-400">{item.time}</div>
              </div>
            )}
          />

          {/* 3. Communication Errors (1-line item) */}
          <DashboardListSection 
            title="수신기 통신 이상 내역"
            icon={<WifiOff size={18} className="text-white" />}
            headerColorClass="bg-gradient-to-r from-slate-700 to-slate-800"
            data={commErrorData}
            linkTo="/device-status"
            renderItem={(item) => (
              <div className="flex items-center justify-between px-2 py-2 hover:bg-slate-700/30 rounded transition-colors text-sm group cursor-pointer">
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

        {/* --- Right Column: Map (Full Height of Left Column content approx) --- */}
        <div className="bg-slate-900 rounded-xl overflow-hidden relative shadow-inner border border-slate-700 flex flex-col min-h-[600px] lg:h-auto">
          {/* Map Controls (Top Bar) */}
          <div className="absolute top-0 left-0 right-0 z-20 p-3 flex gap-2 bg-gradient-to-b from-slate-900/90 to-transparent pointer-events-none">
             {/* Dropdowns & Search (Pointer events enabled) */}
             <div className="flex gap-2 w-full max-w-2xl pointer-events-auto">
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
                        placeholder="시장명 검색"
                        className="w-full bg-slate-800 text-white text-xs border border-slate-600 rounded pl-2 pr-8 py-1.5 focus:outline-none focus:border-blue-500 shadow-lg placeholder-slate-500"
                        value={searchMarketMap}
                        onChange={(e) => setSearchMarketMap(e.target.value)}
                    />
                    <Search size={14} className="absolute right-2 top-2 text-slate-400" />
                </div>
             </div>
          </div>

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
          
          {/* Map Overlay Badge (Bottom Left) */}
          <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-600 px-3 py-1.5 rounded-full text-xs text-slate-300 shadow-lg flex items-center gap-2">
             <span className="relative flex h-3 w-3">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
             </span>
             실시간 관제 중
          </div>
        </div>

      </div>
    </div>
  );
};
