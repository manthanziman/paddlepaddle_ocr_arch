import sharp from 'sharp';
import { getPaddleOcrEngine } from './OCRWorker.js';
import { correctOrientation } from './preprocessing/orientation.js'
import { extractFields } from './DocumentFieldExtractor.js'

const MIN_CONFIDENCE = 0.7;

function bufferToArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Run OCR on an image.
 * @param {Buffer|string} input - Image buffer or file path.
 * @param {object} options - Optional per-call overrides (e.g. { recognize: {...} }).
 * @param {function} logger - Operational logger; never receives document content.
 * @returns {Promise<{ text: string, detections: Array<{text:string, box:{x:number,y:number,width:number,height:number}, confidence:number}>, confidence: number, processingTimeMs: number }>}
 */
export async function runOcrOnBuffer(input, options = {}, logger = () => {}) {
  const start = Date.now();
  let docType = (options && options.documentType) ? String(options.documentType).toUpperCase() : 'UNKNOWN';

  logger('preprocessing:start');
  const { corrected, detectedAngle, confidence: orientationConfidence } = await correctOrientation(input);

  const engine = getPaddleOcrEngine();

  const preprocessed = await sharp(corrected)
    .grayscale()
    // .normalize()
    .blur(docType === 'VISA' ? 2 : 1)
    .sharpen(1)
    .png()
    .toBuffer();
  logger('preprocessing:done');

  logger('ocr:start');

  const { results } = await engine.recognize(bufferToArrayBuffer(preprocessed), {
    flatten: true,
    ...(options.recognize || {}),
  });
  console.log(results)
  logger('ocr:done');

  const detections = results
    .filter((r) => r.confidence >= MIN_CONFIDENCE)
    .map((r) => ({ text: r.text, box: r.box, confidence: r.confidence }));

    console.log(detections)
  const confidence = detections.length
    ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
    : 0;

  const fields = extractFields({text: detections.map((d) => d.text).join(' '), detections : detections}, docType);

  return {
    text: detections.map((d) => d.text).join(' '),
    detections,
    fields,
    confidence: Math.min(1, Math.max(0, confidence)),
    processingTimeMs: Date.now() - start,
  };
}