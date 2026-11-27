import type { AppProvider } from "./core";

/**
 * Setup guide data for Admin → Social apps (pure). URLs and permission names come from the
 * providers' official docs: Meta for Developers (Facebook Login, Instagram Platform, Messenger
 * Platform, WhatsApp Cloud API, Webhooks), Pinterest API v5, Google Cloud / Business Profile APIs.
 */

export type SetupGuide = {
  provider: AppProvider;
  title: string;
  covers: string;
  consoleUrl: string;
  consoleLabel: string;
  idLabel: string | null;
  secretLabel: string;
  redirectUris: string[];
  webhooks: { label: string; url: string }[];
  permissions: { name: string; note?: string }[];
  steps: string[];
  review: string;
};

export function oauthRedirectUri(origin: string, route: "meta" | "pinterest" | "youtube" | "google-business" | "linkedin") {
  return `${origin.replace(/\/$/, "")}/api/oauth/${route}/callback`;
}

export function setupGuides(origin: string): SetupGuide[] {
  const o = origin.replace(/\/$/, "");
  return [
    {
      provider: "meta",
      title: "Meta",
      covers: "Facebook Pages, Instagram, Messenger and WhatsApp Business",
      consoleUrl: "https://developers.facebook.com/apps/",
      consoleLabel: "Meta for Developers → My Apps",
      idLabel: "App ID",
      secretLabel: "App secret",
      redirectUris: [oauthRedirectUri(o, "meta")],
      webhooks: [
        { label: "Messenger and Instagram (Page and Instagram objects)", url: `${o}/api/webhooks/meta` },
        { label: "WhatsApp (WhatsApp Business Account object)", url: `${o}/api/webhooks/whatsapp` },
      ],
      permissions: [
        { name: "pages_show_list" },
        { name: "pages_read_engagement" },
        { name: "pages_manage_posts", note: "publish to Facebook Pages" },
        { name: "instagram_basic" },
        { name: "instagram_content_publish", note: "publish to Instagram" },
        { name: "business_management" },
        { name: "pages_messaging", note: "Messenger inbox" },
        { name: "instagram_manage_messages", note: "Instagram DMs" },
        { name: "whatsapp_business_messaging", note: "send and receive WhatsApp messages" },
        { name: "whatsapp_business_management", note: "read the seller's WhatsApp Business Account" },
      ],
      steps: [
        "Open Meta for Developers → My Apps → Create app. Choose the Business app type (or the use cases for Facebook Login for Business, Instagram, Messenger and WhatsApp) and link your Meta Business portfolio.",
        "In App settings → Basic, add your Privacy Policy URL, Terms URL, a data deletion URL and your app domain, then copy the App ID and App secret into the form on this page.",
        "Add Facebook Login for Business. Under its Settings, paste the OAuth redirect URI below into Valid OAuth Redirect URIs (it must match exactly).",
        "Generate a webhook verify token on this page. In Webhooks, subscribe the Page object (fields: messages, messaging_postbacks) and the Instagram object (field: messages) with the Meta webhook URL below and the verify token.",
        "Add the WhatsApp product. In WhatsApp → Configuration, set the callback URL to the WhatsApp webhook URL below with the same verify token, and subscribe to the messages field.",
        "Complete Business Verification, then request Advanced Access for each permission below in App Review. Meta needs a screencast of each permission in use.",
        "Switch the app to Live mode. Until then, only people with a role on the app (admins, developers, testers) can connect.",
      ],
      review: "Without App Review and Advanced Access, only app admins, developers and testers can connect. Sellers outside the app get a permissions error from Facebook.",
    },
    {
      provider: "whatsapp",
      title: "WhatsApp verification sender",
      covers: "Sends the 6-digit code sellers use to verify their WhatsApp number (250 free AI credits reward)",
      consoleUrl: "https://business.facebook.com/wa/manage/message-templates/",
      consoleLabel: "WhatsApp Manager → Message templates",
      idLabel: "Phone number ID",
      secretLabel: "Permanent access token",
      redirectUris: [],
      webhooks: [],
      permissions: [{ name: "whatsapp_business_messaging", note: "send template messages from the platform number" }],
      steps: [
        "In Meta for Developers, add the WhatsApp product to the platform's app and register the platform's business phone number (WhatsApp → API Setup).",
        "Copy the Phone number ID (not the phone number itself) from WhatsApp → API Setup into the form on this page.",
        "In Meta Business Suite → Business settings → System users, create a system user, assign it the app and the WhatsApp Business Account with full control, and generate a permanent token with whatsapp_business_messaging. Paste it as the access token.",
        "In WhatsApp Manager → Message templates, create a template in the AUTHENTICATION category named pictocart_otp (or your own name, entered below). Use code delivery \"Copy code\": the body has one variable {{1}} for the code and a copy-code button.",
        "Pick the template language (e.g. English = en) and enter the same code below. Wait until the template status is Active (approved).",
        "Verify a number from My Profile → Verify WhatsApp number to test it end to end.",
      ],
      review: "Authentication templates are approved by Meta, usually within minutes. Until a sender is saved, codes are shown on screen only on a localhost platform (local testing).",
    },
    {
      provider: "pinterest",
      title: "Pinterest",
      covers: "Pins on a seller's boards",
      consoleUrl: "https://developers.pinterest.com/apps/",
      consoleLabel: "Pinterest Developers → My apps",
      idLabel: "App ID",
      secretLabel: "App secret key",
      redirectUris: [oauthRedirectUri(o, "pinterest")],
      webhooks: [],
      permissions: [{ name: "boards:read" }, { name: "pins:read" }, { name: "pins:write" }, { name: "user_accounts:read" }],
      steps: [
        "Sign in to developers.pinterest.com with a Pinterest business account and verify your email.",
        "Open My apps → Connect app, fill in the request form and accept the developer terms. Pinterest reviews the request for Trial access, usually within a business day.",
        "Once approved, open My apps → Manage → Configure. Under Redirect URIs, add the URI below (it must match exactly).",
        "Copy the App ID and App secret key from My apps into the form on this page.",
        "Request Standard access before going live. Trial access has limits; see Pinterest's access tiers guide.",
      ],
      review: "Trial access is restricted. Apply for Standard access (Pinterest reviews a demo of the integration) before sellers rely on it.",
    },
    {
      provider: "linkedin",
      title: "LinkedIn",
      covers: "Posts on a seller's LinkedIn profile (and company pages once LinkedIn approves the app)",
      consoleUrl: "https://www.linkedin.com/developers/apps",
      consoleLabel: "LinkedIn Developers → My apps",
      idLabel: "Client ID",
      secretLabel: "Client secret",
      redirectUris: [oauthRedirectUri(o, "linkedin")],
      webhooks: [],
      permissions: [
        { name: "openid" },
        { name: "profile" },
        { name: "w_member_social", note: "post on the member's own profile" },
      ],
      steps: [
        "Open LinkedIn Developers → Create app. Link it to a LinkedIn company page you manage and upload a logo.",
        "In Products, add \"Sign In with LinkedIn using OpenID Connect\" and \"Share on LinkedIn\" (both self-serve).",
        "In Auth → OAuth 2.0 settings, add the redirect URL below (it must match exactly).",
        "Copy the Client ID and Client secret into the form on this page.",
        "Optional: request the Community Management API to let sellers post as their company page (w_organization_social). Until then sellers can still connect a company page with their own token.",
      ],
      review: "Profile posting is self-serve. Company page posting needs LinkedIn's Community Management API approval. Access tokens last 60 days; sellers reconnect when one expires.",
    },
    {
      provider: "google",
      title: "Google",
      covers: "YouTube (channel connect) and Google Business Profile",
      consoleUrl: "https://console.cloud.google.com/apis/credentials",
      consoleLabel: "Google Cloud console → APIs & Services → Credentials",
      idLabel: "OAuth client ID",
      secretLabel: "OAuth client secret",
      redirectUris: [oauthRedirectUri(o, "youtube"), oauthRedirectUri(o, "google-business")],
      webhooks: [],
      permissions: [
        { name: "https://www.googleapis.com/auth/youtube.readonly", note: "YouTube channel connect" },
        { name: "https://www.googleapis.com/auth/business.manage", note: "Business Profile posts and reviews; needs API access approval" },
      ],
      steps: [
        "In the Google Cloud console, create a project (or pick one).",
        "In APIs & Services → Library, enable YouTube Data API v3, My Business Account Management API, My Business Business Information API and Google My Business API (used for local posts and reviews).",
        "Set up the OAuth consent screen (Google Auth Platform): app name, support email, authorised domain and privacy policy. Add the two scopes below under Data access.",
        "In Credentials → Create credentials → OAuth client ID → Web application, add BOTH redirect URIs below under Authorised redirect URIs.",
        "Copy the client ID and client secret into the form on this page.",
        "Request Business Profile API access through Google's GBP API contact form (choose \"Application for Basic API Access\"). Until it's approved the project's quota is 0 and every Business Profile call fails.",
        "Publish the consent screen to In production and submit it for verification. The scopes are sensitive, so unverified apps show a warning and are capped at 100 users.",
      ],
      review: "Business Profile APIs need approval (quota stays at 0 QPM until then). Sensitive scopes need OAuth app verification.",
    },
    {
      provider: "nvidia",
      title: "NVIDIA NIM (Nemotron)",
      covers: "Seller AI and Neural Pulse content (Nemotron text and vision models)",
      consoleUrl: "https://build.nvidia.com/settings/api-keys",
      consoleLabel: "build.nvidia.com → API keys",
      idLabel: null,
      secretLabel: "API key (nvapi-…)",
      redirectUris: [],
      webhooks: [],
      permissions: [],
      steps: [
        "Sign in at build.nvidia.com and open Settings → API keys → Generate API key.",
        "Paste the key into the form on this page.",
        "Pick the Nemotron model per feature in Admin → AI Health (routes). Photos use a Nemotron vision model automatically.",
      ],
      review: "No app review. Usage counts against your NVIDIA API catalog credits or NIM subscription.",
    },
    {
      provider: "gemini",
      title: "Google Gemini",
      covers: "Neural Pulse AI content (primary model)",
      consoleUrl: "https://aistudio.google.com/apikey",
      consoleLabel: "Google AI Studio → API keys",
      idLabel: null,
      secretLabel: "API key",
      redirectUris: [],
      webhooks: [],
      permissions: [],
      steps: ["In Google AI Studio, create an API key (it's tied to a Google Cloud project).", "Set billing on that project if you need more than the free tier.", "Paste the key into the form on this page."],
      review: "No app review. Usage is billed to the key's Google Cloud project.",
    },
    {
      provider: "groq",
      title: "Groq",
      covers: "Neural Pulse AI content (fast fallback)",
      consoleUrl: "https://console.groq.com/keys",
      consoleLabel: "GroqCloud console → API keys",
      idLabel: null,
      secretLabel: "API key",
      redirectUris: [],
      webhooks: [],
      permissions: [],
      steps: ["In the GroqCloud console, open API Keys → Create API key.", "Paste the key into the form on this page."],
      review: "No app review. Rate limits depend on your Groq plan.",
    },
    {
      provider: "anthropic",
      title: "Anthropic (Claude)",
      covers: "Neural Pulse AI content (fallback)",
      consoleUrl: "https://console.anthropic.com/settings/keys",
      consoleLabel: "Claude Console → API keys",
      idLabel: null,
      secretLabel: "API key",
      redirectUris: [],
      webhooks: [],
      permissions: [],
      steps: ["In the Claude Console, open Settings → API keys → Create key. Add credits or billing first.", "Paste the key into the form on this page."],
      review: "No app review. Usage is billed to your Anthropic organisation.",
    },
  ];
}
