// The values of the RTPI server whose type is not documented: text or
// numbers, depending on the request. Undefined when missing or unusable.

export function rtpiText(value: unknown): string | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text === "" ? undefined : text;
}

export function rtpiNumber(value: unknown): number | undefined {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim().replace(",", "."))
        : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}
