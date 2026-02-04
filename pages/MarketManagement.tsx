import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, 
  Button, DataTable, Pagination, ActionBar, FormSection, FormRow, Column, AddressInput,
  formatPhoneNumber, handlePhoneKeyDown, StatusBadge, UI_STYLES, Modal
} from '../components/CommonUI';
import { Market, Distributor } from '../types';
import { MarketAPI, DistributorAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';
import { Search, Upload, Paperclip, X, Plus, Map as MapIcon, Menu as MenuIcon, Download } from 'lucide-react';
import { VisualMapConsole } from '../components/VisualMapConsole';

const ITEMS_PER_PAGE = 10;
const MODAL_ITEMS_PER_PAGE = 5;

// --- Helper Component: Radio Group for Configuration ---
const ConfigRadioGroup: React.FC<{
  label: string;
  name: string;
  value: string | undefined;
  onChange: (val: string) => void;
  options?: string[];
}> = ({ label, name, value, onChange, options = ['사용', '미사용'] }) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className={UI_STYLES.label}>{label}</label>
    <div className={`${UI_STYLES.input} flex gap-6 items-center`}>
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer hover:text-white">
          <input 
            type="radio" 
            name={name} 
            value={opt} 
            checked={value === opt} 
            onChange={() => onChange(opt)} 
            className="accent-blue-500 w-4 h-4" 
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  </div>
);

// --- Interface for managing images locally ---
interface ImageItem {
    id: string; // Unique ID for Drag key
    url?: string;
    file?: File;
    name: string;
}

export const MarketManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form' | 'list'>('list');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Search Filters
  const [searchName, setSearchName] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [searchManager, setSearchManager] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);
  
  // --- Form Data State ---
  const [formData, setFormData] = useState<Partial<Market>>({});
  
  // Multiple Image Upload State
  const [imageList, setImageList] = useState<ImageItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Drag state
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // SMS Lists Management (Edit Mode Only)
  const [fireSmsList, setFireSmsList] = useState<string[]>([]);
  const [faultSmsList, setFaultSmsList] = useState<string[]>([]);
  const [tempFireSms, setTempFireSms] = useState('');
  const [tempFaultSms, setTempFaultSms] = useState('');

  // Distributor Search Modal
  const [isDistModalOpen, setIsDistModalOpen] = useState(false);
  const [distList, setDistList] = useState<Distributor[]>([]);
  const [distSearchName, setDistSearchName] = useState('');
  const [distPage, setDistPage] = useState(1);

  // Visual Map Console State
  const [visualMapMarket, setVisualMapMarket] = useState<Market | null>(null);
  
  // --- Initial Data Load ---
  const fetchMarkets = async (overrides?: { name?: string, address?: string, managerName?: string }) => {
    setLoading(true);
    try {
      const query = {
        name: overrides?.name !== undefined ? overrides.name : searchName,
        address: overrides?.address !== undefined ? overrides.address : searchAddress,
        managerName: overrides?.managerName !== undefined ? overrides.managerName : searchManager
      };

      const data = await MarketAPI.getList(query);
      setMarkets(data);
      setCurrentPage(1);
    } catch (e) {
      alert('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  // --- Handlers: Search ---
  const handleSearch = () => {
    setIsFiltered(true);
    fetchMarkets();
  };

  const handleReset = () => {
    setSearchName('');
    setSearchAddress('');
    setSearchManager('');
    setIsFiltered(false);
    fetchMarkets({ name: '', address: '', managerName: '' });
  };

  // --- Handlers: List Actions ---
  const handleRegister = () => { 
    setSelectedMarket(null);
    setFormData({
      name: '',
      address: '',
      addressDetail: '',
      managerName: '',
      managerPhone: '',
      managerEmail: '',
      memo: '',
      enableMarketSms: '사용',
      enableStoreSms: '사용',
      enableMultiMedia: '사용',
      multiMediaType: '복합',
      usageStatus: '사용',
      enableDeviceFaultSms: '사용',
      enableCctvUrl: '사용',
      status: 'Normal'
    });
    setFireSmsList([]);
    setFaultSmsList([]);
    setImageList([]);
    if(fileInputRef.current) fileInputRef.current.value = '';
    setView('form'); 
  };
  
  const handleEdit = (market: Market) => { 
    setSelectedMarket(market);
    setFormData({ ...market });
    setFireSmsList(market.smsFire || []);
    setFaultSmsList(market.smsFault || []);
    
    // Initialize Image List from mapImages (or legacy mapImage)
    const initialImages: ImageItem[] = [];
    if (market.mapImages && market.mapImages.length > 0) {
        market.mapImages.forEach((url, idx) => {
            initialImages.push({
                id: `existing-${idx}-${Date.now()}`,
                url: url,
                name: decodeURIComponent(url.split('/').pop() || `이미지_${idx + 1}`)
            });
        });
    } else if (market.mapImage) {
        initialImages.push({
            id: `legacy-${Date.now()}`,
            url: market.mapImage,
            name: decodeURIComponent(market.mapImage.split('/').pop() || '이미지_1')
        });
    }
    setImageList(initialImages);

    if(fileInputRef.current) fileInputRef.current.value = '';
    setView('form'); 
  };

  const handleOpenMapEditor = (e: React.MouseEvent, market: Market) => {
    e.stopPropagation(); 
    // Check either legacy or new array
    if (!market.mapImage && (!market.mapImages || market.mapImages.length === 0)) {
        alert('등록된 지도 이미지가 없습니다.\n먼저 현장 수정에서 지도를 등록해주세요.');
        return;
    }
    setVisualMapMarket(market);
  };
  
  const handleExcel = () => {
    const excelData = markets.map((m, index) => ({
      'No': index + 1,
      '총판': m.distributorName || '-',
      '현장명': m.name,
      '주소': `${m.address} ${m.addressDetail || ''}`.trim(),
      '담당자명': m.managerName,
      '담당자연락처': m.managerPhone,
      '상태': m.status,
      '사용여부': m.usageStatus
    }));
    exportToExcel(excelData, '현장관리_목록');
  };

  // --- Handlers: Form Save ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) { alert('현장명을 입력해주세요.'); return; }
    if (!formData.address) { alert('주소를 입력해주세요.'); return; }

    try {
      // 1. Upload new files and gather all URLs
      const uploadedUrls: string[] = [];
      
      for (const item of imageList) {
          if (item.file) {
              const url = await MarketAPI.uploadMapImage(item.file);
              uploadedUrls.push(url);
          } else if (item.url) {
              uploadedUrls.push(item.url);
          }
      }

      // 2. Construct final data
      const newMarket: Market = {
        ...formData as Market,
        id: selectedMarket?.id || 0,
        mapImages: uploadedUrls, // Save array
        mapImage: uploadedUrls.length > 0 ? uploadedUrls[0] : undefined, // Maintain legacy column with first image
        smsFire: fireSmsList,
        smsFault: faultSmsList,
        status: selectedMarket?.status || 'Normal',
      };

      await MarketAPI.save(newMarket);
      alert('저장되었습니다.');
      setView('list');
      fetchMarkets();
    } catch (e: any) {
      alert('저장 실패: ' + e.message);
    }
  };

  const handleDelete = async () => {
    if(selectedMarket && confirm('정말 삭제하시겠습니까?\n해당 현장에 속한 모든 데이터가 영향을 받을 수 있습니다.')) {
        try {
            await MarketAPI.delete(selectedMarket.id);
            alert('삭제되었습니다.');
            setView('list');
            fetchMarkets();
        } catch(e) {
            alert('삭제 실패');
        }
    }
  };

  // --- Handlers: Multiple Image ---
  const handleFileSelectClick = () => {
    if (imageList.length >= 10) {
        alert("이미지는 최대 10장까지만 등록 가능합니다.");
        return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // [FIX] Explicitly cast to File[] to ensure correct type for the .map operation below
      const newFiles = Array.from(e.target.files) as File[];
      const remainingSlots = 10 - imageList.length;
      
      if (newFiles.length > remainingSlots) {
          alert(`최대 10장까지만 등록 가능합니다. (${remainingSlots}장 추가 가능)`);
          return;
      }

      // [FIX] Explicitly type 'file' parameter in map to avoid 'unknown' error
      const newItems: ImageItem[] = newFiles.slice(0, remainingSlots).map((file: File) => ({
          id: `new-${Date.now()}-${Math.random()}`,
          file: file,
          name: file.name
      }));

      setImageList(prev => [...prev, ...newItems]);
    }
    // Reset input to allow selecting same file again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index: number) => {
    if (confirm("이미지를 목록에서 제거하시겠습니까?")) {
        setImageList(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleDownloadImage = (item: ImageItem) => {
      const url = item.url || (item.file ? URL.createObjectURL(item.file) : '');
      if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.download = item.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          if (item.file) URL.revokeObjectURL(url);
      }
  };

  // --- Handlers: Drag & Drop (Image Reordering) ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedItemIndex(index);
      e.dataTransfer.effectAllowed = "move";
      // Firefox requires dataTransfer data to be set
      e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault(); // Necessary to allow dropping
      if (draggedItemIndex === null || draggedItemIndex === index) return;
      
      // Reorder logic on hover (optional, or do it on drop)
      // Here implementing simple reorder on Drop for stability
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedItemIndex === null || draggedItemIndex === index) return;

      const newList = [...imageList];
      const [draggedItem] = newList.splice(draggedItemIndex, 1);
      newList.splice(index, 0, draggedItem);
      
      setImageList(newList);
      setDraggedItemIndex(null);
  };

  // --- Handlers: SMS Lists ---
  const addFireSms = () => {
    if (tempFireSms.trim()) {
        setFireSmsList([...fireSmsList, tempFireSms.trim()]);
        setTempFireSms('');
    }
  };
  const removeFireSms = (idx: number) => {
    setFireSmsList(fireSmsList.filter((_, i) => i !== idx));
  };

  const addFaultSms = () => {
    if (tempFaultSms.trim()) {
        setFaultSmsList([...faultSmsList, tempFaultSms.trim()]);
        setTempFaultSms('');
    }
  };
  const removeFaultSms = (idx: number) => {
    setFaultSmsList(faultSmsList.filter((_, i) => i !== idx));
  };

  // --- Handlers: Distributor Modal ---
  const fetchDistributors = async () => {
    const data = await DistributorAPI.getList({ name: distSearchName });
    const activeDistributors = data.filter(d => d.status === '사용');
    setDistList(activeDistributors);
    setDistPage(1);
  };

  const openDistModal = () => {
    setDistSearchName('');
    fetchDistributors();
    setIsDistModalOpen(true);
  };

  const handleDistSelect = (dist: Distributor) => {
    setFormData({ ...formData, distributorId: dist.id, distributorName: dist.name });
    setIsDistModalOpen(false);
  };

  // --- Columns ---
  const columns: Column<Market>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '총판', accessor: 'distributorName' },
    { header: '현장명', accessor: 'name' },
    { header: '주소', accessor: (m) => `${m.address} ${m.addressDetail || ''}` },
    { header: '담당자명', accessor: 'managerName' },
    { header: '담당자연락처', accessor: (m) => formatPhoneNumber(m.managerPhone || '') },
    { header: '사용여부', accessor: (m: Market) => <StatusBadge status={m.usageStatus || '사용'} />, width: '100px' },
    { 
        header: '지도배치', 
        accessor: (m: Market) => (
            <Button 
                variant="secondary" 
                className="h-7 text-xs px-2 bg-slate-700 hover:bg-blue-600 border-slate-600" 
                onClick={(e) => handleOpenMapEditor(e, m)}
                title="기기 배치 편집"
            >
                <MapIcon size={14} className="mr-1"/> 배치
            </Button>
        ), 
        width: '100px' 
    },
  ];

  const distColumns: Column<Distributor>[] = [
    { header: '총판명', accessor: 'name' },
    { header: '담당자', accessor: 'managerName' },
    { header: '연락처', accessor: 'managerPhone' },
    { header: '선택', accessor: (item) => (
        <Button variant="primary" onClick={() => handleDistSelect(item)} className="px-2 py-1 text-xs">선택</Button>
    ), width: '80px' }
  ];

  // --- Pagination Logic ---
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = markets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(markets.length / ITEMS_PER_PAGE);

  const modalDistLast = distPage * MODAL_ITEMS_PER_PAGE;
  const modalDistFirst = modalDistLast - MODAL_ITEMS_PER_PAGE;
  const currentDists = distList.slice(modalDistFirst, modalDistLast);

  // --- View: Form ---
  if (view === 'form') {
    return (
      <>
        <PageHeader title="현장 관리" />
        <form onSubmit={handleSave}>
          <FormSection title={selectedMarket ? "현장 수정" : "현장 등록"}>
              {/* 1. 총판 & 현장명 */}
              <FormRow label="총판" className="col-span-1">
                 <div className="flex gap-2 w-full">
                    <div onClick={openDistModal} className="flex-1 relative cursor-pointer">
                        <input 
                           type="text" 
                           value={formData.distributorName || ''} 
                           placeholder="총판 선택" 
                           readOnly 
                           className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
                        />
                        <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                    </div>
                    <Button type="button" variant="secondary" onClick={openDistModal}>찾기</Button>
                 </div>
              </FormRow>
              <FormRow label="현장명" required className="col-span-1">
                <InputGroup 
                  value={formData.name || ''} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </FormRow>
              
              {/* 2. 주소 (Full Width) */}
              <div className="col-span-1 md:col-span-2">
                <AddressInput 
                   label="주소"
                   required
                   address={formData.address || ''}
                   addressDetail={formData.addressDetail || ''}
                   onAddressChange={(val) => setFormData(prev => ({...prev, address: val}))}
                   onDetailChange={(val) => setFormData(prev => ({...prev, addressDetail: val}))}
                   onCoordinateChange={(lat, lng) => setFormData(prev => ({...prev, latitude: lat, longitude: lng}))}
                />
              </div>

              {/* 3. 위도, 경도 */}
              <FormRow label="위도">
                 <InputGroup 
                    value={formData.latitude || ''}
                    onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                    placeholder="자동 입력" 
                 />
              </FormRow>
              <FormRow label="경도">
                 <InputGroup 
                    value={formData.longitude || ''}
                    onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                    placeholder="자동 입력" 
                 />
              </FormRow>

              {/* 4. 담당자 정보 */}
              <FormRow label="담당자">
                <InputGroup 
                  value={formData.managerName || ''} 
                  onChange={(e) => setFormData({...formData, managerName: e.target.value})} 
                />
              </FormRow>
              <FormRow label="담당자 전화">
                <InputGroup 
                  value={formData.managerPhone || ''} 
                  onChange={(e) => setFormData({...formData, managerPhone: e.target.value})}
                  onKeyDown={handlePhoneKeyDown}
                  inputMode="numeric"
                  placeholder="숫자만 입력"
                  maxLength={13} 
                />
              </FormRow>
              <FormRow label="담당자 E-mail" className="col-span-1 md:col-span-2">
                <InputGroup 
                  type="email"
                  value={formData.managerEmail || ''} 
                  onChange={(e) => setFormData({...formData, managerEmail: e.target.value})} 
                />
              </FormRow>

              {/* 5. 비고 (Full Width) */}
              <FormRow label="비고" className="col-span-1 md:col-span-2">
                 <InputGroup 
                    value={formData.memo || ''}
                    onChange={(e) => setFormData({...formData, memo: e.target.value})}
                 />
              </FormRow>
          </FormSection>

          {/* Configuration Section */}
          <FormSection title="시스템 설정 및 SMS 관리">
              {/* 화재발생시 SMS (Edit Only) */}
              <FormRow label="화재발생시 SMS" className="col-span-1 md:col-span-2 bg-slate-700/20 p-3 rounded border border-slate-700/50">
                 {selectedMarket ? (
                    <div className="flex flex-col gap-2 w-full">
                       <div className="flex gap-2">
                          <InputGroup 
                             placeholder="번호 입력" 
                             value={tempFireSms} 
                             onChange={(e) => setTempFireSms(e.target.value)} 
                             className="max-w-xs"
                          />
                          <Button type="button" variant="secondary" onClick={addFireSms} icon={<Plus size={14} />}>추가</Button>
                       </div>
                       <div className="flex flex-wrap gap-2 mt-1">
                          {fireSmsList.length === 0 && <span className="text-slate-500 text-sm">등록된 번호가 없습니다.</span>}
                          {fireSmsList.map((num, idx) => (
                             <div key={idx} className="flex items-center gap-1 bg-slate-900 border border-slate-600 px-2 py-1 rounded text-sm text-slate-300">
                                <span>{num}</span>
                                <button type="button" onClick={() => removeFireSms(idx)} className="text-red-400 hover:text-red-300"><X size={14}/></button>
                             </div>
                          ))}
                       </div>
                    </div>
                 ) : (
                    <div className="text-sm text-orange-400">* 등록 후 수정 시에만 추가 가능</div>
                 )}
              </FormRow>

              {/* 고장발생시 SMS (Edit Only) */}
              <FormRow label="고장발생시 SMS" className="col-span-1 md:col-span-2 bg-slate-700/20 p-3 rounded border border-slate-700/50">
                 {selectedMarket ? (
                    <div className="flex flex-col gap-2 w-full">
                       <div className="flex gap-2">
                          <InputGroup 
                             placeholder="번호 입력" 
                             value={tempFaultSms} 
                             onChange={(e) => setTempFaultSms(e.target.value)} 
                             className="max-w-xs"
                          />
                          <Button type="button" variant="secondary" onClick={addFaultSms} icon={<Plus size={14} />}>추가</Button>
                       </div>
                       <div className="flex flex-wrap gap-2 mt-1">
                          {faultSmsList.length === 0 && <span className="text-slate-500 text-sm">등록된 번호가 없습니다.</span>}
                          {faultSmsList.map((num, idx) => (
                             <div key={idx} className="flex items-center gap-1 bg-slate-900 border border-slate-600 px-2 py-1 rounded text-sm text-slate-300">
                                <span>{num}</span>
                                <button type="button" onClick={() => removeFaultSms(idx)} className="text-red-400 hover:text-red-300"><X size={14}/></button>
                             </div>
                          ))}
                       </div>
                    </div>
                 ) : (
                    <div className="text-sm text-orange-400">* 등록 후 수정 시에만 추가 가능</div>
                 )}
              </FormRow>

              {/* 지도 이미지 (Edit Only, Multi-upload) */}
              <FormRow label="현장지도 이미지 (최대 10장)" className="col-span-1 md:col-span-2">
                 {selectedMarket ? (
                    <div className="flex flex-col gap-3 w-full">
                       {/* Controls */}
                       <div className="flex items-center gap-2">
                          <input 
                             type="file" 
                             ref={fileInputRef}
                             onChange={handleFileChange}
                             className="hidden" 
                             accept="image/*"
                             multiple
                          />
                          <Button type="button" variant="secondary" onClick={handleFileSelectClick} icon={<Upload size={16} />}>
                             이미지 추가
                          </Button>
                          <span className="text-xs text-slate-400">
                             ({imageList.length} / 10) 드래그하여 순서 변경 가능
                          </span>
                       </div>

                       {/* List of Images */}
                       <div className="bg-slate-900 border border-slate-700 rounded-md p-2 min-h-[100px] flex flex-col gap-2">
                          {imageList.length === 0 && (
                              <div className="flex items-center justify-center h-20 text-slate-500 text-sm">
                                  등록된 이미지가 없습니다.
                              </div>
                          )}
                          {imageList.map((item, idx) => (
                              <div 
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDrop={(e) => handleDrop(e, idx)}
                                className={`
                                    flex items-center justify-between p-2 rounded border transition-all cursor-move
                                    ${draggedItemIndex === idx ? 'bg-blue-900/30 border-blue-500 opacity-50' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}
                                `}
                              >
                                  <div className="flex items-center gap-3 overflow-hidden">
                                      <MenuIcon size={16} className="text-slate-500 cursor-move" />
                                      <Paperclip size={16} className="text-blue-400 flex-shrink-0" />
                                      <span 
                                        className="text-sm text-slate-300 truncate cursor-pointer hover:underline hover:text-blue-300"
                                        onClick={() => handleDownloadImage(item)}
                                        title={item.name}
                                      >
                                          {item.name}
                                      </span>
                                      <span className="text-[10px] bg-slate-900 px-1.5 rounded text-slate-500 border border-slate-700">
                                          {idx + 1}번
                                      </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <button 
                                        type="button" 
                                        onClick={() => handleDownloadImage(item)}
                                        className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                                        title="다운로드"
                                      >
                                          <Download size={16} />
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => handleRemoveImage(idx)} 
                                        className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                                        title="삭제"
                                      >
                                          <X size={16} />
                                      </button>
                                  </div>
                              </div>
                          ))}
                       </div>
                    </div>
                 ) : (
                    <div className="text-sm text-orange-400">* 등록 후 수정 시에만 추가 가능</div>
                 )}
              </FormRow>

              {/* Configuration Radio Buttons Grid */}
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4 pt-4 border-t border-slate-700">
                  <ConfigRadioGroup 
                     label="현장 전체 문자전송 여부" name="enableMarketSms" 
                     value={formData.enableMarketSms} 
                     onChange={(v) => setFormData({...formData, enableMarketSms: v as any})} 
                  />
                  <ConfigRadioGroup 
                     label="상가주인 문자전송여부" name="enableStoreSms" 
                     value={formData.enableStoreSms} 
                     onChange={(v) => setFormData({...formData, enableStoreSms: v as any})} 
                  />
                  <ConfigRadioGroup 
                     label="다매체전송 여부" name="enableMultiMedia" 
                     value={formData.enableMultiMedia} 
                     onChange={(v) => setFormData({...formData, enableMultiMedia: v as any})} 
                  />
                  <ConfigRadioGroup 
                     label="다매체 타입" name="multiMediaType" 
                     value={formData.multiMediaType} 
                     options={['복합', '열', '연기']}
                     onChange={(v) => setFormData({...formData, multiMediaType: v as any})} 
                  />
                  <ConfigRadioGroup 
                     label="기기고장 문자전송여부" name="enableDeviceFaultSms" 
                     value={formData.enableDeviceFaultSms} 
                     onChange={(v) => setFormData({...formData, enableDeviceFaultSms: v as any})} 
                  />
                  <ConfigRadioGroup 
                     label="화재문자시 CCTV URL 포함여부" name="enableCctvUrl" 
                     value={formData.enableCctvUrl} 
                     onChange={(v) => setFormData({...formData, enableCctvUrl: v as any})} 
                  />
              </div>

              {/* 현장 사용 여부 - 맨 하단으로 이동 */}
              <div className="col-span-1 md:col-span-2 mt-4">
                  <div className="bg-red-900/10 border border-red-900/30 p-3 rounded">
                      <ConfigRadioGroup 
                        label="현장 사용 여부 (미사용 시 각 상가도 모두 미사용상태로 바뀝니다.)" name="usageStatus" 
                        value={formData.usageStatus} 
                        onChange={(v) => setFormData({...formData, usageStatus: v as any})} 
                      />
                  </div>
              </div>
          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
             <Button type="submit" variant="primary" className="w-32">{selectedMarket ? '수정' : '신규등록'}</Button>
             {selectedMarket && <Button type="button" variant="danger" onClick={handleDelete} className="w-32">삭제</Button>}
             <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
          </div>
        </form>

        {/* Distributor Search Modal */}
        <Modal isOpen={isDistModalOpen} onClose={() => setIsDistModalOpen(false)} title="총판 찾기" width="max-w-3xl">
           <SearchFilterBar onSearch={fetchDistributors}>
              <InputGroup label="총판명" value={distSearchName} onChange={(e) => setDistSearchName(e.target.value)} placeholder="총판명 검색" />
           </SearchFilterBar>
           <DataTable columns={distColumns} data={currentDists} />
           <Pagination totalItems={distList.length} itemsPerPage={MODAL_ITEMS_PER_PAGE} currentPage={distPage} onPageChange={setDistPage} />
        </Modal>
      </>
    );
  }

  // --- VIEW: LIST ---
  return (
    <>
      <PageHeader title="현장 관리" />
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <InputGroup 
          label="현장명" 
          value={searchName} 
          onChange={(e) => setSearchName(e.target.value)} 
          placeholder="현장명 입력" 
        />
        <InputGroup 
          label="주소" 
          value={searchAddress} 
          onChange={(e) => setSearchAddress(e.target.value)} 
          placeholder="주소 입력" 
        />
        <InputGroup 
          label="담당자" 
          value={searchManager} 
          onChange={(e) => setSearchManager(e.target.value)} 
          placeholder="담당자 입력" 
        />
      </SearchFilterBar>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-400">
          전체 <span className="text-blue-400">{markets.length}</span> 건
          (페이지 {currentPage})
        </span>
        <ActionBar onRegister={handleRegister} onExcel={handleExcel} />
      </div>
      {loading ? (
        <div className="text-center py-20 text-slate-500">Loading...</div>
      ) : (
        <DataTable columns={columns} data={currentItems} onRowClick={handleEdit} />
      )}
      <Pagination 
        totalItems={markets.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      {/* Visual Map Console Modal */}
      {visualMapMarket && (
          <VisualMapConsole 
             market={visualMapMarket} 
             initialMode="edit" 
             onClose={() => setVisualMapMarket(null)} 
          />
      )}
    </>
  );
};