import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

import { isNative } from "@/lib/native/platform";

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Failed to read the selected image."));
    });
    reader.readAsDataURL(file);
  });
}

function requestWebPhotoSelection() {
  return new Promise<string | null>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        resolve(await readFileAsDataUrl(file));
      } catch (error) {
        reject(error);
      }
    });

    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

export async function takePhoto() {
  if (isNative()) {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      quality: 82,
      width: 1600,
      height: 1600,
      correctOrientation: true,
    });

    return photo.dataUrl ?? null;
  }

  return requestWebPhotoSelection();
}
