/**
 * @file metrics.js
 * Mathematical calculation of ML metrics: Accuracy, Precision, Recall, F1,
 * Confusion Matrix, Slot Extraction F1, and RAG retrieval Recall@K / MRR.
 */

/**
 * Calculates classification metrics for predictions vs ground truth.
 *
 * @param {Array<{ actual: string, predicted: string }>} records
 * @returns {{
 *   accuracy: number,
 *   precision: number,
 *   recall: number,
 *   f1: number,
 *   confusionMatrix: Record<string, Record<string, number>>,
 *   classes: string[],
 *   total: number
 * }}
 */
export function calculateClassificationMetrics(records) {
  if (!records || records.length === 0) {
    return { accuracy: 0, precision: 0, recall: 0, f1: 0, confusionMatrix: {}, classes: [], total: 0 };
  }

  const classesSet = new Set();
  records.forEach((r) => {
    classesSet.add(r.actual);
    classesSet.add(r.predicted);
  });
  const classes = Array.from(classesSet).sort();

  // Initialize confusion matrix: matrix[actual][predicted]
  const matrix = {};
  for (const c of classes) {
    matrix[c] = {};
    for (const p of classes) {
      matrix[c][p] = 0;
    }
  }

  let correct = 0;
  records.forEach((r) => {
    matrix[r.actual][r.predicted] = (matrix[r.actual][r.predicted] || 0) + 1;
    if (r.actual === r.predicted) correct += 1;
  });

  const accuracy = correct / records.length;

  // Macro-averaged Precision, Recall, and F1
  let sumPrecision = 0;
  let sumRecall = 0;
  let validClassesCount = 0;

  for (const cls of classes) {
    const tp = matrix[cls]?.[cls] || 0;
    // Sum across row = total actual instances of this class
    const actualTotal = Object.values(matrix[cls] || {}).reduce((a, b) => a + b, 0);
    // Sum down column = total predicted instances of this class
    let predictedTotal = 0;
    for (const c of classes) {
      predictedTotal += matrix[c]?.[cls] || 0;
    }

    if (actualTotal > 0) {
      validClassesCount += 1;
      const prec = predictedTotal > 0 ? tp / predictedTotal : 0;
      const rec = actualTotal > 0 ? tp / actualTotal : 0;
      sumPrecision += prec;
      sumRecall += rec;
    }
  }

  const macroPrecision = validClassesCount > 0 ? sumPrecision / validClassesCount : 0;
  const macroRecall = validClassesCount > 0 ? sumRecall / validClassesCount : 0;
  const macroF1 = (macroPrecision + macroRecall) > 0
    ? (2 * macroPrecision * macroRecall) / (macroPrecision + macroRecall)
    : 0;

  return {
    accuracy: Number((accuracy * 100).toFixed(2)),
    precision: Number((macroPrecision * 100).toFixed(2)),
    recall: Number((macroRecall * 100).toFixed(2)),
    f1: Number((macroF1 * 100).toFixed(2)),
    confusionMatrix: matrix,
    classes,
    total: records.length,
  };
}

/**
 * Calculates slot extraction metrics (Precision, Recall, F1, Exact Match) per slot.
 *
 * @param {Array<{ expectedSlots: object, extractedSlots: object }>} records
 * @returns {Record<string, { precision: number, recall: number, f1: number, exactMatch: number, total: number }>}
 */
export function calculateSlotMetrics(records) {
  if (!records || records.length === 0) return {};

  const slotTypes = ['amount', 'recipient', 'frequency', 'biller', 'category', 'percentage'];
  const results = {};

  for (const slot of slotTypes) {
    let tp = 0; // expected and extracted correctly
    let fp = 0; // extracted but not expected, or wrong value
    let fn = 0; // expected but not extracted
    let exactMatches = 0;
    let occurrences = 0;

    for (const r of records) {
      const expected = r.expectedSlots?.[slot];
      const extracted = r.extractedSlots?.[slot];

      if (expected !== undefined) {
        occurrences += 1;
        if (extracted !== undefined) {
          // Compare loosely for numbers and strings
          const isMatch = String(expected).toLowerCase() === String(extracted).toLowerCase();
          if (isMatch) {
            tp += 1;
            exactMatches += 1;
          } else {
            fp += 1;
            fn += 1;
          }
        } else {
          fn += 1;
        }
      } else if (extracted !== undefined) {
        fp += 1;
      }
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1.0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const exactMatchRate = occurrences > 0 ? exactMatches / occurrences : 1.0;

    if (occurrences > 0) {
      results[slot] = {
        precision: Number((precision * 100).toFixed(2)),
        recall: Number((recall * 100).toFixed(2)),
        f1: Number((f1 * 100).toFixed(2)),
        exactMatch: Number((exactMatchRate * 100).toFixed(2)),
        total: occurrences,
      };
    }
  }

  return results;
}

/**
 * Evaluates Out-Of-Distribution (OOD) / Unseen Intent handling.
 * Measures detection rate for unsupported queries and false alarm rate on valid queries.
 *
 * @param {Array<{ actual: string, predicted: string, isOod: boolean }>} records
 * @returns {{ knownAccuracy: number, unknownDetectionRate: number, totalOod: number, totalInDistribution: number }}
 */
export function calculateOodMetrics(records) {
  const oodRecords = records.filter((r) => r.isOod || r.actual === 'OOD_UNKNOWN');
  const inDistRecords = records.filter((r) => !r.isOod && r.actual !== 'OOD_UNKNOWN');

  // How many OOD items were correctly identified as unknown / rejected?
  const oodDetected = oodRecords.filter((r) => r.predicted === 'OOD_UNKNOWN' || r.predicted === 'unknown_ood' || r.predicted === 'unsupported_financial_scheme' || r.predicted === 'irrelevant').length;
  const unknownDetectionRate = oodRecords.length > 0 ? (oodDetected / oodRecords.length) * 100 : 100;

  // In-distribution accuracy
  const inDistCorrect = inDistRecords.filter((r) => r.actual === r.predicted).length;
  const knownAccuracy = inDistRecords.length > 0 ? (inDistCorrect / inDistRecords.length) * 100 : 100;

  return {
    knownAccuracy: Number(knownAccuracy.toFixed(2)),
    unknownDetectionRate: Number(unknownDetectionRate.toFixed(2)),
    totalOod: oodRecords.length,
    totalInDistribution: inDistRecords.length,
  };
}

export default {
  calculateClassificationMetrics,
  calculateSlotMetrics,
  calculateOodMetrics,
};
