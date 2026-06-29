// orientation.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ort from 'onnxruntime-node';
import sharp from 'sharp';

const PREPROCESS = {
  resizeShort: 256,
  cropSize: 224,
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
  scale: 1 / 255,
};

const CLASS_TO_ANGLE = [0, 90, 180, 270];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.resolve(__dirname, '../../model_config/PP-LCNet_x1_0_doc_ori.onnx');

let session = null;
let needsSoftmax = false;
let loadPromise = null; // guards against concurrent duplicate loads

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

async function preprocess(imageBuffer) {
  const cropSize = PREPROCESS.cropSize;
  const img = sharp(imageBuffer, { animated: false });
  const meta = await img.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) throw new Error('Invalid image buffer (zero width/height)');

  const scale = PREPROCESS.resizeShort / Math.min(width, height);
  const resizedW = Math.round(width * scale);
  const resizedH = Math.round(height * scale);

  const { data, info } = await img
    .resize(resizedW, resizedH, { fit: 'fill' })
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  // FAIL LOUDLY instead of silently corrupting — this is the bug that was here before.
  if (info.channels !== 3) {
    throw new Error(
      `Expected 3 channels after preprocessing, got ${info.channels}. ` +
      `This image's color format (grayscale/CMYK/etc.) isn't being normalized to RGB correctly.`
    );
  }

  const left = Math.floor((info.width - cropSize) / 2);
  const top = Math.floor((info.height - cropSize) / 2);
  if (left < 0 || top < 0) {
    throw new Error('Resized image is smaller than crop size — check resizeShort and cropSize');
  }

  const channels = info.channels; // = 3, now guaranteed
  const cropBuffer = Buffer.alloc(cropSize * cropSize * channels);
  for (let row = 0; row < cropSize; row++) {
    const srcStart = ((top + row) * info.width + left) * channels;
    const dstStart = row * cropSize * channels;
    data.copy(cropBuffer, dstStart, srcStart, srcStart + cropSize * channels);
  }

  const float = new Float32Array(3 * cropSize * cropSize);
  const [m0, m1, m2] = PREPROCESS.mean;
  const [s0, s1, s2] = PREPROCESS.std;
  const scaleFactor = PREPROCESS.scale;

  for (let i = 0; i < cropSize * cropSize; i++) {
    const r = cropBuffer[i * channels + 0] * scaleFactor;
    const g = cropBuffer[i * channels + 1] * scaleFactor;
    const b = cropBuffer[i * channels + 2] * scaleFactor;
    float[0 * cropSize * cropSize + i] = (r - m0) / s0;
    float[1 * cropSize * cropSize + i] = (g - m1) / s1;
    float[2 * cropSize * cropSize + i] = (b - m2) / s2;
  }

  return new ort.Tensor('float32', float, [1, 3, cropSize, cropSize]);
}

export function loadOrientationModel() {
  if (loadPromise) return loadPromise; // concurrent callers share one in-flight load
  loadPromise = (async () => {
    if (!fs.existsSync(MODEL_PATH)) {
      throw new Error(`Model file not found at resolved path: ${MODEL_PATH}`);
    }
    session = await ort.InferenceSession.create(MODEL_PATH);
    console.log('Orientation model loaded. inputNames=', session.inputNames, 'outputNames=', session.outputNames);

    const dummy = new Float32Array(1 * 3 * PREPROCESS.cropSize * PREPROCESS.cropSize);
    const tensor = new ort.Tensor('float32', dummy, [1, 3, PREPROCESS.cropSize, PREPROCESS.cropSize]);
    const outputs = await session.run({ [session.inputNames[0]]: tensor });
    const raw = Array.from(outputs[session.outputNames[0]].data || []);
    const sum = raw.reduce((a, b) => a + b, 0);
    needsSoftmax = !(raw.every((v) => v >= 0) && Math.abs(sum - 1) < 1e-2);
    console.log(needsSoftmax ? 'Model outputs logits — applying softmax in code.' : 'Model outputs are already probabilities.');

    return session;
  })();
  return loadPromise;
}

export async function detectOrientation(imageBuffer) {
  if (!session) await loadOrientationModel();
  const inputTensor = await preprocess(imageBuffer);
  const outputs = await session.run({ [session.inputNames[0]]: inputTensor });
  const raw = Array.from(outputs[session.outputNames[0]].data || []);
  const probs = needsSoftmax ? softmax(raw) : raw;

  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;

  return { angle: CLASS_TO_ANGLE[bestIdx], confidence: probs[bestIdx], probs };
}

export async function correctOrientation(imageBuffer) {
  const { angle, confidence } = await detectOrientation(imageBuffer);
  const correction = (360 - angle) % 360;
  const corrected = correction === 0 ? imageBuffer : await sharp(imageBuffer).rotate(correction).toBuffer();
  return { corrected, detectedAngle: angle, appliedCorrection: correction, confidence };
}