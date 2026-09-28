/**
 * `setShape` reaches every component its slots name, layered after the static
 * radius and before the caller's `style`. Each case renders the component with
 * an override, finds a host node carrying that radius, then clears the override
 * and checks the default is back — a component that read the store once and
 * memoised it would pass the first half and fail the second.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { PortalHost } from "@rn-primitives/portal";

import { spacing } from "../../constants/spacing";
import { useThemeStore } from "../../state/themeStore";
import { Badge } from "../Badge";
import { BottomSheet } from "../BottomSheet";
import { Card, CardContent } from "../Card";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, Dialog, DialogContent, DialogTitle } from "../Dialog";
import { EmptyState } from "../EmptyState";
import { InputOTP } from "../InputOTP";
import { Select, SelectTrigger, SelectValue } from "../Select";
import { SkeletonCard } from "../Skeleton";
import { StatCard } from "../StatCard";
import { StyledText } from "../StyledText";
import { TextInput } from "../TextInput";

jest.mock("@expo/ui/community/bottom-sheet", () => {
  const ReactModule = require("react");
  const { View: RNView } = require("react-native");
  return {
    BottomSheet: ({ children, backgroundStyle }: any) =>
      ReactModule.createElement(RNView, { testID: "native-bottom-sheet", backgroundStyle }, children),
  };
});

/** Odd enough that no static style carries it. */
const RADIUS = 7;

type Flat = Record<string, unknown> | undefined;

function flattenedStyles(): Flat[] {
  const root = screen.root;
  if (!root) return [];
  return [root, ...root.queryAll(() => true)]
    .filter((node) => node.props?.style !== undefined)
    .map((node) => StyleSheet.flatten(node.props.style) as Flat);
}

function hasRadius(radius: number): boolean {
  return flattenedStyles().some((style) => style?.borderRadius === radius);
}

type Case = {
  name: string;
  slot: "input" | "card" | "badge" | "dialog";
  defaultRadius: number;
  element: React.ReactElement;
};

const CASES: Case[] = [
  {
    name: "TextInput",
    slot: "input",
    defaultRadius: spacing.radiusMd,
    element: <TextInput label="Name" placeholder="Ada" />,
  },
  {
    name: "InputOTP",
    slot: "input",
    defaultRadius: spacing.radiusMd,
    element: <InputOTP value="" onChangeText={() => {}} />,
  },
  {
    name: "Select trigger",
    slot: "input",
    defaultRadius: spacing.radiusMd,
    element: (
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
      </Select>
    ),
  },
  {
    name: "Card",
    slot: "card",
    defaultRadius: spacing.radiusLg,
    element: (
      <Card>
        <CardContent>
          <StyledText>Body</StyledText>
        </CardContent>
      </Card>
    ),
  },
  {
    name: "pressable Card (ring wrapper too)",
    slot: "card",
    defaultRadius: spacing.radiusLg,
    element: (
      <Card onPress={() => {}}>
        <CardContent>
          <StyledText>Body</StyledText>
        </CardContent>
      </Card>
    ),
  },
  {
    name: "StatCard",
    slot: "card",
    defaultRadius: spacing.radiusLg,
    element: <StatCard label="Revenue" value="$1,200" />,
  },
  {
    name: "EmptyState (bordered)",
    slot: "card",
    defaultRadius: spacing.radiusLg,
    element: <EmptyState bordered title="Nothing yet" />,
  },
  {
    name: "SkeletonCard",
    slot: "card",
    defaultRadius: spacing.radiusLg,
    element: <SkeletonCard />,
  },
  {
    name: "Badge",
    slot: "badge",
    defaultRadius: spacing.radiusFull,
    element: <Badge text="New" />,
  },
  {
    name: "Dialog content",
    slot: "dialog",
    defaultRadius: spacing.radiusLg,
    element: (
      <View>
        <Dialog open onOpenChange={() => {}}>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
        <PortalHost />
      </View>
    ),
  },
  {
    name: "AlertDialog content",
    slot: "dialog",
    defaultRadius: spacing.radiusLg,
    element: (
      <View>
        <AlertDialog open onOpenChange={() => {}}>
          <AlertDialogContent>
            <AlertDialogTitle>Delete?</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
        <PortalHost />
      </View>
    ),
  },
];

describe("setShape reaches its slots", () => {
  afterEach(() => {
    useThemeStore.getState().setShape({});
  });

  it.each(CASES)("$name takes the `$slot` radius and returns to the default when cleared", async ({ slot, defaultRadius, element }) => {
    useThemeStore.getState().setShape({ [slot]: { borderRadius: RADIUS } });
    const first = await render(element);
    expect(hasRadius(RADIUS)).toBe(true);
    await first.unmount();

    useThemeStore.getState().setShape({});
    await render(element);
    expect(hasRadius(RADIUS)).toBe(false);
    expect(hasRadius(defaultRadius)).toBe(true);
  });

  it("keeps the caller's style over the slot radius", async () => {
    useThemeStore.getState().setShape({ card: { borderRadius: RADIUS }, badge: { borderRadius: RADIUS } });
    await render(
      <View>
        <Card style={{ borderRadius: 2 }}>
          <CardContent>
            <StyledText>Body</StyledText>
          </CardContent>
        </Card>
        <Badge text="New" style={{ borderRadius: 3 }} />
      </View>,
    );
    const styles = flattenedStyles();
    expect(styles.some((style) => style?.borderRadius === 2)).toBe(true);
    expect(styles.some((style) => style?.borderRadius === 3)).toBe(true);
    // The card's surface is the caller's; only the pressable ring wrapper (absent here) would carry the slot value.
    expect(styles.filter((style) => style?.borderRadius === RADIUS)).toHaveLength(0);
  });

  it("leaves the underlined TextInput square regardless of the input slot", async () => {
    useThemeStore.getState().setShape({ input: { borderRadius: RADIUS } });
    await render(<TextInput variant="underlined" label="Name" />);
    expect(hasRadius(RADIUS)).toBe(false);
  });

  it("rounds the sheet's top corners through backgroundStyle", async () => {
    useThemeStore.getState().setShape({ sheet: { borderRadius: RADIUS } });
    await render(
      <BottomSheet open onOpenChange={() => {}}>
        <BottomSheet.Content>
          <StyledText>Sheet</StyledText>
        </BottomSheet.Content>
      </BottomSheet>,
    );
    const background = StyleSheet.flatten(screen.getByTestId("native-bottom-sheet").props.backgroundStyle) as Flat;
    expect(background).toEqual(expect.objectContaining({ borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS }));
  });
});
