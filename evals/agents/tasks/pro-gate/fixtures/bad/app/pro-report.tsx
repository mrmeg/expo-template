import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Purchases from "react-native-purchases";
import { Lock } from "lucide-react-native";
import { Card, ItemGroup, Item } from "@mrmeg/expo-ui/components";

export default function ProReportScreen() {
  const [pro, setPro] = useState(false);

  useEffect(() => {
    Purchases.getCustomerInfo().then((info) => setPro(Boolean(info.entitlements.active.pro)));
  }, []);

  if (!pro) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Lock size={32} />
        <Pressable onPress={() => Purchases.getOfferings()}>
          <Text>Upgrade to Pro</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Card>
        <ItemGroup title="Report">
          <Item>
            <Text>Your report</Text>
          </Item>
        </ItemGroup>
      </Card>
    </View>
  );
}
