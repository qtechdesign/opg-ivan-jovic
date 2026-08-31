import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://docs.opg-ivanjovic.hr",
  integrations: [
    starlight({
      title: "Polje",
      description:
        "Farm OS for OPG Ivan Jović — public docs so another family farm can fork the same stack.",
      defaultLocale: "en",
      customCss: ["./src/styles/chassis.css"],
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "What is Polje", slug: "" },
            { label: "Quickstart", slug: "start" },
            { label: "Fork for another OPG", slug: "fork" },
            { label: "Roadmap", slug: "roadmap" },
          ],
        },
        {
          label: "Farm stack",
          items: [
            { label: "Local servers", slug: "local-servers" },
            { label: "IoT / MQTT", slug: "iot" },
            { label: "FPS frost", slug: "fps" },
            { label: "Hardware", slug: "hardware" },
            { label: "Starlink", slug: "starlink" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "HTTP API", slug: "api" },
            { label: "MCP", slug: "mcp" },
          ],
        },
        {
          label: "Policy",
          items: [{ label: "Safety", slug: "safety" }],
        },
      ],
    }),
  ],
});
