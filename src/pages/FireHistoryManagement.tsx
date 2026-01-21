import React, { useState, useEffect } from 'react';
import { 
  PageHeader, SearchFilterBar, InputGroup, Button, DataTable, 
  Pagination, Column, Modal, UI_STYLES
} from '../components/CommonUI';
import { FireHistoryItem, CommonCode } from '../types';
import { FireHistoryAPI, CommonCodeAPI } from '../services/api';
import { FileSpreadsheet, Trash2 } from 'lucide-react';
import { exportToExcel } from '../utils/excel';

const ITEMS_PER_PAGE = 30;

export const FireHistoryManagement: React.FC = () => {
  const [historyList, setHistoryList] = useState<FireHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // 공통코드 매핑 상태 (DB에서 가져온 코드 -> 명칭)
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});

  // Search Filters
  // Default range: 1 month
  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(formatDate(oneMonthAgo));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [searchMarket, setSearchMarket] = useState('');
  const [searchStatus, setSearchStatus] = useState<'all' | 'fire' | 'false'>('all');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FireHistoryItem | null>(null);
  const [modalType, setModalType] = useState<'화재' | '오탐'>('화재');
  const [modalMemo, setModalMemo] = useState('');

  // --- Helpers ---
  
  // 공통코드 매핑 함수 (DB 데이터를 사용)
  const getStatusName = (code: string) => {
    // 코드가 맵에 있으면 명칭 반환, 없으면 코드 그대로 반환
    return codeMap[code] || code;
  };

  // 상태값에 따른 텍스트 색상 결정
  const getStatusColor = (name: string) => {
    if (name.includes('화재')) return 'text-red-400 font-bold';
    if (name.includes('고장') || name.includes('단선') || name.includes('오류')) return 'text-orange-400 font-bold';
    if (name.includes('해소') || name.includes('정상') || name.includes('복구')) return 'text-blue-400';
    return 'text-slate-300';
  };

  // 초기 데이터 로드 (이력 + 공통코드 병렬 조회)
  const initData = async () => {
    setLoading(true);
    try {
        const [codes, history] = await Promise.all([
            CommonCodeAPI.getList(), // 전체 공통코드 조회
            FireHistoryAPI.getList() // 화재 이력 조회
        ]);

        // 코드 맵 생성 (code -> name)
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

  // --- Handlers ---
  const handleSearch = async () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 31) {
        alert("기간은 최대 1달까지만 설정할 수 있습니다.");
        return;
    }
    
    // 단순 목록 갱신 (실제 검색 필터링은 API단에서 처리 필요하나 여기선 예시로 getList 호출)
    setLoading(true);
    try {
        const data = await FireHistoryAPI.getList();
        setHistoryList(data);
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
            await Promise.all(Array.from(selectedIds).map(id => FireHistoryAPI.delete(id)));
            alert("삭제되었습니다.");
            setSelectedIds(new Set());
            // 새로고침 (데이터만)
            const data = await FireHistoryAPI.getList();
            setHistoryList(data);
        } catch (e: any) {
            alert(`삭제 실패: ${e.message}`);
        }
    }
  };

  const handleExcel = () => {
    // 엑셀 다운로드 시 코드가 아닌 명칭으로 변환하여 내보내기
    const excelData = historyList.map(item => ({
        ...item,
        receiverStatusName: getStatusName(item.receiverStatus),
        repeaterStatusName: getStatusName(item.repeaterStatus)
    }));
    exportToExcel(excelData, '화재이력관리_목록');
  };

  // Checkbox logic
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

  // Modal Logic
  const openModal = (item: FireHistoryItem) => {
    setSelectedItem(item);
    // Set initial values from existing item if available
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
            // 목록 갱신
            const data = await FireHistoryAPI.getList();
            setHistoryList(data);
        } catch (e: any) {
            alert(`저장 실패: ${e.message}`);
        }
    }
  };

  // --- Columns ---
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
      <PageHeader title="화재이력관리" />
      
      {/* Disclaimer */}
      <div className="bg-orange-900/20 border border-orange-800 text-orange-200 px-4 py-2 rounded mb-6 text-sm flex items-center">
        ⚠️ 공통코드 관리 메뉴에 등록된 코드명(예: 화재알람, 화재해소)과 연동되어 표시됩니다.
      </div>

      {/* Search Filter Bar */}
      <SearchFilterBar onSearch={handleSearch}>
        {/* 기간 검색 */}
        <div className="min-w-[300px]">
            <label className={UI_STYLES.label}>기간</label>
            <div className="flex items-center gap-2">
                <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className={UI_STYLES.input} 
                />
                <span className="text-slate-400">~</span>
                <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className={UI_STYLES.input} 
                />
            </div>
        </div>
        
        {/* 설치시장 검색 */}
        <div className="min-w-[200px]">
            <InputGroup label="설치시장" value={searchMarket} onChange={(e) => setSearchMarket(e.target.value)} />
        </div>

        {/* 화재여부 라디오 버튼 */}
        <div className="min-w-[300px]">
            <label className={UI_STYLES.label}>화재여부</label>
            <div className="flex gap-4 items-center h-[42px] px-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                    <input type="radio" checked={searchStatus === 'all'} onChange={() => setSearchStatus('all')} className="accent-blue-500 w-4 h-4"/> 전체
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                    <input type="radio" checked={searchStatus === 'fire'} onChange={() => setSearchStatus('fire')} className="accent-blue-500 w-4 h-4"/> 화재
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                    <input type="radio" checked={searchStatus === 'false'} onChange={() => setSearchStatus('false')} className="accent-blue-500 w-4 h-4"/> 오탐
                </label>
            </div>
        </div>
      </SearchFilterBar>

      {/* List Header Actions */}
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

      {/* Bottom Actions and Pagination */}
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
          {/* Spacer to balance the layout if needed, or keeping it empty for now */}
          <div className="w-[74px] hidden md:block"></div> 
      </div>

      {/* Modal */}
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
