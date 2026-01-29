
import React, { useState, useEffect } from 'react';
import { TransmitterAPI } from '../services/api';
import { Transmitter, Receiver } from '../types';
import { PageHeader, SearchFilterBar, InputGroup, Button, DataTable, Pagination, FormSection, FormRow, StatusRadioGroup, StatusBadge, ReceiverSearchModal, UI_STYLES, SelectGroup } from '../components/CommonUI';
import { Search } from 'lucide-react';

const ITEMS_PER_PAGE = 10;
const ID_OPTIONS = Array.from({ length: 20 }, (_, i) => { const val = String(i + 1).padStart(2, '0'); return { value: val, label: val }; });

export const TransmitterManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [transmitters, setTransmitters] = useState<Transmitter[]>([]);
  const [selectedTransmitter, setSelectedTransmitter] = useState<Transmitter | null>(null);
  const [formData, setFormData] = useState<Partial<Transmitter>>({});
  const [isReceiverModalOpen, setIsReceiverModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchMarket, setSearchMarket] = useState('');

  const fetchTransmitters = async (overrides?: any) => { const data = await TransmitterAPI.getList(overrides); setTransmitters(data); };
  useEffect(() => { fetchTransmitters(); }, []);

  const handleRegister = () => { setSelectedTransmitter(null); setFormData({ repeaterId: '01', transmitterId: '01', status: '사용' }); setView('form'); };
  const handleEdit = (t: Transmitter) => { setSelectedTransmitter(t); setFormData({ ...t }); setView('form'); };

  const handleReceiverSelect = (r: Receiver) => {
    setFormData({ 
        ...formData, 
        market_id: r.market_id, // [CHANGED] market_id
        marketName: r.marketName,
        receiverMac: r.macAddress 
    });
    setIsReceiverModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.market_id || !formData.receiverMac) { alert('R형 수신기를 선택해주세요.'); return; } // [CHANGED] market_id
    
    try {
      const newTransmitter: Transmitter = { ...formData as Transmitter, id: selectedTransmitter?.id || 0 };
      await TransmitterAPI.save(newTransmitter);
      alert('저장되었습니다.');
      setView('list');
      fetchTransmitters();
    } catch (e: any) { alert(`저장 실패: ${e.message}`); }
  };

  return (
    <>
      <PageHeader title="발신기 관리" />
      {view === 'form' ? (
          <form onSubmit={handleSave}>
             <FormSection title={selectedTransmitter ? "발신기 수정" : "발신기 등록"}>
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
                <FormRow label="발신기 ID">
                  <SelectGroup options={ID_OPTIONS} value={formData.transmitterId || '01'} onChange={(e) => setFormData({...formData, transmitterId: e.target.value})} />
                </FormRow>
                <FormRow label="사용여부">
                  <StatusRadioGroup label="" value={formData.status} onChange={(val) => setFormData({...formData, status: val as any})} />
                </FormRow>
             </FormSection>
             <div className="flex justify-center gap-3 mt-8">
                <Button type="submit" variant="primary" className="w-32">{selectedTransmitter ? '수정' : '신규등록'}</Button>
                <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">목록</Button>
             </div>
          </form>
      ) : (
          <>
             <SearchFilterBar onSearch={() => fetchTransmitters({marketName: searchMarket})} onReset={() => {setSearchMarket(''); fetchTransmitters({});}}>
                <InputGroup label="설치시장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
             </SearchFilterBar>
             <DataTable 
                columns={[
                    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
                    { header: '수신기 MAC', accessor: 'receiverMac', width: '150px' },
                    { header: '중계기 ID', accessor: 'repeaterId', width: '100px' },
                    { header: '발신기 ID', accessor: 'transmitterId', width: '100px' },
                    { header: '설치시장', accessor: 'marketName' },
                    { header: '사용여부', accessor: (item) => <StatusBadge status={item.status} />, width: '100px' },
                ]}
                data={transmitters.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
                onRowClick={handleEdit}
             />
             <Pagination totalItems={transmitters.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
          </>
      )}
      <ReceiverSearchModal isOpen={isReceiverModalOpen} onClose={() => setIsReceiverModalOpen(false)} onSelect={handleReceiverSelect} />
    </>
  );
};
