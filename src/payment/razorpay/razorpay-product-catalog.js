'use strict';
const { repositoryError } = require('../../persistence/contracts');
function fail(code) { throw repositoryError(code); }
function createRazorpayProductCatalog(items = []) {
  if (!Array.isArray(items)) fail('INVALID_RAZORPAY_PRODUCT_CATALOG');
  const bySku = new Map();
  for (const item of items) {
    if (!item || typeof item.logicalSku !== 'string' || !item.logicalSku || !Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0 || item.currency !== 'INR') fail('INVALID_RAZORPAY_PRODUCT_CATALOG');
    if (bySku.has(item.logicalSku)) fail('DUPLICATE_RAZORPAY_PRODUCT');
    bySku.set(item.logicalSku, Object.freeze({ logicalSku: item.logicalSku, amountMinor: item.amountMinor, currency: item.currency }));
  }
  return Object.freeze({ get(logicalSku) { const value = bySku.get(logicalSku); if (!value) fail('RAZORPAY_PRODUCT_UNAVAILABLE'); return value; } });
}
module.exports = { createRazorpayProductCatalog };
