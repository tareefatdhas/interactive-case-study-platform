import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test('join flow fits a phone and keeps primary fields usable', async ({ page }) => {
  await page.goto('/join');

  await expect(page.getByRole('heading', { name: 'Join the class.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Student number' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('student classroom fits a phone viewport', async ({ page }) => {
  await page.goto('/live/student');

  await expect(page.locator('body')).toContainText('Classfully');
  await expect(page.locator('main')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('course home tabs use real zero states instead of demo progress', async ({ page }) => {
  await page.goto('/live/student');

  await expect(page.getByRole('navigation', { name: 'Course home sections' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your course record starts here.' })).toBeVisible();
  await expect(page.locator('#student-progress-title')).toHaveText('0');
  await expect(page.getByText('No activity recorded yet')).toBeVisible();
  await expect(page.getByText('6 learning moments')).toHaveCount(0);

  await page.getByRole('button', { name: 'Standing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No board published' })).toBeVisible();
  await expect(page.getByText('There is no class standing to show.')).toBeVisible();
  await expect(page.getByText('North Star')).toHaveCount(0);
  await expect(page.getByText('Blue Margin')).toHaveCount(0);

  await page.getByRole('button', { name: 'Rewards', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What you’ve unlocked' })).toBeVisible();
  await expect(page.getByText('How points work')).toBeVisible();
  await expect(page.getByText('Help the room')).toBeVisible();
  await expect(page.getByText('Up to 9')).toBeVisible();
  await expect(page.getByText('No course rewards yet.')).toBeVisible();
  await expect(page.getByText('One-day deadline pass')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('my course opens over a live activity and returns focus to class', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const consolePage = await context.newPage();
  const remotePage = await context.newPage();
  const studentPage = await context.newPage();

  await consolePage.goto('/live');
  await remotePage.goto('/live/remote');
  await studentPage.goto('/live/student');
  await expect(studentPage.getByText('You’re in the room.')).toBeVisible();
  await remotePage.getByRole('button', { name: /Concept check/ }).click();

  await expect(studentPage.getByText('Where do network effects become most fragile?', { exact: true })).toBeVisible();
  const courseTrigger = studentPage.getByRole('button', { name: /Open my course/ });
  await expect(courseTrigger).toBeVisible();
  await courseTrigger.click();

  const courseSheet = studentPage.getByRole('dialog', { name: 'My course' });
  await expect(courseSheet).toBeVisible();
  await courseSheet.getByRole('button', { name: 'Standing', exact: true }).click();
  await expect(courseSheet.getByRole('heading', { name: 'No board published' })).toBeVisible();
  await courseSheet.getByRole('button', { name: /Back to class/ }).click();
  await expect(courseSheet).toBeHidden();
  await expect(studentPage.getByText('Where do network effects become most fragile?', { exact: true })).toBeVisible();
  await expect(courseTrigger).toBeFocused();

  await courseTrigger.click();
  await expect(courseSheet).toBeVisible();
  await remotePage.getByRole('button', { name: 'Choose interaction' }).click();
  await remotePage.getByRole('button', { name: /Knowledge check/ }).click();
  await expect(courseSheet).toBeHidden();
  await expect(studentPage.getByText('Which condition makes a network most vulnerable to collapse?', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(studentPage);

  await context.close();
});

test('the always-available question sheet fits a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/live');
  await page.goto('/live/student');

  await page.getByRole('button', { name: /^Questions/ }).click();
  await expect(page.getByRole('dialog', { name: 'Ask without interrupting.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your question' })).toBeVisible();
  const closeQuestions = page.getByRole('button', { name: 'Close questions' }).last();
  await expect(closeQuestions).toBeVisible();
  await expect(closeQuestions.locator('svg path[opacity]')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Your question' }).fill('Could you give another example?');
  await page.getByRole('button', { name: 'Post question' }).click();
  const ownQuestion = page.locator('.student-question-feed article').filter({ hasText: 'Could you give another example?' });
  await expect(ownQuestion.getByText('Your question')).toBeVisible();
  await expect(ownQuestion.getByRole('button', { name: /upvote/i })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('tapping an answer uses selection styling without a second focus ring', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch interaction is covered by the student mobile project.');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/live/remote');
  await page.getByRole('button', { name: /Concept check/ }).click();
  await page.goto('/live/student');

  const activityIcon = page.locator('.student-interaction-type-icon');
  await expect(activityIcon).toBeVisible();
  const activityIconBox = await activityIcon.boundingBox();
  expect(activityIconBox?.height).toBeLessThanOrEqual(30);

  const answer = page.getByRole('radio').nth(1);
  await answer.tap();
  await expect(answer).toHaveAttribute('aria-checked', 'true');
  const submitResponse = page.getByRole('button', { name: 'Send answer B: Single-provider dependency' });
  await expect(submitResponse).toBeVisible();
  await expect(submitResponse).toContainText('Send answer B');
  const askQuestion = page.getByRole('button', { name: /^Questions/ });
  await expect(askQuestion).toBeVisible();
  await page.waitForTimeout(240);
  const submitBox = await submitResponse.boundingBox();
  const askQuestionBox = await askQuestion.boundingBox();
  const viewport = page.viewportSize();
  expect(submitBox).not.toBeNull();
  expect(askQuestionBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect((submitBox?.y || 0) + (submitBox?.height || 0)).toBeLessThanOrEqual((viewport?.height || 0) - 48);
  expect((askQuestionBox?.x || 0) + (askQuestionBox?.width || 0)).toBeLessThanOrEqual((submitBox?.x || 0) - 8);
  expect(Math.abs((askQuestionBox?.y || 0) - (submitBox?.y || 0))).toBeLessThanOrEqual(1);
  const dockTop = await page.locator('.student-response-action.is-ready').evaluate((element) => element.getBoundingClientRect().top);
  const crossingChoices = await page.getByRole('radio').evaluateAll((choices, boundary) => choices.filter((choice) => {
    const bounds = choice.getBoundingClientRect();
    return bounds.top < boundary && bounds.bottom > boundary - 1;
  }).length, dockTop);
  expect(crossingChoices).toBe(0);
  const selectedStyle = await answer.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      outlineStyle: styles.outlineStyle,
      selected: element.classList.contains('is-selected'),
      userSelect: styles.userSelect,
    };
  });
  expect(selectedStyle).toEqual({ outlineStyle: 'none', selected: true, userSelect: 'none' });

  const nextAnswer = page.getByRole('radio').nth(2);
  await nextAnswer.tap();
  await expect(nextAnswer).toHaveAttribute('aria-checked', 'true');
  await answer.tap();
  await expect(answer).toHaveAttribute('aria-checked', 'true');

  await askQuestion.tap();
  const questionSheet = page.getByRole('dialog', { name: 'Ask without interrupting.' });
  await expect(questionSheet).toBeVisible();
  await questionSheet.getByRole('button', { name: 'Close questions' }).tap();
  await expect(questionSheet).toBeHidden();
  await expect(answer).toHaveAttribute('aria-checked', 'true');
  await expect(submitResponse).toBeVisible();
  await submitResponse.tap();
  await expect(page.getByText('Response sent')).toBeVisible();

  await page.goto('/live/student');
  const keyboardFocusedAnswer = page.getByRole('radio').first();
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Tab');
    if (await keyboardFocusedAnswer.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(keyboardFocusedAnswer).toBeFocused();
  await page.waitForTimeout(180);
  const keyboardFocusStyle = await keyboardFocusedAnswer.evaluate((element) => ({
    outlineStyle: window.getComputedStyle(element).outlineStyle,
    focusMarkerOpacity: window.getComputedStyle(element, '::after').opacity,
  }));
  expect(keyboardFocusStyle).toEqual({ outlineStyle: 'none', focusMarkerOpacity: '1' });
});
