// Transcribed from rendered PDF pages, preserving visible code and masked regions.
// Do not extract the PDF text layer: it contains answers beneath the black masks.
export const midtermStarters = {
  'midterm-1': String.raw`#include <iostream>
#include <string>
using namespace std;

char choice;  // 최종 버전 여부 확인
void updateFileInfo(string filename);

int main() {
	string filename;

	cout << "파일명 입력: ";
	cin >> filename;

	cout << "최종 버전입니까?(Y/N): ";
	cin >> choice;

	updateFileInfo(filename);

	return 0;
}

void updateFileInfo(string filename) {

	// ‘_’와 ‘.’, 버전 위치 탐색
	size_t undPos = /* 빈칸 */
	size_t dotPos = /* 빈칸 */
	size_t verPos = /* 빈칸 */

	// 파일 이름, 버전, 확장자 분리
	string name = /* 빈칸 */
	string ver = /* 빈칸 */
	string ext = /* 빈칸 */

	cout << "\n파일 이름: " << name << endl;
	cout << "현재 버전: " << ver << endl;
	cout << "확장자: " << ext << endl;

	// 문자 형태의 버전을 정수로 변환
	int ver = /* 빈칸 */

	// 최종 파일명 변경
	/* 빈칸 */
	cout << "업데이트된 파일명: "
		<< filename << endl;
}
`,
  'midterm-2': String.raw`#include <iostream>
using namespace std;

int main() {
	// 배열 사이즈를 저장할 변수 및 배열 선언
	/* 빈칸 */
	/* 빈칸 */

	cout << "타이머 시작 시각(시 분 초): ";
	for (int i = 0; i < SIZE; i++)
		cin >> start[i];

	cout << "타이머 지속 시간(시 분 초): ";
	for (int i = 0; i < SIZE; i++)
		cin >> timer[i];

	cout << "\n시작 시각: "
		<< start[0] << "시 "
		<< start[1] << "분 "
		<< start[2] << "초" << endl;

	calculateEnd(/* 빈칸 */);

	cout << "종료 시각: "
		<< start[0] << "시 "
		<< start[1] << "분 "
		<< start[2] << "초" << endl;
	return 0;
}

void calculateEnd(/* 빈칸 */)
{

}
`,
  'midterm-3': String.raw`struct Record {
	double distance;    // 구간별 거리
	int time;           // 구간별 소요 시간 (초)
};

struct Runner {
	int id;             // 참가자 번호 1001부터 시작
	string name;        // 참가자 이름
	int count;          // 구간 개수
	Record* records;    // 참가자 기록
};

int main() {
	int N;

	cout << "러너 수: ";
	cin >> N;

	// 러너 구조체 배열 동적할당
	Runner* runners = /* 빈칸 */

	// 러너별 기록 입력 (반복문 사용)

	cout << "\n======== 러닝 기록 ========" << endl;

	// 러너별 기록 출력 (반복문 사용)

	// 모든 동적 할당 해제

	return 0;
}

void inputRunner(Runner* runner) {

	// 정적변수로 runner Id 부여
	// 이름 및 구간 수 입력

	// 구간 수 만큼 records 동적할당

	// 구간 별 거리, 시
	for (int i = 0; i < runner->count; i++) {
		int hour, minute, second;

		cout << i + 1 << "구간 거리(km): ";
		cin >> /* 빈칸 */

		cout << "시간(시 분 초): ";
		cin >> /* 빈칸 */

		// 초 단위 변환 후 저장
		/* 빈칸 */
	}
}

void printRunner(const Runner* runner) {
	double totalDistance = 0;
	int totalTime = 0;
	// 기록 출력


	// 평균 페이스 계산 및 출력
}
`,
  'midterm-4': String.raw`// 티켓 기본 금액 계산
int ticketPrice(int age, int count) {
	// 나이 또는 티켓 수 관련 오류 처리

	// 나이에 맞는 금액 반환

}

// 할인 금액 적용
int applyDiscount(int total, char code) {

}

int main() {
	int age, count;
	char code;

	cout << "나이 입력: ";
	cin >> age;

	cout << "티켓 수 입력: ";
	cin >> count;

	cout << "할인 코드(N/D): ";
	cin >> code;

	cout << endl;

	try {
		int total = ticketPrice(age, count);
		int finalPrice = applyDiscount(total, code);

		cout << "총 결제 금액: "
			<< finalPrice << "원" << endl;
	}
	catch (/* 빈칸 */) {
		cout << "[코드 오류] "
			<< "올바른 할인 코드를 입력하세요." << endl;
	}
	catch (/* 빈칸 */) {
		cout << "[입력 오류] "
			<< "올바른 나이/티켓 수(1~5장)를 입력하세요." << endl;
	}

	return 0;
}
`,
};
