import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  EmptyState,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Screen,
  SkeletonText,
  TextInput,
} from "@mrmeg/expo-ui/components";
import { spacing } from "@mrmeg/expo-ui/constants";
import { fetchPeople, type Person } from "@/client/api/people";

export default function PeopleScreen() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setPeople(null);
    setFailed(false);
    fetchPeople(query)
      .then((result) => current && setPeople(result))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [query, attempt]);

  return (
    <Screen edges={["bottom"]} scroll padded={false} contentContainerStyle={{ gap: spacing.md }}>
      <View style={{ paddingHorizontal: spacing.screenPadding }}>
        <TextInput placeholder="Search people" value={query} onChangeText={setQuery} />
      </View>
      {failed ? (
        <EmptyState
          icon="circle-exclamation-point"
          title="Could not load people"
          actionLabel="Try again"
          onAction={() => setAttempt((count) => count + 1)}
        />
      ) : people === null ? (
        <View style={{ paddingHorizontal: spacing.screenPadding }}>
          <SkeletonText lines={4} />
        </View>
      ) : people.length === 0 ? (
        <EmptyState icon="info" title="No matches" description="Try a different search." />
      ) : (
        <ItemGroup title="People">
          {people.map((person) => (
            <Item key={person.id}>
              <ItemContent>
                <ItemTitle>{person.name}</ItemTitle>
                <ItemDescription>{person.role}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </Screen>
  );
}
