import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Storage utility layer providing typed helpers over AsyncStorage.
 * Works on both native (AsyncStorage) and web (localStorage polyfill).
 */

/**
 * Loads a JSON-serialized value from storage.
 * @param key - The storage key
 * @returns The parsed value or null if not found/parse error
 */
export async function load<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Clears all keys from storage.
 * Use with caution - this removes everything.
 */
export async function clear(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch {
    // Silently ignore errors
  }
}

/**
 * Gets all keys in storage.
 * @returns Array of storage keys
 */
export async function getAllKeys(): Promise<readonly string[]> {
  try {
    return await AsyncStorage.getAllKeys();
  } catch {
    return [];
  }
}
