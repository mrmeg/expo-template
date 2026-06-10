import {
  createMediaClient,
  type MediaFetcher,
} from "@mrmeg/expo-media/client";
import { createMediaQueryHooks } from "@mrmeg/expo-media/react-query";
import { authenticatedFetch, getAuthData } from "@/client/lib/api/authenticatedFetch";

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
  basePath: "/api/media",
  fetcher: mediaFetcher,
});

export const mediaQueryHooks = createMediaQueryHooks({
  client: mediaClient,
  queryKeyNamespace: "media",
});
