# Social marketing desk — plan

Goal: every seller connects **their own** Facebook, Instagram, WhatsApp and LinkedIn accounts and
the store gets its own marketing desk: AI writes the posts (store launch, new product, custom),
the seller reviews or lets them go out automatically, and they publish to the seller's accounts.

Status: all five phases implemented (see "What shipped" at the end). Migration
`20261119008900_social_marketing_desk.sql` must be applied by the owner.

## 1. Audit (what already existed)

| Area | Existing code | Decision |
|---|---|---|
| Connections | `tenant_integrations` (one row per store + provider, AES-256-GCM secrets with `APP_SECRET`, RLS on with **no** policies, server-only access in `features/integrations/server/store.ts`) holds `facebook`, `instagram`, `pinterest`, `youtube`, `whatsapp`, `google_business` | **Reuse** it. A new `social_connections` table would duplicate the encryption, status model and ADR-006 rules (DECISIONS: "Payment, shipping, tracking and social connections live in `tenant_integrations`"). Add provider `linkedin`. |
| OAuth | `/api/oauth/[network]/{start,callback}` with HMAC state + browser-bound nonce; Meta, Pinterest, YouTube via platform apps (`platform_app_credentials`, Admin → Social apps) | Add network `linkedin` (platform app `linkedin`). |
| Manual tokens | Only WhatsApp (Inbox → Channels: phone number id, WABA id, permanent token, verified with Graph) | Add manual connect for Facebook/Instagram (Page token or user token, optional own App ID + secret for long-lived exchange) and LinkedIn (token + optional organization id). |
| Posts + queue | `social_posts` (status, per-platform `results`, retry skips succeeded networks, conditional claim), `/api/cron/social-publish` (pictocart-cron Worker, half-hourly; stale guard 6 h) | Reuse. Add `source`, per-network `variants`, `ai_state`. |
| Publishing | FB `/{page}/photos`, IG container → `media_publish` (JPEG conversion), Pinterest pins, Google local posts | Add LinkedIn (Posts API + Images API). WhatsApp stays assisted (below). |
| AI | Neural Pulse (`runGeneration`, captions for IG/FB/X), seller AI (`runSellerAiGeneration`, debit → work → refund) | New credit kind `social_post`; one prompt returns Facebook/Instagram/LinkedIn/WhatsApp variants + hashtags. |
| Permissions | `marketing.read` / `marketing.write` + `social_media` entitlement (`marketingCtx`) | Reuse. No matrix change. |
| Product publish / store launch | `saveProductAction`, `bulkProductsAction` (publish), `publishStoreAction` | Hook automation in with `after()` (never slows or breaks the original action). |

## 2. Honest platform limits

- **Facebook Page / Instagram professional**: API publishing needs `pages_manage_posts` and
  `instagram_content_publish` (Meta App Review for the platform app; a seller's own app works for
  people with a role on that app). Instagram needs an image (JPEG) and allows 100 API posts / 24 h.
- **LinkedIn**: self-serve "Share on LinkedIn" gives `w_member_social` (post to the member's own
  profile). Posting as a **company page** needs `w_organization_social` (Community Management API,
  LinkedIn approval). Tokens last 60 days; refresh tokens only for approved partners, so the
  connection shows **Expired** and the seller reconnects.
- **WhatsApp**: the Cloud API cannot post to Status or Channels, and business-initiated messages
  need an approved template **and** marketing opt-in. Our opt-ins are for *order updates*
  (`customer_whatsapp_optins`, "Send me order updates…"), so broadcasting marketing posts to them
  would break WhatsApp policy. WhatsApp therefore stays a **planned (assisted) channel**: AI writes
  a WhatsApp-sized message and the post gets a one-tap `wa.me` share link (Status, Channel, groups).
  Template broadcast to marketing-opted-in contacts is a future phase (needs a marketing consent
  ledger first).

## 3. Phases

### Phase 1 — Data + security
- `tenant_integrations` provider `linkedin`; `platform_app_credentials` provider `linkedin`.
- `social_posts`: `source` (`manual | ai | auto_launch | auto_product`), `variants jsonb`
  (per-network text), `ai_state` (`pending | running | done | failed | skipped`), `ai_note`.
  One auto post per product and one launch post per store (partial unique indexes).
- `social_automation` (one row per store): launch / new-product toggles, mode (`review` = draft,
  `auto` = scheduled after a delay), networks, AI on/off, delay, `product_enabled_at` (products
  published before automation was switched on never get auto posts). RLS: `marketing.read` /
  `marketing.write`.
- Credits: kind `social_post` (1 credit). Seller-triggered AI uses `ai_credit_debit` with the
  seller's session. Background AI (automation) uses two narrow service-role-only functions
  `social_ai_credit_debit(tenant, post)` / `social_ai_credit_refund(ledger, note)` that only work
  when the store switched automation AI on. Tokens are never returned to the browser (last-4 hints).

### Phase 2 — Connect UI
- Accounts tab: Facebook & Instagram, LinkedIn, Pinterest, YouTube cards with **Connect** (OAuth,
  shown only when the platform app is configured) and **Connect with token** (manual) dialogs;
  manual connect verifies against the API before saving (`/me`, `/me/accounts`,
  `instagram_business_account`; LinkedIn `/v2/userinfo` or `organizationAcls`).
- WhatsApp card shows the Inbox connection status and links to its form (one WhatsApp connection
  per store, shared by inbox, notifications and the desk).
- Disconnect deletes the stored token (existing `disconnectIntegrationAction`).

### Phase 3 — AI content
- `socialCopyPrompt` (store context as data, never instructions) → `{facebook, instagram, linkedin,
  whatsapp, hashtags}` validated with zod. Subjects: store launch, a product, or a seller idea.
- Composer: "Write with AI" fills the caption, hashtags and editable per-network text. Product
  posts use the first product image.
- Post page: "Rewrite with AI" for drafts.

### Phase 4 — Publish
- `publishPost` adds LinkedIn: image → `POST /rest/images?action=initializeUpload`, `PUT` bytes,
  then `POST /rest/posts` (`LinkedIn-Version` header); text-only posts allowed.
- Per-network variants are used when present; otherwise the shared caption.
- Results per network, retry skips networks that already succeeded (unchanged).
- WhatsApp: share link + copy on the post page (assisted).

### Phase 5 — Automation
- Settings tab **Automation**: launch post on/off, new product posts on/off, review vs auto,
  networks, AI on/off, delay (5 min–24 h).
- Triggers: `publishStoreAction` (draft → live) and product publish (`saveProductAction`,
  bulk publish) call `after(() => …)`. The trigger re-reads the product with the secret-key
  client scoped to the acting member's tenant, checks the store's automation and entitlement, and
  inserts at most one post (unique index).
- Review mode → **draft** with an "Auto" badge. Auto mode → **scheduled** at now + delay, so the
  seller can still cancel; the existing cron publishes it. "Announce my store" button creates the
  launch post on demand.
- AI: when on, the post is created with a template caption and `ai_state = pending`; the AI step
  runs right after (in `after()`) and again from the cron for anything left pending. Failure or no
  credits keeps the template caption (and refunds).

## 4. Security notes (ADR-006 addition)
Automation writes `social_posts` and calls the narrow credit functions with the secret-key client.
The tenant always comes from the acting member's membership (trigger) or from the post row
(cron); the store's `social_automation` (written only by `marketing.write` members through RLS)
must be on; the `social_media` entitlement is checked. Tokens stay encrypted in
`tenant_integrations`.

## 5. Not verified here
No Meta or LinkedIn app is configured in this environment, so OAuth, manual token checks and
publishing are untested against live APIs (unit tests cover payload builders, token handling,
automation rules). LinkedIn's `LinkedIn-Version` defaults to `202610` (env `LINKEDIN_API_VERSION`).
