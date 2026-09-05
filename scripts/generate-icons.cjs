const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Function to generate a basic solid color / patterned valid PNG file using pure Node.js built-in zlib
function createSolidPng(width, height, r, g, b, a = 255) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // Deflate
  ihdrData.writeUInt8(0, 11); // Filter: none
  ihdrData.writeUInt8(0, 12); // Interlace: none

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines: for each row, 1 filter byte (0) + width * 4 bytes
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Draw a nice blue gradient with a green accent checkmark area
      const isCorner = (x < 16 && y < 16) || (x > width - 16 && y < 16) || 
                       (x < 16 && y > height - 16) || (x > width - 16 && y > height - 16);
      const isInner = x >= width * 0.25 && x <= width * 0.75 && y >= height * 0.25 && y <= height * 0.75;
      
      if (isInner) {
        rawData[pxOffset] = 255;
        rawData[pxOffset + 1] = 255;
        rawData[pxOffset + 2] = 255;
        rawData[pxOffset + 3] = 255;
      } else {
        // Gradient from #1e3a8a to #0284c7
        const t = (x + y) / (width + height);
        rawData[pxOffset] = Math.round(30 + t * (2 - 30));
        rawData[pxOffset + 1] = Math.round(58 + t * (132 - 58));
        rawData[pxOffset + 2] = Math.round(138 + t * (199 - 138));
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  // CRC32
  let crc = 0xffffffff;
  for (let i = 0; i < body.length; i++) {
    crc = updateCrc(crc, body[i]);
  }
  crc = (crc ^ 0xffffffff) >>> 0;

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([length, body, crcBuf]);
}

// Precomputed CRC table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function updateCrc(crc, byte) {
  return crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
}

const pubDir = path.resolve(__dirname, '../public');
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createSolidPng(192, 192, 2, 132, 199));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createSolidPng(512, 512, 2, 132, 199));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createSolidPng(512, 512, 2, 132, 199));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createSolidPng(180, 180, 2, 132, 199));
fs.writeFileSync(path.join(pubDir, 'favicon.ico'), createSolidPng(32, 32, 2, 132, 199));

console.log('PNG icon assets generated successfully in /public');
