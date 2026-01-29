
import React, { useState, useEffect } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, SelectGroup, 
  Button, DataTable, Pagination, ActionBar, FormSection, FormRow, Column, Modal, UI_STYLES,
  formatPhoneNumber, StatusBadge
} from '../components/CommonUI';
import { User, RoleItem } from '../types';
import { UserAPI, RoleAPI, CommonAPI } from '../services/api';
import { exportToExcel } from '../utils/excel';

const ITEMS_PER_PAGE = 10;
const MODAL_ITEMS_PER_PAGE = 5;
const ID_REGEX = /^[A-Za-z0-9]{6,12}$/;
const PW_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{6,12}$/;

interface CompanyItem {
  id: string; // 'D_1' or 'M_1'
  name: string;
  type: string;
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
  const [searchId, setSearchId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchRole, setSearchRole] = useState('');
  const [searchDept, setSearchDept] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);
  const [isIdChecked, setIsIdChecked] = useState(false);
  const [inputUserId, setInputUserId] = useState('');
  
  const [departmentName, setDepartmentName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedCompanyType, setSelectedCompanyType] = useState<'distributor' | 'market' | null>(null);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isIdModalOpen, setIsIdModalOpen] = useState(false);
  const [modalIdInput, setModalIdInput] = useState('');
  const [idCheckResult, setIdCheckResult] = useState<{ message: string; available: boolean } | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [companyList, setCompanyList] = useState<CompanyItem[]>([]);
  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const [companySearchName, setCompanySearchName] = useState('');

  const fetchData = async (overrides?: { userId?: string, name?: string, role?: string, department?: string }) => {
    setLoading(true);
    try {
      const rolesData = await RoleAPI.getList();
      const options = rolesData.map((r: RoleItem) => ({ value: r.name, label: r.name }));
      setRoleOptions(options);

      const query = {
        userId: overrides?.userId !== undefined ? overrides.userId : searchId,
        name: overrides?.name !== undefined ? overrides.name : searchName,
        role: overrides?.role !== undefined ? overrides.role : searchRole,
        department: overrides?.department !== undefined ? overrides.department : searchDept
      };

      const usersData = await UserAPI.getList(query);
      setUsers(usersData);
      setCurrentPage(1); 
    } catch (e) {
      console.error(e);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = () => { setIsFiltered(true); fetchData(); };
  const handleReset = () => {
    setSearchId(''); setSearchName(''); setSearchRole(''); setSearchDept(''); setIsFiltered(false);
    fetchData({ userId: '', name: '', role: '', department: '' });
  };
  
  const handleRegister = () => { 
    setSelectedUser(null); setInputUserId(''); setDepartmentName(''); setSelectedCompanyId(null); setSelectedCompanyType(null);
    setPassword(''); setPasswordConfirm(''); setPasswordError(''); setIsIdChecked(false); setView('form'); 
  };
  
  const handleEdit = (user: User) => { 
    setSelectedUser(user); 
    setInputUserId(user.userId);
    setDepartmentName(user.department || '');
    
    // Check snake_case ID fields
    if (user.distributor_id) {
        setSelectedCompanyId(user.distributor_id);
        setSelectedCompanyType('distributor');
    } else if (user.market_id) {
        setSelectedCompanyId(user.market_id);
        setSelectedCompanyType('market');
    } else {
        setSelectedCompanyId(null);
        setSelectedCompanyType(null);
    }
    setPassword(''); setPasswordConfirm(''); setPasswordError(''); setIsIdChecked(true); setView('form'); 
  };

  const handleOpenIdModal = () => { if (!selectedUser) { setModalIdInput(''); setIdCheckResult(null); setIsIdModalOpen(true); } };
  const handleModalIdChange = (e: React.ChangeEvent<HTMLInputElement>) => { setModalIdInput(e.target.value); setIdCheckResult(null); };
  
  const handleIdModalCheck = async () => {
    if (!modalIdInput) { alert('아이디를 입력해주세요.'); return; }
    if (!ID_REGEX.test(modalIdInput)) { setIdCheckResult({ message: '아이디는 영문, 숫자 포함 6자 ~ 12자로 생성해주세요.', available: false }); return; }
    try {
      const exists = await UserAPI.checkDuplicate(modalIdInput);
      if (exists) { setIdCheckResult({ message: `${modalIdInput}는 사용불가능합니다.`, available: false }); setModalIdInput(''); } 
      else { setIdCheckResult({ message: `${modalIdInput}는 사용가능합니다.`, available: true }); }
    } catch (e) { alert('중복 체크 중 오류가 발생했습니다.'); }
  };

  const handleIdModalUse = () => { if (idCheckResult?.available && modalIdInput) { setInputUserId(modalIdInput); setIsIdChecked(true); setIsIdModalOpen(false); } };
  
  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (val && !PW_REGEX.test(val)) { setPasswordError('비밀번호는 영문, 숫자, 특수문자 포함 6자 ~ 12자로 생성해 주세요.'); } 
    else { setPasswordError(''); }
  };

  const fetchCompanies = async () => { const list = await CommonAPI.getCompanyList(companySearchName); setCompanyList(list); setModalCurrentPage(1); };
  const handleOpenCompanyModal = () => { setCompanySearchName(''); fetchCompanies(); setIsCompanyModalOpen(true); };
  const handleCompanySearch = () => { fetchCompanies(); };
  
  const handleSelectCompany = (company: CompanyItem) => {
    const [typePrefix, idStr] = company.id.split('_');
    const id = parseInt(idStr, 10);
    setDepartmentName(company.name);
    setSelectedCompanyId(id);
    setSelectedCompanyType(typePrefix === 'D' ? 'distributor' : 'market');
    setIsCompanyModalOpen(false);
  };

  const handleExcel = () => {
    const excelData = users.map((u, index) => ({
      'No': index + 1,
      '사용자 ID': u.userId,
      '성명': u.name,
      '소속/업체명': u.department,
      '연락처': u.phone,
      '역할': u.role,
      '상태': u.status
    }));
    exportToExcel(excelData, '사용자관리_목록');
  };
  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;

    if (!selectedUser && !isIdChecked) { alert('아이디 만들기를 진행해주세요.'); return; }
    if (!selectedUser || password) {
       if (!password) { alert('비밀번호를 입력해주세요.'); return; }
       if (!PW_REGEX.test(password)) { alert('비밀번호 규칙을 확인해주세요.\n(영문, 숫자, 특수문자 포함 6~12자)'); return; }
       if (password !== passwordConfirm) { alert('비밀번호가 일치하지 않습니다.'); return; }
    }

    // Creating new user object strictly following the User interface
    const newUser: User = {
      id: selectedUser?.id || 0,
      userId: inputUserId,
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      role: (form.elements.namedItem('role') as HTMLSelectElement).value,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      department: departmentName,
      // Use snake_case IDs only
      distributor_id: selectedCompanyType === 'distributor' ? selectedCompanyId! : undefined,
      market_id: selectedCompanyType === 'market' ? selectedCompanyId! : undefined,
      
      status: (form.elements.namedItem('status') as RadioNodeList).value as '사용' | '미사용',
      smsReceive: (form.elements.namedItem('smsReceive') as RadioNodeList).value as '수신' | '미수신',
      password: password || undefined,
    };

    try {
      await UserAPI.save(newUser);
      alert('저장되었습니다.');
      setView('list');
      fetchData();
    } catch (e) { alert('저장 실패'); }
  };
  
  const handleDelete = async () => { 
    if(selectedUser && confirm('정말 삭제하시겠습니까?')) {
      try { await UserAPI.delete(selectedUser.id); alert('삭제되었습니다.'); setView('list'); fetchData(); } 
      catch (e) { alert('삭제 실패'); }
    }
  };
  const handleCancel = () => { setView('list'); };

  return (
    <>
      <PageHeader title="사용자 관리" />
      
      {view === 'form' ? (
        <form onSubmit={handleSave}>
          <FormSection title="기본 정보">
            <FormRow label="사용자 ID" required>
              <div className="flex gap-2 w-full">
                 <InputGroup 
                   className="flex-1"
                   value={inputUserId} 
                   onChange={(e) => {}} 
                   onClick={handleOpenIdModal}
                   readOnly
                   disabled={!!selectedUser} 
                   placeholder={selectedUser ? "아이디" : "아이디 만들기 버튼을 눌러주세요"} 
                   required 
                   inputClassName={!selectedUser ? "cursor-pointer" : ""}
                 />
                 {!selectedUser && (
                   <Button type="button" variant="secondary" onClick={handleOpenIdModal} className="whitespace-nowrap">
                     아이디 만들기
                   </Button>
                 )}
              </div>
            </FormRow>
            <FormRow label="성명" required>
              <InputGroup name="name" defaultValue={selectedUser?.name} placeholder="사용자 성명" required />
            </FormRow>

            <FormRow label="비밀번호" required={!selectedUser}>
              <div className="flex flex-col gap-1">
                <InputGroup 
                  type="password" 
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="********" 
                />
                <p className={`text-xs ${passwordError ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                  {passwordError || '비밀번호는 영문, 숫자, 특수문자 포함 6자 ~ 12자로 생성해 주세요.'}
                </p>
              </div>
            </FormRow>
            <FormRow label="비밀번호 확인" required={!selectedUser}>
              <div className="flex flex-col gap-1">
                <InputGroup 
                  type="password" 
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="********" 
                />
                {password && passwordConfirm && password !== passwordConfirm && (
                  <p className="text-xs text-red-400 font-medium">비밀번호가 맞지 않습니다.</p>
                )}
              </div>
            </FormRow>

            <FormRow label="업체명">
               <div className="flex gap-2 w-full">
                 <InputGroup 
                    className="flex-1" 
                    name="department" 
                    value={departmentName} 
                    onChange={(e) => setDepartmentName(e.target.value)}
                    placeholder="업체 선택" 
                    readOnly 
                    onClick={handleOpenCompanyModal} 
                  />
                 <Button type="button" variant="secondary" onClick={handleOpenCompanyModal}>찾기</Button>
               </div>
            </FormRow>
            <FormRow label="사용자 역할" required>
              <SelectGroup name="role" options={roleOptions} defaultValue={selectedUser?.role} />
            </FormRow>

            <FormRow label="연락처" required>
              <InputGroup name="phone" defaultValue={selectedUser?.phone} placeholder="010-0000-0000" required />
            </FormRow>
            <FormRow label="SMS 수신 여부">
              <div className={`${UI_STYLES.input} flex gap-6 items-center`}>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input type="radio" name="smsReceive" value="수신" defaultChecked={!selectedUser || selectedUser.smsReceive === '수신'} className="accent-blue-500 w-4 h-4" />
                  <span>수신</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input type="radio" name="smsReceive" value="미수신" defaultChecked={selectedUser?.smsReceive === '미수신'} className="accent-blue-500 w-4 h-4" />
                  <span>미수신</span>
                </label>
              </div>
            </FormRow>

            <FormRow label="사용 여부" className="col-span-1 md:col-span-2">
              <div className={`${UI_STYLES.input} flex gap-6 items-center`}>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input type="radio" name="status" value="사용" defaultChecked={!selectedUser || selectedUser.status === '사용'} className="accent-blue-500 w-4 h-4" />
                  <span>사용</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input type="radio" name="status" value="미사용" defaultChecked={selectedUser?.status === '미사용'} className="accent-blue-500 w-4 h-4" />
                  <span>미사용</span>
                </label>
              </div>
            </FormRow>
          </FormSection>

          <div className="flex justify-center gap-3 mt-8">
             <Button type="submit" variant="primary" className="w-32">{selectedUser ? '수정' : '신규등록'}</Button>
             {selectedUser && (
               <Button type="button" variant="danger" onClick={handleDelete} className="w-32">삭제</Button>
             )}
             <Button type="button" variant="secondary" onClick={handleCancel} className="w-32">취소</Button>
          </div>
        </form>
      ) : (
        <>
          <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
            <InputGroup 
              label="사용자 ID" 
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="아이디 입력" 
            />
            <InputGroup 
              label="성명" 
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="성명 입력" 
            />
            <SelectGroup 
              label="역할" 
              value={searchRole}
              onChange={(e) => setSearchRole(e.target.value)}
              options={[
                { value: '', label: '전체' },
                ...roleOptions
              ]} 
            />
            <InputGroup 
              label="업체명" 
              value={searchDept}
              onChange={(e) => setSearchDept(e.target.value)}
              placeholder="업체명 입력" 
            />
          </SearchFilterBar>

          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-400">
              전체 <strong className="text-blue-400">{users.length}</strong> 건 
              (페이지 {currentPage})
            </span>
            <ActionBar onRegister={handleRegister} onExcel={handleExcel} />
          </div>

          {loading ? (
             <div className="text-center py-20 text-slate-500">Loading...</div>
          ) : (
             <DataTable 
                columns={[
                    { header: 'No', accessor: 'id', width: '60px' },
                    { header: '사용자 ID', accessor: 'userId' },
                    { header: '성명', accessor: 'name' },
                    { header: '소속/업체명', accessor: 'department' },
                    { header: '연락처', accessor: (user) => formatPhoneNumber(user.phone) },
                    { header: '역할', accessor: 'role' },
                    { header: '상태', accessor: (user) => <StatusBadge status={user.status} />, width: '120px' },
                ]} 
                data={users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)} 
                onRowClick={handleEdit} 
             />
          )}
          <Pagination 
            totalItems={users.length} 
            itemsPerPage={ITEMS_PER_PAGE} 
            currentPage={currentPage} 
            onPageChange={setCurrentPage}
          />
        </>
      )}
      
      <Modal 
          isOpen={isCompanyModalOpen} 
          onClose={() => setIsCompanyModalOpen(false)} 
          title="업체 찾기" 
          width="max-w-4xl" 
        >
          <SearchFilterBar onSearch={handleCompanySearch}>
            <InputGroup 
              placeholder="업체명을 입력하세요" 
              value={companySearchName} 
              onChange={(e) => setCompanySearchName(e.target.value)} 
            />
          </SearchFilterBar>
          <DataTable 
             columns={[
                { header: '구분', accessor: 'type', width: '100px' },
                { header: '업체명', accessor: 'name' },
                { header: '담당자', accessor: 'manager', width: '120px' },
                { header: '선택', accessor: (item) => <Button variant="primary" onClick={() => handleSelectCompany(item)} className="px-3 py-1.5 text-sm whitespace-nowrap">선택</Button>, width: '100px' }
             ]} 
             data={companyList.slice((modalCurrentPage - 1) * MODAL_ITEMS_PER_PAGE, modalCurrentPage * MODAL_ITEMS_PER_PAGE)} 
          />
          <Pagination totalItems={companyList.length} itemsPerPage={MODAL_ITEMS_PER_PAGE} currentPage={modalCurrentPage} onPageChange={setModalCurrentPage} />
        </Modal>

        <Modal 
          isOpen={isIdModalOpen} 
          onClose={() => setIsIdModalOpen(false)} 
          title="아이디 만들기" 
          width="max-w-md"
        >
          <div className="flex flex-col gap-6">
             <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">사용자 ID</label>
                <div className="flex gap-2">
                   <InputGroup 
                      value={modalIdInput} 
                      onChange={handleModalIdChange} 
                      placeholder="아이디를 입력하세요" 
                   />
                   <Button onClick={handleIdModalCheck} className="whitespace-nowrap">확인</Button>
                </div>
                <div className="min-h-[20px]">
                   {idCheckResult ? (
                      <p className={`text-sm font-bold ${idCheckResult.available ? 'text-blue-400' : 'text-red-400'}`}>
                         {idCheckResult.message}
                      </p>
                   ) : (
                     <p className="text-xs text-slate-500 mt-1">
                       아이디는 영문, 숫자 포함 6자 ~ 12자로 생성해주세요.
                     </p>
                   )}
                </div>
             </div>

             <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
               <Button 
                 variant="primary" 
                 className="w-24"
                 disabled={!idCheckResult?.available} 
                 onClick={handleIdModalUse}
               >
                 사용
               </Button>
               <Button 
                 variant="secondary" 
                 className="w-24"
                 onClick={() => setIsIdModalOpen(false)}
               >
                 취소
               </Button>
             </div>
          </div>
        </Modal>
    </>
  );
};
