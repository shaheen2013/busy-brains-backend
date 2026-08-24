export interface ParentResource {
  title: string;
  module: number; // 0 = bonus / extra
  download_url: string;
  size: string;
}

export const PARENT_RESOURCES: ParentResource[] = [
  // Module 1
  {
    title: "Understanding the Hand Model of the Brain",
    module: 1,
    download_url:
      "https://busy-brains-backend.s3.ap-southeast-2.amazonaws.com/Parent+Guidebooks/BBParentGuidebooksModule1UnderstandingtheHandModeloftheBrain.pdf",
    size: "1.5 MB",
  },

  // Module 2
  {
    title: "Understanding the Feeling Brain, Thinking Brain and Body Clues",
    module: 2,
    download_url:
      "https://busy-brains-backend.s3.ap-southeast-2.amazonaws.com/Parent+Guidebooks/BBParentGuidebooksModule2UnderstandingtheFeelingBrainThinkingBrainandBodyClues.pdf",
    size: "1.1 MB",
  },

  // Module 3
  {
    title: "Understanding Sensory Systems Part One",
    module: 3,
    download_url:
      "https://busy-brains-backend.s3.ap-southeast-2.amazonaws.com/Parent+Guidebooks/BBParentGuidebooksModule3UnderstandingSensorySystemsPartOne.pdf",
    size: "9.9 MB",
  },

  // Module 4
  {
    title: "Understanding Sensory Systems Part Two",
    module: 4,
    download_url:
      "https://busy-brains-backend.s3.ap-southeast-2.amazonaws.com/Parent+Guidebooks/BBParentGuidebooksModule4UnderstandingSensorySystemsPartTwo.pdf",
    size: "4.5 MB",
  },

  // Module 5
  {
    title: "Building Your Child'sToolbox",
    module: 5,
    download_url:
      "https://busy-brains-backend.s3.ap-southeast-2.amazonaws.com/Parent+Guidebooks/BBParentGuidebooksModule5BuildingYourChildsToolbox.pdf",
    size: "2.0 MB",
  },

  // Bonus / Extra Resource
  {
    title: "Your Child's Busy Brain Type + Toolkit Match",
    module: 0,
    download_url:
      "https://busy-brains-backend.s3.ap-southeast-2.amazonaws.com/Parent+Guidebooks/BBParentGuidebooksYourChildsBusyBrainTypePlusToolkitMatch.pdf",
    size: "1.4 MB",
  },
  {
    title: "Parent Scripting Resource",
    module: 0,
    download_url:
      "https://busy-brains-backend.s3.ap-southeast-2.amazonaws.com/Parent+Guidebooks/BB+Parent+Scripting+Resource_20260810_141210_0000.pdf",
    size: "1.3 MB",
  },
  {
    title: "The Busy Brains Body Check In - Tool",
    module: 0,
    download_url:
      "https://busy-brains-backend.s3.ap-southeast-2.amazonaws.com/Parent+Guidebooks/TheBusyBrainsBodyCheckInTool.pdf",
    size: "2.8 MB",
  },
  {
    title: "The Busy Brains Body Check In - Visual A4",
    module: 0,
    download_url:
      "https://busy-brains-backend.s3.ap-southeast-2.amazonaws.com/Parent+Guidebooks/TheBusyBrainsBodyCheckInVisualA4Format.pdf",
    size: "1.0 MB",
  },
  {
    title: "The Busy Brains Body Check In - Visual A3",
    module: 0,
    download_url:
      "https://busy-brains-backend.s3.ap-southeast-2.amazonaws.com/Parent+Guidebooks/TheBusyBrainsBodyCheckInVisualA3Format.pdf",
    size: "1.3 MB",
  },
];
