# A-ONE 화재감지 시스템

에이원 소방 화재감지 및 모니터링 시스템 웹 애플리케이션입니다.

## 🛠 기술 스택

- **Frontend**: React (Vite), TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Libraries**: 
  - `react-router-dom`: 라우팅
  - `lucide-react`: 아이콘
  - `xlsx`: 엑셀 다운로드/업로드
  - `daum-postcode`: 주소 검색

## 🚀 시작하기

### 1. 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

### 2. 환경 변수 설정 (.env)

프로젝트 루트에 `.env` 파일을 생성하고 아래 내용을 입력하세요.

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 데이터베이스 설정 (Supabase)

Supabase 프로젝트의 **SQL Editor**에서 아래 파일들의 내용을 순서대로 실행하여 테이블을 생성하세요.

1. `supabase_schema.sql` (기본 사용자, 권한, 시장, 총판 등 테이블 생성)
2. `supabase_stores.sql` (상가 관리 테이블 생성)

> **주의**: 테이블 생성 시 컬럼명이 CamelCase(`"marketId"`)로 되어 있으므로, 쿼리 실행 시 따옴표를 정확히 유지해야 합니다.

## 📂 폴더 구조

- `src/components`: 공통 UI 컴포넌트 (Layout, CommonUI 등)
- `src/pages`: 각 메뉴별 페이지 (Dashboard, UserManagement, MarketManagement 등)
- `src/services`: API 연동 로직 (Supabase API wrapper)
- `src/types.ts`: TypeScript 인터페이스 정의
- `src/utils`: 유틸리티 함수 (Excel 등)

## 🔒 배포 시 주의사항

Vercel 등에 배포할 때는 **Environment Variables** 설정 메뉴에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 반드시 등록해야 합니다.
