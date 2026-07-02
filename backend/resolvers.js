import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { runOcrOnBuffer } from './ocr/OCRService.js';

function normalizeFields(fields = {}) {
  const baseFields = {
    documentType: '',
    name: '',
    sex: '',
    documentNumber: '',
    dob: '',
    nationality: '',
    address: '',
    dateOfIssue: '',
    validTill: '',
    etaNumber: '',
    applicationStatus: '',
    issueDate: '',
    expiryDate: ''
  };

  const normalized = { ...baseFields, ...(fields || {}) };
  Object.keys(normalized).forEach((key) => {
    if (normalized[key] === undefined || normalized[key] === null) {
      normalized[key] = '';
    }
  });

  return normalized;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'db.json');

function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading DB:', err);
    return [];
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

export const resolvers = {
  Query: {
    documents: () => {
      return readDb().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    document: (_, { id }) => {
      const db = readDb();
      return db.find(doc => doc.id === id) || null;
    }
  },
  Mutation: {
    saveDocument: (_, { name, documentType, imageBase64, extractedData }) => {
      const db = readDb();
      const newDoc = {
        id: uuidv4(),
        name,
        documentType,
        imageBase64,
        extractedData,
        createdAt: new Date().toISOString()
      };
      db.push(newDoc);
      writeDb(db);
      return newDoc;
    },
    deleteDocument: (_, { id }) => {
      const db = readDb();
      const initialLength = db.length;
      const filteredDb = db.filter(doc => doc.id !== id);
      if (filteredDb.length < initialLength) {
        writeDb(filteredDb);
        return true;
      }
      return false;
    }
    ,
    processOCR: async (_, { imageBase64, documentType  }) => {
      try {
        // strip data:<mime>;base64, prefix if present
        const match = imageBase64.match(/^data:.*;base64,(.*)$/);
        const b64 = match ? match[1] : imageBase64;
        const buffer = Buffer.from(b64, 'base64');

        const result = await runOcrOnBuffer(buffer, { documentType }, ()=>{});
        return {
          success: true,
          text: result.text || '',
          hocr: result.hocr || '',
          tsv: result.tsv || '',
          confidence: result.confidence || 0,
          processingTimeMs: result.processingTimeMs || 0,
          fields: normalizeFields(result.fields)
        };
      } catch (err) {
        console.error('GraphQL OCR failed:', err);
          return {
            success: false,
            text: '',
            hocr: '',
            tsv: '',
            confidence: 0,
            processingTimeMs: 0,
            fields: normalizeFields()
          };
      }
    }
  }
};
