/**
 * Thin route: the screen body lives in `client/showcase/ComponentsGalleryScreen.tsx` and loads
 * through the showcase cluster's single split point (`client/showcase/gallery.tsx`).
 */
import { GalleryRoute } from "@/client/showcase/lazyGallery";

export default function ComponentsGalleryRoute() {
  return <GalleryRoute screen="ComponentsGalleryScreen" />;
}
