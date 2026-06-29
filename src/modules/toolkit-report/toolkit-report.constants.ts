import {
  BrainFlag,
  BrainContent,
  TactileFlag,
  TactileContent,
  ToolkitFlag,
  ToolkitContent,
  ToolkitImage,
  ImageGroup,
} from "./toolkit-report.types";

// ---------------------------------------------------------------------------
// Toolkit grid images.
//
// One set per tool category. A child's "Final Toolkit" grid is built from the
// category/categories that win their Module 5 Quest 3 toolkit quiz.
// ---------------------------------------------------------------------------
const MOVEMENT_IMAGES: ToolkitImage[] = [
  {
    imageFile: "movement/1.svg",
    label: "Jump on the spot",
  },
  {
    imageFile: "movement/2.svg",
    label: "Wall push-ups",
  },
  {
    imageFile: "movement/3.svg",
    label: "Animal walks",
  },
  {
    imageFile: "movement/4.svg",
    label: "Dance to one song",
  },
  {
    imageFile: "movement/5.svg",
    label: "Play a ball game",
  },
  {
    imageFile: "movement/6.svg",
    label: "Run a lap outside",
  },
  {
    imageFile: "movement/7.svg",
    label: "Stretch tall, curl small",
  },
  {
    imageFile: "movement/8.svg",
    label: "Shake arms and legs out",
  },
  {
    imageFile: "movement/9.svg",
    label: "Swing",
  },
  {
    imageFile: "movement/10.svg",
    label: "Make an obstacle course",
  },
];

const REST_AND_BREATHE_IMAGES: ToolkitImage[] = [
  {
    imageFile: "rest-and-breathe/1.svg",
    label: "5 slow belly breaths",
  },
  {
    imageFile: "rest-and-breathe/2.svg",
    label: "Close eyes for 30 seconds",
  },
  {
    imageFile: "rest-and-breathe/3.svg",
    label: "Notice 3 sounds around you",
  },
  {
    imageFile: "rest-and-breathe/4.svg",
    label: "Guided breathing animation",
  },
  {
    imageFile: "rest-and-breathe/5.svg",
    label: "Quiet corner time",
  },
  {
    imageFile: "rest-and-breathe/6.svg",
    label: "Stretch slowly",
  },
  {
    imageFile: "rest-and-breathe/7.svg",
    label: "Listen to music",
  },
  {
    imageFile: "rest-and-breathe/8.svg",
    label: "Body scan",
  },
  {
    imageFile: "rest-and-breathe/9.svg",
    label: "Chill time",
  },
  {
    imageFile: "rest-and-breathe/10.svg",
    label: "Drink water slowly",
  },
];

const CALM_AND_COMFORT_IMAGES: ToolkitImage[] = [
  {
    imageFile: "calm-and-comfort/1.svg",
    label: "Hug a pillow or teddy",
  },
  {
    imageFile: "calm-and-comfort/2.svg",
    label: "Wrap in a blanket",
  },
  {
    imageFile: "calm-and-comfort/3.svg",
    label: "Squeeze putty or playdough",
  },
  {
    imageFile: "calm-and-comfort/4.svg",
    label: "Firm hand or shoulder squeeze",
  },
  {
    imageFile: "calm-and-comfort/5.svg",
    label: "Sit next to someone you trust",
  },
  {
    imageFile: "calm-and-comfort/6.svg",
    label: "Play with some fidget tools",
  },
  {
    imageFile: "calm-and-comfort/7.svg",
    label: "Body sock",
  },
  {
    imageFile: "calm-and-comfort/8.svg",
    label: "Headphones & music",
  },
  {
    imageFile: "calm-and-comfort/9.svg",
    label: "Warm drink",
  },
  {
    imageFile: "calm-and-comfort/10.svg",
    label: "Pet your pet",
  },
];

export const IMAGE_SETS: Record<ImageGroup, ToolkitImage[]> = {
  movement: MOVEMENT_IMAGES,
  rest_and_breathe: REST_AND_BREATHE_IMAGES,
  calm_and_comfort: CALM_AND_COMFORT_IMAGES,
};

// ---------------------------------------------------------------------------
// Brain Type content — Module 1 Quest 5 quiz.
// Flags: A = Mover, B = Cozy, C = Fidget, D = Quiet. MIX = a combo result.
// Copy mirrors the frontend (data/module-1 + data/final-toolkit).
// ---------------------------------------------------------------------------
export const BRAIN_CONTENT: Record<BrainFlag, BrainContent> = {
  A: {
    subtitle: "Loves to move to feel calm and focused",
    description:
      "Your body loves to move! Jumping, running, and being active help your brain feel calm and focused.",
  },
  B: {
    subtitle: "Feels best with comfort and cozy things",
    description:
      "You feel better with comfort – hugs, blankets, or something soft to hold make you feel safe and calm.",
  },
  C: {
    subtitle: "Keeps hands busy to help focus",
    description:
      "Keeping your hands busy helps your brain focus – fiddling, drawing, or doodling is your superpower!",
  },
  D: {
    subtitle: "Likes calm, quiet time to recharge",
    description:
      "You like calm spaces and time alone. Quiet moments help you recharge and feel ready again.",
  },
  MIX: {
    subtitle: "the best of both worlds!",
    description:
      "Not every Busy Brain fits in one box! Sometimes you feel like moving, sometimes you want quiet, sometimes you need something cozy or fidgety. Your brain can be different on different days or in different places – and that's totally okay. Knowing what feels right for you in certain situations, helps you (and your grown-ups) understand what your Busy Brain needs.",
  },
};

// ---------------------------------------------------------------------------
// Tactile Sense content — Module 4 Quest 2 quiz.
// Flags: A = Touch Explorer, B = Touch Detective, C = Touch on Your Terms.
// Bullet points mirror the frontend (data/module-4/quest-2).
// ---------------------------------------------------------------------------
export const TACTILE_CONTENT: Record<TactileFlag, TactileContent> = {
  A: {
    subtitle: "Loves touch to feel calm and focused",
    bulletPoints: [
      "Your body often wants MORE touch",
      "Touch helps you focus & calm",
      "You often look for touch when you feel tired or overwhelmed - it can be a helpful tool for you!",
    ],
  },
  B: {
    subtitle: "Notices when touch feels too much",
    bulletPoints: [
      'Your body sometimes says "too much" to touch.',
      "You don't like unexpected or non-chosen touch.",
      "Clothing, tags, or bumps can feel tricky.",
      "Too much touch can drain your energy.",
    ],
  },
  C: {
    subtitle: "Chooses what touch feels right",
    bulletPoints: [
      "Your body doesn't always want the same thing.",
      "Sometimes you love messy play, hugs, or fidgets.",
      "Other times… it feels like too much.",
      "Listening to your body helps you choose what feels right.",
    ],
  },
  MIX: {
    subtitle: "your body knows what it needs!",
    bulletPoints: [
      "Your body needs different kinds of touch at different times.",
      "Sometimes you want more touch, sometimes less.",
      "Listening to your body helps you choose what feels right.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Final Toolkit content — Module 5 Quest 3 quiz.
// Flags: A = Movement, B = Calm & Comfort, C = Rest & Breathe. MIX = Balanced.
// `imageGroups` selects which grid images appear for a single-winner result.
// Copy mirrors the frontend (data/module-5/quest-3).
// ---------------------------------------------------------------------------
export const TOOLKIT_CONTENT: Record<ToolkitFlag, ToolkitContent> = {
  A: {
    title: "Movement Toolkit",
    description:
      "When your energy builds up, your body isn't being \"too much\" — it's letting you know it needs movement. Movement tools help your body release energy and feel more in control.",
    needs: ["jumping", "pushing", "crashing", "stretching", "animal walks"],
    imageGroups: ["movement"],
  },
  B: {
    title: "Calm & Comfort Toolkit",
    description:
      "These tools give your body comfort when things feel too much or too big. They help your body feel safe, stay grounded, and focus without overwhelm.",
    needs: [
      "fidgets",
      "headphones",
      "soft things",
      "weighted items",
      "cozy spaces",
      "a big cuddle from a safe person",
    ],
    imageGroups: ["calm_and_comfort"],
  },
  C: {
    title: "Rest & Breathe Toolkit",
    description:
      'Sometimes your brain and body go into "too fast" mode. These tools help your body slow down, feel calm, and feel ready again.',
    needs: [
      "deep breathing",
      "lying down",
      "quiet time",
      "quiet play like books or lego",
    ],
    imageGroups: ["rest_and_breathe"],
  },
  MIX: {
    title: "Balanced Toolkit",
    description:
      "Your brain is flexible and can use different kinds of tools depending on how you feel. Sometimes you might need to move, sometimes you might need to feel calm, and sometimes you might need quiet or breathing.",
    needs: ["movement", "calm", "breathing", "comfort", "creativity"],
    // For a balanced result the grid is built from the tied categories;
    // this fallback is used only when the winners can't be resolved.
    imageGroups: ["movement", "rest_and_breathe", "calm_and_comfort"],
  },
};

// Maps a single toolkit flag to its grid image group(s).
export const TOOLKIT_IMAGE_GROUPS: Record<ToolkitFlag, ImageGroup[]> = {
  A: ["movement"],
  B: ["calm_and_comfort"],
  C: ["rest_and_breathe"],
  MIX: ["movement", "rest_and_breathe", "calm_and_comfort"],
};
