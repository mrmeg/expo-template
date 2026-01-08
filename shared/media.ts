/**
 * Media path constants shared between client and server.
 * Defines the folder structure for different media types in R2/S3.
 */

export const MEDIA_PATHS = {
  /** User profile avatars */
  avatars: "users/avatars",
  /** Product images */
  products: "products/images",
  /** Product thumbnails */
  thumbnails: "products/thumbnails",
  /** General uploads */
  uploads: "uploads",
} as const;

export type MediaType = keyof typeof MEDIA_PATHS;
export type MediaPath = (typeof MEDIA_PATHS)[MediaType];
