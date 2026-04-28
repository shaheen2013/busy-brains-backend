type BooleanMap = Record<string, boolean>;
type NumberMap = Record<string, number>;
type StringMap = Record<string, string>;

type QuizCounts = {
  A: number;
  B: number;
  C: number;
  D: number;
};

type SoundCheck = {
  checked: string[];
  emotions: Record<string, unknown>;
};

type SpecialJobs = string[];
type EmotionList = string[];

type AppData = {
  // ---------------- MODULE 1 ----------------
  module_1_quest_2_screen_1_quiz_answer: string;

  module_1_quest_4_screen_2_quiz_counts: QuizCounts;
  module_1_quest_4_screen_2_quiz_answers: NumberMap;

  module_1_quest_5_screen_2_quiz_answers: NumberMap;

  // ---------------- MODULE 2 ----------------
  module_2_quest_2_emotions_seen_v1: EmotionList;

  module_2_quest_3_emotion_choices: StringMap;

  module_2_quest_4_special_jobs: SpecialJobs;

  module_2_quest_5_card_choices: StringMap;

  // ---------------- MODULE 3 ----------------
  module_3_quest_1_sense_videos_completed: BooleanMap;

  module_3_quest_2_movement_cards_completed: BooleanMap;

  module_3_quest_3_music_sound_body_check: StringMap;

  module_3_quest_3_reading_slider_progress: BooleanMap;

  module_3_quest_3_screen_2_reading_feelings_answer: string;

  module_3_quest_3_sounds_checked: SoundCheck;

  module_3_quest_4_eyes_on_clock_body_check: string;

  // ---------------- MODULE 4 ----------------
  module_4_quest_1_movement_card_body_check: StringMap;

  module_4_quest_1_movement_cards_completed: BooleanMap;

  module_4_quest_2_screen_2_quiz_answers: NumberMap;
  module_4_quest_2_screen_2_quiz_counts: QuizCounts;

  module_4_quest_3_movement_cards_completed: BooleanMap;

  module_4_quest_4_movement_card_body_check: StringMap;
};

const data: AppData = {
  // ---------------- MODULE 1 ----------------
  module_1_quest_2_screen_1_quiz_answer: "B",

  module_1_quest_4_screen_2_quiz_counts: {
    A: 0,
    B: 4,
    C: 1,
    D: 0,
  },

  module_1_quest_4_screen_2_quiz_answers: {
    "0": 2,
    "1": 3,
    "2": 2,
    "3": 2,
    "4": 2,
  },

  module_1_quest_5_screen_2_quiz_answers: {
    "0": 2,
  },

  // ---------------- MODULE 2 ----------------
  module_2_quest_2_emotions_seen_v1: [
    "Embarrassed",
    "Scared",
    "Proud",
    "Sad",
    "Happy",
    "Angry",
  ],

  module_2_quest_3_emotion_choices: {
    "0": "Happy",
    "1": "Proud",
    "2": "Sad",
    "3": "Embarrassed",
    "4": "Angry",
    "5": "Scared",
  },

  module_2_quest_4_special_jobs: ["organize", "pause", "plan", "solve"],

  module_2_quest_5_card_choices: {
    "0": "thinking",
    "1": "feelings",
    "2": "thinking",
    "3": "feelings",
    "4": "thinking",
    "5": "feelings",
  },

  // ---------------- MODULE 3 ----------------
  module_3_quest_1_sense_videos_completed: {
    "0": true,
    "1": true,
    "2": true,
    "3": true,
    "4": true,
    "5": true,
    "6": true,
    "7": true,
  },

  module_3_quest_2_movement_cards_completed: {
    "0": true,
    "1": true,
    "2": true,
    "3": true,
  },

  module_3_quest_3_music_sound_body_check: {
    "heavy-metal": "big-energy",
    "chill-piano": "good-to-go",
    "pop-song": "good-to-go",
  },

  module_3_quest_3_reading_slider_progress: {
    "0": true,
    "1": true,
    "2": true,
    "3": true,
  },

  module_3_quest_3_screen_2_reading_feelings_answer: "preferred-silence",

  module_3_quest_3_sounds_checked: {
    checked: ["chill-piano", "pop-song", "heavy-metal"],
    emotions: {},
  },

  module_3_quest_4_eyes_on_clock_body_check: "big-energy",

  // ---------------- MODULE 4 ----------------
  module_4_quest_1_movement_card_body_check: {
    "0": "big-energy",
    "1": "big-energy",
    "2": "good-to-go",
  },

  module_4_quest_1_movement_cards_completed: {
    "0": true,
    "1": true,
    "2": true,
    "3": true,
  },

  module_4_quest_2_screen_2_quiz_answers: {
    "0": 1,
    "1": 1,
    "2": 1,
    "3": 1,
    "4": 1,
    "5": 1,
  },

  module_4_quest_2_screen_2_quiz_counts: {
    A: 6,
    B: 0,
    C: 0,
    D: 6,
  },

  module_4_quest_3_movement_cards_completed: {
    "0": true,
    "1": true,
    "2": true,
    "3": true,
  },

  module_4_quest_4_movement_card_body_check: {
    "0": "big-energy",
    "1": "big-energy",
    "2": "big-energy",
    "3": "big-energy",
    "4": "big-energy",
    "5": "big-energy",
  },
};

export { data as ExampleAppData };
