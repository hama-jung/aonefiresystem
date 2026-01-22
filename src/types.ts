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
  department?: string;
  status: '사용' | '미사용';
  smsReceive?: '수신' | '미수신'; // SMS 수신 여부 추가
}

export interface Market {
  id: number;
  distributorId?: number; // 연결된 총판 ID
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
  usageStatus?: '사용' | '미사용';           // 시장 사용여부 (설정값) - Note: Market still uses usageStatus to distinguish from live status
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
  marketId: number;       // 소속 시장 ID
  marketName?: string;    // 소속 시장명 (Join용)
  name: string;           // 상가명
  
  // 담당자 -> 대표자로 용어 변경 (DB 컬럼은 기존 호환성을 위해 managerName 유지 가능하지만 UI는 대표자로 표기)
  managerName?: string;   // 대표자명
  managerPhone?: string;  // 대표자 연락처
  
  // --- 추가된 필드 ---
  address?: string;       // 주소
  addressDetail?: string; // 상세주소
  latitude?: string;      // 위도
  longitude?: string;     // 경도
  handlingItems?: string; // 취급품목

  status: '사용' | '미사용'; // 사용 여부
  storeImage?: string;    // 상가 이미지 URL
  memo?: string;          // 비고

  // --- 기기 정보 (엑셀 등록 및 상세 정보) ---
  receiverMac?: string;   // 수신기 MAC (4자리)
  repeaterId?: string;    // 중계기 ID (2자리)
  detectorId?: string;    // 감지기 번호 (2자리)
  mode?: '복합' | '열' | '연기'; // 감지 모드
}

export interface Receiver {
  id: number;
  marketId: number;
  marketName?: string; // Join
  macAddress: string;
  ip?: string;
  dns?: string;
  emergencyPhone?: string;
  transmissionInterval?: string; // '01시간' ~ '23시간'
  image?: string;
  status: '사용' | '미사용';
}

export interface Repeater {
  id: number;
  marketId: number;
  marketName?: string; // Join
  receiverMac: string;
  repeaterId: string; // '01' ~ '20'
  alarmStatus: '사용' | '미사용'; // 경종 사용여부
  location?: string;
  image?: string;
  status: '사용' | '미사용';
}

export interface Detector {
  id: number;
  marketId: number;
  marketName?: string; // Join
  
  // Updated for multiple stores
  stores?: { id: number; name: string }[]; 
  
  receiverMac: string;
  repeaterId: string; // '01' ~ '20'
  detectorId: string; // '01' ~ '20'
  mode: '복합' | '열' | '연기';
  cctvUrl?: string;
  status: '사용' | '미사용'; // Renamed from usageStatus
  smsList?: string[]; // 화재 발생시 SMS (수정 시에만 관리)
  memo?: string;
}

export interface Transmitter {
  id: number;
  marketId: number;
  marketName?: string; // Join
  receiverMac: string;
  repeaterId: string; // '01' ~ '20'
  transmitterId: string; // '01' ~ '20'
  status: '사용' | '미사용'; // Renamed from usageStatus
  memo?: string;
}

export interface Alarm {
  id: number;
  marketId: number;
  marketName?: string; // Join
  receiverMac: string;
  repeaterId: string; // '01' ~ '20'
  alarmId: string; // '01' ~ '20'
  status: '사용' | '미사용'; // Renamed from usageStatus
  memo?: string;
}

export interface Distributor {
  id: number;
  name: string;           // 총판명
  address: string;        // 주소 (기본)
  addressDetail: string;  // 상세 주소 (5,7F 등)
  latitude: string;       // 위도
  longitude: string;      // 경도
  managerName: string;    // 담당자명
  managerPhone: string;   // 담당자 전화
  managerEmail: string;   // 담당자 이메일
  memo: string;           // 비고
  status: '사용' | '미사용';
  managedMarkets: string[]; // 관리 시장 목록 (이름)
}

export interface WorkLog {
  id: number;
  marketId: number;
  marketName?: string; // Join
  workDate: string; // YYYY-MM-DD
  content: string;
  attachment?: string; // 이미지 URL
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

// UI 렌더링용 메뉴 아이템
export interface MenuItem {
  id?: number;
  label: string;
  path?: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
}

// DB 저장용 메뉴 아이템 (권한 컬럼 추가)
export interface MenuItemDB {
  id: number;
  parentId?: number;
  label: string;
  path?: string;
  icon?: string; // String name of the icon
  sortOrder: number;
  isVisiblePc: boolean;
  isVisibleMobile: boolean;
  // --- 권한 컬럼 (Role Based Access Control) ---
  allowDistributor?: boolean; // 총판 관리자에게 보임
  allowMarket?: boolean;      // 시장 관리자에게 보임
  allowLocal?: boolean;       // 지자체에게 보임
  
  children?: MenuItemDB[]; // For tree structure
}

// 공통코드
export interface CommonCode {
  id: number;
  code: string;       // 공통코드
  name: string;       // 공통코드명
  description: string; // 공통코드 상세
  groupCode: string;  // 공통그룹코드
  groupName: string;  // 공통그룹코드명
  status: '사용' | '미사용';
}

// --- Data Management Logs ---

export interface FireLog {
  id: number;
  marketName: string;
  storeName: string;
  receiverMac: string;
  repeaterId: string;
  detectorId: string;
  eventType: string; // '화재', '고장'
  eventDetail: string;
  occurrenceTime: string;
}

export interface DeviceStatusLog {
  id: number;
  receiverMac: string;
  repeaterId: string;
  detectorId: string;
  battery: string;
  signal: string;
  temperature: string;
  smoke_value: string;
  status: string;
  loggedAt: string;
}

export interface DataReceptionLog {
  id: number;
  marketName: string;
  receiverMac: string;
  packetType: string;
  dataSize: number;
  result: string;
  receivedAt: string;
}

export interface RawUartLog {
  id: number;
  direction: 'RX' | 'TX';
  receiverMac: string;
  rawData: string;
  created_at: string;
}

// 화재 이력 관리 아이템 (Mock 데이터용)
export interface FireHistoryItem {
  id: number;
  marketName: string;
  receiverMac: string;
  receiverStatus: string; // 공통코드 (예: '10', '35')
  repeaterId: string;
  repeaterStatus: string; // 공통코드 (예: '35', '49')
  detectorInfoChamber?: string; // 감지기ID_챔버
  detectorInfoTemp?: string; // 감지기ID_온도
  registrar: string; // 등록자
  registeredAt: string; // 등록일
  falseAlarmStatus: string; // 오탐여부 (예: '등록', '화재', '오탐')
  note?: string; // 오탐 등록 비고
}

// 기기 상태 관리 아이템
export interface DeviceStatusItem {
  id: number;
  marketName: string;
  receiverMac: string;
  repeaterId: string;
  deviceType: string; // '수신기', '감지기' 등
  deviceId: string;
  deviceStatus: string; // '정상', '에러' 등
  errorCode: string; // 공통코드 (Hidden in UI)
  registeredAt: string;
  processStatus: '처리' | '미처리';
  note?: string;
}

// [NEW] 데이터 수신 관리 아이템
export interface DataReceptionItem {
  id: number;
  marketName: string;
  logType: string; // 로그유형 (예: 62)
  receiverId: string; // 수신기 (예: 0909)
  repeaterId: string; // 중계기 (예: 03)
  receivedData: string; // 수신데이터 (Long Hex String)
  commStatus: string; // 감지기통신상태 (Long Hex String)
  batteryStatus: string; // 감지기배터리상태 (Long Hex String)
  chamberStatus: string; // 감지기챔버상태 (Long Hex String)
  registeredAt: string; // 등록일
}