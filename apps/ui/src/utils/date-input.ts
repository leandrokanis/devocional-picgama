// Native date inputs report partial typing as "" or years like 0005; only a full date with a real year counts.
export const isCompleteDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1900;
