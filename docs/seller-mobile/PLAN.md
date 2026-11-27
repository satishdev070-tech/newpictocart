# Seller panel on phones, Click picture + AI, free team call, verification reward, admin users

_Plan written 2026-11-27. Branch `claude/seller-mobile`. One PR, one commit per phase._

## What exists today (checked before designing)

| Area | Today |
|---|---|
| Seller shell | `components/app-shell/app-shell-client.tsx`: desktop sidebar (`lg:`), hamburger drawer (`<dialog>`) below `lg`, sticky topbar. No bottom bar. |
| Lists | Products and Collections use `<Table>` (wide, horizontal scroll at 375 px). Categories are `<details>` rows indented by depth (deep trees push off screen). |
| Forms | `ActionForm` (`features/settings/ui/action-controls`), submit button at the end of a long form. |
| Images | Products: `ProductMediaManager` (library picker + `Dropzone` → `useMediaUploads`). Categories / collections: `LibraryImageField` (library pick **or** a plain `<input type=file name=file>`). No camera option anywhere. |
| AI from photo | `seller-ai/components/product-generate-ai.tsx` + `generateProductFromImageAction` (vision, up to 4 photos, `runSellerAiGeneration`, credit kind `generate_product`, debit → refund on failure). Products only. |
| Email verified | Supabase Auth `email_confirmed_at` (sign-up by emailed code; Google is pre-confirmed). |
| Phone verified | **Not built.** `profiles.phone` is free text the user edits on My Profile. The platform has no WhatsApp sender of its own (only per-store Cloud API numbers); `platform_app_credentials` already allows provider `whatsapp`. |
| AI credits | `ai_credit_accounts` / `ai_credit_ledger` (kinds incl. `signup_bonus`, `otc_redeem`); writes only through SECURITY DEFINER functions. |
| Admin users | `platform_user_directory` RPC: `q` matches phone with a raw `LIKE` (so `98765 43210` or `+91 98765…` miss), no site-type info. |
| Turnstile | Not used in the project → public forms use `rateLimit` per IP + a honeypot field (same as other public forms). |

## Phase A — mobile-friendly seller panel

Design rules (375 px first): no horizontal page scroll, 44 px tap targets, the most important facts first, the primary action always reachable.

1. **Bottom navigation** (`AppShell` gets an optional `bottomNav` prop; rendered `< lg` only, fixed, safe-area padding):
   Dashboard · Products · Categories · Collections · More. "More" opens the existing drawer (all other pages, Orders included); a small Orders shortcut sits at the top of the drawer. Items are filtered by the member's permissions; the active tab is highlighted; `main` gets bottom padding so content never hides behind the bar. The seller panel only (admin keeps the drawer).
2. **Lists → cards on phones** (table stays from `md` up):
   - Products: card with thumbnail, title, status badge, price, stock; checkbox for bulk actions stays.
   - Collections: card with image, title, type, product count, status.
   - Categories: indentation capped on phones; summary row ≥ 44 px; product count and status as chips.
3. **Sticky primary action**: `ActionForm` gets a `stickySubmit` option; on phones the submit bar sticks to the bottom (above the bottom nav). Used by product, category and collection forms.
4. **Tap targets and overflow**: page-header actions wrap and grow to full width on phones; rule rows in automated collections stack; filter bars are one column.

## Phase B — Click picture + Create with AI from photo

1. **`CameraCaptureButton`** (`features/media/components/camera-capture.tsx`, client):
   - Phone / tablet (coarse pointer or mobile UA): a hidden `<input type=file accept=image/* capture=environment>` → the device camera. Gallery upload stays available through the normal Upload control.
   - Laptop / desktop: a dialog with a `getUserMedia` preview (rear camera preferred), Capture → preview → Use photo / Retake, and "Upload instead" (opens the file picker). Permission denied / no camera → a clear message and the Upload fallback.
   - Output: a JPEG `File` (max 2048 px long side) to `onCapture(file)`.
2. **Wired in**: product images (`ProductMediaManager` → `uploads.addFiles([file])`), category and collection images (`LibraryImageField` sets the captured file on its `file` input via `DataTransfer`, with a preview), and the AI photo picker.
3. **AI from photo for categories and collections** (extend, don't duplicate):
   - Generalise `ProductGenerateAi`'s photo picker into a shared `AiPhotoPicker` (upload + Click picture).
   - New `generateCatalogGroupFromImageAction({ target: "category" | "collection", images, hint })` in `seller-ai/actions.ts`: `catalog.write`, the same `runSellerAiGeneration` path (debit → work → refund), new credit kinds `generate_category` / `generate_collection` (1 credit each, cheaper than products), the AI feature routable in Admin → AI Health like the others.
   - Fills name/title, URL handle, description, SEO title and description (and, for collections, suggested tags for an automated rule are shown, not auto-applied). Review → Apply, never a silent overwrite.
   - Product editor: the existing "Generate with AI" card gains Click picture.

## Phase C — Book a free call with our team

Migration `…_team_calls.sql` (additive):

- `team_call_slots` (id, `starts_at`, `duration_minutes`, `capacity`, `booked_count`, `active`, `note`, audit columns).
- `team_call_bookings` (id, `slot_id`, `user_id` null, `tenant_id` null, `name`, `email`, `phone` E.164, `topic`, `source` `dashboard|landing`, `status` `requested|confirmed|completed|cancelled|no_show`, `admin_note`, timestamps). One open booking per phone per slot.
- RLS: slots readable by everyone only while active and in the future (anon + authenticated); bookings readable by the booking user and by `platform.users.manage`; **no direct writes** — `book_team_call(...)` (SECURITY DEFINER, locks the slot, checks capacity and future time, stamps `user_id = auth.uid()` and the caller's own tenant only if they are a member) and `platform_*` functions for slot CRUD and booking status (platform permission + audit).
- Merchant UI: Dashboard card "Book a free call with our team" → `/dashboard/book-call` (slots grouped by day, pick time, phone prefilled from profile, topic). Shows the seller's upcoming bookings.
- Public: a "Book a free call" section on the landing page → `/book-call` (marketing host), same form plus name and email. Rate limit 5/hour per IP and 3/day per phone, honeypot field; no account needed.
- Super Admin → Support → **Team calls** (`/admin/team-calls`): add/remove/deactivate slots (bulk "add a day of slots"), list bookings with filters, change status, admin note.

## Phase D — verification reward (250 AI credits)

Migration `…_verification_reward.sql`:

- `profiles.phone_verified_at` + a trigger: a user can never set it themselves; changing `phone` clears it.
- `phone_verifications` (user, phone, code hash, attempts, expires) written only by `start_phone_verification` / `verify_phone_code` (SECURITY DEFINER, 10-minute codes, 5 attempts, hashed).
- Ledger kind `verification_bonus`, a unique index (one per tenant) and `verification_rewards (user_id primary key)` (one per person, ever).
- `claim_verification_bonus(p_tenant)`: caller must own the store, `auth.users.email_confirmed_at` and `profiles.phone_verified_at` must both be set; credits 250 once; a second call returns "already claimed".

App:

- WhatsApp code sender: the platform `whatsapp` credential (Admin → Social apps: phone number ID, permanent token, authentication template name). On a localhost platform root with no sender configured, the code is shown on screen (dev only), like the existing no-email signup fallback.
- My Profile → "Verify WhatsApp number" (send code → enter code). After success the bonus is claimed automatically.
- Dashboard card "Claim 250 free AI credits": shows email ✓/✗ and WhatsApp ✓/✗, links to the missing step; when both are done it shows Claim (and disappears after the claim).

## Phase E — Super Admin → Users

Migration `…_admin_user_directory_v2.sql`: `platform_user_directory_v2(p_search, p_type, p_tenant, p_site_type, p_limit, p_offset)`:

- phone search on digits only (strips spaces, `+`, `-`; `9876543210` finds `+919876543210`), also matches the last 10 digits;
- each store in `stores` JSON carries `websiteType`; a per-user `site_types` array;
- `p_site_type` filter `ONLINE_STORE | INFORMATIVE`.

App: falls back to the old RPC when v2 is missing (code can ship before the migration). Badges "Online Store" / "Informative Website" per user, a site-type filter, and a phone-friendly search placeholder.

## Done when

- every phase above is implemented, with unit tests for the pure parts (nav items, device detection, phone normalisation, AI schemas, reward rules, migration grants);
- `NODE_OPTIONS=--max-old-space-size=6144 pnpm check` passes;
- `docs/IMPLEMENTATION_STATUS.md` is updated and ADR-006 gets an addition for the new secret-key reads;
- 375 px layouts are checked in the browser preview (screenshots);
- one PR is open. The migrations are in the PR; the owner applies them.

## Not in scope

- Calendar invites / Google Meet links for bookings (admin copies the link into the note).
- SMS fallback for phone verification.
- Re-designing every dashboard page; only the pages named above get a card layout.
