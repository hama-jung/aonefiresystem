
import React, { useState, useEffect } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, SelectGroup, 
  Button, DataTable, Pagination, ActionBar, FormSection, FormRow, Column, Modal, UI_STYLES,
  formatPhoneNumber, StatusBadge
} from '../components/CommonUI';
import { User, RoleItem } from '../types';
import { UserAPI, RoleAPI, CommonAPI } from '../services/api';

const ITEMS_PER_PAGE = 10;

// Helper interface for company list items in modal
interface CompanyItem {
  id: string; // e.g., "D_1" or "M_2"
  type: string;
  name: string;
  manager: string;
  phone: string;
}

export const UserManagement: React.FC = () => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [users, setUsers] = useState<User[]>([]);
  const [roleOptions, setRoleOptions] = useState<{value: string, label: string}[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState<Partial<User>>({});
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [companyList, setCompanyList] = useState<CompanyItem[]>([]);
  const [companySearchName, setCompanySearchName] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    const data = await UserAPI.getList();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    RoleAPI.getList().then(roles => {
      setRoleOptions(roles.map(r => ({ value: r.name, label: r.name })));
    });
  }, []);

  const handleRegister = () => {
    setSelectedUser(null);
    setFormData({ status: '사용', role: '시장관리자' });
    setView('form');
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({ ...user });
    setView('form');
  };

  const openCompanyModal = async () => {
    const list = await CommonAPI.getCompanyList(companySearchName);
    setCompanyList(list);
    setIsCompanyModalOpen(true);
  };

  const handleSelectCompany = (company: CompanyItem) => {
    const [type, idStr] = company.id.split('_');
    const id = parseInt(idStr, 10);
    
    // [CRITICAL] 롤에 따른 필드 매핑
    if (type === 'D') {
      setFormData(prev => ({ ...prev, distributor_id: id, market_id: undefined, department: company.name }));
    } else {
      setFormData(prev => ({ ...prev, market_id: id, distributor_id: undefined, department: company.name }));
    }
    setIsCompanyModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await UserAPI.save(formData as User);
      alert('저장되었습니다.');
      setView('list');
      fetchUsers();
    } catch (e) { alert('저장 실패'); }
  };

  const userColumns: Column<User>[] = [
    { header: 'ID', accessor: 'userId' },
    { header: '성명', accessor: 'name' },
    { header: '소속', accessor: 'department' },
    { header: '역할', accessor: 'role' },
    { header: '상태', accessor: (u) => <StatusBadge status={u.status} /> }
  ];

  const companyColumns: Column<CompanyItem>[] = [
    { header: '구분', accessor: 'type' },
    { header: '업체명', accessor: 'name' },
    { header: '선택', accessor: (c) => <Button onClick={() => handleSelectCompany(c)} variant="primary" className="px-2 py-1 text-xs">선택</Button> }
  ];

  if (view === 'form') {
    return (
      <>
        <PageHeader title="사용자 관리" />
        <form onSubmit={handleSave}>
          <FormSection title="기본 정보">
            <FormRow label="사용자 ID" required>
               <InputGroup value={formData.userId || ''} onChange={e => setFormData({...formData, userId: e.target.value})} disabled={!!selectedUser} />
            </FormRow>
            <FormRow label="성명" required>
               <InputGroup value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
            </FormRow>
            <FormRow label="비밀번호" required={!selectedUser}>
               <InputGroup type="password" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />
            </FormRow>
            <FormRow label="역할" required>
               <SelectGroup options={roleOptions} value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})} />
            </FormRow>
            <FormRow label="소속 업체">
               <div className="flex gap-2">
                  <InputGroup value={formData.department || ''} readOnly placeholder="업체 선택" />
                  <Button type="button" variant="secondary" onClick={openCompanyModal}>찾기</Button>
               </div>
            </FormRow>
            <FormRow label="연락처">
               <InputGroup value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </FormRow>
            <FormRow label="사용 여부" className="col-span-1 md:col-span-2">
               <div className={`${UI_STYLES.input} flex gap-4`}>
                 <label className="flex items-center gap-2"><input type="radio" checked={formData.status === '사용'} onChange={() => setFormData({...formData, status: '사용'})} /> 사용</label>
                 <label className="flex items-center gap-2"><input type="radio" checked={formData.status === '미사용'} onChange={() => setFormData({...formData, status: '미사용'})} /> 미사용</label>
               </div>
            </FormRow>
          </FormSection>
          <div className="flex justify-center gap-3 mt-8">
             <Button type="submit" variant="primary" className="w-32">저장</Button>
             <Button type="button" variant="secondary" onClick={() => setView('list')} className="w-32">취소</Button>
          </div>
        </form>

        <Modal isOpen={isCompanyModalOpen} onClose={() => setIsCompanyModalOpen(false)} title="업체 찾기" width="max-w-2xl">
           <SearchFilterBar onSearch={openCompanyModal}>
              <InputGroup value={companySearchName} onChange={e => setCompanySearchName(e.target.value)} />
           </SearchFilterBar>
           <DataTable<CompanyItem> 
             columns={companyColumns}
             data={companyList}
           />
        </Modal>
      </>
    );
  }

  return (
    <>
      <PageHeader title="사용자 관리" />
      <div className="flex justify-end mb-2">
        <Button variant="primary" onClick={handleRegister}>신규 등록</Button>
      </div>
      <DataTable<User> 
        columns={userColumns}
        data={users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
        onRowClick={handleEdit}
      />
      <Pagination totalItems={users.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={currentPage} onPageChange={setCurrentPage} />
    </>
  );
};
