import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

import { isNative } from "@/lib/native/platform";

export async function writeBackupFile(fileName: string, contents: string) {
  if (isNative()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: contents,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    return result.uri ?? null;
  }

  const blob = new Blob([contents], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);

  return fileName;
}

export async function readBackupFile(file: Blob) {
  return file.text();
}
