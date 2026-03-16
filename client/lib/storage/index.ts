import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Storage utility layer providing typed helpers over AsyncStorage.
 * Works on both native (AsyncStorage) and web (localStorage polyfill).
 */

/**
 * Loads a string from storage.
 * @param key - The storage key
 * @returns The string value or null if not found
 */
export async function loadString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Saves a string to storage.
 * @param key - The storage key
 * @param value - The string value to save
 * @returns True if successful, false otherwise
 */
export async function saveString(key: string, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

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
 * Saves a value to storage as JSON.
 * @param key - The storage key
 * @param value - The value to serialize and save
 * @returns True if successful, false otherwise
 */
export async function save(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes a key from storage.
 * @param key - The storage key to remove
 */
export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Silently ignore errors
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

/**
 * Loads multiple keys at once.
 * @param keys - Array of keys to load
 * @returns Object with key-value pairs
 */
export async function loadMultiple<T extends Record<string, unknown>>(
  keys: string[]
): Promise<Partial<T>> {
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    const result: Record<string, unknown> = {};
    for (const [key, value] of pairs) {
      if (value !== null) {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      }
    }
    return result as Partial<T>;
  } catch {
    return {};
  }
}
