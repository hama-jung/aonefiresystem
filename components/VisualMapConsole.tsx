import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, UI_STYLES } from './CommonUI';
import { Market, Detector, Receiver, Repeater, Store } from '../types';
import { DetectorAPI, ReceiverAPI, RepeaterAPI, FireHistoryAPI, DeviceStatusAPI, StoreAPI } from '../services/api';
import { X, Settings, Monitor, Map as MapIcon, Save, AlertTriangle, CheckCircle, Info, Video, ChevronLeft, ChevronRight, RefreshCw, Plus, Minus, RotateCcw, Edit3 } from 'lucide-react';

interface VisualMapConsoleProps {
  market: Market;
  initialMode?: 'monitoring' | 'edit';
  onClose: () => void;
}

export const VisualMapConsole: React.FC<VisualMapConsoleProps> = ({ market, initialMode = 'monitoring', onClose }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'monitoring' | 'edit'>(initialMode);
  
  // Map Images State
  const mapImages = market.mapImages && market.mapImages.length > 0 
    ? market.mapImages 
    : (market.mapImage ? [market.mapImage] : []);
  const [currentMapIndex, setCurrentMapIndex] = useState(0);

  // Zoom State
  const [zoomLevel, setZoomLevel] = useState(1);

  // Device & Store Lists
  const [detectors, setDetectors] = useState<(Omit<Detector, 'status'> & { status: string, storeInfo?: Store })[]>([]);
  const [receivers, setReceivers] = useState<(Omit<Receiver, 'status'> & { status: string })[]>([]);
  const [repeaters, setRepeaters] = useState<(Omit<Repeater, 'status'> & { status: string })[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  // CCTV State
  const [cctvList, setCctvList] = useState<{name: string, url: string}[]>([]);
  const [currentCctvIndex, setCurrentCctvIndex] = useState(0);

  // Dragging State
  const [draggedItem, setDraggedItem] = useState<{ type: 'detector'|'receiver'|'repeater', id: number } | null>(null);

  // Alert Action Modal
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedAlertDevice, setSelectedAlertDevice] = useState<any>(null);

  // Fire Alert Modal State (In-Console)
  const [showFireModal, setShowFireModal] = useState(false);

  // Load Data
  const loadDevices = async () => {
    setLoading(true);
    try {
      // 1. Fetch Base Devices & Stores
      const [detData, rcvData, rptData, storesData] = await Promise.all([
        DetectorAPI.getList({ marketName: market.name }),
        ReceiverAPI.getList({ marketName: market.name }),
        RepeaterAPI.getList({ marketName: market.name }),
        StoreAPI.getList({ marketId: market.id })
      ]);

      setStores(storesData);

      // 2. Fetch Active Events (Fire History & Device Status) for Real-time Monitoring
      const [fireLogs, faultLogs] = await Promise.all([
          FireHistoryAPI.getList({ marketName: market.name }),
          DeviceStatusAPI.getList({ marketName: market.name, status: 'unprocessed' })
      ]);

      const activeFires = fireLogs.filter(f => ['화재', '등록'].includes(f.falseAlarmStatus));

      // 3. Merge Status & Store Info - Detectors
      const mergedDetectors = detData.map(d => {
          // Check Fire
          const isFire = activeFires.some(f => 
              f.receiverMac === d.receiverMac && 
              f.repeaterId === d.repeaterId && 
              ((f.detectorInfoChamber && f.detectorInfoChamber.startsWith(d.detectorId)) || 
               (f.detectorInfoTemp && f.detectorInfoTemp.startsWith(d.detectorId)))
          );
          // Check Fault
          const isFault = faultLogs.some(f => 
              f.deviceType === '감지기' && 
              f.receiverMac === d.receiverMac && 
              f.repeaterId === d.repeaterId && 
              f.deviceId === d.detectorId
          );

          let status = '정상';
          if (isFire) status = '화재';
          else if (isFault) status = '고장';
          else if (d.status === '미사용') status = '미사용';

          // Link Store Details for Sidebar/Modal
          const linkedStoreId = d.stores && d.stores.length > 0 ? d.stores[0].id : null;
          const storeInfo = linkedStoreId ? storesData.find(s => s.id === linkedStoreId) : undefined;

          return { ...d, status, storeInfo };
      });

      // 4. Merge Status - Receivers
      const mergedReceivers = rcvData.map(r => {
          const isFault = faultLogs.some(f => f.deviceType === '수신기' && f.receiverMac === r.macAddress);
          let status = '정상';
          if (isFault) status = '고장';
          return { ...r, status };
      });

      // 5. Merge Status - Repeaters
      const mergedRepeaters = rptData.map(r => {
          const isFault = faultLogs.some(f => f.deviceType === '중계기' && f.receiverMac === r.receiverMac && f.deviceId === r.repeaterId);
          let status = '정상';
          if (isFault) status = '고장';
          return { ...r, status };
      });

      setDetectors(mergedDetectors);
      setReceivers(mergedReceivers);
      setRepeaters(mergedRepeaters);

      const hasFire = mergedDetectors.some(d => d.status === '화재');
      const muteKey = `fire_alert_mute_${market.id}`;
      const muteUntil = localStorage.getItem(muteKey);
      const isMuted = muteUntil && Date.now() < parseInt(muteUntil);

      if (hasFire && !isMuted) setShowFireModal(true);
      else setShowFireModal(false);

      const cctvs = mergedDetectors
        .filter(d => d.cctvUrl && d.cctvUrl.trim() !== '')
        .map(d => ({
            name: d.storeInfo ? d.storeInfo.name : `${d.detectorId}번 감지기`,
            url: d.cctvUrl!
        }));
      setCctvList(cctvs);

    } catch (e) {
      console.error("Failed to load devices for map", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, [market.name]);

  useEffect(() => {
      setZoomLevel(1);
  }, [currentMapIndex]);

  const stats = {
      receiver: { total: receivers.length, placed: receivers.filter(r => r.x_pos).length },
      repeater: { total: repeaters.length, placed: repeaters.filter(r => r.x_pos).length },
      detector: { total: detectors.length, placed: detectors.filter(r => r.x_pos).length },
      cctv: cctvList.length
  };

  const fireDevices = [
      ...receivers.filter(d => d.status === '화재' || d.status === 'Fire'),
      ...repeaters.filter(d => d.status === '화재' || d.status === 'Fire'),
      ...detectors.filter(d => d.status === '화재' || d.status === 'Fire')
  ];

  const handleRecoverAll = async () => {
      if (fireDevices.length === 0) {
          alert('현재 화재 상태인 기기가 없습니다.');
          return;
      }
      if (confirm(`현재 화재 상태인 기기 ${fireDevices.length}건을 모두 '정상'으로 복구하시겠습니까?\n(현장의 기기에 복구 신호를 전송합니다.)`)) {
          const updatedDetectors = detectors.map(d => d.status === '화재' ? { ...d, status: '정상' } : d);
          setDetectors(updatedDetectors); 
          alert('복구 신호 전송 및 처리가 완료되었습니다.');
          setShowFireModal(false);
      }
  };

  const handleMuteAlert = () => {
      const muteKey = `fire_alert_mute_${market.id}`;
      const oneHourLater = Date.now() + (60 * 60 * 1000);
      localStorage.setItem(muteKey, oneHourLater.toString());
      setShowFireModal(false);
  };

  const handlePrevCctv = () => setCurrentCctvIndex(prev => (prev === 0 ? cctvList.length - 1 : prev - 1));
  const handleNextCctv = () => setCurrentCctvIndex(prev => (prev === cctvList.length - 1 ? 0 : prev + 1));
  const handleMapChange = (idx: number) => setCurrentMapIndex(idx);
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.5, 1));
  const handleZoomReset = () => setZoomLevel(1);

  const handleDragStart = (e: React.DragEvent, type: 'detector'|'receiver'|'repeater', id: number) => {
    if (mode !== 'edit') return;
    setDraggedItem({ type, id });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (mode !== 'edit' || !draggedItem) return;
    e.preventDefault();
    const mapRect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - mapRect.left) / mapRect.width) * 100;
    const y = ((e.clientY - mapRect.top) / mapRect.height) * 100;

    if (draggedItem.type === 'detector') {
      setDetectors(prev => prev.map(d => d.id === draggedItem.id ? { ...d, x_pos: x, y_pos: y } : d));
      await DetectorAPI.saveCoordinates(draggedItem.id, x, y);
    } else if (draggedItem.type === 'receiver') {
      setReceivers(prev => prev.map(r => r.id === draggedItem.id ? { ...r, x_pos: x, y_pos: y } : r));
      await ReceiverAPI.saveCoordinates(draggedItem.id, x, y);
    } else if (draggedItem.type === 'repeater') {
      setRepeaters(prev => prev.map(r => r.id === draggedItem.id ? { ...r, x_pos: x, y_pos: y } : r));
      await RepeaterAPI.saveCoordinates(draggedItem.id, x, y);
    }
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => { if (mode === 'edit') e.preventDefault(); };

  const handleDeviceClick = (device: any, type: string) => {
    if (mode === 'edit') return;
    setSelectedAlertDevice({ ...device, type });
    setActionModalOpen(true);
  };

  const handleActionComplete = (action: string) => {
    alert(`${action} 처리가 완료되었습니다.`);
    setActionModalOpen(false);
    loadDevices();
  };

  const handleNavigateToEdit = () => {
    if (!selectedAlertDevice) return;
    let path = '/stores';
    if (selectedAlertDevice.type === 'receiver') path = '/receivers';
    else if (selectedAlertDevice.type === 'repeater') path = '/repeaters';
    
    if (confirm('해당 기기의 정보 수정 페이지로 이동하시겠습니까?\n(현재의 지도 관제 화면이 닫힙니다.)')) {
        navigate(path);
        onClose();
    }
  };

  const renderIcon = (item: any, type: 'detector'|'receiver'|'repeater') => {
    const isFire = item.status === '화재' || item.status === 'Fire';
    const isError = item.status === '고장' || item.status === 'Error' || item.status === '에러';
    
    const baseClass = "relative w-8 h-8 rounded-full shadow-lg flex items-center justify-center text-white border-2 border-white transition-transform group-hover:scale-125 z-10";
    
    let bgColor = "bg-gray-500";
    let iconName = "help_outline";
    
    if (isFire) {
        bgColor = "bg-orange-600 animate-pulse";
        iconName = "local_fire_department"; 
    } else if (isError) {
        // [MODIFIED] Added animate-pulse to fault markers
        bgColor = "bg-amber-500 animate-pulse";
        iconName = "warning_amber";
    } else {
        switch(type) {
            case 'receiver': bgColor = "bg-purple-600"; iconName = "dns"; break;
            case 'repeater': bgColor = "bg-cyan-500"; iconName = "router"; break;
            case 'detector': bgColor = "bg-green-600"; iconName = "sensors"; break;
        }
    }

    return (
      <div
        key={`${type}-${item.id}`}
        className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer ${mode === 'edit' ? 'cursor-move' : ''} group`}
        style={{ left: `${item.x_pos}%`, top: `${item.y_pos}%` }}
        draggable={mode === 'edit'}
        onDragStart={(e) => handleDragStart(e, type, item.id)}
        onClick={() => handleDeviceClick(item, type)}
      >
        {isFire && <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-75"></div>}
        {isError && <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-50"></div>}
        
        {type === 'detector' && item.mode === '열' && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-white drop-shadow-md z-20">
                 <span className="material-icons text-sm" style={{ fontSize: '16px' }}>thermostat</span>
            </div>
        )}

        <div className={`${baseClass} ${bgColor}`}>
            <span className="material-icons text-sm">{iconName}</span>
        </div>

        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 flex flex-col items-center">
            <span className="font-bold">
                {type === 'detector' ? `${item.storeInfo?.name || `감지기 ${item.detectorId}`}` : (type === 'repeater' ? `중계기 ${item.repeaterId}` : `수신기`)}
            </span>
            <span className="text-[10px] text-gray-300">
                {item.status} {item.mode ? `(${item.mode})` : ''}
            </span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/80"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-200">
        
        {showFireModal && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-red-950/80 backdrop-blur-sm animate-pulse">
                <div className="bg-red-900 border-4 border-red-500 rounded-2xl p-10 flex flex-col items-center shadow-2xl">
                    <AlertTriangle size={100} className="text-white mb-6 animate-pulse" />
                    <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">화재 발생</h1>
                    <p className="text-xl text-red-200 font-bold mb-8 text-center">
                       현장에서 화재 신호가 감지되었습니다.<br/>
                       즉시 확인 및 조치 바랍니다.
                    </p>
                    <Button variant="secondary" onClick={handleMuteAlert} className="bg-white/20 hover:bg-white/30 text-white border-white/50">
                        1시간동안 안보기
                    </Button>
                </div>
            </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shadow-md z-20">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <MapIcon className="text-blue-400" />
                    {market.name} <span className="text-slate-400 text-sm font-normal">지도로 관리</span>
                </h2>
                <div className="flex bg-slate-700 rounded-lg p-1 border border-slate-600">
                    <button onClick={() => setMode('monitoring')} className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 ${mode === 'monitoring' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}><Monitor size={14} /> 관제모드</button>
                    <button onClick={() => setMode('edit')} className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 ${mode === 'edit' ? 'bg-orange-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}><Settings size={14} /> 편집모드</button>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex gap-3 text-xs font-medium bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-700 items-center">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>정상</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-pulse"></span>화재</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>고장</span>
                    <span className="flex items-center gap-1"><span className="material-icons text-sm text-white">thermostat</span>열감지</span>
                    <span className="w-px h-3 bg-slate-600 mx-1"></span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>수신기</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>중계기</span>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
            <div className="flex-1 relative bg-[#1a1a1a] overflow-hidden">
                <div className="absolute inset-0 overflow-auto custom-scrollbar">
                    <div 
                        className="relative origin-top-left transition-all duration-200 ease-in-out"
                        style={{ width: `${zoomLevel * 100}%`, height: `${zoomLevel * 100}%`, minWidth: '100%', minHeight: '100%' }}
                        onDrop={handleDrop} onDragOver={handleDragOver}
                    >
                        {mapImages.length > 0 ? (
                            <div className="relative w-full h-full">
                                <img src={mapImages[currentMapIndex]} alt="Map" className="w-full h-full object-contain block" />
                                {receivers.filter(d => d.x_pos).map(d => renderIcon(d, 'receiver'))}
                                {repeaters.filter(d => d.x_pos).map(d => renderIcon(d, 'repeater'))}
                                {detectors.filter(d => d.x_pos).map(d => renderIcon(d, 'detector'))}
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                                <MapIcon size={64} className="mx-auto mb-4 opacity-20" />
                                <p>등록된 도면 이미지가 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>

                {mapImages.length > 0 && (
                    <div className="absolute bottom-20 right-6 flex flex-col gap-2 z-30 pointer-events-none">
                        <button onClick={handleZoomIn} className="w-10 h-10 bg-slate-800 text-white rounded-full shadow-lg border border-slate-600 flex items-center justify-center hover:bg-blue-600 transition-colors pointer-events-auto"><Plus size={20} /></button>
                        <button onClick={handleZoomOut} className="w-10 h-10 bg-slate-800 text-white rounded-full shadow-lg border border-slate-600 flex items-center justify-center hover:bg-blue-600 transition-colors pointer-events-auto"><Minus size={20} /></button>
                        <button onClick={handleZoomReset} className="w-10 h-10 bg-slate-800 text-white rounded-full shadow-lg border border-slate-600 flex items-center justify-center hover:bg-blue-600 transition-colors text-xs font-bold pointer-events-auto">1.0x</button>
                    </div>
                )}
            </div>

            {mode === 'monitoring' && (
                <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col shadow-xl z-20 overflow-hidden">
                    <div className="p-3 border-b border-slate-700 font-bold text-white bg-slate-900/50">관제 현황</div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 p-4">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-700/50 p-2 rounded border border-slate-600">
                                <div className="text-slate-400 mb-1">수신기 (배치/전체)</div>
                                <div className="text-lg font-bold text-white">{stats.receiver.placed} / <span className="text-slate-400 text-sm">{stats.receiver.total}</span></div>
                            </div>
                            <div className="bg-slate-700/50 p-2 rounded border border-slate-600">
                                <div className="text-slate-400 mb-1">중계기 (배치/전체)</div>
                                <div className="text-lg font-bold text-white">{stats.repeater.placed} / <span className="text-slate-400 text-sm">{stats.repeater.total}</span></div>
                            </div>
                            <div className="bg-slate-700/50 p-2 rounded border border-slate-600">
                                <div className="text-slate-400 mb-1">감지기 (배치/전체)</div>
                                <div className="text-lg font-bold text-white">{stats.detector.placed} / <span className="text-slate-400 text-sm">{stats.detector.total}</span></div>
                            </div>
                            <div className="bg-slate-700/50 p-2 rounded border border-slate-600">
                                <div className="text-slate-400 mb-1">CCTV</div>
                                <div className="text-lg font-bold text-blue-400">{stats.cctv} <span className="text-slate-400 text-sm">대</span></div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Video size={16} /> 현장 동영상</h3>
                            <div className="bg-black aspect-video rounded border border-slate-600 relative flex items-center justify-center overflow-hidden">
                                {cctvList.length > 0 ? (
                                    <>
                                        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center">
                                            <Video size={40} className="text-slate-600 mb-2" />
                                            <span className="text-xs text-blue-400 mt-1">{cctvList[currentCctvIndex].name}</span>
                                        </div>
                                        <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded animate-pulse">LIVE</div>
                                        {cctvList.length > 1 && (
                                            <>
                                                <button onClick={handlePrevCctv} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-black/50 text-white rounded-full"><ChevronLeft size={20} /></button>
                                                <button onClick={handleNextCctv} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-black/50 text-white rounded-full"><ChevronRight size={20} /></button>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-slate-500 text-xs flex flex-col items-center"><Video size={24} className="opacity-30 mb-1"/>연결된 CCTV가 없습니다.</div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 flex-1">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <AlertTriangle size={16} className={fireDevices.length > 0 ? "text-red-500" : "text-slate-400"} /> 화재 발생 현황
                            </h3>
                            <div className="bg-slate-900 border border-slate-600 rounded flex-1 min-h-[150px] overflow-y-auto custom-scrollbar p-2">
                                {fireDevices.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2"><CheckCircle size={24} className="text-green-500/50" /><span>현재 화재 신호가 없습니다.</span></div>
                                ) : (
                                    <ul className="space-y-2">
                                        {fireDevices.map((d: any, idx) => (
                                            <li key={`${d.id}-${idx}`} className="bg-red-900/20 border border-red-500/30 p-2 rounded flex flex-col gap-1 animate-pulse cursor-pointer hover:bg-red-900/40" onClick={() => handleDeviceClick(d, d.detectorId ? 'detector' : (d.repeaterId ? 'repeater' : 'receiver'))}>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-bold text-red-200">{d.storeInfo?.name || '위치 미지정'}</span>
                                                    <span className="bg-red-600 text-white text-[10px] px-1 rounded font-bold">화재</span>
                                                </div>
                                                <div className="text-[11px] text-red-400/80 leading-tight">
                                                    <p>{d.storeInfo?.address || '주소 정보 없음'}</p>
                                                    <p>{d.storeInfo?.managerName || '성함 미상'} ({d.storeInfo?.managerPhone || '연락처 미상'})</p>
                                                    <p className="mt-1 opacity-60">감지기 No.{d.detectorId} (중계기 {d.repeaterId})</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-700 bg-slate-800">
                        <Button variant="primary" className="w-full h-12 text-lg font-bold shadow-lg" onClick={handleRecoverAll} disabled={fireDevices.length === 0}><RefreshCw size={20} className="mr-2" />화재 복구</Button>
                    </div>
                </div>
            )}

            {mode === 'edit' && (
                <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col shadow-xl z-20">
                    <div className="p-4 border-b border-slate-700 font-bold text-white flex justify-between items-center"><span>미배치 기기 목록</span><span className="text-xs font-normal text-slate-400 bg-slate-900 px-2 py-0.5 rounded">Drag & Drop</span></div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                        <div>
                            <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">수신기</div>
                            {receivers.filter(d => !d.x_pos).map(d => (
                                <div key={d.id} draggable onDragStart={(e) => handleDragStart(e, 'receiver', d.id)} className="bg-slate-700 p-2 rounded mb-2 cursor-move hover:bg-slate-600 border border-slate-600 flex items-center gap-2 group">
                                    <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0"><span className="material-icons text-white text-[10px]">dns</span></div>
                                    <div className="flex flex-col overflow-hidden"><span className="text-sm font-bold text-slate-200">{d.macAddress}</span></div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">중계기</div>
                            {repeaters.filter(d => !d.x_pos).map(d => (
                                <div key={d.id} draggable onDragStart={(e) => handleDragStart(e, 'repeater', d.id)} className="bg-slate-700 p-2 rounded mb-2 cursor-move hover:bg-slate-600 border border-slate-600 flex items-center gap-2 group">
                                    <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0"><span className="material-icons text-white text-[10px]">router</span></div>
                                    <div className="flex flex-col overflow-hidden"><span className="text-sm font-bold text-slate-200">{d.receiverMac}-{d.repeaterId}</span></div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">감지기</div>
                            {detectors.filter(d => !d.x_pos).map(d => (
                                <div key={d.id} draggable onDragStart={(e) => handleDragStart(e, 'detector', d.id)} className="bg-slate-700 p-2 rounded mb-2 cursor-move hover:bg-slate-600 border border-slate-600 flex items-center gap-2 group">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-600`}><span className="material-icons text-white text-[10px]">sensors</span></div>
                                    <div className="flex flex-col overflow-hidden"><span className="text-sm font-bold text-slate-200">{d.receiverMac}-{d.repeaterId}-{d.detectorId}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {actionModalOpen && selectedAlertDevice && (
            <Modal isOpen={actionModalOpen} onClose={() => setActionModalOpen(false)} title="기기 상세 정보 및 제어" width="max-w-md">
                <div className="flex flex-col gap-4">
                    <div className={`flex items-center gap-4 p-4 rounded border ${selectedAlertDevice.status === '화재' ? 'bg-red-900/30 border-red-500/50' : (selectedAlertDevice.status === '고장' ? 'bg-amber-900/30 border-amber-500/50' : 'bg-slate-900 border-slate-700')}`}>
                        <div className={`w-14 h-14 flex items-center justify-center rounded-full text-white shadow-xl
                            ${selectedAlertDevice.status === '화재' ? 'bg-red-600 animate-pulse' : (selectedAlertDevice.status === '고장' ? 'bg-amber-600 animate-pulse' : 'bg-green-600')}
                        `}>
                            <span className="material-icons text-3xl">
                                {selectedAlertDevice.status === '화재' ? 'local_fire_department' : (selectedAlertDevice.status === '고장' ? 'warning_amber' : 'sensors')}
                            </span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="text-xl font-black text-white truncate">
                                {selectedAlertDevice.storeInfo?.name || '위치 미지정'}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className={`px-1.5 rounded font-bold text-[10px] ${selectedAlertDevice.status === '화재' ? 'bg-red-600 text-white' : (selectedAlertDevice.status === '고장' ? 'bg-amber-500 text-black' : 'bg-green-600 text-white')}`}>
                                    {selectedAlertDevice.status}
                                </span>
                                <span className="text-slate-400">
                                    {selectedAlertDevice.type === 'detector' ? '화재감지기' : (selectedAlertDevice.type === 'repeater' ? '중계기' : '수신기')}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/80 p-4 rounded-lg text-sm text-slate-300 border border-slate-700 flex flex-col gap-2">
                        <div className="pb-2 border-b border-slate-700 mb-2 font-bold text-slate-200">등록 정보</div>
                        <p className="flex justify-between"><span>수신기 MAC:</span> <span className="text-white font-mono">{selectedAlertDevice.receiverMac || selectedAlertDevice.macAddress}</span></p>
                        {selectedAlertDevice.repeaterId && <p className="flex justify-between"><span>중계기 ID:</span> <span className="text-white font-mono">{selectedAlertDevice.repeaterId}</span></p>}
                        {selectedAlertDevice.detectorId && <p className="flex justify-between"><span>감지기 ID:</span> <span className="text-white font-mono">{selectedAlertDevice.detectorId}</span></p>}
                        
                        {selectedAlertDevice.storeInfo && (
                            <>
                                <div className="pt-2 mt-2 border-t border-slate-700 font-bold text-slate-200">설치 위치 상세</div>
                                <p className="flex flex-col gap-0.5"><span className="text-xs text-slate-500">주소:</span> <span className="text-slate-300">{selectedAlertDevice.storeInfo.address} {selectedAlertDevice.storeInfo.addressDetail}</span></p>
                                <p className="flex justify-between mt-1"><span>대표자:</span> <span className="text-slate-300">{selectedAlertDevice.storeInfo.managerName}</span></p>
                                <p className="flex justify-between"><span>연락처:</span> <span className="text-blue-400 font-bold underline cursor-pointer">{selectedAlertDevice.storeInfo.managerPhone}</span></p>
                            </>
                        )}
                        <p className="mt-2 text-xs text-slate-500 border-t border-slate-700 pt-2 italic">"{selectedAlertDevice.memo || '비고 내역 없음'}"</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {selectedAlertDevice.status === '화재' || selectedAlertDevice.status === '고장' ? (
                            <Button variant="primary" onClick={() => handleActionComplete('복구')} className="h-11 font-bold">상태 복구</Button>
                        ) : (
                            <Button variant="secondary" disabled className="h-11 opacity-50">정상 작동 중</Button>
                        )}
                        <Button variant="secondary" onClick={() => setActionModalOpen(false)} className="h-11">닫기</Button>
                    </div>

                    {/* [NEW] 정보 수정 이동 버튼 */}
                    <div className="mt-2">
                        <button 
                            onClick={handleNavigateToEdit}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-all border border-slate-600"
                        >
                            <Edit3 size={16} /> 정보 수정 (기기 관리로 이동)
                        </button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};