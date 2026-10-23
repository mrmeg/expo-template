/**
 * Thin route: the screen body lives in `client/showcase/MediaLabScreen.tsx` and loads
 * through the showcase cluster's single split point (`client/showcase/gallery.tsx`).
 */
import { GalleryRoute } from "@/client/showcase/lazyGallery";

export default function MediaLabRoute() {
  return <GalleryRoute screen="MediaLabScreen" />;
}
