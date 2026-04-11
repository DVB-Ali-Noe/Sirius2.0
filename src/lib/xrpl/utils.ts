export function toHex(str: string): string {
  return Buffer.from(str).toString("hex").toUpperCase();
}

export function parseXrpToDrops(amountXrp: string): string {
  const parsed = parseFloat(amountXrp);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid XRP amount: ${amountXrp}`);
  }
  return String(Math.round(parsed * 1_000_000));
}
