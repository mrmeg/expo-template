# Changelog

All notable changes to `@mrmeg/expo-media` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0]

### Changed

- Replaced `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` with
  `aws4fetch` (`^1.0.20`). Server handlers now sign presigned upload/read URLs,
  `ListObjectsV2`, and object deletes with a ~2KB SigV4 signer over `fetch`, so
  consuming apps no longer install the AWS SDK. Handler request shapes, response
  shapes, error codes, and expiry defaults are unchanged.
- Batch delete now issues one signed `DELETE` per key at bounded concurrency
  instead of a single `DeleteObjects` call. The
  `{ success, deleted, errors }` response shape, per-bucket grouping, and
  1000-key request cap are unchanged.

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

