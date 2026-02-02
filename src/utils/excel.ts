import * as XLSX from 'xlsx';

/**
 * 데이터를 엑셀 파일로 다운로드하는 함수
 * @param data 엑셀로 변환할 데이터 배열 (객체의 키가 헤더가 됨)
 * @param fileName 저장할 파일명 (확장자 제외)
 */
export const exportToExcel = (data: any[], fileName: string) => {
  if (!data || data.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }

  // 1. 워크북 생성
  const wb = XLSX.utils.book_new();

  // 2. 워크시트 생성 (JSON 데이터를 시트로 변환)
  const ws = XLSX.utils.json_to_sheet(data);

  // 3. 워크북에 시트 추가
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  // 4. 파일 다운로드 트리거
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};