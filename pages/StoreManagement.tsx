import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, InputGroup, 
  Button, DataTable, Pagination, FormSection, FormRow, Modal, UI_STYLES, AddressInput,
  formatPhoneNumber, StatusBadge, StatusRadioGroup, Column, MarketSearchModal, SearchFilterBar
} from '../components/CommonUI';
import { Store, Market } from '../types';
import { StoreAPI, MarketAPI } from '../services/api';
import { Search, FileSpreadsheet, Upload, Plus, Download } from 'lucide-react';
import { exportToExcel } from '../utils/excel';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;

export const StoreManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // --- Search States (Match List UI Image) ---
  const [searchStore, setSearchStore] = useState('');
  const [searchMarket, setSearchMarket] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);
  
  // --- Form Data ---
  const [formData, setFormData] = useState<Partial<Store>>({ status: '사용' });
  const [selectedMarketName, setSelectedMarketName] = useState('');
  const [storeImageFile, setStoreImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Modals ---
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  
  // --- Excel Data ---
  const [excelData, setExcelData] = useState<Store[]>([]);
  const [excelMarket, setExcelMarket] = useState<Market | null>(null);

  // --- Data Loading ---
  const fetchStores = async () => {
    setLoading(true);
    try {
      const data = await StoreAPI.getList({ 
          storeName: searchStore,
          marketName: searchMarket,
          address: searchAddress
      });
      setStores(data);
      setCurrentPage(1);
    } catch (e) { 
        console.error(e);
        alert('데이터 로드 실패'); 
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => { fetchStores(); }, []);

  const handleSearch = () => {
      setIsFiltered(true);
      fetchStores();
  };

  const handleReset = () => {
      setSearchStore('');
      setSearchMarket('');
      setSearchAddress('');
      setIsFiltered(false);
      // Reset logic calls fetch with empty params indirectly via state update or direct call
      // Here we assume fetchStores reads state, so we might need a direct call with empty values or useEffect dependency
      // For simplicity in this structure, we'll manually call API with empty params
      StoreAPI.getList({}).then(data => setStores(data));
  };

  // --- Action Handlers ---
  const handleRegister = () => {
    setSelectedStore(null);
    // [SQL Match] Initialize all fields including new ones
    setFormData({ 
        status: '사용', 
        mode: '복합', 
        marketId: 0, 
        handlingItems: '', 
        latitude: '', 
        longitude: '',
        detectorId: '',
        repeaterId: '',
        receiverMac: '',
        memo: ''
    }); 
    setSelectedMarketName('');
    setStoreImageFile(null);
    setView('form');
  };

  const handleEdit = (store: Store) => {
    setSelectedStore(store);
    setFormData({ ...store });
    setSelectedMarketName(store.marketName || '-');
    setStoreImageFile(null);
    setView('form');
  };

  const handleMarketSelect = (market: Market) => {
    if (view === 'form') {
        setFormData(prev => ({ ...prev, marketId: market.id }));
        setSelectedMarketName(market.name);
    } else if (view === 'excel') {
        setExcelMarket(market);
    }
    setIsMarketModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.marketId) { alert('소속 시장을 선택해주세요.'); return; }
    if (!formData.name) { alert('상가명을 입력해주세요.'); return; }

    try {
      let uploadedUrl = formData.storeImage;
      if (storeImageFile) {
        uploadedUrl = await StoreAPI.uploadStoreImage(storeImageFile);
      }

      const finalData: Store = {
        ...formData as Store,
        id: selectedStore?.id || 0,
        storeImage: uploadedUrl,
      };

      await StoreAPI.save(finalData);
      alert('저장되었습니다.');
      setView('list');
      fetchStores();
    } catch (e: any) { alert(`저장 실패: ${e.message}`); }
  };

  // --- Excel Handlers ---
  const handleExcelRegister = () => {
      setExcelData([]);
      setExcelMarket(null);
      setView('excel');
  };

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
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const parsedData: Store[] = data.map((row: any) => ({
          id: 0,
          marketId: excelMarket!.id,
          marketName: excelMarket!.name,
          name: row['상가명'] || '',
          managerName: row['대표자'] || '',
          managerPhone: row['대표자연락처'] || row['연락처'] || '', // Match screenshot column naming flexibility
          address: row['주소'] || '',
          addressDetail: row['상세주소'] || '',
          handlingItems: row['취급품목'] || '',
          receiverMac: row['수신기MAC'] ? String(row['수신기MAC']) : '',
          repeaterId: row['중계기ID'] ? String(row['중계기ID']) : '',
          detectorId: row['감지기번호'] ? String(row['감지기번호']) : '',
          memo: row['비고'] || '',
          mode: row['모드'] || '복합',
          status: '사용',
        }));
        setExcelData(parsedData);
      } catch (e) {
        alert("엑셀 파일 처리 중 오류가 발생했습니다.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelSave = async () => {
      if (excelData.length === 0) return;
      try {
          await StoreAPI.saveBulk(excelData);
          alert('일괄 등록되었습니다.');
          setView('list');
          fetchStores();
      } catch(e: any) {
          alert('일괄 등록 실패: ' + e.message);
      }
  };

  const handleSampleDownload = () => {
      const sample = [
          {'상가명': '예시상가', '대표자': '홍길동', '대표자연락처': '010-1234-5678', '주소': '서울시...', '상세주소': '1층', '취급품목': '잡화', '수신기MAC': '1A2B', '중계기ID': '01', '감지기번호': '01', '모드': '복합', '비고': ''}
      ];
      exportToExcel(sample, '기기관리_일괄등록_샘플');
  };

  const handleExcelDownload = () => {
      const excelList = stores.map((s, index) => ({
          'No': index + 1,
          '소속시장': s.marketName,
          '상가명': s.name,
          '대표자': s.managerName,
          '대표자연락처': s.managerPhone,
          '주소': `${s.address || ''} ${s.addressDetail || ''}`,
          '상태': s.status
      }));
      exportToExcel(excelList, '기기관리_상가_목록');
  };

  // --- Columns (Match List Image) ---
  const columns: Column<Store>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '소속시장', accessor: 'marketName' },
    { header: '상가명', accessor: 'name' },
    { header: '대표자', accessor: (s) => s.managerName || '-' },
    { header: '대표자연락처', accessor: (s) => formatPhoneNumber(s.managerPhone || '') || '-' },
    { header: '상태', accessor: (s) => <StatusBadge status={s.status} />, width: '100px' },
  ];

  // --- Pagination ---
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = stores.slice(indexOfFirstItem, indexOfLastItem);

  // --- Views ---

  if (view === 'form') {
    return (
      <>
        <PageHeader title="기기 관리" />
        <form onSubmit={handleSave}>
          <FormSection title={selectedStore ? "기기 수정" : "기기 등록"}>
            
            {/* Row 1: 소속시장, 상가명 */}
            <FormRow label="소속 시장" required>
               <div className="flex gap-2 w-full">
                 <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                    <input 
                       type="text"
                       value={selectedMarketName} 
                       placeholder="시장 선택" 
                       readOnly 
                       className={`${UI_STYLES.input} cursor-pointer pr-8`}
                    />
                    <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                 </div>
                 <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
               </div>
            </FormRow>
            <FormRow label="상가명" required>
               <InputGroup value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="상가명 입력" />
            </FormRow>

            {/* Row 2: 주소 (Full Width) */}
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

            {/* Row 3: 위도, 경도 */}
            <FormRow label="위도">
               <InputGroup 
                  value={formData.latitude || ''} 
                  placeholder="위도" 
                  readOnly 
                  className="bg-slate-700/50 text-slate-400" 
               />
            </FormRow>
            <FormRow label="경도">
               <InputGroup 
                  value={formData.longitude || ''} 
                  placeholder="경도" 
                  readOnly 
                  className="bg-slate-700/50 text-slate-400" 
               />
            </FormRow>

            {/* Row 4: 대표자, 대표자 연락처 */}
            <FormRow label="대표자">
               <InputGroup value={formData.managerName || ''} onChange={(e) => setFormData({...formData, managerName: e.target.value})} />
            </FormRow>
            <FormRow label="대표자 연락처">
               <InputGroup 
                 value={formData.managerPhone || ''} 
                 onChange={(e) => setFormData({...formData, managerPhone: e.target.value.replace(/[^0-9]/g, '')})} 
                 placeholder="숫자만 입력하세요"
                 maxLength={11}
               />
            </FormRow>

            {/* Row 5: 취급품목 (Full Width) */}
            <FormRow label="취급품목" className="col-span-1 md:col-span-2">
               <InputGroup value={formData.handlingItems || ''} onChange={(e) => setFormData({...formData, handlingItems: e.target.value})} placeholder="예: 의류, 잡화" />
            </FormRow>

            {/* Row 6: 수신기, 중계기 */}
            <FormRow label="수신기 MAC (4자리)">
               <InputGroup value={formData.receiverMac || ''} onChange={(e) => setFormData({...formData, receiverMac: e.target.value})} maxLength={4} placeholder="예: 1A2B" />
            </FormRow>
            <FormRow label="중계기 ID (2자리)">
               <InputGroup value={formData.repeaterId || ''} onChange={(e) => setFormData({...formData, repeaterId: e.target.value})} maxLength={2} placeholder="예: 01" />
            </FormRow>

            {/* Row 7: 감지기 번호 (Full Width with Help Text) */}
            <FormRow label="감지기 번호 (2자리)" className="col-span-1 md:col-span-2">
               <div className="flex flex-col gap-1">
                   <InputGroup value={formData.detectorId || ''} onChange={(e) => setFormData({...formData, detectorId: e.target.value})} maxLength={2} placeholder="예: 01" />
                   <span className="text-xs text-blue-400">: 수신기, 중계기, 감지기를 새로 등록수정 시, 현장 기기관리에도 데이터가 연동됩니다.</span>
               </div>
            </FormRow>

            {/* Row 8: 비고 (Full Width) */}
            <FormRow label="비고" className="col-span-1 md:col-span-2">
               <InputGroup value={formData.memo || ''} onChange={(e) => setFormData({...formData, memo: e.target.value})} />
            </FormRow>

            {/* Row 9: 상가 이미지 (Full Width) */}
            <FormRow label="상가 이미지" className="col-span-1 md:col-span-2">
               <div className="flex flex-col gap-2">
                   <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && setStoreImageFile(e.target.files[0])} className="hidden" accept="image/*" />
                   <div className="flex gap-2 items-center">
                       <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<Upload size={16}/>}>파일 선택</Button>
                       <span className="text-sm text-slate-400">{storeImageFile ? storeImageFile.name : (formData.storeImage ? '기존 이미지 유지' : '선택된 파일 없음')}</span>
                   </div>
                   <span className="text-xs text-slate-500">신규 등록 시에는 이미지를 첨부할 수 없습니다. 등록 후 수정 단계에서 진행해 주세요.</span>
               </div>
            </FormRow>

            {/* Row 10: 사용여부 (Full Width) */}
            <FormRow label="사용여부" className="col-span-1 md:col-span-2">
               <StatusRadioGroup label="" value={formData.status} onChange={(val) => setFormData({...formData, status: val as any})} />
            </FormRow>
          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
             <Button type="submit" variant="primary" className="w-32">{selectedStore ? '수정' : '등록'}</Button>
             <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
          </div>
        </form>

        <MarketSearchModal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} onSelect={handleMarketSelect} />
      </>
    );
  }

  if (view === 'excel') {
      return (
          <>
             <PageHeader title="기기 관리" />
             {/* Section Style matching Screenshot 3 */}
             <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm w-full mb-6">
                 <h3 className="text-lg font-bold text-slate-200 mb-5 border-b border-slate-700 pb-2 flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-500 rounded-sm"></span>
                    엑셀 일괄 등록
                 </h3>
                 <div className="grid grid-cols-1 gap-6">
                    <FormRow label="소속 시장" required>
                       <div className="flex gap-2 w-full">
                          <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                             <input type="text" value={excelMarket?.name || ''} placeholder="등록할 시장을 선택하세요" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                             <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                          </div>
                          <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
                       </div>
                    </FormRow>
                    
                    <FormRow label="엑셀 파일 선택" required>
                       <div className="flex flex-col gap-2">
                           <InputGroup type="file" accept=".xlsx, .xls" onChange={handleExcelFileChange} className="border-0 p-0 text-slate-300" />
                           <p className="text-xs text-slate-400">* 수신기MAC, 중계기ID, 감지기번호, 모드, 상가명, 상가전화번호, 대표자, 대표자연락처, 주소, 상세주소, 취급품목, 비고 컬럼을 포함해야 합니다.</p>
                       </div>
                    </FormRow>

                    <FormRow label="샘플 양식">
                        <Button type="button" variant="secondary" onClick={handleSampleDownload} icon={<Download size={14} />} className="w-fit">
                           엑셀 샘플 다운로드
                        </Button>
                    </FormRow>
                 </div>
             </div>

             <div className="flex justify-center gap-3 mt-8">
                <Button type="button" variant="primary" onClick={handleExcelSave} className="w-32" disabled={excelData.length === 0}>일괄 등록</Button>
                <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
             </div>
             <MarketSearchModal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} onSelect={handleMarketSelect} />
          </>
      );
  }

  // --- View: List ---
  return (
    <>
      <PageHeader title="기기 관리" />
      
      {/* Search Filter Bar - Match List Image */}
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <InputGroup 
            label="상가명" 
            value={searchStore} 
            onChange={(e) => setSearchStore(e.target.value)} 
            placeholder="상가명 입력" 
        />
        <InputGroup 
            label="소속시장" 
            value={searchMarket} 
            onChange={(e) => setSearchMarket(e.target.value)} 
            placeholder="시장명 입력" 
        />
        <InputGroup 
            label="주소" 
            value={searchAddress} 
            onChange={(e) => setSearchAddress(e.target.value)} 
            placeholder="주소 입력" 
        />
      </SearchFilterBar>

      {/* Action Bar - Match List Image */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
        <span className="text-sm text-slate-400 font-medium">
          전체 <span className="text-blue-400 font-bold">{stores.length}</span> 건 (페이지 {currentPage})
        </span>
        <div className="flex gap-2">
            <Button variant="primary" onClick={handleRegister} icon={<Plus size={16}/>} className="bg-blue-600 hover:bg-blue-500">신규 등록</Button>
            <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16}/>} className="bg-slate-700 border-slate-600 text-slate-200">엑셀 신규 등록</Button>
            <Button variant="success" onClick={handleExcelDownload} icon={<FileSpreadsheet size={16}/>} className="bg-green-600 hover:bg-green-500">엑셀 다운로드</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">데이터를 불러오는 중입니다...</div>
      ) : (
        <DataTable<Store> 
            columns={columns}
            data={currentItems}
            onRowClick={handleEdit} 
        />
      )}
      
      <Pagination 
        totalItems={stores.length} 
        itemsPerPage={ITEMS_PER_PAGE} 
        currentPage={currentPage} 
        onPageChange={setCurrentPage} 
      />
    </>
  );
};