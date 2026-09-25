/**
 * Seeded detail content for the component detail screen.
 *
 * Mockup 05 frame 3 shows a variant row plus a copyable snippet. Writing that
 * by hand for all 36 components would be a lot of prose to keep true, so this
 * seeds the highest-traffic components and everything else falls back to its
 * live preview plus its import path (see `client/showcase/ComponentDetailScreen.tsx`).
 * A component with no entry here still gets a working detail screen — the
 * fallback is the design, not a gap.
 *
 * `variants` are live instances, same as `previews.tsx`: the labelled row is
 * what tells an adopter which preset to reach for. `usage` is copied verbatim,
 * so it has to be code that compiles against the shipped API.
 */

import React from "react";
import { View } from "react-native";

import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { BottomSheet } from "@mrmeg/expo-ui/components/BottomSheet";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mrmeg/expo-ui/components/Card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@mrmeg/expo-ui/components/Dialog";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@mrmeg/expo-ui/components/Item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mrmeg/expo-ui/components/Select";
import { StatCard } from "@mrmeg/expo-ui/components/StatCard";
import { SansSerifText } from "@mrmeg/expo-ui/components/StyledText";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mrmeg/expo-ui/components/Tabs";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";
import { spacing } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentVariant {
  /** Name of the variant, e.g. a preset or size value. */
  label: string;
  /** A live instance configured for that variant. */
  render: () => React.ReactElement;
}

export interface ComponentDetail {
  /** One line on what the component is for, shown under the title. */
  summary: string;
  /** Labelled variants, rendered as a wrapping row of live instances. */
  variants: ComponentVariant[];
  /** Copyable usage snippet. Must compile against the shipped API. */
  usage: string;
}

// ---------------------------------------------------------------------------
// Controlled-preview wrappers
// ---------------------------------------------------------------------------

/** `Switch` has no uncontrolled mode; a dead switch would read as broken. */
function SwitchVariant({ initial, disabled }: { initial: boolean; disabled?: boolean }) {
  const [checked, setChecked] = React.useState(initial);
  return <Switch checked={checked} onCheckedChange={setChecked} disabled={disabled} />;
}

/**
 * `Dialog` with fields. Regression harness for `@expo/ui`-hosted controls
 * inside `DialogContent` on iOS: under react-native-screens' `FullWindowOverlay`
 * the SwiftUI field never mounted, so the odometer could not take focus.
 */
function DialogFormVariant() {
  const [odometer, setOdometer] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button preset="outline" size="sm" text="Start trip" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start trip</DialogTitle>
          <DialogDescription>Enter the starting odometer and an optional purpose.</DialogDescription>
        </DialogHeader>
        <TextInput
          label="Starting odometer"
          required
          inputMode="numeric"
          placeholder="0"
          value={odometer}
          onChangeText={setOdometer}
        />
        <TextInput
          label="Trip purpose"
          placeholder="Client visit"
          value={purpose}
          onChangeText={setPurpose}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button preset="ghost" size="sm" text="Cancel" />
          </DialogClose>
          <DialogClose asChild>
            <Button preset="default" size="sm" text="Start" />
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Seeded details
// ---------------------------------------------------------------------------

export const COMPONENT_DETAILS: Record<string, ComponentDetail> = {
  Button: {
    summary: "Six presets and three sizes, with loading and full-width states.",
    variants: [
      { label: "default", render: () => <Button preset="default" size="sm" text="Save" /> },
      { label: "outline", render: () => <Button preset="outline" size="sm" text="Cancel" /> },
      { label: "ghost", render: () => <Button preset="ghost" size="sm" text="Skip" /> },
      { label: "secondary", render: () => <Button preset="secondary" size="sm" text="Later" /> },
      { label: "destructive", render: () => <Button preset="destructive" size="sm" text="Delete" /> },
      { label: "link", render: () => <Button preset="link" size="sm" text="Learn more" /> },
      { label: "loading", render: () => <Button preset="default" size="sm" text="Saving" loading /> },
      { label: "disabled", render: () => <Button preset="default" size="sm" text="Save" disabled /> },
    ],
    usage: `<Button
  preset="default"
  text="Save changes"
  onPress={handleSave}
/>`,
  },

  TextInput: {
    summary: "Labelled field with helper and error text, three variants, three sizes.",
    variants: [
      { label: "outline", render: () => <TextInput size="sm" variant="outline" placeholder="Outline" /> },
      { label: "filled", render: () => <TextInput size="sm" variant="filled" placeholder="Filled" /> },
      { label: "underlined", render: () => <TextInput size="sm" variant="underlined" placeholder="Underlined" /> },
      {
        label: "with label",
        render: () => <TextInput size="sm" label="Email" placeholder="you@example.com" />,
      },
      {
        label: "error",
        render: () => <TextInput size="sm" defaultValue="not-an-email" errorText="Enter a valid email" error />,
      },
      { label: "disabled", render: () => <TextInput size="sm" defaultValue="Locked" editable={false} /> },
    ],
    usage: `<TextInput
  label="Email"
  value={email}
  onChangeText={setEmail}
  keyboardType="email-address"
  errorText={errors.email}
/>`,
  },

  Switch: {
    summary: "Controlled toggle with an optional iOS-styled variant.",
    variants: [
      { label: "on", render: () => <SwitchVariant initial /> },
      { label: "off", render: () => <SwitchVariant initial={false} /> },
      { label: "disabled", render: () => <SwitchVariant initial disabled /> },
    ],
    usage: `const [enabled, setEnabled] = useState(false);

<Switch checked={enabled} onCheckedChange={setEnabled} />`,
  },

  Select: {
    summary: "Portal-rendered picker with grouped items and three trigger sizes.",
    variants: [
      {
        label: "sm",
        render: () => (
          <Select>
            <SelectTrigger size="sm"><SelectValue placeholder="Small" /></SelectTrigger>
            <SelectContent><SelectItem value="a" label="Option A" /></SelectContent>
          </Select>
        ),
      },
      {
        label: "md",
        render: () => (
          <Select>
            <SelectTrigger size="md"><SelectValue placeholder="Medium" /></SelectTrigger>
            <SelectContent><SelectItem value="a" label="Option A" /></SelectContent>
          </Select>
        ),
      },
      {
        label: "lg",
        render: () => (
          <Select>
            <SelectTrigger size="lg"><SelectValue placeholder="Large" /></SelectTrigger>
            <SelectContent><SelectItem value="a" label="Option A" /></SelectContent>
          </Select>
        ),
      },
    ],
    usage: `const [plan, setPlan] = useState<{ value: string; label: string }>();

<Select value={plan} onValueChange={setPlan}>
  <SelectTrigger>
    <SelectValue placeholder="Pick a plan" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="starter" label="Starter" />
    <SelectItem value="pro" label="Pro" />
  </SelectContent>
</Select>`,
  },

  Dialog: {
    summary: "Modal dialog, plus an AlertDialog variant for destructive confirms.",
    variants: [
      {
        label: "dialog",
        render: () => (
          <Dialog>
            <DialogTrigger asChild>
              <Button preset="outline" size="sm" text="Open dialog" />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete project?</DialogTitle>
                <DialogDescription>This can&apos;t be undone.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        ),
      },
      { label: "form", render: () => <DialogFormVariant /> },
      {
        label: "alert",
        render: () => (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button preset="destructive" size="sm" text="Delete project" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialog.Header>
                <AlertDialogTitle>Delete project?</AlertDialogTitle>
                <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialogCancel asChild>
                  <Button preset="ghost" size="sm" text="Cancel" />
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button preset="destructive" size="sm" text="Delete" />
                </AlertDialogAction>
              </AlertDialog.Footer>
            </AlertDialogContent>
          </AlertDialog>
        ),
      },
    ],
    usage: `<Dialog>
  <DialogTrigger asChild>
    <Button preset="outline" text="Delete" />
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete project?</DialogTitle>
      <DialogDescription>This can't be undone.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button preset="ghost" text="Cancel" />
      </DialogClose>
      <Button preset="destructive" text="Delete" onPress={remove} />
    </DialogFooter>
  </DialogContent>
</Dialog>`,
  },

  BottomSheet: {
    summary: "Native sheet on iOS and Android with snap points; a modal on web.",
    variants: [
      {
        label: "default",
        render: () => (
          <BottomSheet>
            <BottomSheet.Trigger asChild>
              <Button preset="outline" size="sm" text="Open sheet" />
            </BottomSheet.Trigger>
            <BottomSheet.Content>
              <BottomSheet.Handle />
              <BottomSheet.Body>
                <SansSerifText>Swipe down or tap the backdrop to close.</SansSerifText>
              </BottomSheet.Body>
            </BottomSheet.Content>
          </BottomSheet>
        ),
      },
      {
        label: "snap points",
        render: () => (
          <BottomSheet snapPoints={["30%", "70%"]}>
            <BottomSheet.Trigger asChild>
              <Button preset="outline" size="sm" text="30% / 70%" />
            </BottomSheet.Trigger>
            <BottomSheet.Content>
              <BottomSheet.Handle />
              <BottomSheet.Body>
                <SansSerifText>Two detents. Drag the handle to switch.</SansSerifText>
              </BottomSheet.Body>
            </BottomSheet.Content>
          </BottomSheet>
        ),
      },
    ],
    usage: `<BottomSheet snapPoints={["50%", "90%"]}>
  <BottomSheet.Trigger asChild>
    <Button text="Share" />
  </BottomSheet.Trigger>
  <BottomSheet.Content>
    <BottomSheet.Handle />
    <BottomSheet.Body>{children}</BottomSheet.Body>
  </BottomSheet.Content>
</BottomSheet>`,
  },

  Tabs: {
    summary: "Underline or pill tabs with matched content panels.",
    variants: [
      {
        label: "underline",
        render: () => (
          <View style={{ minWidth: 220 }}>
            <Tabs value="day" onValueChange={() => {}} variant="underline">
              <TabsList>
                <TabsTrigger value="day"><TabsTrigger.Text>Day</TabsTrigger.Text></TabsTrigger>
                <TabsTrigger value="week"><TabsTrigger.Text>Week</TabsTrigger.Text></TabsTrigger>
              </TabsList>
              <TabsContent value="day">
                <SansSerifText>Today&apos;s activity.</SansSerifText>
              </TabsContent>
            </Tabs>
          </View>
        ),
      },
      {
        label: "pill",
        render: () => (
          <View style={{ minWidth: 220 }}>
            <Tabs value="week" onValueChange={() => {}} variant="pill">
              <TabsList>
                <TabsTrigger value="day"><TabsTrigger.Text>Day</TabsTrigger.Text></TabsTrigger>
                <TabsTrigger value="week"><TabsTrigger.Text>Week</TabsTrigger.Text></TabsTrigger>
              </TabsList>
            </Tabs>
          </View>
        ),
      },
    ],
    usage: `const [tab, setTab] = useState("account");

<Tabs value={tab} onValueChange={setTab} variant="pill">
  <TabsList>
    <TabsTrigger value="account">
      <TabsTrigger.Text>Account</TabsTrigger.Text>
    </TabsTrigger>
    <TabsTrigger value="billing">
      <TabsTrigger.Text>Billing</TabsTrigger.Text>
    </TabsTrigger>
  </TabsList>
  <TabsContent value="account">{...}</TabsContent>
  <TabsContent value="billing">{...}</TabsContent>
</Tabs>`,
  },

  Badge: {
    summary: "Inline status pill in four variants.",
    variants: [
      { label: "default", render: () => <Badge text="Active" /> },
      { label: "secondary", render: () => <Badge variant="secondary" text="Draft" /> },
      { label: "outline", render: () => <Badge variant="outline" text="Beta" /> },
      { label: "destructive", render: () => <Badge variant="destructive" text="Failed" /> },
    ],
    usage: `<Badge variant="secondary" text="Draft" />`,
  },

  Card: {
    summary:
      "One item in a collection (a feed entry, a grid tile) or a single tappable object, with header, content, and footer slots. Not a layout box: group rows with ItemGroup instead.",
    variants: [
      {
        label: "default",
        render: () => (
          <View style={{ minWidth: 200 }}>
            <Card>
              <CardHeader>
                <CardTitle>Weekly report</CardTitle>
                <CardDescription>Updated 2h ago</CardDescription>
              </CardHeader>
            </Card>
          </View>
        ),
      },
      {
        label: "outline",
        render: () => (
          <View style={{ minWidth: 200 }}>
            <Card variant="outline">
              <CardContent>
                <SansSerifText>No shadow, visible border.</SansSerifText>
              </CardContent>
            </Card>
          </View>
        ),
      },
      {
        label: "ghost",
        render: () => (
          <View style={{ minWidth: 200 }}>
            <Card variant="ghost">
              <CardContent>
                <SansSerifText>Transparent surface.</SansSerifText>
              </CardContent>
            </Card>
          </View>
        ),
      },
    ],
    usage: `<Card>
  <CardHeader>
    <CardTitle>Weekly report</CardTitle>
    <CardDescription>Updated 2h ago</CardDescription>
  </CardHeader>
  <CardContent>{children}</CardContent>
  <CardFooter>
    <Button text="Open" onPress={open} />
  </CardFooter>
</Card>`,
  },

  Item: {
    summary:
      "List and settings rows. Stack them in an ItemGroup: full-width rows, hairlines inset under the title, no box around the group.",
    variants: [
      {
        label: "ItemGroup",
        render: () => (
          <View style={{ minWidth: 260 }}>
            <ItemGroup title="Account" footer="Signed in as jane@example.com">
              <Item onPress={() => {}}>
                <ItemMedia icon="user" />
                <ItemContent>
                  <ItemTitle>Edit profile</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Icon name="chevron-right" size={18} color="mutedForeground" />
                </ItemActions>
              </Item>
              <Item>
                <ItemMedia icon="bell" />
                <ItemContent>
                  <ItemTitle>Notifications</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <SwitchVariant initial />
                </ItemActions>
              </Item>
            </ItemGroup>
          </View>
        ),
      },
      {
        label: "without media",
        render: () => (
          <View style={{ minWidth: 260 }}>
            <ItemGroup title="About">
              <Item>
                <ItemContent>
                  <ItemTitle>Version</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <ItemDescription>2.1.0</ItemDescription>
                </ItemActions>
              </Item>
              <Item>
                <ItemContent>
                  <ItemTitle>Build</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <ItemDescription>2026.09.25</ItemDescription>
                </ItemActions>
              </Item>
            </ItemGroup>
          </View>
        ),
      },
    ],
    usage: `<ItemGroup title="Account" footer="Signed in as jane@example.com">
  <Item onPress={openProfile}>
    <ItemMedia icon="user" />
    <ItemContent>
      <ItemTitle>Edit profile</ItemTitle>
    </ItemContent>
    <ItemActions>
      <Icon name="chevron-right" size={18} color="mutedForeground" />
    </ItemActions>
  </Item>
  <Item>
    <ItemMedia icon="bell" />
    <ItemContent>
      <ItemTitle>Notifications</ItemTitle>
    </ItemContent>
    <ItemActions>
      <Switch checked={enabled} onCheckedChange={setEnabled} />
    </ItemActions>
  </Item>
</ItemGroup>`,
  },

  StatCard: {
    summary:
      "Metric tile: label, large value, optional unit and change line. A Card, so use it for tiles in a scrolling metrics rail or one tappable metric.",
    variants: [
      {
        label: "up",
        render: () => (
          <View style={{ minWidth: 150 }}>
            <StatCard label="Revenue" value="48.2" unit="k" change={{ value: "+12.5%", direction: "up" }} />
          </View>
        ),
      },
      {
        label: "down",
        render: () => (
          <View style={{ minWidth: 150 }}>
            <StatCard label="Churn" value="1.9" unit="%" change={{ value: "-0.3%", direction: "down" }} />
          </View>
        ),
      },
      {
        label: "with icon",
        render: () => (
          <View style={{ minWidth: 150 }}>
            <StatCard label="NPS" value={62} icon="face-slightly-smiling" change={{ value: "+4", direction: "neutral" }} />
          </View>
        ),
      },
    ],
    usage: `<StatCard
  label="Revenue"
  value="48.2"
  unit="k"
  change={{ value: "+12.5%", direction: "up" }}
/>`,
  },
};

/** Detail content for a component id, or `null` when it isn't seeded yet. */
export function getComponentDetail(id: string): ComponentDetail | null {
  return COMPONENT_DETAILS[id] ?? null;
}

/** The import line every detail screen shows, seeded or not. */
export function importSnippet(id: string, importPath: string): string {
  return `import { ${id} } from "${importPath}";`;
}

/** Spacing between variant tiles — exported so the screen and tests agree. */
export const VARIANT_GAP = spacing.sm;
