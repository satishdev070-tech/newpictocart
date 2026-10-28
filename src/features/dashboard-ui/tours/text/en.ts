import type { TourId } from "../routes";

/** Title and short text per tour step (same ids as ../steps.ts). Loaded on demand per locale. */
export type TourText = Record<TourId, Record<string, { title: string; body: string }>>;

export const en: TourText = {
  home: {
    welcome: { title: "Welcome to your seller dashboard", body: "A quick tour of the main parts. It takes under a minute, and you can replay it any time." },
    nav: { title: "Everything is in the menu", body: "Products, orders, marketing, your storefront and settings each have their own section here." },
    search: { title: "Find any page fast", body: "Type what you need, like “COD” or “domain”, to jump straight there. Shortcut: ⌘K or Ctrl+K." },
    setup: { title: "Finish setting up", body: "Follow these steps to get your store ready for its first order. Each one opens the right page." },
    kpis: { title: "Your key numbers", body: "Revenue, orders, customers and products for the last 30 days, at a glance." },
    storeLink: { title: "Your store link", body: "Copy it and share it on WhatsApp, Instagram or anywhere your customers are." },
    help: { title: "Need help on a page?", body: "Click here on any page to take its tour again." },
    account: { title: "Your account", body: "Change the language, switch light or dark mode, switch store or sign out." },
  },
  products: {
    actions: { title: "Add products", body: "Add one product, or import many at once from a CSV file. Export your catalogue any time." },
    filters: { title: "Search and filter", body: "Find products by name, status, category or collection." },
    list: { title: "Your products", body: "Click a product to edit its photos, prices, variants and stock." },
  },
  productNew: {
    basics: { title: "Name and photos", body: "Give the product a clear title, a description and good photos. These are what shoppers see first." },
    variants: { title: "Price and stock", body: "Set the price, MRP and stock. Add options like Size or Colour to create variants." },
    organisation: { title: "Organise it", body: "Pick a category and collections so shoppers can find the product in your store." },
    status: { title: "Save and publish", body: "Keep it as a draft while you work, then set it to Active to show it on your store." },
  },
  productEdit: {
    basics: { title: "Name and photos", body: "Update the title, description and photos shoppers see." },
    variants: { title: "Price and stock", body: "Change prices, MRP and stock for each variant here." },
    status: { title: "Save your changes", body: "Choose Draft or Active, then save. Changes show on your store right away." },
  },
  orders: {
    intro: { title: "All your orders", body: "Every order placed on your store appears here, newest first." },
    filters: { title: "Find orders fast", body: "Filter by payment, fulfilment status or date, or search by order number, name or phone." },
    list: { title: "Open an order", body: "Click an order to ship it, print an invoice or label, or issue a refund." },
  },
  orderDetail: {
    items: { title: "What was ordered", body: "The products, quantities and prices in this order." },
    fulfilment: { title: "Ship the order", body: "Mark it packed or shipped, or book a courier pickup and print the label." },
    payments: { title: "Payment and refunds", body: "See how the customer paid. Record a COD payment or issue a refund here." },
    customer: { title: "Customer details", body: "Contact details and order history of the shopper." },
    timeline: { title: "Order history", body: "Every change to this order, with who made it and when." },
  },
  categories: {
    add: { title: "Add a category", body: "Categories build your store's menu and filters, like Women › Kurtas. Pick a parent to nest one." },
    list: { title: "Your categories", body: "Click a category to rename it, move it or hide it from your store." },
  },
  collections: {
    create: { title: "Create a collection", body: "Group products for promotions, like New Arrivals or Festive Sale. Automated collections fill themselves by rules." },
    list: { title: "Your collections", body: "Click a collection to change its products, image or rules." },
  },
  inventory: {
    stats: { title: "Stock at a glance", body: "How many variants are tracked, low on stock or sold out." },
    filters: { title: "Find low stock", body: "Filter by Low stock or Out of stock to see what to reorder." },
    list: { title: "Update stock", body: "Change the quantity of any variant. Every change is recorded." },
  },
  settings: {
    menu: { title: "All your settings", body: "Payments, shipping, domains, team and more are grouped in this menu." },
    details: { title: "Store details", body: "Your store name, logo, contact details and invoice information." },
    language: { title: "Choose your language", body: "Use the seller panel in English or Hindi. This changes only your view, not your store." },
  },
  payments: {
    status: { title: "Is online payment live?", body: "This box shows whether shoppers can pay online at checkout, and what to do next if not." },
    gateways: { title: "Connect a payment gateway", body: "Paste your gateway's Key ID and Secret (for example Razorpay), then click Test connection. Use test keys first." },
  },
  shipping: {
    couriers: { title: "Courier partners", body: "Connect Shiprocket or Delhivery with your API user email and password to book pickups and print labels." },
    rates: { title: "Shipping rates", body: "Set what shoppers pay for delivery, for example free above ₹999." },
    pincodes: { title: "PIN code rules", body: "Block delivery or COD for some PIN codes, or add extra days for remote areas." },
    cod: { title: "Cash on delivery", body: "Switch COD on or off and set limits, like a maximum order value, to reduce fake orders." },
  },
  checkout: {
    options: { title: "Checkout options", body: "Choose what shoppers fill in at checkout and the thank-you message they see." },
    signin: { title: "Faster sign-in", body: "Shoppers can sign in with a one-time code, or with Google when it is enabled." },
  },
  domains: {
    platform: { title: "Your free address", body: "Your store always works on this address, even after you connect your own domain." },
    custom: { title: "Connect your own domain", body: "Add a domain like www.yourbrand.in, then add the DNS records shown to verify it." },
  },
  seo: {
    form: { title: "Search and sharing", body: "The title, description and image Google and WhatsApp show for your store." },
    generated: { title: "Done for you", body: "Sitemap, product data for Google and other basics are created automatically." },
  },
  team: {
    invite: { title: "Invite your team", body: "Add staff and choose exactly what each person can see and change." },
    members: { title: "Team members", body: "Change a member's role or remove their access here." },
    roles: { title: "Roles", body: "Each role is a set of permissions. Create custom roles for special jobs." },
  },
  themes: {
    current: { title: "Your current theme", body: "This is the design your store uses right now." },
    customize: { title: "Customise your theme", body: "Open the theme editor to change colours, fonts, banners and sections." },
    browse: { title: "Try a new look", body: "Preview any theme with a live demo. Applying one creates a draft, so your live store changes only when you publish." },
  },
  themeEditor: {
    tools: { title: "Editing tools", body: "Pick sections, pages, colours and fonts to edit from this bar." },
    canvas: { title: "Live preview", body: "Your store as shoppers will see it. Click any section to edit it." },
    publish: { title: "Save and publish", body: "Save your draft any time, preview it, then Publish to make it live." },
  },
  discounts: {
    create: { title: "Create a discount", body: "Make a coupon code like WELCOME10, or an automatic offer for a festive sale." },
    list: { title: "Your discounts", body: "Switch discounts on or off and see how often each one was used." },
  },
  social: {
    tabs: { title: "Plan your posts", body: "Use the calendar, posts and library to plan content for Instagram, Facebook and more." },
    week: { title: "This week", body: "Posts planned for the next 7 days. Scheduled posts publish automatically." },
    accounts: { title: "Connect accounts", body: "Link your social accounts to publish straight from here." },
  },
};
