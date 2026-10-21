const scenarios = [
  {
    label: '정상 입력 · 19세 / 3장 / D',
    frames: [
      {code:'int total = ticketPrice(19, 3);', cells:[['현재 위치','main의 try'],['입력','19 / 3 / D']], note:'try 안에서 티켓 금액을 계산하는 함수를 먼저 호출합니다.'},
      {code:'return 12000 * count;', cells:[['검사','나이·수량 정상'],['total','36000']], note:'예외가 없으므로 ticketPrice가 정상 반환합니다.'},
      {code:"int finalPrice = applyDiscount(total, 'D');", cells:[['할인','2000'],['finalPrice','34000']], note:'다음 함수도 정상 반환합니다. 할인은 총액에서 한 번 적용합니다.'},
      {code:'cout << "총 결제 금액: " << finalPrice << "원" << endl;', cells:[['출력','총 결제 금액: 34000원'],['catch','실행하지 않음']], note:'throw가 없으면 catch들을 건너뛰고 try-catch 뒤로 이어집니다.'},
    ],
  },
  {
    label: '나이 오류 · 0세 / 3장 / N',
    frames: [
      {code:'int total = ticketPrice(0, 3);', cells:[['현재 위치','main → ticketPrice'],['age','0']], note:'이 연습실은 4번 실행 예시대로 0세도 오류로 처리합니다.'},
      {code:'if (age <= 0) throw age;', cells:[['예외 자료형','int'],['total','대입되지 않음']], target:'예외 자료형', note:'throw는 오류 값을 반환하는 return이 아닙니다. 함수 실행을 중단하고 예외를 전달합니다.'},
      {code:'catch (float) { /* 코드 오류 */ }\ncatch (...) { /* 입력 오류 */ }', cells:[['선택된 처리','catch (...)'],['applyDiscount','호출하지 않음']], target:'선택된 처리', note:'int는 float로 변환되어 잡히지 않습니다. 나머지 예외를 받는 catch (...)로 이동합니다.'},
      {code:'cout << "[입력 오류] 올바른 나이/티켓 수(1~5장)를 입력하세요." << endl;', cells:[['출력','[입력 오류]'],['이후','try-catch 뒤로 이동']], note:'결제 금액은 출력하지 않습니다. throw 다음 줄로 되돌아가지 않습니다.'},
    ],
  },
  {
    label: '수량 오류 · 15세 / 6장 / D',
    frames: [
      {code:'int total = ticketPrice(15, 6);', cells:[['나이 검사','통과'],['count','6']], note:'나이는 정상이지만 티켓 수가 1~5장 범위를 벗어납니다.'},
      {code:"if (count < 1 || count > 5) throw 'C';", cells:[['예외 자료형','char'],['total','대입되지 않음']], target:'예외 자료형', note:"'C'는 문자 한 개이므로 char 예외입니다. 오류를 알리는 값은 요금이 아닙니다."},
      {code:'catch (...) { /* 입력 오류 */ }', cells:[['선택된 처리','catch (...)'],['applyDiscount','호출하지 않음']], target:'선택된 처리', note:'앞의 catch (float)와 자료형이 다릅니다. 나이 오류와 수량 오류를 한 catch (...)에서 처리합니다.'},
      {code:'cout << "[입력 오류] 올바른 나이/티켓 수(1~5장)를 입력하세요." << endl;', cells:[['출력','[입력 오류]'],['이후','try-catch 뒤로 이동']], note:'입력을 고쳐 자동으로 다시 실행하는 기능은 없습니다. 재입력하려면 별도의 반복문이 필요합니다.'},
    ],
  },
  {
    label: '할인 코드 오류 · 30세 / 3장 / K',
    frames: [
      {code:'int total = ticketPrice(30, 3);', cells:[['검사','나이·수량 정상'],['total','36000']], note:'첫 번째 함수가 정상 반환한 뒤 할인 함수를 호출합니다.'},
      {code:"int finalPrice = applyDiscount(total, 'K');", cells:[['현재 위치','applyDiscount'],['code','K']], note:'K는 허용된 N 또는 D가 아닙니다.'},
      {code:'throw -1.0f;', cells:[['예외 자료형','float'],['finalPrice','대입되지 않음']], target:'예외 자료형', note:'f가 붙은 실수 리터럴은 float입니다. 이 예제는 catch (float)에 맞춰 던집니다.'},
      {code:'catch (float) { /* 코드 오류 */ }', cells:[['선택된 처리','catch (float)'],['catch (...)','실행하지 않음']], target:'선택된 처리', note:'일치하는 catch 하나만 실행합니다. 처리한 뒤 다른 catch로 이어지지 않습니다.'},
      {code:'cout << "[코드 오류] 올바른 할인 코드를 입력하세요." << endl;', cells:[['출력','[코드 오류]'],['결제 금액','출력하지 않음']], note:'4번의 “할인 코드만 명시적으로 처리”를 float 처리부와 나머지 처리부로 나눈 모습입니다.'},
    ],
  },
  {
    label: '여러 오류 · 0세 / 6장 / X',
    frames: [
      {code:'int total = ticketPrice(0, 6);', cells:[['입력','0 / 6 / X'],['첫 검사','나이']], note:'여러 값이 잘못되어도 코드는 정해진 순서대로 실행됩니다.'},
      {code:'if (age <= 0) throw age;', cells:[['발생한 예외','int'],['수량 검사','도달하지 않음']], target:'발생한 예외', note:'나이 검사에서 먼저 throw하므로 같은 함수의 수량 검사도 실행되지 않습니다.'},
      {code:'catch (...) { /* 입력 오류 */ }', cells:[['출력','[입력 오류]'],['할인 코드 검사','도달하지 않음']], note:'첫 번째 예외를 처리합니다. X에 대한 코드 오류까지 함께 출력하는 구조가 아닙니다.'},
    ],
  },
];

export const exceptionLesson = {
  id:'exception-handling', track:'예외 처리', number:'07', title:'try · throw · catch로 예외 처리하기',
  summary:'중간고사 대비 4번처럼 함수에서 오류를 던지고, main에서 자료형에 맞게 처리합니다.',
  source:'Do it! C++ 완전 정복_05차시(Ch05).pdf · PDF 4~10쪽 · 중간고사 대비 과제 (1).pdf 9~10쪽',
  minutes:20, walkthroughLabel:'실행 흐름',
  walkthroughDescription:'입력 예시를 고르고 다음 단계를 눌러 보세요. 어느 함수에서 멈추고 어떤 catch로 이동하는지 확인할 수 있습니다.',
  sections:[
    {
      title:'try는 실행 범위, throw는 예외 발생, catch는 처리입니다',
      text:'try에는 예외가 발생할 수 있는 코드를 넣고, if로 잘못된 값을 찾았을 때 throw로 예외를 던집니다. 아래에서는 수량이 6이므로 char 예외가 발생합니다. try 안의 남은 코드는 건너뛰고 맞는 catch로 이동합니다. catch가 정상적으로 끝나면 try-catch 전체의 다음 문장부터 계속합니다. throw한 줄 다음으로 돌아가거나 입력을 자동으로 다시 받지는 않습니다.',
      code:`int count = 6;
try {
	cout << "검사 시작" << endl;
	if (count < 1 || count > 5)
		throw 'C';
	cout << "정상 처리" << endl;
}
catch (char) {
	cout << "수량 오류" << endl;
}
cout << "처리 종료" << endl;`,
      output:'검사 시작\n수량 오류\n처리 종료\n',
      note:'잘못된 나이나 수량을 입력했다고 C++이 저절로 예외를 던지지는 않습니다. 이 과제에서는 직접 조건을 검사하고 throw해야 합니다.',
    },
    {
      title:'던진 자료형과 catch를 맞추고, catch (...)는 마지막에 둡니다',
      text:'지금 사용하는 int, char, float, double 예외는 던진 자료형으로 구분합니다. 숫자 값이 같아도 int를 float로 바꿔 잡아 주지 않습니다. -1.0f는 float이고 -1.0은 double입니다. catch는 위에서부터 맞는 것을 찾아 하나만 실행하며, catch (...)는 앞에서 처리하지 않은 모든 C++ 예외를 받습니다. 따라서 반드시 마지막에 둡니다. 받을 catch가 끝내 없으면 프로그램이 비정상 종료됩니다.',
      code:`try {
	throw -1.0f;
}
catch (float) {
	cout << "float 예외" << endl;
}
catch (...) {
	cout << "나머지 예외" << endl;
}`,
      output:'float 예외\n',
      table:{headers:['던지는 코드','자료형','같은 자료형의 처리부'],rows:[
        ['throw 1;', 'int', 'catch (int)'],
        ["throw 'C';", 'char', 'catch (char)'],
        ['throw -1.0f;', 'float', 'catch (float)'],
        ['throw -1.0;', 'double', 'catch (double)'],
      ]},
      note:'catch (float error)처럼 이름을 붙이면 던진 값을 error로 읽을 수 있습니다. 값을 사용하지 않을 때는 catch (float)처럼 이름을 생략해도 됩니다.',
    },
    {
      title:'함수에서 던진 예외를 main의 try-catch로 받습니다',
      text:'함수 내부에서 처리하지 않은 예외는 그 함수를 호출한 쪽으로 전달됩니다. 아래는 4번의 요금 계산을 빼고 입력 검사 흐름만 보인 예제입니다. checkTickets에서 수량 오류가 발생하므로 checkCode 호출과 “검사 통과” 출력은 건너뜁니다. 4번에서는 같은 방식으로 ticketPrice를 먼저 호출하고 applyDiscount를 나중에 호출합니다. 할인 코드 오류만 catch (float)로 구분하고, 나이·수량 오류는 catch (...)에서 함께 처리합니다.',
      full:true,
      code:`#include <iostream>
using namespace std;

void checkTickets(int age, int count)
{
	if (age <= 0)
		throw age;
	if (count < 1 || count > 5)
		throw 'C';
}

void checkCode(char code)
{
	if (code != 'N' && code != 'D')
		throw -1.0f;
}

int main()
{
	try {
		checkTickets(19, 6);
		checkCode('X');
		cout << "검사 통과" << endl;
	}
	catch (float) {
		cout << "코드 오류" << endl;
	}
	catch (...) {
		cout << "입력 오류" << endl;
	}
	cout << "처리 종료" << endl;
	return 0;
}`,
      output:'입력 오류\n처리 종료\n',
      table:{headers:['4번에서 검사할 조건','던질 자료형','main의 처리부'],rows:[
        ['age <= 0', 'int', 'catch (...) → 입력 오류'],
        ['count < 1 또는 count > 5', 'char', 'catch (...) → 입력 오류'],
        ['code가 N도 D도 아님', 'float', 'catch (float) → 코드 오류'],
      ]},
      note:'4번 본문은 “0 미만”이지만 실행 예시에는 0세 오류가 나옵니다. 이 연습실은 실행 예시대로 0세도 오류 처리합니다. try-catch 안에 넣었다고 모든 컴파일 오류나 실행 오류가 자동으로 처리되는 것은 아닙니다.',
    },
  ],
  frames:scenarios[0].frames, scenarios,
  quizzes:[
    {q:'throw -1.0;을 던지고 catch (float), catch (...)가 차례로 있다면?', options:['catch (float)가 실행된다','catch (...)가 실행된다','두 catch가 모두 실행된다'], answer:1, why:'f가 없는 -1.0은 double입니다. float로 자동 변환되지 않아 catch (...)로 이동합니다.'},
    {q:'ticketPrice 안에서 throw한 뒤, 같은 try 안의 applyDiscount 호출은?', options:['오류 처리 후 다시 호출된다','건너뛴다','인자를 0으로 바꿔 호출한다'], answer:1, why:'남은 try 코드를 건너뛰고 catch로 이동합니다. 처리 후에는 try-catch 뒤로 이어집니다.'},
    {q:'4번처럼 할인 코드 오류만 별도로 처리하려면?', options:['catch (...)를 먼저 쓰고 catch (float)를 쓴다','catch (float)를 먼저 쓰고 catch (...)를 쓴다','catch (int)만 쓴다'], answer:1, why:'float 예외를 먼저 구분하고 나머지를 마지막 catch (...)로 받습니다. catch (...)를 앞에 두면 컴파일 오류입니다.'},
    {q:'나이부터 검사할 때 입력이 0세 / 6장 / X라면 먼저 처리하는 오류는?', options:['나이 오류 하나','할인 코드 오류 하나','세 오류를 모두 처리'], answer:0, why:'나이 검사에서 int 예외가 발생해 catch (...)로 이동합니다. 수량 검사와 할인 함수 호출까지 도달하지 않습니다.'},
  ],
  blank:{q:'할인 코드가 잘못되면 float형 값 -1.0f를 예외로 던지세요.', before:"if (code != 'N' && code != 'D')\n{\n", after:'\n}', answers:['throw -1.0f;', 'throw -1.0F;'], hint:'return이 아니라 throw를 사용합니다. float 리터럴에는 f를 붙입니다.', answer:'throw -1.0f;'},
  practice:['midterm-4'],
};
