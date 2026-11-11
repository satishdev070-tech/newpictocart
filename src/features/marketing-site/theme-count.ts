/**
 * Number of shop (e-commerce) themes in the marketplace, for marketing copy in the site chrome.
 *
 * A constant on purpose: the marketing layout is linked into the Worker's always-loaded RSC
 * entry, and computing this from the catalog made every cold isolate parse the whole theme
 * catalog (~300 KB of presets) on every route, admin included (Error 1102,
 * docs/DEPLOY_CLOUDFLARE_WORKERS.md). tests/unit/marketing-site/theme-count.test.ts fails when
 * it drifts from `ecommerceMarketplaceThemes().length`; update the number when you add themes.
 */
export const MARKETPLACE_SHOP_THEME_COUNT = 186;
