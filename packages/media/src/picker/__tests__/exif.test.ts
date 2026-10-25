/**
 * EXIF is the only place capture time and location survive: re-encoding strips
 * it from the bytes, so a parser that guesses wrong silently uploads a wrong
 * location. These pin the shapes the platforms really return.
 */

import { parseExifDate, parseExifGps, parseExifOrientation } from "../exif";

describe("parseExifGps", () => {
  it("converts degrees/minutes/seconds tuples with hemisphere refs", () => {
    const gps = parseExifGps({
      GPSLatitude: [37, 30, 0],
      GPSLatitudeRef: "N",
      GPSLongitude: [122, 15, 36],
      GPSLongitudeRef: "W",
    });

    expect(gps?.lat).toBeCloseTo(37.5);
    expect(gps?.lng).toBeCloseTo(-122.26);
  });

  it("reads iOS-style unsigned decimals and applies the hemisphere ref", () => {
    expect(
      parseExifGps({
        GPSLatitude: 33.865,
        GPSLatitudeRef: "S",
        GPSLongitude: 151.209,
        GPSLongitudeRef: "E",
      }),
    ).toEqual({ lat: -33.865, lng: 151.209 });
  });

  it("keeps the sign of an already-signed decimal", () => {
    expect(parseExifGps({ GPSLatitude: -12.5, GPSLongitude: -77.03 })).toEqual({
      lat: -12.5,
      lng: -77.03,
    });
  });

  it("defaults the refs to north and east", () => {
    expect(parseExifGps({ GPSLatitude: [10, 0, 0], GPSLongitude: [20, 0, 0] })).toEqual({
      lat: 10,
      lng: 20,
    });
  });

  it("reads a nested GPSInfo block", () => {
    const gps = parseExifGps({
      GPSInfo: { GPSLatitude: [1, 0, 0], GPSLongitude: [2, 0, 0], GPSLongitudeRef: "W" },
    });

    expect(gps).toEqual({ lat: 1, lng: -2 });
  });

  it("returns null instead of a fabricated 0,0 when a coordinate is unreadable", () => {
    expect(parseExifGps({ GPSLatitude: [1, 2], GPSLongitude: [3, 4, 5] })).toBeNull();
    expect(parseExifGps({ GPSLatitude: "north", GPSLongitude: 5 })).toBeNull();
  });

  it("returns null when either coordinate is missing or out of range", () => {
    expect(parseExifGps(undefined)).toBeNull();
    expect(parseExifGps(null)).toBeNull();
    expect(parseExifGps({})).toBeNull();
    expect(parseExifGps({ GPSLatitude: 10 })).toBeNull();
    expect(parseExifGps({ GPSLatitude: 95, GPSLongitude: 10 })).toBeNull();
    expect(parseExifGps({ GPSLatitude: 10, GPSLongitude: 181 })).toBeNull();
  });
});

describe("parseExifDate", () => {
  it("parses the EXIF 'YYYY:MM:DD HH:MM:SS' format in local time", () => {
    const date = parseExifDate({ DateTimeOriginal: "2024:03:09 14:05:30" });

    expect(date).toEqual(new Date(2024, 2, 9, 14, 5, 30));
  });

  it("prefers DateTimeOriginal, then DateTime, then DateTimeDigitized", () => {
    expect(
      parseExifDate({ DateTime: "2020:01:02 03:04:05", DateTimeDigitized: "2019:01:01 00:00:00" }),
    ).toEqual(new Date(2020, 0, 2, 3, 4, 5));
    expect(parseExifDate({ DateTimeDigitized: "2019:01:01 00:00:00" })).toEqual(
      new Date(2019, 0, 1, 0, 0, 0),
    );
  });

  it("returns null for absent, malformed, or implausible dates", () => {
    expect(parseExifDate(undefined)).toBeNull();
    expect(parseExifDate({})).toBeNull();
    expect(parseExifDate({ DateTimeOriginal: 20240309 })).toBeNull();
    expect(parseExifDate({ DateTimeOriginal: "2024:03:09" })).toBeNull();
    expect(parseExifDate({ DateTimeOriginal: "not a date" })).toBeNull();
    expect(parseExifDate({ DateTimeOriginal: "0000:00:00 00:00:00" })).toBeNull();
    expect(parseExifDate({ DateTimeOriginal: "1970:01:01 00:00:00" })).toBeNull();
    expect(parseExifDate({ DateTimeOriginal: "2500:01:01 00:00:00" })).toBeNull();
  });
});

describe("parseExifOrientation", () => {
  it("returns tags 1 through 8", () => {
    expect(parseExifOrientation({ Orientation: 1 })).toBe(1);
    expect(parseExifOrientation({ Orientation: 6 })).toBe(6);
    expect(parseExifOrientation({ Orientation: 8 })).toBe(8);
  });

  it("returns null for anything else", () => {
    expect(parseExifOrientation(undefined)).toBeNull();
    expect(parseExifOrientation({})).toBeNull();
    expect(parseExifOrientation({ Orientation: 0 })).toBeNull();
    expect(parseExifOrientation({ Orientation: 9 })).toBeNull();
    expect(parseExifOrientation({ Orientation: "6" })).toBeNull();
  });
});
