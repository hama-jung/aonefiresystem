import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, InputGroup, 
  Button, DataTable, Pagination, FormSection, FormRow, Modal, UI_STYLES, AddressInput,
  formatPhoneNumber, StatusBadge, StatusRadioGroup, Column
} from '../components/CommonUI';
import { Store, Market } from '../types';
import { StoreAPI, MarketAPI } from '../services/api';
import { Search, FileSpreadsheet, Upload, Plus } from 'lucide-react';
import { exportToExcel } from '../utils/excel';

const ITEMS_PER_PAGE = 10;

export const StoreManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Search States matching the UI image
  const [searchStore, setSearchStore] = useState('');
  const [searchMarket, setSearchMarket] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  
  const [formData, setFormData] = useState<Partial<Store>>({ status: '사용' });
  const [selectedMarketName, setSelectedMarketName] = useState('');
  const [storeImageFile, setStoreImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [marketList, setMarketList] = useState<Market[]>([]);
  const [marketSearchName, setMarketSearchName] = useState('');

  const fetchStores = async () => {
    setLoading(true);
    try {
      const data = await StoreAPI.getList({ 
          storeName: searchStore,
          marketName: searchMarket,
          address: searchAddress
      });
      setStores(data);
      setCurrentPage(1); // Reset to first page on search
    } catch (e) { alert('데이터 로드 실패'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStores(); }, []);

  const handleSearch = () => {
      fetchStores();
  };

  const handleRegister = () => {
    setSelectedStore(null);
    setFormData({ status: '사용', mode: '복합', marketId: 0 }); 
    setSelectedMarketName('');
    setStoreImageFile(null);
    setView('form');
  };

  const handleEdit = (store: Store) => {
    setSelectedStore(store);
    setFormData({ ...store });
    setSelectedMarketName(store.marketName || '-');
    setView('form');
  };

  const openMarketModal = async () => {
    const data = await MarketAPI.getList({ name: marketSearchName });
    setMarketList(data);
    setIsMarketModalOpen(true);
  };

  const handleMarketSelect = (market: Market) => {
    setFormData(prev => ({ ...prev, marketId: market.id }));
    setSelectedMarketName(market.name);
    setIsMarketModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.marketId) { alert('소속 시장을 선택해주세요.'); return; }
    if (!formData.name) { alert('상가명을 입력해주세요.'); return; }

    try {
      let uploadedUrl = formData.storeImage;
      if (storeImageFile) {
        uploadedUrl = await StoreAPI.uploadStoreImage(storeImageFile);
      }

      const finalData: Store = {
        ...formData as Store,
        id: selectedStore?.id || 0,
        storeImage: uploadedUrl,
      };

      await StoreAPI.save(finalData);
      alert('저장되었습니다.');
      setView('list');
      fetchStores();
    } catch (e: any) { alert(`저장 실패: ${e.message}`); }
  };

  const handleExcelDownload = () => {
      const excelData = stores.map((s, index) => ({
          'No': index + 1,
          '소속시장': s.marketName,
          '상가명': s.name,
          '대표자': s.managerName,
          '대표자연락처': s.managerPhone,
          '주소': `${s.address || ''} ${s.addressDetail || ''}`,
          '상태': s.status
      }));
      exportToExcel(excelData, '기기관리_상가_목록');
  };

  const marketColumns: Column<Market>[] = [
    { header: '시장명', accessor: 'name' },
    { header: '주소', accessor: 'address' },
    { header: '선택', accessor: (m) => <Button onClick={() => handleMarketSelect(m)} variant="primary" className="px-2 py-1 text-xs">선택</Button> }
  ];

  // Table columns strictly matching the image
  const storeColumns: Column<Store>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '소속시장', accessor: 'marketName' },
    { header: '상가명', accessor: 'name' },
    { header: '대표자', accessor: (s) => s.managerName || '-' },
    { header: '대표자연락처', accessor: (s) => formatPhoneNumber(s.managerPhone || '') || '-' },
    { header: '상태', accessor: (s) => <StatusBadge status={s.status} />, width: '100px' },
  ];

  // Pagination Logic
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = stores.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(stores.length / ITEMS_PER_PAGE);

  if (view === 'form') {
    return (
      <>
        <PageHeader title="기기 관리 (상가)" />
        <form onSubmit={handleSave}>
          <FormSection title={selectedStore ? "기기 수정" : "기기 등록"}>
            {/* 소속 시장 */}
            <FormRow label="소속 시장" required>
               <div className="flex gap-2 w-full">
                 <div onClick={openMarketModal} className="flex-1 relative cursor-pointer">
                    <input 
                       type="text"
                       value={selectedMarketName} 
                       placeholder="시장 선택" 
                       readOnly 
                       className={`${UI_STYLES.input} cursor-pointer pr-8`}
                    />
                    <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                 </div>
                 <Button type="button" variant="secondary" onClick={openMarketModal}>찾기</Button>
               </div>
            </FormRow>

            {/* 상가명 */}
            <FormRow label="상가명" required>
               <InputGroup value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="상가명 입력" />
            </FormRow>

            {/* 주소 (Full Width) */}
            <div className="col-span-1 md:col-span-2">
              <AddressInput 
                 label="주소"
                 address={formData.address || ''}
                 addressDetail={formData.addressDetail || ''}
                 onAddressChange={(val) => setFormData(prev => ({...prev, address: val}))}
                 onDetailChange={(val) => setFormData(prev => ({...prev, addressDetail: val}))}
                 onCoordinateChange={(lat, lng) => setFormData(prev => ({...prev, latitude: lat, longitude: lng}))}
              />
            </div>

            {/* 대표자 정보 */}
            <FormRow label="대표자">
               <InputGroup value={formData.managerName || ''} onChange={(e) => setFormData({...formData, managerName: e.target.value})} />
            </FormRow>
            <FormRow label="대표자 연락처">
               <InputGroup 
                 value={formData.managerPhone || ''} 
                 onChange={(e) => setFormData({...formData, managerPhone: e.target.value.replace(/[^0-9]/g, '')})} 
                 placeholder="숫자만 입력"
                 maxLength={11}
               />
            </FormRow>

            {/* 기기 정보 */}
            <FormRow label="수신기 MAC">
               <InputGroup value={formData.receiverMac || ''} onChange={(e) => setFormData({...formData, receiverMac: e.target.value})} maxLength={4} />
            </FormRow>
            <FormRow label="중계기 ID">
               <InputGroup value={formData.repeaterId || ''} onChange={(e) => setFormData({...formData, repeaterId: e.target.value})} maxLength={2} />
            </FormRow>

            {/* 사용여부 (Full Width) */}
            <FormRow label="사용여부" className="col-span-1 md:col-span-2">
               <StatusRadioGroup label="" value={formData.status} onChange={(val) => setFormData({...formData, status: val as any})} />
            </FormRow>
          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
             <Button type="submit" variant="primary" className="w-32">{selectedStore ? '수정' : '등록'}</Button>
             <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
          </div>
        </form>

        <Modal isOpen={isMarketModalOpen} onClose={() => setIsMarketModalOpen(false)} title="시장 찾기" width="max-w-2xl">
           <div className="p-4 flex gap-2">
              <InputGroup label="시장명" value={marketSearchName} onChange={(e) => setMarketSearchName(e.target.value)} />
              <Button onClick={openMarketModal} className="mt-7">검색</Button>
           </div>
           <DataTable<Market> 
             columns={marketColumns}
             data={marketList}
           />
        </Modal>
      </>
    );
  }

  return (
    <>
      <PageHeader title="기기 관리" />
      
      {/* Search Filter Bar - Match Design: 3 Fields + Search Button */}
      <div className="bg-slate-800 p-5 rounded-lg border border-slate-700 shadow-sm mb-5">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="flex-1 w-full lg:w-auto">
                <InputGroup label="상가명" value={searchStore} onChange={(e) => setSearchStore(e.target.value)} placeholder="상가명 입력" />
            </div>
            <div className="flex-1 w-full lg:w-auto">
                <InputGroup label="소속시장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} placeholder="시장명 입력" />
            </div>
            <div className="flex-1 w-full lg:w-auto">
                <InputGroup label="주소" value={searchAddress} onChange={(e) => setSearchAddress(e.target.value)} placeholder="주소 입력" />
            </div>
            <div className="w-full lg:w-auto">
                <Button onClick={handleSearch} icon={<Search size={18} />} className="w-full lg:w-32 h-[42px] bg-blue-600 hover:bg-blue-500">검색</Button>
            </div>
        </div>
      </div>

      {/* Action Bar - Match Design: Count left, 3 Buttons right */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
        <span className="text-sm text-slate-400 font-medium">
          전체 <span className="text-blue-400 font-bold">{stores.length}</span> 건 (페이지 {currentPage})
        </span>
        <div className="flex gap-2">
            <Button variant="primary" onClick={handleRegister} icon={<Plus size={16}/>} className="bg-blue-600 hover:bg-blue-500">신규 등록</Button>
            <Button variant="secondary" onClick={() => {}} icon={<Upload size={16}/>} className="bg-slate-700 border-slate-600 text-slate-200">엑셀 신규 등록</Button>
            <Button variant="success" onClick={handleExcelDownload} icon={<FileSpreadsheet size={16}/>} className="bg-green-600 hover:bg-green-500">엑셀 다운로드</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">데이터를 불러오는 중입니다...</div>
      ) : (
        <DataTable<Store> 
            columns={storeColumns}
            data={currentItems}
            onRowClick={handleEdit} 
        />
      )}
      
      <Pagination 
        totalItems={stores.length} 
        itemsPerPage={ITEMS_PER_PAGE} 
        currentPage={currentPage} 
        onPageChange={setCurrentPage} 
      />
    </>
  );
};