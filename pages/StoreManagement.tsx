
import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, 
  Button, DataTable, Pagination, FormSection, FormRow, Modal, UI_STYLES, AddressInput,
  formatPhoneNumber, StatusBadge, StatusRadioGroup
} from '../components/CommonUI';
import { Store, Market } from '../types';
import { StoreAPI, MarketAPI } from '../services/api';
import { Search } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

export const StoreManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [searchStore, setSearchStore] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

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
      const data = await StoreAPI.getList({ storeName: searchStore });
      setStores(data);
    } catch (e) { alert('데이터 로드 실패'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStores(); }, []);

  const handleRegister = () => {
    setSelectedStore(null);
    setFormData({ status: '사용', mode: '복합', marketId: 0 });
    setSelectedMarketName('');
    setStoreImageFile(null);
    setView('form');
  };

  const handleEdit = (store: Store) => {
    setSelectedStore(store);
    
    // [FIX] marketId 필드가 남아있지 않도록 필요한 데이터만 골라서 상태에 담음
    const { 
      id, name, managerName, managerPhone, status, storeImage, memo, 
      receiverMac, repeaterId, detectorId, mode, address, addressDetail, 
      latitude, longitude, handlingItems, marketId 
    } = store;

    setFormData({ 
      id, name, managerName, managerPhone, status, storeImage, memo, 
      receiverMac, repeaterId, detectorId, mode, address, addressDetail, 
      latitude, longitude, handlingItems, marketId 
    });
    
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

  if (view === 'form') {
    return (
      <>
        <PageHeader title="기기 관리 (상가)" />
        <form onSubmit={handleSave}>
          <FormSection title={selectedStore ? "기기 수정" : "기기 등록"}>
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

            <FormRow label="상가명" required>
               <InputGroup value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="상가명 입력" />
            </FormRow>

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

            <FormRow label="수신기 MAC">
               <InputGroup value={formData.receiverMac || ''} onChange={(e) => setFormData({...formData, receiverMac: e.target.value})} maxLength={4} />
            </FormRow>
            <FormRow label="중계기 ID">
               <InputGroup value={formData.repeaterId || ''} onChange={(e) => setFormData({...formData, repeaterId: e.target.value})} maxLength={2} />
            </FormRow>

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
           <SearchFilterBar onSearch={openMarketModal}>
              <InputGroup label="시장명" value={marketSearchName} onChange={(e) => setMarketSearchName(e.target.value)} />
           </SearchFilterBar>
           <DataTable 
             columns={[
               { header: '시장명', accessor: 'name' },
               { header: '주소', accessor: 'address' },
               { header: '선택', accessor: (m) => <Button onClick={() => handleMarketSelect(m)} variant="primary" className="px-2 py-1 text-xs">선택</Button> }
             ]}
             data={marketList}
           />
        </Modal>
      </>
    );
  }

  return (
    <>
      <PageHeader title="기기 관리 (상가)" />
      <SearchFilterBar onSearch={() => { setIsFiltered(true); fetchStores(); }} onReset={() => { setSearchStore(''); setIsFiltered(false); fetchStores(); }}>
        <InputGroup label="상가명" value={searchStore} onChange={(e) => setSearchStore(e.target.value)} />
      </SearchFilterBar>
      <DataTable 
        columns={[
          { header: 'No', accessor: 'id', width: '60px' },
          { header: '소속시장', accessor: 'marketName' },
          { header: '상가명', accessor: 'name' },
          { header: '대표자', accessor: 'managerName' },
          { header: '연락처', accessor: (s) => formatPhoneNumber(s.managerPhone || '') },
          { header: '상태', accessor: (s) => <StatusBadge status={s.status} /> },
        ]} 
        data={stores.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)} 
        onRowClick={handleEdit} 
      />
      <Pagination totalItems={stores.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
    </>
  );
};
