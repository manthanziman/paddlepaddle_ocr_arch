export function extractAadhaarFields(ocrOutput) {
  const detections = ocrOutput?.detections ?? [];

  // Use detection lines whenever available
  const lines = detections.length
    ? detections
        .sort((a, b) => a.box.y - b.box.y)
        .map(d => d.text.trim())
        .filter(Boolean)
    : (typeof ocrOutput === 'string'
        ? ocrOutput
        : ocrOutput?.text || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
  console.log(lines)
  let name = '';
  let dob = '';
  let sex = '';
  let documentNumber = '';
  let address = '';

  //
  // Aadhaar Number
  //
  for (const line of lines) {
    const match = line.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);

    if (match) {
      documentNumber = match[0].replace(/\s/g, '');
      break;
    }
  }

  //
  // DOB
  //
  for (const line of lines) {
    const match = line.match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/);

    if (match) {
      dob = match[0];
      break;
    }
  }

  //
  // Gender
  //
  for (const line of lines) {
    if (/female/i.test(line)) {
      sex = 'Female';
      break;
    }

    if (/male/i.test(line)) {
      sex = 'Male';
      break;
    }

    if (/transgender/i.test(line)) {
      sex = 'Other';
      break;
    }
  }

  //
  // Address
  //
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;

    if (/address/i.test(text)) {
      const cleaned = text.replace(/address/i, '').replace(/[:.\-]/g, '').trim();
      if (cleaned && !/\d{4}\s?\d{4}\s?\d{4}/.test(cleaned) && !/\d{2}[/-]\d{2}[/-]\d{4}/.test(cleaned)) {
        address = cleaned;
        break;
      }
    }
  }

  //
  // Name
  //
  const ignoredKeywords = [
    'government',
    'india',
    'unique identification',
    'uidai',
    'aadhaar',
    'authority',
    'dob',
    'year of birth',
    'male',
    'female',
    'transgender',
    'address',
    'c/o',
    'care of',
    'vid',
    'enrolment',
    'download',
    'www',
    'help',
    'mobile'
  ];

  for (const line of lines) {
    const text = line.trim();
    const lower = text.toLowerCase();

    if (!text) continue;

    if (ignoredKeywords.some(keyword => lower.includes(keyword))) {
      continue;
    }

    // Skip Aadhaar number
    if (/\d{4}\s?\d{4}\s?\d{4}/.test(text)) {
      continue;
    }

    // Skip DOB/date lines
    if (/\d{2}[/-]\d{2}[/-]\d{4}/.test(text)) {
      continue;
    }

    // Skip lines containing digits
    if (/\d/.test(text)) {
      continue;
    }

    // Accept only alphabetic names
    if (/^[A-Za-z\s.'-]{3,}$/.test(text)) {
      name = text;
      break;
    }
  }

  return {
    documentType: 'AADHAAR',
    name,
    sex,
    dob,
    nationality: 'Indian',
    documentNumber,
    address,
    expiryDate: ''
  };
}