import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  // @ts-ignore - clsx types differ
  return twMerge(clsx(inputs));
}

