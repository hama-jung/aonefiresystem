import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { StoreAPI, MarketAPI } from '../services/api';
import { Store, Market, Receiver } from '../types';
import { 
  PageHeader, SearchFilterBar, InputGroup, Button, DataTable, Pagination, 
  ActionBar, FormSection, FormRow, AddressInput, StatusRadioGroup, 
  MarketSearchModal, ReceiverSearchModal, UI_STYLES, StatusBadge, Column, 
  handlePhoneKeyDown, formatPhoneNumber 
} from '../components/CommonUI';
import { Search, Upload, Paperclip, X, Download } from 'lucide-react';
import { exportToExcel } from '../utils/excel';
import * as XLSX from 'xlsx';

const ITEMS_PER_PAGE = 10;

export const StoreManagement: React.FC = () => {
  const location = useLocation();
  const [view, setView] = useState<'list' | 'form' | 'excel'>('list');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState<Partial<Store>>({});
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Search Filters
  const [searchMarket, setSearchMarket] = useState('');
  const [searchStore, setSearchStore] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);

  // Modals
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [isReceiverModalOpen, setIsReceiverModalOpen] = useState(false);
  
  // File Upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel
  const [excelData, setExcelData] = useState<Store[]>([]);
  const [excelMarket, setExcelMarket] = useState<Market | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  const fetchStores = async (overrides?: any) => {
    setLoading(true);
    try {
      const query = {
        marketName: overrides?.marketName !== undefined ? overrides.marketName : searchMarket,
        storeName: overrides?.storeName !== undefined ? overrides.storeName : searchStore,
        address: overrides?.address !== undefined ? overrides.address : searchAddress,
      };
      const data = await StoreAPI.getList(query);
      setStores(data);
      setCurrentPage(1);
    } catch (e) {
      alert('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (stores.length > 0 && location.state?.editId) {
        const targetStore = stores.find(s => s.id === location.state.editId);
        if (targetStore) {
            handleEdit(targetStore);
            window.history.replaceState({}, document.title);
        }
    }
  }, [stores, location.state]);

  // Handlers
  const handleSearch = () => { setIsFiltered(true); fetchStores(); };
  const handleReset = () => {
    setSearchMarket(''); setSearchStore(''); setSearchAddress('');
    setIsFiltered(false);
    fetchStores({ marketName: '', storeName: '', address: '' });
  };

  const handleRegister = () => {
    setSelectedStore(null);
    setFormData({ 
      status: '사용', 
      mode: '복합', 
      address: '', 
      addressDetail: '' 
    });
    setImageFile(null);
    setView('form');
  };

  const handleEdit = (store: Store) => {
    setSelectedStore(store);
    setFormData({ ...store });
    setImageFile(null);
    setView('form');
  };

  const handleDelete = async () => {
    if(selectedStore && confirm('정말 삭제하시겠습니까?')) {
      try {
        await StoreAPI.delete(selectedStore.id);
        alert('삭제되었습니다.');
        setView('list');
        fetchStores();
      } catch (e) { alert('삭제 실패'); }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.marketId) { alert('현장을 선택해주세요.'); return; }
    if (!formData.name) { alert('기기위치를 입력해주세요.'); return; }

    try {
      let uploadedUrl = formData.storeImage;
      if (imageFile) uploadedUrl = await StoreAPI.uploadStoreImage(imageFile);

      const newStore: Store = {
        ...formData as Store,
        id: selectedStore?.id || 0,
        storeImage: uploadedUrl
      };

      await StoreAPI.save(newStore);
      alert('저장되었습니다.');
      setView('list');
      fetchStores();
    } catch (e: any) { alert('저장 실패: ' + e.message); }
  };

  const handleMarketSelect = (market: Market) => {
    if (view === 'form') {
      setFormData({ 
        ...formData, 
        marketId: market.id, 
        marketName: market.name,
        address: formData.address || market.address, 
      });
    } else if (view === 'excel') {
      setExcelMarket(market);
    }
    setIsMarketModalOpen(false);
  };

  const handleReceiverSelect = (receiver: Receiver) => {
    setFormData({
      ...formData,
      receiverMac: receiver.macAddress
    });
    setIsReceiverModalOpen(false);
  };

  // --- Excel Logic ---
  const handleExcelRegister = () => {
    setExcelData([]);
    setExcelMarket(null);
    setView('excel');
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsedData: Store[] = data.map((row: any) => ({
        id: 0,
        marketId: excelMarket?.id || 0,
        marketName: excelMarket?.name || '',