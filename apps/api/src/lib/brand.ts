/** Polje mark — perspective furrows (the field). Single color. */

export const BRAND_MARK_PATHS = `<rect x="11" y="6.2" width="10" height="2.6"/>
  <rect x="8.4" y="12" width="15.2" height="2.6"/>
  <rect x="5.8" y="17.8" width="20.4" height="2.6"/>
  <rect x="3.2" y="23.6" width="25.6" height="2.6"/>`;

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    .m { fill: #07080a; }
    @media (prefers-color-scheme: dark) { .m { fill: #f0f0fa; } }
  </style>
  <g class="m">${BRAND_MARK_PATHS}</g>
</svg>
`;

export const FAVICON_LINKS = `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta name="theme-color" content="#07080a" />`;

export function brandMarkSvg(): string {
  return `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true" fill="currentColor">${BRAND_MARK_PATHS}</svg>`;
}
