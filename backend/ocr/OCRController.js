import express from 'express';
import multer from 'multer';
import { validateFile } from './utils/FileValidationService.js';
import { runOcrOnBuffer } from './OCRService.js';
import { renderPdfToPngBuffers } from './preprocessing/PDFService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/ocr', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    const v = validateFile(file);
    if (!v.ok) return res.status(400).json({ success: false, error: v.reason });

    const documentType = (req.body && req.body.documentType) ? String(req.body.documentType).trim() : '';
    if (!documentType) return res.status(400).json({ success: false, error: 'documentType is required' });

    const start = Date.now();

    if (file.mimetype === 'application/pdf') {
      try {
        const pageBuffers = await renderPdfToPngBuffers(file.buffer, { dpi: 400 });

        if (!pageBuffers || !pageBuffers.length) return res.status(500).json({ success: false, error: 'Failed to render PDF pages' });

        const pageResults = [];
        for (let i = 0; i < pageBuffers.length; i++) {
          try {
            const r = await runOcrOnBuffer(pageBuffers[i], {documentType}, () => {});
            pageResults.push({ ...r, page: i + 1 });
          } catch (e) {
            console.error('OCR failed for PDF page', i, e && e.message); // continue other pages
          }
        }

        if (!pageResults.length) return res.status(500).json({ success: false, error: 'OCR failed for all PDF pages' });

        const combinedText = pageResults.map((p) => p.text || '').join('\n\n---PAGE---\n\n');
        const confidences = pageResults.map((p) => (typeof p.confidence === 'number' ? p.confidence : 0));
        const avgConfidence = confidences.reduce((s, v) => s + v, 0) / confidences.length;
        const detections = pageResults.flatMap((p) =>
          (p.detections || []).map((d) => ({ ...d, page: p.page }))
        );

        const mergedFields = {};
        for (const p of pageResults) {
          const f = p.fields || {};
          for (const k of Object.keys(f)) {
            if (!mergedFields[k] && f[k]) mergedFields[k] = f[k];
          }
        }

        return res.json({
          success: true,
          text: combinedText,
          fields : mergedFields,
          detections,
          confidence: Math.min(1, Math.max(0, avgConfidence || 0)),
          processingTimeMs: Date.now() - start,
        });
      } catch (e) {
        console.error('PDF processing failed:', e && e.message ? e.message : e);
        return res.status(500).json({ success: false, error: 'PDF processing failed' });
      }
    }

    const result = await runOcrOnBuffer(file.buffer, {documentType}, () => {});
    // console.log(result)
    return res.json({
      success: true,
      text: result.text,
      fields: result.fields,
      detections: result.detections,
      confidence: result.confidence,
      processingTimeMs: Date.now() - start,
    });
  } catch (err) {
    console.error('OCR processing failed:', err.message || err);
    return res.status(500).json({ success: false, error: 'OCR processing failed' });
  }
});

export default router;