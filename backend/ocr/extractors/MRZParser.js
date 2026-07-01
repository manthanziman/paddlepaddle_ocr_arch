import { parse } from 'mrz';
import { normalizeMRZLine, normalizeSex, formatMRZDate } from './MRZUtils.js';

const MRZ_FORMATS = [
  { lines: 3, length: 30, type: 'TD1' },
  { lines: 2, length: 36, type: 'TD2' },
  { lines: 2, length: 44, type: 'TD3' },
];

export function extractMRZ(ocrOutput) {
  // Handle both direct text string and OCR object with detections
  const text = typeof ocrOutput === 'string' ? ocrOutput : ocrOutput?.text || '';
  const detections = ocrOutput?.detections || [];

  // Extract MRZ lines from detections first (more reliable)
  let mrzLines = [];
  if (detections.length > 0) {
    mrzLines = detections
      .filter(d => d.text && d.text.includes('<') && (d.text.length >= 30))
      .map(d => normalizeMRZLine(d.text));
  }

  // Fallback: extract from text if no MRZ found in detections
  if (mrzLines.length === 0) {
    const lines = text
      .split('\n')
      .map(normalizeMRZLine)
      .filter(Boolean);
    mrzLines = lines;
  }

  // Try every window of N consecutive lines matching a known format
  for (const fmt of MRZ_FORMATS) {
    for (let i = 0; i <= mrzLines.length - fmt.lines; i++) {
      const window = mrzLines.slice(i, i + fmt.lines)

      // All lines in this window must match the expected length
      const lengthOk = window.every(l => {
        return l.length === fmt.length
      });
      if (!lengthOk) continue;

      try {
        const parsed = parse(window);
        let format = fmt.type;
        if (fmt.type === 'TD3' && window.length === 2 && window[0].length === 44) {
          const firstChar = window[0][0];

          if (firstChar === 'V') {
            format = 'MRV-A';
          } else if (firstChar === 'P') {
            format = 'TD3';
          }
        }
        
        if (parsed) {
          return {
            lines: window,
            format,
            parsed,
          };
        }
      } catch (e) {
        // Not a valid MRZ window, try next
      }
    }
  }

  return null;
}

export function parsePassportMRZ(mrz) {
  if (!mrz) return null;

  const { lines, parsed } = mrz;

  const rawFields = extractRawFields(lines, mrz.format);

  const fields = parsed?.fields || {};
  console.log(fields)
  const lastName  = fields.lastName  || rawFields.lastName;
  const firstName = fields.firstName || rawFields.firstName;

  return {
    documentType: 'PASSPORT',
    name: [firstName, lastName].filter(Boolean).join(' '),
    sex: fields.sex || normalizeSex(rawFields.sex),
    dob: formatMRZDate(fields.birthDate || rawFields.birthDate),
    nationality: fields.nationality || rawFields.nationality, // raw fallback handles UTO etc.
    documentNumber: (fields.documentNumber || rawFields.documentNumber || '').replace(/</g, ''),
    expiryDate: formatMRZDate(fields.expirationDate || rawFields.expirationDate),
  };
}

// Extract fields from raw MRZ lines by spec positions (no validation)
function extractRawFields(lines, format) {
  if (format === 'TD3' && lines.length === 2) {
    const [l1, l2] = lines;
    const nameField = l1.slice(5);
    const [surnameRaw = '', givenRaw = ''] = nameField.split('<<');

    return {
      documentCode: l1.slice(0, 1),
      lastName:     surnameRaw.replace(/</g, ' ').trim(),
      firstName:    givenRaw.replace(/</g, ' ').trim(),
      documentNumber: l2.slice(0, 9),
      nationality:  l2.slice(10, 13),
      birthDate:    l2.slice(13, 19),
      sex:          l2.slice(20, 21),
      expirationDate: l2.slice(21, 27),
    };
  }

  if (format === 'TD1' && lines.length === 3) {
    const [l1, l2, l3] = lines;
    const nameField = l3;
    const [surnameRaw = '', givenRaw = ''] = nameField.split('<<');

    return {
      documentCode:   l1.slice(0, 1),
      documentNumber: l1.slice(5, 14),
      birthDate:      l2.slice(0, 6),
      sex:            l2.slice(7, 8),
      expirationDate: l2.slice(8, 14),
      nationality:    l2.slice(15, 18),
      lastName:       surnameRaw.replace(/</g, ' ').trim(),
      firstName:      givenRaw.replace(/</g, ' ').trim(),
    };
  }

  return {};
}

export function parseVisaMRZ(mrz) {
  if (!mrz) return null;

  const { lines, parsed } = mrz;
  console.log(parsed)
  const rawFields = extractVisaRawFields(lines);

  const fields = parsed?.fields || {};

  const lastName =
    fields.lastName ||
    rawFields.lastName;

  const firstName =
    fields.firstName ||
    rawFields.firstName;

  return {
    documentType: 'VISA',

    name: [firstName, lastName]
      .filter(Boolean)
      .join(' '),

    sex:
      fields.sex ||
      normalizeSex(
        rawFields.sex
      ),

    dob:
      formatMRZDate(
        fields.birthDate ||
        rawFields.birthDate
      ),

    nationality:
      fields.nationality ||
      rawFields.nationality,

    documentNumber:
      (
        fields.documentNumber ||
        rawFields.documentNumber ||
        ''
      ).replace(/</g, ''),

    expiryDate:
      formatMRZDate(
        fields.expirationDate ||
        rawFields.expirationDate
      )
  };
}

function extractVisaRawFields(lines) {

  if (lines.length !== 2) {
    return {};
  }

  const [l1, l2] = lines;

  const nameField = l1.slice(4);

  const [
    surnameRaw = '',
    givenRaw = ''
  ] = nameField.split('<<');

  return {
    documentCode: l1.slice(0, 1),

    issuingState: l1.slice(1, 4),

    lastName:
      surnameRaw
        .replace(/</g, ' ')
        .trim(),

    firstName:
      givenRaw
        .replace(/</g, ' ')
        .trim(),

    documentNumber:
      l2.slice(0, 9),

    nationality:
      l2.slice(10, 13),

    birthDate:
      l2.slice(13, 19),

    sex:
      l2.slice(20, 21),

    expirationDate:
      l2.slice(21, 27),

    optionalData:
      l2.slice(28, 44)
  };
}