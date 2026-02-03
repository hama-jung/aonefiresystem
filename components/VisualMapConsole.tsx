import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal, UI_STYLES } from './CommonUI';
import { Market, Detector, Receiver, Repeater } from '../types';
import { DetectorAPI, ReceiverAPI, RepeaterAPI } from '../services/api';
import { X, Settings, Monitor, Map as MapIcon, Save, AlertTriangle, CheckCircle, Info, Video, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface VisualMapConsoleProps {
  market: Market;
  initialMode?: 'monitoring' | 'edit';
  onClose: () => void;
}

export const VisualMapConsole: React.FC<VisualMapConsoleProps> = ({ market, initialMode = 'monitoring', onClose }) => {
  const [mode, setMode] = useState<'monitoring' | 'edit'>(initialMode);
  
  // Map Images State
  const mapImages = market.mapImages && market.mapImages.length > 0 
    ? market.mapImages 
    : (market.mapImage ? [market.mapImage] : []);
  const [currentMapIndex, setCurrentMapIndex] = useState(0);

  // Device Lists
  const [detectors, setDetectors] = useState<Detector[]>([]);
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [repeaters, setRepeaters] = useState<Repeater[]>([]);
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
      const [detData, rcvData, rptData] = await Promise.all([
        DetectorAPI.getList({ marketName: market.name }),
        ReceiverAPI.getList({ marketName: market.name }),
        RepeaterAPI.getList({ marketName: market.name })
      ]);
      setDetectors(detData);
      setReceivers(rcvData);
      setRepeaters(rptData);

      // Check for Fire Status
      const hasFire = [...detData, ...rcvData, ...rptData].some(d => ((d.status as string) === '화재' || (d.status as string) === 'Fire'));
      setShowFireModal(hasFire);

      // Extract CCTV URLs from detectors
      const cctvs = detData
        .filter(d => d.cctvUrl && d.cctvUrl.trim() !== '')
        .map(d => ({
            name: d.stores && d.stores.length > 0 ? d.stores[0].name : `${d.detectorId}번 감지기`,
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
    // Poll for status updates to auto-dismiss fire modal
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, [market.name]);

  // --- Statistics Calculation ---
  const stats = {
      receiver: { total: receivers.length, placed: receivers.filter(r => r.x_pos).length },
      repeater: { total: repeaters.length, placed: repeaters.filter(r => r.x_pos).length },
      detector: { total: detectors.length, placed: detectors.filter(r => r.x_pos).length },
      cctv: cctvList.length
  };

  const fireDevices = [
      ...receivers.filter(d => (d.status as string) === '화재' || (d.status as string) === 'Fire'),
      ...repeaters.filter(d => (d.status as string) === '화재' || (d.status as string) === 'Fire'),
      ...detectors.filter(d => (d.status as string) === '화재' || (d.status as string) === 'Fire')
  ];

  // --- Handlers ---

  const handleRecoverAll = async () => {
      if (fireDevices.length === 0) {
          alert('현재 화재 상태인 기기가 없습니다.');
          return;
      }
      
      if (confirm(`현재 화재 상태인 기기 ${fireDevices.length}건을 모두 '정상'으로 복구하시겠습니까?\n(현장의 기기에 복구 신호를 전송합니다.)`)) {
          // Mock Update: Actual implementation would call an API
          // For demo, we just update local state instantly
          const updatedDetectors = detectors.map(d => (d.status as string) === '화재' ? { ...d, status: '사용' } : d);
          setDetectors(updatedDetectors as Detector[]);
          
          alert('복구 신호 전송 및 처리가 완료되었습니다.');
          setShowFireModal(false); // Dismiss modal immediately
          // In real app: await API calls then loadDevices();
      }
  };

  // CCTV Navigation
  const handlePrevCctv = () => {
      setCurrentCctvIndex(prev => (prev === 0 ? cctvList.length - 1 : prev - 1));
  };
  const handleNextCctv = () => {
      setCurrentCctvIndex(prev => (prev === cctvList.length - 1 ? 0 : prev + 1));
  };

  // Map Navigation
  const handleMapChange = (idx: number) => {
      setCurrentMapIndex(idx);
  };

  // --- Drag & Drop Logic ---
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

    // Optimistic Update & API Call
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

  const handleDragOver = (e: React.DragEvent) => {
    if (mode === 'edit') e.preventDefault();
  };

  // --- Interaction Logic ---
  const handleDeviceClick = (device: any, type: string) => {
    if (mode === 'edit') return; // Edit mode: click does nothing (drag handles it)
    
    // Monitoring mode: Show Action Modal
    setSelectedAlertDevice({ ...device, type });
    setActionModalOpen(true);
  };

  const handleActionComplete = (action: string) => {
    alert(`${action} 처리가 완료되었습니다.`);
    setActionModalOpen(false);
    loadDevices(); // Refresh data
  };

  // --- Rendering Helpers ---
  const renderIcon = (item: any, type: 'detector'|'receiver'|'repeater') => {
    const isFire = (item.status as string) === '화재' || (item.status as string) === 'Fire';
    const isError = (item.status as string) === '고장' || (item.status as string) === 'Error' || (item.status as string) === '에러';
    
    // Style based on type
    let shapeClass = "rounded-full"; // Detector: Circle
    let label = item.detectorId || item.repeaterId || "R";
    
    if (type === 'receiver') {
        shapeClass = "rounded-sm"; // Receiver: Square
        label = "M";
    } else if (type === 'repeater') {
        shapeClass = "rounded-md"; // Repeater: Rounded Square
        label = item.repeaterId;
    }

    let colorClass = "bg-green-600 border-green-400";
    if (isFire) colorClass = "bg-red-600 border-red-400 animate-pulse";
    else if (isError) colorClass = "bg-orange-500 border-orange-300";

    return (
      <div
        key={`${type}-${item.id}`}
        className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125
            ${mode === 'edit' ? 'cursor-move' : ''} group z-10
        `}
        style={{ left: `${item.x_pos}%`, top: `${item.y_pos}%` }}
        draggable={mode === 'edit'}
        onDragStart={(e) => handleDragStart(e, type, item.id)}
        onClick={() => handleDeviceClick(item, type)}
      >
        {isFire && <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>}
        
        <div className={`
            relative w-8 h-8 ${shapeClass} border-2 shadow-lg flex items-center justify-center text-xs font-bold text-white
            ${colorClass}
        `}>
            {label}
        </div>

        {/* Tooltip */}
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
            {type === 'detector' ? `감지기 ${item.detectorId}` : (type === 'repeater' ? `중계기 ${item.repeaterId}` : `수신기`)}
            <br/>
            {item.status}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-200">
        
        {/* Fire Alert Modal (Overlay inside Console) */}
        {showFireModal && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-red-950/80 backdrop-blur-sm animate-pulse">
                <div className="bg-red-900 border-4 border-red-500 rounded-2xl p-10 flex flex-col items-center shadow-2xl animate-bounce-slight">
                    <AlertTriangle size={100} className="text-white mb-6 animate-pulse" />
                    <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">화재 발생</h1>
                    <p className="text-xl text-red-200 font-bold mb-8">
                       현장에서 화재 신호가 감지되었습니다.<br/>
                       즉시 확인 및 조치 바랍니다.
                    </p>
                    <Button variant="secondary" onClick={() => setShowFireModal(false)} className="bg-white/20 hover:bg-white/30 text-white border-white/50">
                        알림 닫기 (상황판 보기)
                    </Button>
                </div>
            </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shadow-md z-20">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <MapIcon className="text-blue-400" />
                    {market.name} <span className="text-slate-400 text-sm font-normal">지도로 관리</span>
                </h2>
                <div className="flex bg-slate-700 rounded-lg p-1 border border-slate-600">
                    <button 
                        onClick={() => setMode('monitoring')}
                        className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 ${mode === 'monitoring' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                    >
                        <Monitor size={14} /> 관제모드
                    </button>
                    <button 
                        onClick={() => setMode('edit')}
                        className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 ${mode === 'edit' ? 'bg-orange-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                    >
                        <Settings size={14} /> 편집모드
                    </button>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex gap-4 text-xs font-medium bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-700">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>정상</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>화재</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>고장</span>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white">
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
            
            {/* Map Area */}
            <div className="flex-1 flex flex-col relative bg-[#1a1a1a]">
                <div 
                    className="flex-1 relative overflow-hidden flex items-center justify-center select-none"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
                    {mapImages.length > 0 ? (
                        <div className="relative w-full h-full">
                            <img 
                                src={mapImages[currentMapIndex]} 
                                alt={`Map ${currentMapIndex + 1}`} 
                                className="w-full h-full object-contain pointer-events-none"
                            />
                            {/* Render Placed Devices */}
                            {receivers.filter(d => d.x_pos).map(d => renderIcon(d, 'receiver'))}
                            {repeaters.filter(d => d.x_pos).map(d => renderIcon(d, 'repeater'))}
                            {detectors.filter(d => d.x_pos).map(d => renderIcon(d, 'detector'))}
                        </div>
                    ) : (
                        <div className="text-center text-slate-500">
                            <MapIcon size={64} className="mx-auto mb-4 opacity-20" />
                            <p>등록된 도면 이미지가 없습니다.</p>
                            {mode === 'edit' && <p className="text-sm mt-2 text-blue-400">현장 관리에서 이미지를 등록해주세요.</p>}
                        </div>
                    )}
                </div>

                {/* Map Pagination Footer */}
                {mapImages.length > 1 && (
                    <div className="h-14 bg-slate-800 border-t border-slate-700 flex items-center justify-center gap-2 z-20">
                        {mapImages.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleMapChange(idx)}
                                className={`
                                    w-10 h-10 rounded-lg text-sm font-bold transition-all border
                                    ${currentMapIndex === idx 
                                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg scale-110' 
                                        : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600 hover:text-white'}
                                `}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* --- Right Sidebar (Monitoring Mode) --- */}
            {mode === 'monitoring' && (
                <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col shadow-xl z-20 overflow-hidden">
                    <div className="p-3 border-b border-slate-700 font-bold text-white bg-slate-900/50">
                        관제 현황
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 p-4">
                        {/* 1. Statistics */}
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

                        {/* 2. CCTV Player */}
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Video size={16} /> 현장 동영상
                            </h3>
                            <div className="bg-black aspect-video rounded border border-slate-600 relative flex items-center justify-center overflow-hidden group">
                                {cctvList.length > 0 ? (
                                    <>
                                        {/* Mock Video Placeholder */}
                                        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center">
                                            <Video size={40} className="text-slate-600 mb-2" />
                                            <span className="text-xs text-slate-500">CCTV Live Feed</span>
                                            <span className="text-xs text-blue-400 mt-1">{cctvList[currentCctvIndex].name}</span>
                                        </div>
                                        <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded animate-pulse">LIVE</div>
                                        
                                        {/* Pagination Controls */}
                                        {cctvList.length > 1 && (
                                            <>
                                                <button onClick={handlePrevCctv} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors">
                                                    <ChevronLeft size={20} />
                                                </button>
                                                <button onClick={handleNextCctv} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors">
                                                    <ChevronRight size={20} />
                                                </button>
                                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 px-2 py-0.5 rounded-full text-[10px] text-white">
                                                    {currentCctvIndex + 1} / {cctvList.length}
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-slate-500 text-xs flex flex-col items-center">
                                        <Video size={24} className="opacity-30 mb-1"/>
                                        연결된 CCTV가 없습니다.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Fire List */}
                        <div className="flex flex-col gap-2 flex-1">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <AlertTriangle size={16} className={fireDevices.length > 0 ? "text-red-500" : "text-slate-400"} /> 
                                화재 발생 현황
                            </h3>
                            <div className="bg-slate-900 border border-slate-600 rounded flex-1 min-h-[150px] overflow-y-auto custom-scrollbar p-2">
                                {fireDevices.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                                        <CheckCircle size={24} className="text-green-500/50" />
                                        <span>현재 화재 신호가 없습니다.</span>
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {fireDevices.map((d, idx) => (
                                            <li key={`${d.id}-${idx}`} className="bg-red-900/20 border border-red-500/30 p-2 rounded flex justify-between items-center animate-pulse">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-red-200">
                                                        {(d as any).stores && (d as any).stores.length > 0 ? (d as any).stores[0].name : '위치 미지정'}
                                                    </span>
                                                    <span className="text-xs text-red-400">
                                                        감지기 No.{(d as any).detectorId} (중계기 {(d as any).repeaterId})
                                                    </span>
                                                </div>
                                                <span className="bg-red-600 text-white text-[10px] px-1 rounded font-bold">화재</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 4. Action Button */}
                    <div className="p-4 border-t border-slate-700 bg-slate-800">
                        <Button 
                            variant="primary" 
                            className="w-full h-12 text-lg font-bold shadow-lg"
                            onClick={handleRecoverAll}
                            disabled={fireDevices.length === 0}
                        >
                            <RefreshCw size={20} className="mr-2" />
                            화재 복구
                        </Button>
                        <p className="text-[10px] text-center text-slate-500 mt-2">
                            * 버튼을 누르면 현장의 기기에 복구 신호를 전송합니다.
                        </p>
                    </div>
                </div>
            )}

            {/* Sidebar (Only in Edit Mode) */}
            {mode === 'edit' && (
                <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col shadow-xl z-20">
                    <div className="p-4 border-b border-slate-700 font-bold text-white flex justify-between items-center">
                        <span>미배치 기기 목록</span>
                        <span className="text-xs font-normal text-slate-400 bg-slate-900 px-2 py-0.5 rounded">Drag & Drop</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                        {/* Receivers */}
                        <div>
                            <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">수신기 (Square)</div>
                            {receivers.filter(d => !d.x_pos).length === 0 && <div className="text-xs text-slate-600 pl-2">모두 배치됨</div>}
                            {receivers
                                .filter(d => !d.x_pos)
                                .filter((d, index, self) => 
                                    index === self.findIndex((t) => t.macAddress === d.macAddress)
                                )
                                .map(d => (
                                <div key={d.id} draggable onDragStart={(e) => handleDragStart(e, 'receiver', d.id)} className="bg-slate-700 p-2 rounded mb-2 cursor-move hover:bg-slate-600 border border-slate-600 flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                                    <span className="text-sm">MAC: {d.macAddress}</span>
                                </div>
                            ))}
                        </div>

                        {/* Repeaters */}
                        <div>
                            <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">중계기 (Rounded)</div>
                            {repeaters.filter(d => !d.x_pos).length === 0 && <div className="text-xs text-slate-600 pl-2">모두 배치됨</div>}
                            {repeaters.filter(d => !d.x_pos).map(d => (
                                <div key={d.id} draggable onDragStart={(e) => handleDragStart(e, 'repeater', d.id)} className="bg-slate-700 p-2 rounded mb-2 cursor-move hover:bg-slate-600 border border-slate-600 flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-md"></div>
                                    <span className="text-sm">[{d.receiverMac}] ID: {d.repeaterId}</span>
                                </div>
                            ))}
                        </div>

                        {/* Detectors */}
                        <div>
                            <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">감지기 (Circle)</div>
                            {detectors.filter(d => !d.x_pos).length === 0 && <div className="text-xs text-slate-600 pl-2">모두 배치됨</div>}
                            {detectors.filter(d => !d.x_pos).map(d => (
                                <div key={d.id} draggable onDragStart={(e) => handleDragStart(e, 'detector', d.id)} className="bg-slate-700 p-2 rounded mb-2 cursor-move hover:bg-slate-600 border border-slate-600 flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span className="text-xs truncate">{d.receiverMac}-{d.repeaterId}-{d.detectorId}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Action Modal (Individual Device) */}
        {actionModalOpen && selectedAlertDevice && (
            <Modal isOpen={actionModalOpen} onClose={() => setActionModalOpen(false)} title="기기 상세 및 제어" width="max-w-md">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4 bg-slate-900 p-4 rounded border border-slate-700">
                        <div className={`w-12 h-12 flex items-center justify-center rounded-full text-xl font-bold text-white
                            ${(selectedAlertDevice as any).status === '화재' ? 'bg-red-600 animate-pulse' : 'bg-green-600'}
                        `}>
                            {(selectedAlertDevice as any).detectorId || (selectedAlertDevice as any).repeaterId || 'M'}
                        </div>
                        <div>
                            <div className="text-lg font-bold text-white">
                                {(selectedAlertDevice as any).stores && (selectedAlertDevice as any).stores.length > 0 ? (selectedAlertDevice as any).stores[0].name : '위치 미지정'}
                            </div>
                            <div className="text-sm text-slate-400">
                                {(selectedAlertDevice as any).type === 'detector' ? '화재감지기' : ((selectedAlertDevice as any).type === 'repeater' ? '중계기' : '수신기')}
                                <span className="mx-2">|</span>
                                상태: <span className={(selectedAlertDevice as any).status === '화재' ? 'text-red-400 font-bold' : 'text-green-400'}>{(selectedAlertDevice as any).status}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800 p-3 rounded text-sm text-slate-300 border border-slate-600">
                        <p>MAC: {(selectedAlertDevice as any).receiverMac}</p>
                        {(selectedAlertDevice as any).repeaterId && <p>중계기 ID: {(selectedAlertDevice as any).repeaterId}</p>}
                        {(selectedAlertDevice as any).detectorId && <p>감지기 ID: {(selectedAlertDevice as any).detectorId}</p>}
                        <p className="mt-2 text-xs text-slate-500">{(selectedAlertDevice as any).memo || '비고 없음'}</p>
                    </div>

                    <div className="flex gap-2 justify-end mt-2">
                        {(selectedAlertDevice as any).status === '화재' || (selectedAlertDevice as any).status === '고장' ? (
                            <>
                                <Button variant="danger" onClick={() => handleActionComplete('오탐')}>오탐 처리</Button>
                                <Button variant="primary" onClick={() => handleActionComplete('복구')}>상태 복구</Button>
                            </>
                        ) : (
                            <Button variant="secondary" disabled>정상 상태</Button>
                        )}
                        <Button variant="secondary" onClick={() => setActionModalOpen(false)}>닫기</Button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};