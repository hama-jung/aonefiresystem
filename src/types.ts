
import React from 'react';

// Role Enum
export enum Role {
  ADMIN = '관리자',
  DISTRIBUTOR = '총판관리자',
  MARKET = '시장관리자',
  STORE = '상가관리자'
}

export interface RoleItem {
  id: number;
  code: string;
  name: string;
  description: string;
  status: '사용' | '미사용';
}

export interface User {
  id: number;
  userId: string;
  password?: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
  department?: string;
  
  // DB 컬럼명 준수 (snake_case)
  distributor_id?: number;
  market_id?: number;      
  
  status: '사용' | '미사용';
  smsReceive?: '수신' | '미수신';
}

export interface Market {
  id: number;
  // Markets 테이블은 distributorId (CamelCase)를 사용함 (Supabase Schema 기준)
  distributorId?: number; 
  
  distributorName?: string;
  name: string;
  address: string;
  addressDetail?: string;
  zipCode?: string; 
  latitude?: string;
  longitude?: string;
  
  managerName?: string;
  managerPhone?: string;
  managerEmail?: string;
  memo?: string;

  // Config Flags
  enableMarketSms?: '사용' | '미사용';
  enableStoreSms?: '사용' | '미사용';
  enableMultiMedia?: '사용' | '미사용';
  multiMediaType?: '복합' | '열' | '연기';
  usageStatus?: '사용' | '미사용';
  enableDeviceFaultSms?: '사용' | '미사용';
  enableCctvUrl?: '사용' | '미사용';

  smsFire?: string[];
  smsFault?: string[];
  mapImage?: string;

  status: 'Normal' | 'Fire' | 'Error';
}

export interface Store {
  id: number;
  market_id: number;       // [CRITICAL FIX] DB 컬럼명과 일치시킴 (marketId -> market_id)
  marketName?: string;     // Join 표시용
  name: string;
  
  managerName?: string;
  managerPhone?: string;
  
  address?: string;
  addressDetail?: string;
  latitude?: string;
  longitude?: string;
  handlingItems?: string;

  status: '사용' | '미사용';
  storeImage?: string;
  memo?: string;

  receiverMac?: string;
  repeaterId?: string;
  detectorId?: string;
  mode?: '복합' | '열' | '연기';
}

export interface Receiver {
  id: number;
  market_id: number;    // [FIXED] DB: market_id
  marketName?: string;
  macAddress: string;
  ip?: string;
  dns?: string;
  emergencyPhone?: string;
  transmissionInterval?: string;
  image?: string;
  status: '사용' | '미사용';
  x_pos?: number;
  y_pos?: number;
}

export interface Repeater {
  id: number;
  market_id: number;    // [FIXED] DB: market_id
  marketName?: string;
  receiverMac: string;
  repeaterId: string;
  alarmStatus: '사용' | '미사용'; 
  location?: string;
  image?: string;
  status: '사용' | '미사용';
  x_pos?: number;
  y_pos?: number;
}

export interface Detector {
  id: number;
  market_id: number;    // [FIXED] DB: market_id
  marketName?: string;
  
  stores?: { id: number; name: string }[]; 
  
  receiverMac: string;
  repeaterId: string;
  detectorId: string;
  mode: '복합' | '열' | '연기';
  cctvUrl?: string;
  status: '사용' | '미사용'; 
  smsList?: string[]; 
  memo?: string;
  x_pos?: number;
  y_pos?: number;
}

export interface Transmitter {
  id: number;
  market_id: number;    // [FIXED] DB: market_id
  marketName?: string;
  receiverMac: string;
  repeaterId: string;
  transmitterId: string;
  status: '사용' | '미사용';
  memo?: string;
  x_pos?: number;
  y_pos?: number;
}

export interface Alarm {
  id: number;
  market_id: number;    // [FIXED] DB: market_id
  marketName?: string;
  receiverMac: string;
  repeaterId: string;
  alarmId: string;
  status: '사용' | '미사용';
  memo?: string;
  x_pos?: number;
  y_pos?: number;
}

export interface Distributor {
  id: number;
  name: string;           
  address: string;        
  addressDetail: string;  
  latitude: string;       
  longitude: string;      
  managerName: string;    
  managerPhone: string;   
  managerEmail: string;   
  memo: string;           
  status: '사용' | '미사용';
  managedMarkets: string[]; 
}

export interface WorkLog {
  id: number;
  market_id: number;    // [FIXED] DB: market_id
  marketName?: string;
  workDate: string;
  content: string;
  attachment?: string;
  created_at?: string;
}

export interface FireEvent {
  id: number;
  marketName: string;
  storeName: string;
  deviceType: string;
  timestamp: string;
  status: 'Fire' | 'Fault' | 'Recovered';
  location: string;
}

export interface MenuItem {
  id?: number;
  label: string;
  path?: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
}

export interface MenuItemDB {
  id: number;
  parentId?: number;
  label: string;
  path?: string;
  icon?: string; 
  sortOrder: number;
  isVisiblePc: boolean;
  isVisibleMobile: boolean;
  allowDistributor?: boolean;
  allowMarket?: boolean;
  allowLocal?: boolean;
  children?: MenuItemDB[]; 
}

export interface CommonCode {
  id: number;
  code: string;       
  name: string;       
  description: string;
  groupCode: string;  
  groupName: string;  
  status: '사용' | '미사용';
}

export interface FireHistoryItem {
  id: number;
  market_id?: number;
  marketName?: string;
  receiverMac: string;
  receiverStatus: string; 
  repeaterId: string;
  repeaterStatus: string; 
  detectorInfoChamber?: string; 
  detectorInfoTemp?: string; 
  registrar: string; 
  registeredAt: string; 
  falseAlarmStatus: string; 
  note?: string; 
}

export interface DeviceStatusItem {
  id: number;
  market_id?: number;
  marketName?: string;
  receiverMac: string;
  repeaterId: string;
  deviceType: string; 
  deviceId: string;
  deviceStatus: string; 
  errorCode: string; 
  registeredAt: string;
  processStatus: '처리' | '미처리';
  note?: string;
}

export interface DataReceptionItem {
  id: number;
  market_id?: number;
  marketName?: string;
  logType: string; 
  receiverId: string; 
  repeaterId: string; 
  receivedData: string; 
  commStatus: string; 
  batteryStatus: string; 
  chamberStatus: string; 
  registeredAt: string; 
}
