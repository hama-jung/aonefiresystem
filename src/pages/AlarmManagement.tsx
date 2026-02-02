
import React, { useState, useEffect } from 'react';
import { AlarmAPI } from '../services/api';
import { Alarm, Receiver } from '../types';
import { 
  PageHeader, SearchFilterBar, InputGroup, SelectGroup, Button, DataTable, Pagination, 
  FormSection, FormRow, StatusRadioGroup, StatusBadge, ReceiverSearchModal, UI_STYLES, Column 
} from '../components/CommonUI';
import { Search } from 'lucide-react';

const ITEMS_PER_PAGE = 10;
const ID_OPTIONS = Array.from({ length: 20 }, (_, i) => { const val = String(i + 1).padStart(2, '0'); return { value: val, label: val }; });

export const AlarmManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [formData, setFormData] = useState<Partial<Alarm>>({});
  const [isReceiverModalOpen, setIsReceiverModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchMarket, setSearchMarket] = useState('');

  const fetchAlarms = async (overrides?: any) => { const data = await AlarmAPI.getList(overrides); setAlarms(data); };
  useEffect(() => { fetchAlarms(); }, []);

  const handleRegister = () => { setSelectedAlarm(null); setFormData({ repeaterId: '01', alarmId: '01', status: '사용' }); setView('form'); };
  const handleEdit = (a: Alarm) => { setSelectedAlarm(a); setFormData({ ...a }); setView('form'); };

  const handleReceiverSelect = (r: Receiver) => {
    setFormData({ 
        ...formData, 
        market_id: r.market_id, 
        marketName: r.marketName,
        receiverMac: r.macAddress 
    });
    setIsReceiverModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.market_id || !formData.receiverMac) { alert('R형 수신기를 선택해주세요.'); return; } 
    
    try {
      const newAlarm: Alarm = { ...formData as Alarm, id: selectedAlarm?.id || 0 };
      await AlarmAPI.save(newAlarm);
      alert('저장되었습니다.');
      setView('list');
      fetchAlarms();
    } catch (e: any) { alert(`저장 실패: ${e.message}`); }
  };

  const alarmColumns: Column<Alarm>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '수신기 MAC', accessor: 'receiverMac', width: '150px' },
    { header: '중계기 ID', accessor: 'repeaterId', width: '100px' },
    { header: '경종 ID', accessor: 'alarmId', width: '100px' },
    { header: '설치시장', accessor: 'marketName' },
    { header: '사용여부', accessor: (item) => <StatusBadge status={item.status} />, width: '100px' },
  ];

  return (
    <>
      <PageHeader title="경종 관리" />
      {view === 'form' ? (
          <form onSubmit={handleSave}>
             <FormSection title={selectedAlarm ? "경종 수정" : "경종 등록"}>
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
                <FormRow label="경종 ID">
                  <SelectGroup options={ID_OPTIONS} value={formData.alarmId || '01'} onChange={(e) => setFormData({...formData, alarmId: e.target.value})} />
                </FormRow>
                <FormRow label="사용여부">
                  <StatusRadioGroup label="" value={formData.status} onChange={(val) => setFormData({...formData, status: val as any})} />
                </FormRow>
             </FormSection>
             <div className="flex justify-center gap-3 mt-8">
                <Button type="submit" variant="primary" className="w-32">{selectedAlarm ? '수정' : '신규등록'}</Button>
                <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">목록</Button>
             </div>
          </form>
      ) : (
          <>
             <SearchFilterBar onSearch={() => fetchAlarms({marketName: searchMarket})} onReset={() => {setSearchMarket(''); fetchAlarms({});}}>
                <InputGroup label="설치시장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
             </SearchFilterBar>
             <DataTable<Alarm> 
                columns={alarmColumns}
                data={alarms.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
                onRowClick={handleEdit}
             />
             <Pagination totalItems={alarms.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
          </>
      )}
      <ReceiverSearchModal isOpen={isReceiverModalOpen} onClose={() => setIsReceiverModalOpen(false)} onSelect={handleReceiverSelect} />
    </>
  );
};
