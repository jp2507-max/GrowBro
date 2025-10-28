const store = new Map<string, string>();

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export const getItemAsync = jest.fn(
  async (key: string): Promise<string | null> => {
    return store.has(key) ? store.get(key)! : null;
  }
);

export const setItemAsync = jest.fn(
  async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  }
);

export const deleteItemAsync = jest.fn(async (key: string): Promise<void> => {
  store.delete(key);
});

export function __reset(): void {
  store.clear();
  getItemAsync.mockReset();
  setItemAsync.mockReset();
  deleteItemAsync.mockReset();
}
