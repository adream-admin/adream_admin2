# 블로그 스케줄 배정 어드민

## 시작 방법

### 방법 1: WSL 터미널에서
```bash
cd /mnt/c/Users/ADREAM-PC08/블로그스케줄어드민
npm run dev
```

### 방법 2: Windows에서
`시작.bat` 더블클릭

### 접속
브라우저에서 http://localhost:3000 접속

### 초기 계정
- 아이디: `admin`
- 비밀번호: `admin1234`

---

## 외부 연동 API

블로그 접수 어드민에서 주문 전송:

```http
POST http://localhost:3000/api/orders
Content-Type: application/json

{
  "externalId": "ORDER-001",
  "orderSource": "접수업체명",
  "companyName": "업체명",
  "placeAddress": "플레이스주소",
  "companyGuide": "업체가이드",
  "startDate": "2026-04-10",
  "endDate": "2026-04-20",
  "dailyCount": 3
}
```

배열로도 전송 가능 (여러 건 동시):
```json
[
  { "companyName": "업체A", "startDate": "2026-04-10", "endDate": "2026-04-20", "dailyCount": 2 },
  { "companyName": "업체B", "startDate": "2026-04-10", "endDate": "2026-04-15", "dailyCount": 1 }
]
```

---

## 사용 흐름

1. **아이디 리스트** → 블로거 아이디 등록 (엑셀 일괄 업로드 가능)
2. **업체 목록** → 접수 어드민 연동 시 자동 등록, 또는 수동 등록
3. **발행 일정표** → 월별 캘린더로 스케줄 확인
4. **작업** → 날짜 입력 후 "작업 실행" 클릭 → 아이디 자동 배정 → 서버별 엑셀 다운로드
5. **시스템 설정** → 배정 규칙 조정
