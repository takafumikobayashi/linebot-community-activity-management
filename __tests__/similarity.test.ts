/**
 * 類似度計算ユーティリティのテスト
 */

import {
  calculateCosineSimilarity,
  normalizeVector,
  isValidVector,
} from '../src/utils/similarity';

describe('similarity.ts', () => {
  describe('calculateCosineSimilarity', () => {
    it('同じベクトルの類似度は1.0になるべき', () => {
      const vectorA = [1, 2, 3];
      const vectorB = [1, 2, 3];

      const result = calculateCosineSimilarity(vectorA, vectorB);

      expect(result).toBeCloseTo(1.0, 10);
    });

    it('正反対のベクトルの類似度は-1.0になるべき', () => {
      const vectorA = [1, 0, 0];
      const vectorB = [-1, 0, 0];

      const result = calculateCosineSimilarity(vectorA, vectorB);

      expect(result).toBeCloseTo(-1.0, 10);
    });

    it('直交するベクトルの類似度は0.0になるべき', () => {
      const vectorA = [1, 0, 0];
      const vectorB = [0, 1, 0];

      const result = calculateCosineSimilarity(vectorA, vectorB);

      expect(result).toBeCloseTo(0.0, 10);
    });

    it('実際の類似度計算が正しく動作すべき', () => {
      const vectorA = [1, 2, 3];
      const vectorB = [4, 5, 6];

      const result = calculateCosineSimilarity(vectorA, vectorB);

      // 手動計算: dot = 1*4 + 2*5 + 3*6 = 32
      // normA = sqrt(1 + 4 + 9) = sqrt(14)
      // normB = sqrt(16 + 25 + 36) = sqrt(77)
      // similarity = 32 / (sqrt(14) * sqrt(77))
      const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));

      expect(result).toBeCloseTo(expected, 10);
    });

    it('ベクトルの次元が異なる場合、エラーをスローすべき', () => {
      const vectorA = [1, 2, 3];
      const vectorB = [4, 5];

      expect(() => {
        calculateCosineSimilarity(vectorA, vectorB);
      }).toThrow('ベクトルの次元が一致しません');
    });

    it('ゼロベクトルがある場合、0を返すべき', () => {
      const vectorA = [0, 0, 0];
      const vectorB = [1, 2, 3];

      const result = calculateCosineSimilarity(vectorA, vectorB);

      expect(result).toBe(0);
    });

    it('両方ゼロベクトルの場合、0を返すべき', () => {
      const vectorA = [0, 0, 0];
      const vectorB = [0, 0, 0];

      const result = calculateCosineSimilarity(vectorA, vectorB);

      expect(result).toBe(0);
    });

    it('小数点を含むベクトルでも正しく計算すべき', () => {
      const vectorA = [0.1, 0.2, 0.3];
      const vectorB = [0.4, 0.5, 0.6];

      const result = calculateCosineSimilarity(vectorA, vectorB);

      // 手動計算
      const dot = 0.1 * 0.4 + 0.2 * 0.5 + 0.3 * 0.6;
      const normA = Math.sqrt(0.01 + 0.04 + 0.09);
      const normB = Math.sqrt(0.16 + 0.25 + 0.36);
      const expected = dot / (normA * normB);

      expect(result).toBeCloseTo(expected, 10);
    });
  });

  describe('normalizeVector', () => {
    it('単位ベクトルを正しく生成すべき', () => {
      const vector = [3, 4];

      const result = normalizeVector(vector);

      // 元のベクトルの大きさは5（3-4-5の直角三角形）
      expect(result).toEqual([0.6, 0.8]);

      // 正規化されたベクトルの大きさは1
      const magnitude = Math.sqrt(result[0] ** 2 + result[1] ** 2);
      expect(magnitude).toBeCloseTo(1.0, 10);
    });

    it('既に単位ベクトルの場合、そのまま返すべき', () => {
      const vector = [1, 0, 0];

      const result = normalizeVector(vector);

      expect(result).toEqual([1, 0, 0]);
    });

    it('ゼロベクトルの場合、そのまま返すべき', () => {
      const vector = [0, 0, 0];

      const result = normalizeVector(vector);

      expect(result).toEqual([0, 0, 0]);
    });

    it('負の値を含むベクトルでも正しく正規化すべき', () => {
      const vector = [-3, 4];

      const result = normalizeVector(vector);

      expect(result).toEqual([-0.6, 0.8]);

      const magnitude = Math.sqrt(result[0] ** 2 + result[1] ** 2);
      expect(magnitude).toBeCloseTo(1.0, 10);
    });

    it('高次元ベクトルでも正しく正規化すべき', () => {
      const vector = [1, 1, 1, 1, 1]; // 大きさ = sqrt(5)

      const result = normalizeVector(vector);

      const expectedValue = 1 / Math.sqrt(5);
      expect(result).toEqual([
        expectedValue,
        expectedValue,
        expectedValue,
        expectedValue,
        expectedValue,
      ]);

      const magnitude = Math.sqrt(
        result.reduce((sum, val) => sum + val ** 2, 0),
      );
      expect(magnitude).toBeCloseTo(1.0, 10);
    });
  });

  describe('isValidVector', () => {
    it('有効な数値配列の場合、trueを返すべき', () => {
      const vector = [1, 2, 3, 4.5];

      const result = isValidVector(vector);

      expect(result).toBe(true);
    });

    it('空配列の場合、falseを返すべき', () => {
      const vector: number[] = [];

      const result = isValidVector(vector);

      expect(result).toBe(false);
    });

    it('数値以外が含まれる場合、falseを返すべき', () => {
      const vector = [1, 2, 'invalid', 4] as any;

      const result = isValidVector(vector);

      expect(result).toBe(false);
    });

    it('NaNが含まれる場合、falseを返すべき', () => {
      const vector = [1, 2, NaN, 4];

      const result = isValidVector(vector);

      expect(result).toBe(false);
    });

    it('Infinityが含まれる場合、falseを返すべき', () => {
      const vector = [1, 2, Infinity, 4];

      const result = isValidVector(vector);

      expect(result).toBe(false);
    });

    it('配列でない場合、falseを返すべき', () => {
      const notVector = 'not an array';

      const result = isValidVector(notVector);

      expect(result).toBe(false);
    });

    it('nullの場合、falseを返すべき', () => {
      const result = isValidVector(null);

      expect(result).toBe(false);
    });

    it('undefinedの場合、falseを返すべき', () => {
      const result = isValidVector(undefined);

      expect(result).toBe(false);
    });

    it('負の数を含む有効な配列の場合、trueを返すべき', () => {
      const vector = [-1, -2.5, 0, 3.14];

      const result = isValidVector(vector);

      expect(result).toBe(true);
    });

    it('単一要素の配列の場合、trueを返すべき', () => {
      const vector = [42];

      const result = isValidVector(vector);

      expect(result).toBe(true);
    });
  });
});
