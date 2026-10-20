export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function normalizeOutput(value) {
  // Windows/Linux line endings are equivalent; all other whitespace is significant.
  return value.replace(/\r\n/g, '\n');
}

export function firstDifference(expected, actual) {
  const a = normalizeOutput(expected);
  const b = normalizeOutput(actual);
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at++;
  if (at === a.length && at === b.length) return null;
  const prefix = a.slice(0, at).split('\n');
  return { index: at, line: prefix.length, column: prefix.at(-1).length + 1 };
}

export const statusNames = {
  queued: '대기 중', preparing: '접수 중', running: '채점 중', accepted: '맞았습니다',
  wrong_answer: '틀렸습니다', compile_error: '컴파일 에러', runtime_error: '런타임 에러',
  time_limit: '시간 초과', memory_limit: '메모리 초과', output_limit: '출력 초과', system_error: '채점 서버 오류',
  counterexample_found: '반례 발견', no_counterexample: '검사 범위에서 반례 없음',
};
export const modeNames = {sample:'예제 실행',full:'전체 채점',counterexample:'반례 찾기'};

export function downloadSource(code, filename) {
  const text = '\uFEFF' + code.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement('a'), { href: url, download: filename });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function getLocal(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function setLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
