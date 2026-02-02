import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/CommonUI';
import { AlertTriangle, WifiOff, Video } from 'lucide-react';
import { DashboardAPI } from '../services/api';

export const Dashboard: React.FC = () => {
  const [level, setLevel] = useState<1 | 2 | 3>(1); // 1: National, 2: City, 3: Market
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 컴포넌트 마운트 시 데이터 로드
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
    fetchData();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-500 font-bold animate-pulse">데이터를 불러오는 중입니다...</div>
      </div>
    );
  }

  const { stats, fireLogs, faultLogs, mapPoints } = data;

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
              {fireLogs.map((log: any) => (
                <div key={log.id} className="bg-red-950/40 p-2 rounded border border-red-900/40 cursor-pointer hover:bg-red-900/60 transition-colors" onClick={() => setLevel(2)}>
                  <div className="flex items-center gap-2 mb-1">
                     <span className="bg-red-600 text-white text-[10px] px-1 rounded">소방</span>
                     <span className="text-xs font-medium text-slate-200 truncate">{log.msg}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 text-right">{log.time}</div>
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
              {faultLogs.map((log: any) => (
                <div key={log.id} className="bg-orange-950/40 p-2 rounded border border-orange-900/40 cursor-pointer hover:bg-orange-900/60 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                     <span className="bg-orange-600 text-white text-[10px] px-1 rounded">고장</span>
                     <span className="text-xs font-medium text-slate-200 truncate">{log.msg}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 text-right">{log.time}</div>
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
              현재 통신 이상 내역이 없습니다.
            </div>
          </div>
        </div>

        {/* Right Content: Map Visualization */}
        <div className="lg:col-span-3 bg-slate-900 rounded-xl overflow-hidden relative shadow-inner border border-slate-700 flex flex-col">
          {/* Map Header Controls */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
             <button className="bg-slate-800 text-white px-3 py-1 rounded text-sm border border-slate-600 hover:bg-slate-700">
                화재감지기보기
             </button>
             <button className="bg-slate-800 text-white px-3 py-1 rounded text-sm border border-slate-600 hover:bg-slate-700">
                CCTV
             </button>
             {level > 1 && (
               <button onClick={() => setLevel(level - 1 as any)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 border border-transparent">
                 &lt; Back to Level {level - 1}
               </button>
             )}
          </div>

          {/* Map Visualization Area */}
          <div className="flex-1 relative flex items-center justify-center bg-slate-900">
            {/* Simulation of a Map */}
            <div className="relative w-full h-full max-w-2xl max-h-[80%] aspect-[4/5] bg-slate-800 rounded-lg border border-slate-700 opacity-80 m-auto">
               <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                 {level === 1 && "National Map (Korea)"}
                 {level === 2 && "Province Map (Gyeonggi-do)"}
                 {level === 3 && "Market Floor Plan"}
               </div>
            </div>

            {/* Simulated Interactive Points */}
            {level === 1 && mapPoints.map((point: any) => (
              <div 
                key={point.id}
                className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                onClick={() => setLevel(2)}
              >
                <div className={`w-4 h-4 rounded-full ${point.status === 'fire' ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></div>
                <div className={`w-4 h-4 rounded-full ${point.status === 'fire' ? 'bg-red-500' : 'bg-green-500'} absolute border-2 border-slate-900`}></div>
                <span className="mt-2 text-xs text-white bg-slate-800 border border-slate-700 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                  {point.name}
                </span>
              </div>
            ))}

            {level === 3 && (
               <div className="absolute top-10 left-10 bg-slate-900/90 border border-slate-700 p-4 rounded text-white w-64 shadow-xl backdrop-blur-sm">
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <Video size={16} className="text-red-500" /> 현장 동영상
                  </h4>
                  <div className="bg-black w-full h-32 flex items-center justify-center text-gray-500 text-xs border border-gray-700">
                    CCTV FEED NO SIGNAL
                  </div>
                  <div className="mt-4 text-xs space-y-2">
                    <p className="flex justify-between border-b border-slate-700 pb-1"><span>화재감지기:</span> <span className="text-red-400">388</span></p>
                    <p className="flex justify-between border-b border-slate-700 pb-1"><span>CCTV:</span> <span>1</span></p>
                    <p className="flex justify-between pt-1"><span>화재정보:</span> <span className="text-red-500 font-bold">2 건</span></p>
                  </div>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};