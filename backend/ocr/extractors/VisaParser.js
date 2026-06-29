import {
  extractMRZ,
  parseVisaMRZ
} from './MRZParser.js';

export function extractVisaFields(text) {

  const mrz = extractMRZ(text);
  console.log(mrz)
  if (!mrz) {
    return {
      documentType: 'VISA',

      name: '',
      sex: '',
      dob: '',
      nationality: '',
      documentNumber: '',
      expiryDate: ''
    };
  }

  return parseVisaMRZ(mrz);
}