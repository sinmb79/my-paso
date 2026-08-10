const MAX_ENCODED_DATA_URL_BYTES = 16 * 1024 * 1024;
const MAX_DECODED_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_SOURCE_DIMENSION = 8192;
const MAX_SOURCE_PIXELS = 40_000_000;
const MAX_LONGEST_EDGE = 1280;
const JPEG_QUALITY = 0.82;

type SupportedMimeType = "image/jpeg" | "image/png" | "image/webp";
type ImageDimensions = { width: number; height: number };
type WebpCanvas = { dimensions: ImageDimensions; animated: boolean };

export async function sanitizePhotoForLocalAI(input: string): Promise<string> {
  const dimensions = parsePhotoDataUrl(input);
  const image = await decodeImage(input);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;

  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    sourceWidth !== dimensions.width ||
    sourceHeight !== dimensions.height
  ) {
    throw new Error("Photo could not be decoded with valid dimensions.");
  }

  const scale = Math.min(1, MAX_LONGEST_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Photo could not be rendered for local AI.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

function parsePhotoDataUrl(input: string): ImageDimensions {
  if (input.length > MAX_ENCODED_DATA_URL_BYTES) {
    throw new Error("Photo data URL is too large.");
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]*)$/.exec(input);
  if (!match || match[0].length !== input.length) {
    throw new Error("Photo must be a valid JPEG, PNG, or WebP data URL.");
  }

  const mimeType = match[1] as SupportedMimeType;
  const bytes = decodeCanonicalBase64(match[2]);
  const dimensions = readImageDimensions(mimeType, bytes);
  if (!dimensions || !isWithinSourceLimits(dimensions)) {
    throw new Error("Photo has unsupported or unsafe source dimensions.");
  }

  return dimensions;
}

function decodeCanonicalBase64(payload: string): Uint8Array {
  if (
    payload.length === 0 ||
    payload.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)
  ) {
    throw new Error("Photo must contain canonical Base64 data.");
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const firstPadding = payload.indexOf("=");
  if (
    (firstPadding !== -1 && firstPadding !== payload.length - padding) ||
    (padding === 2 && base64Value(payload[payload.length - 3]) % 16 !== 0) ||
    (padding === 1 && base64Value(payload[payload.length - 2]) % 4 !== 0)
  ) {
    throw new Error("Photo must contain canonical Base64 data.");
  }

  let decoded: string;
  try {
    decoded = atob(payload);
  } catch {
    throw new Error("Photo must contain valid Base64 data.");
  }

  if (decoded.length > MAX_DECODED_IMAGE_BYTES) {
    throw new Error("Decoded photo is too large.");
  }

  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function base64Value(character: string | undefined): number {
  if (!character) {
    return -1;
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  return alphabet.indexOf(character);
}

function readImageDimensions(
  mimeType: SupportedMimeType,
  bytes: Uint8Array,
): ImageDimensions | null {
  switch (mimeType) {
    case "image/png":
      return readPngDimensions(bytes);
    case "image/jpeg":
      return readJpegDimensions(bytes);
    case "image/webp":
      return readWebpDimensions(bytes);
  }
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a ||
    readUint32BigEndian(bytes, 8) !== 13 ||
    readAscii(bytes, 12, 4) !== "IHDR"
  ) {
    return null;
  }

  return { width: readUint32BigEndian(bytes, 16), height: readUint32BigEndian(bytes, 20) };
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < bytes.length) {
    while (bytes[offset] === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0x00) {
      return null;
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > bytes.length) {
      return null;
    }
    const segmentLength = readUint16BigEndian(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null;
    }
    if (isJpegStartOfFrame(marker)) {
      if (segmentLength < 8) {
        return null;
      }
      return {
        height: readUint16BigEndian(bytes, offset + 3),
        width: readUint16BigEndian(bytes, offset + 5),
      };
    }
    offset += segmentLength;
  }

  return null;
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 20 ||
    readAscii(bytes, 0, 4) !== "RIFF" ||
    readAscii(bytes, 8, 4) !== "WEBP" ||
    readUint32LittleEndian(bytes, 4) !== bytes.length - 8
  ) {
    return null;
  }

  let offset = 12;
  let canvas: WebpCanvas | null = null;
  let bitstreamDimensions: ImageDimensions | null = null;
  let sawAlphaChunk = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      return null;
    }
    const chunkType = readAscii(bytes, offset, 4);
    const chunkLength = readUint32LittleEndian(bytes, offset + 4);
    const payloadOffset = offset + 8;
    const availableBytes = bytes.length - payloadOffset;
    const paddingBytes = chunkLength % 2;
    if (
      chunkLength > availableBytes ||
      chunkLength > availableBytes - paddingBytes
    ) {
      return null;
    }

    if (chunkType === "VP8X") {
      if (offset !== 12 || canvas) {
        return null;
      }
      const parsedCanvas = readWebpCanvas(bytes, payloadOffset, chunkLength);
      if (!parsedCanvas || parsedCanvas.animated) {
        return null;
      }
      canvas = parsedCanvas;
    } else if (chunkType === "ANIM" || chunkType === "ANMF") {
      return null;
    } else if (chunkType === "ALPH") {
      if (!canvas || bitstreamDimensions || sawAlphaChunk || chunkLength < 1) {
        return null;
      }
      sawAlphaChunk = true;
    } else if (chunkType === "VP8 " || chunkType === "VP8L") {
      const parsedDimensions = readWebpBitstreamDimensions(
        chunkType,
        bytes,
        payloadOffset,
        chunkLength,
      );
      if (
        !parsedDimensions ||
        bitstreamDimensions ||
        (sawAlphaChunk && chunkType !== "VP8 ")
      ) {
        return null;
      }
      bitstreamDimensions = parsedDimensions;
    }

    offset = payloadOffset + chunkLength + paddingBytes;
  }

  if (!bitstreamDimensions) {
    return null;
  }
  if (
    canvas &&
    (canvas.dimensions.width !== bitstreamDimensions.width ||
      canvas.dimensions.height !== bitstreamDimensions.height)
  ) {
    return null;
  }

  return canvas?.dimensions ?? bitstreamDimensions;
}

function readWebpCanvas(
  bytes: Uint8Array,
  payloadOffset: number,
  chunkLength: number,
): WebpCanvas | null {
  if (chunkLength !== 10) {
    return null;
  }
  return {
    dimensions: {
      width: readUint24LittleEndian(bytes, payloadOffset + 4) + 1,
      height: readUint24LittleEndian(bytes, payloadOffset + 7) + 1,
    },
    animated: (bytes[payloadOffset]! & 0x02) !== 0,
  };
}

function readWebpBitstreamDimensions(
  chunkType: "VP8 " | "VP8L",
  bytes: Uint8Array,
  payloadOffset: number,
  chunkLength: number,
): ImageDimensions | null {
  if (chunkType === "VP8L") {
    if (chunkLength < 5 || bytes[payloadOffset] !== 0x2f) {
      return null;
    }
    const packed = readUint32LittleEndian(bytes, payloadOffset + 1);
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >>> 14) & 0x3fff) + 1,
    };
  }
  if (
    chunkLength < 10 ||
    bytes[payloadOffset + 3] !== 0x9d ||
    bytes[payloadOffset + 4] !== 0x01 ||
    bytes[payloadOffset + 5] !== 0x2a
  ) {
    return null;
  }
  return {
    width: readUint16LittleEndian(bytes, payloadOffset + 6) & 0x3fff,
    height: readUint16LittleEndian(bytes, payloadOffset + 8) & 0x3fff,
  };
}

function isWithinSourceLimits({ width, height }: ImageDimensions): boolean {
  return (
    width > 0 &&
    height > 0 &&
    width <= MAX_SOURCE_DIMENSION &&
    height <= MAX_SOURCE_DIMENSION &&
    width * height <= MAX_SOURCE_PIXELS
  );
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function readUint16BigEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! * 0x1000000 +
    (bytes[offset + 1]! << 16) +
    (bytes[offset + 2]! << 8) +
    bytes[offset + 3]!
  );
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! +
    (bytes[offset + 1]! << 8) +
    (bytes[offset + 2]! << 16) +
    bytes[offset + 3]! * 0x1000000
  );
}

function decodeImage(input: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Photo could not be decoded."));
    image.src = input;
  });
}
