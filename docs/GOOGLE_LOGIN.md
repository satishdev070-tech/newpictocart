# Google sign-in (sellers and shoppers)

"Continue with Google" appears automatically on the seller login/register pages and on every
store's shopper login/register pages **as soon as the Google provider is enabled in Supabase**.
The app reads Supabase's public auth settings (cached for 5 minutes), so there is never a broken
button. Platform admins can hide it for sellers or for store customers in **Admin → Sign-in &
checkout** (`/admin/sign-in`), which also shows the provider status and the URLs to register.
Signed-out shoppers also see "Check out faster with Google" at checkout.

## One-time setup

1. **Google Cloud Console** → APIs & Services → Credentials → *Create credentials* → *OAuth client ID* → type **Web application**.
   - *Authorised redirect URI*: `https://<your-project-ref>.supabase.co/auth/v1/callback` (shown in step 2).
   - *Authorised JavaScript origins* (for GIS / branded consent): every platform host, e.g.
     `https://www.pictocartdev.in`, `https://pictocartdev.in`, and alias hosts such as
     `https://www.pictocart.in`, `https://pictocart.in`.
   - OAuth consent screen: app name **Pictocart**, support email, logo, privacy policy URL.
     Publish it to "In production" when you go live.
2. **Supabase** → Authentication → Sign In / Providers → **Google** → enable, paste the Client ID and Client secret, save.
3. **Supabase** → Authentication → URL Configuration → **Redirect URLs**: add every place users return to:
   - `http://localhost:3000/**` and `http://*.localhost:3000/**` (development)
   - `https://<platform domain>/**` (seller dashboard)
   - `https://*.<platform domain>/**` (store subdomains)
   - each **platform host alias** (e.g. `https://www.pictocart.in/**`, `https://pictocart.in/**`)
   - each custom store domain, e.g. `https://thepaliya.com/**`
4. **Vercel** → set `GOOGLE_IDENTITY_SIGNIN=on` (Production + Preview) so merchant login uses Google
   Identity Services on your domain. Optional: `NEXT_PUBLIC_GOOGLE_SIGNIN_CLIENT_ID` if auto-detect fails.
   Redeploy after changing env.

## How it works

| Who | Button on | Returns to | Then |
|---|---|---|---|
| Seller | `/seller/login`, `/seller/register` | Same-host `/auth/callback` (PKCE) or GIS `signInWithIdToken` | Dashboard; new accounts go to onboarding to create their store |
| Shopper | `/account/login`, `/account/register` on the store domain | `{store}/account/auth/callback` (or platform relay) | Signed in on that store; the customer record is linked to the store |

`googleSignInAction` builds OAuth `redirectTo` with `authRequestOrigin()` so the callback host
matches the browser host (platform root / `www` / `PLATFORM_HOST_ALIASES`). That avoids PKCE
cookie mismatches that surface as `/login?error=link` when the same app is reached via an alias
(e.g. `pictocart.in` vs `pictocartdev.in`).

With `GOOGLE_IDENTITY_SIGNIN=on`, sellers get `GoogleIdentityButton` (consent shows **your** host,
not `*.supabase.co`). Redirect OAuth remains the fallback and is what Google labels with the
Supabase project URL unless you add a Supabase Auth custom domain (Pro).

Server actions are rate-limited and only accept safe relative `next` paths. Failures return to
the login page with a friendly message.

## Platform host aliases

If `www.pictocart.in` is aliased onto the same Vercel project as staging ([DEPLOY_DOMAIN_ALIAS.md](./DEPLOY_DOMAIN_ALIAS.md)):

1. Add both hosts to Supabase Auth redirect URLs.
2. Add both hosts to Google **Authorised JavaScript origins**.
3. Keep `GOOGLE_IDENTITY_SIGNIN=on` so consent does not show `ugbjlpdhktrlkyuijkfc.supabase.co`.
