import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            SERVICE_NAME: "polje",
            OPERATOR_TOKEN: "test-operator-token",
            OPERATOR_EMAIL: "info@qtech.hr",
            OPERATOR_PASSWORD: "test-operator-password",
            INGEST_TOKEN: "test-ingest-token",
            AGENT_TOKEN: "test-agent-token",
          },
        },
      },
    },
  },
});
