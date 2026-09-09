/**
 * Thin route: the screen body lives in `client/showcase/ShowcaseScreen.tsx` and loads
 * through the showcase cluster's single split point (`client/showcase/gallery.tsx`).
 */
import { GalleryRoute } from "@/client/showcase/lazyGallery";

export default function ShowcaseRoute() {
  return <GalleryRoute screen="ShowcaseScreen" />;
}
