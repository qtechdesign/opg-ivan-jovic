/** UI language. English is default; Croatian is a toggle. */

export type Lang = "en" | "hr";

export const DEFAULT_LANG: Lang = "en";

const en = {
  nav_overview: "Overview",
  nav_land: "Land",
  nav_water: "Water",
  nav_frost: "Frost",
  nav_klima: "Climate",
  nav_eyes: "Eyes",
  nav_hands: "Hands",
  nav_ledger: "Ledger",
  nav_plan: "Plan",
  nav_mail: "Mail",
  nav_docs: "Docs",
  nav_admin: "Admin",
  nav_menu: "Menu",
  wx_clear: "CLEAR",
  wx_frost: "FROST",
  wx_fog: "FOG",
  wx_cloud: "CLOUD",
  wx_rain: "RAIN",
  wx_snow: "SNOW",

  farm_not_seeded: "Farm not seeded.",
  loading: "Loading…",
  footer_field: "Polje is the field. The field was here first.",

  op_hint: "Admin · commands",
  op_login: "Sign in",
  op_logout: "Sign out",
  op_on: "Signed in · commands unlocked.",
  op_off: "Viewing is open · sign in only for commands.",

  home_story_ivan: "House from 1923 · hay, garden, family · Croatia",
  home_story_fork: "Template for a fork · Europe/Zagreb",
  home_metric_soil: "Soil",
  home_water: "Water",
  home_rain_lock: "Rain lockout · {state}",
  home_last_drip: "Last drip · {when}",
  home_open: "open",
  home_plots: "Plots",
  home_no_plots: "No plots yet — run seed.",
  home_snapshot: "still",
  home_klima: "Climate",
  home_eyes: "View the farm",
  home_land: "Land",
  grok_placeholder: "Ask the farm…",
  grok_send: "Send",
  grok_no_briefing: "no briefing today",
  grok_login: "Sign in (Admin) then ask.",
  grok_empty: "(empty)",

  home_pitch:
    "Polje is the operating system for this family holding: land, water, frost, climate, cameras, and the book. Cloud is the brain and the ledger. The edge on the farm is the muscle and the failsafe. We rebuild OPG Ivan Jović in public so another farm can fork the same stack.",
  home_why_title: "Why this exists",
  home_why:
    "The land is older than the software. House from 1923. Unused for decades. This is the next chapter of that same ground — a family OPG, not a generic IoT toy. Pilot: we publish the plan, the API, and the work so neighbours and other farms can follow.",
  home_why_land_title: "Family land",
  home_why_land:
    "OPG is the Croatian family holding. Plots, water, frost, cameras, and the book live in one console — named for this yard, hay, and garden.",
  home_why_failsafe_title: "Local failsafe",
  home_why_failsafe:
    "Starlink can drop. Valves and heaters timeout on the farm. Cloud proposes; a human ticks confirm. No confirm = proposal only.",
  home_why_open_title: "Built in public",
  home_why_open:
    "Same work as the public Trello. This console is live — cameras included. The ledger shows cash flow once the OPG starts making money. Tokens and bank credentials stay private.",
  home_how_title: "How to use this console",
  home_guide_water: "Drip and frost valves. Sign in, write why, tick confirm. No confirm = proposal only.",
  home_guide_frost: "Load the local program, then ARM. Edge sprays if the night goes to ice. Cloud is not the safety layer.",
  home_guide_eyes: "Live cameras: yard, garden, hay. Stills now; stream when the edge has it.",
  home_guide_land: "Plots and plantings. The land ledger — names, stages, growth photos.",
  home_guide_plan: "Build phases with time and EUR. Same board the public Trello follows.",
  home_guide_ledger: "Public cash flow in cents EUR. Empty until the OPG starts making money. Not a tax filing.",
  home_plan_title: "Build plan",
  home_plan_hint:
    "Procurement and civil works, in order. Amounts are planning envelopes until a quote lands — not a contract.",
  home_plan_open: "Open the plan builder",
  home_trello_title: "Public Trello",
  home_trello_hint: "Follow the same work on the public board. Polje reads lists; writes stay on Trello.",
  home_trello_open: "Open board",
  home_live_stills: "Live stills",
  home_no_phases: "No phases yet — add them on Plan.",

  plan_title: "Plan",
  plan_sub: "Build phases · time + EUR · public",
  plan_howto:
    "This is the procurement and works timeline. Anyone can read it. Sign in to add or change a phase. Amounts are integer cents EUR. Write a reason and tick confirm — same rule as water and frost.",
  plan_new: "New phase",
  plan_title_field: "Title",
  plan_body: "Note",
  plan_start: "Start (ISO date)",
  plan_end: "End (ISO date)",
  plan_amount: "Amount (EUR)",
  plan_status: "Status",
  plan_sort: "Sort",
  plan_planned: "planned",
  plan_active: "active",
  plan_done: "done",
  plan_save: "Save phase",
  plan_reason: "Reason (audit)",
  plan_reason_ph: "e.g. civil works quote from contractor",
  plan_saved: "Saved",
  plan_empty: "No phases yet.",
  plan_totals: "Envelope",
  plan_tbd: "TBD",

  land_howto:
    "Plots and plantings are the land ledger. Viewing is open. Sign in to add a plot, planting, stage, or growth photo.",
  water_howto:
    "Viewing is open. Commands need sign-in. Pick a zone, set seconds, write why, tick confirm. Without confirm the cloud only stores a proposal. Rain lockout blocks drip, never an armed frost line. The edge closes the valve on timeout.",
  frost_howto:
    "This is FPS LoRa frost protection. Load the program, then ARM with a reason. The local node sprays if temperature drops — Cloudflare is not the safety layer. Open valve also needs confirm.",
  ledger_howto:
    "Public cash flow of the OPG in EUR cents. Empty until money starts. Not a tax filing. Sign in to add income, expense, subsidy, or asset. Receipt files stay with the operator.",
  klima_howto:
    "Old house heat and cool. Setpoint writes need sign-in, a reason, and confirm. Heat stays off if battery is below the lockout.",
  hands_howto:
    "Automations and the job queue. High-risk rules stay off until you enable with confirm + reason. Cloud proposes; you confirm water and metal.",

  land_title: "Land",
  land_sub: "Plot and planting ledger · {name}",
  land_plots: "Plots and plantings",
  land_no_plantings: "No plantings",
  land_no_plots: "No plots",
  land_no_photos: "No growth photos yet.",
  land_new_plot: "New plot",
  land_name: "Name",
  land_type: "Type",
  land_hectares: "Hectares (optional)",
  land_notes: "Notes",
  land_save_plot: "Save plot",
  land_new_planting: "New planting",
  land_plot: "Plot",
  land_crop: "Crop",
  land_variety: "Variety",
  land_stage: "Stage",
  land_planted: "Planted (ISO date)",
  land_save_planting: "Save planting",
  land_update_stage: "Update stage",
  land_planting: "Planting",
  land_new_stage: "New stage",
  land_yield: "Yield kg (optional)",
  land_update: "Update",
  land_growth_photo: "Growth photo",
  land_plot_opt: "Plot (optional)",
  land_planting_opt: "Planting (optional)",
  land_caption: "Caption",
  land_plot_saved: "Plot saved · {id}",
  land_planting_saved: "Planting saved · {id}",
  land_updated: "Updated · {stage}",
  land_pick_file: "Choose a file",

  water_title: "Water",
  water_sub: "Drip + frost line · Edge closes the valve · confirm to start",
  water_zones: "Zones",
  water_no_zones: "No zones — run seed.",
  water_kind_frost: "frost",
  water_kind_drip: "drip",
  water_kind_drip_short: "drip",
  water_device: "device {id} · last {when}",
  water_running: "RUN",
  water_idle: "IDLE",
  water_run: "Start (confirm)",
  water_run_hint:
    "Without confirm → proposal only. Drip is blocked by rain lockout; frost is not.",
  water_zone: "Zone",
  water_duration: "Duration (sec)",
  water_reason: "Reason (audit)",
  water_reason_ph: "e.g. garden dry after noon",
  water_start: "Start",
  water_lockout: "Rain lockout",
  water_lockout_hint: "Drip only. Frost program is not blocked.",
  water_lockout_on: "Enable lockout",
  water_reason_label: "Reason",
  water_lockout_ph: "e.g. rain today",
  water_save: "Save",
  water_proposal: "Proposal (not started). Turn on confirm: true.",
  water_sent: "Sent · command {id}",
  water_proposal_lock: "Proposal. Turn on confirm: true.",
  rain_locked: "RAIN · LOCKED",
  rain_open: "RAIN · OPEN",
  water_footer:
    "Edge is write-leader · local timeout closes the valve · Dewline packing later",

  frost_title: "Frost",
  frost_sub: "FPS LoRa · local program · ice 0–2 °C",
  frost_humidity: "Humidity",
  frost_dewpoint: "Dew point",
  frost_program: "Program",
  frost_threshold: "Threshold °C",
  frost_max_spray: "Max spray (s)",
  frost_reason_arm: "Reason (required to ARM)",
  frost_reason_ph: "e.g. night frost",
  frost_load: "Load program",
  frost_valve: "Valve",
  frost_reason: "Reason",
  frost_reason_valve_ph: "manual open",
  frost_propose: "Propose",
  frost_open: "Open (confirm)",
  frost_nodes: "Nodes",
  frost_events: "Recent events",
  frost_no_events: "No spray events.",
  frost_no_nodes: "No FPS nodes — run seed.",
  frost_active: "(active)",
  frost_program_ok: "Program loaded → watch",
  frost_error: "error",
  frost_footer: "Local failsafe. Cloud is not the only safety layer.",
  frost_pip: "FROST · {state}",

  klima_title: "Climate",
  klima_sub: "Old house · heat / cool · energy · {name}",
  klima_today_kwh: "Today kWh",
  klima_battery: "Battery %",
  klima_old_house: "Old house climate",
  klima_heat: "Heat °C (5–28)",
  klima_cool: "Cool °C (10–35)",
  klima_reason: "Reason",
  klima_reason_ph: "e.g. night in the house",
  klima_set: "Set setpoint",
  klima_energy: "Energy",
  klima_metric: "Metric",
  klima_value: "Value",
  klima_proposal: "Proposal — tick confirm to send the command.",
  klima_sent: "Sent · {id}",
  klima_heat_lock: "HEAT LOCKOUT · battery < {pct}%",
  klima_lock_threshold: "Lockout threshold {pct}%",
  klima_solar_now: "Solar now W",
  klima_today: "Today kWh",
  klima_yesterday: "Yesterday kWh",
  klima_footer: "Cloud proposes. Edge holds timeout and battery lockout.",

  eyes_title: "Eyes",
  eyes_sub:
    "Live view from the farm — yard, garden, hay. Cameras on this page when the edge has them.",
  eyes_footer: "House from 1923 · live stills",
  eyes_none: "No cameras yet.",
  eyes_no_view: "No view right now.",
  eyes_no_image: "No image yet",
  eyes_waiting: "waiting for camera",
  cam_yard: "Yard",
  cam_garden: "Garden",
  cam_hay: "Hay",

  hands_title: "Hands",
  hands_sub:
    "Automations + job queue · water / heat / metal need confirm · {name}",
  hands_autos: "Automations",
  hands_autos_hint:
    "High/medium risk does not enable without confirm:true + reason. Seed rules start off.",
  hands_no_autos: "No automations — run seed / M9 migration.",
  hands_fire: "Fire",
  hands_disable: "Disable",
  hands_enable: "Enable",
  hands_last: "last {when}",
  hands_enable_reason: "Reason (to enable)",
  hands_jobs: "Job queue (robot / AI)",
  hands_no_jobs: "Job queue empty.",
  hands_new_job: "New job",
  hands_kind: "Kind",
  hands_note: "Note",
  hands_optional: "optional",
  hands_create: "Create (proposed)",
  hands_confirm: "Confirm",
  hands_cancel: "Cancel",
  hands_proposed: "Proposed commands",
  hands_proposed_hint:
    "Water / actuators stay proposed until you confirm. Edge only executes snapshot.take.",
  hands_no_cmds: "No proposed commands.",
  hands_confirm_reason: "Confirm reason",
  hands_footer:
    "M9 Hands · local failsafe first · cloud proposes, human confirms metal and water",
  hands_fired: "Fired: {body}",
  hands_disabled: "Disabled.",
  hands_need_confirm: "Need confirm: true + reason (≥3).",
  hands_enabled: "Enabled.",
  hands_job_created: "Job {id} · {status}",
  hands_need_confirm_check: "Tick confirm: true (above or below) + reason.",
  hands_confirmed: "Confirmed.",
  hands_cancelled: "Cancelled.",
  hands_cmd_sent: "Command sent.",

  login_title: "Sign in",
  login_sub:
    "All pages are open. Sign-in is only for commands — water, climate, ledger, mail.",
  login_password: "Password",
  login_open: "Open admin",
  login_footer: "Cookie 30 days · secret in Cloudflare, not in git",
  login_bad: "Wrong email or password",

  mail_title: "Mail",
  mail_sub: "Farm mail · {addr}",
  mail_traffic: "14 days · traffic",
  mail_messages: "Messages",
  mail_message: "Message",
  mail_send: "Send (confirm)",
  mail_send_hint:
    "From is always {addr}. Needs confirm + reason — agents use the same path later.",
  mail_reason: "Reason (audit)",
  mail_send_btn: "Send",
  mail_empty: "Empty. Mail to farm@ is waiting for the first message.",
  mail_no_text: "(no text)",
  mail_need_confirm: "Need confirm: true",
  mail_sent: "Sent · {status} · {id}",

  ledger_title: "Ledger",
  ledger_sub: "OPG operating book · EUR · not a tax filing",
  ledger_print: "Print",
  ledger_income: "Income",
  ledger_expense: "Expense",
  ledger_subsidy: "Subsidy",
  ledger_net: "Net (income−expense)",
  ledger_months: "Monthly overview (UTC)",
  ledger_month: "Month",
  ledger_asset: "Asset",
  ledger_new: "New entry",
  ledger_kind: "Kind",
  ledger_category: "Category",
  ledger_cat_other: "Other",
  ledger_cat_feed: "Feed",
  ledger_cat_seed: "Seed",
  ledger_cat_energy: "Energy",
  ledger_cat_repair: "Repair",
  ledger_cat_sale: "Sale",
  ledger_cat_eu: "EU measure",
  ledger_amount: "Amount (EUR)",
  ledger_date: "Date",
  ledger_note: "Note",
  ledger_note_ph: "e.g. seed for the garden",
  ledger_save: "Save",
  ledger_entries: "Entries",
  ledger_receipt: "Receipt",
  ledger_file: "File (JPEG / PNG / WebP / PDF, max 5 MB)",
  ledger_upload: "Upload",
  ledger_footer: "Polje ledger · integer cents EUR · {name}",
  ledger_empty_months: "No entries in this period.",
  ledger_yield:
    "Yield (sum of plantings.yield_kg): {kg} kg · cash net: {net}",
  ledger_empty: "Empty. Add the first entry.",
  ledger_add_receipt: "+ Receipt",
  ledger_delete: "Delete",
  ledger_entry: "Entry {id}",
  ledger_delete_confirm: "Delete this entry?",
  ledger_saved: "Saved · {id}",
  ledger_add_receipt_new: "Add a receipt for the new entry (optional)",
  ledger_need_file: "File and entry required",
  ledger_receipt_saved: "Receipt saved",
} as const;

export type I18nKey = keyof typeof en;

const hr: Record<I18nKey, string> = {
  nav_overview: "Pregled",
  nav_land: "Zemlja",
  nav_water: "Voda",
  nav_frost: "Mraz",
  nav_klima: "Klima",
  nav_eyes: "Oči",
  nav_hands: "Ruke",
  nav_ledger: "Knjiga",
  nav_plan: "Plan",
  nav_mail: "Pošta",
  nav_docs: "Docs",
  nav_admin: "Admin",
  nav_menu: "Izbornik",
  wx_clear: "VEDRO",
  wx_frost: "MRAZ",
  wx_fog: "MAGLA",
  wx_cloud: "OBLAČNO",
  wx_rain: "KIŠA",
  wx_snow: "SNIJEG",

  farm_not_seeded: "Farma nije seeded.",
  loading: "Učitavanje…",
  footer_field: "Polje je polje. Polje je bilo prvo.",

  op_hint: "Admin · naredbe",
  op_login: "Prijava",
  op_logout: "Odjavi se",
  op_on: "Prijavljen · naredbe otvorene.",
  op_off: "Gledanje otvoreno · prijava samo za naredbe.",

  home_story_ivan: "Kuća iz 1923. · sijeno, vrt, obitelj · Hrvatska",
  home_story_fork: "Predložak za fork · Europe/Zagreb",
  home_metric_soil: "Tlo",
  home_water: "Voda",
  home_rain_lock: "Kišni lockout · {state}",
  home_last_drip: "Zadnje kap · {when}",
  home_open: "otvori",
  home_plots: "Parcele",
  home_no_plots: "Nema parcela — pokreni seed.",
  home_snapshot: "snimka",
  home_klima: "Klima",
  home_eyes: "Pogled na farme",
  home_land: "Zemlja",
  grok_placeholder: "Pitaj farmu…",
  grok_send: "Šalji",
  grok_no_briefing: "nema briefinga danas",
  grok_login: "Prijavi se (Admin) pa pitaj.",
  grok_empty: "(prazno)",

  home_pitch:
    "Polje je operacijski sustav ovog OPG-a: zemlja, voda, mraz, klima, kamere i knjiga. Oblak je mozak i knjiga. Rub na farmi je mišić i failsafe. OPG Ivan Jović gradimo javno da drugi OPG može forknuti isti stog.",
  home_why_title: "Zašto ovo postoji",
  home_why:
    "Zemlja je starija od softvera. Kuća iz 1923. Godinama prazna. Ovo je sljedeće poglavlje istog tla — obiteljski OPG, ne generički IoT. Pilot: plan, API i rad objavljujemo da susjedi i drugi OPG-ovi mogu pratiti.",
  home_why_land_title: "Obiteljska zemlja",
  home_why_land:
    "OPG je hrvatsko obiteljsko gospodarstvo. Parcele, voda, mraz, kamere i knjiga u jednoj konzoli — za ovo dvorište, sijeno i vrt.",
  home_why_failsafe_title: "Lokalni failsafe",
  home_why_failsafe:
    "Starlink može pasti. Ventili i grijači imaju timeout na farmi. Oblak predlaže; čovjek stavi confirm. Bez confirma = samo prijedlog.",
  home_why_open_title: "Gradimo javno",
  home_why_open:
    "Isti posao kao javni Trello. Ova konzola je uživo — i kamere. Knjiga pokazuje novčani tok kad OPG počne zarađivati. Tokeni i bankovni podaci ostaju privatni.",
  home_how_title: "Kako koristiti konzolu",
  home_guide_water: "Kap i mraz ventili. Prijava, razlog, confirm. Bez confirma = samo prijedlog.",
  home_guide_frost: "Učitaj lokalni program, pa ARM. Rub prska ako noć ide na led. Oblak nije sigurnosni sloj.",
  home_guide_eyes: "Kamere uživo: dvorište, vrt, sijeno. Still sada; stream kad rub ima veze.",
  home_guide_land: "Parcele i sadnje. Knjiga zemlje — imena, faze, fotografije rasta.",
  home_guide_plan: "Faze gradnje s vremenom i EUR. Ista ploča kao javni Trello.",
  home_guide_ledger: "Javni novčani tok u centima EUR. Prazno dok OPG ne počne zarađivati. Nije porezna prijava.",
  home_plan_title: "Plan gradnje",
  home_plan_hint:
    "Nabava i građevinski radovi, redom. Iznosi su okviri dok ne stigne ponuda — nisu ugovor.",
  home_plan_open: "Otvori plan",
  home_trello_title: "Javni Trello",
  home_trello_hint: "Prati isti posao na javnoj ploči. Polje čita liste; upisi ostaju na Trello.",
  home_trello_open: "Otvori ploču",
  home_live_stills: "Live slike",
  home_no_phases: "Nema faza — dodaj ih na Plan.",

  plan_title: "Plan",
  plan_sub: "Faze gradnje · vrijeme + EUR · javno",
  plan_howto:
    "Ovo je vremenska crta nabave i radova. Svi mogu čitati. Prijava za dodavanje ili izmjenu. Iznosi su cijeli centi EUR. Razlog + confirm — isto pravilo kao voda i mraz.",
  plan_new: "Nova faza",
  plan_title_field: "Naslov",
  plan_body: "Bilješka",
  plan_start: "Početak (ISO datum)",
  plan_end: "Kraj (ISO datum)",
  plan_amount: "Iznos (EUR)",
  plan_status: "Status",
  plan_sort: "Redoslijed",
  plan_planned: "planirano",
  plan_active: "u tijeku",
  plan_done: "gotovo",
  plan_save: "Spremi fazu",
  plan_reason: "Razlog (audit)",
  plan_reason_ph: "npr. ponuda za građevinske radove",
  plan_saved: "Spremljeno",
  plan_empty: "Nema faza.",
  plan_totals: "Okvir",
  plan_tbd: "TBD",

  land_howto:
    "Parcele i sadnje su knjiga zemlje. Pregled je otvoren. Prijava za novu parcelu, sadnju, fazu ili fotografiju rasta.",
  water_howto:
    "Pregled je otvoren. Naredbe trebaju prijavu. Zona, sekunde, razlog, confirm. Bez confirma oblak sprema samo prijedlog. Kišni lockout blokira kap, nikad naoružani mraz. Rub zatvara ventil na timeout.",
  frost_howto:
    "FPS LoRa zaštita od mraza. Učitaj program, pa ARM s razlogom. Lokalni čvor prska ako temperatura padne — Cloudflare nije sigurnosni sloj. Otvaranje ventila također treba confirm.",
  ledger_howto:
    "Javni novčani tok OPG-a u centima EUR. Prazno dok ne krene novac. Nije porezna prijava. Prijava za unos prihoda, troška, potpore ili imovine. Datoteke računa ostaju kod operatora.",
  klima_howto:
    "Stara kuća: grijanje i hlađenje. Setpoint treba prijavu, razlog i confirm. Grijanje stoji ako je baterija ispod praga.",
  hands_howto:
    "Automatizacije i red poslova. Visoki rizik ostaje ugašen dok ne uključiš confirm + razlog. Oblak predlaže; ti potvrđuješ vodu i metal.",

  land_title: "Zemlja",
  land_sub: "Ledger parcela i sađenja · {name}",
  land_plots: "Parcele i sađenja",
  land_no_plantings: "Nema sađenja",
  land_no_plots: "Nema parcela",
  land_no_photos: "Još nema fotografija rasta.",
  land_new_plot: "Nova parcela",
  land_name: "Naziv",
  land_type: "Tip",
  land_hectares: "Hektari (opcionalno)",
  land_notes: "Bilješke",
  land_save_plot: "Spremi parcelu",
  land_new_planting: "Novo sađenje",
  land_plot: "Parcela",
  land_crop: "Usjev",
  land_variety: "Sorta",
  land_stage: "Faza",
  land_planted: "Posađeno (ISO datum)",
  land_save_planting: "Spremi sađenje",
  land_update_stage: "Ažuriraj fazu",
  land_planting: "Sađenje",
  land_new_stage: "Nova faza",
  land_yield: "Prinos kg (opcionalno)",
  land_update: "Ažuriraj",
  land_growth_photo: "Fotografija rasta",
  land_plot_opt: "Parcela (opcionalno)",
  land_planting_opt: "Sađenje (opcionalno)",
  land_caption: "Opis",
  land_plot_saved: "Parcela spremljena · {id}",
  land_planting_saved: "Sađenje spremljeno · {id}",
  land_updated: "Ažurirano · {stage}",
  land_pick_file: "Odaberi datoteku",

  water_title: "Voda",
  water_sub: "Kap po kap + mraz linija · Edge zatvara ventil · confirm za pokretanje",
  water_zones: "Zone",
  water_no_zones: "Nema zona — pokreni seed.",
  water_kind_frost: "mraz",
  water_kind_drip: "kap po kap",
  water_kind_drip_short: "kap",
  water_device: "uređaj {id} · zadnje {when}",
  water_running: "RADI",
  water_idle: "MIR",
  water_run: "Pokreni (confirm)",
  water_run_hint:
    "Bez confirm → samo prijedlog. Kap po kap blokira kišni lockout; mraz ne.",
  water_zone: "Zona",
  water_duration: "Trajanje (sek)",
  water_reason: "Razlog (audit)",
  water_reason_ph: "npr. vrt suh nakon podneva",
  water_start: "Pokreni",
  water_lockout: "Kišni lockout",
  water_lockout_hint: "Samo za drip. Mraz program nije blokiran.",
  water_lockout_on: "Uključi lockout",
  water_reason_label: "Razlog",
  water_lockout_ph: "npr. kiša danas",
  water_save: "Spremi",
  water_proposal: "Prijedlog (nije pokrenuto). Uključi confirm: true.",
  water_sent: "Poslano · command {id}",
  water_proposal_lock: "Prijedlog. Uključi confirm: true.",
  rain_locked: "KIŠA · ZAKLJUČANO",
  rain_open: "KIŠA · OTVORENO",
  water_footer:
    "Edge je write-leader · lokalni timeout gasi ventil · Dewline packing kasnije",

  frost_title: "Mraz",
  frost_sub: "FPS LoRa · lokalni program · led 0–2 °C",
  frost_humidity: "Vlažnost",
  frost_dewpoint: "Točka rose",
  frost_program: "Program",
  frost_threshold: "Prag °C",
  frost_max_spray: "Max spray (s)",
  frost_reason_arm: "Razlog (obavezno za ARM)",
  frost_reason_ph: "npr. noćni mraz",
  frost_load: "Učitaj program",
  frost_valve: "Ventil",
  frost_reason: "Razlog",
  frost_reason_valve_ph: "ručno otvaranje",
  frost_propose: "Prijedlog",
  frost_open: "Otvori (confirm)",
  frost_nodes: "Čvorovi",
  frost_events: "Zadnji događaji",
  frost_no_events: "Nema spray događaja.",
  frost_no_nodes: "Nema FPS čvorova — pokreni seed.",
  frost_active: "(aktivno)",
  frost_program_ok: "Program učitan → watch",
  frost_error: "greška",
  frost_footer: "Lokalni failsafe. Cloud nije jedini sloj sigurnosti.",
  frost_pip: "MRAZ · {state}",

  klima_title: "Klima",
  klima_sub: "Stara kuća · grijanje / hlađenje · energija · {name}",
  klima_today_kwh: "Danas kWh",
  klima_battery: "Baterija %",
  klima_old_house: "Klima stare kuće",
  klima_heat: "Grijanje °C (5–28)",
  klima_cool: "Hlađenje °C (10–35)",
  klima_reason: "Razlog",
  klima_reason_ph: "npr. noć u kući",
  klima_set: "Postavi setpoint",
  klima_energy: "Energija",
  klima_metric: "Metrika",
  klima_value: "Vrijednost",
  klima_proposal: "Prijedlog — označi confirm da pošalješ naredbu.",
  klima_sent: "Poslano · {id}",
  klima_heat_lock: "HEAT LOCKOUT · baterija < {pct}%",
  klima_lock_threshold: "Lockout prag {pct}%",
  klima_solar_now: "Solar sada W",
  klima_today: "Danas kWh",
  klima_yesterday: "Jučer kWh",
  klima_footer: "Cloud predlaže. Edge drži timeout i battery lockout.",

  eyes_title: "Oči",
  eyes_sub:
    "Pogled uživo s farme — dvorište, vrt, sijeno. Kamere na ovoj stranici kad ih rub ima.",
  eyes_footer: "Kuća iz 1923. · uživo still",
  eyes_none: "Još nema kamera.",
  eyes_no_view: "Trenutačno nema pogleda.",
  eyes_no_image: "Još nema slike",
  eyes_waiting: "čeka kameru",
  cam_yard: "Dvorište",
  cam_garden: "Vrt",
  cam_hay: "Sijeno",

  hands_title: "Ruke",
  hands_sub:
    "Automatizacije + red poslova · voda / toplina / metal treba confirm · {name}",
  hands_autos: "Automatizacije",
  hands_autos_hint:
    "High/medium risk se ne uključuje bez confirm:true + razlog. Seed pravila su isključena.",
  hands_no_autos: "Nema automatizacija — pokreni seed / migraciju M9.",
  hands_fire: "Pokreni",
  hands_disable: "Isključi",
  hands_enable: "Uključi",
  hands_last: "zadnje {when}",
  hands_enable_reason: "Razlog (za uključivanje)",
  hands_jobs: "Red poslova (robot / AI)",
  hands_no_jobs: "Red poslova prazan.",
  hands_new_job: "Novi posao",
  hands_kind: "Vrsta",
  hands_note: "Napomena",
  hands_optional: "opcionalno",
  hands_create: "Stvori (proposed)",
  hands_confirm: "Potvrdi",
  hands_cancel: "Otkaži",
  hands_proposed: "Predložene naredbe",
  hands_proposed_hint:
    "Voda / aktuatori ostaju proposed dok ne potvrdiš. Edge izvršava samo snapshot.take.",
  hands_no_cmds: "Nema predloženih naredbi.",
  hands_confirm_reason: "Razlog potvrde",
  hands_footer:
    "M9 Hands · local failsafe first · cloud predlaže, čovjek potvrđuje metal i vodu",
  hands_fired: "Pokrenuto: {body}",
  hands_disabled: "Isključeno.",
  hands_need_confirm: "Potrebno confirm: true + razlog (≥3).",
  hands_enabled: "Uključeno.",
  hands_job_created: "Posao {id} · {status}",
  hands_need_confirm_check: "Označi confirm: true (gore ili dolje) + razlog.",
  hands_confirmed: "Potvrđeno.",
  hands_cancelled: "Otkazano.",
  hands_cmd_sent: "Naredba poslana.",

  login_title: "Prijava",
  login_sub:
    "Sve stranice su otvorene. Prijava je samo za naredbe — voda, klima, knjiga, pošta.",
  login_password: "Lozinka",
  login_open: "Otvori admin",
  login_footer: "Cookie 30 dana · tajna u Cloudflareu, ne u gitu",
  login_bad: "Krivi email ili lozinka",

  mail_title: "Pošta",
  mail_sub: "Pošta farme · {addr}",
  mail_traffic: "14 dana · promet",
  mail_messages: "Poruke",
  mail_message: "Poruka",
  mail_send: "Pošalji (confirm)",
  mail_send_hint:
    "From uvijek {addr}. Treba confirm + razlog — agent kasnije koristi isti path.",
  mail_reason: "Razlog (audit)",
  mail_send_btn: "Pošalji",
  mail_empty: "Prazno. Pošta na farm@ čeka prvu poruku.",
  mail_no_text: "(nema teksta)",
  mail_need_confirm: "Potrebno confirm: true",
  mail_sent: "Poslano · {status} · {id}",

  ledger_title: "Knjiga",
  ledger_sub: "Operativna knjiga OPG-a · EUR · nije porezna prijava",
  ledger_print: "Ispis",
  ledger_income: "Prihod",
  ledger_expense: "Trošak",
  ledger_subsidy: "Subvencija",
  ledger_net: "Neto (prihod−trošak)",
  ledger_months: "Mjesečni pregled (UTC)",
  ledger_month: "Mjesec",
  ledger_asset: "Imovina",
  ledger_new: "Nova stavka",
  ledger_kind: "Vrsta",
  ledger_category: "Kategorija",
  ledger_cat_other: "Ostalo",
  ledger_cat_feed: "Hrana / krmivo",
  ledger_cat_seed: "Sjeme",
  ledger_cat_energy: "Energija",
  ledger_cat_repair: "Popravak",
  ledger_cat_sale: "Prodaja",
  ledger_cat_eu: "EU mjera",
  ledger_amount: "Iznos (EUR)",
  ledger_date: "Datum",
  ledger_note: "Napomena",
  ledger_note_ph: "npr. sjeme za vrt",
  ledger_save: "Spremi",
  ledger_entries: "Stavke",
  ledger_receipt: "Račun",
  ledger_file: "Datoteka (JPEG / PNG / WebP / PDF, max 5 MB)",
  ledger_upload: "Prenesi",
  ledger_footer: "Polje knjiga · integer cents EUR · {name}",
  ledger_empty_months: "Nema stavki u razdoblju.",
  ledger_yield:
    "Prinos (suma plantings.yield_kg): {kg} kg · cash neto: {net}",
  ledger_empty: "Prazno. Unesi prvu stavku.",
  ledger_add_receipt: "+ Račun",
  ledger_delete: "Obriši",
  ledger_entry: "Stavka {id}",
  ledger_delete_confirm: "Obrisati stavku?",
  ledger_saved: "Spremljeno · {id}",
  ledger_add_receipt_new: "Dodaj račun za novu stavku (opcionalno)",
  ledger_need_file: "Datoteka i stavka potrebni",
  ledger_receipt_saved: "Račun spremljen",
};

export const I18N = { en, hr } as const;

export const HTML_LANG = `lang="en"`;

export function langToggle(): string {
  return `<div class="lang-toggle" role="group" aria-label="Language">
      <button type="button" class="lang-btn" data-set-lang="en" aria-pressed="true">EN</button>
      <button type="button" class="lang-btn" data-set-lang="hr" aria-pressed="false">HR</button>
    </div>`;
}

export const I18N_HEAD_JS = `<script>
(function(){
  try {
    var l = localStorage.getItem("polje_lang");
    if (l === "hr") {
      document.documentElement.lang = "hr";
      document.documentElement.setAttribute("data-i18n-pending", "");
    } else {
      document.documentElement.lang = "en";
    }
  } catch (e) { document.documentElement.lang = "en"; }
})();
</script>`;

export const I18N_JS = `
    const I18N = ${JSON.stringify({ en, hr })};
    let LANG = (function(){
      try {
        const l = localStorage.getItem("polje_lang");
        return (l === "hr" || l === "en") ? l : "en";
      } catch (e) { return "en"; }
    })();
    function t(key, vars) {
      const dict = I18N[LANG] || I18N.en;
      let s = dict[key] || I18N.en[key] || key;
      if (vars) {
        for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
      }
      return s;
    }
    function loc() { return LANG === "hr" ? "hr-HR" : "en-GB"; }
    function applyI18n() {
      document.documentElement.lang = LANG;
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.getAttribute("data-i18n"));
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
      });
      document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        const prefix = el.getAttribute("data-i18n-title-prefix") || "";
        el.textContent = prefix + t(el.getAttribute("data-i18n-title"));
      });
      document.querySelectorAll(".lang-btn").forEach((btn) => {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-set-lang") === LANG ? "true" : "false");
      });
      if (typeof window.poljeOnLang === "function") window.poljeOnLang();
      document.dispatchEvent(new Event("polje:lang"));
      document.documentElement.removeAttribute("data-i18n-pending");
    }
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.getAttribute("data-set-lang");
        if (next !== "en" && next !== "hr") return;
        LANG = next;
        try { localStorage.setItem("polje_lang", LANG); } catch (e) {}
        applyI18n();
      });
    });
    applyI18n();
`.trim();
