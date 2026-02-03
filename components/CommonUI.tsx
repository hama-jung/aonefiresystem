
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Search, Plus, FileSpreadsheet, Trash2, Edit, Save, X, Home, RotateCcw } from 'lucide-react';
import { MarketAPI, ReceiverAPI } from '../services/api';
import { Market, Receiver } from '../types';

// --- Constants ---
export const ITEMS_PER_PAGE = 10;

// --- Colors & Styles Constants (Dark Mode) ---
export const UI_STYLES = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm border border-transparent', 
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 shadow-sm',
  danger: 'bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-800 shadow-sm',
  success: 'bg-green-700 hover:bg-green-600 text-white shadow-sm border border-transparent',
  input: 'bg-slate-800 border border-slate-600 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm w-full text-slate-200 placeholder-slate-500',
  label: 'block text-sm font-semibold text-slate-300 mb-1.5',
  th: 'px-4 py-3 bg-slate-900 text-center text-sm font-semibold text-slate-400 border-b border-slate-700',
  td: 'px-4 py-3 text-sm text-center text-slate-300 border-b border-slate-700/50 group-hover:bg-slate-700/30',
};

// --- Utilities ---
export const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, "");
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;
};

export const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  const allowedKeys = [
    "Backspace", "Tab", "ArrowLeft", "ArrowRight", "Delete", "Enter"
  ];
  if (!/^[0-9]$/.test(e.key) && !allowedKeys.includes(e.key)) {
    e.preventDefault();
  }
};

export const validateDateRange = (startDate: string, endDate: string) => {
  if (startDate > endDate) {
    alert("시작일은 종료일보다 클 수 없습니다.");
    return false;
  }
  return true;
};

// --- Buttons ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', icon, children, ...props }) => {
  const baseStyle = "inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const variantStyle = UI_STYLES[variant];
  
  return (
    <button className={`${baseStyle} ${variantStyle} ${className}`} {...props}>
      {icon && <span className="mr-2 h-4 w-4">{icon}</span>}
      {children}
    </button>
  );
};

// --- Page Header ---
export const PageHeader: React.FC<{ title: string; rightContent?: React.ReactNode }> = ({ title, rightContent }) => (
  <div className="mb-6 flex items-center justify-between border-b border-slate-700 pb-4">
    <h1 className="text-xl font-bold text-slate-100">
      {title}
    </h1>
    {rightContent}
  </div>
);

// --- Search Filter Bar ---
interface SearchFilterBarProps {
  children: React.ReactNode;
  onSearch: () => void;
  onReset?: () => void;
  isFiltered?: boolean;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({ 
  children, onSearch, onReset, isFiltered = false,
}) => (
  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700 shadow-sm mb-5">
    <div className="flex flex-col xl:flex-row gap-4 xl:items-end">
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:items-end w-full lg:[&>*]:flex-1 lg:[&>*]:min-w-0 flex-wrap">
        {children}
      </div>
      <div className="flex-shrink-0 flex gap-2 pt-2 xl:pt-0 justify-end xl:justify-start">
        <Button onClick={onSearch} icon={<Search size={18} />} className="w-full md:w-auto">검색</Button>
        {onReset && isFiltered && (
          <Button onClick={onReset} variant="secondary" icon={<RotateCcw size={18} />} className="w-full md:w-auto">전체보기</Button>
        )}
      </div>
    </div>
  </div>
);

// --- Inputs ---
interface InputGroupProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  inputClassName?: string;
}
export const InputGroup = React.forwardRef<HTMLInputElement, InputGroupProps>(
  ({ label, className = '', inputClassName = '', ...props }, ref) => (
  <div className={`flex flex-col w-full ${className}`}>
    {label && <label className={UI_STYLES.label}>{label}</label>}
    <input ref={ref} className={`${UI_STYLES.input} ${inputClassName}`} {...props} />
  </div>
));
InputGroup.displayName = "InputGroup";

interface SelectGroupProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string | number; label: string }[];
}
export const SelectGroup: React.FC<SelectGroupProps> = ({ label, options, className = '', ...props }) => (
  <div className={`flex flex-col w-full ${className}`}>
    {label && <label className={UI_STYLES.label}>{label}</label>}
    <select 
      className={`${UI_STYLES.input} appearance-none pr-8 bg-no-repeat`} 
      style={{
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundSize: '1.5em 1.5em'
      }}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// --- Additional Components ---

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center justify-center px-2 py-1 rounded-sm text-xs font-bold border whitespace-nowrap shadow-sm min-w-[50px] ${
    status === '사용' || status === 'Normal' || status === '정상' || status === '처리'
      ? 'bg-green-900/30 text-green-400 border-green-800' 
      : (status === 'Fire' || status === '화재' || status === '에러' || status === '오탐') 
        ? 'bg-red-900/30 text-red-400 border-red-800'
        : 'bg-slate-700 text-slate-400 border-slate-600'
  }`}>
    {status}
  </span>
);

export const StatusRadioGroup: React.FC<{
  label?: string;
  name?: string;
  value: string | undefined;
  onChange: (val: string) => void;
  options?: string[];
}> = ({ label, name, value, onChange, options = ['사용', '미사용'] }) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className={UI_STYLES.label}>{label}</label>}
    <div className={`${UI_STYLES.input} flex gap-4 items-center`}>
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer hover:text-white">
          <input 
            type="radio" 
            name={name} 
            value={opt} 
            checked={value === opt} 
            onChange={() => onChange(opt)} 
            className="accent-blue-500 w-4 h-4" 
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  </div>
);

export const DateRangePicker: React.FC<{
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
}> = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => (
  <div className="flex items-center gap-2">
    <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-slate-300 ml-1">시작일</label>
        <input 
            type="date" 
            value={startDate} 
            onChange={(e) => onStartDateChange(e.target.value)} 
            className={`${UI_STYLES.input} w-[160px] [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer`} 
        />
    </div>
    <span className="text-slate-400 mt-6 font-bold">~</span>
    <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-slate-300 ml-1">종료일</label>
        <input 
            type="date" 
            value={endDate} 
            onChange={(e) => onEndDateChange(e.target.value)} 
            className={`${UI_STYLES.input} w-[160px] [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer`} 
        />
    </div>
  </div>
);

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, icon, children, width = 'max-w-md' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
      <div 
        className={`bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full ${width} overflow-hidden transform transition-all scale-100 opacity-100 flex flex-col max-h-[90vh]`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-2.5 text-slate-100 font-bold text-lg">
            {icon}
            <span>{title}</span>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Address Search Modal (Daum Postcode API - EMBED METHOD) ---
interface AddressSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { address: string; zonecode: string; buildingName: string; coordinates?: {lat: string, lng: string} }) => void;
}

declare global {
  interface Window {
    daum: any;
    kakao: any;
  }
}

export const AddressSearchModal: React.FC<AddressSearchModalProps> = ({ isOpen, onClose, onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !window.daum) {
      if (isOpen && !window.daum) {
        alert("주소 검색 서비스를 불러올 수 없습니다. 네트워크 연결을 확인해주세요.");
        onClose();
      }
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    try {
      new window.daum.Postcode({
        oncomplete: function(data: any) {
          let addr = ''; 
          let extraAddr = ''; 

          if (data.userSelectedType === 'R') { 
            addr = data.roadAddress;
          } else { 
            addr = data.jibunAddress;
          }

          if(data.buildingName !== '' && data.apartment === 'Y'){
             extraAddr += (extraAddr !== '' ? ', ' + data.buildingName : data.buildingName);
          }
          if(extraAddr !== ''){
             addr += ' (' + extraAddr + ')';
          }

          const handleSuccess = (coords: {lat: string, lng: string} | undefined) => {
             onComplete({
                address: addr,
                zonecode: data.zonecode,
                buildingName: data.buildingName,
                coordinates: coords
             });
          };

          // 주소 좌표 변환 (Kakao Map Geocoder)
          if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
             const geocoder = new window.kakao.maps.services.Geocoder();
             geocoder.addressSearch(addr, function(result: any, status: any) {
                 if (status === window.kakao.maps.services.Status.OK) {
                     handleSuccess({ lat: result[0].y, lng: result[0].x });
                 } else {
                     handleSuccess(undefined);
                 }
             });
          } else {
             handleSuccess(undefined);
          }
        },
        width: '100%',
        height: '100%',
        autoClose: false,
        animation: false,
        // [New] Theme configuration for Dark Mode
        theme: {
            bgColor: "#1E293B", // slate-800 (배경)
            searchBgColor: "#0F172A", // slate-900 (검색창 배경)
            contentBgColor: "#1E293B", // slate-800 (리스트 배경)
            pageBgColor: "#1E293B", // slate-800 (페이지 배경)
            textColor: "#E2E8F0", // slate-200 (글자)
            queryTextColor: "#FFFFFF", // white (검색창 글자)
            postcodeTextColor: "#60A5FA", // blue-400 (우편번호)
            emphTextColor: "#60A5FA", // blue-400 (강조)
            outlineColor: "#334155" // slate-700 (테두리)
        }
      }).embed(container);
    } catch (error) {
      console.error("Daum Postcode Embed Error:", error);
    }

    return () => {
      if (container) container.innerHTML = '';
    };

  }, [isOpen, onClose, onComplete]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="주소 검색" width="max-w-lg">
      <div 
        ref={containerRef} 
        className="w-full h-[450px] border border-slate-600 rounded bg-slate-900"
        style={{ display: 'block' }}
      ></div>
    </Modal>
  );
};

// --- Address Input Component ---
export interface AddressInputProps {
  label?: string;
  required?: boolean;
  address: string;
  addressDetail: string;
  onAddressChange: (val: string) => void;
  onDetailChange: (val: string) => void;
  onCoordinateChange?: (lat: string, lng: string) => void;
  className?: string;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  label = "주소",
  required = false,
  address,
  addressDetail,
  onAddressChange,
  onDetailChange,
  onCoordinateChange,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const detailInputRef = useRef<HTMLInputElement>(null);

  const handleComplete = useCallback((data: { address: string, coordinates?: {lat: string, lng: string} }) => {
    onAddressChange(data.address);
    if (data.coordinates && onCoordinateChange) {
        onCoordinateChange(data.coordinates.lat, data.coordinates.lng);
    }
    setIsOpen(false);
    
    setTimeout(() => {
        if (detailInputRef.current) {
            detailInputRef.current.focus();
        }
    }, 150);
  }, [onAddressChange, onCoordinateChange]);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <label className={UI_STYLES.label}>
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <div 
            className="flex-1 relative cursor-pointer" 
            onClick={handleOpen}
          >
             <input
               type="text"
               readOnly
               placeholder="주소를 검색해주세요"
               value={address}
               className={`${UI_STYLES.input} cursor-pointer hover:bg-slate-700/50 pr-8`}
               tabIndex={0}
               onKeyDown={(e) => {
                 if (e.key === 'Enter' || e.key === ' ') {
                   e.preventDefault();
                   handleOpen();
                 }
               }}
             />
             <Search className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
          </div>
          <Button type="button" variant="secondary" onClick={handleOpen}>
             주소검색
          </Button>
        </div>

        <input
           ref={detailInputRef}
           type="text"
           placeholder="상세주소를 입력하세요 (예: 101호)"
           value={addressDetail}
           onChange={(e) => onDetailChange(e.target.value)}
           className={UI_STYLES.input}
        />
      </div>

      <AddressSearchModal
        isOpen={isOpen}
        onClose={handleClose}
        onComplete={handleComplete}
      />
    </div>
  );
};

// --- Table Component ---
export interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T, index: number) => React.ReactNode);
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
}

export const DataTable = <T extends { id: number | string }>({ columns, data, onRowClick }: DataTableProps<T>) => {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 shadow-sm bg-slate-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700">
          <colgroup>
            {columns.map((col, idx) => (
              <col key={idx} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} scope="col" className={UI_STYLES.th}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {data.length > 0 ? (
              data.map((row, rowIndex) => (
                <tr 
                  key={row.id} 
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`group transition-colors ${onRowClick ? "cursor-pointer hover:bg-slate-700/50" : ""}`}
                >
                  {columns.map((col, colIndex) => (
                    <td key={colIndex} className={UI_STYLES.td}>
                      {typeof col.accessor === 'function' 
                        ? col.accessor(row, rowIndex) 
                        : (row[col.accessor] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center text-slate-500 text-sm">
                  데이터가 존재하지 않습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Pagination ---
interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  if (totalPages <= 0) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = startPage + maxButtons - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center mt-5 px-2 pb-4">
      <div className="flex items-center space-x-1">
        <button 
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-400 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        
        {getPageNumbers().map(pageNum => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={`min-w-[32px] h-[32px] rounded border text-sm font-medium transition-colors
              ${currentPage === pageNum 
                ? 'bg-blue-600 border-blue-600 text-white' 
                : 'border-slate-700 hover:bg-slate-700 text-slate-400'
              }`}
          >
            {pageNum}
          </button>
        ))}

        <button 
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-400 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

// --- Action Bar ---
export const ActionBar: React.FC<{
  onRegister?: () => void;
  onExcel?: () => void;
  onDelete?: () => void;
}> = ({ onRegister, onExcel, onDelete }) => (
  <div className="flex justify-end gap-2 mt-4">
    {onExcel && (
      <Button variant="success" onClick={onExcel} icon={<FileSpreadsheet size={16} />}>
        엑셀 다운로드
      </Button>
    )}
    {onDelete && (
      <Button variant="danger" onClick={onDelete} icon={<Trash2 size={16} />}>
        삭제
      </Button>
    )}
    {onRegister && (
      <Button variant="primary" onClick={onRegister} icon={<Plus size={16} />}>
        신규 등록
      </Button>
    )}
  </div>
);

// --- Form Section ---
export const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm mb-5 w-full">
    <h3 className="text-lg font-bold text-slate-200 mb-5 border-b border-slate-700 pb-2 flex items-center gap-2">
      <span className="w-1 h-5 bg-blue-500 rounded-sm"></span>
      {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 w-full">
      {children}
    </div>
  </div>
);

export const FormRow: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className = '' }) => (
  <div className={`flex flex-col gap-1.5 w-full ${className}`}>
    <label className="text-sm font-bold text-slate-300">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    <div className="flex-1 w-full">
      {children}
    </div>
  </div>
);

// --- API Search Modals (Reuse) ---

export const MarketSearchModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (market: Market) => void;
}> = ({ isOpen, onClose, onSelect }) => {
  const [keyword, setKeyword] = useState('');
  const [list, setList] = useState<Market[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isOpen) {
        setKeyword('');
        setPage(1);
        handleSearch('');
    }
  }, [isOpen]);

  const handleSearch = async (kw: string) => {
    const data = await MarketAPI.getList({ name: kw });
    setList(data);
    setPage(1);
  };

  const columns: Column<Market>[] = [
    { header: '현장명', accessor: 'name' },
    { header: '주소', accessor: 'address' },
    { header: '담당자', accessor: 'managerName' },
    { header: '선택', accessor: (item) => (
        <Button variant="primary" onClick={() => onSelect(item)} className="px-2 py-1 text-xs">선택</Button>
    ), width: '80px' }
  ];

  const currentItems = list.slice((page - 1) * 5, page * 5);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="현장 찾기" width="max-w-3xl">
       <SearchFilterBar onSearch={() => handleSearch(keyword)}>
          <InputGroup label="현장명" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="현장명 검색" />
       </SearchFilterBar>
       <DataTable columns={columns} data={currentItems} />
       <Pagination totalItems={list.length} itemsPerPage={5} currentPage={page} onPageChange={setPage} />
    </Modal>
  );
};

export const ReceiverSearchModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (receiver: Receiver) => void;
  marketId?: number; // [수정] 현장 필터링을 위한 marketId prop 추가
}> = ({ isOpen, onClose, onSelect, marketId }) => {
  const [keyword, setKeyword] = useState('');
  const [list, setList] = useState<Receiver[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isOpen) {
        setKeyword('');
        setPage(1);
        handleSearch('');
    }
  }, [isOpen]);

  const handleSearch = async (kw: string) => {
    // [수정] 수신기 검색 시 marketId 필터 적용
    const data = await ReceiverAPI.getList({ 
        macAddress: kw,
        marketId: marketId 
    });

    // [수정] 중복된 수신기 MAC 제거 로직 (기획 요청: 1개 정보만 띄움)
    const uniqueList: Receiver[] = [];
    const macSet = new Set();
    
    data.forEach(item => {
        if (!macSet.has(item.macAddress)) {
            macSet.add(item.macAddress);
            uniqueList.push(item);
        }
    });

    setList(uniqueList);
    setPage(1);
  };

  const columns: Column<Receiver>[] = [
    { header: 'MAC', accessor: 'macAddress' },
    { header: '현장명', accessor: 'marketName' }, // [수정] 시장명 -> 현장명
    { header: '선택', accessor: (item) => (
        <Button variant="primary" onClick={() => onSelect(item)} className="px-2 py-1 text-xs">선택</Button>
    ), width: '80px' }
  ];

  const currentItems = list.slice((page - 1) * 5, page * 5);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="수신기 찾기" width="max-w-3xl">
       <SearchFilterBar onSearch={() => handleSearch(keyword)}>
          <InputGroup label="MAC주소" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="MAC 검색" />
       </SearchFilterBar>
       <DataTable columns={columns} data={currentItems} />
       <Pagination totalItems={list.length} itemsPerPage={5} currentPage={page} onPageChange={setPage} />
    </Modal>
  );
};
