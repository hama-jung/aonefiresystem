
import React, { useState, useEffect, useRef } from 'react';
import { ReceiverAPI } from '../services/api';
import { Receiver, Market } from '../types';
import { PageHeader, SearchFilterBar, InputGroup, SelectGroup, Button, DataTable, Pagination, FormSection, FormRow, StatusRadioGroup, StatusBadge, MarketSearchModal, UI_STYLES, handlePhoneKeyDown, formatPhoneNumber, Column } from '../components/CommonUI';
import { Search, Upload, Paperclip, X, Download, FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '../utils/excel';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;
const INTERVAL_OPTIONS = Array.from({ length: 23 }, (_, i) => { const val = String(i + 1).padStart(2, '0'); return { value: `${val}시간`, label: `${val}시간` }; });

export const ReceiverManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState<Receiver | null>(null);
  const [formData, setFormData] = useState<Partial<Receiver>>({});
  const [selectedMarketForForm, setSelectedMarketForForm] = useState<Market | null>(null);
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchMarket, setSearchMarket] = useState('');
  const [searchMac, setSearchMac] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelData, setExcelData] = useState<Receiver[]>([]);
  const [excelMarket, setExcelMarket] = useState<Market | null>(null);

  const fetchReceivers = async (overrides?: any) => { const data = await ReceiverAPI.getList(overrides); setReceivers(data); };
  useEffect(() => { fetchReceivers(); }, []);

  const handleRegister = () => { setSelectedReceiver(null); setFormData({ transmissionInterval: '01시간', status: '사용' }); setSelectedMarketForForm(null); setImageFile(null); setView('form'); };
  const handleEdit = (receiver: Receiver) => { 
      setSelectedReceiver(receiver); 
      setFormData({ ...receiver }); 
      setSelectedMarketForForm({ id: receiver.marketId, name: receiver.marketName || '' } as Market); // market_id -> marketId
      setImageFile(null); 
      setView('form'); 
  };

  const handleMarketSelect = (market: Market) => {
    if (view === 'form') {
      setSelectedMarketForForm(market);
      setFormData({ ...formData, marketId: market.id }); // market_id -> marketId
    } else if (view === 'excel') {
      setExcelMarket(market);
    }
    setIsMarketModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.marketId) { alert('소속 현장을 선택해주세요.'); return; } // market_id -> marketId
    if (!formData.macAddress) { alert('MAC ADDRESS를 입력해주세요.'); return; }

    // [New Logic] 중복 검사
    try {
        const existingList = await ReceiverAPI.getList({ marketId: formData.marketId });
        const isDuplicate = existingList.some(r => 
            r.id !== (selectedReceiver?.id || 0) && // 자기 자신 제외
            r.macAddress === formData.macAddress
        );

        if (isDuplicate) {
            alert(`이미 등록된 수신기 MAC입니다.\n(MAC: ${formData.macAddress})`);
            return;
        }
    } catch (e) {
        console.error("중복 체크 실패", e);
        // 안전을 위해 진행
    }

    try {
      let uploadedUrl = formData.image;
      if (imageFile) uploadedUrl = await ReceiverAPI.uploadImage(imageFile);

      const newReceiver: Receiver = {
        ...formData as Receiver,
        id: selectedReceiver?.id || 0,
        image: uploadedUrl
      };
      await ReceiverAPI.save(newReceiver);
      alert('저장되었습니다.');
      setView('list');
      fetchReceivers();
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

        // 1. 기존 데이터 조회 (중복 체크용)
        const existingReceivers = await ReceiverAPI.getList({ marketId: excelMarket.id });
        const existingMacSet = new Set(existingReceivers.map(r => r.macAddress));
        
        const parsedData: Receiver[] = [];
        const currentExcelMacSet = new Set<string>();
        const errors: string[] = [];

        // 2. 파싱 및 검증
        for (let i = 0; i < data.length; i++) {
            const row: any = data[i];
            const rowNum = i + 2;
            const mac = row['MAC주소'] ? String(row['MAC주소']).trim() : '';

            if (!mac) {
                errors.push(`${rowNum}행: MAC주소가 누락되었습니다.`);
                continue;
            }

            // 엑셀 내 중복
            if (currentExcelMacSet.has(mac)) {
                errors.push(`${rowNum}행: 엑셀 파일 내 중복된 MAC입니다 (${mac}).`);
            }
            currentExcelMacSet.add(mac);

            // DB 중복
            if (existingMacSet.has(mac)) {
                errors.push(`${rowNum}행: 이미 등록된 MAC입니다 (${mac}).`);
            }

            parsedData.push({
                id: 0,
                marketId: excelMarket!.id,
                marketName: excelMarket!.name,
                macAddress: mac,
                ip: row['IP주소'] || '',
                emergencyPhone: row['전화번호'] || '',
                transmissionInterval: row['전송주기'] || '01시간',
                status: '사용'
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
          // 일괄 저장 API가 없으므로 반복 호출 (안전성 우선)
          // *주의: 실제 상용환경에서는 saveBulk API를 만들어야 함. 현재는 요청대로 프론트에서 처리.
          for (const item of excelData) {
              await ReceiverAPI.save(item);
          }
          alert('일괄 등록되었습니다.');
          setView('list');
          fetchReceivers();
      } catch(e: any) {
          alert('일괄 등록 중 오류 발생: ' + e.message);
      }
  };

  const handleSampleDownload = () => {
      const sample = [
          {'MAC주소': '1A2B', 'IP주소': '192.168.0.1', '전화번호': '010-1234-5678', '전송주기': '01시간'}
      ];
      exportToExcel(sample, '수신기_일괄등록_샘플');
  };

  return (
    <>
      <PageHeader title="R형 수신기 현황" />
      {view === 'form' ? (
          <form onSubmit={handleSave}>
             <FormSection title={selectedReceiver ? "수신기 수정" : "수신기 등록"}>
                <FormRow label="소속 현장" required className="col-span-1 md:col-span-2">
                  <div className="flex gap-2 w-full max-w-md">
                    <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                      <input 
                        type="text"
                        value={selectedMarketForForm?.name || ''} 
                        placeholder="현장을 선택하세요" 
                        readOnly 
                        className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
                      />
                      <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                    </div>
                    <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
                  </div>
                </FormRow>
                <FormRow label="MAC ADDRESS" required>
                   <InputGroup value={formData.macAddress || ''} onChange={(e) => setFormData({...formData, macAddress: e.target.value})} placeholder="예: 1A2B" maxLength={4} />
                </FormRow>
                <FormRow label="IP주소">
                   <InputGroup value={formData.ip || ''} onChange={(e) => setFormData({...formData, ip: e.target.value})} placeholder="예: 192.168.0.1" />
                </FormRow>
                <FormRow label="DNS">
                   <InputGroup value={formData.dns || ''} onChange={(e) => setFormData({...formData, dns: e.target.value})} placeholder="예: 8.8.8.8" />
                </FormRow>
                <FormRow label="비상연락처">
                   <InputGroup value={formData.emergencyPhone || ''} onChange={(e) => setFormData({...formData, emergencyPhone: e.target.value})} onKeyDown={handlePhoneKeyDown} inputMode="numeric" placeholder="숫자만 입력" maxLength={11} />
                </FormRow>
                <FormRow label="전송주기">
                   <SelectGroup options={INTERVAL_OPTIONS} value={formData.transmissionInterval || '01시간'} onChange={(e) => setFormData({...formData, transmissionInterval: e.target.value})} />
                </FormRow>
                <FormRow label="사용여부" className="col-span-1 md:col-span-2">
                   <StatusRadioGroup label="" value={formData.status} onChange={(val) => setFormData({...formData, status: val as any})} />
                </FormRow>
            </FormSection>
            <div className="flex justify-center gap-3 mt-8">
                <Button type="submit" variant="primary" className="w-32">{selectedReceiver ? '수정' : '신규등록'}</Button>
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
                           <p className="text-xs text-slate-400">* MAC주소, IP주소, 전화번호, 전송주기 컬럼을 포함해야 합니다.</p>
                       </div>
                    </FormRow>
                    <FormRow label="샘플 양식">
                        <Button type="button" variant="secondary" onClick={handleSampleDownload} icon={<Download size={14} />} className="w-fit">
                           엑셀 샘플 다운로드
                        </Button>
                    </FormRow>
                 </div>
             </div>

             {/* Preview Table */}
             {excelData.length > 0 && (
                 <div className="mb-6">
                     <h4 className="text-lg font-bold text-slate-200 mb-2">등록 미리보기 ({excelData.length}건)</h4>
                     <DataTable 
                        columns={[
                            {header:'MAC', accessor:'macAddress'},
                            {header:'IP', accessor:'ip'},
                            {header:'전화번호', accessor:'emergencyPhone'},
                            {header:'전송주기', accessor:'transmissionInterval'},
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
          <>
             <SearchFilterBar onSearch={() => {setIsFiltered(true); fetchReceivers();}} onReset={() => {setSearchMarket(''); setSearchMac(''); setIsFiltered(false); fetchReceivers({});}} isFiltered={isFiltered}>
                <InputGroup label="소속 현장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
                <InputGroup label="MAC주소" value={searchMac} onChange={(e) => setSearchMac(e.target.value)} />
             </SearchFilterBar>
             
             <div className="flex justify-between items-center mb-2">
               <span className="text-sm text-slate-400">전체 <span className="text-blue-400">{receivers.length}</span> 건 (페이지 {currentPage})</span>
               <div className="flex gap-2">
                  <Button variant="primary" onClick={handleRegister}>신규 등록</Button>
                  <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16} />}>엑셀 신규 등록</Button>
               </div>
             </div>

             <DataTable 
                columns={[
                    { header: 'No', accessor: (_, idx) => idx + 1, width: '80px' },
                    { header: 'MAC주소', accessor: 'macAddress', width: '200px' },
                    { header: '소속 현장', accessor: 'marketName' },
                    { header: 'IP주소', accessor: 'ip', width: '200px' },
                    { header: '전화번호', accessor: (r) => formatPhoneNumber(r.emergencyPhone) || '-', width: '200px' },
                    { header: '사용여부', accessor: (item) => <StatusBadge status={item.status} />, width: '120px' },
                ]}
                data={receivers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
                onRowClick={handleEdit}
             />
             <Pagination totalItems={receivers.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
          </>
      )}
      <MarketSearchModal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} onSelect={handleMarketSelect} />
    </>
  );
};
