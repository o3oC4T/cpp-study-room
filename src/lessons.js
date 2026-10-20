const ch3='Do it! C++ 완전 정복_03차시(Ch03).pdf';
export const lessons=[
 {id:'pointer-value',track:'포인터',number:'01',title:'주소와 값 구분하기',summary:'&로 주소를 얻고, *로 그 주소의 값을 읽고 바꿉니다.',source:`${ch3} · PDF 4~9쪽`,minutes:10,
 sections:[
  {title:'변수와 포인터는 서로 다른 값을 저장합니다',text:'int a = 10;은 정수를 저장합니다. int* p = &a;에서 p에 저장되는 것은 a의 주소입니다. &a는 주소를 구하는 식이고, *p는 p가 가리키는 a를 사용하는 식입니다. 선언의 int*와 식의 *p는 역할이 다릅니다.',code:'int a = 10;\nint* p = &a;\ncout << a << " " << *p << endl;',output:'10 10\n'},
  {title:'*p에 대입하면 원본이 바뀝니다',text:'p가 a를 가리키는 동안 *p = 25;는 a = 25;와 같은 대상을 변경합니다. p = &b;는 p가 가리키는 대상을 b로 바꾸지만, a나 b의 값을 복사하지는 않습니다.',code:'int a = 10, b = 20;\nint* p = &a;\n*p = 25;\np = &b;\n*p += 3;\ncout << a << " " << b << endl;',output:'25 23\n'},
  {title:'주소 숫자를 외우지 마세요',text:'실제 주소는 실행마다 달라질 수 있습니다. 아래 그림의 &a, &b는 연결 대상을 표현하는 기호입니다. 초기화하지 않은 포인터나 nullptr은 역참조하면 안 됩니다. 먼저 유효한 객체를 가리키게 해야 합니다.',code:'int value = 7;\nint* p = nullptr;\np = &value;\ncout << *p << endl;',output:'7\n'}],
 frames:[
  {code:'int a = 10, b = 20;',cells:[['a','10'],['b','20']],note:'두 정수 변수를 만듭니다.'},
  {code:'int* p = &a;',cells:[['a','10'],['b','20']],pointer:'p → a',target:'a',note:'p는 a의 주소를 저장합니다.'},
  {code:'*p = 25;',cells:[['a','25'],['b','20']],pointer:'p → a',target:'a',note:'p를 통해 a의 값이 25가 됩니다.'},
  {code:'p = &b;',cells:[['a','25'],['b','20']],pointer:'p → b',target:'b',note:'정수 값은 그대로이고 연결 대상만 바뀝니다.'},
  {code:'*p += 3;',cells:[['a','25'],['b','23']],pointer:'p → b',target:'b',note:'이제 p를 통한 변경은 b에 적용됩니다.'}],
 quizzes:[
  {q:'int a = 3; int* p = &a; *p = 7; 이후 a는?',options:['3','7','a의 주소'],answer:1,why:'*p는 a를 가리키므로 a에 7을 저장합니다.'},
  {q:'p가 가리키는 대상을 b로 바꾸는 코드는?',options:['*p = b;','p = &b;','p = b;'],answer:1,why:'포인터에는 주소를 대입합니다. *p = b는 기존 대상에 b의 값을 복사합니다.'}],
 blank:{q:'p가 가리키는 정수에 1을 더하세요.',before:'int a = 5;\nint* p = &a;\n',after:'\ncout << a; // 6',answers:['*p += 1;','(*p)++;','++(*p);','*p = *p + 1;'],hint:'포인터 p 자체가 아니라 *p의 값을 변경해야 합니다.',answer:'*p += 1;'},practice:['practice-1-2','practice-5-2']},
 {id:'pointer-array',track:'포인터',number:'02',title:'배열과 함수 연결하기',summary:'포인터 연산, 원본 변경, const의 약속을 연결합니다.',source:`${ch3} · PDF 11~15, 29~33, 46~49쪽`,minutes:15,
 sections:[
  {title:'한 칸 이동은 원소 한 개 이동입니다',text:'배열 a를 식에서 사용하면 대개 첫 원소의 주소로 변환됩니다. int* p = a;이면 p + 1은 다음 int 원소를 가리키고, *(p + 1)은 a[1]을 뜻합니다. 원소를 접근할 때는 0 이상 배열 크기 미만의 범위를 지킵니다.',code:'int a[3] = {2, 4, 6};\nint* p = a;\ncout << *p << " " << *(p + 1) << endl;',output:'2 4\n'},
  {title:'포인터 매개변수로 원본을 바꿉니다',text:'함수에 정수 값을 전달하면 복사본을 받습니다. 주소를 전달하면 함수가 그 주소를 통해 원본을 바꿀 수 있습니다. 포인터 값 자체는 매개변수에 복사됩니다. 함수 안에서 p = 다른주소;만 해서는 호출한 곳의 포인터가 바뀌지 않습니다.',full:true,code:'#include <iostream>\nusing namespace std;\nvoid add(int* value)\n{\n    *value += 5;\n}\nint main()\n{\n    int n = 10;\n    add(&n);\n    cout << n << endl;\n    return 0;\n}',output:'15\n'},
  {title:'const int*와 int* const를 구분합니다',text:'const int* p는 p를 통해 값을 바꾸지 않겠다는 뜻입니다. 다른 주소를 가리킬 수는 있습니다. int* const p는 포인터의 주소 값을 바꾸지 않겠다는 뜻이며 가리키는 정수는 바꿀 수 있습니다. const int* 매개변수는 읽기 전용 배열을 전달할 때 유용합니다.',code:'int a = 1, b = 2;\nconst int* read = &a;\nread = &b;\nint* const fixed = &a;\n*fixed = 9;\ncout << *read << " " << a << endl;',output:'2 9\n'}],
 frames:[
  {code:'int a[3] = {2, 4, 6};',cells:[['a[0]','2'],['a[1]','4'],['a[2]','6']],note:'세 int 원소가 순서대로 놓입니다.'},
  {code:'int* p = a;',cells:[['a[0]','2'],['a[1]','4'],['a[2]','6']],pointer:'p → a[0]',target:'a[0]',note:'*p와 a[0]은 같은 원소입니다.'},
  {code:'p++;',cells:[['a[0]','2'],['a[1]','4'],['a[2]','6']],pointer:'p → a[1]',target:'a[1]',note:'다음 int 원소로 이동합니다.'},
  {code:'*p = 10;',cells:[['a[0]','2'],['a[1]','10'],['a[2]','6']],pointer:'p → a[1]',target:'a[1]',note:'원본 배열의 두 번째 원소가 바뀝니다.'}],
 quizzes:[
  {q:'int a[3] = {2, 4, 6}; 에서 *(a + 2)는?',options:['4','6','주소'],answer:1,why:'인덱스 2인 세 번째 원소입니다.'},
  {q:'const int* p가 금지하는 것은?',options:['p = &다른변수;','*p = 10;','*p를 읽기'],answer:1,why:'p를 통한 값 변경을 금지합니다. 포인터 자체의 대상 변경은 가능합니다.'}],
 blank:{q:'함수에 배열 arr의 첫 원소 주소를 전달하세요.',before:'void reverse(int* values, int n);\nint arr[3] = {1, 2, 3};\n',after:'',answers:['reverse(arr, 3);','reverse(&arr[0], 3);'],hint:'배열 이름 arr를 전달하면 첫 원소의 주소가 전달됩니다.',answer:'reverse(arr, 3);'},practice:['practice-3-2','practice-6-2']},
 {id:'struct-access',track:'구조체',number:'03',title:'struct로 데이터 묶기',summary:'객체와 포인터에서 멤버에 접근하는 방법을 익힙니다.',source:`${ch3} · PDF 34~38쪽`,minutes:12,
 sections:[
  {title:'함께 다닐 값을 하나의 자료형으로 묶습니다',text:'상품 하나의 단가와 수량은 함께 사용할 데이터입니다. 구조체 정의에서 멤버를 선언하고 마지막에 세미콜론을 붙입니다. Item item;은 Item 객체를 하나 만듭니다. 값을 읽기 전에 각 멤버를 초기화하세요.',code:'struct Item { int price; int count; };\nItem item = {1000, 3};\ncout << item.price * item.count << endl;',output:'3000\n'},
  {title:'.과 ->는 객체인지 포인터인지로 선택합니다',text:'객체 표현식 item에는 item.price를, 객체를 가리키는 포인터 p에는 p->price를 사용합니다. p->price와 (*p).price는 같은 의미입니다. 정적 할당과 동적 할당의 구분으로 연산자를 고르는 것은 아닙니다.',code:'struct Item { int price; int count; };\nItem item = {1000, 3};\nItem* p = &item;\np->count += 2;\ncout << item.count << " " << (*p).price << endl;',output:'5 1000\n'},
  {title:'구조체 배열에서도 원소는 구조체 객체입니다',text:'items[i]는 i번째 Item 객체이므로 items[i].price처럼 접근합니다. items + i는 그 원소를 가리키는 포인터입니다. const Item* 매개변수를 쓰면 해당 포인터를 통해 멤버를 바꾸는 실수를 컴파일 단계에서 막을 수 있습니다.',code:'struct Item { int price; int count; };\nItem items[2] = {{500, 2}, {1000, 3}};\nconst Item* p = items + 1;\ncout << items[0].price << " " << p->count << endl;',output:'500 3\n'}],
 frames:[
  {code:'Item item = {1000, 3};',cells:[['item.price','1000'],['item.count','3']],note:'item 한 객체 안에 두 멤버가 있습니다.'},
  {code:'Item* p = &item;',cells:[['item.price','1000'],['item.count','3']],pointer:'p → item',note:'포인터가 구조체 전체를 가리킵니다.'},
  {code:'p->count += 2;',cells:[['item.price','1000'],['item.count','5']],pointer:'p → item',target:'item.count',note:'p를 통해 item의 count 멤버가 바뀝니다.'}],
 quizzes:[
  {q:'Item* p = &item; 일 때 올바른 멤버 접근은?',options:['p.count','p->count','*p.count'],answer:1,why:'p는 포인터이므로 ->를 사용합니다. (*p).count도 같습니다.'},
  {q:'Item items[3];에서 두 번째 원소의 price는?',options:['items[1].price','items[2].price','items->1.price'],answer:0,why:'인덱스는 0부터 시작하고 items[1]은 객체입니다.'}],
 blank:{q:'포인터 p로 count 멤버에 4를 저장하세요.',before:'struct Item { int price; int count; };\nItem item = {1000, 0};\nItem* p = &item;\n',after:'',answers:['p->count = 4;','(*p).count = 4;'],hint:'포인터에서 멤버를 선택할 때 ->를 사용합니다.',answer:'p->count = 4;'},practice:['practice-1-3','practice-3-3']},
 {id:'dynamic-array',track:'동적 할당',number:'04',title:'필요한 만큼 배열 만들기',summary:'new[]로 만든 배열의 수명과 delete[]의 짝을 이해합니다.',source:`${ch3} · PDF 16~23, 39~40쪽`,minutes:15,
 sections:[
  {title:'크기를 입력받은 뒤 메모리를 할당합니다',text:'int* values = new int[n];은 n개의 int를 위한 공간을 만들고 첫 원소의 주소를 반환합니다. 이 형태는 각 int의 값을 초기화하지 않으므로 읽기 전에 값을 넣습니다. n은 이 연습에서 양수로 제한합니다.',code:'int n = 3;\nint* values = new int[n];\nfor (int i = 0; i < n; i++) values[i] = i + 1;\ncout << values[0] + values[1] + values[2] << endl;\ndelete[] values;',output:'6\n'},
  {title:'할당한 형태에 맞게 해제합니다',text:'new int로 만든 하나의 객체는 delete, new int[n]으로 만든 배열은 delete[]로 해제합니다. 배열 크기가 1이어도 new[]와 delete[]의 짝은 그대로입니다. 해제 후 그 공간을 읽거나 다시 해제하면 안 됩니다.',code:'int* value = new int(7);\ncout << *value << endl;\ndelete value;\nvalue = nullptr;',output:'7\n'},
  {title:'포인터와 할당 공간의 수명은 다릅니다',text:'포인터 변수의 범위가 끝난다고 new로 만든 공간이 자동으로 해제되지는 않습니다. 주소를 잃기 전에 해제해야 합니다. delete[] 후 nullptr을 대입해도 다른 포인터가 같은 공간을 가리키고 있었다면 그 포인터까지 자동으로 바뀌지는 않습니다. 일반적인 new의 실패는 예외로 전달되므로 무조건 nullptr을 반환한다고 가정하지 않습니다.',code:'int* data = new int[2];\ndata[0] = 10; data[1] = 20;\ncout << data[1] << endl;\ndelete[] data;\ndata = nullptr;',output:'20\n'}],
 frames:[
  {code:'int* values = new int[3];',cells:[['values[0]','미초기화'],['values[1]','미초기화'],['values[2]','미초기화']],pointer:'values → 할당된 배열',note:'정수 값을 읽기 전 초기화가 필요합니다.'},
  {code:'for (...) values[i] = i + 1;',cells:[['values[0]','1'],['values[1]','2'],['values[2]','3']],pointer:'values → 할당된 배열',note:'이제 세 원소를 읽을 수 있습니다.'},
  {code:'delete[] values;',cells:[['배열 공간','해제됨']],pointer:'values → 사용 불가',released:true,note:'주소 값이 남아 있어도 그 공간을 접근하면 안 됩니다.'},
  {code:'values = nullptr;',cells:[['values','nullptr']],note:'이 포인터가 가리키는 유효한 대상이 없음을 표시합니다.'}],
 quizzes:[
  {q:'new int[1]의 올바른 해제는?',options:['delete p;','delete[] p;','해제가 필요 없다'],answer:1,why:'원소 개수와 관계없이 new[]는 delete[]와 짝입니다.'},
  {q:'delete[] p; 후 *p를 읽어도 될까요?',options:['이전 값이 보이면 된다','안 된다','p가 nullptr이 아니면 된다'],answer:1,why:'해제된 공간을 접근하면 정의되지 않은 동작입니다.'}],
 blank:{q:'할당한 배열을 해제하세요.',before:'int* values = new int[5];\n// 값 저장과 사용을 마쳤습니다.\n',after:'\nvalues = nullptr;',answers:['delete[] values;','delete [] values;'],hint:'배열 할당 연산자 new[]에 맞는 해제 연산자를 사용합니다.',answer:'delete[] values;'},practice:['practice-4-2','practice-7-2']},
 {id:'struct-records',track:'구조체',number:'05',title:'구조체 포인터로 기록 처리하기',summary:'static ID와 읽기 전용 함수로 여러 객체를 처리합니다.',source:`${ch3} · PDF 37~45, 46~49쪽`,minutes:15,
 sections:[
  {title:'함수가 객체의 멤버를 채우게 합니다',text:'구조체 주소를 함수에 넘기면 그 함수가 해당 객체의 멤버를 채울 수 있습니다. 입력 함수는 Item*로 받고, 내용만 읽는 출력·계산 함수는 const Item*로 받는 식으로 역할을 나눌 수 있습니다.',full:true,code:'#include <iostream>\nusing namespace std;\nstruct Item { int price; int count; };\nint amount(const Item* item)\n{\n    return item->price * item->count;\n}\nint main()\n{\n    Item item = {700, 3};\n    cout << amount(&item) << endl;\n    return 0;\n}',output:'2100\n'},
  {title:'static 지역 변수는 다음 호출에도 유지됩니다',text:'함수의 static 지역 변수는 한 번 초기화되고 함수 호출이 끝나도 값이 유지됩니다. 호출할 때마다 ID를 하나씩 부여하는 데 사용할 수 있습니다. 수명이 길어진 것이지 다른 함수에서 그 이름에 직접 접근할 수 있다는 뜻은 아닙니다.',full:true,code:'#include <iostream>\nusing namespace std;\nint nextId()\n{\n    static int id = 1001;\n    return id++;\n}\nint main()\n{\n    int first = nextId();\n    int second = nextId();\n    cout << first << " " << second << endl;\n    return 0;\n}',output:'1001 1002\n'},
  {title:'반환한 주소가 유효한 동안 사용합니다',text:'배열의 특정 원소를 찾아 그 주소를 반환할 수 있습니다. 배열이 살아 있는 동안 결과 포인터를 사용하세요. 동적 배열을 delete[]한 뒤 그 원소를 가리키는 결과 포인터를 읽으면 안 됩니다. 함수 내부 지역 변수의 주소를 반환하는 방식도 피해야 합니다.',code:'struct Item { int price; int count; };\nItem* items = new Item[2];\nitems[0] = {500, 2};\nitems[1] = {700, 3};\nconst Item* selected = items + 1;\ncout << selected->price << endl;\ndelete[] items;',output:'700\n'}],
 frames:[
  {code:'static int nextId = 1001;',cells:[['nextId','1001']],note:'처음 호출할 때 한 번 초기화됩니다.'},
  {code:'first.id = nextId++;',cells:[['first.id','1001'],['nextId','1002']],note:'현재 값을 저장하고 다음 번호를 준비합니다.'},
  {code:'// 다음 호출: second.id = nextId++;',cells:[['first.id','1001'],['second.id','1002'],['nextId','1003']],note:'다음 호출에서도 nextId는 1002부터 이어집니다.'}],
 quizzes:[
  {q:'함수 안 static int id = 1001;의 의미는?',options:['매번 1001로 초기화','호출 사이에도 값 유지','모든 함수에서 이름 id로 접근 가능'],answer:1,why:'지역 변수의 접근 범위는 유지되고 저장 기간이 프로그램 실행 동안 지속됩니다.'},
  {q:'배열 원소 주소를 반환받은 뒤 배열을 delete[]했다면?',options:['반환받은 주소로 계속 읽는다','반환받은 주소도 더 이상 역참조하지 않는다','주소에 1을 더하면 읽을 수 있다'],answer:1,why:'포인터가 여러 개여도 원소의 수명은 배열 해제와 함께 끝납니다.'}],
 blank:{q:'함수 호출 횟수를 저장하는 지역 변수를 선언하세요. 처음은 0입니다.',before:'int issueId()\n{\n',after:'\n    count++;\n    return count;\n}',answers:['static int count = 0;'],hint:'함수가 끝나도 값이 유지되어야 합니다.',answer:'static int count = 0;'},practice:['practice-2-3','practice-4-3']},
 {id:'dynamic-nested',track:'동적 할당',number:'06',title:'안쪽 배열부터 해제하기',summary:'구조체 안의 배열과 2차원 배열을 끝까지 관리합니다.',source:`${ch3} · PDF 39~40쪽 · 중간고사 대비 과제 (1).pdf 6~8쪽 · 4주차 실습 PDF 9쪽`,minutes:20,
 sections:[
  {title:'포인터 멤버와 실제 배열은 별도 공간입니다',text:'struct Group { int count; int* scores; };에서 Group 배열을 만든 것만으로 scores가 가리킬 정수 배열까지 생기지는 않습니다. 각 그룹마다 인원 수를 알고 난 뒤 점수 배열을 따로 할당해야 합니다.',code:'struct Group { int count; int* scores; };\nGroup* groups = new Group[2];\ngroups[0].count = 2;\ngroups[1].count = 1;\nfor (int i = 0; i < 2; i++)\n    groups[i].scores = new int[groups[i].count];\nfor (int i = 0; i < 2; i++) delete[] groups[i].scores;\ndelete[] groups;',output:''},
  {title:'주소를 잃기 전에 안쪽부터 해제합니다',text:'먼저 groups[i].scores를 각각 delete[]한 뒤 groups를 delete[]합니다. 기본 포인터 멤버는 자신이 가리키는 공간을 자동으로 해제하지 않습니다. 바깥 배열을 먼저 지우면 안쪽 주소를 정상적으로 읽을 수 없게 됩니다.',code:'struct Group { int count; int* scores; };\nGroup* groups = new Group[1];\ngroups[0].count = 2;\ngroups[0].scores = new int[2];\ngroups[0].scores[0] = 80;\ngroups[0].scores[1] = 90;\ncout << groups[0].scores[0] + groups[0].scores[1] << endl;\ndelete[] groups[0].scores;\ndelete[] groups;',output:'170\n'},
  {title:'2차원 배열도 행별 할당이면 행별 해제입니다',text:'int**로 행 포인터 배열을 만들고 각 행을 new int[cols]로 만들었다면, 각 행을 해제한 다음 행 포인터 배열을 해제합니다. 하나의 연속 공간으로 할당한 경우와 섞어서 생각하지 마세요. 이 연습은 행을 따로 할당하는 방식입니다.',code:'int rows = 2, cols = 3;\nint** matrix = new int*[rows];\nfor (int i = 0; i < rows; i++) matrix[i] = new int[cols];\nfor (int i = 0; i < rows; i++) delete[] matrix[i];\ndelete[] matrix;',output:''}],
 frames:[
  {code:'Group* groups = new Group[2];',cells:[['groups[0].scores','미초기화'],['groups[1].scores','미초기화']],note:'포인터 멤버만 있고 점수 배열은 아직 없습니다.'},
  {code:'각 그룹의 scores = new int[count];',cells:[['groups[0].scores','→ 점수 배열 A'],['groups[1].scores','→ 점수 배열 B'],['A','2개 원소'],['B','1개 원소']],note:'바깥 1개와 안쪽 2개, 총 3번 할당한 상태입니다.'},
  {code:'delete[] groups[0].scores;',cells:[['groups[0].scores','사용 불가'],['groups[1].scores','→ 점수 배열 B'],['A','해제됨'],['B','1개 원소']],note:'첫 번째 안쪽 배열을 먼저 해제합니다.'},
  {code:'delete[] groups[1].scores;',cells:[['groups[0].scores','사용 불가'],['groups[1].scores','사용 불가'],['A','해제됨'],['B','해제됨']],note:'두 번째 안쪽 배열도 해제합니다.'},
  {code:'delete[] groups;',cells:[['groups','사용 불가'],['바깥 배열','해제됨']],released:true,note:'이제 바깥 배열을 해제해 모든 할당의 짝을 맞춥니다.'}],
 quizzes:[
  {q:'delete[] groups;만 하면 int* scores가 가리키는 배열도 해제될까요?',options:['자동 해제된다','직접 각 scores를 해제해야 한다','첫 번째 scores만 해제된다'],answer:1,why:'포인터 멤버를 제거하는 것과 그 포인터가 가리키는 별도 공간을 해제하는 것은 다릅니다.'},
  {q:'행별 new[]로 만든 int** matrix의 해제 순서는?',options:['matrix 먼저, 각 행 나중','각 행 먼저, matrix 나중','delete matrix 한 번'],answer:1,why:'행의 주소를 읽을 수 있을 때 행을 해제하고, 마지막에 포인터 배열을 해제합니다.'}],
 blank:{q:'반복문 안에서 각 그룹의 점수 배열을 해제하세요.',before:'for (int i = 0; i < n; i++)\n{\n',after:'\n}\ndelete[] groups;',answers:['delete[] groups[i].scores;'],hint:'바깥 groups가 아니라 i번째 그룹의 scores가 가리키는 배열입니다.',answer:'delete[] groups[i].scores;'},practice:['practice-6-3','practice-8-2','practice-8-3']},
];
export const findLesson=id=>lessons.find(l=>l.id===id);
