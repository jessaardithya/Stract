/**
 * Derives a URL-safe slug from a workspace name.
 * - Lowercases and trims
 * - Strips characters that are not lowercase letters, digits, spaces, or hyphens
 * - Collapses spaces to single hyphens
 * - Collapses consecutive hyphens
 * - Caps at 48 characters
 */
export function deriveSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48);
}
