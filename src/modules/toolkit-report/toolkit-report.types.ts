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

export interface SingleToolkitTypeData {
  brainType: BrainTypeInfo;
  tactileSense: TactileSenseInfo;
  favouriteTools: FavouriteToolsInfo;
  toolkitInfo: ToolkitInfo;
  images: ToolkitImage[];
}

export interface BalancedToolkitTypeData {
  combinedTypes: [SingleToolkitType, SingleToolkitType];
  brainType: BrainTypeInfo;
  tactileSense: TactileSenseInfo;
  favouriteTools: FavouriteToolsInfo;
  toolkitInfo: ToolkitInfo;
}

export type ToolkitTypeData = SingleToolkitTypeData | BalancedToolkitTypeData;

export function isBalanced(
  data: ToolkitTypeData,
): data is BalancedToolkitTypeData {
  return "combinedTypes" in data;
}
