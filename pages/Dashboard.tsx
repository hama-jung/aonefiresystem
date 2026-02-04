
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/CommonUI';
import { AlertTriangle, AlertCircle, WifiOff, ArrowRight, CheckCircle } from 'lucide-react';
import { DashboardAPI } from '../services/api';

/**
 * [FIX] Implemented complete Dashboard component.
 * This resolves the "Module './pages/Dashboard' has no exported member 'Dashboard'" error in App.tsx.
 */
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard summary data using the API
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
    // Auto-refresh data every 30 seconds for real-time monitoring feel
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-500 font-bold animate-pulse">데이터 로딩 중...</div>
      </div>
    );
  }

  // Extract events from data, providing defaults to prevent errors
  const { stats = [], fireEvents = [], faultEvents = [], commEvents = [] } = data || {};

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="대시보드 요약" />

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat: any, idx: number) => (
          <div 
            key={idx} 
            className={`p-6 rounded-xl border shadow-sm flex items-center justify-between ${
              stat.type === 'fire' ? 'bg-red-900/20 border-red-800' :
              stat.type === 'fault' ? 'bg-orange-900/20 border-orange-800' :
              'bg-slate-800 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${
                stat.type === 'fire' ? 'bg-red-600' :
                stat.type === 'fault' ? 'bg-orange-600' :
                'bg-slate-600'
              }`}>
                {stat.type === 'fire' && <AlertTriangle className="text-white" size={24} />}
                {stat.type === 'fault' && <AlertCircle className="text-white" size={24} />}
                {stat.type === 'error' && <WifiOff className="text-white" size={24} />}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Events Monitoring Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Fire Events List */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
            <h3 className="font-bold text-red-400 flex items-center gap-2">
              <AlertTriangle size={18} /> 실시간 화재 상황
            </h3>
            <button onClick={() => navigate('/fire-history')} className="text-slate-500 hover:text-white transition-colors">
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="divide-y divide-slate-700">
            {fireEvents.length > 0 ? fireEvents.map((e: any) => (
              <div key={e.id} className="p-4 hover:bg-slate-700/30 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-bold text-white">{e.marketName}</span>
                  <span className="text-[10px] text-slate-500">{new Date(e.time).toLocaleTimeString()}</span>
                </div>
                <p className="text-xs text-slate-400">{e.detail}</p>
              </div>
            )) : (
              <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle size={32} className="opacity-20 text-green-500" />
                <span className="text-sm">현재 화재 상황이 없습니다.</span>
              </div>
            )}
          </div>
        </div>

        {/* Fault Events List */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
            <h3 className="font-bold text-orange-400 flex items-center gap-2">
              <AlertCircle size={18} /> 기기 고장 현황
            </h3>
            <button onClick={() => navigate('/device-status')} className="text-slate-500 hover:text-white transition-colors">
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="divide-y divide-slate-700">
            {faultEvents.length > 0 ? faultEvents.map((e: any) => (
              <div key={e.id} className="p-4 hover:bg-slate-700/30 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-bold text-white">{e.marketName}</span>
                  <span className="text-[10px] text-slate-500">{new Date(e.time).toLocaleTimeString()}</span>
                </div>
                <p className="text-xs text-slate-400">{e.deviceType} {e.deviceId}번 - {e.errorName}</p>
              </div>
            )) : (
              <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle size={32} className="opacity-20 text-blue-500" />
                <span className="text-sm">현재 고장 내역이 없습니다.</span>
              </div>
            )}
          </div>
        </div>

        {/* Communication Status List */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
            <h3 className="font-bold text-slate-300 flex items-center gap-2">
              <WifiOff size={18} /> 통신 이상 현황
            </h3>
            <button onClick={() => navigate('/device-status')} className="text-slate-500 hover:text-white transition-colors">
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="divide-y divide-slate-700">
            {commEvents.length > 0 ? commEvents.map((e: any) => (
              <div key={e.id} className="p-4 hover:bg-slate-700/30 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-bold text-white">{e.marketName}</span>
                  <span className="text-[10px] text-slate-500">{new Date(e.time).toLocaleTimeString()}</span>
                </div>
                <p className="text-xs text-slate-400">수신기: {e.receiverMac}</p>
              </div>
            )) : (
              <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle size={32} className="opacity-20 text-slate-400" />
                <span className="text-sm">통신 이상 내역이 없습니다.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
