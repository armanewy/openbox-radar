export type ProductType =
  | 'LAPTOP'
  | 'DESKTOP'
  | 'MONITOR'
  | 'TV'
  | 'GPU'
  | 'CPU'
  | 'CONSOLE'
  | 'STORAGE'
  | 'NETWORKING'
  | 'PERIPHERAL'
  | 'TABLET'
  | 'PHONE'
  | 'AUDIO'
  | 'CAMERA'
  | 'OTHER';

const RULES: Array<[ProductType, RegExp]> = [
  ['LAPTOP', /\b(laptop|notebook|macbook|chromebook)\b/i],
  ['MONITOR', /\b(monitor|ultrawide|curved|display)\b/i],
  ['TV', /\b(tv|oled|qled|uhd|4k|8k|the frame)\b/i],
  ['GPU', /\b(rtx|gtx|rx\s?\d{3,4}|graphics\s?card|geforce|radeon)\b/i],
  ['CPU', /\b(ryzen|core\s?i\d|threadripper|intel\s?cpu|processor)\b/i],
  ['CONSOLE', /\b(ps5|xbox|nintendo\s?switch)\b/i],
  ['DESKTOP', /\b(desktop|imac|tower|gaming\s?pc)\b/i],
  ['STORAGE', /\b(ssd|nvme|m\.2|hard\s?drive|hdd)\b/i],
  ['NETWORKING', /\b(router|mesh|access\s?point|switch\b(?! nintendo))\b/i],
  ['PERIPHERAL', /\b(keyboard|mouse|headset|webcam|dock|docking\s?station)\b/i],
  ['TABLET', /\b(ipad|tablet|galaxy\s?tab)\b/i],
  ['PHONE', /\b(iphone|pixel\s?\d|galaxy\s?s\d{1,2}|smartphone)\b/i],
  ['AUDIO', /\b(soundbar|speaker|earbuds|earphones|headphones|amp|receiver)\b/i],
  ['CAMERA', /\b(camera|mirrorless|dslr|alpha\s?\d|lumix|eos)\b/i],
];

export function classifyProductType(title: string | null | undefined): ProductType {
  const text = (title || '').trim();
  if (!text) return 'OTHER';
  for (const [type, rex] of RULES) {
    if (rex.test(text)) return type;
  }
  return 'OTHER';
}
