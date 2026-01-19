import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Search, Plus, FileSpreadsheet, Trash2, Edit, Save, X, Home, RotateCcw } from 'lucide-react';

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
  <div className="mb-6 flex items-center justify-between border-b border-slate-700 pb-4">
    <h1 className="text-xl font-bold text-slate-100">
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
  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700 shadow-sm mb-5">
    <div className="flex flex-col xl:flex-row gap-4 xl:items-end">
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:items-end w-full lg:[&>*]:flex-1 lg:[&>*]:min-w-0">
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
    <select className={UI_STYLES.input} {...props}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
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
        className={`bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full ${width} overflow-hidden transform transition-all scale-100 opacity-100`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
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

// --- Address Search Modal (Daum Postcode API - EMBED METHOD) ---
interface AddressSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { address: string; zonecode: string; buildingName: string }) => void;
}

declare global {
  interface Window {
    daum: any;
  }
}

export const AddressSearchModal: React.FC<AddressSearchModalProps> = ({ isOpen, onClose, onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. 모달이 열려있지 않거나 스크립트가 없으면 리턴
    if (!isOpen || !window.daum) {
      if (isOpen && !window.daum) {
        alert("주소 검색 서비스를 불러올 수 없습니다. 네트워크 연결을 확인해주세요.");
        onClose();
      }
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // 2. 중요: 재진입 시 기존 내용 초기화
    container.innerHTML = '';

    try {
      // 3. Daum 우편번호 서비스 생성
      new window.daum.Postcode({
        // 다크 모드 테마 적용
        theme: {
          bgColor: "#1E293B", // 바탕 배경색 (slate-800)
          searchBgColor: "#0F172A", // 검색창 배경색 (slate-900)
          contentBgColor: "#1E293B", // 본문 배경색 (slate-800)
          pageBgColor: "#1E293B", // 페이지 배경색 (slate-800)
          textColor: "#E2E8F0", // 기본 글자색 (slate-200)
          queryTextColor: "#FFFFFF", // 검색창 글자색 (white)
          postcodeTextColor: "#F472B6", // 우편번호 글자색 (pink-400)
          emphTextColor: "#60A5FA", // 강조 글자색 (blue-400)
          outlineColor: "#334155" // 테두리 (slate-700)
        },
        oncomplete: function(data: any) {
          // 주소 데이터 조합
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

          // 완료 콜백 호출
          onComplete({
            address: addr,
            zonecode: data.zonecode,
            buildingName: data.buildingName
          });

          // 모달 닫기 요청 (부모 컴포넌트가 이 요청을 받아 isOpen을 false로 변경하면 언마운트됨)
          onClose();
        },
        width: '100%',
        height: '100%',
        autoClose: false,
        animation: false, // 임베드 모드에서는 애니메이션 끔
      }).embed(container);
    } catch (error) {
      console.error("Daum Postcode Embed Error:", error);
    }

    // Cleanup: 컴포넌트가 언마운트되거나 닫힐 때 내부 HTML 정리
    return () => {
      if (container) container.innerHTML = '';
    };

  }, [isOpen, onClose, onComplete]);

  if (!isOpen) return null;

  return (
    // 배경을 어둡게 처리하는 Modal 컴포넌트 재사용
    <Modal isOpen={isOpen} onClose={onClose} title="주소 검색" width="max-w-lg">
      <div 
        ref={containerRef} 
        className="w-full h-[450px] border border-slate-600 rounded bg-slate-900"
        style={{ display: 'block' }}
      ></div>
    </Modal>
  );
};

// --- Address Input Component (통합 주소 입력 폼) ---
export interface AddressInputProps {
  label?: string;
  required?: boolean;
  address: string;
  addressDetail: string;
  onAddressChange: (val: string) => void;
  onDetailChange: (val: string) => void;
  className?: string;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  label = "주소",
  required = false,
  address,
  addressDetail,
  onAddressChange,
  onDetailChange,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const detailInputRef = useRef<HTMLInputElement>(null);

  // 주소 선택 완료 핸들러
  const handleComplete = useCallback((data: { address: string }) => {
    // 1. 주소 업데이트
    onAddressChange(data.address);
    
    // 2. 모달 닫기 (즉시 언마운트)
    setIsOpen(false);
    
    // 3. 상세 주소 입력창으로 포커스 이동
    setTimeout(() => {
        if (detailInputRef.current) {
            detailInputRef.current.focus();
        }
    }, 150);
  }, [onAddressChange]);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <label className={UI_STYLES.label}>
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="flex flex-col gap-2">
        {/* Row 1: Readonly Address + Search Button */}
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

        {/* Row 2: Detail Input */}
        <input
           ref={detailInputRef}
           type="text"
           placeholder="상세주소를 입력하세요 (예: 101호)"
           value={addressDetail}
           onChange={(e) => onDetailChange(e.target.value)}
           className={UI_STYLES.input}
        />
      </div>

      {/* Address Search Modal (Embed Type) */}
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
  accessor: keyof T | ((item: T) => React.ReactNode);
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
                        ? col.accessor(row) 
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

// --- Action Bar (Bottom buttons) ---
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