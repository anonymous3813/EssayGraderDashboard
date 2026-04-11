export interface DiffLine {
  type: 'same' | 'added' | 'removed';
  text: string;
}
export function diffText(a: string, b: string): DiffLine[] {
  const aLines = a.split('\n');
  const bLines = b.split('\n');

  // Map unique line content to a token ID
  // Lines with identical content get the same token,
  const lineToToken = new Map<string, number>();
  const getToken = (line: string) => {
    if (!lineToToken.has(line)) lineToToken.set(line, lineToToken.size);
    return lineToToken.get(line)!;
  };

  const aTokens = aLines.map(getToken);
  const bTokens = bLines.map(getToken);
  const m = aTokens.length;
  const n = bTokens.length;

  // LCS on token arrays
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = aTokens[i-1] === bTokens[j-1]
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }

  // Backtrack
  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aTokens[i-1] === bTokens[j-1]) {
      result.push({ type: 'same', text: aLines[i-1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      result.push({ type: 'added', text: bLines[j-1] });
      j--;
    } else {
      result.push({ type: 'removed', text: aLines[i-1] });
      i--;
    }
  }

  result.reverse();
  return result.filter(l => l.text.trim() !== '' || l.type === 'same');
}