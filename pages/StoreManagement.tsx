
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
import { Search, Upload, Paperclip, X, Download, Plus } from 'lucide-react';
import { exportToExcel } from '../utils/excel';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;

// 엑셀 미리보기용 확장 인터페이스
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

        // 1. 기존 DB 데이터 조회 (Upsert 판단용)
        const existingStores = await StoreAPI.getList({ marketId: excelMarket.id });
        const dbMap = new Map<string, Store>();
        existingStores.forEach(s => {
            const key = `${s.receiverMac}-${s.repeaterId}-${s.detectorId}`;
            dbMap.set(key, s);
        });

        // 2. 파일 내 중복 체크용 Map
        const fileDuplicateMap = new Map<string, number>();

        const parsedData: ExcelStoreItem[] = [];
        const errors: string[] = [];

        for (let i = 0; i < data.length; i++) {
            const row: any = data[i];
            const rowNum = i + 2; // Header (1) + Index (0-based) = Excel Row Number

            const mac = row['수신기MAC'] ? String(row['수신기MAC']).trim() : '';
            const rptId = row['중계기ID'] ? String(row['중계기ID']).padStart(2, '0') : '';
            const detId = row['감지기번호'] ? String(row['감지기번호']).padStart(2, '0') : '';

            if (!mac || !rptId || !detId) {
                errors.push(`${rowNum}행: 필수 식별 정보(MAC, 중계기, 감지기)가 누락되었습니다.`);
                continue;
            }

            const key = `${mac}-${rptId}-${detId}`;

            // [자체 중복 검증]
            if (fileDuplicateMap.has(key)) {
                const firstOccur = fileDuplicateMap.get(key);
                alert(`${firstOccur}행과 ${rowNum}행의 기기 정보가 중복되었습니다. 파일을 확인해 주세요.`);
                setExcelData([]);
                if (excelFileInputRef.current) excelFileInputRef.current.value = '';
                return;
            }
            fileDuplicateMap.set(key, rowNum);

            // [DB 매칭 - Upsert 판단]
            const matchedStore = dbMap.get(key);

            parsedData.push({
                id: matchedStore ? matchedStore.id : 0, // 매칭되면 기존 ID, 아니면 0(신규)
                marketId: excelMarket!.id,
                marketName: excelMarket!.name,
                receiverMac: mac,
                repeaterId: rptId,
                detectorId: detId,
                mode: row['모드'] || '복합',
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
    if (!excelMarket) { alert('소속 현장을 먼저 선택해주세요.'); return; }
    if (excelData.length === 0) { alert('업로드할 데이터가 없습니다.'); return; }
    
    setLoading(true);
    let insertCount = 0;
    let updateCount = 0;

    try {
        for (const item of excelData) {
            const { _status, ...payload } = item;
            await StoreAPI.save(payload as Store);
            if (_status === '신규') insertCount++;
            else updateCount++;
        }
        
        alert(`처리가 완료되었습니다.\n(신규 등록: ${insertCount}건 / 정보 수정: ${updateCount}건)`);
        setView('list');
        fetchStores();
    } catch(e: any) {
        alert('처리 중 오류 발생: ' + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleSampleDownload = () => {
      const sample = [{
          '수신기MAC': 'A1B2', 
          '중계기ID': '01', 
          '감지기번호': '01', 
          '모드': '복합',
          '기기위치': '가동 101호', 
          '대표자': '홍길동', 
          '연락처': '010-1234-5678', 
          '주소': '서울시...', 
          '상세주소': '101호', 
          '취급품목': '의류', 
          '비고': ''
      }];
      exportToExcel(sample, '기기_일괄등록_양식');
  };

  const handleExcelList = () => {
    const data = stores.map((s, i) => ({
        'No': i + 1,
        '소속 현장': s.marketName,
        '기기위치': s.name,
        '대표자': s.managerName,
        '연락처': s.managerPhone,
        '주소': `${s.address || ''} ${s.addressDetail || ''}`,
        '상태': s.status
    }));
    exportToExcel(data, '기기목록');
  };

  // --- UI Columns ---
  const columns: Column<Store>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { 
        header: '소속 현장', 
        accessor: (s) => <div className="truncate whitespace-nowrap" title={s.marketName}>{s.marketName}</div>,
        width: '140px'
    },
    { 
        header: '기기위치', 
        accessor: (s) => <div className="truncate whitespace-nowrap" title={s.name}>{s.name}</div>,
        width: '160px'
    },
    { 
        header: '대표자', 
        accessor: (s) => <div className="truncate whitespace-nowrap" title={s.managerName}>{s.managerName}</div>,
        width: '100px' 
    },
    { 
        header: '연락처', 
        accessor: (s) => <div className="truncate whitespace-nowrap">{formatPhoneNumber(s.managerPhone || '')}</div>,
        width: '140px' 
    },
    { 
        header: '주소', 
        accessor: (s) => {
            const fullAddr = `${s.address || ''} ${s.addressDetail || ''}`.trim();
            return <div className="truncate whitespace-nowrap" title={fullAddr}>{fullAddr}</div>;
        }
    },
    { header: '상태', accessor: (s) => <StatusBadge status={s.status} />, width: '80px' },
  ];

  // [수정] 엑셀 미리보기 컬럼: 레이아웃 밸런스 조정 및 1줄/2줄 규칙 적용
  const excelColumns: Column<ExcelStoreItem>[] = [
    { 
        header: '구분', 
        accessor: (item) => (
            <div className="whitespace-nowrap px-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    item._status === '신규' 
                    ? 'bg-blue-900/40 text-blue-400 border-blue-800' 
                    : 'bg-orange-900/40 text-orange-400 border-orange-800'
                }`}>
                    {item._status}
                </span>
            </div>
        ),
        width: '70px'
    },
    { header: '수신기MAC', accessor: (item) => <div className="whitespace-nowrap px-1">{item.receiverMac}</div>, width: '100px' },
    { header: '중계기ID', accessor: (item) => <div className="whitespace-nowrap px-1">{item.repeaterId}</div>, width: '90px' },
    { header: '감지기번호', accessor: (item) => <div className="whitespace-nowrap px-1">{item.detectorId}</div>, width: '100px' },
    { header: '기기위치', accessor: (item) => <div className="whitespace-nowrap text-left px-1">{item.name}</div>, width: '160px' },
    { header: '대표자', accessor: (item) => <div className="whitespace-nowrap px-1">{item.managerName}</div>, width: '100px' },
    { header: '연락처', accessor: (item) => <div className="whitespace-nowrap px-1">{item.managerPhone}</div>, width: '140px' },
    { header: '감지모드', accessor: (item) => <div className="whitespace-nowrap px-1">{item.mode}</div>, width: '90px' },
    { 
        header: '주소', 
        accessor: (item) => (
            <div className="text-left whitespace-normal leading-snug py-1 min-w-[200px] max-w-[350px] px-1">
                {`${item.address || ''} ${item.addressDetail || ''}`.trim()}
            </div>
        )
    },
    { header: '취급품목', accessor: (item) => <div className="whitespace-nowrap px-1">{item.handlingItems}</div>, width: '120px' },
    { 
        header: '비고', 
        accessor: (item) => (
            <div className="whitespace-normal text-left px-1 leading-snug py-1 min-w-[100px]">
                {item.memo}
            </div>
        ),
        width: '120px'
    },
  ];

  if (view === 'excel') {
      return (
          <>
             <PageHeader title="기기 관리" />
             <div className="bg-slate-800 p-8 rounded-lg border border-slate-700 shadow-sm w-full mb-6">
                 <div className="flex flex-col gap-8">
                    <FormRow label="소속 현장 선택" required>
                       <div className="flex gap-2 w-full max-w-2xl">
                          <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                             <input type="text" value={excelMarket?.name || ''} placeholder="현장을 선택하세요" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                             <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                          </div>
                          <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
                       </div>
                    </FormRow>

                    <FormRow label="엑셀 파일 선택" required>
                       <div className="flex flex-col gap-2">
                           <div className="flex items-center gap-2">
                               <input type="file" ref={excelFileInputRef} accept=".xlsx, .xls" onChange={handleExcelFileChange} className="hidden" />
                               <Button type="button" variant="secondary" onClick={() => excelFileInputRef.current?.click()} icon={<Upload size={16} />}>파일 선택</Button>
                               <span className="text-sm text-slate-400">
                                   {excelFileInputRef.current?.files?.[0]?.name || '선택된 파일 없음'}
                               </span>
                           </div>
                           <p className="text-xs text-slate-400 mt-1">
                             * 이미 등록된 기기 정보가 있는 경우 자동으로 <b>정보 수정</b>으로 처리됩니다.
                           </p>
                       </div>
                    </FormRow>

                    <FormRow label="양식 다운로드">
                        <Button type="button" variant="secondary" onClick={handleSampleDownload} icon={<Download size={14} />} className="w-fit">엑셀 샘플 양식 다운로드</Button>
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
                     {/* [수정] 항목명(th) 1줄 고정을 위해 Tailwind arbitrary variant ([&_th]:whitespace-nowrap) 적용 */}
                     <div className="[&_th]:whitespace-nowrap">
                        <DataTable columns={excelColumns} data={excelData.slice(0, 50)} />
                     </div>
                     {excelData.length > 50 && <p className="text-center text-slate-500 text-sm mt-3 italic">... 상위 50건만 표시됩니다.</p>}
                 </div>
             )}

             <div className="flex justify-center gap-3 mt-8 pb-10">
                <Button type="button" variant="primary" onClick={handleExcelSave} disabled={excelData.length === 0 || loading} className="w-32">
                    {loading ? '처리 중...' : '일괄 등록/수정'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
             </div>
             <MarketSearchModal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} onSelect={handleMarketSelect} />
          </>
      );
  }

  if (view === 'form') {
      return (
          <>
            <PageHeader title="기기 관리" />
            <form onSubmit={handleSave}>
               <FormSection title="기본 정보">
                  <FormRow label="소속 현장" required>
                    <div className="flex gap-2 w-full">
                       <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                          <input type="text" value={formData.marketName || ''} placeholder="현장을 선택하세요" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                          <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                       </div>
                       <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
                    </div>
                  </FormRow>
                  <FormRow label="기기위치" required>
                     <InputGroup value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </FormRow>
                  <FormRow label="대표자">
                     <InputGroup value={formData.managerName || ''} onChange={(e) => setFormData({...formData, managerName: e.target.value})} />
                  </FormRow>
                  <FormRow label="연락처">
                     <InputGroup value={formData.managerPhone || ''} onChange={(e) => setFormData({...formData, managerPhone: e.target.value})} onKeyDown={handlePhoneKeyDown} maxLength={13} />
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
                  <FormRow label="취급품목">
                     <InputGroup value={formData.handlingItems || ''} onChange={(e) => setFormData({...formData, handlingItems: e.target.value})} />
                  </FormRow>
                  <FormRow label="이미지" className="col-span-1 md:col-span-2">
                     <div className="flex flex-col gap-2">
                        <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && setImageFile(e.target.files[0])} className="hidden" accept="image/*" />
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<Upload size={16}/>}>파일 선택</Button>
                            {(formData.storeImage || imageFile) && (
                                <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded border border-slate-600">
                                    <Paperclip size={14} className="text-slate-400" />
                                    <span className="text-sm text-blue-400 cursor-pointer hover:underline" onClick={() => window.open(formData.storeImage || (imageFile ? URL.createObjectURL(imageFile) : ''), '_blank')}>이미지 보기</span>
                                    <button type="button" onClick={() => { setFormData({...formData, storeImage: ''}); setImageFile(null); }} className="text-red-400 hover:text-red-300 ml-2"><X size={16}/></button>
                                </div>
                            )}
                        </div>
                     </div>
                  </FormRow>
               </FormSection>

               <FormSection title="기기 연동 정보">
                  <FormRow label="수신기 MAC">
                    <div className="flex gap-2 w-full">
                       <div onClick={() => setIsReceiverModalOpen(true)} className="flex-1 relative cursor-pointer">
                          <input type="text" value={formData.receiverMac || ''} placeholder="수신기를 선택하세요" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                          <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                       </div>
                       <Button type="button" variant="secondary" onClick={() => setIsReceiverModalOpen(true)}>찾기</Button>
                    </div>
                  </FormRow>
                  <FormRow label="중계기 ID (2자리)">
                     <InputGroup value={formData.repeaterId || ''} onChange={(e) => setFormData({...formData, repeaterId: e.target.value})} maxLength={2} placeholder="예: 01" />
                  </FormRow>
                  <FormRow label="감지기 번호 (2자리)">
                     <div className="flex flex-col gap-1">
                         <InputGroup value={formData.detectorId || ''} onChange={(e) => setFormData({...formData, detectorId: e.target.value})} maxLength={2} placeholder="예: 01" />
                         <span className="text-xs text-blue-400">: 수신기, 중계기, 감지기를 새로 등록수정 시, 현장 기기관리에도 데이터가 연동됩니다.</span>
                     </div>
                  </FormRow>
                  <FormRow label="감지 모드">
                     <StatusRadioGroup label="" value={formData.mode || '복합'} onChange={(val) => setFormData({...formData, mode: val as any})} options={['복합', '열', '연기']} />
                  </FormRow>
                  <FormRow label="비고" className="col-span-1 md:col-span-2">
                     <InputGroup value={formData.memo || ''} onChange={(e) => setFormData({...formData, memo: e.target.value})} />
                  </FormRow>
                  <FormRow label="사용 여부">
                     <StatusRadioGroup label="" value={formData.status} onChange={(val) => setFormData({...formData, status: val as any})} />
                  </FormRow>
               </FormSection>

               <div className="flex justify-center gap-3 mt-8">
                  <Button type="submit" variant="primary" className="w-32">{selectedStore ? '수정' : '신규등록'}</Button>
                  {selectedStore && <Button type="button" variant="danger" onClick={handleDelete} className="w-32">삭제</Button>}
                  <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
               </div>
            </form>
            <MarketSearchModal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} onSelect={handleMarketSelect} />
            <ReceiverSearchModal isOpen={isReceiverModalOpen} onClose={() => setIsReceiverModalOpen(false)} onSelect={handleReceiverSelect} />
          </>
      );
  }

  return (
    <>
      <PageHeader title="기기 관리" />
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
         <InputGroup label="소속 현장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
         <InputGroup label="기기위치" value={searchStore} onChange={(e) => setSearchStore(e.target.value)} />
         <InputGroup label="주소" value={searchAddress} onChange={(e) => setSearchAddress(e.target.value)} />
      </SearchFilterBar>

      <div className="flex justify-between items-center mb-2">
         <span className="text-sm text-slate-400">전체 <span className="text-blue-400">{stores.length}</span> 건 (페이지 {currentPage})</span>
         <div className="flex gap-2">
            {/* [수정] 버튼명을 '신규 등록'으로 변경하고 플러스 아이콘 추가 */}
            <Button variant="primary" onClick={handleRegister} icon={<Plus size={16} />}>신규 등록</Button>
            <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16} />}>엑셀 등록수정</Button>
            <Button variant="success" onClick={handleExcelList} icon={<Download size={16} />}>엑셀 다운로드</Button>
         </div>
      </div>

      {loading ? (
         <div className="text-center py-20 text-slate-500">Loading...</div>
      ) : (
         <DataTable columns={columns} data={stores.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)} onRowClick={handleEdit} />
      )}
      <Pagination totalItems={stores.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
    </>
  );
};
