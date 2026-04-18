export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "ws://127.0.0.1:47820";
export const DEFAULT_MODEL = process.env.NEXT_PUBLIC_MODEL || "gemma-4-26b-a4b-it";

export const MODELS: { label: string; id: string; provider: string }[] = [
  { label: "Gemma 4 31B",             id: "gemma-4-31b-it", provider: "Gemma" },
  { label: "Gemma 4 26B",             id: "gemma-4-26b-a4b-it", provider: "Gemma" },
  { label: "Gemma 3 27B",             id: "gemma-3-27b-it", provider: "Gemma" },
  { label: "Gemma 3 12B",             id: "gemma-3-12b-it", provider: "Gemma" },
  { label: "Gemma 3 4B",              id: "gemma-3-4b-it", provider: "Gemma" },
  { label: "Gemma 3 1B",              id: "gemma-3-1b-it", provider: "Gemma" },
  { label: "Gemma 3n E4B",            id: "gemma-3n-e4b-it", provider: "Gemma" },
  { label: "Gemma 3n E2B",            id: "gemma-3n-e2b-it", provider: "Gemma" },
  { label: "Gemini 3 Flash",          id: "gemini-3-flash-preview", provider: "Gemini" },
  { label: "Gemini 3.1 Flash Lite",   id: "gemini-3.1-flash-lite-preview", provider: "Gemini" },
];

export type Command = { name: string; description: string; action?: string };

export const COMMANDS: Command[] = [
  { name: "/help",    description: "Show available commands and usage tips" },
  { name: "/clear",   description: "Clear the current conversation history" },
  { name: "/compact", description: "Summarize and shrink context to save tokens" },
  { name: "/effort",  description: "Cycle thinking effort: MINIMAL → MAX" },
  { name: "/model",   description: "Switch between available AI models" },
  { name: "/cwd",     description: "Show current working directory" },
  { name: "/tools",   description: "List available agent capabilities" },
];

export const EFFORT_LEVELS = ["MINIMAL", "LOW", "MEDIUM", "HIGH"] as const;

export const SPINNER_VERBS = [
  'Accomplishing','Actioning','Actualizing','Architecting','Baking','Beaming',
  "Beboppin'",'Befuddling','Billowing','Blanching','Bloviating','Boogieing',
  'Boondoggling','Booping','Bootstrapping','Brewing','Bunning','Burrowing',
  'Calculating','Canoodling','Caramelizing','Cascading','Catapulting','Cerebrating',
  'Channeling','Choreographing','Churning','Coalescing','Cogitating','Combobulating',
  'Composing','Computing','Concocting','Considering','Contemplating','Cooking',
  'Crafting','Creating','Crunching','Crystallizing','Cultivating','Deciphering',
  'Deliberating','Determining','Dilly-dallying','Discombobulating','Doing',
  'Doodling','Drizzling','Ebbing','Effecting','Elucidating','Embellishing',
  'Enchanting','Envisioning','Evaporating','Fermenting','Fiddle-faddling',
  'Finagling','Flowing','Flummoxing','Fluttering','Forging','Forming','Frolicking',
  'Generating','Gesticulating','Germinating','Grooving','Harmonizing','Hashing',
  'Hatching','Herding','Hullaballooing','Hyperspacing','Ideating','Imagining',
  'Improvising','Incubating','Inferring','Infusing','Ionizing','Jitterbugging',
  'Kneading','Leavening','Levitating','Lollygagging','Manifesting','Marinating',
  'Meandering','Metamorphosing','Misting','Moonwalking','Moseying','Mulling',
  'Mustering','Musing','Nebulizing','Nesting','Noodling','Nucleating','Orbiting',
  'Orchestrating','Osmosing','Perambulating','Percolating','Perusing',
  'Philosophising','Photosynthesizing','Pollinating','Pondering','Pontificating',
  'Pouncing','Precipitating','Processing','Proofing','Propagating','Puttering',
  'Puzzling','Quantumizing','Razzle-dazzling','Recombobulating','Reticulating',
  'Roosting','Ruminating','Scampering','Schlepping','Scurrying','Seasoning',
  'Shenaniganing','Shimmying','Simmering','Skedaddling','Sketching','Slithering',
  'Smooshing','Spelunking','Spinning','Sprouting','Stewing','Sublimating',
  'Swirling','Swooping','Symbioting','Synthesizing','Tempering','Thinking',
  'Thundering','Tinkering','Tomfoolering','Transfiguring','Transmuting','Twisting',
  'Undulating','Unfurling','Unravelling','Vibing','Waddling','Wandering','Warping',
  'Whirlpooling','Whirring','Whisking','Wibbling','Working','Wrangling','Zesting','Zigzagging',
];

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export const RECENT_DIRS_KEY = "freecode:recent_dirs";
export const COMPACT_THRESHOLD_KEY = "freecode:compact_threshold";
export const AUTO_COMPACT_KEY = "freecode:auto_compact";
export const SESSION_ID_KEY = "freecode:session_id";
export const AUTO_OPEN_PROJECT_KEY = "freecode:auto_open_project";
export const DEFAULT_THRESHOLD = 80;
