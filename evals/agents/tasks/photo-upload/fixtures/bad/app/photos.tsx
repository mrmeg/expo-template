import { useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";
import { Card, Item } from "@mrmeg/expo-ui/components";

export default function PhotosScreen() {
  const [uris, setUris] = useState<string[]>([]);

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const body = new FormData();
      body.append("file", { uri: asset.uri, name: "photo.jpg", type: "image/jpeg" } as never);
      await fetch("https://api.example.test/api/media", { method: "POST", body });
      setUris((current) => [...current, asset.uri]);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Pressable onPress={pick}>
        <Camera size={20} />
        <Text>Choose photos</Text>
      </Pressable>
      <Card>
        <Item>
          <FlatList
            data={uris}
            numColumns={3}
            keyExtractor={(uri) => uri}
            renderItem={({ item }) => <Image source={{ uri: item }} style={{ width: 100, height: 100 }} />}
          />
        </Item>
      </Card>
    </View>
  );
}
