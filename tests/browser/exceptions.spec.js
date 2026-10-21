import {test, expect} from '@playwright/test';

test('exception walkthrough distinguishes normal, age, quantity, code and first-error paths', async ({page}) => {
  await page.goto('/#/learn');
  await expect(page.locator('.learning-home .pill').first()).toHaveText('7개 단원 · 0개 완료');
  await page.locator('.lesson-card[href="#/learn/exception-handling"]').click();
  await expect(page.getByRole('heading', {name:'try · throw · catch로 예외 처리하기', exact:true})).toBeVisible();
  await expect(page.locator('.source-note')).toContainText('Ch05');
  await expect(page.locator('.source-note')).toContainText('9~10쪽');
  await expect(page.locator('.lesson-table')).toHaveCount(2);
  const select = page.getByLabel('실행 예시', {exact:true});
  const next = page.getByRole('button', {name:'다음 단계 →', exact:true});
  const prev = page.getByRole('button', {name:'← 이전 단계', exact:true});
  for (const [value, steps, outcome] of [
    ['0',4,'총 결제 금액: 34000원'],
    ['1',4,'[입력 오류]'],
    ['2',4,'[입력 오류]'],
    ['3',5,'[코드 오류]'],
    ['4',3,'할인 코드 검사도달하지 않음'],
  ]) {
    await select.selectOption(value);
    await expect(prev).toBeDisabled();
    await expect(page.locator('#memory-position')).toHaveText(`1 / ${steps}`);
    for (let i=1; i<steps; i++) await next.click();
    await expect(next).toBeDisabled();
    await expect(page.locator('#memory-frame')).toContainText(outcome);
    await prev.click();
    await expect(next).toBeEnabled();
  }
  await select.selectOption('3');
  await next.click(); await next.click();
  await expect(page.locator('.memory-cell.pointed')).toHaveText('예외 자료형float');
  await next.click();
  await expect(page.locator('.memory-cell.pointed')).toHaveText('선택된 처리catch (float)');
  await expect(page.locator('#memory-frame')).toContainText('catch (...)실행하지 않음');
  await select.selectOption('1');
  await next.click();
  await expect(page.locator('.memory-cell.pointed')).toHaveText('예외 자료형int');
  await next.click();
  await expect(page.locator('.memory-cell.pointed')).toHaveText('선택된 처리catch (...)');
  await page.locator('.lesson-side a[href="#/problem/midterm-4"]').click();
  await expect(page.locator('h1')).toHaveText('티켓 요금과 예외 처리');
});

test('all four exception quizzes and the float throw exercise gate completion and persist', async ({page}) => {
  await page.goto('/#/learn/exception-handling');
  const complete = page.locator('#complete-lesson');
  await expect(page.locator('#completion-hint')).toContainText('확인 문제 4개');
  await page.locator('input[name="quiz-0"][value="0"]').check();
  await expect(page.locator('#quiz-feedback-0')).toContainText('double');
  for (const [i,value] of [1,1,1,0].entries()) {
    await page.locator(`input[name="quiz-${i}"][value="${value}"]`).check();
  }
  await expect(complete).toBeDisabled();
  const blank = page.getByRole('textbox', {name:'빈칸에 들어갈 코드'});
  await blank.fill('throw -1.0;');
  await page.getByRole('button', {name:'답 확인', exact:true}).click();
  await expect(page.locator('#blank-feedback')).toContainText('아직 맞지');
  await expect(complete).toBeDisabled();
  await blank.fill('throw -1.0f;');
  await page.getByRole('button', {name:'답 확인', exact:true}).click();
  await expect(complete).toBeEnabled();
  await complete.click();
  await page.reload();
  await expect(complete).toHaveText('학습 완료 ✓');
  await page.goto('/#/learn');
  await expect(page.locator('.learning-home .pill').first()).toHaveText('7개 단원 · 1개 완료');
  await expect(page.locator('.lesson-card[href="#/learn/exception-handling"]')).toContainText('복습하기 ✓');
});
