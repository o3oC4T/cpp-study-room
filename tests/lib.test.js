import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHTML, normalizeOutput, firstDifference } from '../src/lib.js';
import { problems } from '../src/problems.js';

test('only CRLF is normalized; trailing spaces, blank lines and final newline matter', () => {
  assert.equal(normalizeOutput('a\r\nb\r\n'), 'a\nb\n');
  assert.equal(firstDifference('a\r\nb\n','a\nb\n'), null);
  assert.deepEqual(firstDifference('a\nb\n','a\nb \n'), {index:3,line:2,column:2});
  assert.deepEqual(firstDifference('a\n','a'), {index:1,line:1,column:2});
  assert.deepEqual(firstDifference('한글\n값: 1\n','한글\n값: 2\n'), {index:6,line:2,column:4});
});
test('source and compiler output are escaped before being rendered', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escapeHTML('&\'한글'), '&amp;&#39;한글');
});
test('four unique problems have starter code and separated standard input/output', () => {
  assert.equal(new Set(problems.map((p)=>p.id)).size,4);
  for (const p of problems) {
    assert.match(p.starter, /int main\(\)/);
    assert.ok(p.requirements.length>0 && p.samples.length>0);
    for (const s of p.samples) {
      assert.ok(s.input.endsWith('\n'));
      assert.ok(s.output.endsWith('\n'));
    }
  }
  assert.match(problems[3].samples[1].output, /\[입력 오류\]/);
  assert.match(problems[3].note, /0세/);
});
