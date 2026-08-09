/**
 * Live component previews for the galleries.
 *
 * One entry per `COMPONENTS` id, keyed by that id. Kept out of `registry.ts`
 * on purpose: the registry stays serializable data (ids, import paths,
 * categories) that a script or a server route can read, while the JSX that
 * *renders* a component lives here. The alternative — a render function on each
 * registry entry — would make `registry.ts` a React module.
 *
 * Every preview is a real instance of the shipped component, not a mock: that's
 * the point of the gallery, and it means a component that regresses shows the
 * regression in the card. Previews are deliberately small and mostly
 * uncontrolled — a card is a glance, not a demo. The full kitchen sink
 * (`app/(main)/(demos)/showcase/index.tsx`) still owns the exhaustive variants.
 *
 * Components with no meaningful static preview (imperative APIs like `Alert`,
 * or overlays that only exist while open) render a small trigger or a static
 * stand-in instead. `PREVIEWS` is intentionally partial: a component with no
 * entry falls back to its import path in the gallery, so adding to the registry
 * never breaks a screen.
 */

import React from "react";
import { View } from "react-native";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@mrmeg/expo-ui/components/Accordion";
import { AnimatedView } from "@mrmeg/expo-ui/components/AnimatedView";
import { Avatar, AvatarGroup } from "@mrmeg/expo-ui/components/Avatar";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { BottomSheet } from "@mrmeg/expo-ui/components/BottomSheet";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mrmeg/expo-ui/components/Card";
import { Carousel } from "@mrmeg/expo-ui/components/Carousel";
import { Checkbox } from "@mrmeg/expo-ui/components/Checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@mrmeg/expo-ui/components/Collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@mrmeg/expo-ui/components/Dialog";
import { Drawer } from "@mrmeg/expo-ui/components/Drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@mrmeg/expo-ui/components/DropdownMenu";
import { EmptyState } from "@mrmeg/expo-ui/components/EmptyState";
import { Icon, type IconName } from "@mrmeg/expo-ui/components/Icon";
import { InputOTP } from "@mrmeg/expo-ui/components/InputOTP";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@mrmeg/expo-ui/components/Item";
import { Label } from "@mrmeg/expo-ui/components/Label";
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "@mrmeg/expo-ui/components/Popover";
import { Progress } from "@mrmeg/expo-ui/components/Progress";
import { RadioGroup, RadioGroupItem } from "@mrmeg/expo-ui/components/RadioGroup";
import { SectionHeader } from "@mrmeg/expo-ui/components/SectionHeader";
import { SegmentedControl } from "@mrmeg/expo-ui/components/SegmentedControl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mrmeg/expo-ui/components/Select";
import { Separator } from "@mrmeg/expo-ui/components/Separator";
import { Skeleton, SkeletonText } from "@mrmeg/expo-ui/components/Skeleton";
import { Slider } from "@mrmeg/expo-ui/components/Slider";
import { StatCard } from "@mrmeg/expo-ui/components/StatCard";
import { CaptionText, MonoText, SansSerifText, SerifText } from "@mrmeg/expo-ui/components/StyledText";
import { Switch } from "@mrmeg/expo-ui/components/Switch";
import { Tabs, TabsList, TabsTrigger } from "@mrmeg/expo-ui/components/Tabs";
import { TextInput } from "@mrmeg/expo-ui/components/TextInput";
import { Toggle } from "@mrmeg/expo-ui/components/Toggle";
import { ToggleGroup, ToggleGroupItem } from "@mrmeg/expo-ui/components/ToggleGroup";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mrmeg/expo-ui/components/Tooltip";
import { spacing } from "@mrmeg/expo-ui/constants";

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/** A row of previews that should wrap rather than overflow a narrow card. */
function Row({ children, gap = spacing.sm }: { children: React.ReactNode; gap?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap, justifyContent: "center" }}>
      {children}
    </View>
  );
}

/** A stack of previews, used where a component reads better vertically. */
function Stack({ children, gap = spacing.xs }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ gap, alignSelf: "stretch" }}>{children}</View>;
}

/**
 * Local state for the fully-controlled toggles (`Checkbox`, `Switch`,
 * `Toggle`), which have no uncontrolled mode. Small wrappers rather than
 * hard-coded `checked` values so the preview actually responds to a tap — a
 * dead switch in a gallery reads as a broken switch.
 */
function CheckboxPreview({ label }: { label: string }) {
  const [checked, setChecked] = React.useState(true);
  return <Checkbox checked={checked} onCheckedChange={setChecked} label={label} />;
}

function SwitchPreview({ initial }: { initial: boolean }) {
  const [checked, setChecked] = React.useState(initial);
  return <Switch checked={checked} onCheckedChange={setChecked} />;
}

function TogglePreview({ icon, initial }: { icon: IconName; initial: boolean }) {
  const [pressed, setPressed] = React.useState(initial);
  return (
    <Toggle pressed={pressed} onPressedChange={setPressed} size="sm" iconOnly>
      <Icon name={icon} size={14} color={pressed ? "foreground" : "mutedForeground"} />
    </Toggle>
  );
}

// ---------------------------------------------------------------------------
// Preview map
// ---------------------------------------------------------------------------

/**
 * `id` → preview element factory.
 *
 * A factory rather than an element so each card mounts its own instance:
 * shared elements would share the uncontrolled state of interactive previews
 * (two `Switch` cards toggling as one).
 */
export const PREVIEWS: Record<string, () => React.ReactElement> = {
  // ── Form ────────────────────────────────────────────────────────────────
  Button: () => (
    <Row>
      <Button preset="default" size="sm" text="Continue" />
      <Button preset="outline" size="sm" text="Cancel" />
    </Row>
  ),

  Checkbox: () => <CheckboxPreview label="Remember me" />,

  InputOTP: () => <InputOTP value="42" onChangeText={() => {}} length={4} />,

  Label: () => (
    <Stack>
      <Label nativeID="preview-email" required>Email</Label>
      <TextInput nativeID="preview-email" size="sm" placeholder="you@example.com" editable={false} />
    </Stack>
  ),

  RadioGroup: () => (
    <RadioGroup value="monthly" onValueChange={() => {}}>
      <RadioGroupItem value="monthly" label="Monthly" />
      <RadioGroupItem value="yearly" label="Yearly" />
    </RadioGroup>
  ),

  Select: () => (
    <Select>
      <SelectTrigger size="sm">
        <SelectValue placeholder="Select a plan" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="starter" label="Starter" />
        <SelectItem value="pro" label="Pro" />
      </SelectContent>
    </Select>
  ),

  Slider: () => <View style={{ alignSelf: "stretch" }}><Slider value={62} /></View>,

  Switch: () => (
    <Row>
      <SwitchPreview initial />
      <SwitchPreview initial={false} />
    </Row>
  ),

  TextInput: () => (
    <TextInput size="sm" defaultValue="hello@terlo.app" editable={false} />
  ),

  Toggle: () => (
    <Row gap={spacing.xs}>
      <TogglePreview icon="bold" initial />
      <TogglePreview icon="italic" initial={false} />
      <TogglePreview icon="underline" initial={false} />
    </Row>
  ),

  // ToggleGroupItem renders its children inside a Pressable, so each label needs
  // its own Text — a bare string throws "Text strings must be rendered within a
  // <Text> component".
  ToggleGroup: () => (
    <ToggleGroup type="single" value="left" onValueChange={() => {}} size="sm">
      {(["Left", "Center", "Right"] as const).map((label) => (
        <ToggleGroupItem key={label} value={label.toLowerCase()}>
          <SansSerifText>{label}</SansSerifText>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  ),

  // ── Feedback ────────────────────────────────────────────────────────────
  // Alert is an imperative API (`Alert.show`), so the preview is the trigger.
  Alert: () => <Button preset="outline" size="sm" text="Show alert" />,

  Badge: () => (
    <Row gap={spacing.xs}>
      <Badge text="Active" />
      <Badge variant="secondary" text="Draft" />
      <Badge variant="destructive" text="Failed" />
    </Row>
  ),

  EmptyState: () => (
    <EmptyState icon="inbox" title="No results yet" description="Try a different search." />
  ),

  Progress: () => (
    <Stack gap={spacing.sm}>
      <Progress value={64} />
      <Progress value={32} variant="accent" size="sm" />
    </Stack>
  ),

  Skeleton: () => (
    <Row>
      <Skeleton width={36} height={36} circle />
      <View style={{ flex: 1, minWidth: 80 }}><SkeletonText lines={2} /></View>
    </Row>
  ),

  // ── Navigation ──────────────────────────────────────────────────────────
  // AccordionTrigger lays its children out next to the chevron inside a
  // Pressable, so the title has to be a Text element, not a bare string.
  Accordion: () => (
    <Accordion type="single" collapsible defaultValue="billing" style={{ alignSelf: "stretch" }}>
      <AccordionItem value="billing">
        <AccordionTrigger>
          <SansSerifText>How does billing work?</SansSerifText>
        </AccordionTrigger>
        <AccordionContent>
          <SansSerifText>Monthly or yearly, cancel anytime.</SansSerifText>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="cancel">
        <AccordionTrigger>
          <SansSerifText>Can I cancel anytime?</SansSerifText>
        </AccordionTrigger>
        <AccordionContent>
          <SansSerifText>Yes — from settings.</SansSerifText>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),

  Collapsible: () => (
    <Collapsible defaultOpen style={{ alignSelf: "stretch" }}>
      <CollapsibleTrigger>
        <Row gap={spacing.xs}>
          <SansSerifText>Advanced options</SansSerifText>
          <Icon name="chevron-up" size={14} color="mutedForeground" />
        </Row>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SkeletonText lines={2} />
      </CollapsibleContent>
    </Collapsible>
  ),

  SegmentedControl: () => (
    <View style={{ alignSelf: "stretch" }}>
      <SegmentedControl values={["List", "Grid", "Map"]} defaultValue="List" />
    </View>
  ),

  Tabs: () => (
    <Tabs value="day" onValueChange={() => {}} variant="pill" style={{ alignSelf: "stretch" }}>
      <TabsList>
        <TabsTrigger value="day"><TabsTrigger.Text>Day</TabsTrigger.Text></TabsTrigger>
        <TabsTrigger value="week"><TabsTrigger.Text>Week</TabsTrigger.Text></TabsTrigger>
        <TabsTrigger value="month"><TabsTrigger.Text>Month</TabsTrigger.Text></TabsTrigger>
      </TabsList>
    </Tabs>
  ),

  // ── Overlay ─────────────────────────────────────────────────────────────
  // Overlays have nothing to show until opened, so each preview is the real
  // trigger wired to the real overlay — tappable straight from the card.
  BottomSheet: () => (
    <BottomSheet>
      <BottomSheet.Trigger asChild>
        <Button preset="outline" size="sm" text="Open sheet" />
      </BottomSheet.Trigger>
      <BottomSheet.Content>
        <BottomSheet.Handle />
        <BottomSheet.Body>
          <SansSerifText>A native sheet on iOS and Android, a modal on web.</SansSerifText>
        </BottomSheet.Body>
      </BottomSheet.Content>
    </BottomSheet>
  ),

  Dialog: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button preset="outline" size="sm" text="Delete project" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),

  Drawer: () => (
    <Drawer side="left" width={260}>
      <Drawer.Trigger asChild>
        <Button preset="outline" size="sm" text="Open drawer" />
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <SansSerifText>Navigation</SansSerifText>
        </Drawer.Header>
        <Drawer.Body>
          <SkeletonText lines={3} />
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  ),

  DropdownMenu: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button preset="outline" size="sm" text="Actions" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem><SansSerifText>Duplicate</SansSerifText></DropdownMenuItem>
        <DropdownMenuItem><SansSerifText>Rename</SansSerifText></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive"><SansSerifText>Delete</SansSerifText></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),

  Popover: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button preset="outline" size="sm" text="Filters" />
      </PopoverTrigger>
      <PopoverContent>
        <PopoverBody>
          <SkeletonText lines={2} />
        </PopoverBody>
      </PopoverContent>
    </Popover>
  ),

  Tooltip: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button preset="ghost" size="sm" text="Hover me" />
      </TooltipTrigger>
      <TooltipContent>
        <SansSerifText>Copy to clipboard</SansSerifText>
      </TooltipContent>
    </Tooltip>
  ),

  // ── Layout ──────────────────────────────────────────────────────────────
  AnimatedView: () => (
    <Row gap={spacing.xs}>
      {[0, 1, 2].map((index) => (
        <AnimatedView key={index} type="fadeSlideUp" delay={index * 120}>
          <Skeleton width={28} height={28} />
        </AnimatedView>
      ))}
    </Row>
  ),

  Avatar: () => (
    <AvatarGroup max={3} size="md">
      <Avatar name="Ada Lovelace" />
      <Avatar name="Grace Hopper" />
      <Avatar name="Alan Turing" />
      <Avatar name="Katherine Johnson" />
    </AvatarGroup>
  ),

  Card: () => (
    <Card style={{ alignSelf: "stretch" }}>
      <CardHeader>
        <CardTitle>Weekly report</CardTitle>
        <CardDescription>Updated 2h ago</CardDescription>
      </CardHeader>
      <CardContent>
        <SkeletonText lines={2} />
      </CardContent>
    </Card>
  ),

  Carousel: () => (
    <View style={{ alignSelf: "stretch" }}>
      <Carousel itemWidth={0.7} gap={spacing.sm} contentPadding={0} showDots={false}>
        {["Alpha", "Bravo", "Charlie"].map((label) => (
          <Card key={label}>
            <CardContent>
              <SansSerifText>{label}</SansSerifText>
            </CardContent>
          </Card>
        ))}
      </Carousel>
    </View>
  ),

  Item: () => (
    <View style={{ alignSelf: "stretch" }}>
      <Item>
        <ItemMedia icon="calendar" />
        <ItemContent>
          <ItemTitle>Design review</ItemTitle>
          <ItemDescription>Tomorrow · 10:00</ItemDescription>
        </ItemContent>
      </Item>
    </View>
  ),

  SectionHeader: () => (
    <View style={{ alignSelf: "stretch" }}>
      <SectionHeader eyebrow="Activity" title="Recent activity" description="The last seven days." />
    </View>
  ),

  Separator: () => (
    <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
      <Separator />
      <Separator variant="primary" size="lg" />
    </View>
  ),

  StatCard: () => (
    <View style={{ alignSelf: "stretch" }}>
      <StatCard
        label="Active users"
        value="2,481"
        change={{ value: "+8.2%", direction: "up" }}
      />
    </View>
  ),

  // ── Typography ──────────────────────────────────────────────────────────
  Icon: () => (
    <Row gap={spacing.sm}>
      {(["heart", "star", "clock", "mail", "zap"] as const).map((name) => (
        <Icon key={name} name={name} size={20} color="foreground" />
      ))}
    </Row>
  ),

  StyledText: () => (
    <Stack>
      <SansSerifText fontWeight="semibold">Sans semibold</SansSerifText>
      <SerifText>Serif regular</SerifText>
      <MonoText size="sm">Mono 12</MonoText>
      <CaptionText>Caption</CaptionText>
    </Stack>
  ),
};

/** Whether a component has a live preview, i.e. whether a card can render one. */
export function hasPreview(id: string): boolean {
  return id in PREVIEWS;
}

/** The preview element for a component id, or `null` when it has none. */
export function renderPreview(id: string): React.ReactElement | null {
  const factory = PREVIEWS[id];
  return factory ? factory() : null;
}
