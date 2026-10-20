export const ids = new Set([...Array.from({length:4},(_,i)=>`midterm-${i+1}`), ...Array.from({length:8},(_,s)=>Array.from({length:4},(_,i)=>`practice-${s+1}-${i+1}`)).flat()]);
export const terminal = new Set(['accepted','wrong_answer','compile_error','runtime_error','time_limit','memory_limit','output_limit','system_error','counterexample_found','no_counterexample']);
const testStatuses = new Set(['accepted','wrong_answer','runtime_error','time_limit','memory_limit','output_limit']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateSubmission(body: Record<string, unknown>) {
  if (!ids.has(String(body.problemId))) throw new Error('올바른 문제를 선택해 주세요.');
  if (!['sample','full','counterexample'].includes(String(body.mode))) throw new Error('잘못된 채점 방식입니다.');
  if (typeof body.code !== 'string' || !body.code.trim() || new TextEncoder().encode(body.code).length > 65536 || body.code.includes('\0'))
    throw new Error('코드는 비어 있지 않은 64KB 이하의 텍스트여야 해요.');
  if (!uuid.test(String(body.requestId))) throw new Error('제출 식별자가 올바르지 않습니다.');
  return { problemId: String(body.problemId), mode: String(body.mode), code: body.code, requestId: String(body.requestId) };
}

export function validId(value: unknown): string {
  if (!uuid.test(String(value))) throw new Error('제출 식별자가 올바르지 않습니다.');
  return String(value);
}

export function validateReport(raw: unknown, submission: {id: string; commit_sha: string; problem_id: string; mode: string}) {
  const r = raw as Record<string, any>;
  if (!r || r.schema !== 1 || r.submissionId !== submission.id || r.commitSha !== submission.commit_sha ||
      r.problemId !== submission.problem_id || r.mode !== submission.mode || !terminal.has(r.status))
    throw new Error('채점 결과의 출처가 일치하지 않습니다.');
  if (!Array.isArray(r.tests) || r.tests.length > 64) throw new Error('잘못된 채점 결과입니다.');
  const tests = r.tests.map((t: Record<string, unknown>) => {
    if (!t || !testStatuses.has(String(t.status)) || typeof t.sample !== 'boolean') throw new Error('잘못된 테스트 결과입니다.');
    const item: Record<string, unknown> = { status: t.status, sample: t.sample };
    const counterexample = submission.mode === 'counterexample' && t.counterexample === true;
    if (counterexample) {
      if (typeof t.input !== 'string' || t.input.length > 4096) throw new Error('잘못된 반례 입력입니다.');
      item.counterexample = true; item.input = t.input;
    }
    if (t.sample || counterexample) {
      item.truncated = t.truncated === true;
      for (const field of ['expected','actual']) {
        if (typeof t[field] !== 'string' || (t[field] as string).length > 32768) throw new Error('출력 크기 제한 초과');
        item[field] = t[field];
      }
    }
    return item;
  });
  if (r.status === 'accepted' && (!tests.length || tests.some((t: any) => t.status !== 'accepted')))
    throw new Error('잘못된 통과 결과입니다.');
  if (['counterexample_found','no_counterexample'].includes(r.status) && submission.mode !== 'counterexample')
    throw new Error('잘못된 반례 결과입니다.');
  if (r.status === 'counterexample_found' && (tests.length !== 1 || !tests[0].counterexample || tests[0].status === 'accepted'))
    throw new Error('반례가 누락되었습니다.');
  if (r.status === 'no_counterexample' && (tests.length !== 0 || !Number.isInteger(r.tested) || r.tested < 1 || r.tested > 64))
    throw new Error('반례 검사 개수가 올바르지 않습니다.');
  if (submission.mode === 'counterexample' && r.status === 'accepted') throw new Error('반례 검색은 정답 판정이 아닙니다.');
  return { status: r.status as string, tests,
    tested: Number.isInteger(r.tested) && r.tested >= 0 && r.tested <= 64 ? r.tested : tests.length,
    message: typeof r.message === 'string' ? r.message.slice(0, 16000) : '' };
}
