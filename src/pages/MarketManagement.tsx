import React, { useState, useEffect } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, 
  Button, DataTable, Pagination, ActionBar, FormSection, FormRow, Column, AddressInput,
  formatPhoneNumber, StatusBadge
} from '../components/CommonUI';
import { Market } from '../types';
import { MarketAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';

const ITEMS_PER_PAGE = 10;

export const MarketManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);

  // 검색 상태 관리
  const [searchName, setSearchName] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [searchManager, setSearchManager] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);
  
  // 폼 입력 상태 (Form Input State)
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAddressDetail, setFormAddressDetail] = useState('');
  const [formManagerName, setFormManagerName] = useState('');
  const [formManagerPhone, setFormManagerPhone] = useState('');
  
  const fetchMarkets = async (overrides?: { name?: string, address?: string, managerName?: string }) => {
    setLoading(true);
    try {
      const query = {
        name: overrides?.name !== undefined ? overrides.name : searchName,
        address: overrides?.address !== undefined ? overrides.address : searchAddress,
        managerName: overrides?.managerName !== undefined ? overrides.managerName : searchManager
      };

      const data = await MarketAPI.getList(query);
      setMarkets(data);
      setCurrentPage(1);
    } catch (e) {
      alert('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  // 검색
  const handleSearch = () => {
    setIsFiltered(true);
    fetchMarkets();
  };

  // 초기화 (전체보기)
  const handleReset = () => {
    setSearchName('');
    setSearchAddress('');
    setSearchManager('');
    setIsFiltered(false);
    fetchMarkets({ name: '', address: '', managerName: '' });
  };

  const handleRegister = () => { 
    setSelectedMarket(null);
    // 폼 초기화
    setFormName('');
    setFormAddress('');
    setFormAddressDetail('');
    setFormManagerName('');
    setFormManagerPhone('');
    setView('form'); 
  };
  
  const handleEdit = (market: Market) => { 
    setSelectedMarket(market);
    // 폼 데이터 바인딩
    setFormName(market.name);
    setFormAddress(market.address);
    setFormAddressDetail(market.addressDetail || '');
    setFormManagerName(market.managerName || '');
    setFormManagerPhone(market.managerPhone || '');
    setView('form'); 
  };
  
  const handleExcel = () => {
    const excelData = markets.map((m, index) => ({
      'No': index + 1,
      '시장명': m.name,
      '주소': `${m.address} ${m.addressDetail || ''}`.trim(),
      '담당자명': m.managerName,
      '담당자연락처': m.managerPhone,
      '상태': m.status
    }));
    exportToExcel(excelData, '시장관리_목록');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formName) { alert('시장명을 입력해주세요.'); return; }
    if (!formAddress) { alert('주소를 입력해주세요.'); return; }

    // 폼 데이터 구성
    const newMarket: Market = {
      id: selectedMarket?.id || 0,
      name: formName,
      address: formAddress, 
      addressDetail: formAddressDetail, // 상세 주소 저장
      managerName: formManagerName,
      managerPhone: formManagerPhone,
      status: selectedMarket?.status || 'Normal',
    };

    try {
      await MarketAPI.save(newMarket);
      alert('저장되었습니다.');
      setView('list');
      fetchMarkets();
    } catch (e) {
      alert('저장 실패');
    }
  };

  const columns: Column<Market>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '시장명', accessor: 'name' },
    { header: '주소', accessor: (m) => `${m.address} ${m.addressDetail || ''}` },
    { header: '담당자명', accessor: 'managerName' },
    { header: '담당자연락처', accessor: (m) => formatPhoneNumber(m.managerPhone || '') },
    { header: '상태', accessor: (m: Market) => <StatusBadge status={m.status} />, width: '120px' },
  ];

  // -- Pagination Logic --
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = markets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(markets.length / ITEMS_PER_PAGE);

  if (view === 'form') {
    return (
      <>
        <PageHeader title={selectedMarket ? "시장 수정" : "시장 등록"} />
        <form onSubmit={handleSave}>
          <FormSection title="시장 정보">
              <FormRow label="시장명" required>
                <InputGroup 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)} 
                  required 
                />
              </FormRow>
              
              {/* AddressInput 컴포넌트 사용 (공통 UI/규칙 적용) */}
              <div className="col-span-1 md:col-span-2">
                <AddressInput 
                   label="주소"
                   required
                   address={formAddress}
                   addressDetail={formAddressDetail}
                   onAddressChange={setFormAddress}
                   onDetailChange={setFormAddressDetail}
                />
              </div>

              <FormRow label="위도">
                 <InputGroup placeholder="위도" />
              </FormRow>

              <FormRow label="경도">
                 <InputGroup placeholder="경도" />
              </FormRow>

              <FormRow label="담당자명">
                <InputGroup 
                  value={formManagerName} 
                  onChange={(e) => setFormManagerName(e.target.value)} 
                />
              </FormRow>

              <FormRow label="담당자 연락처">
                <InputGroup 
                  value={formManagerPhone} 
                  onChange={(e) => setFormManagerPhone(e.target.value)} 
                />
              </FormRow>

              <FormRow label="시장지도 이미지" className="col-span-1 md:col-span-2">
                 <div className="flex gap-2 w-full">
                    <InputGroup type="file" className="border-0 p-0 text-slate-300 flex-1" />
                    <Button type="button" variant="secondary">업로드</Button>
                 </div>
                 <p className="text-xs text-slate-500 mt-1">최대 10MB, jpg/png/gif 지원</p>
              </FormRow>
          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
             <Button type="submit" variant="primary" className="w-32">{selectedMarket ? '수정' : '등록'}</Button>
             <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <PageHeader title="시장 관리" />
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <InputGroup 
          label="시장명" 
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="시장명 입력" 
        />
        <InputGroup 
          label="주소" 
          value={searchAddress}
          onChange={(e) => setSearchAddress(e.target.value)}
          placeholder="주소 입력" 
        />
        <InputGroup 
          label="담당자" 
          value={searchManager}
          onChange={(e) => setSearchManager(e.target.value)}
          placeholder="담당자 입력" 
        />
      </SearchFilterBar>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-400">
          전체 <span className="text-blue-400">{markets.length}</span> 건
          (페이지 {currentPage}/{totalPages || 1})
        </span>
        <ActionBar onRegister={handleRegister} onExcel={handleExcel} />
      </div>
      {loading ? (
        <div className="text-center py-20 text-slate-500">Loading...</div>
      ) : (
        <DataTable columns={columns} data={currentItems} onRowClick={handleEdit} />
      )}
      <Pagination 
        totalItems={markets.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  );
};