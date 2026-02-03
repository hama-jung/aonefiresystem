
import React, { useState, useEffect, useRef } from 'react';
import { DetectorAPI, StoreAPI } from '../services/api';
import { Detector, Market, Receiver, Store } from '../types';
import { PageHeader, SearchFilterBar, InputGroup, SelectGroup, Button, DataTable, Pagination, FormSection, FormRow, StatusRadioGroup, StatusBadge, MarketSearchModal, ReceiverSearchModal, UI_STYLES, Modal } from '../components/CommonUI';
import { Search, X, Upload, Download } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    // [New Logic] 중복 검사
    try {
        const existingList = await DetectorAPI.getList({ 
            marketId: formData.marketId, 
            receiverMac: formData.receiverMac,
            repeaterId: formData.repeaterId
        });
        const isDuplicate = existingList.some(d => 
            d.id !== (selectedDetector?.id || 0) &&
            d.detectorId === formData.detectorId
        );

        if (isDuplicate) {
            alert(`이미 등록된 감지기 ID입니다.\n(MAC: ${formData.receiverMac}, 중계기: ${formData.repeaterId}, 감지기: ${formData.detectorId})`);
            return;
        }
    } catch (e) {
        console.error("중복 체크 실패", e);
    }

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
        alert('먼저 소속 현장을 선택해주세요.');
        e.target.value = '';
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

        // 1. 기존 데이터 조회
        const existingDetectors = await DetectorAPI.getList({ marketId: excelMarket.id });
        const existingKeySet = new Set(existingDetectors.map(d => `${d.receiverMac}-${d.repeaterId}-${d.detectorId}`));

        const parsedData: Detector[] = [];
        const currentExcelKeySet = new Set<string>();
        const errors: string[] = [];

        // 2. 파싱 및 검증
        for (let i = 0; i < data.length; i++) {
            const row: any = data[i];
            const rowNum = i + 2;
            const mac = row['수신기MAC'] ? String(row['수신기MAC']).trim() : '';
            const rptId = row['중계기ID'] ? String(row['중계기ID']).padStart(2, '0') : '';
            const detId = row['감지기ID'] ? String(row['감지기ID']).padStart(2, '0') : '';

            if (!mac || !rptId || !detId) {
                errors.push(`${rowNum}행: 필수 정보(MAC, 중계기ID, 감지기ID)가 누락되었습니다.`);
                continue;
            }

            if (parseInt(rptId) > 20) errors.push(`${rowNum}행: 중계기 ID(${rptId}) 20초과 불가.`);
            if (parseInt(detId) > 20) errors.push(`${rowNum}행: 감지기 ID(${detId}) 20초과 불가.`);

            const key = `${mac}-${rptId}-${detId}`;

            if (currentExcelKeySet.has(key)) {
                errors.push(`${rowNum}행: 엑셀 내 중복 데이터(${key})`);
            }
            currentExcelKeySet.add(key);

            if (existingKeySet.has(key)) {
                errors.push(`${rowNum}행: 이미 등록된 기기입니다 (${key})`);
            }

            parsedData.push({
                id: 0,
                marketId: excelMarket!.id,
                marketName: excelMarket!.name,
                receiverMac: mac,
                repeaterId: rptId,
                detectorId: detId,
                mode: row['모드'] || '복합',
                status: '사용',
            });
        }

        if (errors.length > 0) {
            alert(`다음 오류가 발견되어 업로드를 중단합니다:\n(총 ${errors.length}건)\n\n` + errors.slice(0, 10).join('\n') + (errors.length > 10 ? `\n...외 ${errors.length - 10}건` : ''));
            setExcelData([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setExcelData(parsedData);
      } catch (e) {
        console.error(e);
        alert("엑셀 파일 처리 중 오류가 발생했습니다.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelSave = async () => {
      if (excelData.length === 0) return;
      try {
          for (const item of excelData) {
              await DetectorAPI.save(item);
          }
          alert('일괄 등록되었습니다.');
          setView('list');
          fetchDetectors();
      } catch(e: any) {
          alert('일괄 등록 중 오류 발생: ' + e.message);
      }
  };

  const handleSampleDownload = () => {
      const sample = [
          {'수신기MAC': '1A2B', '중계기ID': '01', '감지기ID': '01', '모드': '복합'}
      ];
      exportToExcel(sample, '화재감지기_일괄등록_샘플');
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
                  {formData.marketName && <p className="text-xs text-blue-400 mt-1">소속 현장: {formData.marketName}</p>}
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
             <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm w-full mb-6">
                 <h3 className="text-lg font-bold text-slate-200 mb-5 border-b border-slate-700 pb-2 flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-500 rounded-sm"></span>
                    엑셀 파일 업로드
                 </h3>
                 <div className="grid grid-cols-1 gap-6">
                    <FormRow label="소속 현장 선택" required>
                       <div className="flex gap-2 w-full">
                          <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                             <input type="text" value={excelMarket?.name || ''} placeholder="등록할 현장을 선택하세요" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                             <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                          </div>
                          <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
                       </div>
                    </FormRow>
                    <FormRow label="엑셀 파일" required>
                       <div className="flex flex-col gap-2">
                           <InputGroup type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleExcelFileChange} className="border-0 p-0 text-slate-300" />
                           <p className="text-xs text-slate-400">* 수신기MAC, 중계기ID, 감지기ID, 모드 컬럼을 포함해야 합니다.</p>
                       </div>
                    </FormRow>
                    <FormRow label="샘플 양식">
                        <Button type="button" variant="secondary" onClick={handleSampleDownload} icon={<Download size={14} />} className="w-fit">
                           엑셀 샘플 다운로드
                        </Button>
                    </FormRow>
                 </div>
             </div>

             {/* Preview */}
             {excelData.length > 0 && (
                 <div className="mb-6">
                     <h4 className="text-lg font-bold text-slate-200 mb-2">등록 미리보기 ({excelData.length}건)</h4>
                     <DataTable 
                        columns={[
                            {header:'수신기MAC', accessor:'receiverMac'}, 
                            {header:'중계기ID', accessor:'repeaterId'}, 
                            {header:'감지기ID', accessor:'detectorId'},
                            {header:'모드', accessor:'mode'}
                        ]} 
                        data={excelData.slice(0, 10)} 
                     />
                     {excelData.length > 10 && <p className="text-center text-slate-500 text-sm mt-2">...외 {excelData.length - 10}건</p>}
                 </div>
             )}

             <div className="flex justify-center gap-3 mt-8">
                <Button type="button" variant="primary" onClick={handleExcelSave} className="w-32" disabled={excelData.length === 0}>일괄 등록</Button>
                <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
             </div>
          </div>
      ) : (
          // List View
          <>
             <SearchFilterBar onSearch={() => fetchDetectors({marketName: searchMarket})} onReset={() => {setSearchMarket(''); fetchDetectors({});}}>
                <InputGroup label="소속 현장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
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
                    { header: '소속 현장', accessor: 'marketName' },
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
