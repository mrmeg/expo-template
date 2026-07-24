# Changelog

All notable changes to `@mrmeg/expo-media` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1]

### Changed

- Updated `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to
  `^3.1094.0`.

## [0.2.0]

### Changed

- Replaced deprecated `expo-video-thumbnails` usage with
  `expo-video.generateThumbnailsAsync()` while preserving the public file URI,
  width, and height result contract.
- Made feature-specific React, React Native, Expo, React Query, and HEIC peers
  optional so core and server-only consumers do not install unused runtimes.
- Expanded verified peer declarations through Expo 57 and React Native 0.86.

### Removed

- Removed unused `expo-crypto` and `expo-image-picker` peer declarations.

## [0.1.1]

### Fixed

- Scoped media listing and batch deletion to configured buckets and prefixes.

