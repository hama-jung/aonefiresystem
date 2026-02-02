
import React, { useState, useEffect } from 'react';
import { 
  PageHeader, InputGroup, Button, DataTable, Pagination, Column, Modal, SearchFilterBar, UI_STYLES
} from '../components/CommonUI';
import { User } from '../types';
import { UserAPI } from '../services/api';
import { Send, UserPlus, Trash2, List, Smartphone, ArrowLeft } from 'lucide-react';

const ITEMS_PER_PAGE = 10;
const Modal_ITEMS_PER_PAGE_CONST = 5;

// 수신자 인터페이스
interface Receiver {
  id: string | number;
  userId?: string;
  name: string;
  department?: string;
  phone: string;
  smsReceive?: string;
  isManual: boolean; // 수동 추가 여부
}

// 전송 이력 인터페이스
interface SmsHistoryItem {
  id: number;
  date: string; // ISO String
  count: number;
  success: number;
  fail: number;
  refusal: number;
  subject: string;
}

export const SmsTransmission: React.FC = () => {
  // View State: 'compose' (작성화면) | 'history' (전송목록)
  const [view, setView] = useState<'compose' | 'history'>('compose');

  // --- Compose State ---
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [senderPhone, setSenderPhone] = useState('032-1111-2222');
  
  // Receiver List
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [checkedReceiverIds, setCheckedReceiverIds] = useState<Set<string | number>>(new Set());
  
  // Manual Input State
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userList, setUserList] = useState<User[]>([]);
  const [modalSearchName, setModalSearchName] = useState('');
  const [modalSearchDept, setModalSearchDept] = useState('');
  const [modalSelectedIds, setModalSelectedIds] = useState<Set<number>>(new Set());
  const [modalPage, setModalPage] = useState(1);

  // --- History State ---
  const [historyList, setHistoryList] = useState<SmsHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- Byte Calculation ---
  const getByteLength = (s: string) => {
    let b = 0, i = 0, c;
    for (; c = s.charCodeAt(i++); b += c >> 11 ? 2 : 1); // 한글 2바이트 처리
    return b;
  };
  const currentBytes = getByteLength(content);
  const maxBytes = 2000; // LMS 기준

  // --- Handlers: Manual Add ---
  const handleManualPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 허용
    setManualPhone(val);
  };

  const handleAddManual = () => {
    if (!manualName || !manualPhone) {
      alert('수신자명과 휴대폰번호를 입력해주세요.');
      return;
    }
    const newReceiver: Receiver = {
      id: `manual_${Date.now()}`,
      name: manualName,
      phone: manualPhone,
      isManual: true,
      department: '-',
      userId: '-',
      smsReceive: '수동'
    };
    setReceivers([...receivers, newReceiver]);
    setManualName('');
    setManualPhone('');
  };

  // --- Handlers: User Modal ---
  const fetchUsers = async () => {
    // 실제로는 API 호출 시 필터링
    const users = await UserAPI.getList({ name: modalSearchName, department: modalSearchDept });
    // '사용' 상태인 사용자만 필터링
    const activeUsers = users.filter(u => u.status === '사용');
    setUserList(activeUsers);
    setModalPage(1);
  };

  const openUserModal = () => {
    setModalSearchName('');
    setModalSearchDept('');
    setModalSelectedIds(new Set());
    fetchUsers();
    setIsUserModalOpen(true);
  };

  const toggleModalUserSelect = (id: number) => {
    const newSet = new Set(modalSelectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setModalSelectedIds(newSet);
  };

  const handleAddSelectedUsers = () => {
    const selectedUsers = userList.filter(u => modalSelectedIds.has(u.id));
    const newReceivers: Receiver[] = selectedUsers.map(u => ({
      id: u.id,
      userId: u.userId,
      name: u.name,
      department: u.department || '-',
      phone: u.phone,
      smsReceive: u.smsReceive || '-',
      isManual: false
    }));

    // 중복 제거 (이미 리스트에 있는 ID는 제외)
    const existingIds = new Set(receivers.map(r => r.id));
    const uniqueNewReceivers = newReceivers.filter(r => !existingIds.has(r.id));

    setReceivers([...receivers, ...uniqueNewReceivers]);
    setIsUserModalOpen(false);
  };

  // --- Handlers: Receiver List ---
  const toggleReceiverCheck = (id: string | number) => {
    const newSet = new Set(checkedReceiverIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setCheckedReceiverIds(newSet);
  };

  const toggleAllReceivers = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setCheckedReceiverIds(new Set(receivers.map(r => r.id)));
    } else {
      setCheckedReceiverIds(new Set());
    }
  };

  const handleDeleteChecked = () => {
    if (checkedReceiverIds.size === 0) {
      alert('삭제할 항목을 선택해주세요.');
      return;
    }
    if (confirm(`선택한 ${checkedReceiverIds.size}명을 목록에서 삭제하시겠습니까?`)) {
      setReceivers(receivers.filter(r => !checkedReceiverIds.has(r.id)));
      setCheckedReceiverIds(new Set());
    }
  };

  // --- Handlers: Send SMS ---
  const handleSendSms = () => {
    if (receivers.length === 0) {
      alert('수신자를 1명 이상 추가해주세요.');
      return;
    }
    if (!content) {
      alert('내용을 입력해주세요.');
      return;
    }

    if (confirm('전송하시겠습니까?')) {
      // 1. 이력 저장 (Mocking DB insert)
      const newItem: SmsHistoryItem = {
        id: historyList.length + 1,
        date: new Date().toISOString(),
        count: receivers.length,
        success: receivers.length, // 일단 전부 성공으로 가정
        fail: 0,
        refusal: 0,
        subject: subject || '(제목없음)'
      };

      setHistoryList([newItem, ...historyList]);

      // 2. 전송 완료 알림
      alert('전송 요청이 완료되었습니다.');

      // 3. 화면 초기화 (새로고침 효과)
      setSubject('');
      setContent('');
      setReceivers([]);
      setCheckedReceiverIds(new Set());
      setManualName('');
      setManualPhone('');
    }
  };

  // --- Handlers: Formatter ---
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  // --- Columns Definitions ---
  const receiverColumns: Column<Receiver>[] = [
    { 
      header: '선택', 
      accessor: (row) => (
        <input 
          type="checkbox" 
          checked={checkedReceiverIds.has(row.id)}
          onChange={() => toggleReceiverCheck(row.id)}
          className="w-4 h-4 accent-blue-500"
        />
      ), 
      width: '50px' 
    },
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '사용자ID', accessor: (row) => row.userId || '-', width: '120px' },
    { header: '이 름', accessor: 'name' },
    { header: '업체명', accessor: 'department' },
    { header: '연락처', accessor: 'phone' },
    { header: 'SMS 수신여부', accessor: 'smsReceive', width: '120px' },
  ];

  const modalColumns: Column<User>[] = [
    { 
      header: '선택', 
      accessor: (row) => (
        <input 
          type="checkbox" 
          checked={modalSelectedIds.has(row.id)}
          onChange={() => toggleModalUserSelect(row.id)}
          className="w-4 h-4 accent-blue-500"
        />
      ), 
      width: '100px' // Increased width to prevent wrapping (was 80px)
    },
    { header: '사용자ID', accessor: 'userId', width: '150px' }, // Increased width (was 140px)
    { header: '성명', accessor: 'name', width: '120px' },
    { header: '소속', accessor: 'department' }, // Flexible width
    { header: '연락처', accessor: 'phone', width: '200px' }, // Increased width (was 160px)
  ];

  const historyColumns: Column<SmsHistoryItem>[] = [
    { header: '번호', accessor: 'id', width: '80px' },
    { header: '전송일', accessor: (item) => formatDate(item.date), width: '180px' },
    { header: '전송 건수', accessor: 'count', width: '120px' },
    { header: '성공', accessor: 'success', width: '100px' },
    { header: '실패', accessor: 'fail', width: '100px' },
    { header: '수신거부', accessor: 'refusal', width: '150px' }, // Increased width to prevent wrapping (was 120px)
    { header: '문자 제목', accessor: 'subject' },
  ];

  // --- Render Views ---

  // 1. History View
  if (view === 'history') {
    // 날짜 필터링
    const filteredHistory = historyList.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.getFullYear() === currentDate.getFullYear() && 
               itemDate.getMonth() === currentDate.getMonth();
    });

    const historyLastIdx = historyPage * ITEMS_PER_PAGE;
    const historyFirstIdx = historyLastIdx - ITEMS_PER_PAGE;
    const currentHistory = filteredHistory.slice(historyFirstIdx, historyLastIdx);

    const historyRightContent = (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-4 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
           <button 
              onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
              className="text-slate-400 hover:text-white"
           >
              ◀
           </button>
           <span className="text-lg font-bold text-slate-200 min-w-[140px] text-center">
              {currentDate.getFullYear()}년 {String(currentDate.getMonth() + 1).padStart(2, '0')}월
           </span>
           <button 
              onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
              className="text-slate-400 hover:text-white"
           >
              ▶
           </button>
        </div>
        <Button onClick={() => setView('compose')} variant="secondary" className="h-[46px]" icon={<ArrowLeft size={16} />}>
           이전으로
        </Button>
      </div>
    );

    return (
      <>
        <PageHeader title="문자 전송" rightContent={historyRightContent} />

        <DataTable<SmsHistoryItem> columns={historyColumns} data={currentHistory} />
        <Pagination 
           totalItems={filteredHistory.length} 
           itemsPerPage={ITEMS_PER_PAGE} 
           currentPage={historyPage} 
           onPageChange={setHistoryPage} 
        />
      </>
    );
  }

  // 2. Compose View (Main)
  // Pagination logic for modal
  const modalLastIdx = modalPage * Modal_ITEMS_PER_PAGE_CONST;
  const modalFirstIdx = modalLastIdx - Modal_ITEMS_PER_PAGE_CONST;
  const currentModalUsers = userList.slice(modalFirstIdx, modalLastIdx);

  return (
    <>
      <PageHeader title="문자 전송" />

      {/* Main Grid Layout (1:2 Ratio) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-180px)]">
        
        {/* --- Left Column: Message Input (1 Share) --- */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-700 p-8">
           <div className="relative w-full max-w-[380px] h-[700px] bg-slate-800 rounded-[3rem] border-8 border-slate-700 shadow-2xl overflow-hidden flex flex-col">
              {/* Phone Speaker */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-700 rounded-b-xl z-10"></div>
              
              {/* Phone Header */}
              <div className="bg-slate-900 text-white p-4 pt-10 text-center border-b border-slate-700 font-bold">
                 SMS 전송
              </div>

              {/* Phone Body */}
              <div className="flex-1 p-5 flex flex-col gap-4 bg-slate-50 overflow-y-auto">
                 {/* Subject */}
                 <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 ml-1">제목</label>
                    <input 
                       type="text" 
                       value={subject}
                       onChange={(e) => setSubject(e.target.value)}
                       className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-slate-800 shadow-sm"
                       placeholder="제목을 입력하세요"
                    />
                 </div>

                 {/* Content */}
                 <div className="flex flex-col gap-1 flex-1">
                    <div className="flex justify-between items-end ml-1 mb-1">
                       <label className="text-xs font-bold text-slate-600">내용</label>
                       <span className={`text-[10px] ${currentBytes > maxBytes ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                          ({currentBytes} / {maxBytes} byte) {currentBytes > 80 ? 'LMS' : 'SMS'}
                       </span>
                    </div>
                    <textarea 
                       value={content}
                       onChange={(e) => setContent(e.target.value)}
                       className="w-full h-full min-h-[250px] p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:border-blue-500 bg-white text-slate-800 shadow-sm"
                       placeholder="전송할 내용을 입력하세요."
                    ></textarea>
                 </div>

                 {/* Sender Number */}
                 <div className="flex flex-col gap-1 mt-auto">
                    <label className="text-xs font-bold text-slate-600 ml-1">발신번호</label>
                    <input 
                       type="text" 
                       value={senderPhone}
                       onChange={(e) => setSenderPhone(e.target.value)}
                       className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-slate-800 font-medium text-center shadow-sm"
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* --- Right Column: Receiver Management (2 Shares) --- */}
        <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
           
           {/* Top Controls */}
           <div className="flex flex-col gap-4 bg-slate-800 p-5 rounded-lg border border-slate-700 shadow-sm mb-4">
              <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                 <h3 className="font-bold text-blue-400 flex items-center gap-2">
                    <UserPlus size={18} /> 수신자 정보 입력
                 </h3>
                 <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSendSms} className="h-8 text-xs bg-blue-600 hover:bg-blue-500" icon={<Send size={12}/>}>문자전송하기</Button>
                    <Button variant="secondary" onClick={() => setView('history')} className="h-8 text-xs" icon={<List size={12}/>}>전송 목록</Button>
                 </div>
              </div>
              
              <div className="flex flex-col gap-4">
                 <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-400">사용자 선택</label>
                    <Button onClick={openUserModal} variant="secondary" className="justify-start text-slate-300 border-slate-600 hover:bg-slate-700" icon={<UserPlus size={16}/>}>
                       사용자 목록에서 선택 추가
                    </Button>
                 </div>

                 <div className="flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                       <InputGroup label="수신자명" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="이름" />
                    </div>
                    <div className="flex-[2] w-full">
                       <InputGroup label="휴대폰번호" value={manualPhone} onChange={handleManualPhoneChange} placeholder="숫자만 입력" />
                    </div>
                    <Button onClick={handleAddManual} className="h-[38px] w-full md:w-auto bg-slate-600 hover:bg-slate-500">추가</Button>
                 </div>
              </div>
           </div>

           {/* Receiver List Table */}
           <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 shadow-sm overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                 <span className="text-sm font-bold text-slate-300">
                    전체 <span className="text-blue-400">{receivers.length}</span> 명
                 </span>
                 <div className="flex items-center gap-2">
                     <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                        <input type="checkbox" onChange={toggleAllReceivers} checked={receivers.length > 0 && checkedReceiverIds.size === receivers.length} className="w-4 h-4 accent-blue-500" />
                        전체선택
                     </label>
                 </div>
              </div>
              
              <div className="flex-1 overflow-auto custom-scrollbar relative">
                 <table className="min-w-full divide-y divide-slate-700">
                    <thead className="sticky top-0 z-10">
                       <tr>
                          {receiverColumns.map((col, idx) => (
                             <th key={idx} className={`${UI_STYLES.th} whitespace-nowrap`} style={{ width: col.width }}>{col.header}</th>
                          ))}
                       </tr>
                    </thead>
                    <tbody className="bg-slate-800 divide-y divide-slate-700">
                       {receivers.length > 0 ? (
                          receivers.map((row, idx) => (
                             <tr key={row.id} className="hover:bg-slate-700/30 transition-colors">
                                <td className={UI_STYLES.td}>
                                   <input 
                                      type="checkbox" 
                                      checked={checkedReceiverIds.has(row.id)}
                                      onChange={() => toggleReceiverCheck(row.id)}
                                      className="w-4 h-4 accent-blue-500"
                                   />
                                </td>
                                <td className={UI_STYLES.td}>{idx + 1}</td>
                                <td className={UI_STYLES.td}>{row.userId || '-'}</td>
                                <td className={UI_STYLES.td}>{row.name}</td>
                                <td className={UI_STYLES.td}>{row.department || '-'}</td>
                                <td className={UI_STYLES.td}>{row.phone}</td>
                                <td className={UI_STYLES.td}>
                                   <span className={`px-2 py-0.5 rounded text-xs ${row.smsReceive === '수신' ? 'bg-green-900/50 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                                      {row.smsReceive || '-'}
                                   </span>
                                </td>
                             </tr>
                          ))
                       ) : (
                          <tr>
                             <td colSpan={7} className="px-6 py-20 text-center text-slate-500">
                                <Smartphone size={40} className="mx-auto mb-2 opacity-20" />
                                수신자를 추가해주세요.
                             </td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
              
              {/* Bottom Actions */}
              <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-between items-center">
                 <Button variant="danger" onClick={handleDeleteChecked} icon={<Trash2 size={16}/>} disabled={checkedReceiverIds.size === 0}>
                    선택 삭제
                 </Button>
                 <Button variant="primary" onClick={handleSendSms} className="bg-blue-600 hover:bg-blue-500 px-8" icon={<Send size={16}/>}>
                    문자전송하기
                 </Button>
              </div>
           </div>
        </div>
      </div>

      {/* --- User Selection Modal --- */}
      <Modal 
        isOpen={isUserModalOpen} 
        onClose={() => setIsUserModalOpen(false)} 
        title="사용자 목록 (수신자 추가)" 
        width="max-w-5xl" // Increased Width
      >
         <SearchFilterBar onSearch={fetchUsers}>
            <InputGroup 
               label="성명" 
               value={modalSearchName}
               onChange={(e) => setModalSearchName(e.target.value)}
            />
            <InputGroup 
               label="소속(업체)" 
               value={modalSearchDept}
               onChange={(e) => setModalSearchDept(e.target.value)}
            />
         </SearchFilterBar>
         
         <div className="max-h-[500px] overflow-auto custom-scrollbar border rounded border-slate-700 mb-4">
             <DataTable<User> columns={modalColumns} data={currentModalUsers} />
         </div>

         <Pagination 
            totalItems={userList.length} 
            itemsPerPage={Modal_ITEMS_PER_PAGE_CONST} 
            currentPage={modalPage} 
            onPageChange={setModalPage}
         />

         <div className="flex justify-center gap-3 mt-6 border-t border-slate-700 pt-4">
            <Button variant="primary" onClick={handleAddSelectedUsers} className="w-32" disabled={modalSelectedIds.size === 0}>
               선택 추가 ({modalSelectedIds.size})
            </Button>
            <Button variant="secondary" onClick={() => setIsUserModalOpen(false)} className="w-32">취소</Button>
         </div>
      </Modal>
    </>
  );
};
