// A stand-in for the app's API client: the backend is not built yet.
export interface Person {
  id: string;
  name: string;
  role: string;
}

/** People whose name or role contains `query`; an empty query returns everyone. Rejects when the request fails. */
export async function fetchPeople(query: string): Promise<Person[]> {
  const everyone: Person[] = [
    { id: "1", name: "Ada Lovelace", role: "Engineer" },
    { id: "2", name: "Grace Hopper", role: "Admiral" },
  ];
  const needle = query.trim().toLowerCase();
  return everyone.filter((person) => `${person.name} ${person.role}`.toLowerCase().includes(needle));
}
