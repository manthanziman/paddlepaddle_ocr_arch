export function extractEVisaFields(ocrResult) {
  // Supports:
  // 1. Full OCR response object
  // 2. Plain text string
  // 3. detections array

  const cleanText =
    typeof ocrResult === "string"
      ? ocrResult
      : ocrResult?.text ||
        (ocrResult?.detections || [])
          .map((d) => d.text)
          .join("\n") ||
        "";

  const lines = cleanText
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const getValue = (label) => {
    const index = lines.findIndex((l) =>
      l.toLowerCase().startsWith(label.toLowerCase())
    );

    if (index === -1) return "";

    const current = lines[index];

    // Label and value on same line
    const sameLine = current.replace(new RegExp(`^${label}\\s*:?`, "i"), "").trim();
    if (sameLine && sameLine.toLowerCase() !== label.toLowerCase()) {
      return sameLine;
    }

    // Otherwise next line
    return lines[index + 1] || "";
  };

  const applicationId = getValue("Application ID");
  const applicationStatus = getValue("Application Status");
  const etaNumber = getValue("ETA Number");
  const etaIssueDate = getValue("ETA Issue Date");

  const passportNumber = getValue("Passport Number");
  const name = getValue("Name");
  const dob = getValue("Date of Birth");
  const gender = getValue("Gender");
  const nationality = getValue("Nationality");

  const issueDate = getValue("e-Visa Issue Date");
  const expiryDate = getValue("e-Visa Expiry Date");
  const numberOfEntries = getValue("Number of Entries");
  const permittedDurationOfStay = getValue("Permitted duration of stay");

  const visaType =
    cleanText.match(/ETA\s+for\s+([^\n]+)/i)?.[1]?.trim() || "";

  let sex = "";

  if (/female/i.test(gender)) sex = "Female";
  else if (/male/i.test(gender)) sex = "Male";
  else if (gender) sex = "Other";

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
    permittedDurationOfStay,
  };
}