import React, { useState, useEffect, useRef } from 'react';
import { ReceiverAPI } from '../services/api';
import { Receiver, Market } from '../types';
import { PageHeader, SearchFilterBar, InputGroup, SelectGroup, Button, DataTable, Pagination, FormSection, FormRow, StatusRadioGroup, StatusBadge, MarketSearchModal, UI_STYLES, handlePhoneKeyDown, formatPhoneNumber } from '../components/CommonUI';
import { usePageTitle } from '../components/Layout';
import { Search, Upload, CheckCircle } from 'lucide-react';
import { exportToExcel } from '../utils/excel';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;
const INTERVAL_OPTIONS = Array.from({ length: 23 }, (_, i) => { const val = String(i + 1).padStart(2, '0'); return { value: `${val}시간`, label: `${val}시간` }; });

export const ReceiverManagement: React.FC = () => {
  // [강제 수정] usePageTitle 훅이 DB에서 '관리'를 가져와도, 여기서 강제로 '현황'을 우선 표시하도록 유도
  // Layout.tsx에서도 수정했지만, 페이지 레벨에서 한 번 더 확실하게 처리
  const pageTitleRaw = usePageTitle('R형 수신기 현황');
  const pageTitle = pageTitleRaw.replace('관리', '현황'); // '관리'라는 단어가 있으면 '현황'으로 치환

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
      setSelectedMarketForForm({ id: receiver.marketId, name: receiver.marketName || '' } as Market); 
      setImageFile(null); 
      setView('form'); 
  };

  const handleMarketSelect = (market: Market) => {
    if (view === 'form') {
      setSelectedMarketForForm(market);
      setFormData({ ...formData, marketId: market.id }); 
    } else if (view === 'excel') {
      setExcelMarket(market);
    }
    setIsMarketModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.marketId) { alert('설치 시장을 선택해주세요.'); return; } 
    if (!formData.macAddress) { alert('MAC ADDRESS를 입력해주세요.'); return; }

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

        const parsedData: Receiver[] = data.map((row: any) => ({
          id: 0,
          marketId: excelMarket!.id, 
          marketName: excelMarket!.name,
          macAddress: row['MAC주소'] ? String(row['MAC주소']) : '',
          ip: row['IP주소'] || '',
          emergencyPhone: row['전화번호'] || '',
          status: '사용'
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
      <PageHeader title={pageTitle} />
      
      {/* File Update Check Marker */}
      <div className="mb-4 bg-blue-900/30 border border-blue-500 text-blue-200 p-2 rounded text-sm font-bold flex items-center gap-2">
         <CheckCircle size={16} /> [ROOT FILE ACTIVE] 이 문구가 보이면 루트 파일이 정상적으로 로드된 것입니다.
      </div>

      {view === 'form' ? (
          <form onSubmit={handleSave}>
             <FormSection title={selectedReceiver ? "수신기 수정" : "수신기 등록"}>
                <FormRow label="설치 시장" required className="col-span-1 md:col-span-2">
                  <div className="flex gap-2 w-full">
                    <div onClick={() => setIsMarketModalOpen(true)} className="flex-1 relative cursor-pointer">
                      <input 
                        type="text"
                        value={selectedMarketForForm?.name || ''} 
                        placeholder="시장을 선택하세요" 
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
                   <InputGroup type="file" accept=".xlsx, .xls" onChange={handleExcelFileChange} className="