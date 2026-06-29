export function extractAadhaarFields(ocrOutput) {
  // Handle both direct text string and OCR object with detections
  const text = typeof ocrOutput === 'string' ? ocrOutput : ocrOutput?.text || '';
  const detections = ocrOutput?.detections || [];

  let name = '';
  let dob = '';
  let sex = '';
  let documentNumber = '';

  // Extract Aadhaar number - 12 digit pattern with optional spaces
  const aadhaarMatch = text.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
  if (aadhaarMatch) {
    documentNumber = aadhaarMatch[0].replace(/\s/g, '');
  }

  // Extract DOB - look for pattern DD/MM/YYYY
  const dobMatch = text.match(/\d{2}\/\d{2}\/\d{4}/);
  if (dobMatch) {
    dob = dobMatch[0];
  }

  // Extract Gender
  const genderMatch = text.match(/\b(MALE|FEMALE|TRANSGENDER)\b/i);
  if (genderMatch) {
    const genderText = genderMatch[1].toUpperCase();
    if (genderText === 'FEMALE') sex = 'Female';
    else if (genderText === 'MALE') sex = 'Male';
    else sex = 'Other';
  }

  // Extract Name - use detections if available for better accuracy
  if (detections.length > 0) {
    // Look for name-like detections (words with high confidence, no numbers/slashes)
    const nameDetection = detections.find(d =>
      /^[A-Za-z\s.'-]+$/.test(d.text) &&
      !d.text.includes('Government') &&
      !d.text.includes('India') &&
      !d.text.includes('Aadhaar') &&
      !d.text.includes('Authority') &&
      d.text.length > 3 &&
      d.confidence > 0.95
    );
    if (nameDetection) {
      name = nameDetection.text.trim();
    }
  }

  // Fallback: extract name from text before DOB if not found in detections
  if (!name && dob) {
    const dobIndex = text.indexOf(dob);
    if (dobIndex > 0) {
      const beforeDob = text.substring(0, dobIndex).trim();
      const nameMatch = beforeDob.match(/([A-Za-z\s.'-]+)(?:\s+C\/O|\s*$)/);
      if (nameMatch) {
        name = nameMatch[1].trim();
      }
    }
  }

  return {
    documentType: 'AADHAAR',
    name,
    sex,
    dob,
    nationality: 'Indian',
    documentNumber,
    expiryDate: ''
  };
}