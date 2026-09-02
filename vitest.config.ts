import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        // Shared D1 seed in beforeAll; KV/R2 stacked isolation fights Miniflare.
        isolatedStorage: false,
        miniflare: {
          bindings: {
            SERVICE_NAME: "polje",
            OPERATOR_TOKEN: "test-operator-token",
            OPERATOR_EMAIL: "info@qtech.hr",
            OPERATOR_PASSWORD: "test-operator-password",
            INGEST_TOKEN: "test-ingest-token",
            ANALOG_LIVE: "0",
          },
        },
      },
    },
  },
});
