import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, SelectGroup, Button, DataTable, 
  Pagination, FormSection, FormRow, Column, UI_STYLES,
  StatusBadge, StatusRadioGroup, MarketSearchModal,
  formatPhoneNumber, handlePhoneKeyDown 
} from '../components/CommonUI';
import { Receiver, Market } from '../types';
import { ReceiverAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';
import { Search, X, Paperclip, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;

// 데이터 전송 주기 옵션 (01시간 ~ 23시간)
const INTERVAL_OPTIONS = Array.from({ length: 23 }, (_, i) => {
  const val = String(i + 1).padStart(2, '0');
  return { value: `${val}시간`, label: `${val}시간` };
});

export const ReceiverManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState<Receiver | null>(null);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Search Filters
  const [searchMarket, setSearchMarket] = useState('');
  const [searchMac, setSearchMac] = useState('');
  const [searchIp, setSearchIp] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

  // Form Data
  const [formData, setFormData] = useState<Partial<Receiver>>({});
  const [selectedMarketForForm, setSelectedMarketForForm] = useState<Market | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common Modals
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);

  // Excel Upload
  const [excelData, setExcelData] = useState<Receiver[]>([]);
  const [excelMarket, setExcelMarket] = useState<Market | null>(null);

  // --- Initial Data Load ---
  const fetchReceivers = async (overrides?: { marketName?: string, macAddress?: string, ip?: string, emergencyPhone?: string }) => {
    setLoading(true);
    try {
      const query = {
        marketName: overrides?.marketName !== undefined ? overrides.marketName : searchMarket,
        macAddress: overrides?.macAddress !== undefined ? overrides.macAddress : searchMac,
        ip: overrides?.ip !== undefined ? overrides.ip : searchIp,
        emergencyPhone: overrides?.emergencyPhone !== undefined ? overrides.emergencyPhone : searchPhone,
      };
      const data = await ReceiverAPI.getList(query);
      setReceivers(data);
      setCurrentPage(1);
    } catch (e: any) {
      console.error(e);
      if (e.message && e.message.includes('Could not find the table')) {
         console.warn('DB 테이블(receivers)이 존재하지 않습니다. SQL 스크립트를 실행해주세요.');
      } else {
         alert('데이터 로드 실패: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceivers();
  }, []);

  // --- Search Handlers ---
  const handleSearch = () => {
    setIsFiltered(true);
    fetchReceivers();
  };

  const handleReset = () => {
    setSearchMarket('');
    setSearchMac('');
    setSearchIp('');
    setSearchPhone('');
    setIsFiltered(false);
    fetchReceivers({ marketName: '', macAddress: '', ip: '', emergencyPhone: '' });
  };

  // --- List Actions ---
  const handleRegister = () => {
    setSelectedReceiver(null);
    setFormData({ transmissionInterval: '01시간', status: '사용' });
    setSelectedMarketForForm(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setView('form');
  };

  const handleEdit = (receiver: Receiver) => {
    setSelectedReceiver(receiver);
    setFormData({ ...receiver });
    setSelectedMarketForForm({ id: receiver.marketId, name: receiver.marketName || '' } as Market);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setView('form');
  };

  const handleDelete = async () => {
    if (selectedReceiver && confirm('정말 삭제하시겠습니까?')) {
      try {
        await ReceiverAPI.delete(selectedReceiver.id);
        alert('삭제되었습니다.');
        setView('list');
        fetchReceivers();
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

  const handleExcelDownload = () => {
    const exportData = receivers.map((r, idx) => ({
      'No': idx + 1,
      'MAC주소': r.macAddress,
      '설치시장': r.marketName,
      'IP주소': r.ip,
      '전화번호': r.emergencyPhone,
      'DNS': r.dns,
      '송신주기': r.transmissionInterval,
      '사용여부': r.status
    }));
    exportToExcel(exportData, 'R형수신기_목록');
  };

  // --- Form Handlers ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.marketId) { alert('설치 시장을 선택해주세요.'); return; }
    if (!formData.macAddress) { alert('MAC ADDRESS를 입력해주세요.'); return; }

    try {
      let uploadedUrl = formData.image;
      if (imageFile) {
        uploadedUrl = await ReceiverAPI.uploadImage(imageFile);
      }

      const newReceiver: Receiver = {
        ...formData as Receiver,
        id: selectedReceiver?.id || 0,
        image: uploadedUrl
      };

      await ReceiverAPI.save(newReceiver);
      alert('저장되었습니다.');
      setView('list');
      fetchReceivers();
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
        return '수신기_이미지.jpg';
      }
    }
    return '';
  };

  const handleDownload = () => {
    if (formData.image) {
      window.open(formData.image, '_blank');
    }
  };

  // --- Market Modal Handlers ---
  const openMarketModal = () => setIsMarketModalOpen(true);

  const handleMarketSelect = (market: Market) => {
    if (view === 'form') {
      setSelectedMarketForForm(market);
      setFormData({ ...formData, marketId: market.id });
    } else if (view === 'excel') {
      setExcelMarket(market);
    }
    setIsMarketModalOpen(false);
  };

  // --- Excel Logic ---
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!excelMarket) {
        alert('먼저 소속 시장을 선택해주세요.');
        e.target.value = ''; // reset
        return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsedData: Receiver[] = data.map((row: any) => ({
        id: 0,
        marketId: excelMarket.id,
        marketName: excelMarket.name,
        macAddress: row['MAC주소'] ? String(row['MAC주소']) : '',
        ip: row['IP주소'] || '',
        emergencyPhone: row['속보전화번호'] || '',
        dns: row['DNS'] || '',
        transmissionInterval: row['데이터전송주기'] || '01시간',
        status: row['사용여부'] || '사용',
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
        await ReceiverAPI.saveBulk(excelData);
        alert(`${excelData.length}건이 성공적으로 등록되었습니다.`);
        setView('list');
        fetchReceivers();
    } catch (e: any) {
        alert(`일괄 등록 실패: ${e.message}`);
    }
  };

  const handleSampleDownload = () => {
    const sampleData = [
      {
        'MAC주소': '00:1A:2B:3C:4D:5E',
        'IP주소': '192.168.0.100',
        '속보전화번호': '010-1234-5678',
        'DNS': '8.8.8.8',
        '데이터전송주기': '01시간',
        '사용여부': '사용'
      }
    ];
    exportToExcel(sampleData, 'R형수신기_일괄등록_샘플양식');
  };

  // --- Columns ---
  const columns: Column<Receiver>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '80px' },
    { header: 'MAC주소', accessor: 'macAddress', width: '200px' },
    { header: '설치시장', accessor: 'marketName' }, // 나머지 공간 차지
    { header: 'IP주소', accessor: 'ip', width: '200px' },
    { header: '전화번호', accessor: (r) => formatPhoneNumber(r.emergencyPhone) || '-', width: '200px' }, // Formatted
    { header: 'DNS', accessor: 'dns', width: '200px' },
    { header: '송신주기', accessor: 'transmissionInterval', width: '150px' },
    { header: '사용여부', accessor: (item) => <StatusBadge status={item.status} />, width: '120px' },
  ];

  // --- Pagination ---
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = receivers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(receivers.length / ITEMS_PER_PAGE);

  // --- View: Form ---
  if (view === 'form') {
    return (
      <>
        <PageHeader title="R형 수신기 관리" />
        <form onSubmit={handleSave}>
          <FormSection title={selectedReceiver ? "R형 수신기 수정" : "R형 수신기 등록"}>
            {/* MAC ADDRESS (Full Width) */}
            <FormRow label="MAC ADDRESS" required className="col-span-1 md:col-span-2">
              <InputGroup 
                value={formData.macAddress || ''} 
                onChange={(e) => setFormData({...formData, macAddress: e.target.value})}
              />
            </FormRow>

            {/* IP, 속보전화번호 */}
            <FormRow label="IP">
              <InputGroup 
                value={formData.ip || ''} 
                onChange={(e) => setFormData({...formData, ip: e.target.value})}
              />
            </FormRow>
            <FormRow label="속보전화번호">
              <InputGroup 
                value={formData.emergencyPhone || ''} 
                onChange={(e) => setFormData({...formData, emergencyPhone: e.target.value.replace(/[^0-9]/g, '')})}
                onKeyDown={handlePhoneKeyDown}
                inputMode="numeric"
                placeholder="숫자만 입력하세요"
                maxLength={11}
              />
            </FormRow>

            {/* DNS */}
            <FormRow label="DNS" className="col-span-1 md:col-span-2">
              <InputGroup 
                value={formData.dns || ''} 
                onChange={(e) => setFormData({...formData, dns: e.target.value})}
              />
            </FormRow>

            {/* 설치 시장 */}
            <FormRow label="설치 시장" required className="col-span-1 md:col-span-2">
              <div className="flex gap-2 w-full">
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
            </FormRow>

            {/* 이미지 수정 (수정 화면에서만) */}
            {selectedReceiver ? (
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
                            className={`text-sm ${formData.image ? 'text-blue-400 cursor-pointer hover:underline' : 'text-slate-300'}`}
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

            {/* Data전송주기 */}
            <FormRow label="Data전송주기">
              <SelectGroup 
                options={INTERVAL_OPTIONS}
                value={formData.transmissionInterval || '01시간'}
                onChange={(e) => setFormData({...formData, transmissionInterval: e.target.value})}
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
          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
            <Button type="submit" variant="primary" className="w-32">{selectedReceiver ? '수정' : '신규등록'}</Button>
            <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">목록</Button>
          </div>
        </form>

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
      <PageHeader title="R형 수신기 관리" />
      
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <InputGroup 
          label="설치시장" 
          value={searchMarket} 
          onChange={(e) => setSearchMarket(e.target.value)} 
        />
        <InputGroup 
          label="MAC주소" 
          value={searchMac} 
          onChange={(e) => setSearchMac(e.target.value)} 
        />
        <InputGroup 
          label="IP" 
          value={searchIp} 
          onChange={(e) => setSearchIp(e.target.value)} 
        />
        <InputGroup 
          label="속보전화" 
          value={searchPhone} 
          onChange={(e) => setSearchPhone(e.target.value)} 
        />
      </SearchFilterBar>

      <div className="flex justify-between items-center mb-2">
         <span className="text-sm text-slate-400">
           전체 {receivers.length} 개 (페이지 {currentPage})
         </span>
         <div className="flex gap-2">
            <Button variant="primary" onClick={handleRegister}>신규 등록</Button>
            <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16} />}>엑셀 신규 등록</Button>
            <Button variant="success" onClick={handleExcelDownload} icon={<Paperclip size={16} />}>엑셀 다운로드</Button>
         </div>
      </div>

      <DataTable columns={columns} data={currentItems} onRowClick={handleEdit} />
      
      <Pagination 
        totalItems={receivers.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  );
};