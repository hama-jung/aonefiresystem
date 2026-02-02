import React, { useState, useEffect } from 'react';
import { 
  PageHeader, Button, DataTable, InputGroup, Column, FormRow, SearchFilterBar, Pagination, ActionBar, FormSection, UI_STYLES, StatusBadge // Import StatusBadge
} from '../components/CommonUI';
import { RoleItem } from '../types';
import { RoleAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';

const ITEMS_PER_PAGE = 10;

export const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);

  // 폼 상태 관리
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    description: string;
    status: '사용' | '미사용';
  }>({ 
    code: '', 
    name: '', 
    description: '', 
    status: '사용' 
  });

  // 검색 상태 관리
  const [searchCode, setSearchCode] = useState('');
  const [searchName, setSearchName] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

  // 데이터 조회
  const fetchRoles = async (codeVal?: string, nameVal?: string) => {
    setLoading(true);
    try {
      const sCode = codeVal !== undefined ? codeVal : searchCode;
      const sName = nameVal !== undefined ? nameVal : searchName;
      
      const data = await RoleAPI.getList({ code: sCode, name: sName });
      setRoles(data);
      setCurrentPage(1);
    } catch (e) {
      alert('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleRowClick = (role: RoleItem) => {
    setSelectedRole(role);
    setFormData({ 
      code: role.code, 
      name: role.name, 
      description: role.description,
      status: role.status
    });
  };

  const handleNew = () => {
    setSelectedRole(null);
    setFormData({ code: '', name: '', description: '', status: '사용' });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      alert('롤 코드와 롤 이름을 모두 입력해주세요.');
      return;
    }

    try {
      const newRole: RoleItem = {
        id: selectedRole ? selectedRole.id : 0,
        code: formData.code,
        name: formData.name,
        description: formData.description,
        status: formData.status
      };
      await RoleAPI.save(newRole);
      alert('저장되었습니다.');
      handleNew();
      fetchRoles();
    } catch (e) {
      alert('저장 실패');
    }
  };

  const handleExcel = () => {
    const excelData = roles.map((r, index) => ({
      'No': index + 1,
      '역할코드': r.code,
      '역할명': r.name,
      '설명': r.description,
      '상태': r.status
    }));
    exportToExcel(excelData, '롤관리_목록');
  };

  const handleSearch = () => {
    setIsFiltered(true);
    fetchRoles();
  };

  const handleReset = () => {
    setSearchCode('');
    setSearchName('');
    setIsFiltered(false);
    fetchRoles('', '');
  };

  const columns: Column<RoleItem>[] = [
    { header: 'No', accessor: 'id', width: '60px' },
    { header: '역할코드', accessor: 'code', width: '120px' },
    { header: '역할명', accessor: 'name', width: '200px' },
    { header: '역할설명', accessor: 'description' },
    { header: '상태', accessor: (r) => <StatusBadge status={r.status} />, width: '100px' },
  ];

  // -- Pagination Logic --
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = roles.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(roles.length / ITEMS_PER_PAGE);

  return (
    <>
      <PageHeader title="롤 관리" />
      
      {/* 
        FormSection 사용으로 통일. 
        FormSection 내부는 grid-cols-2가 적용되므로 children을 직접 나열하면 됨.
      */}
      <FormSection title={selectedRole ? "롤 수정" : "롤 등록"}>
          <FormRow label="롤 코드">
            <InputGroup 
              value={formData.code}
              onChange={(e) => setFormData({...formData, code: e.target.value})}
              placeholder=""
            />
          </FormRow>
          <FormRow label="롤 이름">
            <InputGroup 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder=""
            />
          </FormRow>
          <FormRow label="롤 설명">
            <InputGroup 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder=""
            />
          </FormRow>
          <FormRow label="사용여부">
            <div className={`${UI_STYLES.input} flex gap-6 items-center`}>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input 
                  type="radio" name="status" value="사용" 
                  checked={formData.status === '사용'}
                  onChange={() => setFormData({...formData, status: '사용'})}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500" 
                />
                <span>사용</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input 
                  type="radio" name="status" value="미사용" 
                  checked={formData.status === '미사용'}
                  onChange={() => setFormData({...formData, status: '미사용'})}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500" 
                />
                <span>미사용</span>
              </label>
            </div>
          </FormRow>
      </FormSection>

      <div className="flex justify-center gap-2 mb-6">
           <Button variant="primary" onClick={handleNew} className="w-24">신규</Button>
           <Button variant="primary" onClick={handleSave} className="w-24">저장</Button>
      </div>

      <div className="w-full h-px bg-blue-500 mb-6"></div>

      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
         <InputGroup 
            label="롤 코드" 
            value={searchCode} 
            onChange={(e) => setSearchCode(e.target.value)} 
            placeholder="검색할 롤 코드를 입력하세요"
         />
         <InputGroup 
            label="롤 이름" 
            value={searchName} 
            onChange={(e) => setSearchName(e.target.value)} 
            placeholder="검색할 롤 이름을 입력하세요"
         />
      </SearchFilterBar>

      <div className="flex justify-between items-center mb-2">
         <span className="text-sm font-bold text-slate-300">
           전체 {roles.length} 개 
           (페이지 {currentPage}/{totalPages || 1})
         </span>
         <ActionBar onExcel={handleExcel} />
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading...</div>
      ) : (
        <DataTable columns={columns} data={currentItems} onRowClick={handleRowClick} />
      )}
      
      <Pagination 
        totalItems={roles.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  );
};