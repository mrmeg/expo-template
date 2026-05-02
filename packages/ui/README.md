# @mrmeg/expo-ui

Reusable Expo and React Native UI primitives shared by the template and consumer apps. The package does not ship font files; web consumers load Lato from Google Fonts and native consumers use platform sans-serif fallbacks.

Install from the private npm scope after publishing:

```sh
bun add @mrmeg/expo-ui
```

Consumers must also install the peer dependencies listed in `package.json`. Keep npm auth tokens in developer or CI configuration, not in this repository.
