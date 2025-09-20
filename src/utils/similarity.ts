/**
 * 類似度計算ユーティリティ
 */

/**
 * コサイン類似度を計算する
 * @param vecA ベクトルA
 * @param vecB ベクトルB
 * @returns 類似度 (0〜1)
 */
export function calculateCosineSimilarity(
  vecA: number[],
  vecB: number[],
): number {
  if (vecA.length !== vecB.length) {
    throw new Error('ベクトルの次元が一致しません');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * ベクトルの正規化
 * @param vector 正規化対象のベクトル
 * @returns 正規化されたベクトル
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((val) => val / magnitude);
}

/**
 * ベクトルが有効かチェックする
 * @param vector チェック対象のベクトル
 * @returns 有効性
 */
export function isValidVector(vector: unknown): vector is number[] {
  return (
    Array.isArray(vector) &&
    vector.length > 0 &&
    vector.every(
      (val) => typeof val === 'number' && !isNaN(val) && isFinite(val),
    )
  );
}
