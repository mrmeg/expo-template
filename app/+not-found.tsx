import { useRouter } from "expo-router";
import { Seo } from "@/client/components/Seo";
import { ErrorScreen } from "@/client/templates/error/Screen";

/**
 * Catch-all for paths no route file matches.
 *
 * On web, `expo-server` serves this route for every unmatched GET with a 404
 * status, so it has to be a real page. The previous `<Redirect href="/" />`
 * turned that response into a soft redirect: a 404 body whose script bounces
 * to `/`, which crawlers flag and visitors experience as a URL that silently
 * changes under them.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <>
      <Seo title="Page not found" />
      <ErrorScreen
        variant="not-found"
        primaryAction={{ label: "Go home", onPress: () => router.replace("/") }}
      />
    </>
  );
}
