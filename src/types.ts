
import React from 'react';

// Role Enum은 레거시 호환을 위해 유지하되, 실제로는 string으로 처리됨
export enum Role {
  ADMIN = '관리자',
  DISTRIBUTOR = '총판관리자',
  MARKET = '시장관리자',
  STORE = '상가관리자'
}

export interface RoleItem {
  id: number;
  code: string; // 롤 코드 (예: 7777)
  name: string; // 롤 이름
  description: string; // 롤 설명
  status: '사용' | '미사용'; // 사용 여부
}

export interface User {
  id: number;
  userId: string;
  password?: string; // 비밀번호 필드 추가
  name: string;
  role: string; // Enum 대신 string으로 변경하여 동적 롤 지원
  phone: string;
  email?: string;
  
  // 소속 정보 (정규화)
  department?: string; // 화면 표시용 (Join된 이름 또는 직접 입력값)
  distributorId?: number; // [NEW] 총판 ID
  marketId?: number;      // [NEW] 시장 ID
  
  status: '사용' | '미사용';
  smsReceive?: '수신' | '미수신'; // SMS 수신 여부 추가
}

export interface Market {
  id: number;
  distributorId?: number; // 연결된 총판 ID
  distributorName?: string; // [NEW] 총판명 (Join용)
  name: string;
  address: string;
  addressDetail?: string; // 상세주소
  zipCode?: string; 
  latitude?: string;       // 위도
  longitude?: string;      // 경도
  
  managerName?: string;    // 담당자 (선택)
  managerPhone?: string;   // 담당자 전화 (선택)
  managerEmail?: string;   // 담당자 이메일
  memo?: string;           // 비고

  // --- 설정 플래그 (Config Flags) ---
  enableMarketSms?: '사용' | '미사용';       // 시장전체 문자전송여부
  enableStoreSms?: '사용' | '미사용';        // 상가주인 문자전송여부
  enableMultiMedia?: '사용' | '미사용';      // 다매체전송 여부
  multiMediaType?: '복합' | '열' | '연기';   // 다매체 타입
  usageStatus?: '사용' | '미사용';           // 시장 사용여부 (설정값)
  enableDeviceFaultSms?: '사용' | '미사용';  // 기기고장 문자전송여부
  enableCctvUrl?: '사용' | '미사용';         // 화재문자시 CCTV URL 포함여부

  // --- 수정 시에만 노출되는 데이터 (Edit Only) ---
  smsFire?: string[];    // 화재발생시 SMS 수신번호 목록
  smsFault?: string[];   // 고장발생시 SMS 수신번호 목록
  mapImage?: string;     // 시장지도 이미지 URL

  // --- 시스템 상태 (System Status) ---
  status: 'Normal' | 'Fire' | 'Error'; // 현재 모니터링 상태
}

export interface Store {
  id: number;
  marketId: number;       // 소속 시장 ID (DB: market_id)
  marketName?: string;    // 소속 시장명 (Join용)
  name: string;           // 상가명
  
  managerName?: string;   // 대표자명
  managerPhone?: string;  // 대표자 연락처
  
  address?: string;       // 주소
  addressDetail?: string; // 상세주소
  latitude?: string;      // 위도
  longitude?: string;     // 경도
  handlingItems?: string; // 취급품목

  status: '사용' | '미사용'; // 사용 여부
  storeImage?: string;    // 상가 이미지 URL
  memo?: string;          // 비고

  receiverMac?: string;   // 수신기 MAC (4자리)
  repeaterId?: string;    // 중계기 ID (2자리)
  detectorId?: string;    // 감지기 번호 (2자리)
  mode?: '복합' | '열' | '연기'; // 감지 모드
}

export interface Receiver {
  id: number;
  marketId: number;    // DB: market_id
  marketName?: string; // Join
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
  marketId: number;    // DB: market_id
  marketName?: string; // Join
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
  marketId: number;    // DB: market_id
  marketName?: string; // Join
  
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
  marketId: number;    // DB: market_id
  marketName?: string; // Join
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
  marketId: number;    // DB: market_id
  marketName?: string; // Join
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
  marketId: number;    // DB: market_id
  marketName?: string; // Join
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

// --- Data Management Logs (Updated Types) ---

export interface FireHistoryItem {
  id: number;
  marketId?: number; // [NEW] DB: market_id
  marketName?: string; // Join via market_id
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
  marketId?: number; // [NEW] DB: market_id
  marketName?: string; // Join via market_id
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
  marketId?: number; // [NEW] DB: market_id
  marketName?: string; // Join via market_id
  logType: string; 
  receiverId: string; 
  repeaterId: string; 
  receivedData: string; 
  commStatus: string; 
  batteryStatus: string; 
  chamberStatus: string; 
  registeredAt: string; 
}
