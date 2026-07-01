export function extractDrivingLicenceFields(ocrOutput) {
  const detections = ocrOutput?.detections ?? [];

  const lines = detections.length
    ? detections
        .sort((a, b) => a.box.y - b.box.y || (a.box.x ?? 0) - (b.box.x ?? 0))
        .map(d => d.text.trim())
        .filter(Boolean)
    : (typeof ocrOutput === 'string'
        ? ocrOutput
        : ocrOutput?.text || '')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

  // ---------- helpers ----------

  // Recognize lines that are themselves *labels* for other fields, so
  // look-ahead doesn't accidentally swallow the next field's label as a value.
  const OTHER_LABEL_RE =
    /^\s*(D\.?\s?L\.?\s?No\.?|Licen[cs]e\s*No\.?|Driving\s*Licen[cs]e\s*No\.?|D\.?\s?O\.?\s?B\.?|Date\s*of\s*Birth|Valid(ity)?\s*(Till|Upto|To|Through)?|Sex|Gender|Name|S\/O|D\/O|W\/O|Son\s*\/?\s*Wife\s*\/?\s*Daughter|Blood\s*Group|Address|Auth(orit)?y|COV|Class\s*of\s*Vehicle)\s*[:.\-]?\s*$/i;

  function looksLikeLabelOnly(line) {
    return OTHER_LABEL_RE.test(line);
  }

  // Search current + next N lines for a regex match, skipping bare-label lines.
  function findValueNear(startIdx, valueRe, lookahead = 2) {
    for (let i = startIdx; i <= startIdx + lookahead && i < lines.length; i++) {
      const line = lines[i];
      if (i !== startIdx && looksLikeLabelOnly(line)) continue;
      const m = line.match(valueRe);
      if (m) return m;
    }
    return null;
  }

  function normalizeDate(raw) {
    if (!raw) return '';
    // unify separators to '-'
    let d = raw.replace(/[.\/]/g, '-').trim();
    // fix common OCR confusions inside dates (O->0, I->1, S->5, l->1)
    d = d.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/[Ss]/g, '5');
    return d;
  }

  function cleanName(raw) {
    return raw
      .replace(/\b(S\/O|D\/O|W\/O|Son\s*of|Daughter\s*of|Wife\s*of).*$/i, '')
      .replace(/[^\w\s.'-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeDlNumber(raw) {
    let n = raw.replace(/\s|-/g, '').toUpperCase();
    // First two chars must be letters; fix common digit/letter confusion there
    const stateCode = n.slice(0, 2).replace(/0/g, 'O').replace(/1/g, 'I');
    // Remaining chars should be digits; fix common letter/digit confusion there
    const rest = n
      .slice(2)
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8');
    return stateCode + rest;
  }

  // ---------- field patterns ----------

  const DL_LABEL_RE = /D\.?\s?L\.?\s?No\.?|Licen[cs]e\s*No\.?|Driving\s*Licen[cs]e\s*No\.?/i;
  const DL_VALUE_RE = /([A-Z]{2}[\s-]?\d{2}[\s-]?\d{2,4}[\s-]?\d{6,11})/i;
  const DL_STANDALONE_RE = /\b([A-Z]{2}\d{13,15})\b/; // full 15-16 char no-space form
  const DL_SPLIT_PREFIX_RE = /^\s*([A-Z]{2}\d{2})\s*$/i; // e.g. "MH12" alone on a line
  const DL_SPLIT_SUFFIX_RE = /^\s*(\d{6,11})\s*$/;        // e.g. "20010149313" alone on a line

  const DOB_LABEL_RE = /D\.?\s?O\.?\s?B\.?|Date\s*of\s*Birth/i;
  const DATE_RE = /(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})/;

  const EXPIRY_LABEL_RE = /Valid(ity)?\s*(Till|Upto|To|Through)?/i;

  const NAME_LABEL_RE = /^\s*Name\b/i;

  const SEX_INLINE_RE = /\bSex\s*[:\-]?\s*([MFO])\b/i;
  const SEX_LABEL_RE = /^\s*(Sex|Gender)\b/i;
  const SEX_VALUE_RE = /\b(Male|Female|Other|M|F|O)\b/i;

  let name = '';
  let dob = '';
  let sex = '';
  let documentNumber = '';
  let expiryDate = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ---- DL Number ----
    if (!documentNumber) {
      if (DL_LABEL_RE.test(line)) {
        const inline = line.match(DL_VALUE_RE);
        if (inline) {
          documentNumber = normalizeDlNumber(inline[1]);
        } else {
          const m = findValueNear(i + 1, DL_VALUE_RE);
          if (m) documentNumber = normalizeDlNumber(m[1]);
        }
      }
    }

    // ---- DOB ----
    if (!dob && DOB_LABEL_RE.test(line)) {
      const inline = line.match(DATE_RE);
      if (inline) {
        dob = normalizeDate(inline[1]);
      } else {
        const m = findValueNear(i + 1, DATE_RE);
        if (m) dob = normalizeDate(m[1]);
      }
    }

    // ---- Expiry ----
    if (!expiryDate && EXPIRY_LABEL_RE.test(line)) {
      const inline = line.match(DATE_RE);
      if (inline) {
        expiryDate = normalizeDate(inline[1]);
      } else {
        const m = findValueNear(i + 1, DATE_RE);
        if (m) expiryDate = normalizeDate(m[1]);
      }
    }

    // ---- Name ----
    if (!name && NAME_LABEL_RE.test(line)) {
      const inline = line.replace(NAME_LABEL_RE, '').replace(/^[:\-\s]+/, '');
      if (inline && !looksLikeLabelOnly(inline)) {
        name = cleanName(inline);
      } else {
        for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
          if (looksLikeLabelOnly(lines[j])) continue;
          name = cleanName(lines[j]);
          break;
        }
      }
    }

    // ---- Sex ----
    if (!sex) {
      const inline = line.match(SEX_INLINE_RE);
      if (inline) {
        sex = { M: 'Male', F: 'Female', O: 'Other' }[inline[1].toUpperCase()];
      } else if (SEX_LABEL_RE.test(line)) {
        const rest = line.replace(SEX_LABEL_RE, '').replace(/^[:\-\s]+/, '');
        const m = rest.match(SEX_VALUE_RE) || findValueNear(i + 1, SEX_VALUE_RE, 1)?.[0]
          ? (rest.match(SEX_VALUE_RE) || [null, findValueNear(i + 1, SEX_VALUE_RE, 1)[1]])
          : null;
        if (m) {
          const v = m[1].toUpperCase();
          sex = v.startsWith('M') ? 'Male' : v.startsWith('F') ? 'Female' : 'Other';
        }
      }
    }
  }

  // ---------- fallbacks (whole-document scans) ----------

  if (!documentNumber) {
    const joined = lines.join(' ');
    const m = joined.match(DL_STANDALONE_RE) || joined.match(DL_VALUE_RE);
    if (m) documentNumber = normalizeDlNumber(m[1]);
  }

  // Reconstruct a DL number split across two adjacent lines
  // (e.g. "MH12" on one line, "20010149313" on the next).
  if (!documentNumber) {
    for (let i = 0; i < lines.length - 1; i++) {
      const prefix = lines[i].match(DL_SPLIT_PREFIX_RE);
      const suffix = lines[i + 1].match(DL_SPLIT_SUFFIX_RE);
      if (prefix && suffix) {
        documentNumber = normalizeDlNumber(prefix[1] + suffix[1]);
        break;
      }
    }
  }

  // DOB fallback: first two distinct dates on the card are usually DOB then
  // "Date of Issue"/expiry — but if we still have nothing, grab the first date.
  if (!dob) {
    const m = lines.join(' ').match(DATE_RE);
    if (m) dob = normalizeDate(m[1]);
  }

  documentNumber = documentNumber.replace(/\s+/g, '');

  return {
    documentType: 'DRIVING_LICENSE',
    name,
    sex,
    dob,
    nationality: 'Indian',
    documentNumber,
    expiryDate
  };
}