
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
import { Search, Upload, Paperclip, X, Download } from 'lucide-react';
import { exportToExcel } from '../utils/excel';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;

// 엑셀 파싱용 확장 인터페이스
interface ExcelStoreItem extends Store {
    _status: '신규' | '수정';
}

export const StoreManagement: React.FC = () => {
  const location = useLocation();
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState<Partial<Store>>({});
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Search Filters
  const [searchMarket, setSearchMarket] = useState('');
  const [searchStore, setSearchStore] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

  // Modals
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [isReceiverModalOpen, setIsReceiverModalOpen] = useState(false);
  
  // File Upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel
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

  // Handlers
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

  // --- Excel Logic ---
  const handleExcelRegister = () => {
    setExcelData([]);
    setExcelMarket(null);
    setView('excel');
  };

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

        // 1. 기존 DB 데이터 조회 (중복 매칭 및 Upsert 판단용)
        const existingStores = await StoreAPI.getList({ marketId: excelMarket.id });
        
        // 매칭용 Map 생성 (Key: 수신기MAC+중계기ID+감지기ID)
        const dbMap = new Map<string, Store>();
        existingStores.forEach(s => {
            const key = `${s.receiverMac}-${s.repeaterId}-${s.detectorId}`;
            dbMap.set(key, s);
        });

        // 2. 파일 내 자체 중복 체크를 위한 Map
        const fileDuplicateMap = new Map<string, number>(); // key -> row index
        
        const parsedData: ExcelStoreItem[] = [];
        const errors: string[] = [];

        // 3. 데이터 파싱 및 검증
        for (let i = 0; i < data.length; i++) {
            const row: any = data[i];
            const rowNum = i + 2; // Header 제외 실무 행 번호

            const mac = row['수신기MAC'] ? String(row['수신기MAC']).trim() : '';
            const rptId = row['중계기ID'] ? String(row['중계기ID']).padStart(2, '0') : '';
            const detId = row['감지기번호'] ? String(row['감지기번호']).padStart(2, '0') : '';

            if (!mac || !rptId || !detId) {
                errors.push(`${rowNum}행: 필수 식별 정보(MAC, 중계기, 감지기)가 누락되었습니다.`);
                continue;
            }

            const key = `${mac}-${rptId}-${detId}`;

            // 파일 내 중복 검사
            if (fileDuplicateMap.has(key)) {
                const firstRow = fileDuplicateMap.get(key);
                alert(`${firstRow}행과 ${rowNum}행의 기기 정보가 중복되었습니다. 파일을 확인해 주세요.`);
                setExcelData([]);
                if (excelFileInputRef.current) excelFileInputRef.current.value = '';
                return;
            }
            fileDuplicateMap.set(key, rowNum);

            // DB 매칭 확인 (Upsert 판단)
            const matched = dbMap.get(key);
            
            parsedData.push({
                id: matched ? matched.id : 0, // 매칭되면 기존 ID, 아니면 0(신규)
                marketId: excelMarket!.id,
                marketName: excelMarket!.name,
                name: row['기기위치'] || '',
                managerName: row['대표자명'] || '',
                managerPhone: row['연락처'] || '',
                address: row['주소'] || excelMarket!.address,
                addressDetail: row['상세주소'] || '',
                handlingItems: row['취급품목'] || '',
                receiverMac: mac,
                repeaterId: rptId,
                detectorId: detId,
                mode: row['감지모드'] || '복합',
                status: '사용',
                _status: matched ? '수정' : '신규' // 표시용 상태
            });
        }

        if (errors.length > 0) {
            alert("엑셀 파일에 오류가 있습니다:\n" + errors.slice(0, 5).join('\n'));
            setExcelData([]);
            if (excelFileInputRef.current) excelFileInputRef.current.value = '';
            return;
        }

        setExcelData(parsedData);

      } catch (err) {
          console.error(err);
          alert('파일 처리 중 오류가 발생했습니다.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelSave = async () => {
    if (excelData.length === 0) return;
    
    setLoading(true);
    let newCount = 0;
    let updateCount = 0;

    try {
      for (const item of excelData) {
          // _status는 DB 컬럼이 아니므로 제외하고 저장
          const { _status, ...payload } = item;
          await StoreAPI.save(payload as Store);
          if (_status === '신규') newCount++;
          else updateCount++;
      }
      
      alert(`처리가 완료되었습니다.\n(신규 등록: ${newCount}건 / 정보 수정: ${updateCount}건)`);
      setView('list');
      fetchStores();
    } catch (e: any) {
      alert('저장 중 오류 발생: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSampleDownload = () => {
    const sample = [
      {
        '기기위치': '가동 101호',
        '대표자명': '홍길동',
        '연락처': '010-1111-2222',
        '주소': '서울시 중구 ...',
        '상세주소': '101호',
        '수신기MAC': 'A1B2',
        '중계기ID': '01',
        '감지기번호': '01',
        '감지모드': '복합',
        '취급품목': '의류'
      }
    ];
    exportToExcel(sample, '기기관리_일괄등록_양식');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setImageFile(e.target.files[0]);
  };

  const excelColumns: Column<ExcelStoreItem>[] = [
    { 
        header: '구분', 
        accessor: (item) => (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                item._status === '신규' 
                ? 'bg-blue-900/40 text-blue-400 border-blue-800' 
                : 'bg-orange-900/40 text-orange-400 border-orange-800'
            }`}>
                {item._status}
            </span>
        ),
        width: '60px'
    },
    { header: '기기위치', accessor: 'name' },
    { header: '대표자', accessor: 'managerName', width: '100px' },
    { header: '연락처', accessor: 'managerPhone', width: '130px' },
    { header: '수신기MAC', accessor: 'receiverMac', width: '100px' },
    { header: '중계기ID', accessor: 'repeaterId', width: '80px' },
    { header: '감지기ID', accessor: 'detectorId', width: '80px' },
  ];

  if (view === 'excel') {
    return (
      <>
        <PageHeader title="기기 엑셀 일괄 관리" />
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm mb-6">
           <h3 className="text-lg font-bold text-slate-200 mb-5 border-b border-slate-700 pb-2 flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-500 rounded-sm"></span>
              엑셀 업로드 (신규 등록 및 기존 정보 수정)
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormRow label="설치 현장 선택" required>
                 <div className="flex gap-2 w-full">
                    <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                       <input type="text" value={excelMarket?.name || ''} placeholder="현장을 선택하세요" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                       <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                    </div>
                    <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
                 </div>
              </FormRow>
              <FormRow label="엑셀 파일 선택" required>
                 <div className="flex flex-col gap-2">
                    <input type="file" ref={excelFileInputRef} accept=".xlsx, .xls" onChange={handleExcelFileChange} className={`${UI_STYLES.input} border-dashed`} />
                    <p className="text-[11px] text-slate-400 leading-tight">
                        * 수신기MAC, 중계기ID, 감지기번호 조합이 같은 데이터는 기존 정보를 <b>수정</b>하고, <br/>
                        없는 정보는 <b>신규 등록</b>합니다.
                    </p>
                 </div>
              </FormRow>
              <FormRow label="양식 다운로드">
                  <Button type="button" variant="secondary" onClick={handleSampleDownload} icon={<Download size={14} />}>
                     샘플 양식 다운로드
                  </Button>
              </FormRow>
           </div>
        </div>

        {excelData.length > 0 && (
            <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-end mb-2">
                    <h4 className="text-lg font-bold text-slate-200">업로드 데이터 미리보기 ({excelData.length}건)</h4>
                    <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 신규 등록</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500"></span> 정보 수정</span>
                    </div>
                </div>
                <DataTable columns={excelColumns} data={excelData.slice(0, 50)} />
                {excelData.length > 50 && <p className="text-center text-slate-500 text-sm mt-3 italic">... 상위 50건만 표시됩니다.</p>}
            </div>
        )}

        <div className="flex justify-center gap-3 mt-8 pb-10">
            <Button type="button" variant="primary" onClick={handleExcelSave} className="w-40 h-11 text-base shadow-lg" disabled={excelData.length === 0 || loading}>
                {loading ? '처리 중...' : '일괄 등록/수정 실행'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32 h-11 text-base">취소</Button>
        </div>
      </>
    );
  }

  // View: Form
  if (view === 'form') {
    return (
      <>
        <PageHeader title="기기 관리" />
        <form onSubmit={handleSave}>
          <FormSection title={selectedStore ? "상가(기기) 수정" : "상가(기기) 등록"}>
            <FormRow label="소속 현장" required className="col-span-1">
              <div className="flex gap-2 w-full">
                <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                  <input type="text" value={formData.marketName || ''} placeholder="현장 선택" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                  <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                </div>
                <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
              </div>
            </FormRow>

            <FormRow label="기기위치(상호)" required>
              <InputGroup value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="예: 가동 101호 또는 상호명" required />
            </FormRow>

            <FormRow label="대표자명">
              <InputGroup value={formData.managerName || ''} onChange={(e) => setFormData({...formData, managerName: e.target.value})} />
            </FormRow>

            <FormRow label="연락처">
              <InputGroup value={formData.managerPhone || ''} onChange={(e) => setFormData({...formData, managerPhone: e.target.value})} onKeyDown={handlePhoneKeyDown} placeholder="010-0000-0000" maxLength={13} />
            </FormRow>

            <div className="col-span-1 md:col-span-2">
                <AddressInput 
                   label="주소"
                   address={formData.address || ''}
                   addressDetail={formData.addressDetail || ''}
                   onAddressChange={(val) => setFormData({...formData, address: val})}
                   onDetailChange={(val) => setFormData({...formData, addressDetail: val})}
                   onCoordinateChange={(lat, lng) => setFormData({...formData, latitude: lat, longitude: lng})}
                />
            </div>

            <FormRow label="취급품목">
              <InputGroup value={formData.handlingItems || ''} onChange={(e) => setFormData({...formData, handlingItems: e.target.value})} />
            </FormRow>

            <FormRow label="사용 여부">
               <StatusRadioGroup value={formData.status} onChange={(val) => setFormData({...formData, status: val as any})} />
            </FormRow>
          </FormSection>

          <FormSection title="연동 기기 정보">
            <FormRow label="수신기 MAC" required>
               <div className="flex gap-2 w-full">
                  <div onClick={() => setIsReceiverModalOpen(true)} className="flex-1 relative cursor-pointer">
                    <input type="text" value={formData.receiverMac || ''} placeholder="수신기 선택" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                    <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setIsReceiverModalOpen(true)}>찾기</Button>
               </div>
            </FormRow>
            <FormRow label="중계기 ID">
              <InputGroup value={formData.repeaterId || ''} onChange={(e) => setFormData({...formData, repeaterId: e.target.value})} placeholder="01 ~ 20" maxLength={2} />
            </FormRow>
            <FormRow label="감지기 ID">
              <InputGroup value={formData.detectorId || ''} onChange={(e) => setFormData({...formData, detectorId: e.target.value})} placeholder="01 ~ 20" maxLength={2} />
            </FormRow>
            <FormRow label="감지기 모드">
              <div className={`${UI_STYLES.input} flex gap-4 items-center`}>
                {['복합', '열', '연기'].map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="radio" name="mode" value={m} checked={formData.mode === m} onChange={() => setFormData({...formData, mode: m as any})} className="accent-blue-500 w-4 h-4" />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
            </FormRow>
            <FormRow label="설치 이미지" className="col-span-1 md:col-span-2">
               <div className="flex flex-col gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<Upload size={16}/>}>파일 선택</Button>
                    {(formData.storeImage || imageFile) && (
                      <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded border border-slate-600">
                        <Paperclip size={14} className="text-slate-400" />
                        <span className="text-sm text-blue-400 cursor-pointer hover:underline" onClick={() => window.open(formData.storeImage || URL.createObjectURL(imageFile!), '_blank')}>이미지 보기</span>
                        <button type="button" onClick={() => { setFormData({...formData, storeImage: undefined}); setImageFile(null); }} className="text-red-400 hover:text-red-300 ml-2"><X size={16}/></button>
                      </div>
                    )}
                  </div>
               </div>
            </FormRow>
          </FormSection>

          <div className="flex justify-center gap-3 mt-8 pb-10">
             <Button type="submit" variant="primary" className="w-32">{selectedStore ? '수정' : '신규등록'}</Button>
             {selectedStore && <Button type="button" variant="danger" onClick={handleDelete} className="w-32">삭제</Button>}
             <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
          </div>
        </form>
      </>
    );
  }

  // View: List
  const columns: Column<Store>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '설치현장', accessor: 'marketName' },
    { header: '기기위치(상호)', accessor: 'name' },
    { header: '주소', accessor: (s) => `${s.address || ''} ${s.addressDetail || ''}`.trim() },
    { header: '대표자', accessor: 'managerName', width: '100px' },
    { header: '연락처', accessor: (s) => formatPhoneNumber(s.managerPhone || ''), width: '150px' },
    { header: '상태', accessor: (s) => <StatusBadge status={s.status} />, width: '100px' },
  ];

  const currentStores = stores.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <PageHeader title="기기 관리" />
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <InputGroup label="설치현장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
        <InputGroup label="기기위치(상호)" value={searchStore} onChange={(e) => setSearchStore(e.target.value)} />
        <InputGroup label="주소" value={searchAddress} onChange={(e) => setSearchAddress(e.target.value)} />
      </SearchFilterBar>

      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-400">전체 <span className="text-blue-400">{stores.length}</span> 건</span>
        <div className="flex gap-2">
           <Button variant="primary" onClick={handleRegister}>개별 등록</Button>
           <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16}/>}>엑셀 일괄 관리</Button>
        </div>
      </div>

      <DataTable columns={columns} data={currentStores} onRowClick={handleEdit} />
      <Pagination totalItems={stores.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />

      <MarketSearchModal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} onSelect={handleMarketSelect} />
      <ReceiverSearchModal isOpen={isReceiverModalOpen} onClose={() => setIsReceiverModalOpen(false)} onSelect={handleReceiverSelect} />
    </>
  );
};
