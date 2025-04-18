import { Text, type TextProps } from "./Themed";

export function SerifText(props: TextProps) {
  return <Text {...props} variant="serif" />;
}

export function SansSerifText(props: TextProps) {
  return <Text {...props} variant="sansSerif" />;
}

export function SerifBoldText(props: TextProps) {
  return <Text {...props} variant="serif" fontWeight="bold" />;
}

export function SansSerifBoldText(props: TextProps) {
  return <Text {...props} variant="sansSerif" fontWeight="bold" />;
}
