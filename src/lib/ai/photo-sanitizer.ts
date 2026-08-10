const SUPPORTED_IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_LONGEST_EDGE = 1280;
const JPEG_QUALITY = 0.82;

export async function sanitizePhotoForLocalAI(input: string): Promise<string> {
  if (!SUPPORTED_IMAGE_DATA_URL.test(input)) {
    throw new Error("Photo must be a valid JPEG, PNG, or WebP data URL.");
  }

  const image = await decodeImage(input);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;

  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
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

function decodeImage(input: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Photo could not be decoded."));
    image.src = input;
  });
}
