export interface WindowPreset {
  name: string;
  windowWidth: number;
  windowCenter: number;
  shortcut?: string;
}

export const CT_PRESETS: WindowPreset[] = [
  { name: "Soft Tissue", windowWidth: 400, windowCenter: 40, shortcut: "1" },
  { name: "Lung", windowWidth: 1500, windowCenter: -600, shortcut: "2" },
  { name: "Bone", windowWidth: 2500, windowCenter: 480, shortcut: "3" },
  { name: "Mediastinum", windowWidth: 350, windowCenter: 50, shortcut: "4" },
  { name: "Abdomen", windowWidth: 400, windowCenter: 60, shortcut: "5" },
  { name: "Brain", windowWidth: 80, windowCenter: 40, shortcut: "6" },
  { name: "Liver", windowWidth: 150, windowCenter: 30, shortcut: "7" },
];
