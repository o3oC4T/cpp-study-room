export const collections = [
  {id:'midterm', number:'00', title:'중간고사 대비 과제', subtitle:'교수님 과제의 작성 조건과 실행 예시', label:'기존 과제', topics:'문자열 · 배열 · 러닝 기록 · 예외 처리'},
  {id:'practice-1', number:'01', title:'기본 개념 연결하기', subtitle:'입력한 값을 함수와 구조체로 전달하기', topics:'파일 분리 · 최솟값 · 재고 · 나눗셈'},
  {id:'practice-2', number:'02', title:'값과 순서 바꾸기', subtitle:'문자열 분리부터 배열 회전, 데이터 선택까지', topics:'회원 정보 · 배열 회전 · 최고 학생 · 출금'},
  {id:'practice-3', number:'03', title:'포인터로 원본 다루기', subtitle:'문자열 수정과 제자리 배열 변경', topics:'검색어 교체 · 뒤집기 · 직사각형 · 배송비'},
  {id:'practice-4', number:'04', title:'데이터를 모으고 고르기', subtitle:'필요한 값을 세고 골라서 기록으로 묶기', topics:'문자 개수 · 값 선택 · 팀 기록 · 등급'},
  {id:'practice-5', number:'05', title:'포인터 연결 이해하기', subtitle:'값의 변경과 가리키는 대상의 변경 구분하기', topics:'확장자 · 이중 포인터 · 좌표 · 인덱스'},
  {id:'practice-6', number:'06', title:'누적해서 계산하기', subtitle:'원본을 보존하고 여러 기록의 합 구하기', topics:'숫자 문자 · 누적 합 · 운동 기록 · 시각'},
  {id:'practice-7', number:'07', title:'동적 메모리 관리하기', subtitle:'크기가 다른 배열과 메모리의 수명 다루기', topics:'코드 재구성 · 배열 확장 · 반별 점수 · 재고'},
  {id:'practice-8', number:'08', title:'종합 모의 연습', subtitle:'함수, 포인터, 구조체, 예외를 함께 사용하기', topics:'버전 순환 · 2차원 배열 · 창고 기록 · 포인트'},
];
export const findCollection=id=>collections.find(c=>c.id===id);
