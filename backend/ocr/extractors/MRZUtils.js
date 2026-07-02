export function normalizeMRZLine(line = '') {
  return line
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[«»]/g, '<')
    .replace(/\|/g, '<')
    .replace(/[^A-Z0-9<]/g, '');
}

export function normalizeSex(value = '') {
  switch (value) {
    case 'M':
      return 'Male';

    case 'F':
      return 'Female';

    case '<':
      return 'Other';

    default:
      return '';
  }
}

export function formatMRZDate(value, type) {
  // Edge Case 1: Strict structural validation
  if (!/^\d{6}$/.test(value)) {
    return '';
  }

  const yy = Number(value.slice(0, 2));
  const mm = value.slice(2, 4);
  const dd = value.slice(4, 6);

  // Validate calendar bounds to prevent garbage input data (e.g., month 13 or day 32)
  const monthNum = Number(mm);
  const dayNum = Number(dd);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    return '';
  }

  const currentYear = new Date().getFullYear();
  const currentYY = currentYear % 100;
  const currentCentury = Math.floor(currentYear / 100) * 100;

  let year;

  if (type === 'birth') {
    // Edge Case 2: Human birthdate cannot be in the future relative to today
    if (yy > currentYY) {
      year = (currentCentury - 100) + yy; // Resolves to 19XX
    } else {
      year = currentCentury + yy;         // Resolves to 20XX
    }
  } else if (type === 'expiry') {
    // Edge Case 3: Passports are valid for max 10-15 years.
    // We allow a buffer threshold of 15 years into the future.
    const maxFutureExtension = 15;
    
    if (yy <= currentYY + maxFutureExtension) {
      year = currentCentury + yy;         // Active or recently expired passport (20XX)
    } else {
      year = (currentCentury - 100) + yy; // Highly outdated/historical document (19XX)
    }
  } else {
    // Fallback safeguard if type parameter is omitted or malformed
    throw new Error("Context type must be explicitly declared as 'birth' or 'expiry'.");
  }

  return `${dd}/${mm}/${year}`;
}
