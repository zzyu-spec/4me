// UI-only fixture. Authentication, authorization and sync are tested separately.
// This replaces the connector in the test browser; production has no bypass flag.
const installed = new WeakSet();
exports.useAuthenticatedUI = async page => {
  const context = page.context();
  if (installed.has(context)) return;
  installed.add(context);
  await context.route('**/cloud.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.harugyeolCloud={changed(){},open(){},sync:async()=>{},isSignedIn:()=>true};document.body.classList.remove('auth-pending','auth-required');document.body.classList.add('auth-ready');`
  }));
};

// Exercise the same tap-to-manage interaction as a user, then choose the action.
exports.itemAction = async (page, selector) => {
  const source = page.locator(selector).first();
  if (await source.isVisible()) { await source.click(); return; }
  const action = await source.getAttribute('data-action');
  const owner = source.locator('xpath=ancestor::*[@data-item-tap-ready="true"][1]');
  await owner.click({ position: { x: 5, y: 5 } });
  await page.locator(`#itemActionMenu [data-action="${action}"]`).click();
};
