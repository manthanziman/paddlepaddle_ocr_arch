export function extractEVisaFields(ocrResult) {
  const detections = ocrResult?.detections ?? [];

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
    : (typeof ocrResult === 'string'
        ? ocrResult
        : ocrResult?.text || '')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

  function getValue(label) {
    const lowerLabel = label.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line.toLowerCase().startsWith(lowerLabel)) continue;

      //
      // Label : Value
      //
      const sameLine = line
        .replace(new RegExp(`^${label}\\s*:?`, "i"), "")
        .trim();

      if (sameLine && sameLine.toLowerCase() !== lowerLabel) {
        return sameLine;
      }

      //
      // Otherwise use next non-empty line
      //
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j]) return lines[j];
      }
    }

    return "";
  }

  //
  // Header
  //
  const visaType =
    lines.find(l => /^ETA\s+for/i.test(l))
      ?.replace(/^ETA\s+for\s*/i, "")
      .trim() || "";

  //
  // Personal Information
  //
  const passportNumber = getValue("Passport Number");
  const name = getValue("Name");
  const dob = getValue("Date of Birth");
  const gender = getValue("Gender");
  const nationality = getValue("Nationality");

  //
  // ETA
  //
  const applicationId = getValue("Application ID");
  const applicationStatus = getValue("Application Status");
  const etaNumber = getValue("ETA Number");
  const etaIssueDate = getValue("ETA Issue Date");

  //
  // Visa
  //
  const issueDate = getValue("e-Visa Issue Date");
  let expiryDate = getValue("e-Visa Expiry Date");
  const numberOfEntries = getValue("Number of Entries");
  const permittedDurationOfStay = getValue("Permitted duration of stay");

  //
  // Some samples omit expiry value.
  // Look at the line after the label if it is a date.
  //
  if (!expiryDate) {
    const idx = lines.findIndex(l =>
      /^e-?Visa\s+Expiry\s+Date/i.test(l)
    );

    if (idx !== -1) {
      for (let i = idx + 1; i < Math.min(lines.length, idx + 4); i++) {
        if (
          /\d{2}[\/-][A-Z]{3}[\/-]\d{4}/i.test(lines[i]) ||
          /\d{2}[\/-]\d{2}[\/-]\d{4}/.test(lines[i])
        ) {
          expiryDate = lines[i];
          break;
        }
      }
    }
  }

  //
  // Gender
  //
  let sex = "";

  if (/female/i.test(gender))
    sex = "Female";
  else if (/male/i.test(gender))
    sex = "Male";
  else if (gender)
    sex = "Other";

  return {
    documentType: "E_VISA",

    name,
    sex,
    dob,
    nationality,

    documentNumber: passportNumber,

    applicationId,
    applicationStatus,

    etaNumber,
    visaType,

    issueDate,
    etaIssueDate,
    expiryDate,

    numberOfEntries,
    permittedDurationOfStay
  };
}