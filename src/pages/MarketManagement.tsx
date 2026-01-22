import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, SelectGroup,
  Button, DataTable, Pagination, ActionBar, FormSection, FormRow, Column, AddressInput, UI_STYLES,
  StatusBadge, formatPhoneNumber, handlePhoneKeyDown 
} from '../components/CommonUI';
import { Market, Distributor } from '../types';
import { MarketAPI, DistributorAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';
import { X, Paperclip, Upload, Plus, Trash2 } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

export const MarketManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 총판 목록 (드롭다운용)
  const [distributorOptions, setDistributorOptions] = useState<{value: string | number, label: string}[]>([]);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);

  // 검색 상태 관리
  const [searchName, setSearchName] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [searchManager, setSearchManager] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);
  
  // --- 폼 입력 상태 (Form Input State) ---
  const [formData, setFormData] = useState<Partial<Market>>({});
  
  // 이미지 파일 상태
  const [mapImageFile, setMapImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SMS 목록 관리 (Edit Mode 전용)
  const [smsFireList, setSmsFireList] = useState<string[]>([]);
  const [smsFaultList, setSmsFaultList] = useState<string[]>([]);
  const [tempSmsFire, setTempSmsFire] = useState('');
  const [tempSmsFault, setTempSmsFault] = useState('');

  // 초기 데이터 로드 (시장 목록 + 총판 목록)
  const initData = async () => {
    setLoading(true);
    try {
      // 1. 시장 목록 로드
      const mData = await MarketAPI.getList();
      setMarkets(mData);

      // 2. 총판 목록 로드 ('사용' 중인 총판만)
      const dData = await DistributorAPI.getList();
      const activeDistributors = dData
        .filter(d => d.status === '사용')
        .map(d => ({ value: d.id, label: d.name }));
      
      setDistributorOptions([{ value: '', label: '총판 선택' }, ...activeDistributors]);

    } catch (e) {
      alert('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initData();
  }, []);

  // 시장 목록 조회 (검색 시)
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
      alert('목록 갱신 실패');
    } finally {
      setLoading(false);
    }
  };

  // 검색 핸들러
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

  // --- Form Handlers ---
  const handleRegister = () => { 
    setSelectedMarket(null);
    // 폼 초기화 (기본 설정값 포함)
    setFormData({
      distributorId: undefined,
      name: '',
      address: '',
      addressDetail: '',
      latitude: '',
      longitude: '',
      managerName: '',
      managerPhone: '',
      managerEmail: '',
      memo: '',
      // 설정 플래그 초기값
      enableMarketSms: '사용',
      enableStoreSms: '사용',
      enableMultiMedia: '사용',
      multiMediaType: '복합',
      usageStatus: '사용', // [중요] 시장 사용여부
      enableDeviceFaultSms: '사용',
      enableCctvUrl: '사용',
      status: 'Normal'
    });
    setSmsFireList([]);
    setSmsFaultList([]);
    setTempSmsFire('');
    setTempSmsFault('');
    setMapImageFile(null); 
    if (fileInputRef.current) fileInputRef.current.value = ''; 
    setView('form'); 
  };
  
  const handleEdit = (market: Market) => { 
    setSelectedMarket(market);
    setFormData({ ...market });
    setSmsFireList(market.smsFire || []);
    setSmsFaultList(market.smsFault || []);
    setTempSmsFire('');
    setTempSmsFault('');
    setMapImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setView('form'); 
  };

  // SMS 목록 관리 핸들러
  const addSms = (type: 'fire' | 'fault') => {
    if (type === 'fire') {
        if (tempSmsFire && !smsFireList.includes(tempSmsFire)) {
            setSmsFireList([...smsFireList, tempSmsFire]);
            setTempSmsFire('');
        }
    } else {
        if (tempSmsFault && !smsFaultList.includes(tempSmsFault)) {
            setSmsFaultList([...smsFaultList, tempSmsFault]);
            setTempSmsFault('');
        }
    }
  };

  const removeSms = (type: 'fire' | 'fault', index: number) => {
    if (type === 'fire') {
        setSmsFireList(smsFireList.filter((_, i) => i !== index));
    } else {
        setSmsFaultList(smsFaultList.filter((_, i) => i !== index));
    }
  };
  
  // 파일 선택 버튼 클릭 핸들러
  const handleFileSelectClick = () => {
    if (formData.mapImage || mapImageFile) {
      alert("등록된 이미지를 삭제해 주세요.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setMapImageFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    if (confirm("이미지를 삭제하시겠습니까?")) {
        setFormData({ ...formData, mapImage: undefined });
        setMapImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFileName = () => {
     if (mapImageFile) return mapImageFile.name;
     if (formData.mapImage) {
        try {
           const url = new URL(formData.mapImage);
           return decodeURIComponent(url.pathname.split('/').pop() || 'image.jpg');
        } catch {
           return '시장지도_이미지.jpg';
        }
     }
     return '';
  };

  const handleDownload = async () => {
    if (mapImageFile) {
        const url = URL.createObjectURL(mapImageFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = mapImageFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
    }
    if (formData.mapImage) {
        try {
            const response = await fetch(formData.mapImage);
            if (!response.ok) throw new Error('Network error');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = getFileName();
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            window.open(formData.mapImage, '_blank');
        }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.distributorId) { alert('총판을 선택해주세요.'); return; }
    if (!formData.name) { alert('시장명을 입력해주세요.'); return; }
    if (!formData.address) { alert('주소를 입력해주세요.'); return; }

    // 사용여부 '미사용' 변경 시 경고
    if (selectedMarket && selectedMarket.usageStatus === '사용' && formData.usageStatus === '미사용') {
        if (!confirm('시장 사용여부를 [미사용]으로 변경하면,\n해당 시장에 속한 "모든 상가"도 [미사용] 처리됩니다.\n계속하시겠습니까?')) {
            return;
        }
    }

    try {
      let uploadedImageUrl = formData.mapImage;
      if (mapImageFile) {
        uploadedImageUrl = await MarketAPI.uploadMapImage(mapImageFile);
      }

      const cleanFormData = { ...formData };
      // 빈 문자열 정리
      if (cleanFormData.latitude === '') cleanFormData.latitude = undefined;
      if (cleanFormData.longitude === '') cleanFormData.longitude = undefined;
      
      const newMarket: Market = {
        ...cleanFormData as Market,
        id: selectedMarket?.id || 0,
        smsFire: smsFireList,
        smsFault: smsFaultList,
        mapImage: uploadedImageUrl,
        status: selectedMarket?.status || 'Normal',
      };

      await MarketAPI.save(newMarket);
      alert('저장되었습니다.');
      setView('list');
      fetchMarkets();
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    }
  };

  const handleExcel = () => {
    const excelData = markets.map((m, index) => ({
      'No': index + 1,
      '총판': m.distributorName || '-',
      '시장명': m.name,
      '주소': `${m.address} ${m.addressDetail || ''}`.trim(),
      '담당자명': m.managerName,
      '담당자연락처': m.managerPhone,
      '상태': m.usageStatus // 사용여부 출력
    }));
    exportToExcel(excelData, '시장관리_목록');
  };

  const columns: Column<Market>[] = [
    { header: 'No', accessor: 'id', width: '60px' },
    { header: '총판', accessor: (m) => m.distributorName || '-', width: '120px' },
    { header: '시장명', accessor: 'name' },
    { header: '주소', accessor: (m) => `${m.address} ${m.addressDetail || ''}` },
    { header: '담당자명', accessor: 'managerName' },
    { header: '담당자연락처', accessor: (m) => formatPhoneNumber(m.managerPhone) || '-' },
    { header: '상태', accessor: (m: Market) => <StatusBadge status={m.usageStatus || '사용'} />, width: '80px' }, // usageStatus 기준 배지
  ];

  // -- Pagination Logic --
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = markets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(markets.length / ITEMS_PER_PAGE);

  // Common Radio Group Renderer
  const renderRadioGroup = (
    label: string, 
    field: keyof Market, 
    options: string[] = ['사용', '미사용']
  ) => (
    <FormRow label={label}>
        <div className={`${UI_STYLES.input} flex gap-6 items-center`}>
            {options.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input 
                        type="radio" 
                        name={field} 
                        value={opt} 
                        checked={formData[field] === opt} 
                        onChange={() => setFormData({...formData, [field]: opt as any})}
                        className="accent-blue-500 w-4 h-4" 
                    />
                    <span>{opt}</span>
                </label>
            ))}
        </div>
    </FormRow>
  );

  if (view === 'form') {
    return (
      <>
        <PageHeader title={selectedMarket ? "시장 수정" : "시장 등록"} />
        <form onSubmit={handleSave}>
          <FormSection title="시장 정보">
              <FormRow label="총판" required>
                <SelectGroup 
                  options={distributorOptions}
                  value={formData.distributorId || ''}
                  onChange={(e) => setFormData({...formData, distributorId: Number(e.target.value)})}
                />
              </FormRow>

              <FormRow label="시장명" required>
                <InputGroup 
                  value={formData.name || ''} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </FormRow>
              
              <div className="col-span-1 md:col-span-2">
                <AddressInput 
                   label="주소"
                   required
                   address={formData.address || ''}
                   addressDetail={formData.addressDetail || ''}
                   onAddressChange={(val) => setFormData({...formData, address: val})}
                   onDetailChange={(val) => setFormData({...formData, addressDetail: val})}
                   onCoordinateChange={(lat, lng) => setFormData({...formData, latitude: lat, longitude: lng})}
                />
              </div>

              <FormRow label="위도">
                 <InputGroup 
                    value={formData.latitude || ''} 
                    onChange={(e) => setFormData({...formData, latitude: e.target.value})} 
                    placeholder="위도" 
                 />
              </FormRow>

              <FormRow label="경도">
                 <InputGroup 
                    value={formData.longitude || ''} 
                    onChange={(e) => setFormData({...formData, longitude: e.target.value})} 
                    placeholder="경도" 
                 />
              </FormRow>

              <FormRow label="담당자명">
                <InputGroup 
                  value={formData.managerName || ''} 
                  onChange={(e) => setFormData({...formData, managerName: e.target.value})} 
                />
              </FormRow>

              <FormRow label="담당자 연락처">
                <InputGroup 
                  value={formData.managerPhone || ''} 
                  onChange={(e) => setFormData({...formData, managerPhone: e.target.value.replace(/[^0-9]/g, '')})} 
                  onKeyDown={handlePhoneKeyDown}
                  inputMode="numeric"
                  placeholder="숫자만 입력하세요"
                  maxLength={11}
                />
              </FormRow>

              <FormRow label="담당자 이메일">
                <InputGroup 
                  value={formData.managerEmail || ''} 
                  onChange={(e) => setFormData({...formData, managerEmail: e.target.value})} 
                />
              </FormRow>

              {/* SMS 관리 섹션 (화재/고장) - [수정] col-span 제거하여 나란히 배치 */}
              <FormRow label="화재발생시 SMS">
                 <div className="flex flex-col gap-2 w-full">
                    <div className="bg-slate-900 border border-slate-600 rounded p-2 h-24 overflow-y-auto custom-scrollbar">
                        {smsFireList.length === 0 && <span className="text-slate-500 text-sm">등록된 번호가 없습니다.</span>}
                        {smsFireList.map((num, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1 px-2 border-b border-slate-700/50 last:border-0">
                                <span className="text-slate-200">{num}</span>
                                <button type="button" onClick={() => removeSms('fire', idx)} className="text-red-400 hover:text-red-300"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <InputGroup 
                            placeholder="휴대폰 번호 입력" 
                            value={tempSmsFire} 
                            onChange={(e) => setTempSmsFire(e.target.value.replace(/[^0-9]/g, ''))}
                            maxLength={11}
                        />
                        {/* [수정] whitespace-nowrap 추가 */}
                        <Button type="button" variant="secondary" onClick={() => addSms('fire')} icon={<Plus size={16}/>} className="whitespace-nowrap">추가</Button>
                    </div>
                 </div>
              </FormRow>

              <FormRow label="고장발생시 SMS">
                 <div className="flex flex-col gap-2 w-full">
                    <div className="bg-slate-900 border border-slate-600 rounded p-2 h-24 overflow-y-auto custom-scrollbar">
                        {smsFaultList.length === 0 && <span className="text-slate-500 text-sm">등록된 번호가 없습니다.</span>}
                        {smsFaultList.map((num, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1 px-2 border-b border-slate-700/50 last:border-0">
                                <span className="text-slate-200">{num}</span>
                                <button type="button" onClick={() => removeSms('fault', idx)} className="text-red-400 hover:text-red-300"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <InputGroup 
                            placeholder="휴대폰 번호 입력" 
                            value={tempSmsFault} 
                            onChange={(e) => setTempSmsFault(e.target.value.replace(/[^0-9]/g, ''))}
                            maxLength={11}
                        />
                        {/* [수정] whitespace-nowrap 추가 */}
                        <Button type="button" variant="secondary" onClick={() => addSms('fault')} icon={<Plus size={16}/>} className="whitespace-nowrap">추가</Button>
                    </div>
                 </div>
              </FormRow>

              {/* 시장지도 이미지 (수정 모드일 때만 활성화) */}
              <FormRow label="시장지도 이미지" className="col-span-1 md:col-span-2">
                 {selectedMarket ? (
                    <div className="flex flex-col gap-2 w-full">
                       <div className="flex items-center gap-2">
                          <input 
                             type="file" 
                             ref={fileInputRef}
                             onChange={handleFileChange}
                             className="hidden" 
                             accept="image/*"
                          />
                          <Button type="button" variant="secondary" onClick={handleFileSelectClick} icon={<Upload size={16} />}>
                             파일 선택
                          </Button>
                          {(formData.mapImage || mapImageFile) && (
                             <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded border border-slate-600">
                                <Paperclip size={14} className="text-slate-400" />
                                <span 
                                    onClick={handleDownload}
                                    className={`text-sm ${formData.mapImage || mapImageFile ? 'text-blue-400 cursor-pointer hover:underline' : 'text-slate-300'}`}
                                    title="클릭하여 다운로드"
                                >
                                    {getFileName()}
                                </span>
                                <button type="button" onClick={handleRemoveFile} className="text-red-400 hover:text-red-300 ml-2 p-1 rounded hover:bg-slate-600 transition-colors">
                                    <X size={16} />
                                </button>
                             </div>
                          )}
                       </div>
                       <p className="text-xs text-slate-500 mt-1">최대 10MB, jpg/png/gif 지원</p>
                    </div>
                 ) : (
                    <div className="flex items-center h-[42px] px-3 bg-slate-800/50 border border-slate-700 rounded text-slate-500 text-sm italic w-full">
                       신규 등록 시에는 이미지를 첨부할 수 없습니다. 등록 후 수정 단계에서 진행해 주세요.
                    </div>
                 )}
              </FormRow>

              <FormRow label="비고" className="col-span-1 md:col-span-2">
                <InputGroup 
                  value={formData.memo || ''} 
                  onChange={(e) => setFormData({...formData, memo: e.target.value})} 
                />
              </FormRow>

              {/* --- 설정 플래그 섹션 --- */}
              <div className="col-span-1 md:col-span-2 border-t border-slate-700 my-4"></div>
              
              {renderRadioGroup('시장전체 문자전송여부', 'enableMarketSms')}
              {renderRadioGroup('상가주인 문자전송여부', 'enableStoreSms')}
              {renderRadioGroup('다매체전송 여부', 'enableMultiMedia')}
              {renderRadioGroup('다매체 타입', 'multiMediaType', ['복합', '열', '연기'])}
              {renderRadioGroup('기기고장 문자전송여부', 'enableDeviceFaultSms')}
              {renderRadioGroup('화재문자시 CCTV URL 포함여부', 'enableCctvUrl')}
              
              <div className="col-span-1 md:col-span-2 border-t border-slate-700 my-4"></div>

              {/* [중요] 시장 사용 여부 (변경 시 상가 일괄 처리 로직 연결됨) */}
              <FormRow label="시장 사용여부" className="col-span-1 md:col-span-2">
                  <div className={`${UI_STYLES.input} flex gap-6 items-center bg-slate-900/50 border-blue-500/30`}>
                      <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                          <input 
                              type="radio" 
                              name="usageStatus" 
                              value="사용" 
                              checked={formData.usageStatus === '사용'} 
                              onChange={() => setFormData({...formData, usageStatus: '사용'})}
                              className="accent-blue-500 w-4 h-4" 
                          />
                          <span className="font-bold text-blue-400">사용</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                          <input 
                              type="radio" 
                              name="usageStatus" 
                              value="미사용" 
                              checked={formData.usageStatus === '미사용'} 
                              onChange={() => setFormData({...formData, usageStatus: '미사용'})}
                              className="accent-red-500 w-4 h-4" 
                          />
                          <span className="font-bold text-red-400">미사용 (소속 상가 전체 미사용 처리됨)</span>
                      </label>
                  </div>
              </FormRow>

          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
             <Button type="submit" variant="primary" className="w-32">{selectedMarket ? '수정' : '등록'}</Button>
             <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <PageHeader title="시장 관리" />
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <InputGroup 
          label="시장명" 
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="시장명 입력" 
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
          (페이지 {currentPage}/{totalPages || 1})
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
    </>
  );
};