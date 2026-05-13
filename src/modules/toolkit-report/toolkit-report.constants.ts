import {
  ToolkitImage,
  ToolkitType,
  ToolkitTypeData,
} from "./toolkit-report.types";

const MOVEMENT_IMAGES: ToolkitImage[] = [
  {
    imageFile: "movement/1.svg",
    label: "Jump on the spot",
    description: "Jump around and feel the energy",
  },
  {
    imageFile: "movement/2.svg",
    label: "Shake arms and legs out",
    description: "Shake and wake your body up",
  },
  {
    imageFile: "movement/3.svg",
    label: "Wall push-ups",
    description: "Push and feel your muscles work",
  },
  {
    imageFile: "movement/4.svg",
    label: "Run in place",
    description: "Run fast then slow down",
  },
  {
    imageFile: "movement/5.svg",
    label: "Star jumps",
    description: "Jump wide and feel strong",
  },
  {
    imageFile: "movement/6.svg",
    label: "Animal walks",
    description: "Walk like a crab or bear",
  },
  {
    imageFile: "movement/7.svg",
    label: "Throw and catch a ball",
    description: "Focus and catch it!",
  },
  {
    imageFile: "movement/8.svg",
    label: "Dance to music",
    description: "Move and feel the beat",
  },
  {
    imageFile: "movement/9.svg",
    label: "Spin in circles slowly",
    description: "Spin around gently and stop",
  },
  {
    imageFile: "movement/10.svg",
    label: "Balance on one leg",
    description: "Balance steady and strong",
  },
];

const REST_AND_BREATHE_IMAGES: ToolkitImage[] = [
  {
    imageFile: "rest-and-breathe/1.svg",
    label: "5 slow belly breaths",
    description: "Slow breaths, tummy up and down",
  },
  {
    imageFile: "rest-and-breathe/2.svg",
    label: "Close eyes for 30 seconds",
    description: "Close eyes, give brain rest",
  },
  {
    imageFile: "rest-and-breathe/3.svg",
    label: "Notice 3 sounds around you",
    description: "Listen for three quiet sounds",
  },
  {
    imageFile: "rest-and-breathe/4.svg",
    label: "Guided breathing animation",
    description: "Follow breathing with Buddy",
  },
  {
    imageFile: "rest-and-breathe/5.svg",
    label: "Stretch slowly",
    description: "Stretch body nice and slow",
  },
  {
    imageFile: "rest-and-breathe/6.svg",
    label: "Quiet corner time",
    description: "Sit in your cosy corner",
  },
  {
    imageFile: "rest-and-breathe/7.svg",
    label: "Listen to calm music",
    description: "Listen to soft calming music",
  },
  {
    imageFile: "rest-and-breathe/8.svg",
    label: "Body scan",
    description: "Feel body from toes up",
  },
  {
    imageFile: "rest-and-breathe/9.svg",
    label: "Chill time",
    description: "Do something calm you love",
  },
  {
    imageFile: "rest-and-breathe/10.svg",
    label: "Drink water slowly",
    description: "Sip water slow and calm",
  },
];

const CALM_AND_COMFORT_IMAGES: ToolkitImage[] = [
  {
    imageFile: "calm-and-comfort/1.svg",
    label: "Hug a pillow or teddy",
    description: "Squeeze tight and feel calm",
  },
  {
    imageFile: "calm-and-comfort/2.svg",
    label: "Wrap in a blanket",
    description: "Wrap up warm and calm",
  },
  {
    imageFile: "calm-and-comfort/3.svg",
    label: "Squeeze putty or playdough",
    description: "Squish, squeeze, and feel calm",
  },
  {
    imageFile: "calm-and-comfort/4.svg",
    label: "Firm hand or shoulder squeeze",
    description: "Ask for a strong safe squeeze",
  },
  {
    imageFile: "calm-and-comfort/5.svg",
    label: "Sit next to someone you trust",
    description: "Feel safe and feel calm",
  },
  {
    imageFile: "calm-and-comfort/6.svg",
    label: "Play with some fidget tools",
    description: "Fidget, focus and stay calm",
  },
  {
    imageFile: "calm-and-comfort/7.svg",
    label: "Body sock",
    description: "Stretch and feel your body",
  },
  {
    imageFile: "calm-and-comfort/8.svg",
    label: "Headphones & music",
    description: "Listen and feel calm inside",
  },
  {
    imageFile: "calm-and-comfort/9.svg",
    label: "Warm drink",
    description: "Sip slowly, feel warm inside",
  },
  {
    imageFile: "calm-and-comfort/10.svg",
    label: "Pet your pet",
    description: "Gently pat and feel calm",
  },
];

const MOVEMENT_DATA: ToolkitTypeData = {
  brainType: {
    title: "Mover Brain",
    subtitle: "Always on the go — loves action and energy!",
    description:
      "Your brain loves to move! You think best when your body is active. Running, jumping, shaking, and pushing things are all great ways to help your brain reset. Movement is your superpower — and that's totally amazing!",
  },
  tactileSense: {
    title: "Active Touch Seeker",
    subtitle: "your body loves big, active sensations!",
    bulletPoints: [
      "Your body craves movement and big touch sensations",
      "Pushing, pulling, and jumping help you feel grounded",
      "You often seek out rough textures or active play",
      "- moving your body is a powerful tool for you!",
    ],
  },
  favouriteTools: {
    subtitle: "You picked these yourself — great taste!",
    tools: [
      "Jump on the spot",
      "Shake arms and legs out",
      "Wall push-ups",
      "Star jumps",
      "Animal walks",
      "Run in place",
      "Dance to music",
      "Balance on one leg",
    ],
  },
  toolkitInfo: {
    title: "Movement Toolkit",
    description:
      "Your brain loves to move and your body needs active input to feel calm and focused. Movement tools like jumping, pushing, and running help your brain reset and recharge. Keep moving — it is your superpower!",
    needs: ["movement", "energy release", "body input", "action"],
  },
  images: MOVEMENT_IMAGES,
};

const REST_AND_BREATHE_DATA: ToolkitTypeData = {
  brainType: {
    title: "Quiet & Calm Brain",
    subtitle: "Rest and breathe — your brain loves stillness!",
    description:
      "Your brain works best when it has moments of quiet and breathing time. You might find it easier to think and feel calm after taking slow breaths or having a rest. Breathing exercises and quiet time are your superpower tools!",
  },
  tactileSense: {
    title: "Sensory Calmer",
    subtitle: "breathing and quiet spaces help you reset!",
    bulletPoints: [
      "Your body feels best with gentle, calming input",
      "Slow breathing and stillness help your brain focus",
      "Quiet spaces and soft sounds make you feel safe",
      "- breathing deeply is a powerful tool for you!",
    ],
  },
  favouriteTools: {
    subtitle: "You picked these yourself — great taste!",
    tools: [
      "5 slow belly breaths",
      "Guided breathing animation",
      "Quiet corner time",
      "Listen to calm music",
      "Body scan",
      "Chill time",
      "Close eyes for 30 seconds",
      "Stretch slowly",
    ],
  },
  toolkitInfo: {
    title: "Rest & Breathe Toolkit",
    description:
      "Your brain loves quiet and breathing tools. When you feel overwhelmed, slowing down and breathing helps your brain and body reset. These tools are your go-to for feeling calm and focused. You've got this!",
    needs: ["calm", "breathing", "quiet", "stillness"],
  },
  images: REST_AND_BREATHE_IMAGES,
};

const CALM_AND_COMFORT_DATA: ToolkitTypeData = {
  brainType: {
    title: "Cozy Brain",
    subtitle: "Comfort and warmth — the cozy way to reset!",
    description:
      "Your brain loves comfort and touch! When you feel overwhelmed, cozy things like soft textures, warm hugs, and familiar objects help your brain feel safe and calm. You are a comfort expert — and that's a wonderful superpower!",
  },
  tactileSense: {
    title: "Touch Explorer",
    subtitle: "your body knows what it needs!",
    bulletPoints: [
      "Your body often wants MORE touch",
      "Touch helps you focus & calm",
      "You often look for touch when you feel tired or overwhelmed",
      "- it can be a helpful tool for you!",
    ],
  },
  favouriteTools: {
    subtitle: "You picked these yourself — great taste!",
    tools: [
      "Hug a pillow or teddy",
      "Wrap in a blanket",
      "Squeeze putty or playdough",
      "Firm hand or shoulder squeeze",
      "Sit next to someone you trust",
      "Play with some fidget tools",
      "Headphones & music",
      "Warm drink",
    ],
  },
  toolkitInfo: {
    title: "Calm & Comfort Toolkit",
    description:
      "Your brain finds comfort in touch and cozy sensations. When you feel big feelings, reaching for something soft, warm, or familiar helps your brain feel safe and settled. Your cozy tools are always there for you!",
    needs: ["comfort", "touch", "warmth", "safety"],
  },
  images: CALM_AND_COMFORT_IMAGES,
};

const BALANCED_DATA: ToolkitTypeData = {
  brainType: {
    title: "Mover + Cozy Brain Combo",
    subtitle: "the best of both worlds!",
    description:
      "Not every Busy Brain fits in one box! Sometimes you feel like moving, sometimes you want quiet, sometimes you need something cozy or fidgety. Your brain can be different on different days or in different places — and that's totally okay. Knowing what feels right for you in certain situations helps you (and your grown-ups) understand what your Busy Brain needs.",
  },
  tactileSense: {
    title: "Touch Explorer",
    subtitle: "your body knows what it needs!",
    bulletPoints: [
      "Your body often wants MORE touch",
      "Touch helps you focus & calm",
      "You often look for touch when you feel tired or overwhelmed",
      "- it can be a helpful tool for you!",
    ],
  },
  favouriteTools: {
    subtitle: "You picked these yourself — great taste!",
    tools: [
      "Squeeze putty or playdough",
      "Sit next to someone you trust",
      "Talk to someone you like",
      "Draw or colour",
      "Jump on the spot",
      "5 slow belly breaths",
      "Read a favourite book",
      "Shake arms and legs out",
      "Wrap in a blanket",
      "Hug a pillow or teddy",
      "Board games or cards",
      "Guided breathing animation",
      "Wall push-ups",
      "Chill time",
    ],
  },
  toolkitInfo: {
    title: "Balanced Toolkit",
    description:
      "Your brain is flexible and can use different kinds of tools depending on how you feel. Sometimes you might need to move, sometimes you might need to feel calm, and sometimes you might need quiet or breathing.",
    needs: ["movement", "calm", "breathing", "comfort", "creativity"],
  },
  images: [...REST_AND_BREATHE_IMAGES, ...CALM_AND_COMFORT_IMAGES],
};

export const TOOLKIT_DATA: Record<ToolkitType, ToolkitTypeData> = {
  movement: MOVEMENT_DATA,
  rest_and_breathe: REST_AND_BREATHE_DATA,
  calm_and_comfort: CALM_AND_COMFORT_DATA,
  balanced: BALANCED_DATA,
};
