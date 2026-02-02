
import React, { useState, useEffect, useRef } from 'react';
import { WorkLogAPI, MarketAPI } from '../services/api';
import { WorkLog, Market } from '../types';
import { PageHeader, SearchFilterBar, InputGroup, Button, DataTable, Pagination, FormRow, Modal, UI_STYLES } from '../components/CommonUI';
import { Search, Upload, Paperclip, X } from 'lucide-react';

const ITEMS_PER_PAGE = 10;
const MODAL_ITEMS_PER_PAGE = 5;

export const WorkLogManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [formData, setFormData] = useState<Partial<WorkLog>>({});
  const [selectedMarketForForm, setSelectedMarketForForm] = useState<Market | null>(null);
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [marketList, setMarketList] = useState<Market[]>([]);
  const [marketSearchName, setMarketSearchName] = useState('');
  const [marketModalPage, setMarketModalPage] = useState(1);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchMarket, setSearchMarket] = useState('');

  const fetchLogs = async (overrides?: any) => { const data = await WorkLogAPI.getList(overrides); setLogs(data); };
  useEffect(() => { fetchLogs(); }, []);

  const handleRegister = () => { setSelectedLog(null); setFormData({ workDate: new Date().toISOString().split('T')[0] }); setSelectedMarketForForm(null); setAttachmentFile(null); setView('form'); };
  const handleEdit = (log: WorkLog) => { 
      setSelectedLog(log); 
      setFormData({ ...log }); 
      setSelectedMarketForForm({ id: log.market_id, name: log.marketName || '' } as Market); 
      setAttachmentFile(null); 
      setView('form'); 
  };

  const handleMarketSelect = (market: Market) => {
    setSelectedMarketForForm(market);
    setFormData({ ...formData, market_id: market.id }); 
    setIsMarketModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.market_id) { alert('소속 시장을 선택해주세요.'); return; } 
    
    try {
      let uploadedUrl = formData.attachment;
      if (attachmentFile) uploadedUrl = await WorkLogAPI.uploadAttachment(attachmentFile);
      const newLog: WorkLog = { ...formData as WorkLog, id: selectedLog?.id || 0, attachment: uploadedUrl };
      await WorkLogAPI.save(newLog);
      alert('저장되었습니다.');
      setView('list');
      fetchLogs();
    } catch (e: any) { alert(`저장 실패: ${e.message}`); }
  };

  const fetchMarkets = async () => { const data = await MarketAPI.getList({ name: marketSearchName }); setMarketList(data); setMarketModalPage(1); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) setAttachmentFile(e.target.files[0]); };
  const handleRemoveFile = () => { if(confirm('삭제하시겠습니까?')) { setFormData({...formData, attachment: undefined}); setAttachmentFile(null); } };

  return (
    <>
      <PageHeader title="작업일지" />
      {view === 'form' ? (
          <form onSubmit={handleSave}>
             <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-5">
                <h3 className="text-lg font-bold text-slate-200 mb-5 border-b border-slate-700 pb-2">{selectedLog ? "작업일지 수정" : "작업일지 등록"}</h3>
                <div className="flex flex-col gap-1.5 w-full mb-6">
                  <label className={UI_STYLES.label}>소속 시장</label>
                  <div className="flex gap-2 w-full max-w-2xl">
                    <div onClick={() => { setIsMarketModalOpen(true); fetchMarkets(); }} className="flex-1 relative cursor-pointer">
                      <input 
                        type="text"
                        value={selectedMarketForForm?.name || ''} 
                        placeholder="시장을 선택하세요" 
                        readOnly 
                        className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
                      />
                      <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                    </div>
                    <Button type="button" variant="secondary" onClick={() => { setIsMarketModalOpen(true); fetchMarkets(); }}>찾기</Button>
                  </div>
                </div>
                {/* ... Other inputs (Date, Image, Content) ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="flex flex-col gap-1.5">
                        <label className={UI_STYLES.label}>작업 일시</label>
                        <input type="date" value={formData.workDate || ''} onChange={(e) => setFormData({...formData, workDate: e.target.value})} className={`${UI_STYLES.input} w-full`} required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={UI_STYLES.label}>첨부이미지</label>
                        <div className="flex flex-col gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<Upload size={16}/>}>파일 선택</Button>
                                {(formData.attachment || attachmentFile) && (
                                    <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded border border-slate-600">
                                        <Paperclip size={14} className="text-slate-400" />
                                        <span className="text-sm text-blue-400 cursor-pointer hover:underline" onClick={() => window.open(formData.attachment || URL.createObjectURL(attachmentFile!), '_blank')}>이미지 보기</span>
                                        <button type="button" onClick={handleRemoveFile} className="text-red-400 hover:text-red-300 ml-2"><X size={16}/></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5 w-full mb-6">
                   <label className={UI_STYLES.label}>작업내용</label>
                   <textarea value={formData.content || ''} onChange={(e) => setFormData({...formData, content: e.target.value})} className={`${UI_STYLES.input} min-h-[200px] resize-none`} />
                </div>
             </div>
             <div className="flex justify-center gap-3 mt-8">
                <Button type="submit" variant="primary" className="w-32">{selectedLog ? '수정' : '신규등록'}</Button>
                <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
             </div>
          </form>
      ) : (
          <>
             <SearchFilterBar onSearch={() => fetchLogs({marketName: searchMarket})} onReset={() => {setSearchMarket(''); fetchLogs({});}}>
                <InputGroup label="시장명" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
             </SearchFilterBar>
             <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">전체 <span className="text-blue-400">{logs.length}</span> 건</span>
                <Button variant="primary" onClick={handleRegister}>신규 등록</Button>
             </div>
             <DataTable 
                columns={[
                    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
                    { header: '작업일시', accessor: 'workDate', width: '150px' },
                    { header: '시장정보', accessor: 'marketName' },
                    { header: '작업내용', accessor: (item) => <div className="truncate max-w-[300px]" title={item.content}>{item.content}</div> },
                    { header: '등록일', accessor: (item) => item.created_at ? new Date(item.created_at).toLocaleDateString() : '-', width: '150px' },
                ]}
                data={logs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
                onRowClick={handleEdit}
             />
             <Pagination totalItems={logs.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
          </>
      )}
      <Modal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} title="시장 찾기" width="max-w-3xl">
           <SearchFilterBar onSearch={fetchMarkets}>
              <InputGroup label="시장명" value={marketSearchName} onChange={(e) => setMarketSearchName(e.target.value)} placeholder="시장명 검색" />
           </SearchFilterBar>
           <DataTable 
             columns={[
                { header: '시장명', accessor: 'name' },
                { header: '주소', accessor: 'address' },
                { header: '선택', accessor: (item) => <Button variant="primary" onClick={() => handleMarketSelect(item)} className="px-2 py-1 text-xs">선택</Button>, width: '80px' }
             ]} 
             data={marketList.slice((marketModalPage - 1) * MODAL_ITEMS_PER_PAGE, marketModalPage * MODAL_ITEMS_PER_PAGE)} 
           />
           <Pagination totalItems={marketList.length} itemsPerPage={MODAL_ITEMS_PER_PAGE} currentPage={marketModalPage} onPageChange={setMarketModalPage} />
        </Modal>
    </>
  );
};
