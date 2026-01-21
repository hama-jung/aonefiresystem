-- 기존 데이터 초기화 (필요시 주석 해제)
-- TRUNCATE TABLE public.common_codes RESTART IDENTITY;

INSERT INTO public.common_codes (code, name, description, "groupCode", "groupName", status) VALUES
-- SMS 예약 구분
('SRG01', '시장', '시장 - SMS RESERVED GUBUN 코드', 'SMS_RESERVED_GUBUN', 'SMS_RESERVED_GUBUN 코드', '사용'),
('SRG02', '화재감지기', '화재감지기-SMS_RESERVED_GUBUN 코드', 'SMS_RESERVED_GUBUN', 'SMS_RESERVED_GUBUN 코드', '사용'),

-- 감지기 상태값
('7C', '감지기 통신이상', '감지기 통신이상', 'DETECTORSTS', '감지기 상태값', '사용'),
('7B', '화재감지기 배터리 이상', '화재감지기 배터리 이상', 'DETECTORSTS', '감지기 상태값', '사용'),

-- 디바이스 구분
('DEV06', 'CCTV', 'CCTV 기기코드', 'DEVICE', '디바이스 구분', '사용'),
('DEV05', '경종', '경종 기기코드', 'DEVICE', '디바이스 구분', '사용'),
('DEV04', '발신기', '발신기 기기코드', 'DEVICE', '디바이스 구분', '사용'),
('DEV03', '수신기', '수신기 기기코드', 'DEVICE', '디바이스 구분', '사용'),
('DEV02', '중계기', '중계기 기기코드', 'DEVICE', '디바이스 구분', '사용'),
('DEV01', '감지기', '감지기 기기코드', 'DEVICE', '디바이스 구분', '사용'),

-- 통신 상태
('COMM01', '정상', '통신 정상', 'COMM_STATUS', '통신 상태', '사용'),
('COMM02', '이상', '통신 이상', 'COMM_STATUS', '통신 상태', '사용');
