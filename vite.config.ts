import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { workersCacheCdnAdapter } from "@vinext/cloudflare/cache/workers-cache-cdn-adapter";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";

export default defineConfig({
  plugins: [
    vinext({
      cache: {
        // Stock KV data adapter over a fail-open KV binding: a KV quota error ("KV get() limit
        // exceeded for the day." on Workers Free) or outage is a cache miss, not a 500 on every page.
        data: { ...kvDataAdapter(), adapter: fileURLToPath(new URL("./src/lib/cache/fail-open-kv-data-adapter.ts", import.meta.url)) },
        cdn: workersCacheCdnAdapter(),
      },
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
