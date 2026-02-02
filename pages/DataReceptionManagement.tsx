import React, { useState, useEffect } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, Button, DataTable, 
  Pagination, Column, UI_STYLES, ITEMS_PER_PAGE,
  DateRangePicker, validateDateRange 
} from '../components/CommonUI';
import { usePageTitle } from '../components/Layout'; // Import Hook
import { DataReceptionItem } from '../types';
import { DataReceptionAPI } from '../services/api';
import { Trash2 } from 'lucide-react';

export const DataReceptionManagement: React.FC = () => {
  const pageTitle = usePageTitle('데이터 수신 관리'); 

  const [dataList, setDataList] = useState<DataReceptionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // --- Search Filters ---
  const today = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7); 

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(formatDate(oneWeekAgo));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [searchMarket, setSearchMarket] = useState('');
  
  const [isFiltered, setIsFiltered] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // --- Initial Data Load ---
  const initData = async () => {
    setLoading(true);
    try {
      const list = await DataReceptionAPI.getList({
          startDate: formatDate(oneWeekAgo),
          endDate: formatDate(today)
      });
      setDataList(list);
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
        const data = await DataReceptionAPI.getList({
            startDate,
            endDate,
            marketName: searchMarket
        });
        setDataList(data);
        setCurrentPage(1);
        setSelectedIds(new Set()); 
    } catch(e) {
        console.error(e);
        alert('검색 중 오류가 발생했습니다.');
    } finally {
        setLoading(false);
    }
  };

  const handleReset = async () => {
    const resetStart = formatDate(oneWeekAgo);
    const resetEnd = formatDate(today);
    
    setStartDate(resetStart);
    setEndDate(resetEnd);
    setSearchMarket('');
    setIsFiltered(false);

    setLoading(true);
    try {
        const data = await DataReceptionAPI.getList({
            startDate: resetStart,
            endDate: resetEnd
        });
        setDataList(data);
        setCurrentPage(1);
        setSelectedIds(new Set());
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
            await Promise.all(Array.from(selectedIds).map((id: number) => DataReceptionAPI.delete(id)));
            alert("삭제되었습니다.");
            setSelectedIds(new Set());
            handleSearch(); 
        } catch (e: any) {
            alert(`삭제 실패: ${e.message}`);
        }
    }
  };

  const toggleCheck = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        setSelectedIds(new Set(dataList.map(item => item.id)));
    } else {
        setSelectedIds(new Set());
    }
  };

  const columns: Column<DataReceptionItem>[] = [
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
    { header: '설치시장', accessor: 'marketName', width: '120px' },
    { header: '로그유형', accessor: 'logType', width: '100px' }, 
    { header: '수신기', accessor: 'receiverId', width: '80px' },
    { header: '중계기', accessor: 'repeaterId', width: '80px' },
    { header: '수신데이터', accessor: 'receivedData', width: '300px' },
    { header: '감지기통신상태', accessor: 'commStatus', width: '180px' },
    { header: '감지기배터리상태', accessor: 'batteryStatus', width: '180px' },
    { header: '감지기챔버상태', accessor: 'chamberStatus', width: '180px' },
    { 
        header: '등록일', 
        accessor: (item) => {
            if (!item.registeredAt) return '-';
            const dateStr = item.registeredAt.replace('T', ' ').substring(0, 19);
            const [date, time] = dateStr.split(' ');
            return (
                <div className="flex flex-col items-center justify-center leading-tight">
                    <span className="text-xs text-slate-200">{date}</span>
                    <span className="text-[11px] text-slate-400">{time}</span>
                </div>
            );
        },
        width: '110px' 
    },
  ];

  const currentItems = dataList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
      </SearchFilterBar>

      <div className="flex justify-between items-center mb-2">
         <span className="text-sm font-bold text-slate-300">
           전체 {dataList.length} 개 (페이지 {currentPage})
         </span>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="min-w-full divide-y divide-slate-700 bg-slate-800">
                <thead>
                    <tr>
                        <th className={UI_STYLES.th} style={{width:'50px'}}>
                            <input type="checkbox" onChange={toggleAll} checked={selectedIds.size > 0 && selectedIds.size === dataList.length} className="w-4 h-4 accent-blue-500" />
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
                totalItems={dataList.length}
                itemsPerPage={ITEMS_PER_PAGE}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
             />
          </div>
          <div className="w-[74px] hidden md:block"></div> 
      </div>
    </>
  );
};