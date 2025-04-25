import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ensures a string is a valid UUID
 * @param id The ID to validate
 * @returns The validated UUID
 */
export function ensureUUID(id: string): string {
  // Simple UUID validation regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    throw new Error(`Invalid UUID format: ${id}`);
  }

  return id;
}
