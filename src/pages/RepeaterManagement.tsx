import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, SelectGroup, Button, DataTable, 
  Pagination, FormSection, FormRow, Column, UI_STYLES,
  StatusBadge, StatusRadioGroup, MarketSearchModal, ReceiverSearchModal
} from '../components/CommonUI';
import { Repeater, Market, Receiver } from '../types';
import { RepeaterAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';
import { Search, X, Paperclip, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;

// 중계기 ID 옵션 (01 ~ 20)
const REPEATER_ID_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const val = String(i + 1).padStart(2, '0');
  return { value: val, label: val };
});

export const RepeaterManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [repeaters, setRepeaters] = useState<Repeater[]>([]);
  const [selectedRepeater, setSelectedRepeater] = useState<Repeater | null>(null);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Search Filters
  const [searchMarket, setSearchMarket] = useState('');
  const [searchReceiverMac, setSearchReceiverMac] = useState('');
  const [searchRepeaterId, setSearchRepeaterId] = useState('');
  const [searchAlarmStatus, setSearchAlarmStatus] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

  // Form Data
  const [formData, setFormData] = useState<Partial<Repeater>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common Modals
  const [isReceiverModalOpen, setIsReceiverModalOpen] = useState(false);
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);

  // Excel Upload
  const [excelData, setExcelData] = useState<Repeater[]>([]);
  const [excelMarket, setExcelMarket] = useState<Market | null>(null);

  // --- Initial Data Load ---
  const fetchRepeaters = async (overrides?: any) => {
    setLoading(true);
    try {
      const query = {
        marketName: overrides?.marketName !== undefined ? overrides.marketName : searchMarket,
        receiverMac: overrides?.receiverMac !== undefined ? overrides.receiverMac : searchReceiverMac,
        repeaterId: overrides?.repeaterId !== undefined ? overrides.repeaterId : searchRepeaterId,
        alarmStatus: overrides?.alarmStatus !== undefined ? overrides.alarmStatus : searchAlarmStatus,
        status: overrides?.status !== undefined ? overrides.status : searchStatus,
      };
      const data = await RepeaterAPI.getList(query);
      setRepeaters(data);
      setCurrentPage(1);
    } catch (e: any) {
      console.error(e);
      if (e.message && e.message.includes('Could not find the table')) {
         console.warn('DB 테이블(repeaters)이 존재하지 않습니다. SQL 스크립트를 실행해주세요.');
      } else {
         alert('데이터 로드 실패: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepeaters();
  }, []);

  // --- Search Handlers ---
  const handleSearch = () => {
    setIsFiltered(true);
    fetchRepeaters();
  };

  const handleReset = () => {
    setSearchMarket('');
    setSearchReceiverMac('');
    setSearchRepeaterId('');
    setSearchAlarmStatus('');
    setSearchStatus('');
    setIsFiltered(false);
    fetchRepeaters({ marketName: '', receiverMac: '', repeaterId: '', alarmStatus: '', status: '' });
  };

  // --- List Actions ---
  const handleRegister = () => {
    setSelectedRepeater(null);
    setFormData({ 
        repeaterId: '01', 
        alarmStatus: '사용', 
        status: '사용',
        location: '' 
    });
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setView('form');
  };

  const handleEdit = (repeater: Repeater) => {
    setSelectedRepeater(repeater);
    setFormData({ ...repeater });
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setView('form');
  };

  const handleDelete = async () => {
    if (selectedRepeater && confirm('정말 삭제하시겠습니까?')) {
      try {
        await RepeaterAPI.delete(selectedRepeater.id);
        alert('삭제되었습니다.');
        setView('list');
        fetchRepeaters();
      } catch (e) {
        alert('삭제 실패');
      }
    }
  };

  const handleExcelRegister = () => {
    setExcelData([]);
    setExcelMarket(null);
    setView('excel');
  };

  // --- Form Handlers ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.marketId || !formData.receiverMac) { alert('R형 수신기를 선택해주세요.'); return; }
    if (!formData.repeaterId) { alert('중계기 ID를 선택해주세요.'); return; }

    try {
      let uploadedUrl = formData.image;
      if (imageFile) {
        uploadedUrl = await RepeaterAPI.uploadImage(imageFile);
      }

      const newRepeater: Repeater = {
        ...formData as Repeater,
        id: selectedRepeater?.id || 0,
        image: uploadedUrl
      };

      await RepeaterAPI.save(newRepeater);
      alert('저장되었습니다.');
      setView('list');
      fetchRepeaters();
    } catch (e: any) {
      console.error(e);
      alert(`저장 실패: ${e.message}`);
    }
  };

  // --- Image Logic ---
  const handleFileSelectClick = () => {
    if (formData.image || imageFile) {
      alert("등록된 이미지를 삭제해 주세요.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    if (confirm("이미지를 삭제하시겠습니까?")) {
      setFormData({ ...formData, image: undefined });
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFileName = () => {
    if (imageFile) return imageFile.name;
    if (formData.image) {
      try {
        const url = new URL(formData.image);
        return decodeURIComponent(url.pathname.split('/').pop() || 'image.jpg');
      } catch {
        return '중계기_이미지.jpg';
      }
    }
    return '';
  };

  const handleDownload = async () => {
    // 1. 방금 선택한 파일
    if (imageFile) {
        const url = URL.createObjectURL(imageFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = imageFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
    }

    // 2. 서버 파일
    if (formData.image) {
        try {
            const response = await fetch(formData.image);
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
            window.open(formData.image, '_blank');
        }
    }
  };

  // --- Receiver Search Modal Handlers ---
  const openReceiverModal = () => setIsReceiverModalOpen(true);

  const handleReceiverSelect = (receiver: Receiver) => {
    setFormData({ 
        ...formData, 
        marketId: receiver.marketId, 
        marketName: receiver.marketName,
        receiverMac: receiver.macAddress 
    });
    setIsReceiverModalOpen(false);
  };

  // --- Market Search Modal Handlers (Excel) ---
  const openMarketModal = () => setIsMarketModalOpen(true);

  const handleMarketSelect = (market: Market) => {
    setExcelMarket(market);
    setIsMarketModalOpen(false);
  };

  // --- Excel Logic ---
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!excelMarket) {
        alert('먼저 소속 시장을 선택해주세요.');
        e.target.value = ''; 
        return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsedData: Repeater[] = data.map((row: any) => ({
        id: 0,
        marketId: excelMarket.id,
        marketName: excelMarket.name,
        receiverMac: row['수신기MAC'] ? String(row['수신기MAC']) : '',
        repeaterId: row['중계기ID'] ? String(row['중계기ID']).padStart(2, '0') : '01',
        alarmStatus: row['경종사용여부'] || '사용',
        status: row['사용여부'] || '사용',
        location: row['설치위치'] || '',
      }));

      setExcelData(parsedData);
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelSave = async () => {
    if (excelData.length === 0) {
        alert('등록할 데이터가 없습니다.');
        return;
    }
    if (!excelMarket) {
        alert('소속 시장이 선택되지 않았습니다.');
        return;
    }

    try {
        await RepeaterAPI.saveBulk(excelData);
        alert(`${excelData.length}건이 성공적으로 등록되었습니다.`);
        setView('list');
        fetchRepeaters();
    } catch (e: any) {
        alert(`일괄 등록 실패: ${e.message}`);
    }
  };

  const handleSampleDownload = () => {
    const sampleData = [
      {
        '수신기MAC': '001A',
        '중계기ID': '01',
        '경종사용여부': '사용',
        '사용여부': '사용',
        '설치위치': '1층 복도'
      }
    ];
    exportToExcel(sampleData, '중계기_일괄등록_샘플양식');
  };

  // --- Columns ---
  const columns: Column<Repeater>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '수신기MAC', accessor: 'receiverMac', width: '150px' },
    { header: '중계기ID', accessor: 'repeaterId', width: '100px' },
    { header: '설치시장', accessor: 'marketName' },
    { header: '설치위치', accessor: 'location' },
    { header: '알람여부', accessor: (item) => <StatusBadge status={item.alarmStatus} />, width: '100px' },
    { header: '사용여부', accessor: (item) => <StatusBadge status={item.status} />, width: '100px' },
  ];

  // --- Pagination ---
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = repeaters.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(repeaters.length / ITEMS_PER_PAGE);

  // --- View: Form ---
  if (view === 'form') {
    return (
      <>
        <PageHeader title="중계기 관리" />
        <form onSubmit={handleSave}>
          <FormSection title={selectedRepeater ? "중계기 수정" : "중계기 등록"}>
            {/* R형 수신기 MAC */}
            <FormRow label="R형 수신기 MAC" required className="col-span-1 md:col-span-2">
              <div className="flex gap-2 w-full max-w-md">
                <div onClick={openReceiverModal} className="flex-1 relative cursor-pointer">
                  <input 
                    type="text"
                    value={formData.receiverMac || ''} 
                    placeholder="수신기를 선택하세요" 
                    readOnly 
                    className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
                  />
                  <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                </div>
                <Button type="button" variant="secondary" onClick={openReceiverModal}>검색</Button>
              </div>
              {formData.marketName && <p className="text-xs text-blue-400 mt-1">소속 시장: {formData.marketName}</p>}
            </FormRow>

            {/* 중계기 ID */}
            <FormRow label="중계기 ID">
              <SelectGroup 
                options={REPEATER_ID_OPTIONS}
                value={formData.repeaterId || '01'}
                onChange={(e) => setFormData({...formData, repeaterId: e.target.value})}
              />
            </FormRow>

            {/* 경종 사용여부 */}
            <FormRow label="경종 사용여부">
              <StatusRadioGroup 
                label=""
                name="alarmStatus"
                value={formData.alarmStatus} 
                onChange={(val) => setFormData({...formData, alarmStatus: val as any})}
              />
            </FormRow>

            {/* 사용여부 */}
            <FormRow label="사용여부">
              <StatusRadioGroup 
                label=""
                value={formData.status} 
                onChange={(val) => setFormData({...formData, status: val as any})}
              />
            </FormRow>

            {/* 설치 위치 (Full Width) */}
            <FormRow label="설치 위치" className="col-span-1 md:col-span-2">
                <InputGroup 
                    value={formData.location || ''} 
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
            </FormRow>

            {/* 이미지 수정 (수정 화면에서만) */}
            {selectedRepeater ? (
              <FormRow label="이미지수정" className="col-span-1 md:col-span-2">
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
                      
                      {(formData.image || imageFile) && (
                        <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded border border-slate-600 w-fit">
                          <Paperclip size={14} className="text-slate-400" />
                          <span 
                            onClick={handleDownload}
                            className={`text-sm ${formData.image || imageFile ? 'text-blue-400 cursor-pointer hover:underline' : 'text-slate-300'}`}
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
              </FormRow>
            ) : (
                <FormRow label="이미지" className="col-span-1 md:col-span-2">
                    <div className="flex items-center h-[42px] px-3 bg-slate-800/50 border border-slate-700 rounded text-slate-500 text-sm italic w-full">
                       신규 등록 시에는 이미지를 첨부할 수 없습니다. 등록 후 수정 단계에서 진행해 주세요.
                    </div>
                </FormRow>
            )}
          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
            <Button type="submit" variant="primary" className="w-32">{selectedRepeater ? '수정' : '신규등록'}</Button>
            <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">목록</Button>
          </div>
        </form>

        {/* Common Receiver Modal */}
        <ReceiverSearchModal
          isOpen={isReceiverModalOpen} 
          onClose={() => setIsReceiverModalOpen(false)} 
          onSelect={handleReceiverSelect}
        />
      </>
    );
  }

  // --- View: Excel ---
  if (view === 'excel') {
    return (
      <>
        <PageHeader title="중계기 관리" />
        <FormSection title="엑셀 일괄 등록">
            {/* 1. 소속 시장 선택 */}
            <FormRow label="소속 시장" required className="col-span-1 md:col-span-2">
               <div className="flex gap-2 w-full max-w-md">
                 <div onClick={openMarketModal} className="flex-1 relative cursor-pointer">
                    <input 
                       type="text"
                       value={excelMarket?.name || ''} 
                       placeholder="등록할 시장을 선택하세요" 
                       readOnly 
                       className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
                    />
                    <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                 </div>
                 <Button type="button" variant="secondary" onClick={openMarketModal}>찾기</Button>
               </div>
            </FormRow>

            {/* 2. 파일 선택 */}
            <FormRow label="엑셀 파일 선택" required className="col-span-1 md:col-span-2">
                <div className="flex flex-col gap-2">
                   <InputGroup 
                      type="file" 
                      accept=".xlsx, .xls"
                      onChange={handleExcelFileChange}
                      className="border-0 p-0 text-slate-300 w-full"
                   />
                   <p className="text-xs text-slate-400">
                     * 수신기MAC, 중계기ID(01~20), 경종사용여부, 사용여부, 설치위치 컬럼을 포함해야 합니다.
                   </p>
                </div>
            </FormRow>

            {/* 3. 샘플 다운로드 */}
            <FormRow label="샘플 양식" className="col-span-1 md:col-span-2">
                <Button type="button" variant="secondary" onClick={handleSampleDownload} icon={<Upload size={14} />}>
                   엑셀 샘플 다운로드
                </Button>
            </FormRow>
        </FormSection>

        {/* 미리보기 테이블 */}
        {excelData.length > 0 && (
          <div className="mt-8">
             <h3 className="text-lg font-bold text-slate-200 mb-2">등록 미리보기 ({excelData.length}건)</h3>
             <DataTable<Repeater> 
               columns={[
                  {header:'수신기MAC', accessor:'receiverMac'},
                  {header:'중계기ID', accessor:'repeaterId'},
                  {header:'설치시장', accessor:'marketName'},
                  {header:'설치위치', accessor:'location'},
                  {header:'경종사용여부', accessor:'alarmStatus'},
                  {header:'사용여부', accessor:'status'},
               ]}
               data={excelData.slice(0, 50)} 
             />
             {excelData.length > 50 && <p className="text-center text-slate-500 text-sm mt-2">...외 {excelData.length - 50}건</p>}
          </div>
        )}

        <div className="flex justify-center gap-3 mt-8">
            <Button type="button" variant="primary" onClick={handleExcelSave} className="w-32" disabled={excelData.length === 0}>일괄 등록</Button>
            <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
        </div>

        {/* Common Market Modal */}
        <MarketSearchModal 
          isOpen={isMarketModalOpen} 
          onClose={() => setIsMarketModalOpen(false)} 
          onSelect={handleMarketSelect} 
        />
      </>
    );
  }

  // --- View: List ---
  return (
    <>
      <PageHeader title="중계기 관리" />
      
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <InputGroup 
          label="설치시장" 
          value={searchMarket} 
          onChange={(e) => setSearchMarket(e.target.value)} 
        />
        <InputGroup 
          label="수신기MAC" 
          value={searchReceiverMac} 
          onChange={(e) => setSearchReceiverMac(e.target.value)} 
        />
        <InputGroup 
          label="중계기ID" 
          value={searchRepeaterId} 
          onChange={(e) => setSearchRepeaterId(e.target.value)} 
        />
        <SelectGroup
          label="경종사용여부"
          options={[{value: '', label: '전체'}, {value: '사용', label: '사용'}, {value: '미사용', label: '미사용'}]}
          value={searchAlarmStatus}
          onChange={(e) => setSearchAlarmStatus(e.target.value)}
        />
        <SelectGroup
          label="사용여부"
          options={[{value: '', label: '전체'}, {value: '사용', label: '사용'}, {value: '미사용', label: '미사용'}]}
          value={searchStatus}
          onChange={(e) => setSearchStatus(e.target.value)}
        />
      </SearchFilterBar>

      <div className="flex justify-between items-center mb-2">
         <span className="text-sm text-slate-400">
           전체 {repeaters.length} 개 (페이지 {currentPage})
         </span>
         <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16} />}>엑셀 신규 등록</Button>
            <Button variant="primary" onClick={handleRegister}>신규 등록</Button>
         </div>
      </div>

      <DataTable columns={columns} data={currentItems} onRowClick={handleEdit} />
      
      <Pagination 
        totalItems={repeaters.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  );
};