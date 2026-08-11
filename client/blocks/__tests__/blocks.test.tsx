/**
 * Block render smoke tests.
 *
 * Every block must render with its shipped defaults (a block with no props is
 * what the gallery previews) and with representative overrides, in **both**
 * schemes — the dark pass is what catches a `createStyles` factory that only
 * works for the light theme, and it exercises the `createThemedStyles` cache
 * for `colors.dark` as well as `colors.light`.
 *
 * These tests drive the real `useThemeStore` rather than importing
 * `@/test/mockTheme`, which pins a fixed light theme and so can't switch
 * schemes. Callbacks and field state are asserted where a block has them —
 * "renders without crashing" alone would pass on a block that dropped its
 * `onPress` wiring.
 *
 * Not covered here: the stylesheet snapshot baked into the exported HTML. Jest
 * doesn't model the RNW server sheet, so the module-scope style rule is
 * enforced by the source assertions at the bottom of this file plus a manual
 * check against a real `expo export` shell.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import { useThemeStore } from "@mrmeg/expo-ui/state";

import { CtaBannerBlock } from "../cta-banner/Block";
import { FaqSectionBlock } from "../faq-section/Block";
import { FeatureGridBlock } from "../feature-grid/Block";
import { HeroBlock } from "../hero/Block";
import { SignInFormBlock } from "../sign-in-form/Block";
import { StatRowBlock } from "../stat-row/Block";
import { BLOCKS } from "../registry.generated";

const BLOCKS_DIR = path.resolve(__dirname, "..");

/** Scheme matrix every block is rendered through. */
const SCHEMES = ["light", "dark"] as const;

function setScheme(scheme: (typeof SCHEMES)[number]) {
  useThemeStore.setState({ userTheme: scheme, systemTheme: scheme, colorOverrides: {} });
}

beforeEach(() => {
  setScheme("light");
});

afterEach(() => {
  useThemeStore.setState({ userTheme: "system", systemTheme: "light", colorOverrides: {} });
});

// ---------------------------------------------------------------------------
// Defaults — the no-props preview the gallery renders
// ---------------------------------------------------------------------------

describe.each(SCHEMES)("blocks render with shipped defaults (%s)", (scheme) => {
  beforeEach(() => {
    setScheme(scheme);
  });

  it("HeroBlock", async () => {
    await render(<HeroBlock />);
    expect(screen.getByText("Ship your next screen in an afternoon")).toBeTruthy();
    expect(screen.getByText("Get started")).toBeTruthy();
    expect(screen.getByText("See the docs")).toBeTruthy();
  });

  it("FeatureGridBlock", async () => {
    await render(<FeatureGridBlock />);
    expect(screen.getByText("Themed by default")).toBeTruthy();
    expect(screen.getByText("Copy, don't import")).toBeTruthy();
  });

  it("StatRowBlock", async () => {
    await render(<StatRowBlock />);
    expect(screen.getByText("This month")).toBeTruthy();
    expect(screen.getByText("Revenue")).toBeTruthy();
    expect(screen.getByText("NPS")).toBeTruthy();
  });

  it("CtaBannerBlock", async () => {
    await render(<CtaBannerBlock />);
    expect(screen.getByText("Ready when you are")).toBeTruthy();
    expect(screen.getByText("Create a screen")).toBeTruthy();
  });

  it("FaqSectionBlock", async () => {
    await render(<FaqSectionBlock />);
    expect(screen.getByText("Common questions")).toBeTruthy();
    expect(screen.getByText("Do blocks work on web?")).toBeTruthy();
  });

  it("SignInFormBlock", async () => {
    await render(<SignInFormBlock />);
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.getByText("Continue with Apple")).toBeTruthy();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Per-block behavior with representative props
// ---------------------------------------------------------------------------

describe("HeroBlock", () => {
  it("renders eyebrow, title, description, and both actions", async () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    await render(
      <HeroBlock
        eyebrow="Launch"
        title="Ship faster"
        description="Composed sections, ready to copy."
        primaryAction={{ label: "Start", onPress: onPrimary }}
        secondaryAction={{ label: "Docs", onPress: onSecondary }}
      />,
    );

    expect(screen.getByText("Launch")).toBeTruthy();
    expect(screen.getByText("Ship faster")).toBeTruthy();
    expect(screen.getByText("Composed sections, ready to copy.")).toBeTruthy();

    await fireEvent.press(screen.getByText("Start"));
    await fireEvent.press(screen.getByText("Docs"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("omits an action passed as null", async () => {
    await render(<HeroBlock primaryAction={{ label: "Only one" }} secondaryAction={null} />);

    expect(screen.getByText("Only one")).toBeTruthy();
    expect(screen.queryByText("See the docs")).toBeNull();
  });
});

describe("FeatureGridBlock", () => {
  it("renders one card per item, in order", async () => {
    await render(
      <FeatureGridBlock
        items={[
          { icon: "zap", title: "Fast", description: "Ships in an afternoon." },
          { icon: "lock", title: "Safe", description: "Typed end to end." },
        ]}
      />,
    );

    expect(screen.getByText("Fast")).toBeTruthy();
    expect(screen.getByText("Ships in an afternoon.")).toBeTruthy();
    expect(screen.getByText("Safe")).toBeTruthy();
    expect(screen.queryByText("Themed by default")).toBeNull();
  });

  it("renders nothing but the container for an empty item list", async () => {
    await render(<FeatureGridBlock items={[]} />);
    expect(screen.queryByText("Themed by default")).toBeNull();
  });
});

describe("StatRowBlock", () => {
  it("renders each metric's label, value, unit, and change", async () => {
    await render(
      <StatRowBlock
        title="Quarter"
        description="Rolling 90 days"
        stats={[
          { label: "MRR", value: "12.4", unit: "k", change: { value: "+3.1%", direction: "up" } },
          { label: "Seats", value: 128 },
        ]}
      />,
    );

    expect(screen.getByText("Quarter")).toBeTruthy();
    expect(screen.getByText("Rolling 90 days")).toBeTruthy();
    expect(screen.getByText("12.4")).toBeTruthy();
    expect(screen.getByText("k")).toBeTruthy();
    expect(screen.getByText("+3.1%")).toBeTruthy();
    expect(screen.getByText("128")).toBeTruthy();
  });

  it("drops the header when title is empty, leaving a bare row", async () => {
    await render(<StatRowBlock title="" stats={[{ label: "Seats", value: 4 }]} />);

    expect(screen.queryByText("This month")).toBeNull();
    expect(screen.getByText("Seats")).toBeTruthy();
  });
});

describe("CtaBannerBlock", () => {
  it("invokes onAction when the button is pressed", async () => {
    const onAction = jest.fn();
    await render(
      <CtaBannerBlock title="Go" description="Now" actionLabel="Do it" onAction={onAction} />,
    );

    expect(screen.getByText("Go")).toBeTruthy();
    expect(screen.getByText("Now")).toBeTruthy();

    await fireEvent.press(screen.getByText("Do it"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders copy-only when the action label is cleared", async () => {
    await render(<CtaBannerBlock actionLabel="" />);

    expect(screen.getByText("Ready when you are")).toBeTruthy();
    expect(screen.queryByText("Create a screen")).toBeNull();
  });
});

describe("FaqSectionBlock", () => {
  it("renders questions collapsed and expands an answer on press", async () => {
    await render(
      <FaqSectionBlock
        eyebrow="FAQ"
        title="Questions"
        items={[
          { question: "Is there a free plan?", answer: "Yes — up to 3 projects." },
          { question: "Can I cancel?", answer: "Any time, from settings." },
        ]}
      />,
    );

    expect(screen.getByText("FAQ")).toBeTruthy();
    expect(screen.getByText("Is there a free plan?")).toBeTruthy();
    expect(screen.queryByText("Yes — up to 3 projects.")).toBeNull();

    await fireEvent.press(screen.getByText("Is there a free plan?"));
    expect(screen.getByText("Yes — up to 3 projects.")).toBeTruthy();
  });
});

describe("SignInFormBlock", () => {
  it("hands the typed credentials to onSubmit", async () => {
    const onSubmit = jest.fn();
    await render(<SignInFormBlock onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId("block-sign-in-email"), "dev@example.com");
    await fireEvent.changeText(screen.getByTestId("block-sign-in-password"), "hunter2");
    await fireEvent.press(screen.getByText("Sign in"));

    expect(onSubmit).toHaveBeenCalledWith({ email: "dev@example.com", password: "hunter2" });
  });

  it("masks the password field", async () => {
    await render(<SignInFormBlock />);
    expect(screen.getByTestId("block-sign-in-password").props.secureTextEntry).toBe(true);
  });

  it("reports which social provider was pressed", async () => {
    const onSocialPress = jest.fn();
    await render(
      <SignInFormBlock
        socialProviders={[{ id: "github", label: "Continue with GitHub" }]}
        onSocialPress={onSocialPress}
      />,
    );

    await fireEvent.press(screen.getByText("Continue with GitHub"));
    expect(onSocialPress).toHaveBeenCalledWith("github");
  });

  it("hides the social group entirely when no providers are supplied", async () => {
    await render(<SignInFormBlock socialProviders={[]} />);

    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.queryByText("Continue with Apple")).toBeNull();
  });

  it("gives every label and input its own id, so no two elements collide", async () => {
    // The `Label` + `TextInput` pairing needs two DISTINCT ids: `nativeID` names
    // the label, `htmlFor` points at the input's `nativeID`. Reusing one value
    // for both — the pattern this block originally shipped — renders two
    // elements with the same id on web and associates nothing.
    await render(<SignInFormBlock />);

    const ids = collectElementIds(screen.root);
    expect(ids.length).toBeGreaterThan(0);
    expect([...new Set(ids)]).toEqual(ids);
  });

  it("points each label's htmlFor at its own input, not at itself", async () => {
    await render(<SignInFormBlock />);

    for (const field of ["email", "password"] as const) {
      const input = screen.getByTestId(`block-sign-in-${field}`);
      const inputId = input.props.nativeID as string | undefined;
      expect(inputId).toBeTruthy();

      const label = screen.getByText(field === "email" ? "Email" : "Password");
      // The label's own id is on its pressable wrapper, above the text node.
      const labelId = findAncestorId(label);
      expect(labelId).toBeTruthy();
      expect(labelId).not.toBe(inputId);
    }
  });
});

/** Every `nativeID`/`id` present on a host element in the rendered tree. */
function collectElementIds(node: TestInstance | null): string[] {
  const ids: string[] = [];
  const walk = (instance: TestInstance | string) => {
    if (typeof instance === "string") return;
    const props = instance.props as { nativeID?: string; id?: string };
    if (props.nativeID) ids.push(props.nativeID);
    if (props.id) ids.push(props.id);
    for (const child of instance.children) walk(child);
  };
  if (node) walk(node);
  return ids;
}

/** Nearest `nativeID`/`id` at or above `node`. */
function findAncestorId(node: TestInstance | null): string | undefined {
  for (let current = node; current; current = current.parent) {
    const props = current.props as { nativeID?: string; id?: string };
    if (props.nativeID) return props.nativeID;
    if (props.id) return props.id;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Source-level invariants — the SSR and copy-paste contract
// ---------------------------------------------------------------------------

/**
 * Comments are stripped before the assertions below: several blocks *document*
 * the API they deliberately avoid ("...rather than raw `useWindowDimensions()`"),
 * so a raw substring search on the file would flag its own explanation.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("every block's source keeps the SSR + portability contract", () => {
  const sources = BLOCKS.map((block) => ({
    id: block.id,
    code: stripComments(fs.readFileSync(path.join(BLOCKS_DIR, block.id, "Block.tsx"), "utf8")),
  }));

  it.each(sources)("$id registers themed styles at module scope", ({ code }) => {
    // Styles created during render miss the stylesheet snapshot baked into the
    // exported HTML, so the shell paints unstyled until the client re-inserts
    // the rules.
    expect(code).toContain("createThemedStyles(createStyles)");
    expect(code).not.toMatch(/useMemo\(\s*\(\)\s*=>\s*createStyles/);
  });

  it.each(sources)("$id branches on useDimensions, never useWindowDimensions", ({ code }) => {
    // Raw useWindowDimensions has no seeded value during the export-time
    // prerender, so the exported HTML shell and the client's first render
    // disagree on the breakpoint.
    expect(code).not.toContain("useWindowDimensions");
  });

  it.each(sources)("$id imports only from @mrmeg/expo-ui, so the folder is copyable", ({ code }) => {
    const imports = [...code.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    const foreign = imports.filter(
      (specifier) =>
        !specifier.startsWith(".") &&
        specifier !== "react" &&
        specifier !== "react-native" &&
        !specifier.startsWith("@mrmeg/expo-ui"),
    );

    expect(foreign).toEqual([]);
  });

  it.each(sources)("$id is a section, not a screen: no insets and no scroll container", ({ code }) => {
    expect(code).not.toContain("useSafeAreaInsets");
    expect(code).not.toContain("SafeAreaView");
    // The host screen owns the scroll container.
    expect(code).not.toContain("ScrollView");
  });
});
