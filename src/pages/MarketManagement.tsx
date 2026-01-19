import React, { useState, useEffect } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, SelectGroup,
  Button, DataTable, Pagination, ActionBar, FormSection, FormRow, Column, AddressInput, UI_STYLES
} from '../components/CommonUI';
import { Market, Distributor } from '../types';
import { MarketAPI, DistributorAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';

const ITEMS_PER_PAGE = 10;

export const MarketManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 총판 목록 (드롭다운용)
  const [distributorOptions, setDistributorOptions] = useState<{value: string | number, label: string}[]>([]);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);

  // 검색 상태 관리
  const [searchName, setSearchName] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [searchManager, setSearchManager] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);
  
  // --- 폼 입력 상태 (Form Input State) ---
  // 기본 정보
  const [formData, setFormData] = useState<Partial<Market>>({});
  
  // SMS 목록 관리 (Edit Mode 전용)
  const [smsFireList, setSmsFireList] = useState<string[]>([]);
  const [smsFaultList, setSmsFaultList] = useState<string[]>([]);
  const [tempSmsFire, setTempSmsFire] = useState('');
  const [tempSmsFault, setTempSmsFault] = useState('');

  // 초기 데이터 로드 (시장 목록 + 총판 목록)
  const initData = async () => {
    setLoading(true);
    try {
      // 1. 시장 목록 로드
      const mData = await MarketAPI.getList();
      setMarkets(mData);

      // 2. 총판 목록 로드 ('사용' 중인 총판만)
      const dData = await DistributorAPI.getList();
      const activeDistributors = dData
        .filter(d => d.status === '사용')
        .map(d => ({ value: d.id, label: d.name }));
      
      setDistributorOptions([{ value: '', label: '총판 선택' }, ...activeDistributors]);

    } catch (e) {
      alert('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initData();
  }, []);

  // 시장 목록 조회 (검색 시)
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
      alert('목록 갱신 실패');
    } finally {
      setLoading(false);
    }
  };

  // 검색 핸들러
  const handleSearch = () => {
    setIsFiltered(true);
    fetchMarkets();
  };

  const handleReset = () => {
    setSearchName('');
    setSearchAddress('');
    setSearchManager('');
    setIsFiltered(false);
    fetchMarkets({ name: '', address: '', managerName: '' });
  };

  // --- Form Handlers ---
  const handleRegister = () => { 
    setSelectedMarket(null);
    // 폼 초기화 (기본값 설정)
    setFormData({
      distributorId: undefined,
      name: '',
      address: '',
      addressDetail: '',
      latitude: '',
      longitude: '',
      managerName: '',
      managerPhone: '',
      managerEmail: '',
      memo: '',
      enableMarketSms: '사용',
      enableStoreSms: '사용',
      enableMultiMedia: '사용',
      multiMediaType: '복합',
      usageStatus: '사용',
      enableDeviceFaultSms: '사용',
      enableCctvUrl: '사용',
      status: 'Normal'
    });
    setSmsFireList([]);
    setSmsFaultList([]);
    setView('form'); 
  };
  
  const handleEdit = (market: Market) => { 
    setSelectedMarket(market);
    setFormData({ ...market });
    setSmsFireList(market.smsFire || []);
    setSmsFaultList(market.smsFault || []);
    setView('form'); 
  };
  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 필수값 검증 (총판, 시장명, 주소)
    if (!formData.distributorId) { alert('총판을 선택해주세요.'); return; }
    if (!formData.name) { alert('시장명을 입력해주세요.'); return; }
    if (!formData.address) { alert('주소를 입력해주세요.'); return; }

    // 선택 입력 항목의 빈 문자열 처리
    // DB의 숫자 필드나 날짜 필드 등에 빈 문자열이 들어가면 오류가 발생할 수 있으므로
    // 값이 없는 경우(빈 문자열 등) undefined나 null로 변환하여 전송합니다.
    const cleanFormData = { ...formData };
    if (cleanFormData.latitude === '') cleanFormData.latitude = undefined;
    if (cleanFormData.longitude === '') cleanFormData.longitude = undefined;
    if (cleanFormData.managerName === '') cleanFormData.managerName = undefined;
    if (cleanFormData.managerPhone === '') cleanFormData.managerPhone = undefined;
    if (cleanFormData.managerEmail === '') cleanFormData.managerEmail = undefined;
    if (cleanFormData.memo === '') cleanFormData.memo = undefined;

    const newMarket: Market = {
      ...cleanFormData as Market,
      id: selectedMarket?.id || 0,
      smsFire: smsFireList,
      smsFault: smsFaultList,
      // operational status는 기존 값 유지하거나 Normal로 초기화
      status: selectedMarket?.status || 'Normal',
    };

    try {
      await MarketAPI.save(newMarket);
      alert('저장되었습니다.');
      setView('list');
      fetchMarkets();
    } catch (e: any) {
      console.error(e);
      // 에러 메시지를 사용자에게 보여줌으로써 원인 파악 용이
      alert(`저장 실패: ${e.message || '알 수 없는 오류가 발생했습니다.'}`);
    }
  };

  // SMS 목록 추가/삭제 핸들러
  const addSms = (type: 'fire' | 'fault') => {
    if (type === 'fire') {
        if(tempSmsFire) {
            setSmsFireList([...smsFireList, tempSmsFire]);
            setTempSmsFire('');
        }
    } else {
        if(tempSmsFault) {
            setSmsFaultList([...smsFaultList, tempSmsFault]);
            setTempSmsFault('');
        }
    }
  };

  const removeSms = (type: 'fire' | 'fault', index: number) => {
    if (type === 'fire') {
        setSmsFireList(smsFireList.filter((_, i) => i !== index));
    } else {
        setSmsFaultList(smsFaultList.filter((_, i) => i !== index));
    }
  };

  const handleExcel = () => {
    const excelData = markets.map((m, index) => ({
      'No': index + 1,
      '시장명': m.name,
      '주소': `${m.address} ${m.addressDetail || ''}`,
      '담당자': m.managerName,
      '담당자전화': m.managerPhone,
      '상태': m.usageStatus || '사용' // 설정상태
    }));
    exportToExcel(excelData, '시장관리_목록');
  };

  // -- Table Columns --
  const columns: Column<Market>[] = [
    { header: 'No', accessor: 'id', width: '60px' },
    { header: '총판명', accessor: (m) => {
       // distributorId로 이름 찾기 (옵션 목록에서)
       const dist = distributorOptions.find(d => d.value === m.distributorId);
       return dist ? dist.label : '-';
    }},
    { header: '시장명', accessor: 'name' },
    { header: '담당자명', accessor: (m) => m.managerName || '-' },
    { header: '담당자전화', accessor: (m) => m.managerPhone || '-' },
    { header: '주소', accessor: (m) => `${m.address} ${m.addressDetail || ''}` },
  ];

  // -- Pagination Logic --
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = markets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(markets.length / ITEMS_PER_PAGE);

  // --- Helper for Radio Inputs ---
  const RadioButtons = ({ name, value, onChange, options }: { name: string, value: string | undefined, onChange: (v: string) => void, options: string[] }) => (
    <div className={`${UI_STYLES.input} flex gap-4 text-slate-300 items-center`}>
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer hover:text-white">
          <input 
            type="radio" 
            name={name} 
            value={opt} 
            checked={value === opt} 
            onChange={() => onChange(opt)} 
            className="accent-blue-500" 
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );

  if (view === 'form') {
    return (
      <>
        <PageHeader title={selectedMarket ? "시장 수정" : "시장 등록"} />
        <form onSubmit={handleSave}>
          <FormSection title={selectedMarket ? "시장 수정" : "시장 등록"}>
              {/* Row 1: 총판, 시장명 */}
              <FormRow label="총판" required>
                <SelectGroup 
                   options={distributorOptions as any}
                   value={formData.distributorId || ''}
                   onChange={(e) => setFormData({...formData, distributorId: Number(e.target.value)})}
                />
              </FormRow>
              <FormRow label="시장명" required>
                <InputGroup 
                  value={formData.name || ''} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                />
              </FormRow>
              
              {/* Row 2: 주소 (Full Width) */}
              <div className="col-span-1 md:col-span-2">
                <AddressInput 
                   label="주소"
                   required
                   address={formData.address || ''}
                   addressDetail={formData.addressDetail || ''}
                   onAddressChange={(val) => setFormData({...formData, address: val})}
                   onDetailChange={(val) => setFormData({...formData, addressDetail: val})}
                />
              </div>

              {/* Row 3: 위도, 경도 */}
              <FormRow label="위도">
                 <InputGroup 
                    value={formData.latitude || ''} 
                    onChange={(e) => setFormData({...formData, latitude: e.target.value})} 
                 />
              </FormRow>
              <FormRow label="경도">
                 <InputGroup 
                    value={formData.longitude || ''} 
                    onChange={(e) => setFormData({...formData, longitude: e.target.value})} 
                 />
              </FormRow>

              {/* Row 4: 담당자, 담당자 전화 */}
              <FormRow label="담당자">
                <InputGroup 
                  value={formData.managerName || ''} 
                  onChange={(e) => setFormData({...formData, managerName: e.target.value})} 
                />
              </FormRow>
              <FormRow label="담당자 전화">
                <InputGroup 
                  value={formData.managerPhone || ''} 
                  onChange={(e) => setFormData({...formData, managerPhone: e.target.value})} 
                />
              </FormRow>

              {/* Row 5: 담당자 이메일 */}
              <FormRow label="담당자 E-mail" className="col-span-1 md:col-span-2">
                <InputGroup 
                  value={formData.managerEmail || ''} 
                  onChange={(e) => setFormData({...formData, managerEmail: e.target.value})} 
                />
              </FormRow>

              {/* --- 수정 모드 전용 항목 (SMS, 이미지) --- */}
              {selectedMarket && (
                <>
                   {/* 화재발생시 SMS */}
                   <FormRow label="화재발생시 SMS" className="col-span-1 md:col-span-2">
                      <p className="text-xs text-red-400 mb-2">* 등록 후 수정 시에만 추가 가능</p>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                           <InputGroup 
                             placeholder="휴대폰 번호 입력" 
                             value={tempSmsFire}
                             onChange={(e) => setTempSmsFire(e.target.value)}
                           />
                           <Button type="button" onClick={() => addSms('fire')}>추가</Button>
                        </div>
                        <div className="bg-slate-900 border border-slate-600 rounded p-2 max-h-32 overflow-y-auto custom-scrollbar">
                           {smsFireList.length === 0 && <span className="text-slate-500 text-sm">등록된 번호가 없습니다.</span>}
                           {smsFireList.map((num, idx) => (
                             <div key={idx} className="flex justify-between items-center py-1 px-2 border-b border-slate-700/50 last:border-0">
                               <span className="text-slate-200">{num}</span>
                               <button type="button" onClick={() => removeSms('fire', idx)} className="text-red-400 hover:text-red-300 text-sm">삭제</button>
                             </div>
                           ))}
                        </div>
                      </div>
                   </FormRow>

                   {/* 고장발생시 SMS */}
                   <FormRow label="고장발생시 SMS" className="col-span-1 md:col-span-2">
                      <p className="text-xs text-red-400 mb-2">* 등록 후 수정 시에만 추가 가능</p>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                           <InputGroup 
                             placeholder="휴대폰 번호 입력" 
                             value={tempSmsFault}
                             onChange={(e) => setTempSmsFault(e.target.value)}
                           />
                           <Button type="button" onClick={() => addSms('fault')}>추가</Button>
                        </div>
                        <div className="bg-slate-900 border border-slate-600 rounded p-2 max-h-32 overflow-y-auto custom-scrollbar">
                           {smsFaultList.length === 0 && <span className="text-slate-500 text-sm">등록된 번호가 없습니다.</span>}
                           {smsFaultList.map((num, idx) => (
                             <div key={idx} className="flex justify-between items-center py-1 px-2 border-b border-slate-700/50 last:border-0">
                               <span className="text-slate-200">{num}</span>
                               <button type="button" onClick={() => removeSms('fault', idx)} className="text-red-400 hover:text-red-300 text-sm">삭제</button>
                             </div>
                           ))}
                        </div>
                      </div>
                   </FormRow>

                   {/* 시장지도 이미지 */}
                   <FormRow label="시장지도이미지" className="col-span-1 md:col-span-2">
                      <p className="text-xs text-red-400 mb-2">* 등록 후 수정 시에만 추가 가능</p>
                      <div className="flex gap-2 w-full">
                         <InputGroup type="file" className="border-0 p-0 text-slate-300 flex-1" />
                         <Button type="button" variant="secondary">추가</Button>
                      </div>
                   </FormRow>
                </>
              )}

              {/* 비고 */}
              <FormRow label="비고" className="col-span-1 md:col-span-2">
                 <InputGroup 
                   value={formData.memo || ''} 
                   onChange={(e) => setFormData({...formData, memo: e.target.value})} 
                 />
              </FormRow>

              {/* --- 설정 옵션 (Radio Buttons) --- */}
              <FormRow label="시장전체 문자전송여부" className="col-span-1 md:col-span-2">
                 <RadioButtons 
                    name="enableMarketSms"
                    value={formData.enableMarketSms} 
                    onChange={(v) => setFormData({...formData, enableMarketSms: v as any})}
                    options={['사용', '미사용']}
                 />
              </FormRow>
              <FormRow label="상가주인 문자전송여부" className="col-span-1 md:col-span-2">
                 <RadioButtons 
                    name="enableStoreSms"
                    value={formData.enableStoreSms} 
                    onChange={(v) => setFormData({...formData, enableStoreSms: v as any})}
                    options={['사용', '미사용']}
                 />
              </FormRow>
              <FormRow label="다매체전송 여부" className="col-span-1 md:col-span-2">
                 <RadioButtons 
                    name="enableMultiMedia"
                    value={formData.enableMultiMedia} 
                    onChange={(v) => setFormData({...formData, enableMultiMedia: v as any})}
                    options={['사용', '미사용']}
                 />
              </FormRow>
              <FormRow label="다매체 타입" className="col-span-1 md:col-span-2">
                 <RadioButtons 
                    name="multiMediaType"
                    value={formData.multiMediaType} 
                    onChange={(v) => setFormData({...formData, multiMediaType: v as any})}
                    options={['복합', '열', '연기']}
                 />
              </FormRow>
              <FormRow label="시장 사용여부" className="col-span-1 md:col-span-2">
                 <RadioButtons 
                    name="usageStatus"
                    value={formData.usageStatus} 
                    onChange={(v) => setFormData({...formData, usageStatus: v as any})}
                    options={['사용', '미사용']}
                 />
              </FormRow>
              <FormRow label="기기고장 문자전송여부" className="col-span-1 md:col-span-2">
                 <RadioButtons 
                    name="enableDeviceFaultSms"
                    value={formData.enableDeviceFaultSms} 
                    onChange={(v) => setFormData({...formData, enableDeviceFaultSms: v as any})}
                    options={['사용', '미사용']}
                 />
              </FormRow>
              <FormRow label="화재문자시 CCTV URL 포함여부" className="col-span-1 md:col-span-2">
                 <RadioButtons 
                    name="enableCctvUrl"
                    value={formData.enableCctvUrl} 
                    onChange={(v) => setFormData({...formData, enableCctvUrl: v as any})}
                    options={['사용', '미사용']}
                 />
              </FormRow>

          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
             <Button type="submit" variant="primary" className="w-32">{selectedMarket ? '수정' : '신규등록'}</Button>
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
          전체 <strong className="text-blue-400">{markets.length}</strong> 건
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