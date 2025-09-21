export const PRODUCT_TYPE_OPTIONS = [
  { value: 'LAPTOP', label: 'Laptops' },
  { value: 'MONITOR', label: 'Monitors' },
  { value: 'GPU', label: 'GPUs' },
  { value: 'TV', label: 'TVs' },
  { value: 'CONSOLE', label: 'Consoles' },
  { value: 'DESKTOP', label: 'Desktops' },
  { value: 'CPU', label: 'CPUs' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'NETWORKING', label: 'Networking' },
  { value: 'PERIPHERAL', label: 'Peripherals' },
  { value: 'TABLET', label: 'Tablets' },
  { value: 'PHONE', label: 'Phones' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'CAMERA', label: 'Cameras' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type ProductTypeValue = (typeof PRODUCT_TYPE_OPTIONS)[number]['value'];

export function formatProductType(value: string | null | undefined): string {
  if (!value) return 'Other';
  const match = PRODUCT_TYPE_OPTIONS.find((opt) => opt.value === value);
  return match ? match.label.replace(/s$/, '') : value;
}
