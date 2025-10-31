// simple strength heuristic: 0..4
export type Strength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(pw: string): {
  score: Strength;
  label: string;
} {
  // use a number for intermediate calculations, cast to Strength on return
  let score = 0;
  if (!pw) return { score: 0 as Strength, label: "Too weak" };

  const length = pw.length;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum = /\d/.test(pw);
  const hasSym = /[^A-Za-z0-9]/.test(pw);
  const variety = [hasLower, hasUpper, hasNum, hasSym].filter(Boolean).length;

  if (length >= 8) score++;
  if (length >= 10 && variety >= 2) score++;
  if (length >= 12 && variety >= 3) score++;
  if (length >= 14 && variety >= 4) score++;
  const label =
    score === 0
      ? "Too weak"
      : score === 1
      ? "Weak"
      : score === 2
      ? "Fair"
      : score === 3
      ? "Strong"
      : "Very strong";

  const finalScore: Strength = Math.min(4, Math.max(0, score)) as Strength;
  return { score: finalScore, label };
}
