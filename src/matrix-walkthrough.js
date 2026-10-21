export const matrixWalkthrough = {
  id:'matrix-walkthrough',
  title:'2차원 배열: 한 줄씩 따라가기',
  description:'위 코드의 두 반복문을 i = 0, 1로 나누어 따라갑니다. 행 포인터 배열과 각 행의 정수 배열이 언제 생기고 해제되는지 확인하세요.',
  exercise:{
    id:'matrix-code-fill',
    title:'2차원 배열 코드 채우기',
    description:'그림에서 본 할당과 해제 과정을 네 줄로 완성하세요. rows, cols, matrix, i를 사용하고 각 줄의 세미콜론까지 작성하세요.',
    success:'4줄 모두 맞았어요. 각 행을 먼저 해제하고 마지막에 행 포인터 배열을 해제합니다.',
    fields:[
      {
        label:'1. 행 포인터 배열 할당',
        before:'int rows = 2, cols = 3;\n',
        answers:['int** matrix = new int*[rows];'],
        hint:'matrix를 int**로 선언하고, int*를 담는 칸을 rows개 만드세요. 아직 각 행의 정수를 할당하는 단계는 아닙니다.',
      },
      {
        label:'2. 각 행의 정수 배열 할당',
        before:'for (int i = 0; i < rows; i++)\n',
        answers:['matrix[i] = new int[cols];','*(matrix + i) = new int[cols];'],
        hint:'i번째 행에 정수 cols개를 위한 공간을 만들고 그 주소를 matrix[i]에 저장하세요.',
      },
      {
        label:'3. 각 행의 정수 배열 해제',
        before:'for (int i = 0; i < rows; i++)\n',
        answers:['delete[] matrix[i];','delete[] *(matrix + i);'],
        hint:'반복문 안에서는 i번째 행 하나를 해제합니다. new[]로 만든 배열이므로 delete[]를 사용하세요.',
      },
      {
        label:'4. 행 포인터 배열 해제',
        before:'',
        answers:['delete[] matrix;'],
        hint:'모든 행을 해제한 뒤, 마지막으로 행 주소를 담고 있던 matrix 배열을 해제하세요.',
      },
    ],
  },
  frames:[
    {
      code:'int rows = 2, cols = 3;',
      matrix:{pointers:'absent', rows:['absent','absent'], allocations:0},
      note:'행 2개, 열 3개로 크기만 정했습니다. matrix 포인터와 동적 배열은 아직 만들지 않았습니다.',
    },
    {
      code:'int** matrix = new int*[rows];',
      matrix:{pointers:'allocated', rows:['absent','absent'], allocations:1, focus:'pointers'},
      note:'int*를 담는 칸 2개를 만듭니다. matrix는 그 배열의 첫 칸을 가리킵니다. 각 칸은 아직 초기화되지 않았고, 정수 3개짜리 행은 아직 없습니다.',
    },
    {
      code:'for (int i = 0; i < rows; i++) matrix[i] = new int[cols];',
      stepLabel:'첫 번째 반복문 · i = 0',
      matrix:{pointers:'allocated', rows:['allocated','absent'], allocations:2, focus:'row-0'},
      note:'matrix[0] = new int[3];이 실행됩니다. 0행의 정수 3칸을 만들고 그 주소를 matrix[0]에 저장합니다. 정수 값은 아직 넣지 않았으므로 읽으면 안 됩니다.',
    },
    {
      code:'for (int i = 0; i < rows; i++) matrix[i] = new int[cols];',
      stepLabel:'첫 번째 반복문 · i = 1',
      matrix:{pointers:'allocated', rows:['allocated','allocated'], allocations:3, focus:'row-1'},
      note:'matrix[1] = new int[3];이 실행됩니다. 두 행은 따로 할당한 배열이며, 서로 이어진 하나의 정수 6칸 배열이라고 가정하면 안 됩니다. i가 2가 되면 반복이 끝납니다.',
    },
    {
      code:'for (int i = 0; i < rows; i++) delete[] matrix[i];',
      stepLabel:'두 번째 반복문 · i = 0',
      matrix:{pointers:'allocated', rows:['released','allocated'], allocations:2, focus:'row-0'},
      note:'새 반복문의 i는 다시 0부터 시작합니다. delete[] matrix[0];은 0행의 정수 배열만 해제합니다. matrix[0] 칸과 바깥 행 포인터 배열은 남아 있고, 1행도 아직 살아 있습니다.',
    },
    {
      code:'for (int i = 0; i < rows; i++) delete[] matrix[i];',
      stepLabel:'두 번째 반복문 · i = 1',
      matrix:{pointers:'allocated', rows:['released','released'], allocations:1, focus:'row-1'},
      note:'delete[] matrix[1];로 1행도 해제합니다. 두 칸의 포인터가 자동으로 nullptr이 되는 것은 아닙니다. 해제된 행에 접근하지 말고, 아직 남은 행 포인터 배열을 마지막으로 해제합니다.',
    },
    {
      code:'delete[] matrix;',
      matrix:{pointers:'released', rows:['released','released'], allocations:0, focus:'pointers'},
      note:'행 주소를 담았던 바깥 배열까지 해제했습니다. 총 3번의 new[]에 3번의 delete[]가 대응합니다. 지역 포인터 변수 matrix는 남지만 nullptr로 바뀌지는 않으며, matrix[i]에도 접근하면 안 됩니다. 이 코드는 출력문이 없어 실행 결과는 비어 있습니다.',
    },
  ],
};
