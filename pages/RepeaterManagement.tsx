import React, { useState, useEffect, useRef } from 'react';
import { RepeaterAPI } from '../services/api';
import { Repeater, Market, Receiver } from '../types';
import { PageHeader, SearchFilterBar, InputGroup, SelectGroup, Button, DataTable, Pagination, FormSection, FormRow, StatusRadioGroup, StatusBadge, MarketSearchModal, ReceiverSearchModal, UI_STYLES } from '../components/CommonUI';
import { Search, Upload, Paperclip, X, Download } from 'lucide-react';
import { exportToExcel } from '../utils/excel';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;
const REPEATER_ID_OPTIONS = Array.from({ length: 20 }, (_, i) => { const val = String(i + 1).padStart(2, '0'); return { value: val, label: val }; });

export const RepeaterManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [repeaters, setRepeaters] = useState<Repeater[]>([]);
  const [selectedRepeater, setSelectedRepeater] = useState<Repeater | null>(null);
  const [formData, setFormData] = useState<Partial<Repeater>>({});
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchMarket, setSearchMarket] = useState('');
  const [isReceiverModalOpen, setIsReceiverModalOpen] = useState(false);
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelData, setExcelData] = useState<Repeater[]>([]);
  const [excelMarket, setExcelMarket] = useState<Market | null>(null);

  const fetchRepeaters = async (overrides?: any) => { const data = await RepeaterAPI.getList(overrides); setRepeaters(data); };
  useEffect(() => { fetchRepeaters(); }, []);

  const handleRegister = () => { setSelectedRepeater(null); setFormData({ repeaterId: '01', alarmStatus: '사용', status: '사용' }); setImageFile(null); setView('form'); };
  const handleEdit = (repeater: Repeater) => { setSelectedRepeater(repeater); setFormData({ ...repeater }); setImageFile(null); setView('form'); };

  const handleReceiverSelect = (receiver: Receiver) => {
    setFormData({ 
        ...formData, 
        marketId: receiver.marketId, // market_id -> marketId
        marketName: receiver.marketName,
        receiverMac: receiver.macAddress 
    });
    setIsReceiverModalOpen(false);
  };

  const handleMarketSelect = (market: Market) => {
    setExcelMarket(market);
    setIsMarketModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.marketId || !formData.receiverMac) { alert('R형 수신기를 선택해주세요.'); return; } // market_id -> marketId
    
    // [New Logic] 중복 검사
    try {
        const existingList = await RepeaterAPI.getList({ marketId: formData.marketId, receiverMac: formData.receiverMac });
        const isDuplicate = existingList.some(r => 
            r.id !== (selectedRepeater?.id || 0) &&
            r.repeaterId === formData.repeaterId
        );

        if (isDuplicate) {
            alert(`이미 등록된 중계기 ID입니다.\n(MAC: ${formData.receiverMac}, ID: ${formData.repeaterId})`);
            return;
        }
    } catch (e) {
        console.error("중복 체크 실패", e);
    }

    try {
      let uploadedUrl = formData.image;
      if (imageFile) uploadedUrl = await RepeaterAPI.uploadImage(imageFile);
      const newRepeater: Repeater = { ...formData as Repeater, id: selectedRepeater?.id || 0, image: uploadedUrl };
      await RepeaterAPI.save(newRepeater);
      alert('저장되었습니다.');
      setView('list');
      fetchRepeaters();
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
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // 1. 기존 데이터 조회
        const existingRepeaters = await RepeaterAPI.getList({ marketId: excelMarket.id });
        const existingKeySet = new Set(existingRepeaters.map(r => `${r.receiverMac}-${r.repeaterId}`));

        const parsedData: Repeater[] = [];
        const currentExcelKeySet = new Set<string>();
        const errors: string[] = [];

        // 2. 파싱 및 검증
        for (let i = 0; i < data.length; i++) {
            const row: any = data[i];
            const rowNum = i + 2;
            const mac = row['수신기MAC'] ? String(row['수신기MAC']).trim() : '';
            const rptId = row['중계기ID'] ? String(row['중계기ID']).padStart(2, '0') : '';

            if (!mac || !rptId) {
                errors.push(`${rowNum}행: 필수 정보(MAC, 중계기ID)가 누락되었습니다.`);
                continue;
            }

            if (parseInt(rptId) > 20) {
                errors.push(`${rowNum}행: 중계기 ID(${rptId})는 20을 초과할 수 없습니다.`);
            }

            const key = `${mac}-${rptId}`;

            if (currentExcelKeySet.has(key)) {
                errors.push(`${rowNum}행: 엑셀 파일 내 중복된 데이터입니다 (${key}).`);
            }
            currentExcelKeySet.add(key);

            if (existingKeySet.has(key)) {
                errors.push(`${rowNum}행: 이미 등록된 기기입니다 (${key}).`);
            }

            parsedData.push({
                id: 0,
                marketId: excelMarket!.id,
                marketName: excelMarket!.name,
                receiverMac: mac,
                repeaterId: rptId,
                alarmStatus: '사용',
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
          for (const item of excelData) {
              await RepeaterAPI.save(item);
          }
          alert('일괄 등록되었습니다.');
          setView('list');
          fetchRepeaters();
      } catch(e: any) {
          alert('일괄 등록 중 오류 발생: ' + e.message);
      }
  };

  const handleSampleDownload = () => {
      const sample = [
          {'수신기MAC': '1A2B', '중계기ID': '01'}
      ];
      exportToExcel(sample, '중계기_일괄등록_샘플');
  };

  return (
    <>
      <PageHeader title="중계기 현황" />
      {view === 'form' ? (
          <form onSubmit={handleSave}>
             <FormSection title={selectedRepeater ? "중계기 수정" : "중계기 등록"}>
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
               <SelectGroup options={REPEATER_ID_OPTIONS} value={formData.repeaterId || '01'} onChange={(e) => setFormData({...formData, repeaterId: e.target.value})} />
            </FormRow>
            
            <FormRow label="경보출력 사용여부">
               <StatusRadioGroup label="" value={formData.alarmStatus} onChange={(val) => setFormData({...formData, alarmStatus: val as any})} />
            </FormRow>

            <FormRow label="설치위치 설명" className="col-span-1 md:col-span-2">
               <InputGroup value={formData.location || ''} onChange={(e) => setFormData({...formData, location: e.target.value})} />
            </FormRow>

            <FormRow label="사용여부">
               <StatusRadioGroup label="" value={formData.status} onChange={(val) => setFormData({...formData, status: val as any})} />
            </FormRow>
            
            <FormRow label="설치 이미지" className="col-span-1 md:col-span-2">
                 <div className="flex flex-col gap-2 w-full">
                    <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && setImageFile(e.target.files[0])} className="hidden" accept="image/*" />
                    <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<Upload size={16} />}>파일 선택</Button>
                 </div>
            </FormRow>
            </FormSection>
            <div className="flex justify-center gap-3 mt-8">
                <Button type="submit" variant="primary" className="w-32">{selectedRepeater ? '수정' : '신규등록'}</Button>
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
                    <FormRow label="설치 시장 선택" required>
                       <div className="flex gap-2 w-full">
                          <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                             <input type="text" value={excelMarket?.name || ''} placeholder="등록할 시장을 선택하세요" readOnly className={`${UI_STYLES.input} cursor-pointer pr-8`} />
                             <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                          </div>
                          <Button type="button" variant="secondary" onClick={() => setIsMarketModalOpen(true)}>찾기</Button>
                       </div>
                    </FormRow>
                    <FormRow label="엑셀 파일" required>
                       <div className="flex flex-col gap-2">
                           <InputGroup type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleExcelFileChange} className="border-0 p-0 text-slate-300" />
                           <p className="text-xs text-slate-400">* 수신기MAC, 중계기ID 컬럼을 포함해야 합니다.</p>
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
                     <DataTable columns={[{header:'수신기MAC', accessor:'receiverMac'}, {header:'중계기ID', accessor:'repeaterId'}]} data={excelData.slice(0, 10)} />
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
             <SearchFilterBar onSearch={() => fetchRepeaters({marketName: searchMarket})} onReset={() => {setSearchMarket(''); fetchRepeaters({});}}>
                <InputGroup label="설치시장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
             </SearchFilterBar>
             <div className="flex justify-between items-center mb-2">
               <span className="text-sm text-slate-400">전체 <span className="text-blue-400">{repeaters.length}</span> 건</span>
               <div className="flex gap-2">
                  <Button variant="primary" onClick={handleRegister}>신규 등록</Button>
                  <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16} />}>엑셀 신규 등록</Button>
               </div>
             </div>
             <DataTable 
                columns={[
                    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
                    { header: '수신기MAC', accessor: 'receiverMac', width: '150px' },
                    { header: '중계기ID', accessor: 'repeaterId', width: '100px' },
                    { header: '설치시장', accessor: 'marketName' },
                    { header: '사용여부', accessor: (item) => <StatusBadge status={item.status} />, width: '100px' },
                ]}
                data={repeaters.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
                onRowClick={handleEdit}
             />
             <Pagination totalItems={repeaters.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
          </>
      )}
      <ReceiverSearchModal isOpen={isReceiverModalOpen} onClose={() => setIsReceiverModalOpen(false)} onSelect={handleReceiverSelect} />
      <MarketSearchModal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} onSelect={handleMarketSelect} />
    </>
  );
};