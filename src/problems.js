import practice from './practice.json' with { type: 'json' };
const io = '#include <iostream>\nusing namespace std;\n\n';

const originalProblems = [
  {
    id: 'midterm-1', number: '01', title: '파일 버전 업데이트',
    subtitle: '문자열에서 정보를 꺼내고, 다음 버전으로 바꿔 보세요.',
    topic: '문자열', tags: ['string', '함수'], level: '기본',
    description: [
      '파일 이름과 최종 버전 여부를 입력받아 파일 정보를 출력하세요. 파일명은 이름_v숫자.확장자 형식이며 버전은 0부터 9까지 한 자리입니다.',
      '최종 버전 여부가 Y이거나 현재 버전이 9라면 버전 부분을 final로 바꿉니다. 그 외에는 버전을 1 올립니다.',
    ],
    requirements: [
      '문자 배열 대신 string과 문자열 함수를 사용합니다.',
      'void updateFileInfo(string filename)에서 파일 정보를 출력하고 파일명을 변경합니다.',
      '전역 변수 char choice로 최종 버전 여부를 전달합니다.',
      '파일 이름, 현재 버전, 확장자, 업데이트된 파일명을 순서대로 출력합니다.',
    ],
    input: '파일명과 Y 또는 N을 순서대로 입력합니다. 파일명에 공백은 없으며, 지정된 형식의 입력만 주어집니다.',
    samples: [
      { input: 'pointer_v3.cpp\nN\n', output: '파일명 입력: 최종 버전입니까?(Y/N): \n파일 이름: pointer\n현재 버전: 3\n확장자: cpp\n업데이트된 파일명: pointer_v4.cpp\n' },
      { input: 'pointer_v5.cpp\nY\n', output: '파일명 입력: 최종 버전입니까?(Y/N): \n파일 이름: pointer\n현재 버전: 5\n확장자: cpp\n업데이트된 파일명: pointer_final.cpp\n' },
    ],
    starter: '#include <iostream>\n#include <string>\nusing namespace std;\n\nchar choice;\nvoid updateFileInfo(string filename);\n\nint main()\n{\n\tstring filename;\n\tcout << "파일명 입력: ";\n\tcin >> filename;\n\tcout << "최종 버전입니까?(Y/N): ";\n\tcin >> choice;\n\tupdateFileInfo(filename);\n\treturn 0;\n}\n\nvoid updateFileInfo(string filename)\n{\n\t// 여기에 작성하세요.\n}\n',
  },
  {
    id: 'midterm-2', number: '02', title: '타이머 종료 시각',
    subtitle: '배열로 전달한 시·분·초를 올바르게 계산해 보세요.',
    topic: '배열과 함수', tags: ['배열', 'const'], level: '기본',
    description: [
      '타이머의 시작 시각과 지속 시간을 입력받아 종료 시각을 계산하세요. 시각은 24시간제로 나타냅니다.',
      '초가 60 이상이면 분으로, 분이 60 이상이면 시로 넘기고, 24시를 넘으면 다음 날의 시각으로 출력합니다.',
    ],
    requirements: [
      'const int SIZE = 3과 int 배열 start, timer를 사용합니다.',
      'void calculateEndTime(int start[], const int timer[], int size)를 구현합니다.',
      '계산한 결과는 start 배열에 저장하고 timer의 값은 바꾸지 않습니다.',
      '시작 시각을 먼저 출력한 뒤 함수를 호출하고 종료 시각을 출력합니다.',
    ],
    input: '시작 시각의 시·분·초, 지속 시간의 시·분·초를 차례대로 입력합니다. 시작 시각은 0~23시, 0~59분, 0~59초이며 지속 시간은 음수가 아닙니다.',
    samples: [
      { input: '13 50 50\n1 20 0\n', output: '타이머 시작 시각(시 분 초): 타이머 지속 시간(시 분 초): \n시작 시각: 13시 50분 50초\n종료 시각: 15시 10분 50초\n' },
      { input: '23 55 10\n0 30 30\n', output: '타이머 시작 시각(시 분 초): 타이머 지속 시간(시 분 초): \n시작 시각: 23시 55분 10초\n종료 시각: 0시 25분 40초\n' },
    ],
    starter: io + 'void calculateEndTime(int start[], const int timer[], int size)\n{\n\t// 여기에 작성하세요.\n}\n\nint main()\n{\n\tconst int SIZE = 3;\n\tint start[SIZE], timer[SIZE];\n\n\tcout << "타이머 시작 시각(시 분 초): ";\n\tfor (int i = 0; i < SIZE; i++)\n\t\tcin >> start[i];\n\tcout << "타이머 지속 시간(시 분 초): ";\n\tfor (int i = 0; i < SIZE; i++)\n\t\tcin >> timer[i];\n\n\t// 시작 시각 출력, 함수 호출, 종료 시각 출력을 작성하세요.\n\treturn 0;\n}\n',
  },
  {
    id: 'midterm-3', number: '03', title: '러닝 기록 관리',
    subtitle: '러너별 구간 기록을 저장하고 평균 페이스를 구해 보세요.',
    topic: '구조체와 포인터', tags: ['구조체', '동적 할당', 'static'], level: '응용',
    description: [
      '러너 수와 각 러너의 이름, 구간별 거리와 시간을 입력받아 러닝 기록을 출력하세요. 구간별 시간은 초 단위로 저장합니다.',
      '러너별 총 거리와 총 시간, 1km를 달리는 데 걸린 평균 페이스를 구합니다. 평균 페이스는 총 시간을 총 거리로 나눈 뒤 소수점 이하를 버리고 분·초로 표시합니다.',
    ],
    requirements: [
      'Record는 double distance, int time을 갖습니다.',
      'Runner는 int id, string name, int count, Record* records를 갖습니다.',
      'Runner 배열과 각 러너의 Record 배열을 동적으로 할당합니다.',
      'inputRunner(Runner*)에서 static 변수를 이용해 ID를 1001부터 부여합니다.',
      'printRunner(const Runner*)에서 기록을 출력합니다. 거리는 소수점 한 자리까지 표시합니다.',
      '프로그램 종료 전에 각 records 배열과 runners 배열을 모두 해제합니다.',
    ],
    input: '러너 수, 각 러너의 이름과 구간 수, 각 구간의 거리(km)와 시간(시 분 초)을 입력합니다. 이름에 공백은 없고, 러너 수·구간 수·거리는 양수입니다.',
    samples: [
      {
        input: '2\nAlice\n2\n1.0\n0 6 30\n2.0\n0 11 10\nBob\n3\n1.4\n0 9 45\n1.3\n0 10 10\n1.2\n0 10 15\n',
        output: '러너 수: \n[러너 1]\n이름: 구간 수: 1구간 거리(km): 시간(시 분 초): 2구간 거리(km): 시간(시 분 초): \n[러너 2]\n이름: 구간 수: 1구간 거리(km): 시간(시 분 초): 2구간 거리(km): 시간(시 분 초): 3구간 거리(km): 시간(시 분 초): \n======== 러닝 기록 ========\n\n[ID: 1001] Alice\n1구간: 1.0km / 390초\n2구간: 2.0km / 670초\n\n총 거리: 3.0km\n총 시간: 1060초\n평균 페이스: 5분 53초/km\n\n\n[ID: 1002] Bob\n1구간: 1.4km / 585초\n2구간: 1.3km / 610초\n3구간: 1.2km / 615초\n\n총 거리: 3.9km\n총 시간: 1810초\n평균 페이스: 7분 44초/km\n\n',
      },
    ],
    starter: '#include <iostream>\n#include <iomanip>\nusing namespace std;\n\nstruct Record\n{\n\tdouble distance;\n\tint time;\n};\n\nstruct Runner\n{\n\tint id;\n\tstring name;\n\tint count;\n\tRecord* records;\n};\n\nvoid inputRunner(Runner* runner)\n{\n\t// 여기에 작성하세요.\n}\n\nvoid printRunner(const Runner* runner)\n{\n\t// 여기에 작성하세요.\n}\n\nint main()\n{\n\t// 동적 할당, 입력, 출력, 메모리 해제를 작성하세요.\n\treturn 0;\n}\n',
  },
  {
    id: 'midterm-4', number: '04', title: '티켓 요금과 예외 처리',
    subtitle: '입력 오류를 구분하고 알맞은 결제 금액을 계산해 보세요.',
    topic: '예외 처리', tags: ['try · catch', 'throw', 'static'], level: '응용',
    description: [
      '나이, 티켓 수, 할인 코드를 입력받아 총 결제 금액을 계산하세요. 19세 미만은 장당 8,000원, 19세 이상은 장당 12,000원입니다.',
      '할인 코드 D는 총액에서 2,000원을 한 번 할인하고 N은 할인하지 않습니다. 잘못된 입력은 예외를 던져 처리합니다.',
    ],
    requirements: [
      'int ticketPrice(int age, int count)에서 기본 금액을 계산합니다.',
      '나이가 0 이하이면 int, 티켓 수가 1~5장 범위를 벗어나면 char 예외를 던집니다.',
      'int applyDiscount(int total, char code)에서 static int 변수로 할인 금액을 저장합니다.',
      '할인 코드가 N 또는 D가 아니면 float 예외를 던집니다.',
      'main에서는 catch(float)와 catch(...)로 코드 오류와 입력 오류를 구분합니다.',
    ],
    note: '0세도 입력 오류로 처리합니다. 과제 본문의 “0 미만”과 실행 예시가 달라, 이 연습실은 실행 예시를 따릅니다.',
    input: '정수 나이, 정수 티켓 수, 문자 할인 코드를 순서대로 입력합니다. 나이와 티켓 수 오류를 할인 코드 오류보다 먼저 검사합니다.',
    samples: [
      { input: '19\n3\nD\n', output: '나이 입력: 티켓 수 입력: 할인 코드(N/D): \n총 결제 금액: 34000원\n' },
      { input: '0\n2\nN\n', output: '나이 입력: 티켓 수 입력: 할인 코드(N/D): \n[입력 오류] 올바른 나이/티켓 수(1~5장)를 입력하세요.\n' },
      { input: '20\n1\nX\n', output: '나이 입력: 티켓 수 입력: 할인 코드(N/D): \n[코드 오류] 올바른 할인 코드를 입력하세요.\n' },
    ],
    starter: io + 'int ticketPrice(int age, int count)\n{\n\t// 여기에 작성하세요.\n\treturn 0;\n}\n\nint applyDiscount(int total, char code)\n{\n\t// 여기에 작성하세요.\n\treturn total;\n}\n\nint main()\n{\n\tint age, count;\n\tchar code;\n\tcout << "나이 입력: ";\n\tcin >> age;\n\tcout << "티켓 수 입력: ";\n\tcin >> count;\n\tcout << "할인 코드(N/D): ";\n\tcin >> code;\n\tcout << endl;\n\n\t// try, catch(float), catch(...)를 작성하세요.\n\treturn 0;\n}\n',
  },
];

export const problems = [...originalProblems.map(p => ({...p, collection: 'midterm', source: '중간고사 대비 과제 (1).pdf · 해당 문제의 작성 조건과 실행 예시'})), ...practice];

export const findProblem = (id) => problems.find((p) => p.id === id);
