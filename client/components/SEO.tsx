import { Platform } from "react-native";

interface SEOProps {
  title: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
}

/**
 * Web-only SEO meta tags using Expo Router's Head component.
 * Renders nothing on native platforms.
 */
export function SEO({ title, description, ogImage, ogType = "website" }: SEOProps) {
  if (Platform.OS !== "web") return null;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Head = require("expo-router/head").default;

  return (
    <Head>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={ogType} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {ogImage && <meta name="twitter:image" content={ogImage} />}
    </Head>
  );
}
