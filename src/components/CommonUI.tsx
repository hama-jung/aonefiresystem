import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Search, Plus, FileSpreadsheet, Trash2, RotateCcw, X, Calendar } from 'lucide-react';
import { Market, Receiver } from '../types';
import { MarketAPI, ReceiverAPI } from '../services/api';

// --- Global Constants ---
export const ITEMS_PER_PAGE = 30; // 전역 페이지 목록 개수 설정

// --- Helper Functions ---
export const formatPhoneNumber = (value: string | undefined) => {
  if (!value) return '-';
  const cleaned = value.replace(/[^0-9]/g, '');
  
  if (cleaned.length === 11) {
    // 010-1234-5678
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (cleaned.length === 10) {
    // 02-1234-5678 or 011-123-4567
    if (cleaned.startsWith('02')) {
        return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  if (cleaned.length === 9) {
    // 02-123-4567
    return cleaned.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  if (cleaned.length === 8) {
    // 1588-1234
    return cleaned.replace(/(\d{4})(\d{4})/, '$1-$2');
  }
  return value;
};

// 숫자 외의 키 입력 차단 핸들러
export const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  const allowedKeys = [
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'
  ];
  
  // 기능키 허용
  if (allowedKeys.includes(e.key)) return;
  
  // Ctrl/Cmd 조합키 허용 (복사, 붙여넣기 등)
  if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) return;
  
  // 숫자(0-9)가 아니면 차단
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
};

// --- Date Logic Helpers (7 Days Rule) ---
const getDateConstraints = () => {
  const today = new Date();
  const maxDate = today.toISOString().split('T')[0]; // 오늘 (미래 선택 불가)
  
  const minDateObj = new Date(today);
  minDateObj.setDate(today.getDate() - 7); // 7일 전
  const minDate = minDateObj.toISOString().split('T')[0];

  return { minDate, maxDate };
};

export const validateDateRange = (startDate: string, endDate: string): boolean => {
  if (!startDate || !endDate) return true; // 날짜가 비어있으면 검색 로직에서 처리

  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  // 시간 성분 제거 (날짜만 비교)
  today.setHours(0,0,0,0);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);

  const { minDate } = getDateConstraints();
  const limitDate = new Date(minDate);
  limitDate.setHours(0,0,0,0);

  if (start > end) {
    alert("시작일은 종료일보다 클 수 없습니다.");
    return false;
  }

  if (end > today) {
    alert("종료일은 오늘 날짜를 초과할 수 없습니다.");
    return false;
  }

  if (start < limitDate) {
    alert(`시작일은 오늘 기준 7일 전(${minDate})까지만 선택 가능합니다.`);
    return false;
  }

  return true;
};

// --- Colors & Styles Constants (Dark Mode) ---
export const UI_STYLES = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm border border-transparent', 
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 shadow-sm',
  danger: 'bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-800 shadow-sm',
  success: 'bg-green-700 hover:bg-green-600 text-white shadow-sm border border-transparent',
  // 날짜 아이콘(calendar-picker-indicator)에 invert 필터를 적용하여 흰색으로 보이게 수정
  input: 'bg-slate-800 border border-slate-600 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm w-full text-slate-200 placeholder-slate-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer',
  label: 'block text-sm font-semibold text-slate-300 mb-1.5',
  th: 'px-4 py-3 bg-slate-900 text-center text-sm font-semibold text-slate-400 border-b border-slate-700',
  td: 'px-4 py-3 text-sm text-center text-slate-300 border-b border-slate-700/50 group-hover:bg-slate-700/30',
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
export const PageHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="mb-4 md:mb-6 flex items-center justify-between border-b border-slate-700 pb-3 md:pb-4">
    <h1 className="text-lg md:text-xl font-bold text-slate-100">
      {title}
    </h1>
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
  <div className="bg-slate-800 p-4 md:p-5 rounded-lg border border-slate-700 shadow-sm mb-5">
    <div className="flex flex-col xl:flex-row gap-4 xl:items-end">
      {/* Mobile: Stack vertically, Tablet/Desktop: Horizontal */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 md:items-end w-full md:[&>*]:flex-1 md:[&>*]:min-w-0">
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
      className={`${UI_STYLES.input} appearance-none pr-10 bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em]`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`
      }}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// --- Date Range Picker (New Component) ---
interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  label?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ 
  startDate, endDate, onStartDateChange, onEndDateChange, label = "기간"
}) => {
  const { minDate, maxDate } = getDateConstraints();

  return (
    <div className="min-w-[300px]">
      <label className={UI_STYLES.label}>{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => onStartDateChange(e.target.value)} 
            className={UI_STYLES.input} 
            min={minDate}
            max={maxDate} // 시작일도 오늘을 넘길 수 없음
          />
        </div>
        <span className="text-slate-400">~</span>
        <div className="relative flex-1">
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => onEndDateChange(e.target.value)} 
            className={UI_STYLES.input} 
            min={minDate}
            max={maxDate}
          />
        </div>
      </div>
    </div>
  );
};

// --- Status Badge ---
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
    status === '사용' 
      ? 'bg-green-900/30 text-green-400 border-green-800' 
      : 'bg-red-900/30 text-red-400 border-red-800'
  }`}>
    {status}
  </span>
);

// --- Status Radio Group ---
export const StatusRadioGroup: React.FC<{ 
  label?: string; 
  value: string | undefined; 
  onChange: (val: string) => void; 
  name?: string; 
}> = ({ label = "사용여부", value, onChange, name = "status" }) => (
  <div className={`flex flex-col gap-1.5 w-full`}>
    {/* Only render label if it's not empty string to prevent double spacing */}
    {label && <label className={UI_STYLES.label}>{label}</label>}
    <div className={`${UI_STYLES.input} flex gap-4 text-slate-300 items-center`}>
      <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
        <input 
          type="radio" name={name} value="사용" 
          checked={value === '사용'} 
          onChange={() => onChange('사용')}
          className="accent-blue-500 w-4 h-4" 
        />
        <span>사용</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
        <input 
          type="radio" name={name} value="미사용" 
          checked={value === '미사용'} 
          onChange={() => onChange('미사용')}
          className="accent-blue-500 w-4 h-4" 
        />
        <span>미사용</span>
      </label>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className={`bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full ${width} my-auto transform transition-all scale-100 opacity-100`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50 rounded-t-xl sticky top-0 z-10">
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
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export const MarketSearchModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (market: Market) => void;
}> = ({ isOpen, onClose, onSelect }) => {
  const [list, setList] = useState<Market[]>([]);
  const [searchName, setSearchName] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 5;

  const fetchMarkets = async () => {
    const data = await MarketAPI.getList({ name: searchName });
    setList(data);
    setPage(1);
  };

  // Open될 때 초기화
  useEffect(() => {
    if (isOpen) {
      setSearchName('');
      fetchMarkets();
    }
  }, [isOpen]);

  const currentItems = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="시장 찾기" width="max-w-3xl">
      <SearchFilterBar onSearch={fetchMarkets}>
        <InputGroup 
          label="시장명" 
          value={searchName} 
          onChange={(e) => setSearchName(e.target.value)} 
          placeholder="시장명 검색"
          onKeyDown={(e) => e.key === 'Enter' && fetchMarkets()}
        />
      </SearchFilterBar>
      <DataTable<Market>
        columns={[
          { header: '시장명', accessor: 'name' },
          { header: '주소', accessor: 'address' },
          { header: '선택', accessor: (item) => (
            <Button variant="primary" onClick={() => onSelect(item)} className="px-2 py-1 text-xs">선택</Button>
          ), width: '80px' }
        ]} 
        data={currentItems} 
      />
      <Pagination 
        totalItems={list.length} 
        itemsPerPage={PER_PAGE} 
        currentPage={page} 
        onPageChange={setPage} 
      />
    </Modal>
  );
};

export const ReceiverSearchModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (receiver: Receiver) => void;
}> = ({ isOpen, onClose, onSelect }) => {
  const [list, setList] = useState<Receiver[]>([]);
  const [searchMac, setSearchMac] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 5;

  const fetchReceivers = async () => {
    const data = await ReceiverAPI.getList({ macAddress: searchMac });
    setList(data);
    setPage(1);
  };

  useEffect(() => {
    if (isOpen) {
      setSearchMac('');
      fetchReceivers();
    }
  }, [isOpen]);

  const currentItems = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="수신기 찾기" width="max-w-3xl">
      <SearchFilterBar onSearch={fetchReceivers}>
        <InputGroup 
          label="MAC주소" 
          value={searchMac} 
          onChange={(e) => setSearchMac(e.target.value)} 
          placeholder="MAC주소 검색"
          onKeyDown={(e) => e.key === 'Enter' && fetchReceivers()}
        />
      </SearchFilterBar>
      <DataTable<Receiver>
        columns={[
          { header: 'MAC주소', accessor: 'macAddress', width: '150px' },
          { header: '설치시장', accessor: 'marketName' },
          { header: '선택', accessor: (item) => (
            <Button variant="primary" onClick={() => onSelect(item)} className="px-2 py-1 text-xs">선택</Button>
          ), width: '80px' }
        ]} 
        data={currentItems} 
      />
      <Pagination 
        totalItems={list.length} 
        itemsPerPage={PER_PAGE} 
        currentPage={page} 
        onPageChange={setPage} 
      />
    </Modal>
  );
};

declare global {
  interface Window {
    daum: any;
  }
}

export interface AddressSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { address: string; zonecode: string; buildingName: string }) => void;
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

          onComplete({
            address: addr,
            zonecode: data.zonecode,
            buildingName: data.buildingName
          });

          onClose();
        },
        width: '100%',
        height: '100%',
        autoClose: false,
        animation: false, 
        theme: {
            bgColor: "#1E293B", 
            searchBgColor: "#0F172A", 
            contentBgColor: "#1E293B", 
            pageBgColor: "#1E293B", 
            textColor: "#E2E8F0", 
            queryTextColor: "#F1F5F9", 
            postcodeTextColor: "#60A5FA", 
            emphTextColor: "#60A5FA", 
            outlineColor: "#334155" 
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

const getMockCoordinates = (address: string) => {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  const lat = (36.0 + (Math.abs(hash) % 20000) / 10000).toFixed(6);
  const lng = (126.0 + (Math.abs(hash) % 30000) / 10000).toFixed(6);
  return { lat, lng };
};

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

  const handleComplete = useCallback((data: { address: string }) => {
    onAddressChange(data.address);
    setIsOpen(false);
    
    if (onCoordinateChange) {
        setTimeout(() => {
            const { lat, lng } = getMockCoordinates(data.address);
            onCoordinateChange(lat, lng);
        }, 100);
    }

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
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} scope="col" className={UI_STYLES.th} style={{ width: col.width }}>
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
    <div className="flex items-center justify-center mt-5 px-2">
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