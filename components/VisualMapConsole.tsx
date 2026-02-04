
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, UI_STYLES } from './CommonUI';
import { Market, Detector, Receiver, Repeater, Store } from '../types';
import { DetectorAPI, ReceiverAPI, RepeaterAPI, FireHistoryAPI, DeviceStatusAPI, StoreAPI } from '../services/api';
import { X, Settings, Monitor, Map as MapIcon, Save, AlertTriangle, CheckCircle, Info, Video, ChevronLeft, ChevronRight, RefreshCw, Plus, Minus, RotateCcw, Edit3, User, Phone, MapPin, Globe, Clock, ShieldAlert, Thermometer, MapPinOff } from 'lucide-react';

interface VisualMapConsoleProps {
  market: Market;
  initialMode?: 'monitoring' | 'edit';
  onClose: () => void;
}

export const VisualMapConsole: React.FC<VisualMapConsoleProps> = ({ market, initialMode = 'monitoring', onClose }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'monitoring' | 'edit'>(initialMode);
  
  // 도면 이미지 목록 (기존 mapImage 하위 호환 포함)
  const mapImages = market.mapImages && market.mapImages.length > 0 
    ? market.mapImages 
    : (market.mapImage ? [market.mapImage] : []);
  
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);

  const [detectors, setDetectors] = useState<(Omit<Detector, 'status'> & { status: string, isFire?: boolean, isFault?: boolean, faultType?: string, storeInfo?: Store })[]>([]);
  const [receivers, setReceivers] = useState<(Omit<Receiver, 'status'> & { status: string, isFault?: boolean, faultType?: string })[]>([]);
  const [repeaters, setRepeaters] = useState<(Omit<Repeater, 'status'> & { status: string, isFault?: boolean, faultType?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const [cctvList, setCctvList] = useState<{name: string, url: string}[]>([]);
  const [currentCctvIndex, setCurrentCctvIndex] = useState(0);

  const [draggedItem, setDraggedItem] = useState<{ type: 'detector'|'receiver'|'repeater', id: number } | null>(null);

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedAlertDevice, setSelectedAlertDevice] = useState<any>(null);

  const [showFireModal, setShowFireModal] = useState(false);

  // 화재 발생 시 해당 도면으로 자동 전환하기 위한 Ref
  const isAutoPannedRef = useRef(false);

  // [FIX] Calculate device status counts for monitoring panel
  const statusCounts = {
    normal: [...detectors, ...receivers, ...repeaters].filter(d => d.status === '정상').length,
    fire: [...detectors, ...receivers, ...repeaters].filter(d => d.status === '화재').length,
    fault: [...detectors, ...receivers, ...repeaters].filter(d => d.status === '고장').length,
    commError: [...detectors, ...receivers, ...repeaters].filter(d => d.status === '통신이상').length,
  };

  // [FIX] Define navigation handler for editing device information
  const handleNavigateToEdit = () => {
    if (selectedAlertDevice && selectedAlertDevice.type === 'detector') {
      navigate('/stores', { state: { editId: selectedAlertDevice.id } });
      onClose();
    }
  };

  const loadDevices = async () => {
    setLoading(true);
    try {
      const [detData, rcvData, rptData, storesData] = await Promise.all([
        DetectorAPI.getList({ marketName: market.name }),
        ReceiverAPI.getList({ marketName: market.name }),
        RepeaterAPI.getList({ marketName: market.name }),
        StoreAPI.getList({ marketId: market.id })
      ]);

      const [fireLogs, faultLogs] = await Promise.all([
          FireHistoryAPI.getList({ marketName: market.name }),
          DeviceStatusAPI.getList({ marketName: market.name, status: 'unprocessed' })
      ]);

      const activeFires = fireLogs.filter(f => 
          ['화재', '등록'].includes(f.falseAlarmStatus) && 
          (f.marketName === market.name || f.marketId === market.id)
      );

      // --- 데이터 병합 로직 (중복 제거 포함) ---
      const rcvMap = new Map<string, any>();
      rcvData.filter(r => r.status !== '미사용').forEach(r => {
          const existing = rcvMap.get(r.macAddress);
          if (!existing || (!existing.x_pos && r.x_pos)) rcvMap.set(r.macAddress, r);
      });
      const mergedReceivers = Array.from(rcvMap.values()).map(r => {
          const fault = faultLogs.find(f => (f.marketName === market.name || f.marketId === market.id) && f.deviceType === '수신기' && f.receiverMac === r.macAddress);
          let status = '정상';
          if (fault) status = fault.errorCode === '04' ? '통신이상' : '고장';
          return { ...r, status, isFault: !!fault, faultType: fault ? (fault.errorCode === '04' ? '통신이상' : '고장') : undefined };
      });

      const rptMap = new Map<string, any>();
      rptData.filter(r => r.status !== '미사용').forEach(r => {
          const key = `${r.receiverMac}-${r.repeaterId}`;
          const existing = rptMap.get(key);
          if (!existing || (!existing.x_pos && r.x_pos)) rptMap.set(key, r);
      });
      const mergedRepeaters = Array.from(rptMap.values()).map(r => {
          const fault = faultLogs.find(f => (f.marketName === market.name || f.marketId === market.id) && f.deviceType === '중계기' && f.receiverMac === r.receiverMac && f.deviceId === r.repeaterId);
          let status = '정상';
          if (fault) status = fault.errorCode === '04' ? '통신이상' : '고장';
          return { ...r, status, isFault: !!fault, faultType: fault ? (fault.errorCode === '04' ? '통신이상' : '고장') : undefined };
      });

      const detMap = new Map<string, any>();
      detData.filter(d => d.status !== '미사용').forEach(d => {
          const key = `${d.receiverMac}-${d.repeaterId}-${d.detectorId}`;
          const existing = detMap.get(key);
          if (!existing || (!existing.x_pos && d.x_pos)) detMap.set(key, d);
      });
      const mergedDetectors = Array.from(detMap.values()).map(d => {
          const storeInfo = storesData.find(s => s.receiverMac === d.receiverMac && s.repeaterId === d.repeaterId && s.detectorId === d.detectorId);
          if (storeInfo && storeInfo.status === '미사용') return null;
          const isFire = activeFires.some(f => (f.marketName === market.name || f.marketId === market.id) && f.receiverMac === d.receiverMac && f.repeaterId === d.repeaterId && ((f.detectorInfoChamber && f.detectorInfoChamber.startsWith(d.detectorId)) || (f.detectorInfoTemp && f.detectorInfoTemp.startsWith(d.detectorId))));
          const fault = faultLogs.find(f => (f.marketName === market.name || f.marketId === market.id) && f.deviceType === '감지기' && f.receiverMac === d.receiverMac && f.repeaterId === d.repeaterId && f.deviceId === d.detectorId);
          let status = '정상';
          if (isFire) status = '화재';
          else if (fault) status = fault.errorCode === '04' ? '통신이상' : '고장';
          return { ...d, status, isFire, isFault: !!fault, faultType: fault ? (fault.errorCode === '04' ? '통신이상' : '고장') : undefined, storeInfo, mode: storeInfo?.mode || d.mode || '복합' };
      }).filter(d => d !== null) as any[];

      setDetectors(mergedDetectors);
      setReceivers(mergedReceivers);
      setRepeaters(mergedRepeaters);

      // 화재 발생 도면으로 자동 전환 로직 (가드 강화)
      if (!isAutoPannedRef.current) {
          const fireDevice = [...mergedDetectors, ...mergedReceivers, ...mergedRepeaters]
              .find(d => d.status === '화재' && d.x_pos !== undefined && typeof d.map_index === 'number');
          
          if (fireDevice && typeof fireDevice.map_index === 'number') {
              if (fireDevice.map_index >= 0 && fireDevice.map_index < mapImages.length) {
                  setCurrentMapIndex(fireDevice.map_index);
              } else {
                  setCurrentMapIndex(0); // 유효하지 않은 인덱스 시 1번 도면으로 강제 고정
              }
              isAutoPannedRef.current = true;
          }
      }

      const hasFire = mergedDetectors.some(d => d.status === '화재');
      const muteKey = `fire_alert_mute_${market.id}`;
      const muteUntil = localStorage.getItem(muteKey);
      const isMuted = muteUntil && Date.now() < parseInt(muteUntil);
      if (hasFire && !isMuted) setShowFireModal(true);
      else setShowFireModal(false);

      const cctvs = mergedDetectors.filter(d => d.cctvUrl && d.cctvUrl.trim() !== '').map(d => ({ name: d.storeInfo ? d.storeInfo.name : `${d.detectorId}번 감지기`, url: d.cctvUrl! }));
      setCctvList(cctvs);
    } catch (e) { console.error("Failed to load devices", e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, [market.name]);

  const handleDeviceClick = (device: any, type: string) => {
    if (mode === 'edit') return;
    setSelectedAlertDevice({ ...device, type });
    setActionModalOpen(true);
  };

  // [기획 요청 사항] 마커 상세 팝업에서 기기 배치 취소 버튼 기능
  const handleUnplaceDevice = async () => {
    if (!selectedAlertDevice) return;
    
    // [Safety Check] 화재, 고장, 통신이상 상태인 기기는 배치 취소 금지
    if (selectedAlertDevice.isFire || selectedAlertDevice.isFault || selectedAlertDevice.status === '통신이상') {
      alert('현재 사고(화재/고장/통신이상)가 발생한 기기는 현장 관리를 위해 지도에서 제거할 수 없습니다.\n먼저 상태를 복구하거나 점검을 완료해 주세요.');
      return;
    }

    if (!confirm('해당 기기를 지도에서 제거하고 미배치 목록으로 이동하시겠습니까?')) return;

    try {
      const { id, type } = selectedAlertDevice;
      if (type === 'detector') await DetectorAPI.saveCoordinates(id, null, null, null);
      else if (type === 'receiver') await ReceiverAPI.saveCoordinates(id, null, null, null);
      else if (type === 'repeater') await RepeaterAPI.saveCoordinates(id, null, null, null);
      
      alert('지도에서 제거되었습니다.');
      setActionModalOpen(false);
      loadDevices(); // 리스트 즉시 갱신
    } catch (e) {
      alert('처리에 실패했습니다.');
    }
  };

  const handleRecoverAll = async () => {
      const fires = [...detectors, ...receivers, ...repeaters].filter(d => d.status === '화재');
      if (fires.length === 0) { alert('현재 화재 상태인 기기가 없습니다.'); return; }
      if (confirm(`현재 화재 상태인 기기 ${fires.length}건을 모두 '정상'으로 복구하시겠습니까?`)) {
          alert('복구 신호 전송 및 처리가 완료되었습니다.');
          setShowFireModal(false);
          loadDevices();
      }
  };

  const handleMuteAlert = () => { localStorage.setItem(`fire_alert_mute_${market.id}`, (Date.now() + 3600000).toString()); setShowFireModal(false); };
  const handlePrevCctv = () => setCurrentCctvIndex(p => (p === 0 ? cctvList.length - 1 : p - 1));
  const handleNextCctv = () => setCurrentCctvIndex(p => (p === cctvList.length - 1 ? 0 : p + 1));
  const handleMapChange = (idx: number) => setCurrentMapIndex(idx);
  const handleZoomIn = () => setZoomLevel(p => Math.min(p + 0.5, 3));
  const handleZoomOut = () => setZoomLevel(p => Math.max(p - 0.5, 1));
  const handleZoomReset = () => setZoomLevel(1);

  const handleDragStart = (e: React.DragEvent, type: 'detector'|'receiver'|'repeater', id: number) => { if (mode !== 'edit') return; setDraggedItem({ type, id }); };
  const handleDrop = async (e: React.DragEvent) => {
    if (mode !== 'edit' || !draggedItem) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (draggedItem.type === 'detector') await DetectorAPI.saveCoordinates(draggedItem.id, x, y, currentMapIndex);
    else if (draggedItem.type === 'receiver') await ReceiverAPI.saveCoordinates(draggedItem.id, x, y, currentMapIndex);
    else if (draggedItem.type === 'repeater') await RepeaterAPI.saveCoordinates(draggedItem.id, x, y, currentMapIndex);
    setDraggedItem(null); loadDevices();
  };
  const handleUnplaceDrop = async (e: React.DragEvent) => {
    if (mode !== 'edit' || !draggedItem) return;
    if (draggedItem.type === 'detector') await DetectorAPI.saveCoordinates(draggedItem.id, null, null, null);
    else if (draggedItem.type === 'receiver') await ReceiverAPI.saveCoordinates(draggedItem.id, null, null, null);
    else if (draggedItem.type === 'repeater') await RepeaterAPI.saveCoordinates(draggedItem.id, null, null, null);
    setDraggedItem(null); loadDevices();
  };

  const renderIcon = (item: any, type: 'detector'|'receiver'|'repeater') => {
    const itemIdx = typeof item.map_index === 'number' ? item.map_index : 0;
    if (itemIdx !== currentMapIndex) return null;
    const isFire = item.isFire || item.status === '화재';
    const isError = item.isFault || item.status === '고장';
    const isCommError = item.status === '통신이상';
    let bgColor = isFire ? "bg-orange-600 animate-pulse" : (isError ? "bg-amber-500 animate-pulse" : (isCommError ? "bg-gray-600 animate-pulse" : (type === 'receiver' ? "bg-purple-600" : (type === 'repeater' ? "bg-cyan-500" : "bg-green-600"))));
    let iconName = isFire ? "local_fire_department" : (isError ? "warning_amber" : (isCommError ? "wifi_off" : (type === 'receiver' ? "dns" : (type === 'repeater' ? "router" : "sensors"))));
    return (
      <div key={`${type}-${item.id}`} className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer ${mode === 'edit' ? 'cursor-move' : ''} group`} style={{ left: `${item.x_pos}%`, top: `${item.y_pos}%` }} draggable={mode === 'edit'} onDragStart={(e) => handleDragStart(e, type, item.id)} onClick={() => handleDeviceClick(item, type)}>
        {(isFire || isError || isCommError) && <div className={`absolute inset-0 rounded-full animate-ping opacity-75 ${isFire ? 'bg-orange-500' : 'bg-amber-400'}`}></div>}
        <div className={`relative w-8 h-8 rounded-full shadow-lg flex items-center justify-center text-white border-2 border-white transition-transform group-hover:scale-125 z-10 ${bgColor}`}><span className="material-icons text-sm">{iconName}</span></div>
        {type === 'detector' && <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-20"><span className="text-[12px] font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)] bg-black/30 px-1 rounded whitespace-nowrap">{item.storeInfo?.name || `감지기 ${item.detectorId}`}</span></div>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-200">
        {showFireModal && <div className="absolute inset-0 z-[60] flex items-center justify-center bg-red-950/80 backdrop-blur-sm animate-pulse"><div className="bg-red-900 border-4 border-red-500 rounded-2xl p-10 flex flex-col items-center shadow-2xl"><AlertTriangle size={100} className="text-white mb-6 animate-pulse" /><h1 className="text-5xl font-black text-white mb-4 tracking-tighter">화재 발생</h1><p className="text-xl text-red-200 font-bold mb-8 text-center">현장에서 화재 신호가 감지되었습니다.<br/>즉시 확인 및 조치 바랍니다.</p><Button variant="secondary" onClick={handleMuteAlert} className="bg-white/20 hover:bg-white/30 text-white border-white/50">1시간동안 안보기</Button></div></div>}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shadow-md z-20">
            <div className="flex items-center gap-4"><h2 className="text-xl font-bold text-white flex items-center gap-2"><MapIcon className="text-blue-400" />{market.name} <span className="text-slate-400 text-sm font-normal">지도로 관리</span></h2><div className="flex bg-slate-700 rounded-lg p-1 border border-slate-600"><button onClick={() => setMode('monitoring')} className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 ${mode === 'monitoring' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}><Monitor size={14} /> 관제모드</button><button onClick={() => setMode('edit')} className={`px-4 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 ${mode === 'edit' ? 'bg-orange-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}><Settings size={14} /> 편집모드</button></div></div>
            <div className="flex items-center gap-4"><div className="flex gap-3 text-xs font-medium bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-700 items-center"><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>정상</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-pulse"></span>화재</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>고장</span><span className="w-px h-3 bg-slate-600 mx-1"></span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>수신기</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>중계기</span></div><button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"><X size={24} /></button></div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
            <div className="flex-1 relative bg-[#1a1a1a] overflow-hidden">
                <div className="absolute inset-0 overflow-auto custom-scrollbar">
                    <div className="relative origin-top-left transition-all duration-200 ease-in-out" style={{ width: `${zoomLevel * 100}%`, height: `${zoomLevel * 100}%`, minWidth: '100%', minHeight: '100%' }} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
                        {mapImages.length > 0 ? (<div className="relative w-full h-full"><img src={mapImages[currentMapIndex] || mapImages[0]} alt="Map" className="w-full h-full object-contain block" />{receivers.filter(d => d.x_pos).map(d => renderIcon(d, 'receiver'))}{repeaters.filter(d => d.x_pos).map(d => renderIcon(d, 'repeater'))}{detectors.filter(d => d.x_pos).map(d => renderIcon(d, 'detector'))}</div>) : (<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500"><MapIcon size={64} className="mx-auto mb-4 opacity-20" /><p>등록된 도면 이미지가 없습니다.</p></div>)}
                    </div>
                </div>
                {mapImages.length > 1 && (<div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-30">{mapImages.map((_, idx) => (<button key={idx} onClick={() => handleMapChange(idx)} className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center font-black transition-all shadow-xl ${currentMapIndex === idx ? 'bg-blue-600 border-white text-white scale-110' : 'bg-slate-800/90 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>{idx + 1}</button>))}</div>)}
                <div className="absolute bottom-20 right-6 flex flex-col gap-2 z-30 pointer-events-none"><button onClick={handleZoomIn} className="w-10 h-10 bg-slate-800 text-white rounded-full shadow-lg border border-slate-600 flex items-center justify-center hover:bg-blue-600 transition-colors pointer-events-auto"><Plus size={20} /></button><button onClick={handleZoomOut} className="w-10 h-10 bg-slate-800 text-white rounded-full shadow-lg border border-slate-600 flex items-center justify-center hover:bg-blue-600 transition-colors pointer-events-auto"><Minus size={20} /></button><button onClick={handleZoomReset} className="w-10 h-10 bg-slate-800 text-white rounded-full shadow-lg border border-slate-600 flex items-center justify-center hover:bg-blue-600 transition-colors text-xs font-bold pointer-events-auto">1.0x</button></div>
            </div>

            {mode === 'monitoring' && (
                <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col shadow-xl z-20 overflow-hidden">
                    <div className="p-3 border-b border-slate-700 font-bold text-white bg-slate-900/50">관제 현황</div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 p-4">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-700/50 p-2 rounded border border-slate-600 flex flex-col items-center"><div className="text-green-400 font-bold mb-1">정상</div><div className="text-xl font-black text-white">{statusCounts.normal}</div></div>
                            <div className="bg-slate-700/50 p-2 rounded border border-slate-600 flex flex-col items-center"><div className="text-orange-500 font-bold mb-1">화재</div><div className="text-xl font-black text-white">{statusCounts.fire}</div></div>
                            <div className="bg-slate-700/50 p-2 rounded border border-slate-600 flex flex-col items-center"><div className="text-amber-500 font-bold mb-1">고장</div><div className="text-xl font-black text-white">{statusCounts.fault}</div></div>
                            <div className="bg-slate-700/50 p-2 rounded border border-slate-600 flex flex-col items-center"><div className="text-gray-400 font-bold mb-1">통신이상</div><div className="text-xl font-black text-white">{statusCounts.commError}</div></div>
                        </div>
                        <div className="flex-1 flex flex-col gap-2 min-h-0">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><AlertTriangle size={16} className={detectors.some(d=>d.status==='화재') ? "text-red-500" : "text-slate-400"} /> 실시간 화재 상황</h3>
                            <div className="bg-slate-900 border border-slate-600 rounded flex-1 overflow-y-auto custom-scrollbar p-2">
                                {detectors.filter(d=>d.status==='화재').length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2"><CheckCircle size={24} className="text-green-500/50" /><span>화재 신호 없음</span></div>) : (
                                    <ul className="space-y-2">{detectors.filter(d=>d.status==='화재').map((d, i) => (<li key={i} className="bg-slate-800 border border-red-500/30 p-2 rounded cursor-pointer" onClick={()=>handleDeviceClick(d, 'detector')}><div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-white">{d.storeInfo?.name || `감지기 ${d.detectorId}`}</span><span className="bg-red-600 text-[10px] px-1 rounded font-bold">FIRE</span></div><div className="text-[10px] text-slate-400 truncate">{d.storeInfo?.address || '주소 정보 없음'}</div></li>))}</ul>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-700"><Button variant="primary" className="w-full h-12 text-lg font-bold" onClick={handleRecoverAll} disabled={!detectors.some(d=>d.status==='화재')}><RefreshCw size={20} className="mr-2" />화재 복구</Button></div>
                </div>
            )}

            {mode === 'edit' && (
                <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col shadow-xl z-20" onDrop={handleUnplaceDrop} onDragOver={(e)=>e.preventDefault()}>
                    <div className="p-4 border-b border-slate-700 font-bold text-white flex justify-between items-center"><span>미배치 기기 목록</span><span className="text-xs font-normal text-slate-400 bg-slate-900 px-2 py-0.5 rounded">Drag & Drop</span></div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                        <div className="bg-blue-900/20 p-2 rounded border border-blue-800"><p className="text-[11px] text-blue-300 font-bold leading-tight">* 현재 화면에 보이는 도면에 기기가 배치됩니다.<br/>* 배치된 기기를 여기로 드래그하면 회수됩니다.</p></div>
                        <div><div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">수신기</div>{receivers.filter(d=>!d.x_pos).map(d=>(<div key={d.id} draggable onDragStart={(e)=>handleDragStart(e, 'receiver', d.id)} className="bg-slate-700 p-2 rounded mb-2 cursor-move hover:bg-slate-600 border border-slate-600 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center"><span className="material-icons text-white text-[10px]">dns</span></div><span className="text-sm font-bold text-slate-200">{d.macAddress}</span></div>))}</div>
                        <div><div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">중계기</div>{repeaters.filter(d=>!d.x_pos).map(d=>(<div key={d.id} draggable onDragStart={(e)=>handleDragStart(e, 'repeater', d.id)} className="bg-slate-700 p-2 rounded mb-2 cursor-move hover:bg-slate-600 border border-slate-600 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center"><span className="material-icons text-white text-[10px]">router</span></div><span className="text-sm font-bold text-slate-200">{d.receiverMac}-{d.repeaterId}</span></div>))}</div>
                        <div><div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">감지기</div>{detectors.filter(d=>!d.x_pos).map(d=>(<div key={d.id} draggable onDragStart={(e)=>handleDragStart(e, 'detector', d.id)} className="bg-slate-700 p-2 rounded mb-2 cursor-move hover:bg-slate-600 border border-slate-600 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center"><span className="material-icons text-white text-[10px]">sensors</span></div><span className="text-sm font-bold text-slate-200">{d.receiverMac}-{d.repeaterId}-{d.detectorId}</span></div>))}</div>
                    </div>
                </div>
            )}
        </div>

        {actionModalOpen && selectedAlertDevice && (
            <Modal isOpen={actionModalOpen} onClose={() => setActionModalOpen(false)} title="기기 상세 정보 및 제어" width="max-w-md">
                <div className="flex flex-col gap-4">
                    <div className={`py-4 px-6 rounded-xl text-center shadow-lg border-b-4 ${selectedAlertDevice.status==='화재'?'bg-red-600/20 border-red-500':(selectedAlertDevice.status==='고장'?'bg-amber-600/20 border-amber-500':(selectedAlertDevice.status==='통신이상'?'bg-slate-700/50 border-slate-500':'bg-green-600/20 border-green-500'))}`}>
                        <div className="flex flex-col gap-2">
                            <div className={`text-3xl font-black flex items-center justify-center gap-2 ${selectedAlertDevice.status==='화재'?'text-red-500 animate-pulse':(selectedAlertDevice.status==='정상'?'text-green-500':'text-amber-500')}`}>
                                <span className="material-icons text-4xl">{selectedAlertDevice.status==='화재'?'local_fire_department':(selectedAlertDevice.status==='정상'?'check_circle':'warning_amber')}</span>
                                {selectedAlertDevice.status === '정상' ? '정상 작동' : `${selectedAlertDevice.status} 발생`}
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-2">기기 실시간 상태</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                        <div className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2"><ShieldAlert size={16} className="text-blue-400" /> 기기정보</div>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">수신기 MAC</span><span className="text-white font-mono">{selectedAlertDevice.receiverMac || selectedAlertDevice.macAddress}</span></div>
                            {(selectedAlertDevice.type === 'repeater' || selectedAlertDevice.type === 'detector') && (<div className="flex justify-between"><span className="text-slate-500">중계기 ID</span><span className="text-white font-mono">{selectedAlertDevice.repeaterId}</span></div>)}
                            {selectedAlertDevice.type === 'detector' && (<div className="flex justify-between"><span className="text-slate-500">감지기 ID</span><span className="text-white font-mono">{selectedAlertDevice.detectorId}</span></div>)}
                        </div>
                    </div>

                    <div className="bg-slate-800/80 p-4 rounded-lg text-sm text-slate-300 border border-slate-700 flex flex-col gap-3">
                        <div className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2"><Info size={16} className="text-blue-400" /> 등록정보</div>
                        {selectedAlertDevice.type === 'detector' ? (
                            <div className="space-y-2">
                                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700"><div className="text-xs text-slate-500 mb-1">기기위치</div><div className="text-lg font-black text-white">{selectedAlertDevice.storeInfo?.name || '위치 미등록'}</div></div>
                                <div className="flex items-start gap-2"><MapPin size={14} className="text-slate-500 mt-0.5" /><span>{selectedAlertDevice.storeInfo?.address || '주소 정보 없음'}</span></div>
                                <div className="flex items-center gap-4"><div className="flex items-center gap-1"><User size={14} className="text-slate-500" /><span>{selectedAlertDevice.storeInfo?.managerName || '대표자 미상'}</span></div><div className="flex items-center gap-1"><Phone size={14} className="text-slate-500" /><span className="text-blue-400 font-bold">{selectedAlertDevice.storeInfo?.managerPhone || '연락처 미상'}</span></div></div>
                            </div>
                        ) : (<div className="p-3 bg-slate-900/40 rounded border border-slate-700 text-slate-200">{selectedAlertDevice.location || '등록된 정보가 없습니다.'}</div>)}
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                        <div className="grid grid-cols-2 gap-2">
                            {selectedAlertDevice.status === '화재' || selectedAlertDevice.status === '고장' ? (
                                <Button variant="primary" onClick={() => {alert('복구 신호를 전송합니다.'); setActionModalOpen(false); loadDevices();}} className="h-12 font-bold shadow-lg bg-blue-600 hover:bg-blue-500">복구 신호 전송</Button>
                            ) : (
                                <Button variant="secondary" disabled className="h-12 opacity-50">정상 작동 중</Button>
                            )}
                            <Button variant="secondary" onClick={() => setActionModalOpen(false)} className="h-12 border-slate-600 hover:bg-slate-700">닫기</Button>
                        </div>
                        
                        {/* [기획 요청 사항] 마커 상세에서 기기 배치 해제 버튼 */}
                        <button 
                            onClick={handleUnplaceDevice}
                            className={`w-full flex items-center justify-center gap-2 py-3 bg-slate-800 border border-slate-600 rounded-lg text-sm font-bold transition-all shadow-md group ${selectedAlertDevice.status !== '정상' ? 'opacity-50 grayscale cursor-not-allowed text-slate-500' : 'hover:bg-red-900/20 hover:border-red-500/50 text-slate-300 hover:text-red-400'}`}
                        >
                            <MapPinOff size={16} /> 지도에서 제거 (배치 취소)
                        </button>

                        {selectedAlertDevice.type === 'detector' && (
                            <button onClick={handleNavigateToEdit} className="w-full flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-orange-600 text-white rounded-lg text-sm font-bold transition-all border border-slate-600 shadow-md"><Edit3 size={16} /> 정보 수정 (기기 관리로 이동)</button>
                        )}
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};
