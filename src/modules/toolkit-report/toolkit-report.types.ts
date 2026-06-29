// Quiz result flags, matching the frontend / dashboard quiz mappings.
export type BrainFlag = "A" | "B" | "C" | "D" | "MIX";
export type TactileFlag = "A" | "B" | "C" | "MIX";
export type ToolkitFlag = "A" | "B" | "C" | "MIX";

// Tool categories used to build the Final Toolkit image grid.
export type ImageGroup = "movement" | "rest_and_breathe" | "calm_and_comfort";

export interface ToolkitImage {
  imageFile: string; // relative to assets/images/
  label: string;
  description: string;
}

export interface BrainContent {
  subtitle: string;
  description: string;
}

export interface TactileContent {
  subtitle: string;
  bulletPoints: string[];
}

export interface ToolkitContent {
  title: string;
  description: string;
  needs: string[];
  imageGroups: ImageGroup[];
}

// The fully-resolved data the report template renders, derived from a child's
// real progress data rather than any hard-coded sample.
export interface ReportModel {
  childName: string;
  brainType: {
    title: string;
    subtitle: string;
    description: string;
  };
  tactileSense: {
    title: string;
    subtitle: string;
    bulletPoints: string[];
  };
  favouriteTools: {
    subtitle: string;
    tools: string[];
  };
  toolkitInfo: {
    title: string;
    description: string;
    needs: string[];
  };
  images: ToolkitImage[];
}
