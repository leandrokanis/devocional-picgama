// Remembers the readings list filter (its URL query) for the tab, so leaving the list keeps it.
const STORAGE_KEY = 'devocional_readings_list_search';

export const readListSearch = (): string => {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

export const saveListSearch = (search: string) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, search);
  } catch {
    // Storage blocked: the filter still lives in the URL.
  }
};
