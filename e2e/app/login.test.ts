// Web login e2e: the app must LEAVE the login page once Zitadel auth completes.
//
// Skipped until a Zitadel OIDC app is registered for app.ctnr.io and test
// credentials exist. Set all three to run it:
//   CTNR_E2E_TEST_EMAIL, CTNR_E2E_TEST_PASSWORD, CTNR_APP_URL
// Uses @astral/astral (Deno-native headless Chrome), imported lazily inside the
// test body so `deno test -A` never fetches it when the test is skipped.

import { assert } from '@std/assert'

const TEST_EMAIL = Deno.env.get('CTNR_E2E_TEST_EMAIL')
const TEST_PASSWORD = Deno.env.get('CTNR_E2E_TEST_PASSWORD')
const APP_URL = Deno.env.get('CTNR_APP_URL') ?? 'http://localhost:8081'

Deno.test({
  name: 'web login: app leaves the login page after Zitadel auth',
  ignore: !TEST_EMAIL || !TEST_PASSWORD,
  async fn() {
    const { launch } = await import('jsr:@astral/astral@^0.5.2')
    const browser = await launch()
    try {
      const page = await browser.newPage(`${APP_URL}/login`)

      // Trigger the OIDC redirect to Zitadel's hosted login.
      const loginButton = await page.waitForSelector('text/Login with GitHub')
      await loginButton!.click()

      // Zitadel hosted login form. Selectors follow Zitadel's default login UI;
      // adjust once the app.ctnr.io OIDC app + its IdP flow are registered.
      const loginName = await page.waitForSelector('#loginName')
      await loginName!.type(TEST_EMAIL!)
      await (await page.waitForSelector('#submit-button, button[type=submit]'))!.click()

      const password = await page.waitForSelector('#password')
      await password!.type(TEST_PASSWORD!)
      await (await page.waitForSelector('#submit-button, button[type=submit]'))!.click()

      // The exchange + onAuthStateChange must navigate away from /login.
      await page.waitForNavigation()
      const url = page.url
      assert(
        !url.includes('/login') && !url.includes('/(auth)'),
        `expected the app to leave the login page after auth, still at ${url}`,
      )
    } finally {
      await browser.close()
    }
  },
})
