import React, { useState, useEffect, useRef } from 'react';
import { PageHeader, Pagination } from '../components/CommonUI';
import { AlertTriangle, WifiOff, ArrowRight, BatteryWarning, MapPin, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SIDO_LIST, getSigungu } from '../utils/addressData';
import { MarketAPI } from '../services/api'; // MarketAPI 추가
import { Market } from '../types';

declare global {
  interface Window {
    kakao: any;
  }
}

// --- Mock Data Generators (Event Logs) ---
const generateMockData = (count: number, type: 'fire' | 'fault' | 'comm') => {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    const date = new Date();
    date.setMinutes(date.getMinutes() - i * 45); 
    const timeStr = date.toISOString().replace('T', ' ').substring(0, 19);

    if (type === 'fire') {
      // 시장 목록에 있는 시장을 우선적으로 매칭
      const markets = ['대전중앙시장', '부평자유시장', '서울광장시장', '부산자갈치시장'];
      return {
        id,
        msg: `${markets[i % markets.length]} A동 10${i}호 화재 감지`,
        time: timeStr,
        marketName: markets[i % markets.length], // 매핑용 이름
      };
    } else if (type === 'fault') {
      const markets = ['부평자유시장', '대구서문시장', '서울광장시장'];
      return {
        id,
        msg: `중계기 ${(i % 10) + 1} 감지기 배터리 이상 [${markets[i % markets.length]}]`,
        time: timeStr,
      };
    } else {
      const markets = ['대전중앙시장', '부산자갈치시장'];
      return {
        id,
        market: markets[i % markets.length],
        receiver: `01${(i + 10).toString(16).toUpperCase()}`,
        address: '통신 상태 점검 필요',
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
  onItemClick?: (item: any) => void; // 클릭 이벤트 추가
}> = ({ title, icon, headerColorClass, data, renderItem, linkTo, onItemClick }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  
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
           <div 
             key={item.id} 
             onClick={() => onItemClick && onItemClick(item)} // Row Click
             className={`border-b border-slate-700/50 last:border-0 pb-1 mb-1 last:mb-0 last:pb-0 ${onItemClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
           >
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
  const [markets, setMarkets] = useState<Market[]>([]); // 시장 데이터 상태

  // --- Map State ---
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]); // 마커 관리
  const [infowindows, setInfowindows] = useState<any[]>([]); // 인포윈도우 관리

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

  // 2. Data Load (Mock + API)
  useEffect(() => {
    // 이벤트 로그 데이터 생성
    setFireData(generateMockData(2, 'fire')); // 화재 데이터 적게 설정하여 집중
    setFaultData(generateMockData(15, 'fault'));
    setCommErrorData(generateMockData(5, 'comm'));

    // 시장 데이터 로드 (API)
    const loadMarkets = async () => {
        try {
            const data = await MarketAPI.getList();
            setMarkets(data);
        } catch (e) {
            console.error("Failed to load markets for map");
        }
    };
    loadMarkets();
  }, [now]);

  // 3. Map Initialization
  useEffect(() => {
    if (!window.kakao || !window.kakao.maps) {
      return;
    }

    if (mapContainer.current && !mapInstance) {
      const options = {
        center: new window.kakao.maps.LatLng(36.3504119, 127.3845475), // 대전 시청 부근 (대한민국 중심)
        level: 13 
      };
      const map = new window.kakao.maps.Map(mapContainer.current, options);
      
      const zoomControl = new window.kakao.maps.ZoomControl();
      map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
      
      setMapInstance(map);
    }
  }, []);

  // 4. Map Markers Update (Based on Markets)
  useEffect(() => {
    if (mapInstance && markets.length > 0) {
        // 기존 마커/인포윈도우 제거
        markers.forEach(m => m.setMap(null));
        infowindows.forEach(iw => iw.close());
        setMarkers([]);
        setInfowindows([]);

        const newMarkers: any[] = [];
        const newInfowindows: any[] = [];

        markets.forEach((market) => {
            // 좌표가 있는 경우만 표시
            if (market.latitude && market.longitude) {
                const lat = parseFloat(market.latitude);
                const lng = parseFloat(market.longitude);
                const markerPosition = new window.kakao.maps.LatLng(lat, lng);

                // 상태에 따른 마커 이미지 (여기서는 기본 마커 사용하되 인포윈도우로 구분)
                const marker = new window.kakao.maps.Marker({
                    position: markerPosition,
                    map: mapInstance,
                    title: market.name
                });

                // 인포윈도우 컨텐츠 구성
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

                // 이벤트 등록
                window.kakao.maps.event.addListener(marker, 'click', function() {
                    // 다른 인포윈도우 닫기
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
  }, [mapInstance, markets]); // markets 변경 시 실행

  // --- Map Pan Handler ---
  const handlePanToMarket = (marketName: string) => {
      if (!mapInstance || !markets.length) return;

      const target = markets.find(m => m.name.includes(marketName) || marketName.includes(m.name));
      if (target && target.latitude && target.longitude) {
          const moveLatLon = new window.kakao.maps.LatLng(parseFloat(target.latitude), parseFloat(target.longitude));
          mapInstance.setLevel(3); // 줌인
          mapInstance.panTo(moveLatLon);
      }
  };

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
            onItemClick={(item) => handlePanToMarket(item.marketName || '')}
            renderItem={(item) => (
              <div className="flex items-center justify-between px-2 py-2 transition-colors text-sm">
                 <div className="flex items-center gap-2 min-w-0">
                    <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 animate-pulse">화재</span>
                    <span className="font-medium text-slate-200 truncate group-hover:text-white" title={item.msg}>{item.msg}</span>
                 </div>
                 <div className="text-xs text-slate-500 shrink-0 ml-2 font-mono">{item.time}</div>
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
              <div className="flex items-center justify-between px-2 py-2 transition-colors text-sm">
                 <div className="flex items-center gap-2 min-w-0">
                    <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0">고장</span>
                    <span className="font-medium text-slate-200 truncate group-hover:text-white" title={item.msg}>{item.msg}</span>
                 </div>
                 <div className="text-xs text-slate-500 shrink-0 ml-2 font-mono">{item.time}</div>
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
                        onKeyDown={(e) => {
                            if(e.key === 'Enter') handlePanToMarket(searchMarketMap);
                        }}
                    />
                    <Search size={14} className="absolute right-2 top-2 text-slate-400 cursor-pointer" onClick={() => handlePanToMarket(searchMarketMap)} />
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
             실시간 관제 중 ({markets.length}개 시장 연동)
          </div>
        </div>

      </div>
    </div>
  );
};
