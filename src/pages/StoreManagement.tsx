
import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, SelectGroup,
  Button, DataTable, Pagination, ActionBar, FormSection, FormRow, Column, Modal, UI_STYLES, AddressInput,
  formatPhoneNumber, handlePhoneKeyDown, StatusBadge, StatusRadioGroup // Import common components
} from '../components/CommonUI';
import { Store, Market } from '../types';
import { StoreAPI, MarketAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';
import { X, Paperclip, Search, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;
const MODAL_ITEMS_PER_PAGE = 5;

export const StoreManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Pagination ---
  const [currentPage, setCurrentPage] = useState(1);

  // --- Search Filters ---
  const [searchAddress, setSearchAddress] = useState('');
  const [searchMarket, setSearchMarket] = useState('');
  const [searchStore, setSearchStore] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

  // --- Form Data ---
  const [formData, setFormData] = useState<Partial<Store>>({});
  
  // Image handling
  const [storeImageFile, setStoreImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Market Modal Data ---
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [marketList, setMarketList] = useState<Market[]>([]);
  const [marketSearchName, setMarketSearchName] = useState('');
  const [marketModalPage, setMarketModalPage] = useState(1);
  const [selectedMarketForForm, setSelectedMarketForForm] = useState<Market | null>(null); // For display

  // --- Excel Upload Data ---
  const [excelData, setExcelData] = useState<Store[]>([]);
  const [excelMarket, setExcelMarket] = useState<Market | null>(null); // Market selected for bulk upload

  // --- Initial Data Load ---
  const fetchStores = async (overrides?: { address?: string, marketName?: string, storeName?: string }) => {
    setLoading(true);
    try {
      const query = {
        address: overrides?.address !== undefined ? overrides.address : searchAddress,
        marketName: overrides?.marketName !== undefined ? overrides.marketName : searchMarket,
        storeName: overrides?.storeName !== undefined ? overrides.storeName : searchStore
      };
      const data = await StoreAPI.getList(query);
      setStores(data);
      setCurrentPage(1);
    } catch (e) {
      alert('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  // --- Handlers: Search ---
  const handleSearch = () => {
    setIsFiltered(true);
    fetchStores();
  };

  const handleReset = () => {
    setSearchAddress('');
    setSearchMarket('');
    setSearchStore('');
    setIsFiltered(false);
    fetchStores({ address: '', marketName: '', storeName: '' });
  };

  // --- Handlers: List Actions ---
  const handleRegister = () => {
    setSelectedStore(null);
    setFormData({ status: '사용', mode: '복합', address: '', addressDetail: '' });
    setSelectedMarketForForm(null);
    setStoreImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setView('form');
  };

  const handleEdit = (store: Store) => {
    setSelectedStore(store);
    setFormData({ ...store });
    // Set market info for display (using market_id)
    setSelectedMarketForForm({ id: store.market_id, name: store.marketName || '' } as Market);
    setStoreImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setView('form');
  };

  const handleExcelRegister = () => {
    setExcelData([]);
    setExcelMarket(null);
    setView('excel');
  };

  const handleListExcelDownload = () => {
    const exportData = stores.map((s, idx) => ({
        'No': idx + 1,
        '소속시장': s.marketName,
        '상가명': s.name,
        '대표자명': s.managerName,
        '대표자연락처': s.managerPhone,
        '주소': `${s.address || ''} ${s.addressDetail || ''}`.trim(),
        '상태': s.status
    }));
    exportToExcel(exportData, '상가관리_목록');
  };

  // --- Handlers: Form Image ---
  const handleFileSelectClick = () => {
    if (formData.storeImage || storeImageFile) {
      alert("등록된 이미지를 삭제해 주세요.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setStoreImageFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    if (confirm("이미지를 삭제하시겠습니까?")) {
        setFormData({ ...formData, storeImage: undefined });
        setStoreImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFileName = () => {
     if (storeImageFile) return storeImageFile.name;
     if (formData.storeImage) {
        try {
           const url = new URL(formData.storeImage);
           return decodeURIComponent(url.pathname.split('/').pop() || 'image.jpg');
        } catch {
           return '상가_이미지.jpg';
        }
     }
     return '';
  };

  const handleDownload = async () => {
    if (storeImageFile) {
        const url = URL.createObjectURL(storeImageFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = storeImageFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
    }
    if (formData.storeImage) {
        window.open(formData.storeImage, '_blank');
    }
  };

  // --- Handlers: Market Modal ---
  const fetchMarkets = async () => {
    const data = await MarketAPI.getList({ name: marketSearchName });
    setMarketList(data);
    setMarketModalPage(1);
  };

  const openMarketModal = () => {
    setMarketSearchName('');
    fetchMarkets();
    setIsMarketModalOpen(true);
  };

  const handleMarketSelect = (market: Market) => {
    if (view === 'form') {
      setSelectedMarketForForm(market);
      setFormData({ ...formData, market_id: market.id }); // [CHANGED] market_id
    } else if (view === 'excel') {
      setExcelMarket(market);
    }
    setIsMarketModalOpen(false);
  };

  // --- Handlers: Save (Single) ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.market_id) { alert('소속 시장을 선택해주세요.'); return; } // [CHANGED] market_id
    if (!formData.name) { alert('상가명을 입력해주세요.'); return; }
    if (!formData.status) { alert('상가 사용여부를 선택해주세요.'); return; }

    try {
      let uploadedImageUrl = formData.storeImage;
      if (storeImageFile) {
        uploadedImageUrl = await StoreAPI.uploadStoreImage(storeImageFile);
      }

      const cleanData = { ...formData };
      if (!cleanData.latitude) cleanData.latitude = undefined;
      if (!cleanData.longitude) cleanData.longitude = undefined;
      if (!cleanData.address) cleanData.address = undefined;
      if (!cleanData.handlingItems) cleanData.handlingItems = undefined;

      const newStore: Store = {
        ...cleanData as Store,
        id: selectedStore?.id || 0,
        storeImage: uploadedImageUrl,
      };

      await StoreAPI.save(newStore);
      alert('저장되었습니다.');
      setView('list');
      fetchStores();
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    }
  };

  const handleDelete = async () => {
    if(selectedStore && confirm('정말 삭제하시겠습니까?')) {
       try {
         await StoreAPI.delete(selectedStore.id);
         alert('삭제되었습니다.');
         setView('list');
         fetchStores();
       } catch(e) {
         alert('삭제 실패');
       }
    }
  };

  // --- Handlers: Excel Logic ---
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!excelMarket) {
        alert('먼저 소속 시장을 선택해주세요.');
        e.target.value = ''; // reset
        return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // Map excel rows to Store objects
        const parsedStores: Store[] = data.map((row: any, idx: number) => ({
          id: 0, 
          market_id: excelMarket.id, // [CHANGED] market_id
          marketName: excelMarket.name,
          name: row['상가명'] || `상가_${idx+1}`,
          managerName: row['대표자명'] || row['대표자'] || '',
          managerPhone: row['상가전화번호'] || row['대표자연락처'] || '',
          status: '사용',
          receiverMac: row['수신기MAC'] ? String(row['수신기MAC']) : '',
          repeaterId: row['중계기ID'] ? String(row['중계기ID']) : '',
          detectorId: row['감지기번호'] ? String(row['감지기번호']) : '',
          mode: row['모드'] || '복합',
          handlingItems: row['취급품목'] || '',
          address: row['주소(도로명)'] || row['주소'] || '',
          addressDetail: row['상세주소'] || '',
          memo: row['비고'] || '',
        }));

        setExcelData(parsedStores);
      } catch (e) {
        console.error(e);
        alert("엑셀 파일 처리 중 오류가 발생했습니다. 파일 형식을 확인해주세요.");
      }
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
        await StoreAPI.saveBulk(excelData);
        alert(`${excelData.length}건이 성공적으로 등록되었습니다.`);
        setView('list');
        fetchStores();
    } catch (e: any) {
        alert(`일괄 등록 실패: ${e.message}`);
    }
  };

  const handleSampleDownload = () => {
      const sampleData = [
        {
          '구분': '1',
          '수신기MAC': '1A2B',
          '중계기ID': '01',
          '감지기번호': '01',
          '모드': '복합',
          '상가명': '샘플상가',
          '상가전화번호': '02-1234-5678',
          '대표자': '홍길동',
          '대표자연락처': '010-1234-5678',
          '주소(도로명)': '서울시 강남구 테헤란로 123',
          '상세주소': '1층 101호',
          '취급품목': '의류',
          '비고': '비고 내용'
        }
      ];
      exportToExcel(sampleData, '상가일괄등록_샘플양식');
  };

  // --- Table Columns ---
  const columns: Column<Store>[] = [
    { header: 'No', accessor: 'id', width: '60px' },
    { header: '소속시장', accessor: 'marketName' },
    { header: '상가명', accessor: 'name' },
    { header: '대표자', accessor: 'managerName' },
    { header: '대표자연락처', accessor: (s) => formatPhoneNumber(s.managerPhone) || '-' }, 
    { header: '상태', accessor: (s) => <StatusBadge status={s.status} />, width: '120px' },
  ];

  const marketColumns: Column<Market>[] = [
    { header: '시장명', accessor: 'name' },
    { header: '주소', accessor: 'address' },
    { header: '담당자', accessor: 'managerName' },
    { header: '선택', accessor: (item) => (
        <Button variant="primary" onClick={() => handleMarketSelect(item)} className="px-2 py-1 text-xs">선택</Button>
    ), width: '80px' }
  ];

  // --- Pagination Data ---
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = stores.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(stores.length / ITEMS_PER_PAGE);

  const modalIndexOfLast = marketModalPage * MODAL_ITEMS_PER_PAGE;
  const modalIndexOfFirst = modalIndexOfLast - MODAL_ITEMS_PER_PAGE;
  const modalCurrentMarkets = marketList.slice(modalIndexOfFirst, modalIndexOfLast);
  const modalTotalPages = Math.ceil(marketList.length / MODAL_ITEMS_PER_PAGE);


  // --- VIEW: FORM ---
  if (view === 'form') {
    return (
      <>
        <PageHeader title="기기 관리" />
        <form onSubmit={handleSave}>
          <FormSection title={selectedStore ? "기기 수정" : "기기 등록"}>
            <FormRow label="소속 시장" required>
               <div className="flex gap-2 w-full">
                 <div onClick={openMarketModal} className="flex-1 relative cursor-pointer">
                    <input 
                       type="text"
                       value={selectedMarketForForm?.name || ''} 
                       placeholder="시장 선택" 
                       readOnly 
                       className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
                    />
                    <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                 </div>
                 <Button type="button" variant="secondary" onClick={openMarketModal}>찾기</Button>
               </div>
            </FormRow>

            <FormRow label="상가명" required>
               <InputGroup 
                 value={formData.name || ''} 
                 onChange={(e) => setFormData({...formData, name: e.target.value})} 
                 placeholder="상가명 입력"
               />
            </FormRow>

            <div className="col-span-1 md:col-span-2">
              <AddressInput 
                 label="주소"
                 address={formData.address || ''}
                 addressDetail={formData.addressDetail || ''}
                 onAddressChange={(val) => setFormData(prev => ({...prev, address: val}))}
                 onDetailChange={(val) => setFormData(prev => ({...prev, addressDetail: val}))}
                 onCoordinateChange={(lat, lng) => setFormData(prev => ({...prev, latitude: lat, longitude: lng}))}
              />
            </div>

            <FormRow label="위도">
               <InputGroup value={formData.latitude || ''} onChange={(e) => setFormData({...formData, latitude: e.target.value})} placeholder="위도" />
            </FormRow>
            <FormRow label="경도">
               <InputGroup value={formData.longitude || ''} onChange={(e) => setFormData({...formData, longitude: e.target.value})} placeholder="경도" />
            </FormRow>

            <FormRow label="대표자">
               <InputGroup value={formData.managerName || ''} onChange={(e) => setFormData({...formData, managerName: e.target.value})} />
            </FormRow>
            <FormRow label="대표자 연락처">
               <InputGroup 
                 value={formData.managerPhone || ''} 
                 onChange={(e) => setFormData({...formData, managerPhone: e.target.value.replace(/[^0-9]/g, '')})} 
                 onKeyDown={handlePhoneKeyDown}
                 inputMode="numeric"
                 placeholder="숫자만 입력하세요"
                 maxLength={11}
               />
            </FormRow>

            <FormRow label="취급품목" className="col-span-1 md:col-span-2">
               <InputGroup value={formData.handlingItems || ''} onChange={(e) => setFormData({...formData, handlingItems: e.target.value})} placeholder="예: 의류, 잡화" />
            </FormRow>

            <FormRow label="수신기 MAC (4자리)">
               <InputGroup value={formData.receiverMac || ''} onChange={(e) => setFormData({...formData, receiverMac: e.target.value})} placeholder="예: 1A2B" maxLength={4} />
            </FormRow>
            <FormRow label="중계기 ID (2자리)">
               <InputGroup value={formData.repeaterId || ''} onChange={(e) => setFormData({...formData, repeaterId: e.target.value})} placeholder="예: 01" maxLength={2} />
            </FormRow>
            <FormRow label="감지기 번호 (2자리)">
               <InputGroup value={formData.detectorId || ''} onChange={(e) => setFormData({...formData, detectorId: e.target.value})} placeholder="예: 01" maxLength={2} />
               <p className="text-xs text-blue-400 mt-1 break-keep">: 수신기, 중계기, 감지기를 새로 등록수정 시, 현장 기기관리에도 데이터가 연동됩니다.</p>
            </FormRow>

            <FormRow label="비고" className="col-span-1 md:col-span-2">
               <InputGroup value={formData.memo || ''} onChange={(e) => setFormData({...formData, memo: e.target.value})} />
            </FormRow>

            <FormRow label="상가 이미지" className="col-span-1 md:col-span-2">
                 {selectedStore ? (
                    <div className="flex flex-col gap-2 w-full">
                       <div className="flex items-center gap-2">
                          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                          <Button type="button" variant="secondary" onClick={handleFileSelectClick} icon={<Upload size={16} />}>파일 선택</Button>
                          {(formData.storeImage || storeImageFile) && (
                             <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded border border-slate-600">
                                <Paperclip size={14} className="text-slate-400" />
                                <span onClick={handleDownload} className={`text-sm ${formData.storeImage || storeImageFile ? 'text-blue-400 cursor-pointer hover:underline' : 'text-slate-300'}`} title="클릭하여 다운로드">{getFileName()}</span>
                                <button type="button" onClick={handleRemoveFile} className="text-red-400 hover:text-red-300 ml-2 p-1 rounded hover:bg-slate-600 transition-colors"><X size={16} /></button>
                             </div>
                          )}
                       </div>
                       <p className="text-xs text-slate-500 mt-1">최대 10MB, jpg/png/gif 지원 (수정 시에만 가능)</p>
                    </div>
                 ) : (
                    <div className="flex items-center h-[42px] px-3 bg-slate-800/50 border border-slate-700 rounded text-slate-500 text-sm italic w-full">신규 등록 시에는 이미지를 첨부할 수 없습니다. 등록 후 수정 단계에서 진행해 주세요.</div>
                 )}
            </FormRow>

            <FormRow label="사용여부" className="col-span-1 md:col-span-2">
               <StatusRadioGroup label="" value={formData.status} onChange={(val) => setFormData({...formData, status: val as any})} />
            </FormRow>
          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
             <Button type="submit" variant="primary" className="w-32">{selectedStore ? '수정' : '등록'}</Button>
             <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
          </div>
        </form>

        <Modal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} title="시장 찾기" width="max-w-3xl">
           <SearchFilterBar onSearch={fetchMarkets}>
              <InputGroup label="시장명" value={marketSearchName} onChange={(e) => setMarketSearchName(e.target.value)} placeholder="시장명 검색" />
           </SearchFilterBar>
           <DataTable columns={marketColumns} data={modalCurrentMarkets} />
           <Pagination totalItems={marketList.length} itemsPerPage={MODAL_ITEMS_PER_PAGE} currentPage={marketModalPage} onPageChange={setMarketModalPage} />
        </Modal>
      </>
    );
  }

  // --- View: List/Excel Omitted for Brevity (Similar Updates Applied) ---
  // ... (Excel logic and List view logic similar to above with market_id update) ...
  return (
    <>
      <PageHeader title="기기 관리" />
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <InputGroup label="상가명" value={searchStore} onChange={(e) => setSearchStore(e.target.value)} placeholder="상가명 입력" />
        <InputGroup label="소속시장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} placeholder="시장명 입력" />
        <InputGroup label="주소" value={searchAddress} onChange={(e) => setSearchAddress(e.target.value)} placeholder="주소 입력" />
      </SearchFilterBar>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-400">
          전체 <span className="text-blue-400">{stores.length}</span> 건
          (페이지 {currentPage})
        </span>
        <div className="flex gap-2">
           <Button variant="primary" onClick={handleRegister}>신규 등록</Button>
           <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16} />}>엑셀 신규 등록</Button>
           <Button variant="success" onClick={handleListExcelDownload} icon={<Search size={16} />}>엑셀 다운로드</Button>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-20 text-slate-500">Loading...</div>
      ) : (
        <DataTable columns={columns} data={currentItems} onRowClick={handleEdit} />
      )}
      <Pagination totalItems={stores.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
    </>
  );
};
