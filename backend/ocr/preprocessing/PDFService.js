import { Buffer } from 'buffer';
import sharp from 'sharp';

// Render PDF buffer into array of PNG buffers (one per page) using mupdf WASM API.
export async function renderPdfToPngBuffers(pdfBuffer, opts = {}) {
	const dpi = typeof opts.dpi === 'number' ? opts.dpi : 400;
	if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) throw new Error('Invalid PDF buffer');

	let mupdf;
	try {
		mupdf = await import('mupdf');
	} catch (e) {
		throw new Error('Failed to import mupdf module: ' + (e && e.message));
	}

	let doc = null;
	const outBuffers = [];

	try {
		// Open PDFDocument using the mupdf API surface present in this package
		if (typeof mupdf.PDFDocument === 'function') {
			// constructor accepts a Buffer/ArrayBuffer
			doc = new mupdf.PDFDocument(pdfBuffer);
		} else if (mupdf.Document && typeof mupdf.Document.openDocument === 'function') {
			doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
		} else if (typeof mupdf.Document === 'function') {
			// some minimal builds might expose a Document factory
			doc = mupdf.Document(pdfBuffer, 'application/pdf');
		} else {
			throw new Error('Unsupported mupdf API surface; cannot open PDF document');
		}

		// get page count
		const pageCount = (typeof doc.countPages === 'function') ? doc.countPages() : (typeof doc.count === 'number' ? doc.count : 0);
		if (!pageCount || pageCount <= 0) throw new Error('PDF appears to have no pages');

		const scale = dpi / 72; // PDF points are 1/72 inch
		const matrix = mupdf.Matrix.scale(scale, scale);

		for (let i = 0; i < pageCount; i++) {
			let page = null;
			try {
				page = doc.loadPage(i);
				// Render page to Pixmap at requested DPI in RGB
				const pix = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true, 'View', 'CropBox');
				// Diagnostic info
				try {
					const w = typeof pix.getWidth === 'function' ? pix.getWidth() : undefined;
					const h = typeof pix.getHeight === 'function' ? pix.getHeight() : undefined;
					const xres = typeof pix.getXResolution === 'function' ? pix.getXResolution() : undefined;
					const yres = typeof pix.getYResolution === 'function' ? pix.getYResolution() : undefined;
					console.log(`PDF page ${i}: pixmap ${w}x${h} @ ${xres}x${yres}`);
				} catch (e) {}

				// Convert Pixmap to PNG buffer - prefer native asPNG()
				let nodeBuf = null;
				try {
					const pngBuf = pix.asPNG();
					if (Buffer.isBuffer(pngBuf)) nodeBuf = pngBuf;
					else if (pngBuf && (pngBuf instanceof Uint8Array || pngBuf.buffer instanceof ArrayBuffer)) nodeBuf = Buffer.from(pngBuf);
					// if native png is extremely small, fallback to raw pixel conversion below
					if (nodeBuf && nodeBuf.length > 1024) {
						console.log(`PDF page ${i}: produced native PNG ${nodeBuf.length} bytes`);
						outBuffers.push(nodeBuf);
						continue;
					}
				} catch (e) {
					// ignore and fall through to raw pixel fallback
				}

				// Fallback: convert raw pixmap pixels to PNG using sharp
				try {
					const width = typeof pix.getWidth === 'function' ? pix.getWidth() : undefined;
					const height = typeof pix.getHeight === 'function' ? pix.getHeight() : undefined;
					const comps = typeof pix.getNumberOfComponents === 'function' ? pix.getNumberOfComponents() : 3;
					const hasAlpha = typeof pix.getAlpha === 'function' ? !!pix.getAlpha() : (comps === 4);
					const channels = hasAlpha ? 4 : 3;
					const pixels = pix.getPixels();
					if (!width || !height || !pixels) throw new Error('Invalid pixmap raw data');
					const rawBuf = Buffer.from(pixels.buffer ? pixels.buffer : pixels);
					const pngFromRaw = await sharp(rawBuf, { raw: { width: width, height: height, channels } })
						.png({ compressionLevel: 9, force: true })
						.toBuffer();
					console.log(`PDF page ${i}: produced fallback PNG ${pngFromRaw.length} bytes (raw ${width}x${height} ch=${channels})`);
					outBuffers.push(pngFromRaw);
				} catch (e) {
					throw new Error('Failed to obtain PNG buffer from page: ' + (e && e.message));
				}
			} catch (e) {
				console.error(`Failed to render page ${i}:`, e && e.message ? e.message : e);
			}
		}

		if (!outBuffers.length) throw new Error('No pages rendered from PDF');
		return outBuffers;
	} finally {
		try {
			if (doc && typeof doc._drop === 'function') doc._drop();
			if (doc && typeof doc.delete === 'function') doc.delete();
			if (doc && typeof doc.close === 'function') doc.close();
		} catch (e) {}
	}
}

export default { renderPdfToPngBuffers };
