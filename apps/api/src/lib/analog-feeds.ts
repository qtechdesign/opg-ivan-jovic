/**
 * Public analog livestreams until the farm NVR is up.
 * These are not cameras on this plot — rural / stork landscape
 * similar to Lonjsko polje (Čigoč stork village).
 */

export type AnalogFeed = {
  camera_id: string;
  youtube_id: string;
  title_en: string;
  title_hr: string;
  place_en: string;
  place_hr: string;
};

/** White stork nests + countryside, Brandenburg — 24/7, same species as Lonjsko polje. */
export const ANALOG_FEEDS: AnalogFeed[] = [
  {
    camera_id: "cam-yard",
    youtube_id: "N4kJ8kqunLA",
    title_en: "Yard analog — storks, falcons, owls",
    title_hr: "Analog dvorišta — rode, sokoli, sove",
    place_en: "Fohrde (DE) · 4K nest mix · analog until yard NVR",
    place_hr: "Fohrde (DE) · 4K mix gnijezda · analog dok NVR ne stigne",
  },
  {
    camera_id: "cam-garden",
    youtube_id: "x10vL6_47Dw",
    title_en: "Garden analog — feeder birds",
    title_hr: "Analog vrta — ptice na hranilici",
    place_en: "Cornell FeederWatch · garden birds year-round",
    place_hr: "Cornell FeederWatch · vrtne ptice cijelu godinu",
  },
  {
    camera_id: "cam-hay",
    youtube_id: "WtoxxHADnGk",
    title_en: "Hay analog — fruit feeders / forage birds",
    title_hr: "Analog sijena — hranilica / ptice paše",
    place_en: "Cornell Panama fruit feeders · forage analog until hay NVR",
    place_hr: "Cornell Panama · analog paše dok NVR sijena ne stigne",
  },
];

/** Closer Croatian analog (park webcam, not this yard). */
export const LONJSKO_POLJE_CAM_URL =
  "https://www.whatsupcams.com/en/webcams/croatia/sisak-moslavina/jasenovac/u-zivo-europsko-selo-roda-park-prirode-lonjsko-polje/";

export function analogFeedForCamera(cameraId: string): AnalogFeed | undefined {
  return ANALOG_FEEDS.find((f) => f.camera_id === cameraId);
}

export function analogThumbUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

export function analogEmbedUrl(youtubeId: string): string {
  return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&playsinline=1&rel=0`;
}

export function analogWatchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}
