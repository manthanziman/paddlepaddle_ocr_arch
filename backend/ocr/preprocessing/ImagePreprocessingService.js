import sharp from 'sharp';

export async function cropLongAadhaarFront(buffer) {
  const meta = await sharp(buffer).metadata();

  const width = meta.width;
  const height = meta.height;

  const ratio = height / width;

  // Normal Aadhaar card
  if (ratio <= 2.0) {
    return buffer;
  }

  // Long Aadhaar letter
  const cropTop = Math.floor(height * 0.72);

  return sharp(buffer)
    .extract({
      left: 0,
      top: cropTop,
      width,
      height: height - cropTop,
    })
    .resize({
      width: 2500,
      fit: 'inside',
      kernel: sharp.kernel.lanczos3,
    })
    .normalize()
    .sharpen()
    .png()
    .toBuffer();

}

export async function preprocessBuffer(buffer, options = {}) {
  const opt = {
    targetWidth: 2500,
    ...options,
  };

  // We'll build a small set of intermediate previews for debugging.
  const previews = [];

  // Original
  try {
    previews.push({ name: 'original', data: `data:image/png;base64,${buffer.toString('base64')}` });
  } catch (e) {}

  // If requested, crop to the bottom region (useful for passport MRZ)
  let bufferToProcess = buffer;
  if (opt.cropAadhaar) {
    try {
      const buff = await cropLongAadhaarFront(buffer);
      previews.push({ name: 'smartcard_crop', data: `data:image/png;base64,${buff.toString('base64')}` });
      const meta = await sharp(buff).metadata();
      if (meta && meta.height && meta.width) {
        const leftFrac   = typeof opt.leftFraction   === 'number' ? opt.leftFraction   : 0.30;
        const topFrac    = typeof opt.topFraction    === 'number' ? opt.topFraction    : 0.12;
        const rightFrac  = typeof opt.rightFraction  === 'number' ? opt.rightFraction  : 0.97;
        const bottomFrac = typeof opt.bottomFraction === 'number' ? opt.bottomFraction : 0.88;

        const left   = Math.round(meta.width  * leftFrac);
        const top    = Math.round(meta.height * topFrac);
        const width  = Math.round(meta.width  * rightFrac)  - left;
        const height = Math.round(meta.height * bottomFrac) - top;

        const cropped = await  sharp(buff).extract({ left, top, width, height }).png().toBuffer();
        const processed = await sharp(cropped)
          .resize({
            width: 2500,
            fit: 'inside',
            withoutEnlargement: false,
            kernel: sharp.kernel.lanczos3
          })
          .greyscale()
          .normalise()
          .sharpen()
          .png()
          .toBuffer();
        previews.push({ name: 'aadhaar_crop', data: `data:image/png;base64,${processed.toString('base64')}` });
        bufferToProcess = processed;
      }
    } catch (e) {
      // If cropping fails, fall back to full image
      console.warn('Aadhaar crop failed, using full image', e && e.message);
      bufferToProcess = buffer;
    }
  }

  if (opt.cropEVisa) {
    try{
      const meta = await sharp(buffer).metadata();
      if (meta && meta.height && meta.width) {
        const leftFrac   = typeof opt.leftFraction   === 'number' ? opt.leftFraction   : 0.1;
        const topFrac    = typeof opt.topFraction    === 'number' ? opt.topFraction    : 0.35;
        const rightFrac  = typeof opt.rightFraction  === 'number' ? opt.rightFraction  : 0.88;
        const bottomFrac = typeof opt.bottomFraction === 'number' ? opt.bottomFraction : 0.75;

        const left   = Math.round(meta.width  * leftFrac);
        const top    = Math.round(meta.height * topFrac);
        const width  = Math.round(meta.width  * rightFrac)  - left;
        const height = Math.round(meta.height * bottomFrac) - top;

        const cropped = await  sharp(buffer).extract({ left, top, width, height }).png().toBuffer();
        const processed = await sharp(cropped)
          .resize({
            width: 4500,
            fit: 'inside',
            withoutEnlargement: false,
            kernel: sharp.kernel.lanczos3
          })
          .greyscale()
          .sharpen()
          .png()
          .threshold(150)
          .toBuffer();
        previews.push({ name: 'evisa_crop', data: `data:image/png;base64,${processed.toString('base64')}` });
        bufferToProcess = processed;
      }
    } catch (e) {
      // If cropping fails, fall back to full image
      console.warn('evisa crop failed, using full image', e && e.message);
      bufferToProcess = buffer;
    }
  }

  if(opt.cropDL){
    try {
      // const rot = sharp(buffer).rotate();
      const meta = await sharp(buffer).metadata();
      if (meta && meta.height && meta.width) {
        const leftFrac   = typeof opt.leftFraction   === 'number' ? opt.leftFraction   : 0.01;
        const topFrac    = typeof opt.topFraction    === 'number' ? opt.topFraction    : 0.12;
        const rightFrac  = typeof opt.rightFraction  === 'number' ? opt.rightFraction  : 0.80;
        const bottomFrac = typeof opt.bottomFraction === 'number' ? opt.bottomFraction : 0.75;

        const left   = Math.round(meta.width  * leftFrac);
        const top    = Math.round(meta.height * topFrac);
        const width  = Math.round(meta.width  * rightFrac)  - left;
        const height = Math.round(meta.height * bottomFrac) - top;

        const cropped = await  sharp(buffer).extract({ left, top, width, height }).png().toBuffer();
        const processed = await sharp(cropped)
          .resize({
            width: 2500,
            fit: 'inside',
            withoutEnlargement: false,
            kernel: sharp.kernel.lanczos3
          })
          .greyscale()
          .normalise()
          .sharpen()
          .png()
          .toBuffer();
        previews.push({ name: 'dl_crop', data: `data:image/png;base64,${processed.toString('base64')}` });
        bufferToProcess = processed;
      }
    } catch (e) {
      // If cropping fails, fall back to full image
      console.warn('DL crop failed, using full image', e && e.message);
      bufferToProcess = buffer;
    }
  }

  if (opt.cropMRZ) {
    try {
      const meta = await sharp(buffer).metadata();
      if (meta && meta.height && meta.width) {
        const fraction = typeof opt.mrzFraction === 'number' ? opt.mrzFraction : 0.25;
        const cropHeight =  Math.max(25,Math.round(meta.height * fraction));
        const top = Math.max(0, meta.height - cropHeight);
        const cropped = await  sharp(buffer).extract({ left: 0, top, width: meta.width, height: cropHeight }).png().toBuffer();
        const processed = await sharp(cropped)
        .resize({
          width: 4500,
          kernel: sharp.kernel.lanczos3
        })
        .extend({
          top: 750,
          bottom: 750,
          background: {
            r: 255,
            g: 255,
            b: 255,
            alpha: 255
          }
        })
        .grayscale()
        // .threshold(200)
        .sharpen()
        .png()
        .toBuffer();
        previews.push({ name: 'mrz_crop', data: `data:image/png;base64,${processed.toString('base64')}` });
        bufferToProcess = processed;
      }
    } catch (e) {
      // If cropping fails, fall back to full image
      console.warn('MRZ cropping failed, using full image', e && e.message);
      bufferToProcess = buffer;
    }
  }

  if(opt.blur){
    bufferToProcess = await sharp(bufferToProcess).blur(5).png().toBuffer()
    bufferToProcess = await sharp(bufferToProcess).threshold(110).png().toBuffer();
  }

  // Rotate (auto-orient)
  // const rotatedBuf = await sharp(bufferToProcess).rotate().png().toBuffer();
  // previews.push({ name: 'rotated', data: `data:image/png;base64,${rotatedBuf.toString('base64')}` });

  // Greyscale
  const greyBuf = await sharp(bufferToProcess).greyscale().png().toBuffer();
  previews.push({ name: 'greyscale', data: `data:image/png;base64,${greyBuf.toString('base64')}` });

  // Normalise
  // const normBuf = await sharp(greyBuf).normalise().png().toBuffer();
  // previews.push({ name: 'normalised', data: `data:image/png;base64,${normBuf.toString('base64')}` });

  // Possibly resize/upscale if smaller than target
  const metadata = await sharp(greyBuf).metadata();
  console.log({
    width: metadata.width,
    height: metadata.height,
  });
  let finalBuf = greyBuf;
  if (metadata.width && metadata.width < opt.targetWidth) {
    finalBuf = await sharp(greyBuf)
      .resize({ width: opt.targetWidth, fit: 'inside', withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    previews.push({ name: 'resized', data: `data:image/png;base64,${finalBuf.toString('base64')}` });
  }

  // Final output
  const outBuffer = finalBuf;

  return {
    buffer: outBuffer,
    skewAngle: 0,
    previews,
  };
}