export function extractDrivingLicenceFields(ocrOutput) {
  const detections = ocrOutput?.detections ?? [];

  const lines = detections.length
    ? detections
        .sort((a, b) => {
          if (Math.abs(a.box.y - b.box.y) < 8) {
            return a.box.x - b.box.x;
          }
          return a.box.y - b.box.y;
        })
        .map(d => d.text.trim())
        .filter(Boolean)
    : (typeof ocrOutput === 'string'
        ? ocrOutput
        : ocrOutput?.text || '')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

  let name = '';
  let dob = '';
  let sex = '';
  let documentNumber = '';
  let expiryDate = '';

  for (const line of lines) {
    //
    // DL NUMBER
    //
    if (!documentNumber) {
      const match = line.match(
        /DL\s*No[:\s]*([A-Z]{2}\s*\d{2}\s*\d{5,})/i
      );

      if (match) {
        documentNumber = match[1].replace(/\s+/g, '');
        continue;
      }
    }

    //
    // DOB
    //
    if (!dob) {
      const match = line.match(
        /DOB[:：]?\s*(\d{2}[\/-]\d{2}[\/-]\d{4})/i
      );

      if (match) {
        dob = match[1];
        continue;
      }
    }

    //
    // EXPIRY
    //
    if (!expiryDate) {
      const match = line.match(
        /Valid\s*T(?:i)?l+l?[:：]?\s*(\d{2}[\/-]\d{2}[\/-]\d{4})/i
      );

      if (match) {
        expiryDate = match[1];
        continue;
      }
    }

    //
    // NAME
    //
    if (!name) {
      const match = line.match(/^Name[:\s]+(.+)$/i);

      if (match) {
        name = match[1]
          .replace(/[^\w\s.'-]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        continue;
      }
    }

    //
    // GENDER (rare on Indian DLs)
    //
    if (!sex) {
      if (/female/i.test(line)) {
        sex = 'Female';
      } else if (/male/i.test(line)) {
        sex = 'Male';
      } else if (/other/i.test(line)) {
        sex = 'Other';
      }
    }
  }

  //
  // Fallback DL number
  //
  if (!documentNumber) {
    for (const line of lines) {
      const match = line.match(/\b([A-Z]{2}\d{2}\d{11,})\b/);

      if (match) {
        documentNumber = match[1];
        break;
      }
    }
  }

  //
  // Remove spaces from DL number
  //
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