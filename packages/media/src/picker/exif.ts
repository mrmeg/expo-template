/**
 * EXIF parsing for picker assets.
 *
 * Re-encoding deliberately strips EXIF from the uploaded bytes, so capture time
 * and location are read here, before processing, and travel as upload metadata.
 * All three parsers are pure and accept whatever shape the platform returned.
 */

type ExifRecord = Record<string, unknown>;

/** Valid EXIF orientation tags; 5-8 transpose the stored dimensions. */
const MIN_ORIENTATION = 1;
const MAX_ORIENTATION = 8;

const MIN_PLAUSIBLE_YEAR = 1990;
const MAX_PLAUSIBLE_YEAR = 2100;

function asRecord(value: unknown): ExifRecord | null {
  return typeof value === "object" && value !== null ? (value as ExifRecord) : null;
}

/**
 * One coordinate to signed decimal degrees, or `null` when unreadable.
 *
 * Android and EXIF-spec writers give `[degrees, minutes, seconds]`; iOS gives an
 * unsigned decimal number with the hemisphere in the `Ref` tag. A coordinate
 * that cannot be read is `null`, never `0`: a fabricated 0 is a point in the
 * Gulf of Guinea.
 */
function toDecimalDegrees(value: unknown, ref: unknown): number | null {
  let degrees: number;
  if (typeof value === "number") {
    degrees = Math.abs(value);
  } else if (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.slice(0, 3).every((part) => typeof part === "number")
  ) {
    const [d, m, s] = value as number[];
    degrees = Math.abs(d) + m / 60 + s / 3600;
  } else {
    return null;
  }
  if (!Number.isFinite(degrees)) return null;

  const negative = ref === "S" || ref === "W" || (typeof value === "number" && value < 0);
  return negative ? -degrees : degrees;
}

/**
 * Decimal GPS position from EXIF, or `null` when either coordinate is missing,
 * unreadable, or outside the globe.
 *
 * Reads `exif.GPSInfo` when present (some libraries nest it) and the top level
 * otherwise.
 */
export function parseExifGps(
  exif: ExifRecord | null | undefined,
): { lat: number; lng: number } | null {
  if (!exif) return null;

  const gps = asRecord(exif.GPSInfo) ?? exif;
  const lat = toDecimalDegrees(gps.GPSLatitude, gps.GPSLatitudeRef ?? "N");
  const lng = toDecimalDegrees(gps.GPSLongitude, gps.GPSLongitudeRef ?? "E");

  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Capture time from EXIF (`"YYYY:MM:DD HH:MM:SS"`, local time with no zone), or
 * `null` when absent, malformed, or outside a plausible range.
 */
export function parseExifDate(exif: ExifRecord | null | undefined): Date | null {
  if (!exif) return null;

  const raw = exif.DateTimeOriginal || exif.DateTime || exif.DateTimeDigitized;
  if (typeof raw !== "string") return null;

  const parts = raw.trim().split(" ");
  if (parts.length !== 2) return null;

  const [datePart, timePart] = parts;
  const date = new Date(`${datePart.replace(/:/g, "-")}T${timePart}`);

  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  if (year < MIN_PLAUSIBLE_YEAR || year > MAX_PLAUSIBLE_YEAR) return null;
  return date;
}

/**
 * The EXIF orientation tag (1-8), or `null`. Metadata only: the pickers already
 * report displayed dimensions.
 */
export function parseExifOrientation(exif: ExifRecord | null | undefined): number | null {
  const value = exif?.Orientation;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_ORIENTATION &&
    value <= MAX_ORIENTATION
    ? value
    : null;
}
