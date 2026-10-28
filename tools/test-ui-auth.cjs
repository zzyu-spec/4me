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
