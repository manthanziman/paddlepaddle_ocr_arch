import {
  extractMRZ,
  parsePassportMRZ
} from './MRZParser.js';

export function extractPassportFields(text) {

  const mrz = extractMRZ(text);

  if (!mrz) {
    return {
      documentType: 'PASSPORT',

      name: '',
      sex: '',
      dob: '',
      nationality: '',
      documentNumber: '',
      expiryDate: ''
    };
  }

  return parsePassportMRZ(mrz);
}