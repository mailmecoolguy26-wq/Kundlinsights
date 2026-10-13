'use strict';
const { repositoryError } = require('../../persistence/contracts');
function fail(code) { throw repositoryError(code); }
function createRazorpayProductCatalog(items = []) {
  if (!Array.isArray(items)) fail('INVALID_RAZORPAY_PRODUCT_CATALOG');
  const bySku = new Map();
  for (const item of items) {
    if (!item || typeof item.logicalSku !== 'string' || !item.logicalSku || !Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0 || item.currency !== 'INR') fail('INVALID_RAZORPAY_PRODUCT_CATALOG');
    if (bySku.has(item.logicalSku)) fail('DUPLICATE_RAZORPAY_PRODUCT');
    const tax = item.baseAmountMinor === undefined && item.gstAmountMinor === undefined && item.gstRateBasisPoints === undefined
      ? {}
      : { baseAmountMinor: item.baseAmountMinor, gstAmountMinor: item.gstAmountMinor, gstRateBasisPoints: item.gstRateBasisPoints };
    bySku.set(item.logicalSku, Object.freeze({ logicalSku: item.logicalSku, amountMinor: item.amountMinor, currency: item.currency, ...tax }));
  }
  return Object.freeze({ get(logicalSku) { const value = bySku.get(logicalSku); if (!value) fail('RAZORPAY_PRODUCT_UNAVAILABLE'); return value; } });
}
const CAREER_PREMIUM_GST_RATE_BASIS_POINTS = 1800;
function careerPremiumPrice(logicalSku, baseAmountMinor) {
  const gstAmountMinor = Math.round((baseAmountMinor * CAREER_PREMIUM_GST_RATE_BASIS_POINTS) / 10000);
  return Object.freeze({ logicalSku, baseAmountMinor, gstRateBasisPoints: CAREER_PREMIUM_GST_RATE_BASIS_POINTS, gstAmountMinor, amountMinor: baseAmountMinor + gstAmountMinor, currency: 'INR' });
}
const CAREER_PREMIUM_RAZORPAY_PRODUCTS = Object.freeze([
  careerPremiumPrice('career_premium_razorpay_6_month', 39900),
  careerPremiumPrice('career_premium_razorpay_12_month', 69900),
]);

// The amount for the Android Career Premium plans is a server-owned product
// property. Deployment configuration may add other Razorpay products but may
// not alter these plan amounts.
function createCareerPremiumRazorpayProductCatalog(items = []) {
  const configured = Array.isArray(items) ? items : fail('INVALID_RAZORPAY_PRODUCT_CATALOG');
  for (const fixed of CAREER_PREMIUM_RAZORPAY_PRODUCTS) {
    const supplied = configured.find((item) => item && item.logicalSku === fixed.logicalSku);
    // Deployment configuration may retain the approved base price, but the
    // checkout total is always derived here, never from client/config input.
    if (supplied && (supplied.amountMinor !== fixed.baseAmountMinor || supplied.currency !== fixed.currency)) fail('INVALID_RAZORPAY_CAREER_PREMIUM_PRICE');
  }
  return createRazorpayProductCatalog([
    ...configured.filter((item) => !CAREER_PREMIUM_RAZORPAY_PRODUCTS.some((fixed) => fixed.logicalSku === (item && item.logicalSku))),
    ...CAREER_PREMIUM_RAZORPAY_PRODUCTS,
  ]);
}
module.exports = { createRazorpayProductCatalog, createCareerPremiumRazorpayProductCatalog, CAREER_PREMIUM_RAZORPAY_PRODUCTS, CAREER_PREMIUM_GST_RATE_BASIS_POINTS };
