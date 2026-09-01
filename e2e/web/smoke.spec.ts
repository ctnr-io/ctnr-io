import { expect, test } from '@playwright/test'

// Real-condition smoke tests against a deployed app (BASE_URL). These caught the two production breaks:
// the Zitadel client missing onAuthStateChange (blank page), and the app/api CTNR_VERSION mismatch.

test('renders the app (not a blank page)', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.goto('/', { waitUntil: 'networkidle' })

  // The Expo app hydrates content into #root; a blank page leaves it empty.
  const root = page.locator('#root')
  await expect(root).not.toBeEmpty()
  const len = await root.evaluate((el) => el.innerHTML.length)
  expect(len).toBeGreaterThan(100)

  // Regression guard for the auth-client crash that blanked the page.
  expect(pageErrors.join('\n')).not.toContain('onAuthStateChange')
})

test('reaches the API (no client/server version mismatch)', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })

  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(4000)

  const joined = consoleErrors.join('\n')
  expect(joined, 'app+api CTNR_VERSION must match').not.toContain('version is out of date')
  expect(joined, 'app must reach the tRPC server').not.toContain('Failed to connect to server')
})

test('reaches a real screen, not the client-error fallback', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(4000)
  // When the client can't talk to the server it renders an error screen ("...out of date", a Reload
  // button). A working deployment shows the real app instead.
  const body = (await page.locator('body').innerText()).toLowerCase()
  expect(body, 'app must not be stuck on the version/connection error screen').not.toMatch(
    /out of date|upgrade the client|failed to connect/,
  )
})
