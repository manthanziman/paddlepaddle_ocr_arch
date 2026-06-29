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

export function formatMRZDate(value) {
  if (!/^\d{6}$/.test(value)) {
    return '';
  }

  const yy = Number(value.slice(0, 2));
  const mm = value.slice(2, 4);
  const dd = value.slice(4, 6);

  const currentYY =
    new Date().getFullYear() % 100;

  const year =
    yy > currentYY
      ? 1900 + yy
      : 2000 + yy;

  return `${dd}/${mm}/${year}`;
}