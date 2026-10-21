import {test, expect} from '@playwright/test';

const savedCode = page => page.evaluate(() => JSON.parse(localStorage.getItem('cpp-room:draft:guest:midterm-2'))?.code);

test('Tab inserts a literal tab at the cursor; Shift+Tab outdents; Escape then Tab leaves the editor', async ({page}) => {
  await page.goto('/#/problem/midterm-2');
  const content = page.locator('.cm-content');
  await content.fill('ab');
  await page.keyboard.press('Control+End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Tab');
  await expect(content).toBeFocused();
  await expect.poll(() => savedCode(page)).toBe('a\tb');
  await content.fill('first\nsecond');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Tab');
  await expect.poll(() => savedCode(page)).toBe('\tfirst\n\tsecond');
  await page.keyboard.press('Shift+Tab');
  await expect(content).toBeFocused();
  await expect.poll(() => savedCode(page)).toBe('first\nsecond');
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(content).not.toBeFocused();
  expect(await savedCode(page)).toBe('first\nsecond');
  await page.reload();
  await expect(content).toContainText('second');
  expect(await savedCode(page)).toBe('first\nsecond');
});

test('failed autosave is reported and retried when leaving the window', async ({page}) => {
  await page.goto('/#/problem/midterm-2');
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('cpp-room:draft:')) throw new DOMException('Full', 'QuotaExceededError');
      return window.originalSetItem.call(this, key, value);
    };
  });
  const code = '// 저장 실패 후에도 작성 내용 유지';
  await page.locator('.cm-content').fill(code);
  await expect(page.locator('#save-state')).toContainText('저장 공간 부족');
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalSetItem;
    window.dispatchEvent(new Event('blur'));
  });
  await expect(page.locator('#save-state')).toContainText('저장됨');
  expect(await savedCode(page)).toBe(code);
  await page.reload();
  await expect(page.locator('.cm-content')).toHaveText(code);
});
