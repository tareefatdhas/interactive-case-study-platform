import { expect, test } from '@playwright/test';
import { buildWordCloudItems } from '../src/app/live/live-data';

test('one-off word cloud ideas stay at a readable base prominence', () => {
  const uniqueResponses = Array.from({ length: 36 }, (_, index) => ({ id: `unique-${index}`, text: `Idea ${index + 1}` }));
  const items = buildWordCloudItems(uniqueResponses);
  expect(items).toHaveLength(36);
  expect(Math.max(...items.map((item) => item.strength))).toBeLessThan(0.4);
});

test('instructor can reach account recovery from sign in', async ({ page }) => {
  await page.route('**/api/auth/password-reset', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  const googleButton = page.getByRole('button', { name: 'Continue with Google' });
  await expect(googleButton).toBeVisible();
  await expect(page.getByText('Or continue with email')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();

  const googleBox = await googleButton.boundingBox();
  const emailBox = await page.getByLabel('Email').boundingBox();
  expect(googleBox?.y).toBeLessThan(emailBox?.y ?? 0);

  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole('heading', { name: 'Reset your password.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();

  await page.getByLabel('Instructor email').fill('instructor@example.edu');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox.' })).toBeVisible();
  await expect(page.getByText('instructor@example.edu')).toBeVisible();
});

test('instructor signup offers Google before the email form', async ({ page }) => {
  await page.goto('/signup');

  await expect(page.getByRole('heading', { name: 'Create your instructor account.' })).toBeVisible();
  const googleButton = page.getByRole('button', { name: 'Continue with Google' });
  await expect(googleButton).toBeVisible();
  await expect(page.getByText('Or continue with email')).toBeVisible();

  const googleBox = await googleButton.boundingBox();
  const nameBox = await page.getByLabel('Name').boundingBox();
  expect(googleBox?.y).toBeLessThan(nameBox?.y ?? 0);
});

test('student join collects attendance identity without requiring a display name', async ({ page }) => {
  await page.goto('/join');

  await expect(page.getByRole('heading', { name: 'Join the class.' })).toBeVisible();
  await expect(page.getByLabel(/class code/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Student number' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Preferred name (optional)' })).toBeVisible();
});

test('real classroom routes never flash demo session data while loading', async ({ browser }) => {
  const context = await browser.newContext();
  const routes = [
    '/live?sessionId=missing-session',
    '/live/display?sessionId=missing-session&ownerUid=missing-owner',
    '/live/student?sessionId=missing-session&ownerUid=missing-owner',
    '/live/remote?sessionId=missing-session&ownerUid=missing-owner',
  ];

  for (const route of routes) {
    const page = await context.newPage();
    await page.addInitScript(() => {
      const trackedWindow = window as Window & { __classfullyDemoFlashSeen?: boolean };
      trackedWindow.__classfullyDemoFlashSeen = false;
      const demoMarkers = ['ECON 302', 'Prof. Maya Chen', 'How are you arriving today?'];
      const watchForDemoData = () => {
        const pageText = document.body?.innerText || '';
        if (demoMarkers.some((marker) => pageText.includes(marker))) {
          trackedWindow.__classfullyDemoFlashSeen = true;
        }
      };
      new MutationObserver(watchForDemoData).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    });
    await page.goto(route);
    await page.waitForTimeout(800);
    const demoFlashSeen = await page.evaluate(() => (
      (window as Window & { __classfullyDemoFlashSeen?: boolean }).__classfullyDemoFlashSeen
    ));
    expect(demoFlashSeen, `demo data appeared on ${route}`).toBe(false);
    await page.close();
  }

  await context.close();
});

test('a student gets a manual reconnect fallback when automatic recovery cannot find the class', async ({ page }) => {
  test.setTimeout(15_000);
  await page.goto('/live/student?sessionId=missing-session');
  await expect(page.getByText('Finding your class again.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reconnect now' })).toBeVisible({ timeout: 9_000 });
  await page.getByRole('button', { name: 'Reconnect now' }).click();
  await expect(page.getByText('Finding your class again.', { exact: true })).toBeVisible();
});

test('the live console and projector surfaces render', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const displayPage = await context.newPage();

  await consolePage.goto('/live');
  await displayPage.goto('/live/display');

  await expect(consolePage.locator('body')).toContainText('Classfully');
  await expect(displayPage.locator('body')).toContainText('Classfully');
  await expect(consolePage.locator('main')).toBeVisible();
  await expect(displayPage.locator('main')).toBeVisible();
  await expect(consolePage.locator('.professor-card img[src*="prof-maya-chen"]')).toHaveCount(0);
  await expect(consolePage.locator('.professor-card .professor-avatar')).toHaveText(/^[A-Z]{1,2}$/);
  await expect(consolePage.locator('.topbar-actions').getByRole('button')).toHaveCount(2);
  await expect(consolePage.getByRole('button', { name: 'Float controls' })).toBeVisible();
  await consolePage.getByRole('button', { name: 'More', exact: true }).click();
  await expect(consolePage.getByRole('menu', { name: 'More class controls' })).toBeVisible();
  await expect(consolePage.getByRole('menuitem', { name: /Attendance/ })).toBeVisible();
  await expect(consolePage.getByRole('menuitem', { name: /Welcome class/ })).toBeVisible();
  await expect(consolePage.getByRole('menuitem', { name: /Check display/ })).toBeVisible();
  await expect(consolePage.getByRole('menuitem', { name: /Reset session/ })).toBeVisible();
  await consolePage.getByRole('menuitem', { name: /Reset session/ }).click();
  const resetDialog = consolePage.getByRole('dialog', { name: 'Reset this session?' });
  await expect(resetDialog).toBeVisible();
  await expect(resetDialog).toContainText('Attendance and connected students stay in place.');
  await resetDialog.getByRole('button', { name: 'Keep current data' }).click();
  await expect(resetDialog).toBeHidden();

  await consolePage.getByRole('button', { name: 'More', exact: true }).click();
  await consolePage.getByRole('menuitem', { name: /Reset session/ }).click();
  await resetDialog.getByRole('button', { name: 'Reset and start over' }).click();
  await expect(consolePage.getByRole('status').filter({ hasText: 'Session reset.' })).toBeVisible();
  await expect(consolePage.getByRole('heading', { name: 'Let everyone get into the room.' })).toBeVisible();
  await expect(consolePage.getByRole('button', { name: /Start first activity/ })).toBeVisible();
  await expect(consolePage.getByRole('button', { name: /Open classroom display/ })).toHaveCount(0);

  await context.close();
});

test('the class lobby carries students from joining into the first activity without a refresh', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const displayPage = await context.newPage();
  const studentPage = await context.newPage();
  await displayPage.setViewportSize({ width: 1920, height: 1080 });
  await studentPage.setViewportSize({ width: 390, height: 844 });

  await Promise.all([
    consolePage.goto('/live'),
    displayPage.goto('/live/display'),
    studentPage.goto('/live/student'),
  ]);

  await consolePage.getByRole('button', { name: 'More', exact: true }).click();
  await consolePage.getByRole('menuitem', { name: /Show join screen/ }).click();

  await expect(consolePage.getByRole('heading', { name: 'Let everyone get into the room.' })).toBeVisible();
  await expect(consolePage.getByText('classfully.com/join', { exact: true })).toBeVisible();
  await expect(consolePage.getByRole('button', { name: /Start first activity/ })).toBeVisible();
  await expect(displayPage.getByRole('heading', { name: 'Join the room.' })).toBeVisible();
  const lobbyQrBox = await displayPage.locator('.classroom-lobby-qr svg').boundingBox();
  expect(lobbyQrBox?.width).toBeGreaterThanOrEqual(400);
  expect(lobbyQrBox?.height).toBeGreaterThanOrEqual(400);
  expect(await displayPage.evaluate(() => document.documentElement.scrollHeight)).toBe(await displayPage.evaluate(() => window.innerHeight));
  await expect(displayPage.getByText('482 916', { exact: true }).first()).toBeVisible();
  await expect(studentPage.getByRole('heading', { name: 'Ready when your instructor is.' })).toBeVisible();
  await expect(studentPage.getByText('You do not need to refresh')).toBeVisible();
  const lobbyGuide = studentPage.locator('.student-quiet-guide');
  await expect(lobbyGuide.getByText('Ask without interrupting.')).toBeVisible();
  await expect(lobbyGuide.getByText('Classmates will not see your name, and your instructor can respond when the moment is right.')).toBeVisible();
  expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await lobbyGuide.getByRole('button', { name: 'Open Questions' }).click();
  await expect(studentPage.getByRole('dialog', { name: 'Ask without interrupting.' })).toBeVisible();
  await studentPage.getByRole('button', { name: 'Close questions' }).last().click();
  await expect(studentPage.locator('.student-quiet-guide')).toHaveCount(0);

  await consolePage.getByRole('button', { name: /Start first activity/ }).click();
  await expect(displayPage.getByRole('heading', { name: 'How are you arriving today?' })).toBeVisible();
  await expect(studentPage.getByRole('heading', { name: 'How are you arriving today?' })).toBeVisible();
  await expect(studentPage.getByRole('radio', { name: /Energized/ })).toBeVisible();
  await expect(studentPage.locator('.student-quiet-guide')).toHaveCount(0);

  await consolePage.getByRole('button', { name: 'More', exact: true }).click();
  await consolePage.getByRole('menuitem', { name: /Show join screen/ }).click();
  await expect(displayPage.getByRole('heading', { name: 'Join the room.' })).toBeVisible();
  await expect(studentPage.getByRole('radio', { name: /Energized/ })).toBeVisible();
  await consolePage.getByRole('button', { name: /Return to current activity/ }).click();
  await expect(displayPage.getByRole('heading', { name: 'How are you arriving today?' })).toBeVisible();

  await studentPage.getByRole('radio', { name: /Energized/ }).click();
  await studentPage.getByRole('button', { name: 'Send response' }).click();
  const waitingGuide = studentPage.locator('.student-quiet-guide');
  await expect(waitingGuide.getByText('Help choose what gets discussed.')).toBeVisible();
  await waitingGuide.getByRole('button', { name: 'See questions' }).click();
  await expect(studentPage.getByRole('dialog', { name: 'Ask without interrupting.' })).toBeVisible();

  await context.close();
});

test('a custom full-screen timer launched from the instructor console reaches the projector and student views', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const displayPage = await context.newPage();
  const studentPage = await context.newPage();

  await consolePage.goto('/live');
  await displayPage.goto('/live/display');
  await studentPage.goto('/live/student');

  await consolePage.getByRole('button', { name: 'Session plan' }).click();
  const sessionPlan = consolePage.getByRole('dialog', { name: 'Session plan' });
  await sessionPlan.getByRole('button', { name: 'Add interaction' }).click();
  await expect(sessionPlan.getByRole('group', { name: 'Interaction types' })).toBeVisible();
  await sessionPlan.getByRole('button', { name: /Timer/ }).click();
  await sessionPlan.getByLabel('Title').fill('Closing reflection timer');
  await sessionPlan.getByLabel('Instructions').fill('Write one **clear takeaway**.\n1. Name the idea\n2. Add one example');
  await sessionPlan.getByLabel('Minutes').fill('2');
  await sessionPlan.getByLabel('Seconds').fill('30');
  await sessionPlan.getByRole('button', { name: 'Add to plan' }).click();
  await expect(sessionPlan.getByText('Closing reflection timer', { exact: true }).first()).toBeVisible();
  const plannedTimer = sessionPlan.locator('article').filter({ hasText: 'Closing reflection timer' });
  await plannedTimer.getByRole('button', { name: 'Edit Closing reflection timer' }).click();
  await expect(sessionPlan.getByLabel('Instructions')).toHaveValue(/clear takeaway/);
  await expect(sessionPlan.locator('.interaction-markdown-preview strong')).toHaveText('clear takeaway');
  await expect(sessionPlan.locator('.interaction-markdown-preview ol li')).toHaveCount(2);
  await sessionPlan.getByRole('button', { name: 'Save changes' }).click();
  await expect(sessionPlan).toContainText('Preview changes last until you reload this page.');
  const reorderHandle = sessionPlan.getByRole('button', { name: 'Reorder Closing reflection timer' });
  await reorderHandle.focus();
  await reorderHandle.press('ArrowUp');
  await expect(sessionPlan.locator('article').filter({ hasText: 'Closing reflection timer' }).locator('.session-plan-index')).toHaveText('08');
  const dragTarget = sessionPlan.getByRole('button', { name: 'Reorder Apply the idea' });
  const sourceBox = await reorderHandle.boundingBox();
  const targetBox = await dragTarget.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await consolePage.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await consolePage.mouse.down();
  await consolePage.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2 - 12, { steps: 3 });
  await consolePage.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 12 });
  await consolePage.mouse.up();
  await expect(sessionPlan.locator('article').filter({ hasText: 'Closing reflection timer' }).locator('.session-plan-index')).toHaveText('07');
  await consolePage.keyboard.press('Escape');
  await expect(sessionPlan).toBeHidden();

  await expect(consolePage.getByRole('button', { name: /Add now/ })).toBeVisible();
  await consolePage.getByRole('button', { name: /Add now/ }).click();
  const quickAdd = consolePage.getByRole('dialog', { name: 'Add something during class' });
  await expect(quickAdd.getByRole('group', { name: 'Interaction types' })).toBeVisible();
  await quickAdd.getByRole('button', { name: /Timer/ }).click();
  await quickAdd.getByLabel('Title').fill('Team case discussion');
  await quickAdd.getByLabel('Instructions').fill('Work in teams of **four**.\n1. Choose a case\n2. Prepare one recommendation');
  await quickAdd.getByLabel('Minutes').fill('7');
  await quickAdd.getByLabel('Seconds').fill('30');
  await quickAdd.getByRole('button', { name: 'Show now' }).click();

  await expect(displayPage.getByRole('heading', { name: 'Team case discussion' })).toBeVisible();
  await expect(displayPage.locator('.display-clock-instructions strong')).toHaveText('four');
  await expect(displayPage.locator('.display-clock-instructions ol li')).toHaveCount(2);
  await expect(displayPage.getByRole('timer', { name: /Team case discussion: 7:(?:30|29) remaining/ })).toBeVisible();
  await expect(displayPage.getByRole('complementary', { name: /Team case discussion/ })).toHaveCount(0);
  const progressRing = displayPage.locator('.full-screen-projector-timer svg');
  await expect.poll(async () => Math.round((await progressRing.boundingBox())?.width || 0)).toBeGreaterThanOrEqual(380);
  const progressRingBox = await progressRing.boundingBox();
  expect(Math.round(progressRingBox?.width || 0)).toBeLessThanOrEqual(680);
  const timerLabelSize = await displayPage.locator('.full-screen-projector-timer small').evaluate((label) => Number.parseFloat(getComputedStyle(label).fontSize));
  expect(timerLabelSize).toBeGreaterThanOrEqual(13);
  const timerCountFont = await displayPage.locator('.full-screen-projector-timer strong').evaluate((count) => getComputedStyle(count).fontFamily);
  expect(timerCountFont).toContain('Inter');
  expect(await displayPage.evaluate(() => document.documentElement.scrollWidth)).toBe(await displayPage.evaluate(() => window.innerWidth));
  await expect(studentPage.getByRole('timer', { name: /Team case discussion/ })).toBeVisible();
  await expect(studentPage.locator('.student-clock-instructions strong')).toHaveText('four');
  await expect(consolePage.getByRole('timer', { name: /Team case discussion/ })).toBeVisible();

  await consolePage.getByRole('button', { name: 'Session plan' }).click();
  const liveTimerPlan = consolePage.getByRole('dialog', { name: 'Session plan' });
  const liveTimerItem = liveTimerPlan.locator('article').filter({ hasText: 'Team case discussion' });
  await liveTimerItem.getByRole('button', { name: 'Edit Team case discussion' }).click();
  await liveTimerPlan.getByLabel('Title').fill('Team case decision');
  await liveTimerPlan.getByLabel('Instructions').fill('Work in teams of **four**.\n1. Choose one case\n2. Prepare one recommendation');
  await liveTimerPlan.getByRole('button', { name: 'Save changes' }).click();
  await expect(displayPage.getByRole('heading', { name: 'Team case decision' })).toBeVisible();
  await expect(studentPage.getByRole('heading', { name: 'Team case decision' })).toBeVisible();
  await consolePage.keyboard.press('Escape');
  await expect(liveTimerPlan).toBeHidden();

  await consolePage.getByRole('button', { name: /End timer/ }).click();
  await expect(displayPage.getByRole('timer', { name: /Team case decision/ })).toBeHidden();

  await consolePage.getByRole('button', { name: 'Session plan' }).click();
  const addedTimer = consolePage.getByRole('dialog', { name: 'Session plan' }).locator('article').filter({ hasText: 'Team case decision' });
  await expect(addedTimer).toBeVisible();
  await addedTimer.getByRole('button', { name: /Show/ }).click();
  await expect(displayPage.getByRole('timer', { name: /Team case decision/ })).toBeVisible();
  await consolePage.getByRole('button', { name: /End timer/ }).click();

  await context.close();
});

test('the live session editor preserves complete quiz settings and formatted prompts', async ({ page }) => {
  await page.goto('/live');
  await page.getByRole('button', { name: 'Session plan' }).click();
  const sessionPlan = page.getByRole('dialog', { name: 'Session plan' });
  await sessionPlan.getByRole('button', { name: 'Add interaction' }).click();
  await sessionPlan.getByRole('button', { name: /Quiz/ }).click();

  await sessionPlan.getByLabel('Title').fill('Platform trade-offs');
  await sessionPlan.getByLabel('Question or instruction').fill('Which choice creates the **strongest moat**?');
  await sessionPlan.getByRole('textbox', { name: 'Choice 1', exact: true }).fill('High switching costs');
  await sessionPlan.getByRole('textbox', { name: 'Choice 2', exact: true }).fill('A larger office');
  await sessionPlan.getByLabel('Answer explanation').fill('Switching costs make leaving the platform more difficult.');
  await sessionPlan.getByLabel('When students see results').selectOption('after-reveal');
  await sessionPlan.getByRole('button', { name: 'Add choice' }).click();
  await sessionPlan.getByRole('textbox', { name: 'Choice 5', exact: true }).fill('Exclusive data');
  await sessionPlan.getByRole('button', { name: 'Add to plan' }).click();

  const plannedQuiz = sessionPlan.locator('article').filter({ hasText: 'Platform trade-offs' });
  await plannedQuiz.getByRole('button', { name: 'Edit Platform trade-offs' }).click();
  await expect(sessionPlan.getByLabel('Question or instruction')).toHaveValue(/strongest moat/);
  await expect(sessionPlan.locator('.interaction-markdown-preview strong')).toHaveText('strongest moat');
  await expect(sessionPlan.getByRole('textbox', { name: 'Choice 5', exact: true })).toHaveValue('Exclusive data');
  await expect(sessionPlan.getByLabel('Answer explanation')).toHaveValue(/Switching costs/);
  await expect(sessionPlan.getByLabel('When students see results')).toHaveValue('after-reveal');
});

test('the instructor can move to the next interaction or choose another without leaving the remote', async ({ browser }) => {
  const context = await browser.newContext();
  const remotePage = await context.newPage();
  const displayPage = await context.newPage();
  const studentPage = await context.newPage();

  await remotePage.setViewportSize({ width: 410, height: 690 });
  await remotePage.goto('/live/remote');
  await displayPage.goto('/live/display');
  await studentPage.goto('/live/student');

  await remotePage.getByRole('button', { name: /Arrival pulse/ }).click();
  await expect(remotePage.getByText('Up next · 2 of 8')).toBeVisible();
  await expect(remotePage.getByText('Concept check')).toBeVisible();
  await remotePage.getByRole('button', { name: 'Start next' }).click();

  await expect(displayPage.getByRole('heading', { name: 'Where do network effects become most fragile?' })).toBeVisible();
  await expect(studentPage.getByText('Where do network effects become most fragile?', { exact: true })).toBeVisible();

  await remotePage.getByRole('button', { name: 'Choose interaction' }).click();
  await expect(remotePage.getByRole('region', { name: 'Prepared interactions' })).toBeVisible();
  await remotePage.getByRole('button', { name: /Knowledge check/ }).click();

  await expect(displayPage.getByRole('heading', { name: 'Which condition makes a network most vulnerable to collapse?' })).toBeVisible();
  await expect(studentPage.getByText('Which condition makes a network most vulnerable to collapse?', { exact: true })).toBeVisible();

  await context.close();
});

test('a student reconnects automatically without losing an unfinished answer', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const remotePage = await context.newPage();
  const studentPage = await context.newPage();

  await consolePage.goto('/live');
  await remotePage.goto('/live/remote');
  await studentPage.goto('/live/student');

  await remotePage.getByRole('button', { name: /Concept check/ }).click();
  await expect(studentPage.getByText('Where do network effects become most fragile?', { exact: true })).toBeVisible();
  const unfinishedAnswer = studentPage.getByRole('radio', { name: /Single-provider dependency/ });
  await unfinishedAnswer.click();
  await expect(unfinishedAnswer).toHaveAttribute('aria-checked', 'true');

  await consolePage.getByRole('button', { name: 'Session plan' }).click();
  const sessionPlan = consolePage.getByRole('dialog', { name: 'Session plan' });
  await sessionPlan.getByRole('button', { name: 'Edit Concept check' }).click();
  await expect(sessionPlan.getByText('Students keep the current version.', { exact: true })).toBeVisible();
  await expect(unfinishedAnswer).toHaveAttribute('aria-checked', 'true');
  await consolePage.keyboard.press('Escape');

  await studentPage.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(studentPage.getByRole('status').filter({ hasText: 'Reconnecting to class' })).toBeVisible();
  await expect(unfinishedAnswer).toHaveAttribute('aria-checked', 'true');

  await studentPage.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(studentPage.getByText('Connected', { exact: true })).toBeVisible();
  await expect(studentPage.getByText('Reconnecting to class', { exact: true })).toHaveCount(0);
  await expect(unfinishedAnswer).toHaveAttribute('aria-checked', 'true');

  await remotePage.getByRole('button', { name: 'Choose interaction' }).click();
  await remotePage.getByRole('button', { name: /Knowledge check/ }).click();
  await expect(studentPage.getByRole('status').filter({ hasText: 'The class moved to the next activity.' })).toBeVisible();
  await expect(studentPage.getByText('Which condition makes a network most vulnerable to collapse?', { exact: true })).toBeVisible();
  await expect(studentPage.getByRole('radio').first()).toHaveAttribute('aria-checked', 'false');

  await context.close();
});

test('pulse, poll, quiz, and short response complete across every classroom surface', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const remotePage = await context.newPage();
  const displayPage = await context.newPage();
  const studentPage = await context.newPage();

  await consolePage.goto('/live');
  await remotePage.goto('/live/remote');
  await displayPage.goto('/live/display');
  await studentPage.goto('/live/student');

  const launchInteraction = async (name: RegExp) => {
    const chooseButton = remotePage.getByRole('button', { name: 'Choose interaction' });
    if (await chooseButton.isVisible()) await chooseButton.click();
    await remotePage.getByRole('button', { name }).click();
    await expect(remotePage.locator('.remote-active-card')).toBeVisible();
  };

  const submitSelection = async (optionName: RegExp) => {
    await studentPage.getByRole('radio', { name: optionName }).click();
    await studentPage.getByRole('button', { name: 'Send response' }).click();
    await expect(studentPage.getByText('Response sent')).toBeVisible();
    await expect(studentPage.getByText('The room is responding')).toBeVisible();
    await expect(studentPage.getByText('You’re the first response. Stay here for what comes next.')).toBeVisible();
    await expect(remotePage.locator('.remote-response-metric strong')).toHaveText('1');
    await expect(displayPage.locator('.interaction-display-count strong')).toHaveText('1');
  };

  await launchInteraction(/Arrival pulse/);
  await expect(studentPage.getByRole('heading', { name: 'How are you arriving today?' })).toBeVisible();
  await submitSelection(/Steady/);

  await launchInteraction(/Concept check/);
  await expect(studentPage.getByRole('heading', { name: 'Where do network effects become most fragile?' })).toBeVisible();
  await submitSelection(/Single-provider dependency/);
  await remotePage.getByRole('button', { name: 'Reveal result' }).click();
  await expect(displayPage.getByText('Single-provider dependency')).toBeVisible();
  await expect(studentPage.getByRole('heading', { name: 'The room’s answer is ready.' })).toBeVisible();
  await expect(studentPage.getByText('Private prediction')).toHaveCount(0);
  await expect(studentPage.getByText('You predicted')).toHaveCount(0);
  await expect(studentPage.getByText('The room went another way.')).toHaveCount(0);

  await launchInteraction(/Knowledge check/);
  await expect(studentPage.getByRole('heading', { name: 'Which condition makes a network most vulnerable to collapse?' })).toBeVisible();
  await submitSelection(/Dependence on one critical provider/);
  await remotePage.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(studentPage.getByText('The answer is out.')).toBeVisible();
  await expect(displayPage.getByText('Dependence on one critical provider')).toBeVisible();

  await launchInteraction(/Muddiest point/);
  await expect(studentPage.getByRole('heading', { name: 'What is still unclear before we move on?' })).toBeVisible();
  await studentPage.getByRole('textbox', { name: 'Your response' }).fill('I need another example of indirect effects.');
  await studentPage.getByRole('button', { name: 'Send response' }).click();
  await expect(studentPage.getByText('Response sent')).toBeVisible();
  await expect(remotePage.locator('.remote-response-metric strong')).toHaveText('1');
  await expect(consolePage.getByText('I need another example of indirect effects.')).toBeVisible();
  await expect(displayPage.getByText('I need another example of indirect effects.')).toHaveCount(0);

  await context.close();
});

test('earned participation appears on the student Home tab', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const remotePage = await context.newPage();
  const studentPage = await context.newPage();

  await consolePage.goto('/live');
  await remotePage.goto('/live/remote');
  await studentPage.goto('/live/student');

  await remotePage.getByRole('button', { name: /Arrival pulse/ }).click();
  await studentPage.getByRole('radio', { name: /Steady/ }).click();
  await studentPage.getByRole('button', { name: 'Send response' }).click();
  await expect(studentPage.getByText('Response sent')).toBeVisible();
  await studentPage.waitForTimeout(900);
  await remotePage.getByRole('button', { name: 'Return to slides' }).click();

  await expect(studentPage.getByRole('heading', { name: 'Your semester is taking shape.' })).toBeVisible();
  await expect(studentPage.locator('#student-progress-title')).toHaveText('1');
  await expect(studentPage.getByRole('heading', { name: 'Recent points' })).toBeVisible();
  await expect(studentPage.getByText('Pulse response')).toBeVisible();

  await context.close();
});

test('a student can ask at any time and a classmate can upvote the question', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const remotePage = await context.newPage();
  const studentPage = await context.newPage();
  const classmatePage = await context.newPage();
  const secondClassmatePage = await context.newPage();
  const question = 'Could you explain why switching costs matter here?';

  await consolePage.goto('/live');
  await remotePage.goto('/live/remote');
  await consolePage.evaluate(() => localStorage.setItem('living-seminar-demo-student-id', 'question-author'));
  await studentPage.goto('/live/student');
  await consolePage.evaluate(() => localStorage.setItem('living-seminar-demo-student-id', 'question-voter-one'));
  await classmatePage.goto('/live/student');
  await consolePage.evaluate(() => localStorage.setItem('living-seminar-demo-student-id', 'question-voter-two'));
  await secondClassmatePage.goto('/live/student');

  await studentPage.getByRole('button', { name: /^Questions/ }).click();
  await expect(studentPage.getByRole('dialog', { name: 'Ask without interrupting.' })).toBeVisible();
  await studentPage.getByRole('textbox', { name: 'Your question' }).fill(question);
  await studentPage.getByRole('button', { name: 'Post question' }).click();
  await expect(studentPage.getByText('Question sent. If it helps the room, it can earn up to 9 points this session.')).toBeVisible();
  await expect(studentPage.locator('.student-question-reward-toast').filter({ hasText: '+1 points' })).toContainText('Asked a question');
  const ownQuestion = studentPage.locator('.student-question-feed article').filter({ hasText: question });
  await expect(ownQuestion.getByText('Your question')).toBeVisible();
  await expect(ownQuestion.getByRole('button', { name: /upvote/i })).toHaveCount(0);
  await expect(consolePage.locator('.question-card').filter({ hasText: question })).toBeVisible();

  await classmatePage.getByRole('button', { name: /^Questions/ }).click();
  const classmateQuestion = classmatePage.locator('.student-question-feed article').filter({ hasText: question });
  await expect(classmateQuestion).toBeVisible();
  const classmateVote = classmateQuestion.getByRole('button', { name: 'Upvote question. 0 votes.' });
  await expect(classmateVote).toHaveAttribute('aria-pressed', 'false');
  await classmateVote.click();
  await expect(classmateQuestion.getByRole('button', { name: 'Remove upvote from question. 1 vote.' })).toHaveAttribute('aria-pressed', 'true');
  await expect(consolePage.locator('.question-card').filter({ hasText: question }).getByLabel('1 student upvotes')).toBeVisible();

  await secondClassmatePage.getByRole('button', { name: /^Questions/ }).click();
  const secondClassmateQuestion = secondClassmatePage.locator('.student-question-feed article').filter({ hasText: question });
  await secondClassmateQuestion.getByRole('button', { name: 'Upvote question. 1 vote.' }).click();
  await expect(secondClassmateQuestion.getByRole('button', { name: 'Remove upvote from question. 2 votes.' })).toHaveAttribute('aria-pressed', 'true');
  await expect(studentPage.locator('.student-question-reward-toast').filter({ hasText: '+2 points' })).toContainText('Question supported by classmates');

  const consoleQuestion = consolePage.locator('.question-card').filter({ hasText: question });
  await consoleQuestion.getByRole('button', { name: 'Discuss on display' }).click();
  await expect(studentPage.locator('.student-question-reward-toast').filter({ hasText: '+3 points' })).toContainText('Question discussed in class');

  await secondClassmateQuestion.getByRole('button', { name: 'Remove upvote from question. 2 votes.' }).click();
  await expect(secondClassmateQuestion.getByRole('button', { name: 'Upvote question. 1 vote.' })).toHaveAttribute('aria-pressed', 'false');
  const removeVote = classmateQuestion.getByRole('button', { name: 'Remove upvote from question. 1 vote.' });
  await expect(removeVote).toBeEnabled();
  await removeVote.click();
  await expect(classmateQuestion.getByRole('button', { name: 'Upvote question. 0 votes.' })).toHaveAttribute('aria-pressed', 'false');
  await expect(consolePage.locator('.question-card').filter({ hasText: question }).getByLabel('0 student upvotes')).toBeVisible();

  await consolePage.getByRole('button', { name: `Dismiss question: ${question}` }).click();
  await expect(consolePage.getByText('Question dismissed from the class.')).toBeVisible();
  await expect(consolePage.locator('.question-card').filter({ hasText: question })).toHaveCount(0);
  await expect(ownQuestion).toHaveCount(0);
  await expect(classmateQuestion).toHaveCount(0);

  await consolePage.getByRole('button', { name: 'Undo' }).click();
  await expect(consolePage.locator('.question-card').filter({ hasText: question })).toBeVisible();
  await expect(studentPage.locator('.student-question-feed article').filter({ hasText: question })).toBeVisible();
  await expect(classmatePage.locator('.student-question-feed article').filter({ hasText: question })).toBeVisible();

  await remotePage.getByRole('button', { name: /questions$/ }).click();
  const remoteQuestion = remotePage.locator('.remote-question-list article').filter({ hasText: question });
  await expect(remoteQuestion).toBeVisible();
  await remoteQuestion.getByRole('button', { name: `Dismiss question: ${question}` }).click();
  await expect(remotePage.getByText('Question dismissed', { exact: true })).toBeVisible();
  await expect(consolePage.locator('.question-card').filter({ hasText: question })).toHaveCount(0);
  await expect(studentPage.locator('.student-question-feed article').filter({ hasText: question })).toHaveCount(0);
  await expect(classmatePage.locator('.student-question-feed article').filter({ hasText: question })).toHaveCount(0);

  await remotePage.getByRole('button', { name: 'Undo' }).click();
  await expect(consolePage.locator('.question-card').filter({ hasText: question })).toBeVisible();
  await expect(studentPage.locator('.student-question-feed article').filter({ hasText: question })).toBeVisible();
  await expect(classmatePage.locator('.student-question-feed article').filter({ hasText: question })).toBeVisible();

  await consolePage.getByRole('button', { name: `Dismiss question: ${question}` }).click();
  await expect(consolePage.locator('.question-card').filter({ hasText: question })).toHaveCount(0);
  await expect(studentPage.locator('.student-question-feed article').filter({ hasText: question })).toHaveCount(0);
  await expect(classmatePage.locator('.student-question-feed article').filter({ hasText: question })).toHaveCount(0);

  await context.close();
});

test('a poll comparison appears only after the student makes a private prediction', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const remotePage = await context.newPage();
  const studentPage = await context.newPage();

  await consolePage.goto('/live');
  await remotePage.goto('/live/remote');
  await studentPage.goto('/live/student');
  await remotePage.getByRole('button', { name: /Concept check/ }).click();
  await expect(studentPage.getByRole('heading', { name: 'Where do network effects become most fragile?' })).toBeVisible();

  await studentPage.getByRole('radio', { name: /Low switching costs/ }).click();
  await studentPage.getByRole('button', { name: 'Send response' }).click();
  await expect(studentPage.getByText('Response sent')).toBeVisible();
  await expect(remotePage.locator('.remote-response-metric strong')).toHaveText('1');
  await studentPage.locator('.student-reflection-options').getByRole('button', { name: /Single-provider dependency/ }).click();
  await expect(studentPage.getByText('Your private prediction')).toBeVisible();

  await remotePage.getByRole('button', { name: 'Reveal result' }).click();
  await expect(studentPage.getByRole('heading', { name: 'The room has decided.' })).toBeVisible();
  await expect(studentPage.getByText('You predicted')).toBeVisible();
  await expect(studentPage.getByText('The room chose')).toBeVisible();

  await context.close();
});

test('peer learning moves from first answer through discussion to a second answer', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const remotePage = await context.newPage();
  const displayPage = await context.newPage();
  const studentPage = await context.newPage();

  await consolePage.goto('/live');
  await remotePage.goto('/live/remote');
  await displayPage.goto('/live/display');
  await studentPage.goto('/live/student');

  await remotePage.getByRole('button', { name: /Think, pair, answer again/ }).click();
  await studentPage.getByRole('radio', { name: /One critical provider/ }).click();
  await studentPage.getByRole('button', { name: 'Send response' }).click();
  await expect(remotePage.getByRole('button', { name: 'Start partner discussion' })).toBeEnabled();

  await remotePage.getByRole('button', { name: 'Start partner discussion' }).click();
  await expect(studentPage.getByRole('heading', { name: 'Turn to someone nearby.' })).toBeVisible();
  await expect(displayPage.getByText('What led you to your answer?')).toBeVisible();

  await remotePage.getByRole('button', { name: 'Ask again' }).click();
  await expect(studentPage.getByText('Choose again. It is fine to keep your answer or change it.')).toBeVisible();
  await studentPage.getByRole('radio', { name: /One critical provider/ }).click();
  await studentPage.getByRole('button', { name: 'Send response' }).click();
  await expect(remotePage.getByRole('button', { name: 'Show the shift' })).toBeEnabled();
  await remotePage.getByRole('button', { name: 'Show the shift' }).click();
  await expect(displayPage.getByText(/Before 100% · After 100%/)).toBeVisible();

  await context.close();
});

test('group work collects one group submission beside a shared clock', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const remotePage = await context.newPage();
  const displayPage = await context.newPage();
  const studentPage = await context.newPage();

  await consolePage.goto('/live');
  await remotePage.goto('/live/remote');
  await displayPage.goto('/live/display');
  await studentPage.goto('/live/student');

  await remotePage.getByRole('button', { name: /Apply the idea/ }).click();
  await expect(studentPage.getByRole('timer', { name: /Group work/ })).toBeVisible();
  await studentPage.getByRole('textbox', { name: 'Your group response' }).fill('The platform depends on one payment provider.');
  await studentPage.getByRole('button', { name: 'Send group response' }).click();

  await expect(remotePage.getByText('group submissions')).toBeVisible();
  await expect(consolePage.getByText('The platform depends on one payment provider.')).toBeVisible();
  await expect(displayPage.getByRole('complementary', { name: /Group work/ })).toBeVisible();

  await context.close();
});

test('a planned clock gives projector and phone the same focused prompt', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const remotePage = await context.newPage();
  const displayPage = await context.newPage();
  const studentPage = await context.newPage();

  await consolePage.goto('/live');
  await remotePage.goto('/live/remote');
  await displayPage.goto('/live/display');
  await studentPage.goto('/live/student');

  await remotePage.getByRole('button', { name: /Quiet thinking time/ }).click();
  await expect(remotePage.getByText('Shared clock')).toBeVisible();
  await expect(studentPage.getByRole('heading', { name: 'Quiet thinking time' })).toBeVisible();
  await expect(studentPage.getByText('Write down one example you would be ready to explain.', { exact: true })).toBeVisible();
  await expect(studentPage.getByText('No response is needed.')).toBeVisible();
  await expect(displayPage.getByRole('heading', { name: 'Quiet thinking time' })).toBeVisible();
  await expect(displayPage.getByText('Write down one example you would be ready to explain.', { exact: true })).toBeVisible();
  await expect(displayPage.getByText('The same clock is visible on every student phone.')).toHaveCount(0);
  const footerInsight = displayPage.locator('.display-footer-insight');
  await expect(footerInsight).toContainText('Controlled from the instructor console');
  const footerAlignment = await footerInsight.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    const iconBox = element.querySelector('svg')?.getBoundingClientRect();
    const labelBox = element.querySelector('span')?.getBoundingClientRect();
    return {
      display: styles.display,
      alignItems: styles.alignItems,
      whiteSpace: styles.whiteSpace,
      centerDifference: iconBox && labelBox
        ? Math.abs((iconBox.top + iconBox.height / 2) - (labelBox.top + labelBox.height / 2))
        : 99,
    };
  });
  expect(footerAlignment).toMatchObject({ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' });
  expect(footerAlignment.centerDifference).toBeLessThan(1);

  await context.close();
});

test('a short word answer grows into the live class word cloud', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const remotePage = await context.newPage();
  const displayPage = await context.newPage();
  const studentPage = await context.newPage();
  const secondStudentPage = await context.newPage();

  await consolePage.goto('/live');
  await remotePage.goto('/live/remote');
  await displayPage.goto('/live/display');
  await displayPage.setViewportSize({ width: 1366, height: 768 });
  await studentPage.goto('/live/student');
  await secondStudentPage.goto('/live/student');

  await remotePage.getByRole('button', { name: /One-word association/ }).click();
  await expect(displayPage.locator('.join-url')).toContainText('/join');
  await expect(displayPage.getByText('Written answers stay private until the instructor shares one.')).toHaveCount(0);

  const displayPrompt = displayPage.locator('.interaction-display-question');
  const studentPrompt = studentPage.locator('.student-interaction-question');
  await expect(displayPrompt).toHaveText('What one word best describes a healthy platform?');
  await expect(studentPrompt).toHaveText('What one word best describes a healthy platform?');
  expect(await displayPrompt.evaluate((heading) => getComputedStyle(heading).display)).toBe('block');
  expect(await studentPrompt.evaluate((heading) => getComputedStyle(heading).display)).toBe('block');
  expect(await displayPrompt.evaluate((heading) => heading.scrollWidth <= heading.clientWidth)).toBe(true);
  expect(await studentPrompt.evaluate((heading) => heading.scrollWidth <= heading.clientWidth)).toBe(true);

  const questionBox = await displayPage.locator('.interaction-display-heading h1').boundingBox();
  const responseCountBox = await displayPage.locator('.interaction-display-count').boundingBox();
  const joinBox = await displayPage.locator('.join-code').boundingBox();
  expect(responseCountBox?.y).toBeLessThan(questionBox?.y ?? Number.POSITIVE_INFINITY);
  expect((joinBox?.x ?? 0) + (joinBox?.width ?? 0)).toBeLessThanOrEqual(1366);

  await expect(studentPage.getByRole('textbox', { name: 'Your word or short phrase' })).toBeVisible();
  await studentPage.getByRole('textbox', { name: 'Your word or short phrase' }).fill('Trust');
  await studentPage.getByRole('button', { name: 'Add to word cloud' }).click();
  await expect(displayPage.locator('.display-word-cloud')).toHaveClass(/is-solo/);
  await expect.poll(async () => Number.parseFloat(await displayPage.locator('.display-word-cloud > span').evaluate((word) => getComputedStyle(word).fontSize))).toBeGreaterThan(90);
  await secondStudentPage.getByRole('textbox', { name: 'Your word or short phrase' }).fill('trust');
  await secondStudentPage.getByRole('button', { name: 'Add to word cloud' }).click();

  await expect(displayPage.locator('.display-word-cloud > span[title="2 responses"]')).toContainText('Trust');
  await expect(consolePage.locator('.live-word-cloud > span[title="2 responses"]')).toContainText('Trust');
  await expect(studentPage.getByRole('heading', { name: 'Your word is joining the room.' })).toBeVisible();

  await context.close();
});

test('a realistic classroom word cloud remains legible as varied responses arrive', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const remotePage = await context.newPage();
  const displayPage = await context.newPage();
  const consolePage = await context.newPage();
  const answers = [
    'Trust', 'trust', ' TRUST! ',
    'Purpose', 'purpose.',
    'Community', 'community',
    'Curiosity', 'Belonging', 'Safety', 'Clear goals', 'Shared ownership', 'Empathy', 'Momentum',
  ];
  const studentPages = await Promise.all(answers.map(() => context.newPage()));

  await Promise.all([
    remotePage.goto('/live/remote'),
    displayPage.goto('/live/display'),
    consolePage.goto('/live'),
    ...studentPages.map((page) => page.goto('/live/student')),
  ]);
  await displayPage.setViewportSize({ width: 1366, height: 768 });
  await remotePage.getByRole('button', { name: /One-word association/ }).click();

  await Promise.all(studentPages.map(async (page, index) => {
    await page.getByRole('textbox', { name: 'Your word or short phrase' }).fill(answers[index]);
    await page.getByRole('button', { name: 'Add to word cloud' }).click();
  }));

  const cloud = displayPage.locator('.display-word-cloud');
  await expect(displayPage.locator('.interaction-display-count strong')).toHaveText(String(answers.length));
  await expect(cloud.locator('> span')).toHaveCount(10);
  await expect(cloud.locator('> span[title="3 responses"]')).toContainText('Trust');
  await expect(cloud.locator('> span[title="2 responses"]')).toHaveCount(2);
  await expect(cloud).toContainText('Clear goals');
  await expect(cloud).toContainText('Shared ownership');
  await expect(displayPage.getByText('Written answers stay private until the instructor shares one.')).toHaveCount(0);
  await expect.poll(async () => cloud.locator('> span').evaluateAll((words, container) => {
    const bounds = (container as HTMLElement).getBoundingClientRect();
    return words.filter((word) => {
      const box = word.getBoundingClientRect();
      return box.left < bounds.left || box.top < bounds.top || box.right > bounds.right || box.bottom > bounds.bottom;
    }).map((word) => word.textContent);
  }, await cloud.elementHandle())).toEqual([]);
  const cloudFontSizes = await cloud.locator('> span').evaluateAll((words) => words.map((word) => Number.parseFloat(getComputedStyle(word).fontSize)));
  expect(Math.max(...cloudFontSizes)).toBeGreaterThan(Math.min(...cloudFontSizes) * 1.8);
  await expect(cloud.locator('> span[title="3 responses"] small')).toHaveText('×3');
  await expect(cloud.locator('.display-word-cloud-summary')).toContainText('10 distinct ideas');
  await expect(cloud.locator('.display-word-cloud-summary')).toContainText('Most repeated');

  await expect(studentPages[0].getByRole('heading', { name: 'Your word is joining the room.' })).toBeVisible();
  await expect(studentPages[0].locator('.student-mini-word-cloud span')).toHaveCount(3);
  await expect(studentPages[0].locator('.student-mini-word-cloud span.is-own')).toContainText('Trust');
  const studentCloud = studentPages[0].locator('.student-mini-word-cloud');
  await expect.poll(async () => studentCloud.locator('span').evaluateAll((words, container) => {
    const bounds = (container as HTMLElement).getBoundingClientRect();
    return words.filter((word) => {
      const box = word.getBoundingClientRect();
      return box.left < bounds.left || box.top < bounds.top || box.right > bounds.right || box.bottom > bounds.bottom;
    }).map((word) => word.textContent);
  }, await studentCloud.elementHandle())).toEqual([]);
  await studentPages[0].waitForTimeout(1500);
  await displayPage.screenshot({ path: 'output/word-cloud-audit-current/projector-14-responses.png', fullPage: true });
  await studentPages[0].screenshot({ path: 'output/word-cloud-audit-current/student-waiting-14-responses.png', fullPage: true });
  await consolePage.screenshot({ path: 'output/word-cloud-audit-current/instructor-14-responses.png', fullPage: true });

  await context.close();
});

test('AI classroom endpoints reject unauthenticated requests', async ({ request }) => {
  for (const path of [
    '/api/generate-session-interactions',
    '/api/summarize-responses',
    '/api/chat',
    '/api/generate-case-study',
  ]) {
    const response = await request.post(path, { data: {} });
    expect(response.status(), `${path} should require instructor authentication`).toBe(401);
  }
});
