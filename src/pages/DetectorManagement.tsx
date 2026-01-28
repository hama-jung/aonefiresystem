import React, { useState, useEffect } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, SelectGroup, Button, DataTable, 
  Pagination, FormSection, FormRow, Column, UI_STYLES, Modal,
  StatusBadge, StatusRadioGroup, MarketSearchModal, ReceiverSearchModal
} from '../components/CommonUI';
import { Detector, Market, Receiver, Store } from '../types';
import { DetectorAPI, StoreAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';
import { Search, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;
const MODAL_ITEMS_PER_PAGE = 5;

// 중계기 ID, 감지기 ID 옵션 (01 ~ 20)
const ID_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const val = String(i + 1).padStart(2, '0');
  return { value: val, label: val };
});

export const DetectorManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [detectors, setDetectors] = useState<Detector[]>([]);
  const [selectedDetector, setSelectedDetector] = useState<Detector | null>(null);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Search Filters
  const [searchMarket, setSearchMarket] = useState('');
  const [searchStore, setSearchStore] = useState('');
  const [searchReceiverMac, setSearchReceiverMac] = useState('');
  const [searchRepeaterId, setSearchRepeaterId] = useState('');
  const [searchDetectorId, setSearchDetectorId] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

  // Form Data
  const [formData, setFormData] = useState<Partial<Detector>>({});
  
  // Common Modals
  const [isReceiverModalOpen, setIsReceiverModalOpen] = useState(false);
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);

  // Store Modal (Multiple Stores) - Keep local as it's specific
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [storeSearchName, setStoreSearchName] = useState('');
  const [storeModalPage, setStoreModalPage] = useState(1);
  const [selectedStores, setSelectedStores] = useState<{id: number, name: string}[]>([]);

  // SMS Edit
  const [smsFireList, setSmsFireList] = useState<string[]>([]);
  const [tempSmsFire, setTempSmsFire] = useState('');

  // Excel Upload
  const [excelData, setExcelData] = useState<Detector[]>([]);
  const [excelMarket, setExcelMarket] = useState<Market | null>(null);

  // --- Data Fetching ---
  const fetchDetectors = async (overrides?: any) => {
    setLoading(true);
    try {
      const query = {
        marketName: overrides?.marketName !== undefined ? overrides.marketName : searchMarket,
        storeName: overrides?.storeName !== undefined ? overrides.storeName : searchStore,
        receiverMac: overrides?.receiverMac !== undefined ? overrides.receiverMac : searchReceiverMac,
        repeaterId: overrides?.repeaterId !== undefined ? overrides.repeaterId : searchRepeaterId,
        detectorId: overrides?.detectorId !== undefined ? overrides.detectorId : searchDetectorId,
      };
      const data = await DetectorAPI.getList(query);
      setDetectors(data);
      setCurrentPage(1);
    } catch (e: any) {
      console.error(e);
      if (e.message && e.message.includes('Could not find the table')) {
         console.warn('DB 테이블(detectors)이 존재하지 않습니다. SQL 스크립트를 실행해주세요.');
      } else {
         alert('데이터 로드 실패: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetectors();
  }, []);

  // --- Handlers: Search ---
  const handleSearch = () => {
    setIsFiltered(true);
    fetchDetectors();
  };

  const handleReset = () => {
    setSearchMarket('');
    setSearchStore('');
    setSearchReceiverMac('');
    setSearchRepeaterId('');
    setSearchDetectorId('');
    setIsFiltered(false);
    fetchDetectors({ marketName: '', storeName: '', receiverMac: '', repeaterId: '', detectorId: '' });
  };

  // --- Handlers: List Actions ---
  const handleRegister = () => {
    setSelectedDetector(null);
    setFormData({ 
      repeaterId: '01', 
      detectorId: '01',
      mode: '복합',
      status: '사용', // unified name
      cctvUrl: '',
      memo: ''
    });
    setSmsFireList([]);
    setSelectedStores([]);
    setView('form');
  };

  const handleEdit = (detector: Detector) => {
    setSelectedDetector(detector);
    setFormData({ ...detector });
    setSmsFireList(detector.smsList || []);
    setSelectedStores(detector.stores || []);
    setView('form');
  };

  const handleDelete = async () => {
    if (selectedDetector && confirm('정말 삭제하시겠습니까?')) {
      try {
        await DetectorAPI.delete(selectedDetector.id);
        alert('삭제되었습니다.');
        setView('list');
        fetchDetectors();
      } catch (e) {
        alert('삭제 실패');
      }
    }
  };

  const handleExcelRegister = () => {
    setExcelData([]);
    setExcelMarket(null);
    setView('excel');
  };

  // --- Handlers: Form ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.marketId || !formData.receiverMac) { alert('R형 수신기를 선택해주세요.'); return; }
    if (!formData.repeaterId) { alert('중계기 ID를 선택해주세요.'); return; }
    if (!formData.detectorId) { alert('감지기 ID를 선택해주세요.'); return; }

    try {
      const newDetector: Detector = {
        ...formData as Detector,
        id: selectedDetector?.id || 0,
        smsList: smsFireList,
        stores: selectedStores 
      };

      await DetectorAPI.save(newDetector);
      alert('저장되었습니다.');
      setView('list');
      fetchDetectors();
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    }
  };

  // SMS Management
  const addSms = () => {
    if(tempSmsFire) {
      setSmsFireList([...smsFireList, tempSmsFire]);
      setTempSmsFire('');
    }
  };
  const removeSms = (index: number) => {
    setSmsFireList(smsFireList.filter((_, i) => i !== index));
  };

  // Store List Management (Manual Add/Remove)
  const removeStore = (storeId: number) => {
    setSelectedStores(selectedStores.filter(s => s.id !== storeId));
  };

  // --- Receiver Search Modal Handlers ---
  const openReceiverModal = () => setIsReceiverModalOpen(true);

  const handleReceiverSelect = (r: Receiver) => {
    setFormData({ 
      ...formData, 
      marketId: r.marketId, 
      marketName: r.marketName,
      receiverMac: r.macAddress,
    });
    // 시장이 바뀌면 상가 목록 초기화
    setSelectedStores([]);
    setIsReceiverModalOpen(false);
  };

  // --- Store Search Modal Handlers ---
  const fetchStores = async () => {
    if (!formData.marketId) {
        setStoreList([]);
        return;
    }
    const data = await StoreAPI.getList({ 
        marketId: formData.marketId,
        storeName: storeSearchName 
    });
    setStoreList(data);
    setStoreModalPage(1);
  };
  const openStoreModal = () => {
    if (!formData.marketId) {
        alert('먼저 R형 수신기를 선택해주세요.');
        return;
    }
    setStoreSearchName('');
    fetchStores();
    setIsStoreModalOpen(true);
  };
  const handleStoreSelect = (s: Store) => {
    // 중복 체크
    if (selectedStores.some(store => store.id === s.id)) {
        alert('이미 추가된 상가입니다.');
        return;
    }
    setSelectedStores([...selectedStores, { id: s.id, name: s.name }]);
    setIsStoreModalOpen(false);
  };

  // --- Market Search Modal (Excel) ---
  const openMarketModal = () => setIsMarketModalOpen(true);

  const handleMarketSelect = (m: Market) => {
    setExcelMarket(m);
    setIsMarketModalOpen(false);
  };

  // --- Excel Logic ---
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!excelMarket) {
        alert('먼저 소속 시장을 선택해주세요.');
        e.target.value = ''; 
        return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsedData: Detector[] = data.map((row: any) => ({
        id: 0,
        marketId: excelMarket.id,
        marketName: excelMarket.name,
        receiverMac: row['수신기MAC'] ? String(row['수신기MAC']) : '',
        repeaterId: row['중계기ID'] ? String(row['중계기ID']).padStart(2, '0') : '01',
        detectorId: row['감지기ID'] ? String(row['감지기ID']).padStart(2, '0') : '01',
        mode: row['모드'] || '복합',
        status: row['사용여부'] || '사용', // unified name
        cctvUrl: row['CCTV URL'] || '',
        memo: row['비고'] || '',
        stores: row['상가명'] ? [{ id: 0, name: row['상가명'] }] : [] 
      }));

      setExcelData(parsedData);
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelSave = async () => {
    if (excelData.length === 0) {
        alert('등록할 데이터가 없습니다.');
        return;
    }
    if (!excelMarket) {
        alert('소속 시장이 선택되지 않았습니다.');
        return;
    }

    try {
        await DetectorAPI.saveBulk(excelData);
        alert(`${excelData.length}건이 성공적으로 등록되었습니다.`);
        setView('list');
        fetchDetectors();
    } catch (e: any) {
        alert(`일괄 등록 실패: ${e.message}`);
    }
  };

  const handleSampleDownload = () => {
    const sampleData = [
      {
        '수신기MAC': '001A',
        '중계기ID': '01',
        '감지기ID': '01',
        '상가명': '샘플상가',
        '모드': '복합',
        '사용여부': '사용',
        'CCTV URL': 'http://...',
        '비고': ''
      }
    ];
    exportToExcel(sampleData, '화재감지기_일괄등록_샘플양식');
  };

  // --- Columns ---
  const columns: Column<Detector>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '수신기 MAC', accessor: 'receiverMac', width: '120px' },
    { header: '중계기 ID', accessor: 'repeaterId', width: '100px' },
    { header: '감지기 ID', accessor: 'detectorId', width: '100px' },
    { header: '설치시장', accessor: 'marketName', width: '250px' },
    { 
      header: '설치상가', 
      accessor: (item) => {
        if (!item.stores || item.stores.length === 0) return '-';
        if (item.stores.length === 1) return item.stores[0].name;
        return `${item.stores[0].name} 외 ${item.stores.length - 1}건`;
      }, 
      width: '250px' 
    },
    { header: 'CCTV URL', accessor: 'cctvUrl', width: '150px' },
    { header: '사용여부', accessor: (item) => <StatusBadge status={item.status} />, width: '100px' },
  ];

  // Pagination logic
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = detectors.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(detectors.length / ITEMS_PER_PAGE);

  // Store Modal Pagination
  const smLast = storeModalPage * MODAL_ITEMS_PER_PAGE;
  const smFirst = smLast - MODAL_ITEMS_PER_PAGE;
  const currentStores = storeList.slice(smFirst, smLast);
  const smTotal = Math.ceil(storeList.length / MODAL_ITEMS_PER_PAGE);

  // --- View: Form ---
  if (view === 'form') {
    return (
      <>
        <PageHeader title="화재감지기 관리" />
        <form onSubmit={handleSave}>
          <FormSection title={selectedDetector ? "화재감지기 수정" : "화재감지기 등록"}>
            {/* R형 수신기 MAC (Search) */}
            <FormRow label="R형 수신기 MAC" required className="col-span-1 md:col-span-2">
              <div className="flex gap-2 w-full max-w-md">
                <div onClick={openReceiverModal} className="flex-1 relative cursor-pointer">
                  <input 
                    type="text"
                    value={formData.receiverMac || ''} 
                    placeholder="수신기를 선택하세요" 
                    readOnly 
                    className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
                  />
                  <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                </div>
                <Button type="button" variant="secondary" onClick={openReceiverModal}>검색</Button>
              </div>
              {formData.marketName && <p className="text-xs text-blue-400 mt-1">소속 시장: {formData.marketName}</p>}
            </FormRow>

            {/* 중계기 ID */}
            <FormRow label="중계기 ID">
              <SelectGroup 
                options={ID_OPTIONS}
                value={formData.repeaterId || '01'}
                onChange={(e) => setFormData({...formData, repeaterId: e.target.value})}
              />
            </FormRow>

            {/* 감지기 ID */}
            <FormRow label="감지기 ID">
              <SelectGroup 
                options={ID_OPTIONS}
                value={formData.detectorId || '01'}
                onChange={(e) => setFormData({...formData, detectorId: e.target.value})}
              />
            </FormRow>

            {/* 설치 상가 (Multiple Selection List) */}
            <FormRow label="설치 상가(점포 추가)" className="col-span-1 md:col-span-2">
              <div className="flex flex-col gap-2 max-w-md">
                 <div className="flex justify-end">
                    <Button type="button" variant="secondary" onClick={openStoreModal} icon={<Search size={14} />}>상가 검색 추가</Button>
                 </div>
                 <div className="bg-slate-900 border border-slate-600 rounded p-2 h-32 overflow-y-auto custom-scrollbar">
                    {selectedStores.length === 0 && <span className="text-slate-500 text-sm p-2">등록된 상가가 없습니다.</span>}
                    {selectedStores.map((store, idx) => (
                      <div key={store.id} className="flex justify-between items-center py-1.5 px-2 border-b border-slate-700/50 last:border-0 hover:bg-slate-800">
                        <span className="text-slate-200">{store.name}</span>
                        <button type="button" onClick={() => removeStore(store.id)} className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-slate-700">
                           <X size={14} />
                        </button>
                      </div>
                    ))}
                 </div>
              </div>
            </FormRow>

            {/* 화재발생시 SMS (Edit Only) */}
            {selectedDetector && (
                <FormRow label="SMS등록(최대10개)" className="col-span-1 md:col-span-2">
                    <div className="flex flex-col gap-2 max-w-md">
                        <div className="bg-slate-900 border border-slate-600 rounded p-2 h-24 overflow-y-auto custom-scrollbar mb-2">
                           {smsFireList.length === 0 && <span className="text-slate-500 text-sm">등록된 번호가 없습니다.</span>}
                           {smsFireList.map((num, idx) => (
                             <div key={idx} className="flex justify-between items-center py-1 px-2 border-b border-slate-700/50 last:border-0">
                               <span className="text-slate-200">{num}</span>
                               <button type="button" onClick={() => removeSms(idx)} className="text-red-400 hover:text-red-300 text-sm">삭제</button>
                             </div>
                           ))}
                        </div>
                        <div className="flex gap-2">
                           <InputGroup 
                             placeholder="휴대폰 번호 입력" 
                             value={tempSmsFire}
                             onChange={(e) => setTempSmsFire(e.target.value)}
                           />
                           <Button type="button" variant="secondary" onClick={addSms} className="whitespace-nowrap">추가</Button>
                        </div>
                    </div>
                </FormRow>
            )}

            {/* 모드 */}
            <FormRow label="모드">
              <div className={`${UI_STYLES.input} flex gap-4 text-slate-300 items-center`}>
                {['복합', '연기', '열'].map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input 
                        type="radio" name="mode" value={opt} 
                        checked={formData.mode === opt} 
                        onChange={() => setFormData({...formData, mode: opt as any})}
                        className="accent-blue-500" 
                    />
                    <span>{opt}</span>
                    </label>
                ))}
              </div>
            </FormRow>

            {/* 사용여부 */}
            <FormRow label="사용여부">
              <StatusRadioGroup 
                label=""
                value={formData.status} 
                onChange={(val) => setFormData({...formData, status: val as any})} 
              />
            </FormRow>

            {/* CCTV URL */}
            <FormRow label="CCTV URL" className="col-span-1 md:col-span-2">
              <InputGroup 
                value={formData.cctvUrl || ''} 
                onChange={(e) => setFormData({...formData, cctvUrl: e.target.value})}
              />
            </FormRow>

            {/* 비고 */}
            <FormRow label="비고" className="col-span-1 md:col-span-2">
              <InputGroup 
                value={formData.memo || ''} 
                onChange={(e) => setFormData({...formData, memo: e.target.value})}
              />
            </FormRow>
          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
            <Button type="submit" variant="primary" className="w-32">{selectedDetector ? '수정' : '신규등록'}</Button>
            <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">목록</Button>
          </div>
        </form>

        {/* Common Receiver Modal */}
        <ReceiverSearchModal
          isOpen={isReceiverModalOpen} 
          onClose={() => setIsReceiverModalOpen(false)} 
          onSelect={handleReceiverSelect}
        />

        {/* Store Search Modal - Kept local */}
        <Modal isOpen={isStoreModalOpen} onClose={() => setIsStoreModalOpen(false)} title="상가 리스트" width="max-w-4xl">
           <SearchFilterBar onSearch={fetchStores}>
              <InputGroup label="상가명" value={storeSearchName} onChange={(e) => setStoreSearchName(e.target.value)} placeholder="상가명 검색" />
           </SearchFilterBar>
           <DataTable<Store> 
             columns={[
                { header: '총판/시장', accessor: (s) => s.marketName },
                { header: '상가명', accessor: 'name' },
                { header: '담당자명', accessor: 'managerName' },
                { header: '담당자휴대폰', accessor: 'managerPhone' },
                { header: '주소', accessor: 'address' },
                { header: '선택', accessor: (item) => <Button variant="primary" onClick={() => handleStoreSelect(item)} className="px-2 py-1 text-xs">선택</Button>, width: '80px' }
             ]} 
             data={currentStores} 
           />
           <Pagination totalItems={storeList.length} itemsPerPage={MODAL_ITEMS_PER_PAGE} currentPage={storeModalPage} onPageChange={setStoreModalPage} />
        </Modal>

        {/* Common Market Modal */}
        <MarketSearchModal 
          isOpen={isMarketModalOpen} 
          onClose={() => setIsMarketModalOpen(false)} 
          onSelect={handleMarketSelect} 
        />
      </>
    );
  }

  // --- View: Excel (New) ---
  if (view === 'excel') {
    return (
      <>
        <PageHeader title="화재감지기 관리" />
        <FormSection title="엑셀 일괄 등록">
            {/* 1. 소속 시장 선택 */}
            <FormRow label="소속 시장" required className="col-span-1 md:col-span-2">
               <div className="flex gap-2 w-full max-w-md">
                 <div onClick={openMarketModal} className="flex-1 relative cursor-pointer">
                    <input 
                       type="text"
                       value={excelMarket?.name || ''} 
                       placeholder="등록할 시장을 선택하세요" 
                       readOnly 
                       className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
                    />
                    <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                 </div>
                 <Button type="button" variant="secondary" onClick={openMarketModal}>찾기</Button>
               </div>
            </FormRow>

            {/* 2. 파일 선택 */}
            <FormRow label="엑셀 파일 선택" required className="col-span-1 md:col-span-2">
                <div className="flex flex-col gap-2">
                   <InputGroup 
                      type="file" 
                      accept=".xlsx, .xls"
                      onChange={handleExcelFileChange}
                      className="border-0 p-0 text-slate-300 w-full"
                   />
                   <p className="text-xs text-slate-400">
                     * 수신기MAC, 중계기ID, 감지기ID, 모드, 사용여부, CCTV URL, 비고 컬럼을 포함해야 합니다.
                   </p>
                </div>
            </FormRow>

            {/* 3. 샘플 다운로드 */}
            <FormRow label="샘플 양식" className="col-span-1 md:col-span-2">
                <Button type="button" variant="secondary" onClick={handleSampleDownload} icon={<Upload size={14} />}>
                   엑셀 샘플 다운로드
                </Button>
            </FormRow>
        </FormSection>

        {/* 미리보기 테이블 */}
        {excelData.length > 0 && (
          <div className="mt-8">
             <h3 className="text-lg font-bold text-slate-200 mb-2">등록 미리보기 ({excelData.length}건)</h3>
             <DataTable<Detector> 
               columns={[
                  {header:'수신기MAC', accessor:'receiverMac'},
                  {header:'중계기ID', accessor:'repeaterId'},
                  {header:'감지기ID', accessor:'detectorId'},
                  {header:'상가명', accessor: (item) => item.stores?.[0]?.name || '-'},
                  {header:'모드', accessor:'mode'},
                  {header:'사용여부', accessor:'status'},
               ]}
               data={excelData.slice(0, 50)} 
             />
             {excelData.length > 50 && <p className="text-center text-slate-500 text-sm mt-2">...외 {excelData.length - 50}건</p>}
          </div>
        )}

        <div className="flex justify-center gap-3 mt-8">
            <Button type="button" variant="primary" onClick={handleExcelSave} className="w-32" disabled={excelData.length === 0}>일괄 등록</Button>
            <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
        </div>

        {/* Common Market Modal */}
        <MarketSearchModal 
          isOpen={isMarketModalOpen} 
          onClose={() => setIsMarketModalOpen(false)} 
          onSelect={handleMarketSelect} 
        />
      </>
    );
  }

  // --- View: List ---
  return (
    <>
      <PageHeader title="화재감지기 관리" />
      
      {/* 5 Search Items in one row for PC (using grid-cols-5) */}
      <div className="bg-slate-800 p-4 md:p-5 rounded-lg border border-slate-700 shadow-sm mb-5">
        <div className="flex flex-col gap-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <InputGroup label="설치시장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
              <InputGroup label="설치상가" value={searchStore} onChange={(e) => setSearchStore(e.target.value)} />
              <InputGroup label="수신기MAC주소" value={searchReceiverMac} onChange={(e) => setSearchReceiverMac(e.target.value)} />
              <InputGroup label="중계기ID" value={searchRepeaterId} onChange={(e) => setSearchRepeaterId(e.target.value)} />
              <InputGroup label="감지기ID" value={searchDetectorId} onChange={(e) => setSearchDetectorId(e.target.value)} />
           </div>
           <div className="flex justify-end gap-2">
              <Button onClick={handleSearch} icon={<Search size={18} />}>검색</Button>
              {isFiltered && <Button onClick={handleReset} variant="secondary">전체보기</Button>}
           </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-2">
         <span className="text-sm text-slate-400">
           전체 <strong className="text-blue-400">{detectors.length}</strong> 건 
           (페이지 {currentPage})
         </span>
         <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16} />}>엑셀 신규 등록</Button>
            <Button variant="primary" onClick={handleRegister}>신규 등록</Button>
         </div>
      </div>

      <DataTable columns={columns} data={currentItems} onRowClick={handleEdit} />
      
      <Pagination 
        totalItems={detectors.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  );
};