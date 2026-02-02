import React, { useState, useEffect } from 'react';
import { DetectorAPI, StoreAPI } from '../services/api';
import { Detector, Market, Receiver, Store } from '../types';
import { PageHeader, SearchFilterBar, InputGroup, SelectGroup, Button, DataTable, Pagination, FormSection, FormRow, StatusRadioGroup, StatusBadge, MarketSearchModal, ReceiverSearchModal, UI_STYLES, Modal } from '../components/CommonUI';
import { Search, X, Upload } from 'lucide-react';
import { exportToExcel } from '../utils/excel';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;
const ID_OPTIONS = Array.from({ length: 20 }, (_, i) => { const val = String(i + 1).padStart(2, '0'); return { value: val, label: val }; });

export const DetectorManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [detectors, setDetectors] = useState<Detector[]>([]);
  const [selectedDetector, setSelectedDetector] = useState<Detector | null>(null);
  const [formData, setFormData] = useState<Partial<Detector>>({});
  const [isReceiverModalOpen, setIsReceiverModalOpen] = useState(false);
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [selectedStores, setSelectedStores] = useState<{id: number, name: string}[]>([]);
  const [excelData, setExcelData] = useState<Detector[]>([]);
  const [excelMarket, setExcelMarket] = useState<Market | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchMarket, setSearchMarket] = useState('');

  const fetchDetectors = async (overrides?: any) => { const data = await DetectorAPI.getList(overrides); setDetectors(data); };
  useEffect(() => { fetchDetectors(); }, []);

  const handleRegister = () => { setSelectedDetector(null); setFormData({ repeaterId: '01', detectorId: '01', mode: '복합', status: '사용' }); setSelectedStores([]); setView('form'); };
  const handleEdit = (detector: Detector) => { setSelectedDetector(detector); setFormData({ ...detector }); setSelectedStores(detector.stores || []); setView('form'); };

  const handleReceiverSelect = (r: Receiver) => {
    setFormData({ 
      ...formData, 
      marketId: r.marketId, // market_id -> marketId
      marketName: r.marketName,
      receiverMac: r.macAddress,
    });
    setSelectedStores([]);
    setIsReceiverModalOpen(false);
  };

  const handleStoreSelect = (s: Store) => {
    if (selectedStores.some(store => store.id === s.id)) { alert('이미 추가된 상가입니다.'); return; }
    setSelectedStores([...selectedStores, { id: s.id, name: s.name }]);
    setIsStoreModalOpen(false);
  };

  const fetchStores = async () => {
    if (!formData.marketId) { setStoreList([]); return; } // market_id -> marketId
    const data = await StoreAPI.getList({ marketId: formData.marketId }); // market_id -> marketId
    setStoreList(data);
  };

  const openStoreModal = () => {
    if (!formData.marketId) { alert('먼저 R형 수신기를 선택해주세요.'); return; } // market_id -> marketId
    fetchStores();
    setIsStoreModalOpen(true);
  };

  const handleMarketSelect = (m: Market) => {
    setExcelMarket(m);
    setIsMarketModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.marketId || !formData.receiverMac) { alert('R형 수신기를 선택해주세요.'); return; } // market_id -> marketId
    
    try {
      const newDetector: Detector = {
        ...formData as Detector,
        id: selectedDetector?.id || 0,
        stores: selectedStores 
      };
      await DetectorAPI.save(newDetector);
      alert('저장되었습니다.');
      setView('list');
      fetchDetectors();
    } catch (e: any) { alert(`저장 실패: ${e.message}`); }
  };

  const handleExcelRegister = () => {
    setExcelData([]);
    setExcelMarket(null);
    setView('excel');
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!excelMarket) {
        alert('먼저 설치 시장을 선택해주세요.');
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

        const parsedData: Detector[] = data.map((row: any) => ({
          id: 0,
          marketId: excelMarket!.id, // market_id -> marketId
          marketName: excelMarket!.name,
          receiverMac: row['수신기MAC'] ? String(row['수신기MAC']) : '',
          repeaterId: row['중계기ID'] ? String(row['중계기ID']) : '',
          detectorId: row['감지기ID'] ? String(row['감지기ID']) : '',
          mode: row['모드'] || '복합',
          status: '사용',
        }));
        setExcelData(parsedData);
      } catch (e) {
        console.error(e);
        alert("엑셀 파일 처리 중 오류가 발생했습니다.");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <>
      <PageHeader title="화재감지기 현황" />
      {view === 'form' ? (
          <form onSubmit={handleSave}>
             <FormSection title={selectedDetector ? "화재감지기 수정" : "화재감지기 등록"}>
                <FormRow label="R형 수신기 MAC" required className="col-span-1 md:col-span-2">
                  <div className="flex gap-2 w-full max-w-md">
                    <div onClick={() => setIsReceiverModalOpen(true)} className="flex-1 relative cursor-pointer">
                      <input 
                        type="text"
                        value={formData.receiverMac || ''} 
                        placeholder="수신기를 선택하세요" 
                        readOnly 
                        className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
                      />
                      <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                    </div>
                    <Button type="button" variant="secondary" onClick={() => setIsReceiverModalOpen(true)}>검색</Button>
                  </div>
                  {formData.marketName && <p className="text-xs text-blue-400 mt-1">소속 시장: {formData.marketName}</p>}
                </FormRow>
                
                <FormRow label="중계기 ID">
                   <SelectGroup options={ID_OPTIONS} value={formData.repeaterId || '01'} onChange={(e) => setFormData({...formData, repeaterId: e.target.value})} />
                </FormRow>
                
                <FormRow label="감지기 ID">
                   <SelectGroup options={ID_OPTIONS} value={formData.detectorId || '01'} onChange={(e) => setFormData({...formData, detectorId: e.target.value})} />
                </FormRow>

                <FormRow label="감지 모드">
                   <SelectGroup options={[{value:'복합', label:'복합'}, {value:'열', label:'열'}, {value:'연기', label:'연기'}]} value={formData.mode || '복합'} onChange={(e) => setFormData({...formData, mode: e.target.value as any})} />
                </FormRow>

                <FormRow label="CCTV URL" className="col-span-1 md:col-span-2">
                   <InputGroup value={formData.cctvUrl || ''} onChange={(e) => setFormData({...formData, cctvUrl: e.target.value})} />
                </FormRow>

                <FormRow label="사용여부">
                   <StatusRadioGroup label="" value={formData.status} onChange={(val) => setFormData({...formData, status: val as any})} />
                </FormRow>

                <FormRow label="설치 상가(점포 추가)" className="col-span-1">
                  <div className="flex flex-col gap-2 w-full">
                     <div className="flex justify-end">
                        <Button type="button" variant="secondary" onClick={openStoreModal} icon={<Search size={14} />} className="text-xs h-7 px-2">상가 검색</Button>
                     </div>
                     <div className="bg-slate-900 border border-slate-600 rounded p-2 h-32 overflow-y-auto custom-scrollbar">
                        {selectedStores.map((store) => (
                          <div key={store.id} className="flex justify-between items-center py-1 px-2 border-b border-slate-700/50 last:border-0">
                            <span className="text-slate-200 text-sm">{store.name}</span>
                            <button type="button" onClick={() => setSelectedStores(selectedStores.filter(s => s.id !== store.id))} className="text-red-400 hover:text-red-300 p-1"><X size={14} /></button>
                          </div>
                        ))}
                     </div>
                  </div>
                </FormRow>
             </FormSection>
             <div className="flex justify-center gap-3 mt-8">
                <Button type="submit" variant="primary" className="w-32">{selectedDetector ? '수정' : '신규등록'}</Button>
                <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">목록</Button>
             </div>
          </form>
      ) : view === 'excel' ? (
          <div>
             <PageHeader title="엑셀 일괄 등록" />
             <FormSection title="엑셀 파일 업로드">
                <FormRow label="설치 시장 선택" required>
                   <div className="flex gap-2 w-full">
                      <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                         <input type="text" value={excelMarket?.name || ''} placeholder="시장을 선택하세요" readOnly className={`${UI_STYLES.input} cursor-pointer`} />
                      </div>
                      <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
                   </div>
                </FormRow>
                <FormRow label="엑셀 파일" required>
                   <InputGroup type="file" accept=".xlsx, .xls" onChange={handleExcelFileChange} className="border-0 p-0 text-slate-300" />
                </FormRow>
             </FormSection>
             {excelData.length > 0 && <DataTable columns={[{header:'수신기MAC', accessor:'receiverMac'}, {header:'중계기ID', accessor:'repeaterId'}, {header:'감지기ID', accessor:'detectorId'}]} data={excelData.slice(0, 10)} />}
             <div className="flex justify-center gap-3 mt-8">
                <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
             </div>
          </div>
      ) : (
          // List View
          <>
             <SearchFilterBar onSearch={() => fetchDetectors({marketName: searchMarket})} onReset={() => {setSearchMarket(''); fetchDetectors({});}}>
                <InputGroup label="설치시장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
             </SearchFilterBar>
             <div className="flex justify-between items-center mb-2">
               <span className="text-sm text-slate-400">전체 <span className="text-blue-400">{detectors.length}</span> 건</span>
               <div className="flex gap-2">
                  <Button variant="primary" onClick={handleRegister}>신규 등록</Button>
                  <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16} />}>엑셀 신규 등록</Button>
               </div>
             </div>
             <DataTable 
                columns={[
                    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
                    { header: '수신기 MAC', accessor: 'receiverMac', width: '120px' },
                    { header: '중계기 ID', accessor: 'repeaterId', width: '100px' },
                    { header: '감지기 ID', accessor: 'detectorId', width: '100px' },
                    { header: '설치시장', accessor: 'marketName' },
                    { header: '설치상가', accessor: (item) => item.stores?.[0]?.name || '-' },
                    { header: '사용여부', accessor: (item) => <StatusBadge status={item.status} />, width: '100px' },
                ]}
                data={detectors.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
                onRowClick={handleEdit}
             />
             <Pagination totalItems={detectors.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
          </>
      )}
      <ReceiverSearchModal isOpen={isReceiverModalOpen} onClose={() => setIsReceiverModalOpen(false)} onSelect={handleReceiverSelect} />
      <Modal isOpen={isStoreModalOpen} onClose={() => setIsStoreModalOpen(false)} title="상가 리스트" width="max-w-4xl">
           <div className="p-4">
               {storeList.map(s => (
                   <div key={s.id} className="flex justify-between p-2 border-b border-slate-700">
                       <span>{s.name}</span>
                       <Button onClick={() => handleStoreSelect(s)} className="h-6 text-xs px-2">선택</Button>
                   </div>
               ))}
           </div>
      </Modal>
      <MarketSearchModal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} onSelect={handleMarketSelect} />
    </>
  );
};