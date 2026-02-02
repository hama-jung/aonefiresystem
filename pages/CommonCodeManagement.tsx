
import React, { useState, useEffect, useRef } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, SelectGroup, Button, DataTable, 
  Pagination, FormSection, FormRow, Column, UI_STYLES, StatusRadioGroup, ActionBar, StatusBadge, ITEMS_PER_PAGE 
} from '../components/CommonUI';
import { CommonCode } from '../types';
import { CommonCodeAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';
import { Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export const CommonCodeManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'excel'>('list');
  const [codes, setCodes] = useState<CommonCode[]>([]);
  const [selectedCode, setSelectedCode] = useState<CommonCode | null>(null);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Search Filters
  const [searchGroupName, setSearchGroupName] = useState('');
  const [searchName, setSearchName] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

  // Form Data
  const [formData, setFormData] = useState<Partial<CommonCode>>({});

  // Excel Upload Data
  const [excelData, setExcelData] = useState<CommonCode[]>([]);

  // --- Initial Data Load ---
  const fetchCodes = async (overrides?: { groupName?: string, name?: string }) => {
    setLoading(true);
    try {
      const query = {
        groupName: overrides?.groupName !== undefined ? overrides.groupName : searchGroupName,
        name: overrides?.name !== undefined ? overrides.name : searchName,
      };
      const data = await CommonCodeAPI.getList(query);
      setCodes(data);
      setCurrentPage(1);
    } catch (e: any) {
      console.error(e);
      if (e.message && e.message.includes('Could not find the table')) {
         console.warn('DB 테이블(common_codes)이 존재하지 않습니다. SQL 스크립트를 실행해주세요.');
      } else {
         alert('데이터 로드 실패: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  // --- Search Handlers ---
  const handleSearch = () => {
    setIsFiltered(true);
    fetchCodes();
  };

  const handleReset = () => {
    setSearchGroupName('');
    setSearchName('');
    setIsFiltered(false);
    fetchCodes({ groupName: '', name: '' });
  };

  // --- List Actions ---
  const handleNew = () => {
    setSelectedCode(null);
    setFormData({ 
      status: '사용',
      code: '',
      name: '',
      description: '',
      groupCode: '',
      groupName: ''
    });
  };

  const handleRowClick = (code: CommonCode) => {
    setSelectedCode(code);
    setFormData({ ...code });
  };

  const handleExcelRegister = () => {
    setExcelData([]);
    setView('excel');
  };

  // --- Form Handlers ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code) { alert('공통코드를 입력해주세요.'); return; }
    if (!formData.name) { alert('공통코드명을 입력해주세요.'); return; }
    if (!formData.groupCode) { alert('공통그룹코드를 입력해주세요.'); return; }

    try {
      const newCode: CommonCode = {
        ...formData as CommonCode,
        id: selectedCode?.id || 0,
      };

      await CommonCodeAPI.save(newCode);
      alert('저장되었습니다.');
      handleNew(); // Reset form
      fetchCodes(); // Refresh list
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    }
  };

  // --- Excel Logic ---
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsedData: CommonCode[] = data.map((row: any) => ({
        id: 0,
        code: row['공통코드'] || '',
        name: row['공통코드명'] || '',
        description: row['공통코드상세'] || '',
        groupCode: row['공통그룹코드'] || '',
        groupName: row['공통그룹코드명'] || '',
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

    try {
        await CommonCodeAPI.saveBulk(excelData);
        alert(`${excelData.length}건이 성공적으로 등록되었습니다.`);
        setView('list');
        fetchCodes();
    } catch (e: any) {
        alert(`일괄 등록 실패: ${e.message}`);
    }
  };

  const handleSampleDownload = () => {
    const sampleData = [
      {
        '공통코드': 'SRG01',
        '공통코드명': '시장',
        '공통코드상세': '시장 구분 코드',
        '공통그룹코드': 'SMS_RESERVED_GUBUN',
        '공통그룹코드명': 'SMS 예약 구분',
        '사용여부': '사용'
      }
    ];
    exportToExcel(sampleData, '공통코드_일괄등록_샘플양식');
  };

  // --- Columns ---
  const columns: Column<CommonCode>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '공통코드', accessor: 'code', width: '150px' },
    { header: '공통코드명', accessor: 'name', width: '200px' },
    { header: '공통코드 설명', accessor: 'description' },
    { header: '공통그룹코드', accessor: 'groupCode', width: '150px' },
    { header: '공통그룹코드명', accessor: 'groupName', width: '200px' },
    { header: '사용여부', accessor: (item) => <StatusBadge status={item.status} />, width: '100px' },
  ];

  // Pagination logic
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = codes.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(codes.length / ITEMS_PER_PAGE);

  // --- View: Excel ---
  if (view === 'excel') {
    return (
      <>
        <PageHeader title="공통코드 관리" />
        <FormSection title="엑셀 일괄 등록">
            <FormRow label="엑셀 파일 선택" required className="col-span-1 md:col-span-2">
                <div className="flex flex-col gap-2">
                   <InputGroup 
                      type="file" 
                      accept=".xlsx, .xls"
                      onChange={handleExcelFileChange}
                      className="border-0 p-0 text-slate-300 w-full"
                   />
                   <p className="text-xs text-slate-400">
                     * 공통코드, 공통코드명, 공통코드상세, 공통그룹코드, 공통그룹코드명, 사용여부 컬럼을 포함해야 합니다.
                   </p>
                </div>
            </FormRow>

            <FormRow label="샘플 양식" className="col-span-1 md:col-span-2">
                <Button type="button" variant="secondary" onClick={handleSampleDownload} icon={<Upload size={14} />}>
                   엑셀 샘플 다운로드
                </Button>
            </FormRow>
        </FormSection>

        {excelData.length > 0 && (
          <div className="mt-8">
             <h3 className="text-lg font-bold text-slate-200 mb-2">등록 미리보기 ({excelData.length}건)</h3>
             <DataTable<CommonCode> 
               columns={[
                  {header:'코드', accessor:'code'},
                  {header:'코드명', accessor:'name'},
                  {header:'상세', accessor:'description'},
                  {header:'그룹코드', accessor:'groupCode'},
                  {header:'그룹명', accessor:'groupName'},
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
      </>
    );
  }

  // --- View: List (Main) ---
  return (
    <>
      <PageHeader title="공통코드 관리" />
      
      {/* Top Form Section (Image Layout) */}
      <form onSubmit={handleSave} className="mb-8">
        <h3 className="text-lg font-bold text-slate-200 mb-4 border-b border-slate-700 pb-2">공통코드 목록</h3>
        
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Row 1 */}
                <FormRow label="공통코드">
                    <InputGroup 
                        value={formData.code || ''} 
                        onChange={(e) => setFormData({...formData, code: e.target.value})} 
                    />
                </FormRow>
                <FormRow label="공통코드명">
                    <InputGroup 
                        value={formData.name || ''} 
                        onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    />
                </FormRow>

                {/* Row 2 */}
                <FormRow label="공통코드 상세">
                    <InputGroup 
                        value={formData.description || ''} 
                        onChange={(e) => setFormData({...formData, description: e.target.value})} 
                    />
                </FormRow>
                <FormRow label="공통그룹코드">
                    <InputGroup 
                        value={formData.groupCode || ''} 
                        onChange={(e) => setFormData({...formData, groupCode: e.target.value})} 
                    />
                </FormRow>

                {/* Row 3 */}
                <FormRow label="공통그룹코드명">
                    <InputGroup 
                        value={formData.groupName || ''} 
                        onChange={(e) => setFormData({...formData, groupName: e.target.value})} 
                    />
                </FormRow>
                <FormRow label="사용여부">
                    <StatusRadioGroup 
                        label=""
                        value={formData.status} 
                        onChange={(val) => setFormData({...formData, status: val as any})} 
                    />
                </FormRow>
            </div>

            {/* Buttons (Center aligned below form as per image suggestion) */}
            <div className="flex justify-center gap-2 mt-8">
                <Button type="button" variant="primary" onClick={handleNew} className="w-24 bg-blue-500 hover:bg-blue-400">신규</Button>
                <Button type="submit" variant="primary" className="w-24 bg-blue-600 hover:bg-blue-500">저장</Button>
            </div>
        </div>
      </form>

      {/* Divider */}
      <div className="w-full h-px bg-blue-500 mb-6"></div>

      {/* Search Bar */}
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <InputGroup 
            label="공통그룹코드명" 
            value={searchGroupName} 
            onChange={(e) => setSearchGroupName(e.target.value)} 
        />
        <InputGroup 
            label="공통코드명" 
            value={searchName} 
            onChange={(e) => setSearchName(e.target.value)} 
        />
      </SearchFilterBar>

      {/* List Header */}
      <div className="flex justify-between items-center mb-2">
         <span className="text-sm font-bold text-slate-300">
           전체 {codes.length} 개 
           (페이지 {currentPage}/{totalPages || 1})
         </span>
         <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExcelRegister} icon={<Upload size={16} />}>엑셀 신규 등록</Button>
         </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading...</div>
      ) : (
        <DataTable columns={columns} data={currentItems} onRowClick={handleRowClick} />
      )}
      
      <Pagination 
        totalItems={codes.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  );
};
