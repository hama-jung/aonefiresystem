import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, InputGroup, SelectGroup, Button, UI_STYLES 
} from '../components/CommonUI';
import { ReceiverAPI } from '../services/api';
import { Receiver } from '../types';
import { Send, Trash2, Power, PowerOff } from 'lucide-react';

export const UartCommunication: React.FC = () => {
  // --- State ---
  const [wsUrl, setWsUrl] = useState('ws://175.126.77.220:9090');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('미 접속');
  
  const [logs, setLogs] = useState<string[]>([]);
  
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [packetType, setPacketType] = useState<'AUTH' | 'STATUS' | 'FIRE_RESET'>('AUTH');

  const ws = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // --- Initial Data ---
  useEffect(() => {
    // 장비 내역(수신기 목록) 로드
    const loadReceivers = async () => {
      try {
        const data = await ReceiverAPI.getList();
        setReceivers(data);
        if (data.length > 0) setSelectedDevice(data[0].macAddress);
      } catch (e) {
        console.error("Failed to load receivers");
      }
    };
    loadReceivers();

    // Cleanup on unmount
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  // 로그 자동 스크롤
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // --- WebSocket Handlers ---
  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev]);
  };

  const handleConnect = () => {
    if (!wsUrl) {
      alert('Web Socket Server URL을 입력해주세요.');
      return;
    }

    try {
      addLog(`Connecting to ${wsUrl}...`);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('접속됨');
        addLog('Connected to WebSocket Server.');
      };

      ws.current.onmessage = (event) => {
        addLog(`[RX] ${event.data}`);
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('미 접속');
        addLog('Disconnected from WebSocket Server.');
        ws.current = null;
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket Error:", error);
        addLog('WebSocket Error occurred.');
      };

    } catch (e: any) {
      addLog(`Connection Failed: ${e.message}`);
    }
  };

  const handleDisconnect = () => {
    if (ws.current) {
      ws.current.close();
    }
  };

  const handleSend = () => {
    if (!selectedDevice) {
      alert('전송할 장비를 선택해주세요.');
      return;
    }

    const payload = JSON.stringify({
      target: selectedDevice,
      type: packetType,
      timestamp: new Date().toISOString()
    });

    if (isConnected && ws.current) {
      ws.current.send(payload);
      addLog(`[TX] ${payload}`);
    } else {
      // 연결되지 않아도 로그에 남기는 시늉 (실제로는 불가)
      addLog(`[TX (Not Connected)] ${payload}`);
      alert('서버에 연결되어 있지 않습니다. (로그에만 기록됨)');
    }
  };

  const handleClearLog = () => setLogs([]);

  // --- Options ---
  const deviceOptions = [
    { value: '', label: '장비를 선택하세요' },
    ...receivers.map(r => ({ value: r.macAddress, label: `${r.marketName || '미지정'} (${r.macAddress})` }))
  ];

  return (
    <>
      <PageHeader title="UART 통신" />

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] min-h-[600px]">
        {/* Left Column: Controls */}
        <div className="lg:w-1/3 flex flex-col gap-8 bg-slate-800 p-6 rounded-lg border border-slate-700 h-fit">
          
          {/* Section 1: UART 중계서버 */}
          <div>
            <h2 className="text-lg font-bold text-blue-400 mb-4 pb-2 border-b border-slate-600">
              UART 중계서버
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-blue-400">Web Socket Server</label>
                <input 
                  type="text" 
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  className={UI_STYLES.input}
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-blue-400">접속상태</label>
                <div className="text-slate-200 font-medium px-1">
                  {connectionStatus}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <Button 
                  onClick={handleConnect} 
                  disabled={isConnected}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  icon={<Power size={16}/>}
                >
                  중계서버 연결
                </Button>
                <Button 
                  onClick={handleDisconnect} 
                  disabled={!isConnected}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  icon={<PowerOff size={16}/>}
                >
                  중계서버 연결 종료
                </Button>
              </div>
            </div>
          </div>

          {/* Section 2: 수동 전송 */}
          <div>
            <h2 className="text-lg font-bold text-blue-400 mb-4 pb-2 border-b border-slate-600">
              수동 전송
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-blue-400">UART 장비 내역</label>
                <SelectGroup 
                  options={deviceOptions}
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-blue-400">전송 패킷 타입</label>
                <div className="flex flex-wrap gap-4 pt-1">
                  {[
                    { label: '인증 요청', value: 'AUTH' },
                    { label: '상태 요청', value: 'STATUS' },
                    { label: '화재 알람 해제 요청', value: 'FIRE_RESET' }
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                      <input 
                        type="radio" 
                        name="packetType" 
                        checked={packetType === opt.value}
                        onChange={() => setPacketType(opt.value as any)}
                        className="accent-blue-500 w-4 h-4"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button 
                  onClick={handleSend} 
                  className="bg-blue-600 hover:bg-blue-500 w-24"
                  icon={<Send size={16}/>}
                >
                  전송
                </Button>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Connection Log */}
        <div className="lg:w-2/3 flex flex-col bg-slate-800 p-6 rounded-lg border border-slate-700 h-full max-h-[800px]">
          <h2 className="text-lg font-bold text-slate-200 mb-4 pb-2 border-b border-slate-600">
            연결상태
          </h2>
          
          <div className="flex-1 border-t-2 border-blue-500 bg-[#0f172a] rounded-b-lg p-4 overflow-hidden flex flex-col">
             <div ref={logContainerRef} className="flex-1 overflow-y-auto custom-scrollbar font-mono text-sm space-y-1">
                {logs.length === 0 && (
                  <div className="text-slate-600 italic text-center mt-10">로그 내역이 없습니다.</div>
                )}
                {logs.map((log, idx) => (
                  <div key={idx} className="break-all text-slate-300 border-b border-slate-800/50 pb-0.5 mb-0.5">
                    {log}
                  </div>
                ))}
             </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-700 mt-4">
             <Button 
               onClick={handleClearLog} 
               className="bg-blue-600 hover:bg-blue-500"
               icon={<Trash2 size={16}/>}
             >
               로그 클린
             </Button>
          </div>
        </div>
      </div>
    </>
  );
};
