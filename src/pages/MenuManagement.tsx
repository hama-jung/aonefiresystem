import React, { useState, useEffect } from 'react';
import { PageHeader, DataTable, Column, Modal, FormRow, InputGroup, SelectGroup, Button, UI_STYLES } from '../components/CommonUI';
import { MenuItemDB } from '../types';
import { MenuAPI } from '../services/api';
import { getIcon, ICON_KEYS } from '../utils/iconMapper';
import { Edit, Trash2, CheckCircle } from 'lucide-react';

// Type for the flattened display item
interface MenuItemDisplay extends MenuItemDB {
  depth: number;
}

export const MenuManagement: React.FC = () => {
  const [displayMenus, setDisplayMenus] = useState<MenuItemDisplay[]>([]); // Flattened list for table
  const [loading, setLoading] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<MenuItemDB | null>(null);
  const [formData, setFormData] = useState<Partial<MenuItemDB>>({});

  // Parent Menu Options
  const [parentOptions, setParentOptions] = useState<{value: string | number, label: string}[]>([]);

  // --- Logic: Flatten the Tree for Table Display ---
  const flattenTree = (nodes: MenuItemDB[], depth = 0): MenuItemDisplay[] => {
    let result: MenuItemDisplay[] = [];
    
    // Sort by sortOrder before processing
    const sortedNodes = [...nodes].sort((a, b) => a.sortOrder - b.sortOrder);

    for (const node of sortedNodes) {
      result.push({ ...node, depth });
      if (node.children && node.children.length > 0) {
        result = [...result, ...flattenTree(node.children, depth + 1)];
      }
    }
    return result;
  };

  const fetchMenus = async () => {
    setLoading(true);
    try {
      const tree = await MenuAPI.getTree();
      
      // 1. Flatten for Table Display
      const flatList = flattenTree(tree);
      setDisplayMenus(flatList);
      
      // 2. Prepare Parent Options (only Root items can be parents for now, or 1 level deep)
      const roots = tree.map(m => ({ value: m.id, label: m.label }));
      setParentOptions([{ value: '', label: '최상위 메뉴 (Root)' }, ...roots]);

    } catch (e: any) {
      if (e.message && e.message.includes('Could not find the table')) {
         console.warn('DB 테이블(menus)이 존재하지 않습니다. SQL 스크립트를 실행해주세요.');
      } else {
         alert('메뉴 목록 로드 실패: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const triggerMenuUpdate = () => {
    window.dispatchEvent(new Event('menu-update'));
  };

  // --- Toggle Handler (Local Update Only) ---
  const handleToggle = (id: number, field: keyof MenuItemDB, currentValue: boolean) => {
    setDisplayMenus(prev => prev.map(m => m.id === id ? { ...m, [field]: !currentValue } : m));
  };

  // --- Apply Handler (Bulk Save) ---
  const handleApply = async () => {
    if (!confirm('현재 설정을 메뉴에 적용하시겠습니까?')) return;

    try {
        // [수정] 필수값(label 등) 누락으로 인한 upsert 오류 방지를 위해 전체 필드를 전송
        // depth와 children은 UI 전용 속성이므로 제외
        const updates = displayMenus.map(m => {
            const { depth, children, ...dbFields } = m;
            return dbFields;
        });

        await MenuAPI.updateVisibilities(updates);
        triggerMenuUpdate(); // Notify Sidebar to refresh
        alert('메뉴 설정이 적용되었습니다.');
    } catch (e: any) {
        alert(e.message || '적용 실패');
    }
  };

  // --- CRUD Handlers ---
  const handleEdit = (menu: MenuItemDB) => {
    setSelectedMenu(menu);
    setFormData({ ...menu });
    setIsModalOpen(true);
  };

  const handleDelete = async (menu: MenuItemDB) => {
    if (confirm(`'${menu.label}' 메뉴를 정말 삭제하시겠습니까?\n(하위 메뉴가 있다면 먼저 삭제해야 합니다.)`)) {
      try {
        await MenuAPI.delete(menu.id);
        alert('삭제되었습니다.');
        fetchMenus();
        triggerMenuUpdate();
      } catch (e: any) {
        alert(`삭제 실패: ${e.message}`);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.label) { alert('메뉴명을 입력해주세요.'); return; }

    try {
      const newMenu = {
        ...formData as MenuItemDB,
        id: selectedMenu?.id || 0,
        parentId: formData.parentId ? Number(formData.parentId) : undefined 
      };

      await MenuAPI.save(newMenu);
      alert('저장되었습니다.');
      setIsModalOpen(false);
      fetchMenus();
      triggerMenuUpdate();
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    }
  };

  // Common Toggle Renderer
  const renderToggle = (item: MenuItemDisplay, field: keyof MenuItemDB) => (
    <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
      <input 
        type="checkbox" 
        checked={!!item[field]} 
        onChange={() => handleToggle(item.id, field, !!item[field])}
        className="sr-only peer" 
      />
      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
    </label>
  );

  const columns: Column<MenuItemDisplay>[] = [
    { header: 'No', accessor: (_, idx) => idx + 1, width: '60px' },
    { 
      header: '메뉴명', 
      accessor: (item) => (
        <div className="flex items-center gap-2" style={{ paddingLeft: `${item.depth * 30}px` }}>
          {item.depth === 0 ? (
             <span className="text-blue-400">{getIcon(item.icon, 18)}</span>
          ) : (
             <span className="text-slate-500">└</span>
          )}
          <span className={item.depth === 0 ? "font-bold text-slate-200" : "text-slate-300"}>
            {item.label}
          </span>
        </div>
      ),
      width: '250px' 
    },
    { header: '경로', accessor: (item) => item.path || <span className="text-slate-500 italic">(폴더)</span>, width: '150px' },
    // '순서' 컬럼 제거됨
    
    // --- New Permission Columns ---
    { 
      header: '총판 관리자', 
      accessor: (item) => renderToggle(item, 'allowDistributor'),
      width: '100px'
    },
    { 
      header: '시장 관리자', 
      accessor: (item) => renderToggle(item, 'allowMarket'),
      width: '100px'
    },
    { 
      header: '지자체', 
      accessor: (item) => renderToggle(item, 'allowLocal'),
      width: '80px'
    },
    
    // --- Existing Visibility Columns ---
    { 
      header: 'PC 노출', 
      accessor: (item) => renderToggle(item, 'isVisiblePc'),
      width: '80px'
    },
    { 
      header: '모바일 노출', 
      accessor: (item) => renderToggle(item, 'isVisibleMobile'),
      width: '100px'
    },
    {
      header: '관리',
      accessor: (item) => (
        <div className="flex gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
           <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-400 hover:bg-slate-700 rounded transition-colors"><Edit size={16}/></button>
           <button onClick={() => handleDelete(item)} className="p-1.5 text-red-400 hover:bg-slate-700 rounded transition-colors"><Trash2 size={16}/></button>
        </div>
      ),
      width: '80px'
    }
  ];

  return (
    <>
      <PageHeader title="메뉴 관리" />
      <div className="mb-4 p-4 bg-blue-900/20 border border-blue-800 rounded-lg text-sm text-blue-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1.5">
          <div>
            💡 <strong>Tip:</strong> 권한 설정을 변경한 후, 반드시 하단의 <strong>[변경사항 적용]</strong> 버튼을 눌러야 반영됩니다.
          </div>
          <div className="pl-5 text-blue-400 text-xs">
            * 권한이 OFF로 설정된 메뉴는 해당 역할의 사용자에게 보이지 않습니다.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Loading...</div>
      ) : (
        <DataTable columns={columns} data={displayMenus} />
      )}
      
      {/* Bottom Action Bar */}
      <div className="mt-6 flex justify-end pb-10">
         <Button variant="primary" onClick={handleApply} className="px-8 py-3 text-base bg-blue-600 hover:bg-blue-500 shadow-lg" icon={<CheckCircle size={20} />}>
            변경사항 적용
         </Button>
      </div>

      {/* Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="메뉴 수정"
        width="max-w-xl"
      >
         <form onSubmit={handleSave} className="flex flex-col gap-4">
            <FormRow label="상위 메뉴">
               <SelectGroup 
                  options={parentOptions.filter(opt => Number(opt.value) !== selectedMenu?.id)} 
                  value={formData.parentId || ''}
                  onChange={(e) => setFormData({...formData, parentId: Number(e.target.value) || undefined})}
               />
            </FormRow>
            
            <div className="grid grid-cols-2 gap-4">
               <FormRow label="메뉴명" required>
                  <InputGroup 
                     value={formData.label || ''} 
                     onChange={(e) => setFormData({...formData, label: e.target.value})} 
                  />
               </FormRow>
               <FormRow label="순서 (정렬)">
                  <InputGroup 
                     type="number"
                     value={formData.sortOrder || 0} 
                     onChange={(e) => setFormData({...formData, sortOrder: Number(e.target.value)})} 
                  />
               </FormRow>
            </div>

            <FormRow label="경로 (URL)">
               <InputGroup 
                  value={formData.path || ''} 
                  onChange={(e) => setFormData({...formData, path: e.target.value})} 
                  placeholder="예: /users (폴더인 경우 비워두세요)"
               />
            </FormRow>

            <FormRow label="아이콘">
               <div className="flex gap-2 items-center">
                  <div className="p-2 bg-slate-700 rounded border border-slate-600 text-white">
                     {getIcon(formData.icon, 20)}
                  </div>
                  <SelectGroup 
                     className="flex-1"
                     options={[{value: '', label: '선택 안함'}, ...ICON_KEYS.map(k => ({value: k, label: k}))]}
                     value={formData.icon || ''}
                     onChange={(e) => setFormData({...formData, icon: e.target.value})}
                  />
               </div>
            </FormRow>

            <div className="grid grid-cols-2 gap-4 pt-2">
               <FormRow label="PC 노출">
                  <div className={`${UI_STYLES.input} flex items-center`}>
                     <input 
                        type="checkbox" 
                        checked={formData.isVisiblePc || false}
                        onChange={(e) => setFormData({...formData, isVisiblePc: e.target.checked})}
                        className="w-5 h-5 accent-blue-500 mr-2"
                     />
                     <span>보이기</span>
                  </div>
               </FormRow>
               <FormRow label="모바일 노출">
                  <div className={`${UI_STYLES.input} flex items-center`}>
                     <input 
                        type="checkbox" 
                        checked={formData.isVisibleMobile || false}
                        onChange={(e) => setFormData({...formData, isVisibleMobile: e.target.checked})}
                        className="w-5 h-5 accent-blue-500 mr-2"
                     />
                     <span>보이기</span>
                  </div>
               </FormRow>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-700">
               <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
               <Button type="submit" variant="primary">저장</Button>
            </div>
         </form>
      </Modal>
    </>
  );
};