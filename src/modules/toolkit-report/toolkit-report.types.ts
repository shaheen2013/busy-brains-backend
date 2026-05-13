export type SingleToolkitType =
  | "movement"
  | "calm_and_comfort"
  | "rest_and_breathe";
export type ToolkitType = SingleToolkitType | "balanced";

export interface ToolkitImage {
  imageFile: string; // relative to assets/images/
  label: string;
  description: string;
}

export interface BrainTypeInfo {
  title: string;
  subtitle: string;
  description: string;
}

export interface TactileSenseInfo {
  title: string;
  subtitle: string;
  bulletPoints: string[];
}

export interface ToolkitInfo {
  title: string;
  description: string;
  needs: string[];
}

export interface FavouriteToolsInfo {
  subtitle: string;
  tools: string[];
}

export interface ToolkitTypeData {
  brainType: BrainTypeInfo;
  tactileSense: TactileSenseInfo;
  favouriteTools: FavouriteToolsInfo;
  toolkitInfo: ToolkitInfo;
  images: ToolkitImage[];
}
