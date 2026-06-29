import { normalizeText }
from './utils/TextNormalizer.js';

import { extractPassportFields }
from './extractors/PassportParser.js';

import { extractAadhaarFields }
from './extractors/AadhaarParser.js';

import { extractDrivingLicenceFields } 
from './extractors/DLParser.js';

import { extractVisaFields } 
from './extractors/VisaParser.js';

import { extractEVisaFields }
from './extractors/eVisaParser.js';

export function extractFields(
  ocrOutput,
  hintDocType = ''
) {

  // const text =
  //   normalizeText(rawText);

  const documentType =
    String(hintDocType || '')
      .trim()
      .toUpperCase();

  switch (documentType) {

    case 'PASSPORT':
      return extractPassportFields(ocrOutput);
    
    case 'VISA':
      return extractVisaFields(ocrOutput);

    case 'EVISA':
      return extractEVisaFields(ocrOutput);

    case 'AADHAAR':
      return extractAadhaarFields(ocrOutput);
    
    case 'DRIVING LICENCE':
      return extractDrivingLicenceFields(ocrOutput);

    default:
      return {
        documentType: 'UNKNOWN',

        name: '',
        sex: '',
        dob: '',
        nationality: '',
        documentNumber: '',
        expiryDate: ''
      };
  }
}


