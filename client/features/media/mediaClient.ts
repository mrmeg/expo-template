import {
  createMediaClient,
  type MediaFetcher,
} from "@mrmeg/expo-media/client";
import { createMediaQueryHooks } from "@mrmeg/expo-media/react-query";
import { authenticatedFetch, getAuthData } from "@/client/lib/api/authenticatedFetch";
import { MEDIA_BASE_PATH, resolveMediaBasePath } from "./mediaOrigin";

const mediaBasePath = resolveMediaBasePath();

/**
 * True when no usable media origin exists (native with a blank/placeholder
 * `EXPO_PUBLIC_API_URL`). Callers must keep queries disabled and render the
 * media-disabled state instead of firing a request that can only fail.
 */
export const isMediaOriginUnconfigured = !mediaBasePath.configured;

const mediaFetcher: MediaFetcher = async (input, init = {}) => {
  const body =
    typeof init.body === "string"
      ? JSON.parse(init.body)
      : init.body;
  const { signal, ...rest } = init;
  const { token } = await getAuthData();

  return authenticatedFetch(String(input), {
    ...rest,
    ...(signal ? { signal } : {}),
    body,
    token,
  });
};

export const mediaClient = createMediaClient({
  // When unconfigured the base path is never used — every query stays disabled
  // — but the client still needs a syntactically valid value to construct.
  basePath: mediaBasePath.configured ? mediaBasePath.basePath : MEDIA_BASE_PATH,
  fetcher: mediaFetcher,
});

export const mediaQueryHooks = createMediaQueryHooks({
  client: mediaClient,
  queryKeyNamespace: "media",
});
