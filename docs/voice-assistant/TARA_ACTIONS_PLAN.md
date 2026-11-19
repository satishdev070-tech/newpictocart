# Tara that listens fully and acts: plan (2026-11-19)

Owner ask (Hindi, paraphrased):
1. Tara (Ask Tara) does not add inventory when asked. She only gives instructions.
2. Listening is inconsistent. Sometimes she hears the whole sentence, sometimes only half. She must keep listening until **Stop** is pressed, the way Claude's voice input does.
3. The same behaviour is wanted in onboarding (online store and informative website), the seller panel and the informative-website panel.
4. For actions such as updating a product's stock or writing a blog, Tara must first state an accurate **plan**, then **perform** it.
5. Credits are spent according to the work done.

## Root causes (audit)
| # | Symptom | Cause | Where |
|---|---|---|---|
| 1 | "Adds nothing, only instructions" | The store copilot can only propose `product_copy` and `faq` changes. There is no tool for stock, price, status or blog, so the model can only explain. | `seller-ai/copilot/schemas.ts`, `prompts.ts` |
| 2 | Copilot mic cuts off mid-sentence | `listen()` runs with `continuous = false`, so the first pause ends recognition and sends what was heard so far. | `lib/speech/browser-speech.ts` |
| 3 | Onboarding call cuts the merchant off | The end-of-turn timer fires 1.2 s after the last final result (`END_OF_TURN_MS`). Natural thinking pauses end the turn. | `onboarding/voice/browser-speech.ts`, `use-tara-call.ts` |
| 4 | "Sometimes hears everything" | It depends on whether the merchant pauses longer than the browser's / our cut-off. That explains the inconsistency. | same |
| 5 | No live words in the copilot | The copilot mic passes no `onInterim`, so the merchant can't see what is being heard. | `copilot-drawer.tsx` |

## Design principles
- **Listen until Stop.** Silence never ends a turn. Only the merchant's Stop / Done does, with a safety cap so a forgotten mic doesn't run forever.
- **The model proposes; the server resolves and executes.** The model names things by title. The server maps them to ids in *this* store (tenant from membership, RLS), shows before → after, and executes only after confirmation. The executor re-validates and re-checks permission. The model never touches the database.
- **Plan first.** Every action reply is a numbered plan plus one card per step. "Do it" runs the steps in order, shows each step's result, and Tara says the outcome aloud.
- **Ambiguity is a question, not a guess.** If a product has several variants and the merchant didn't say which, Tara asks ("Which size: S, M or L?") instead of changing the wrong one.
- **Credits follow the work.** Thinking/planning = `store_agent` (existing). Each data edit = `tara_action`. Writing a blog = `generate_blog`. FAQs = `generate_faq`. The cost is shown on the button before anything is spent. A step that fails is refunded.

## Phases
### Phase 1: hear everything until Stop (all surfaces)
- `dictate()` in `lib/speech/browser-speech.ts` is a continuous capture session:
  - recognition restarts across engine pauses;
  - text is accumulated with the shared caption reducer (moved to `lib/speech/caption.ts`);
  - the session ends only on `stop()` / `abort()`, a 3-minute cap, or 60 s with no new words.
  - On Android Chrome, where continuous mode repeats text, it uses one-shot sessions and still restarts.
- Copilot drawer: live words appear in the input while listening. Stop leaves the full text in the box, Enter sends, and the merchant can edit first.
- Voice-assistant drawer: the same engine.
- Onboarding call (store + informative): the end-of-turn timer becomes a **manual end**. Tara listens until "I'm done" is tapped. A 30 s pause after speech is the safety net, and it opens the review box. The hint and the button say this clearly in all 10 languages.

### Phase 2: Tara can act (online-store panel)
New proposal types, each resolved on the server against this store:

| Type | Model gives | Server resolves | Executes with |
|---|---|---|---|
| `stock` | product title, optional variant, `set`/`add`/`remove`, quantity | product → variants (asks when ambiguous) and current stock | `setStock` / `adjustStock` (RPC, `inventory.write`) |
| `price` | product title, optional variant, price ₹, optional MRP ₹ | variants and current price/MRP; MRP below the new price is cleared and shown | variant update (`catalog.write`) |
| `product_status` | product title, publish / unpublish / archive | current status | `bulkUpdateProducts` (`catalog.publish` for publish) |
| `blog_post` | topic, optional title, publish? | none (new content) | blog generation (`generate_blog`) → `blog_posts` insert as draft, or published when asked |

Existing `product_copy` and `faq` stay as they are.

### Phase 3: plan → confirm → do
- The reply carries `plan` steps. The drawer shows "Tara's plan" with a **Do it (N credits)** button that runs all open steps in order.
- Each step shows queued → running → done / failed with the server's message. Single-step Apply / Discard still work.
- The voice / typed confirmation "haan", "yes", "kar do", "ok do it" (and similar) runs the open plan without another AI call (no extra credits).
- After execution Tara says a one-line result ("Done: Blue Kurti (M) stock is now 50").
- Prompt contract: "When the seller asks you to DO something a proposal type covers, never give instructions. Create the proposals and write the plan."

### Phase 4: credits by work
- New credit kind `tara_action` (1 credit per executed data step, editable by Super Admin in AI economy). It is registered in the migration; until the migration runs, the debit RPC defaults to 1.
- The executor debits **before** the write and refunds when the write fails (`refundAiCredit`). The blog step uses `generate_blog` through `runSellerAiGeneration` (debit → generate → refund on failure).
- The drawer shows the per-step cost and the plan total before Do it, and refreshes the balance after.

### Phase 5: informative-website panel parity, tests, docs
- Informative copilot: a `service_price` proposal (change a service's price / price type), executed with `tara_action` credits. Existing site copy, services, FAQs, SEO and service text proposals keep working. The same plan UI and "Do it" apply.
- Tests:
  - the dictation accumulator;
  - stock/price/status/blog resolvers (variant ambiguity, cross-store ids never accepted, MRP rule);
  - yes-detection;
  - credit totals;
  - the prompt contract;
  - the call machine with manual end.
- Docs: this plan, `IMPLEMENTATION_STATUS.md`.

## Out of scope (next)
- Actions in the separate voice-assistant drawer (theme tool). It gets Phase 1 listening now; the action tools can be shared with it next.
- Creating new products by voice (needs images and variants; the existing "product from image" flow covers it).
- Bulk edits across many products in one step (e.g. "all T-shirts +10"). Steps are capped at 4 per reply.
