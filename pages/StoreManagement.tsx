
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { StoreAPI, MarketAPI } from '../services/api';
import { Store, Market, Receiver } from '../types';
import { 
  PageHeader, SearchFilterBar, InputGroup, Button, DataTable, Pagination, 
  ActionBar, FormSection, FormRow, AddressInput, StatusRadioGroup, 
  MarketSearchModal, ReceiverSearchModal, UI_STYLES, StatusBadge, Column, 
  handlePhoneKeyDown, formatPhoneNumber 
} from '../components/CommonUI';
import { Search, Upload, Paperclip, X, Download, Plus, FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '../utils/excel';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;

// 엑셀 미리보기용 확장 인터페이스
interface ExcelStoreItem extends Store {
    _status: '신규' | '수정';
}

// [FIX] Completed the truncated StoreManagement component and returned valid JSX to fix the "Type '() => void' is not assignable to type 'FC<{}>'" error
export const StoreManagement: React.FC = () => {
  const location = useLocation();
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState<Partial<Store>>({});
  const [loading, setLoading] = useState(false);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);

  // 검색 필터
  const [searchMarket, setSearchMarket] = useState('');
  const [searchStore, setSearchStore] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

  // 모달
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [isReceiverModalOpen, setIsReceiverModalOpen] = useState(false);
  
  // 파일 업로드
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 엑셀 업로드
  const [excelData, setExcelData] = useState<ExcelStoreItem[]>([]);
  const [excelMarket, setExcelMarket] = useState<Market | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  const fetchStores = async (overrides?: any) => {
    setLoading(true);
    try {
      const query = {
        marketName: overrides?.marketName !== undefined ? overrides.marketName : searchMarket,
        storeName: overrides?.storeName !== undefined ? overrides.storeName : searchStore,
        address: overrides?.address !== undefined ? overrides.address : searchAddress,
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

  useEffect(() => {
    if (stores.length > 0 && location.state?.editId) {
        const targetStore = stores.find(s => s.id === location.state.editId);
        if (targetStore) {
            handleEdit(targetStore);
            window.history.replaceState({}, document.title);
        }
    }
  }, [stores, location.state]);

  // 핸들러
  const handleSearch = () => { setIsFiltered(true); fetchStores(); };
  const handleReset = () => {
    setSearchMarket(''); setSearchStore(''); setSearchAddress('');
    setIsFiltered(false);
    fetchStores({ marketName: '', storeName: '', address: '' });
  };

  const handleRegister = () => {
    setSelectedStore(null);
    setFormData({ 
      status: '사용', 
      mode: '복합', 
      address: '', 
      addressDetail: '' 
    });
    setImageFile(null);
    setView('form');
  };

  const handleEdit = (store: Store) => {
    setSelectedStore(store);
    setFormData({ ...store });
    setImageFile(null);
    setView('form');
  };

  const handleDelete = async () => {
    if(selectedStore && confirm('정말 삭제하시겠습니까?')) {
      try {
        await StoreAPI.delete(selectedStore.id);
        alert('삭제되었습니다.');
        setView('list');
        fetchStores();
      } catch (e) { alert('삭제 실패'); }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.marketId) { alert('현장을 선택해주세요.'); return; }
    if (!formData.name) { alert('기기위치를 입력해주세요.'); return; }

    try {
      let uploadedUrl = formData.storeImage;
      if (imageFile) uploadedUrl = await StoreAPI.uploadStoreImage(imageFile);

      const newStore: Store = {
        ...formData as Store,
        id: selectedStore?.id || 0,
        storeImage: uploadedUrl
      };

      await StoreAPI.save(newStore);
      alert('저장되었습니다.');
      setView('list');
      fetchStores();
    } catch (e: any) { alert('저장 실패: ' + e.message); }
  };

  const handleMarketSelect = (market: Market) => {
    if (view === 'form') {
      setFormData({ 
        ...formData, 
        marketId: market.id, 
        marketName: market.name,
        address: formData.address || market.address, 
      });
    } else if (view === 'excel') {
      setExcelMarket(market);
    }
    setIsMarketModalOpen(false);
  };

  const handleReceiverSelect = (receiver: Receiver) => {
    setFormData({
      ...formData,
      receiverMac: receiver.macAddress
    });
    setIsReceiverModalOpen(false);
  };

  // --- 엑셀 로직 ---
  const handleExcelRegister = () => {
    setExcelData([]);
    setExcelMarket(null);
    setView('excel');
  };

  // [FIX] Completed the truncated handleExcelFileChange function and added proper error handling
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!excelMarket) {
        alert('먼저 설치 현장을 선택해주세요.');
        if (excelFileInputRef.current) excelFileInputRef.current.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
            alert('엑셀 파일에 데이터가 없습니다.');
            return;
        }

        const existingStores = await StoreAPI.getList({ marketId: excelMarket.id });
        const dbMap = new Map<string, Store>();
        existingStores.forEach(s => {
            const key = `${s.receiverMac}-${s.repeaterId}-${s.detectorId}`;
            dbMap.set(key, s);
        });

        const fileDuplicateMap = new Map<string, number>();
        const parsedData: ExcelStoreItem[] = [];
        const errors: string[] = [];

        for (let i = 0; i < data.length; i++) {
            const row: any = data[i];
            const rowNum = i + 2;

            const mac = row['수신기MAC'] ? String(row['수신기MAC']).trim() : '';
            const rptId = row['중계기ID'] ? String(row['중계기ID']).padStart(2, '0') : '';
            const detId = row['감지기번호'] ? String(row['감지기번호']).padStart(2, '0') : '';

            if (!mac || !rptId || !detId) {
                errors.push(`${rowNum}행: 필수 식별 정보(MAC, 중계기, 감지기)가 누락되었습니다.`);
                continue;
            }

            const key = `${mac}-${rptId}-${detId}`;

            if (fileDuplicateMap.has(key)) {
                const firstOccur = fileDuplicateMap.get(key);
                alert(`${firstOccur}행과 ${rowNum}행의 기기 정보가 중복되었습니다. 파일을 확인해 주세요.`);
                setExcelData([]);
                if (excelFileInputRef.current) excelFileInputRef.current.value = '';
                return;
            }
            fileDuplicateMap.set(key, rowNum);

            const matchedStore = dbMap.get(key);

            parsedData.push({
                id: matchedStore ? matchedStore.id : 0,
                marketId: excelMarket!.id,
                marketName: excelMarket!.name,
                receiverMac: mac,
                repeaterId: rptId,
                detectorId: detId,
                mode: (row['모드'] || '복합') as any,
                name: row['기기위치'] || '',
                managerName: row['대표자'] || '',
                managerPhone: row['연락처'] || '',
                address: row['주소'] || excelMarket!.address,
                addressDetail: row['상세주소'] || '',
                handlingItems: row['취급품목'] || '',
                memo: row['비고'] || '',
                status: '사용',
                _status: matchedStore ? '수정' : '신규'
            });
        }

        if (errors.length > 0) {
            alert(`엑셀 내용에 오류가 있습니다:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`);
            setExcelData([]);
            if (excelFileInputRef.current) excelFileInputRef.current.value = '';
            return;
        }

        setExcelData(parsedData);
      } catch (err) {
        console.error(err);
        alert('파일을 처리하는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelSave = async () => {
    if (excelData.length === 0) return;
    setLoading(true);
    try {
      await StoreAPI.saveBulk(excelData);
      alert('일괄 등록이 완료되었습니다.');
      setView('list');
      fetchStores();
    } catch (e: any) {
      alert('일괄 등록 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSampleDownload = () => {
    const sample = [
      { '수신기MAC': '1A2B', '중계기ID': '01', '감지기번호': '01', '모드': '복합', '기기위치': '상가1', '대표자': '홍길동', '연락처': '01012345678', '주소': '', '상세주소': '101호', '취급품목': '의류', '비고': '' }
    ];
    exportToExcel(sample, '상가관리_일괄등록_샘플');
  };

  const columns: Column<Store>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '현장명', accessor: 'marketName' },
    { header: '기기위치', accessor: 'name' },
    { header: '수신기MAC', accessor: 'receiverMac', width: '100px' },
    { header: '중계기ID', accessor: 'repeaterId', width: '80px' },
    { header: '감지기ID', accessor: 'detectorId', width: '80px' },
    { header: '상태', accessor: (s) => <StatusBadge status={s.status} />, width: '100px' },
  ];

  const excelColumns: Column<ExcelStoreItem>[] = [
    { header: '상태', accessor: (item) => (
        <span className={`px-2 py-0.5 rounded text-xs ${item._status === '신규' ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'}`}>
            {item._status}
        </span>
    ), width: '80px' },
    { header: '기기위치', accessor: 'name' },
    { header: 'MAC', accessor: 'receiverMac' },
    { header: '중계기', accessor: 'repeaterId' },
    { header: '감지기', accessor: 'detectorId' },
  ];

  const currentStores = stores.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (view === 'form') {
      return (
          <>
            <PageHeader title={selectedStore ? "상가 수정" : "상가 등록"} />
            <form onSubmit={handleSave}>
                <FormSection title="상가 기본 정보">
                    <FormRow label="설치 현장" required className="col-span-1 md:col-span-2">
                        <div className="flex gap-2 w-full max-w-md">
                            <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                                <input type="text" value={formData.marketName || ''} placeholder="현장을 선택하세요" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                                <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                            </div>
                            <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
                        </div>
                    </FormRow>
                    <FormRow label="기기위치(상호)" required>
                        <InputGroup value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="상가 이름 또는 기기 위치" />
                    </FormRow>
                    <FormRow label="대표자명">
                        <InputGroup value={formData.managerName || ''} onChange={(e) => setFormData({...formData, managerName: e.target.value})} />
                    </FormRow>
                    <FormRow label="연락처">
                        <InputGroup value={formData.managerPhone || ''} onChange={(e) => setFormData({...formData, managerPhone: e.target.value})} onKeyDown={handlePhoneKeyDown} maxLength={13} />
                    </FormRow>
                    <FormRow label="취급품목">
                        <InputGroup value={formData.handlingItems || ''} onChange={(e) => setFormData({...formData, handlingItems: e.target.value})} />
                    </FormRow>
                    <div className="col-span-1 md:col-span-2">
                        <AddressInput 
                            address={formData.address || ''} 
                            addressDetail={formData.addressDetail || ''} 
                            onAddressChange={(v) => setFormData({...formData, address: v})} 
                            onDetailChange={(v) => setFormData({...formData, addressDetail: v})}
                            onCoordinateChange={(lat, lng) => setFormData({...formData, latitude: lat, longitude: lng})}
                        />
                    </div>
                </FormSection>

                <FormSection title="기기 연동 정보">
                    <FormRow label="수신기 MAC">
                        <div className="flex gap-2 w-full">
                            <InputGroup className="flex-1" value={formData.receiverMac || ''} onChange={(e) => setFormData({...formData, receiverMac: e.target.value})} placeholder="예: 1A2B" maxLength={4} />
                            <Button type="button" variant="secondary" onClick={() => setIsReceiverModalOpen(true)}>검색</Button>
                        </div>
                    </FormRow>
                    <FormRow label="중계기 ID">
                        <InputGroup value={formData.repeaterId || ''} onChange={(e) => setFormData({...formData, repeaterId: e.target.value})} placeholder="01~20" maxLength={2} />
                    </FormRow>
                    <FormRow label="감지기 ID">
                        <InputGroup value={formData.detectorId || ''} onChange={(e) => setFormData({...formData, detectorId: e.target.value})} placeholder="01~20" maxLength={2} />
                    </FormRow>
                    <FormRow label="감지 모드">
                        <StatusRadioGroup value={formData.mode} onChange={(v) => setFormData({...formData, mode: v as any})} options={['복합', '열', '연기']} />
                    </FormRow>
                </FormSection>

                <FormSection title="기타 설정">
                    <FormRow label="사용 여부">
                        <StatusRadioGroup value={formData.status} onChange={(v) => setFormData({...formData, status: v as any})} />
                    </FormRow>
                    <FormRow label="비고" className="col-span-1 md:col-span-2">
                        <InputGroup value={formData.memo || ''} onChange={(e) => setFormData({...formData, memo: e.target.value})} />
                    </FormRow>
                </FormSection>

                <div className="flex justify-center gap-3 mt-8">
                    <Button type="submit" variant="primary" className="w-32">{selectedStore ? '수정' : '등록'}</Button>
                    {selectedStore && <Button type="button" variant="danger" onClick={handleDelete} className="w-32">삭제</Button>}
                    <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
                </div>
            </form>
            <MarketSearchModal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} onSelect={handleMarketSelect} />
            <ReceiverSearchModal isOpen={isReceiverModalOpen} onClose={() => setIsReceiverModalOpen(false)} onSelect={handleReceiverSelect} />
          </>
      );
  }

  if (view === 'excel') {
      return (
          <>
            <PageHeader title="상가 엑셀 일괄 등록" />
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm mb-6">
                <FormRow label="설치 현장 선택" required>
                    <div className="flex gap-2 w-full max-w-md">
                        <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                            <input type="text" value={excelMarket?.name || ''} placeholder="현장을 선택하세요" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                        </div>
                        <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
                    </div>
                </FormRow>
                <div className="mt-6 flex flex-col gap-4">
                    <FormRow label="엑셀 파일 업로드">
                        <div className="flex items-center gap-4">
                            <input type="file" ref={excelFileInputRef} accept=".xlsx, .xls" onChange={handleExcelFileChange} className="hidden" />
                            <Button type="button" variant="secondary" onClick={() => excelFileInputRef.current?.click()} icon={<Upload size={16}/>}>파일 선택</Button>
                            <Button type="button" variant="secondary" onClick={handleSampleDownload} icon={<Download size={16}/>}>양식 다운로드</Button>
                        </div>
                    </FormRow>
                </div>
            </div>

            {excelData.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-lg font-bold text-slate-200 mb-4">등록 미리보기 ({excelData.length}건)</h3>
                    <DataTable columns={excelColumns} data={excelData.slice(0, 50)} />
                    {excelData.length > 50 && <p className="text-center text-slate-500 mt-2">...외 {excelData.length - 50}건</p>}
                    <div className="flex justify-center gap-3 mt-8">
                        <Button variant="primary" onClick={handleExcelSave} className="w-40">일괄 저장하기</Button>
                        <Button variant="secondary" onClick={() => setView('list')} className="w-40">취소</Button>
                    </div>
                </div>
            )}
            <MarketSearchModal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} onSelect={handleMarketSelect} />
          </>
      );
  }

  return (
    <>
      <PageHeader title="상가 관리" />
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <InputGroup label="설치현장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} placeholder="현장명 검색" />
        <InputGroup label="기기위치(상호)" value={searchStore} onChange={(e) => setSearchStore(e.target.value)} placeholder="상호명 검색" />
        <InputGroup label="주소" value={searchAddress} onChange={(e) => setSearchAddress(e.target.value)} placeholder="주소 검색" />
      </SearchFilterBar>

      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-400">
            전체 <span className="text-blue-400">{stores.length}</span> 건 (페이지 {currentPage})
        </span>
        <div className="flex gap-2">
            <Button variant="primary" onClick={handleRegister} icon={<Plus size={16}/>}>신규 등록</Button>
            <Button variant="secondary" onClick={handleExcelRegister} icon={<FileSpreadsheet size={16}/>}>엑셀 일괄 등록</Button>
            <Button variant="success" onClick={() => exportToExcel(stores, '상가관리_목록')} icon={<Download size={16}/>}>엑셀 다운로드</Button>
        </div>
      </div>

      <DataTable columns={columns} data={currentStores} onRowClick={handleEdit} />
      <Pagination totalItems={stores.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
    </>
  );
};
