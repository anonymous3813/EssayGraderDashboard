export interface DiffLine {
  type: 'same' | 'added' | 'removed';
  text: string;
}

export function diffText(a: string, b: string): DiffLine[] {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based line diff
  const aSet = new Set(aLines);
  const bSet = new Set(bLines);

  const allLines = [...new Set([...aLines, ...bLines])];
  const aIdx = new Map(aLines.map((l, i) => [l, i]));
  const bIdx = new Map(bLines.map((l, i) => [l, i]));

  let ai = 0;
  for (const line of bLines) {
    while (ai < aLines.length && aLines[ai] !== line) {
      result.push({ type: 'removed', text: aLines[ai] });
      ai++;
    }
    if (ai < aLines.length && aLines[ai] === line) {
      result.push({ type: 'same', text: line });
      ai++;
    } else {
      result.push({ type: 'added', text: line });
    }
  }
  while (ai < aLines.length) {
    result.push({ type: 'removed', text: aLines[ai++] });
  }

  return result.filter(l => l.text.trim() !== '' || l.type === 'same');
}