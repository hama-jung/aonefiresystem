import React, { useState, useEffect } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, Button, DataTable, 
  Pagination, Column, Modal, UI_STYLES, ITEMS_PER_PAGE,
  DateRangePicker, validateDateRange 
} from '../components/CommonUI';
import { usePageTitle } from '../components/Layout'; // Import Hook
import { DeviceStatusItem, CommonCode } from '../types';
import { DeviceStatusAPI, CommonCodeAPI } from '../services/api';
import { FileSpreadsheet, Trash2 } from 'lucide-react';
import { exportToExcel } from '../utils/excel';

export const DeviceStatusManagement: React.FC = () => {
  const pageTitle = usePageTitle('기기 상태 관리'); 
  
  const [statusList, setStatusList] = useState<DeviceStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Common Code Map (Code -> Name)
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});

  // --- Search Filters ---
  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(formatDate(oneMonthAgo));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [searchMarket, setSearchMarket] = useState('');
  const [searchStatus, setSearchStatus] = useState<'all' | 'processed' | 'unprocessed'>('all');
  
  const [isFiltered, setIsFiltered] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DeviceStatusItem | null>(null);
  const [modalStatus, setModalStatus] = useState<'처리' | '미처리'>('미처리');
  const [modalMemo, setModalMemo] = useState('');

  // --- Helpers ---
  const getErrorName = (code: string) => codeMap[code] || code;

  // --- Initial Data Load ---
  const initData = async () => {
    setLoading(true);
    try {
      const [codes, list] = await Promise.all([
        CommonCodeAPI.getList(),
        DeviceStatusAPI.getList({
            startDate: formatDate(oneMonthAgo),
            endDate: formatDate(today)
        })
      ]);

      const map: Record<string, string> = {};
      codes.forEach((c: CommonCode) => {
        map[c.code] = c.name;
      });
      setCodeMap(map);

      setStatusList(list);
      setCurrentPage(1);

    } catch (e: any) {
        if (e.message && e.message.includes('Could not find the table')) {
            console.warn('DB 테이블 확인이 필요합니다.');
        } else {
            alert('데이터 로드 실패: ' + e.message);
        }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initData();
  }, []);

  // --- Handlers ---
  const handleSearch = async () => {
    if (!validateDateRange(startDate, endDate)) return;

    setIsFiltered(true);
    setLoading(true);
    try {
        const data = await DeviceStatusAPI.getList({
            startDate,
            endDate,
            marketName: searchMarket,
            status: searchStatus
        });
        setStatusList(data);
        setCurrentPage(1);
    } catch(e) {
        console.error(e);
        alert('검색 중 오류가 발생했습니다.');
    } finally {
        setLoading(false);
    }
  };

  const handleReset = async () => {
    const resetStart = formatDate(oneMonthAgo);
    const resetEnd = formatDate(today);
    
    setStartDate(resetStart);
    setEndDate(resetEnd);
    setSearchMarket('');
    setSearchStatus('all');
    setIsFiltered(false);

    setLoading(true);
    try {
        const data = await DeviceStatusAPI.getList({
            startDate: resetStart,
            endDate: resetEnd
        });
        setStatusList(data);
        setCurrentPage(1);
    } catch(e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) {
        alert("삭제할 항목을 선택해주세요.");
        return;
    }
    if (confirm(`선택한 ${selectedIds.size}개 항목을 삭제하시겠습니까?`)) {
        try {
            await Promise.all(Array.from(selectedIds).map((id: number) => DeviceStatusAPI.delete(id)));
            alert("삭제되었습니다.");
            setSelectedIds(new Set());
            handleSearch(); 
        } catch (e: any) {
            alert(`삭제 실패: ${e.message}`);
        }
    }
  };

  const handleExcel = () => {
    const excelData = statusList.map(item => ({
        ...item,
        deviceErrorName: getErrorName(item.errorCode)
    }));
    exportToExcel(excelData, '기기상태관리_목록');
  };

  const toggleCheck = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        setSelectedIds(new Set(statusList.map(item => item.id)));
    } else {
        setSelectedIds(new Set());
    }
  };

  const openModal = (item: DeviceStatusItem) => {
    setSelectedItem(item);
    setModalStatus(item.processStatus);
    setModalMemo(item.note || '');
    setIsModalOpen(true);
  };

  const handleModalSave = async () => {
    if (selectedItem) {
        try {
            await DeviceStatusAPI.save(selectedItem.id, modalStatus, modalMemo);
            alert("저장되었습니다.");
            setIsModalOpen(false);
            handleSearch(); 
        } catch (e: any) {
            alert(`저장 실패: ${e.message}`);
        }
    }
  };

  const columns: Column<DeviceStatusItem>[] = [
    { 
        header: '선택', 
        accessor: (item) => (
            <input 
                type="checkbox" 
                checked={selectedIds.has(item.id)} 
                onChange={() => toggleCheck(item.id)}
                className="w-4 h-4 accent-blue-500"
            />
        ),
        width: '50px' 
    },
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { header: '시장명', accessor: 'marketName' },
    { header: '수신기 MAC', accessor: 'receiverMac', width: '120px' },
    { header: '중계기 ID', accessor: 'repeaterId', width: '100px' },
    { header: '기기 구분', accessor: 'deviceType', width: '100px' },
    { header: '기기 ID', accessor: 'deviceId', width: '100px' },
    { header: '기기 상태', accessor: (item) => (
        <span className={item.deviceStatus === '에러' ? 'text-red-400 font-bold' : 'text-blue-400'}>{item.deviceStatus}</span>
    ), width: '100px' },
    { header: '기기 에러 내용', accessor: (item) => getErrorName(item.errorCode) },
    { 
        header: '등록일', 
        accessor: (item) => item.registeredAt ? new Date(item.registeredAt).toLocaleString() : '-', 
        width: '180px' 
    },
    { 
        header: '처리 결과', 
        accessor: (item) => (
            <button 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    openModal(item); 
                }}
                className={`text-sm font-bold hover:underline cursor-pointer ${
                    item.processStatus === '미처리' ? 'text-blue-400' : 'text-green-400'
                }`}
            >
                [{item.processStatus}]
            </button>
        ),
        width: '100px'
    },
  ];

  const currentItems = statusList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <PageHeader title={pageTitle} />
      
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <DateRangePicker 
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
        />
        <InputGroup label="설치시장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
        <div className="flex flex-col gap-1.5 w-full">
            <label className={UI_STYLES.label}>처리여부</label>
            <div className={`${UI_STYLES.input} flex gap-4 items-center`}>
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="radio" checked={searchStatus === 'all'} onChange={() => setSearchStatus('all')} className="accent-blue-500 w-4 h-4"/>
                    <span>전체</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="radio" checked={searchStatus === 'processed'} onChange={() => setSearchStatus('processed')} className="accent-blue-500 w-4 h-4"/>
                    <span>처리</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="radio" checked={searchStatus === 'unprocessed'} onChange={() => setSearchStatus('unprocessed')} className="accent-blue-500 w-4 h-4"/>
                    <span>미처리</span>
                </label>
            </div>
        </div>
      </SearchFilterBar>

      <div className="flex justify-between items-center mb-2">
         <span className="text-sm font-bold text-slate-300">
           전체 {statusList.length} 개 (페이지 {currentPage})
         </span>
         <div className="flex gap-2">
            <Button variant="success" onClick={handleExcel} icon={<FileSpreadsheet size={16} />}>엑셀다운로드</Button>
         </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="min-w-full divide-y divide-slate-700 bg-slate-800">
                <thead>
                    <tr>
                        <th className={UI_STYLES.th} style={{width:'50px'}}>
                            <input type="checkbox" onChange={toggleAll} checked={selectedIds.size > 0 && selectedIds.size === statusList.length} className="w-4 h-4 accent-blue-500" />
                        </th>
                        {columns.slice(1).map((col, idx) => (
                            <th key={idx} className={UI_STYLES.th} style={{width: col.width}}>{col.header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {currentItems.length > 0 ? currentItems.map((item, index) => (
                        <tr key={item.id} className="hover:bg-slate-700/50 transition-colors">
                            <td className={UI_STYLES.td}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.has(item.id)} 
                                    onChange={() => toggleCheck(item.id)}
                                    className="w-4 h-4 accent-blue-500"
                                />
                            </td>
                            {columns.slice(1).map((col, idx) => (
                                <td key={idx} className={UI_STYLES.td}>
                                    <div className="truncate" title={typeof col.accessor === 'string' ? (item as any)[col.accessor] : ''}>
                                        {typeof col.accessor === 'function' ? col.accessor(item, index) : (item as any)[col.accessor]}
                                    </div>
                                </td>
                            ))}
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={columns.length} className="px-6 py-10 text-center text-slate-500">데이터가 없습니다.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-4 gap-4">
          <div>
             <Button variant="danger" onClick={handleDelete} icon={<Trash2 size={16} />}>삭제</Button>
          </div>
          <div className="flex-1 flex justify-center w-full md:w-auto">
             <Pagination 
                totalItems={statusList.length}
                itemsPerPage={ITEMS_PER_PAGE}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
             />
          </div>
          <div className="w-[74px] hidden md:block"></div> 
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="등록 팝업" width="max-w-md">
         <div className="flex flex-col gap-6 p-2">
            <div className="flex items-center gap-6">
                <label className="w-16 font-bold text-slate-300">선택</label>
                <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input type="radio" checked={modalStatus === '미처리'} onChange={() => setModalStatus('미처리')} className="accent-blue-500 w-5 h-5"/>
                        미처리
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input type="radio" checked={modalStatus === '처리'} onChange={() => setModalStatus('처리')} className="accent-blue-500 w-5 h-5"/>
                        처리
                    </label>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <label className="w-16 font-bold text-slate-300">비고</label>
                <input 
                    type="text" 
                    value={modalMemo} 
                    onChange={(e) => setModalMemo(e.target.value)} 
                    className={`${UI_STYLES.input} flex-1`}
                />
            </div>
            <div className="flex justify-center gap-3 mt-4">
                <Button variant="primary" onClick={handleModalSave} className="w-24">저장</Button>
                <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-24">취소</Button>
            </div>
         </div>
      </Modal>
    </>
  );
};