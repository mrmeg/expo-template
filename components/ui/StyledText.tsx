import { Text, TextProps } from "react-native";

export function SansSerifText(props: TextProps) {
  return (
    <Text
      {...props}
      style={[props.style, { fontFamily: "sans-serif" }]}
    />
  );
}

export function MonoText(props: TextProps) {
  return (
    <Text
      {...props}
      style={[props.style, { fontFamily: "monospace" }]}
    />
  );
}