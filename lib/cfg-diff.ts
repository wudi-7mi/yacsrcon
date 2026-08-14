export type CfgDiffLine = {
  kind: "same" | "add" | "remove";
  text: string;
};

export function buildCfgDiff(before: string, after: string): CfgDiffLine[] {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] ===
      newLines[newLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return [
    ...oldLines
      .slice(Math.max(0, prefix - 2), prefix)
      .map((text) => ({ kind: "same" as const, text })),
    ...oldLines
      .slice(prefix, oldLines.length - suffix)
      .map((text) => ({ kind: "remove" as const, text })),
    ...newLines
      .slice(prefix, newLines.length - suffix)
      .map((text) => ({ kind: "add" as const, text })),
    ...newLines
      .slice(
        newLines.length - suffix,
        Math.min(newLines.length, newLines.length - suffix + 2),
      )
      .map((text) => ({ kind: "same" as const, text })),
  ];
}
