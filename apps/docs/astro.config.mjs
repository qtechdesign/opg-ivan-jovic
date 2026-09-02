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
      components: {
        SiteTitle: "./src/components/SiteTitle.astro",
        ThemeProvider: "./src/components/ThemeProvider.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
      },
      head: [
        {
          tag: "script",
          attrs: {
            async: true,
            src: "https://www.googletagmanager.com/gtag/js?id=G-9VEBFY7JYD",
          },
        },
        {
          tag: "script",
          content:
            "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-9VEBFY7JYD');",
        },
        {
          tag: "script",
          content: `document.documentElement.dataset.solar="night";document.documentElement.dataset.wx="clear";(async()=>{try{const r=await fetch("https://opg-ivanjovic.hr/v1/weather/now?farm=ivan-jovic");if(!r.ok)return;const d=await r.json();if(d.solar)document.documentElement.dataset.solar=d.solar;if(d.wx)document.documentElement.dataset.wx=d.wx;}catch(e){}})();`,
        },
      ],
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
