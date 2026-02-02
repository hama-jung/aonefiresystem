import React, { useState, useEffect } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, Button, DataTable, 
  Pagination, Column, Modal, UI_STYLES, ITEMS_PER_PAGE,
  DateRangePicker, validateDateRange 
} from '../components/CommonUI';
import { FireHistoryItem, CommonCode } from '../types';
import { FireHistoryAPI, CommonCodeAPI } from '../services/api';
import { FileSpreadsheet, Trash2 } from 'lucide-react';
import { exportToExcel } from '../utils/excel';

export const FireHistoryManagement: React.FC = () => {
  const [historyList, setHistoryList] = useState<FireHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [codeMap, setCodeMap] = useState<Record<string, string>>({});

  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(formatDate(oneMonthAgo));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [searchMarket, setSearchMarket] = useState('');
  const [searchStatus, setSearchStatus] = useState<'all' | 'fire' | 'false'>('all');
  
  const [isFiltered, setIsFiltered] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FireHistoryItem | null>(null);
  const [modalType, setModalType] = useState<'화재' | '오탐'>('화재');
  const [modalMemo, setModalMemo] = useState('');

  const getStatusName = (code: string) => {
    return codeMap[code] || code;
  };

  const getStatusColor = (name: string) => {
    if (name.includes('화재')) return 'text-red-400 font-bold';
    if (name.includes('고장') || name.includes('단선') || name.includes('오류')) return 'text-orange-400 font-bold';
    if (name.includes('해소') || name.includes('정상') || name.includes('복구')) return 'text-blue-400';
    return 'text-slate-300';
  };

  const initData = async () => {
    setLoading(true);
    try {
        const [codes, history] = await Promise.all([
            CommonCodeAPI.getList(), 
            FireHistoryAPI.getList({ 
                startDate: formatDate(oneMonthAgo),
                endDate: formatDate(today)
            }) 
        ]);

        const map: Record<string, string> = {};
        codes.forEach((c: CommonCode) => {
            map[c.code] = c.name;
        });
        setCodeMap(map);
        
        setHistoryList(history);
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

  const handleSearch = async () => {
    if (!validateDateRange(startDate, endDate)) {
        return;
    }
    
    setIsFiltered(true);
    
    setLoading(true);
    try {
        const data = await FireHistoryAPI.getList({
            startDate,
            endDate,
            marketName: searchMarket,
            status: searchStatus
        });
        setHistoryList(data);
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
        const data = await FireHistoryAPI.getList({
            startDate: resetStart,
            endDate: resetEnd
        });
        setHistoryList(data);
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
            await Promise.all(Array.from(selectedIds).map((id: number) => FireHistoryAPI.delete(id)));
            alert("삭제되었습니다.");
            setSelectedIds(new Set());
            const data = await FireHistoryAPI.getList({
                startDate,
                endDate,
                marketName: searchMarket,
                status: searchStatus
            });
            setHistoryList(data);
        } catch (e: any) {
            alert(`삭제 실패: ${e.message}`);
        }
    }
  };

  const handleExcel = () => {
    const excelData = historyList.map(item => ({
        ...item,
        receiverStatusName: getStatusName(item.receiverStatus),
        repeaterStatusName: getStatusName(item.repeaterStatus)
    }));
    exportToExcel(excelData, '화재이력관리_목록');
  };

  const toggleCheck = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        setSelectedIds(new Set(historyList.map(item => item.id)));
    } else {
        setSelectedIds(new Set());
    }
  };

  const openModal = (item: FireHistoryItem) => {
    setSelectedItem(item);
    setModalType((item.falseAlarmStatus === '오탐' ? '오탐' : '화재'));
    setModalMemo(item.note || '');
    setIsModalOpen(true);
  };

  const handleModalSave = async () => {
    if (selectedItem) {
        try {
            await FireHistoryAPI.save(selectedItem.id, modalType, modalMemo);
            alert("저장되었습니다.");
            setIsModalOpen(false);
            
            const data = await FireHistoryAPI.getList({
                startDate,
                endDate,
                marketName: searchMarket,
                status: searchStatus
            });
            setHistoryList(data);
        } catch (e: any) {
            alert(`저장 실패: ${e.message}`);
        }
    }
  };

  const columns: Column<FireHistoryItem>[] = [
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
    { header: '수신기 MAC', accessor: 'receiverMac' },
    { 
        header: '수신기상태', 
        accessor: (item) => {
            const name = getStatusName(item.receiverStatus);
            return <span className={getStatusColor(name)}>{name}</span>;
        }
    },
    { header: '중계기 ID', accessor: 'repeaterId' },
    { 
        header: '중계기상태', 
        accessor: (item) => {
            const name = getStatusName(item.repeaterStatus);
            return <span className={getStatusColor(name)}>{name}</span>;
        }
    },
    { 
        header: '감지기ID_챔버', 
        accessor: (item) => item.detectorInfoChamber || '' 
    },
    { 
        header: '감지기ID_온도', 
        accessor: (item) => item.detectorInfoTemp || '' 
    },
    { header: '등록자', accessor: 'registrar' },
    { 
        header: '등록일', 
        accessor: (item) => item.registeredAt ? new Date(item.registeredAt).toLocaleString() : '-', 
        width: '180px' 
    },
    { 
        header: '오탐여부', 
        accessor: (item) => (
            <button 
                onClick={(e) => { e.stopPropagation(); openModal(item); }}
                className={`text-sm hover:underline ${
                    item.falseAlarmStatus === '등록' ? 'text-slate-400' :
                    item.falseAlarmStatus === '화재' ? 'text-red-400 font-bold' :
                    'text-orange-400 font-bold'
                }`}
            >
                [{item.falseAlarmStatus}]
            </button>
        ),
        width: '100px'
    },
  ];

  const currentItems = historyList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <PageHeader title="화재 이력 관리" />
      
      <SearchFilterBar onSearch={handleSearch} onReset={handleReset} isFiltered={isFiltered}>
        <DateRangePicker 
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
        />
        
        <InputGroup label="설치시장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />

        <div className="flex flex-col gap-1.5 w-full">
            <label className={UI_STYLES.label}>화재여부</label>
            <div className={`${UI_STYLES.input} flex gap-4 items-center`}>
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="radio" checked={searchStatus === 'all'} onChange={() => setSearchStatus('all')} className="accent-blue-500 w-4 h-4"/>
                    <span>전체</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="radio" checked={searchStatus === 'fire'} onChange={() => setSearchStatus('fire')} className="accent-blue-500 w-4 h-4"/>
                    <span>화재</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="radio" checked={searchStatus === 'false'} onChange={() => setSearchStatus('false')} className="accent-blue-500 w-4 h-4"/>
                    <span>오탐</span>
                </label>
            </div>
        </div>
      </SearchFilterBar>

      <div className="flex justify-between items-center mb-2">
         <span className="text-sm font-bold text-slate-300">
           전체 {historyList.length} 개 (페이지 {currentPage})
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
                            <input type="checkbox" onChange={toggleAll} checked={selectedIds.size > 0 && selectedIds.size === historyList.length} className="w-4 h-4 accent-blue-500" />
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
                                    {typeof col.accessor === 'function' ? col.accessor(item, index) : (item as any)[col.accessor]}
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
                totalItems={historyList.length}
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
                        <input type="radio" checked={modalType === '화재'} onChange={() => setModalType('화재')} className="accent-blue-500 w-5 h-5"/>
                        화재
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input type="radio" checked={modalType === '오탐'} onChange={() => setModalType('오탐')} className="accent-blue-500 w-5 h-5"/>
                        오탐
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