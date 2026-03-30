/** Validate that a string is a YYYY-MM-DD or YYYY-MM-DD.patch spec version */
export function isValidSpecVersion(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(\.\d+)?$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}
