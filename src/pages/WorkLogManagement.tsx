import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, Button, DataTable, 
  Pagination, ActionBar, FormSection, FormRow, Column, Modal, UI_STYLES 
} from '../components/CommonUI';
import { WorkLog, Market } from '../types';
import { WorkLogAPI, MarketAPI } from '../services/api';
import { Search, X, Paperclip, Upload } from 'lucide-react';

const ITEMS_PER_PAGE = 10;
const MODAL_ITEMS_PER_PAGE = 5;

export const WorkLogManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Search Filters
  const [searchDate, setSearchDate] = useState(''); // Not used in current requirement but kept for consistency
  const [searchMarket, setSearchMarket] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

  // Form Data
  const [formData, setFormData] = useState<Partial<WorkLog>>({});
  const [selectedMarketForForm, setSelectedMarketForForm] = useState<Market | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Market Modal
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [marketList, setMarketList] = useState<Market[]>([]);
  const [marketSearchName, setMarketSearchName] = useState('');
  const [marketModalPage, setMarketModalPage] = useState(1);

  // --- Initial Data Load ---
  const fetchLogs = async (overrides?: { marketName?: string }) => {
    setLoading(true);
    try {
      const query = {
        marketName: overrides?.marketName !== undefined ? overrides.marketName : searchMarket
      };
      const data = await WorkLogAPI.getList(query);
      setLogs(data);
      setCurrentPage(1);
    } catch (e: any) {
      console.error("데이터 로드 중 오류:", e);
      // 테이블이 없는 경우(초기 설정 전)에는 사용자에게 알림창을 띄우지 않고 콘솔에만 경고
      if (e.message && e.message.includes('Could not find the table')) {
         console.warn('DB 테이블(work_logs)이 존재하지 않습니다. SQL 스크립트를 실행해주세요.');
      } else {
         alert('데이터 로드 실패: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // --- Search Handlers ---
  const handleSearch = () => {
    setIsFiltered(true);
    fetchLogs();
  };

  const handleReset = () => {
    setSearchMarket('');
    setIsFiltered(false);
    fetchLogs({ marketName: '' });
  };

  // --- List Actions ---
  const handleRegister = () => {
    setSelectedLog(null);
    setFormData({ workDate: new Date().toISOString().split('T')[0], content: '' });
    setSelectedMarketForForm(null);
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setView('form');
  };

  const handleEdit = (log: WorkLog) => {
    setSelectedLog(log);
    setFormData({ ...log });
    setSelectedMarketForForm({ id: log.marketId, name: log.marketName || '' } as Market);
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setView('form');
  };

  const handleDelete = async () => {
    if (selectedLog && confirm('정말 삭제하시겠습니까?')) {
      try {
        await WorkLogAPI.delete(selectedLog.id);
        alert('삭제되었습니다.');
        setView('list');
        fetchLogs();
      } catch (e) {
        alert('삭제 실패');
      }
    }
  };

  // --- Form Handlers ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.marketId) { alert('소속 시장을 선택해주세요.'); return; }
    if (!formData.workDate) { alert('작업 일시를 입력해주세요.'); return; }

    try {
      let uploadedUrl = formData.attachment;
      
      // 첨부 파일 업로드 (수정 모드에서만 가능하지만 로직상 파일이 있으면 업로드 시도)
      if (attachmentFile) {
        uploadedUrl = await WorkLogAPI.uploadAttachment(attachmentFile);
      }

      const newLog: WorkLog = {
        ...formData as WorkLog,
        id: selectedLog?.id || 0,
        attachment: uploadedUrl
      };

      await WorkLogAPI.save(newLog);
      alert('저장되었습니다.');
      setView('list');
      fetchLogs();
    } catch (e: any) {
      console.error(e);
      // 테이블 미생성 에러 가이드 메시지 추가
      if (e.message && e.message.includes('Could not find the table')) {
        alert('저장 실패: 데이터베이스에 작업일지 테이블(work_logs)이 없습니다.\n\n[해결방법]\nSupabase SQL Editor에서 "supabase_worklogs.sql" 스크립트를 실행하여 테이블을 생성해주세요.');
      } else {
        alert(`저장 실패: ${e.message}`);
      }
    }
  };

  // --- Image Logic ---
  const handleFileSelectClick = () => {
    if (formData.attachment || attachmentFile) {
      alert("등록된 이미지를 삭제해 주세요.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachmentFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    if (confirm("첨부 이미지를 삭제하시겠습니까?")) {
      setFormData({ ...formData, attachment: undefined });
      setAttachmentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFileName = () => {
    if (attachmentFile) return attachmentFile.name;
    if (formData.attachment) {
      try {
        const url = new URL(formData.attachment);
        return decodeURIComponent(url.pathname.split('/').pop() || 'image.jpg');
      } catch {
        return '첨부이미지.jpg';
      }
    }
    return '';
  };

  const handleDownload = async () => {
    // 1. 방금 선택한 파일
    if (attachmentFile) {
        const url = URL.createObjectURL(attachmentFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachmentFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
    }

    // 2. 서버 파일
    if (formData.attachment) {
        try {
            const response = await fetch(formData.attachment);
            if (!response.ok) throw new Error('Network error');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = getFileName();
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Download failed', e);
            window.open(formData.attachment, '_blank');
        }
    }
  };

  // --- Market Modal Handlers ---
  const fetchMarkets = async () => {
    const data = await MarketAPI.getList({ name: marketSearchName });
    setMarketList(data);
    setMarketModalPage(1);
  };

  const openMarketModal = () => {
    setMarketSearchName('');
    fetchMarkets();
    setIsMarketModalOpen(true);
  };

  const handleMarketSelect = (market: Market) => {
    setSelectedMarketForForm(market);
    setFormData({ ...formData, marketId: market.id });
    setIsMarketModalOpen(false);
  };

  // --- Columns ---
  const columns: Column<WorkLog>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '작업일시', accessor: 'workDate', width: '150px' },
    { header: '시장정보', accessor: 'marketName' },
    // 작업내용 추가 및 말줄임표 처리
    { header: '작업내용', accessor: (item) => (
      <div className="truncate max-w-[300px] mx-auto" title={item.content}>
        {item.content}
      </div>
    ) },
    { header: '등록일', accessor: (item) => item.created_at ? new Date(item.created_at).toLocaleDateString() : '-', width: '150px' },
  ];

  const marketColumns: Column<Market>[] = [
    { header: '시장명', accessor: 'name' },
    { header: '주소', accessor: 'address' },
    { header: '선택', accessor: (item) => (
      <Button variant="primary" onClick={() => handleMarketSelect(item)} className="px-2 py-1 text-xs">선택</Button>
    ), width: '80px' }
  ];

  // --- Pagination ---
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = logs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);

  const modalIndexOfLast = marketModalPage * MODAL_ITEMS_PER_PAGE;
  const modalIndexOfFirst = modalIndexOfLast - MODAL_ITEMS_PER_PAGE;
  const modalCurrentMarkets = marketList.slice(modalIndexOfFirst, modalIndexOfLast);
  const modalTotalPages = Math.ceil(marketList.length / MODAL_ITEMS_PER_PAGE);

  // --- View: Form ---
  if (view === 'form') {
    return (
      <>
        <PageHeader title="작업일지" />
        <form onSubmit={handleSave}>
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm mb-5 w-full">
            <h3 className="text-lg font-bold text-slate-200 mb-5 border-b border-slate-700 pb-2 flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-500 rounded-sm"></span>
              {selectedLog ? "작업일지 수정" : "작업일지 등록"}
            </h3>

            {/* Row 1: 소속 시장 */}
            <div className="flex flex-col gap-1.5 w-full mb-6">
              <label className={UI_STYLES.label}>소속 시장</label>
              <div className="flex gap-2 w-full max-w-2xl">
                <div onClick={openMarketModal} className="flex-1 relative cursor-pointer">
                  <input 
                    type="text"
                    value={selectedMarketForForm?.name || ''} 
                    placeholder="시장을 선택하세요" 
                    readOnly 
                    className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
                  />
                  <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                </div>
                <Button type="button" variant="secondary" onClick={openMarketModal}>찾기</Button>
              </div>
            </div>

            {/* Row 2: 작업 일시 & 첨부 이미지 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="flex flex-col gap-1.5">
                <label className={UI_STYLES.label}>작업 일시</label>
                <input 
                  type="date" 
                  value={formData.workDate || ''}
                  onChange={(e) => setFormData({...formData, workDate: e.target.value})}
                  className={`${UI_STYLES.input} w-full`}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={UI_STYLES.label}>
                  첨부이미지 <span className="text-red-400 text-xs font-normal">* 등록 후 수정 시에만 추가 가능</span>
                </label>
                {/* 첨부파일 입력: 수정 모드일 때만 활성화 or 표시 */}
                {selectedLog ? (
                  <div className="flex flex-col gap-2">
                    <InputGroup 
                      ref={fileInputRef}
                      type="file" 
                      onChange={handleFileChange}
                      className="hidden" 
                      accept="image/*"
                    />
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="secondary" onClick={handleFileSelectClick} icon={<Upload size={16} />}>
                           파일 선택
                        </Button>
                        
                        {(formData.attachment || attachmentFile) && (
                          <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded border border-slate-600 w-fit">
                            <Paperclip size={14} className="text-slate-400" />
                            <span 
                              onClick={handleDownload}
                              className={`text-sm ${formData.attachment || attachmentFile ? 'text-blue-400 cursor-pointer hover:underline' : 'text-slate-300'}`}
                              title="클릭하여 다운로드"
                            >
                              {getFileName()}
                            </span>
                            <button type="button" onClick={handleRemoveFile} className="text-red-400 hover:text-red-300 ml-2 p-1 rounded hover:bg-slate-600 transition-colors">
                              <X size={16} />
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center h-[42px] px-3 bg-slate-800/50 border border-slate-700 rounded text-slate-500 text-sm italic">
                    신규 등록 시에는 첨부할 수 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: 작업내용 */}
            <div className="flex flex-col gap-1.5 w-full mb-6">
               <label className={UI_STYLES.label}>작업내용</label>
               <textarea 
                  value={formData.content || ''}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  className={`${UI_STYLES.input} min-h-[200px] resize-none`}
                  placeholder="작업 내용을 입력하세요"
               />
            </div>
          </div>

          <div className="flex justify-center gap-3 mt-8">
            <Button type="submit" variant="primary" className="w-32">{selectedLog ? '수정' : '신규등록'}</Button>
            <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
          </div>
        </form>

        {/* Market Select Modal */}
        <Modal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} title="시장 찾기" width="max-w-3xl">
           <SearchFilterBar onSearch={fetchMarkets}>
              <InputGroup 
                 label="시장명" 
                 value={marketSearchName} 
                 onChange={(e) => setMarketSearchName(e.target.value)} 
                 placeholder="시장명 검색"
              />
           </SearchFilterBar>
           <DataTable columns={marketColumns} data={modalCurrentMarkets} />
           <Pagination 
              totalItems={marketList.length} itemsPerPage={MODAL_ITEMS_PER_PAGE} currentPage={marketModalPage} onPageChange={setMarketModalPage} 
           />
        </Modal>
      </>
    );
  }

  // --- View: List ---
  return (
    <>
      <PageHeader title="작업일지" />
      
      <div className="flex justify-between items-end mb-2 mt-4">
         <span className="text-sm text-slate-400">
           전체 {logs.length} 개 (페이지 {currentPage})
         </span>
         <div className="flex gap-2">
            <Button variant="primary" onClick={handleRegister}>신규등록</Button>
            <Button variant="primary" onClick={handleSearch} icon={<Search size={14}/>}>검색</Button>
         </div>
      </div>

      <DataTable columns={columns} data={currentItems} onRowClick={handleEdit} />
      
      <Pagination 
        totalItems={logs.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  );
};