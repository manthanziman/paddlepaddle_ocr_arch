export function extractDrivingLicenceFields(ocrOutput) {
  // Handle both direct text string and OCR object with detections
  const text = typeof ocrOutput === 'string' ? ocrOutput : ocrOutput?.text || '';
  const detections = ocrOutput?.detections || [];

  let name = '';
  let dob = '';
  let sex = '';
  let documentNumber = '';
  let expiryDate = '';

  // Extract DL Number - format: [2 letters][2 digits][space/dash][10 digits]
  const dlMatch = text.match(/DL\s*No\s*([A-Z]{2}\d{2}\s*\d{4}\s*\d{7})/i);
  if (dlMatch) {
    documentNumber = dlMatch[1].replace(/\s/g, '');
  }

  // Extract DOB - look for pattern with hyphens or slashes
  const dobMatch = text.match(/DOB[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
  if (dobMatch) {
    dob = dobMatch[1];
  }

  // Extract Expiry Date - look for "Valid Till" pattern
  const expiryMatch = text.match(/Valid\s*Till[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
  if (expiryMatch) {
    expiryDate = expiryMatch[1];
  }

  // Extract Name - use detections for better accuracy
  if (detections.length > 0) {
    const nameDetection = detections.find(d =>
      /^Name\s+[A-Za-z\s.'-]+$/i.test(d.text) &&
      d.confidence > 0.8
    );
    if (nameDetection) {
      name = nameDetection.text
        .replace(/^Name\s*/i, '')
        .trim();
    }
  }

  // Fallback: extract name from text
  if (!name) {
    const nameMatch = text.match(/Name\s+([A-Z][A-Za-z\s.'-]*?)(?:\s+[A-Z]\/|$|Add|PIN)/);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }
  }

  // Extract Gender - try common patterns
  const genderMatch = text.match(/\b(MALE|FEMALE|OTHER)\b/i);
  if (genderMatch) {
    const genderText = genderMatch[1].toUpperCase();
    if (genderText === 'FEMALE') sex = 'Female';
    else if (genderText === 'MALE') sex = 'Male';
    else sex = 'Other';
  }

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