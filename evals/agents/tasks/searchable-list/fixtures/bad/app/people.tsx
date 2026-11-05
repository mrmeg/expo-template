import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import { Search } from "lucide-react-native";
import { Card, Item, ItemTitle } from "@mrmeg/expo-ui/components";
import { fetchPeople, type Person } from "@/client/api/people";

export default function PeopleScreen() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);

  useEffect(() => {
    fetchPeople(query).then(setPeople);
  }, [query]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Search size={18} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Search" />
      {people === null ? <ActivityIndicator /> : null}
      <Card>
        <FlatList
          data={people ?? []}
          keyExtractor={(person) => person.id}
          renderItem={({ item }) => (
            <Item>
              <ItemTitle>{item.name}</ItemTitle>
              <Text>{item.role}</Text>
            </Item>
          )}
        />
      </Card>
    </View>
  );
}
