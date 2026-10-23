import { configureExpoUiI18n } from "../i18n";
import { formatMediaTime, mediaTimeA11y } from "../mediaTime";

afterEach(() => {
  configureExpoUiI18n(null);
});

describe("formatMediaTime", () => {
  it("formats m:ss", () => {
    expect(formatMediaTime(0)).toBe("0:00");
    expect(formatMediaTime(5)).toBe("0:05");
    expect(formatMediaTime(62)).toBe("1:02");
    expect(formatMediaTime(600)).toBe("10:00");
  });

  it("rolls over at 59 s and 59:59", () => {
    expect(formatMediaTime(59)).toBe("0:59");
    expect(formatMediaTime(60)).toBe("1:00");
    expect(formatMediaTime(3599)).toBe("59:59");
  });

  it("floors fractional seconds, as players count", () => {
    expect(formatMediaTime(59.9)).toBe("0:59");
    expect(formatMediaTime(0.99)).toBe("0:00");
    expect(formatMediaTime(3599.999)).toBe("59:59");
  });

  it("switches to h:mm:ss at one hour", () => {
    expect(formatMediaTime(3600)).toBe("1:00:00");
    expect(formatMediaTime(3725)).toBe("1:02:05");
    expect(formatMediaTime(36000)).toBe("10:00:00");
  });

  it("uses h:mm:ss for a short value when the reference is an hour or more, so both readouts share a width", () => {
    expect(formatMediaTime(62, 3725)).toBe("0:01:02");
    expect(formatMediaTime(0, 3600)).toBe("0:00:00");
    expect(formatMediaTime(3725, 3725)).toBe("1:02:05");
  });

  it("keeps m:ss when the reference is under an hour", () => {
    expect(formatMediaTime(62, 225)).toBe("1:02");
    expect(formatMediaTime(62, 3599.9)).toBe("1:02");
  });

  it("ignores a reference that is not a positive finite number", () => {
    expect(formatMediaTime(62, Number.NaN)).toBe("1:02");
    expect(formatMediaTime(62, Number.POSITIVE_INFINITY)).toBe("1:02");
    expect(formatMediaTime(62, -1)).toBe("1:02");
    expect(formatMediaTime(62, 0)).toBe("1:02");
  });

  it("reads --:-- for NaN and negative time", () => {
    expect(formatMediaTime(Number.NaN)).toBe("--:--");
    expect(formatMediaTime(-1)).toBe("--:--");
    expect(formatMediaTime(-0.001)).toBe("--:--");
    expect(formatMediaTime(Number.NEGATIVE_INFINITY)).toBe("--:--");
  });

  it("reads Live for Infinity, through translateText", () => {
    expect(formatMediaTime(Number.POSITIVE_INFINITY)).toBe("Live");

    configureExpoUiI18n((key) => (key === "media.live" ? "En vivo" : undefined));
    expect(formatMediaTime(Number.POSITIVE_INFINITY)).toBe("En vivo");
  });
});

describe("mediaTimeA11y", () => {
  it("speaks the position and the total in words", () => {
    expect(mediaTimeA11y(62, 225)).toBe("1 minute 2 seconds of 3 minutes 45 seconds");
  });

  it("uses the singular for one and the plural otherwise", () => {
    expect(mediaTimeA11y(1, 2)).toBe("1 second of 2 seconds");
    expect(mediaTimeA11y(3661, 7322)).toBe("1 hour 1 minute 1 second of 2 hours 2 minutes 2 seconds");
  });

  it("leaves zero units out, and speaks a lone zero as 0 seconds", () => {
    expect(mediaTimeA11y(60, 180)).toBe("1 minute of 3 minutes");
    expect(mediaTimeA11y(3600, 7200)).toBe("1 hour of 2 hours");
    expect(mediaTimeA11y(0, 225)).toBe("0 seconds of 3 minutes 45 seconds");
  });

  it("floors fractional seconds", () => {
    expect(mediaTimeA11y(59.9, 120)).toBe("59 seconds of 2 minutes");
  });

  it("counts a negative or non-finite position as zero", () => {
    expect(mediaTimeA11y(-5, 60)).toBe("0 seconds of 1 minute");
    expect(mediaTimeA11y(Number.NaN, 60)).toBe("0 seconds of 1 minute");
  });

  it("speaks only the position when the duration is unknown", () => {
    expect(mediaTimeA11y(62, Number.NaN)).toBe("1 minute 2 seconds");
    expect(mediaTimeA11y(62, 0)).toBe("1 minute 2 seconds");
    expect(mediaTimeA11y(62, -1)).toBe("1 minute 2 seconds");
  });

  it("says Live for a live stream", () => {
    expect(mediaTimeA11y(62, Number.POSITIVE_INFINITY)).toBe("Live");
  });

  it("routes every word through translateText", () => {
    const words: Record<string, string> = {
      "media.minute": "minuto",
      "media.minutes": "minutos",
      "media.second": "segundo",
      "media.seconds": "segundos",
      "media.of": "de",
    };
    configureExpoUiI18n((key) => words[key]);

    expect(mediaTimeA11y(62, 225)).toBe("1 minuto 2 segundos de 3 minutos 45 segundos");
  });
});
