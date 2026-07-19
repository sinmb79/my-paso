import { Share } from "@capacitor/share";

import { isNative } from "@/lib/native/platform";

export async function shareBackupFile(uri: string, fileName: string) {
  if (!isNative()) {
    return false;
  }

  const availability = await Share.canShare();
  if (!availability.value) {
    return false;
  }

  await Share.share({
    title: `Hello! My Paso! 백업 - ${fileName}`,
    text: "내 기기에 보관하는 Hello! My Paso! 로컬 백업입니다.",
    files: [uri],
    dialogTitle: "백업 파일 보관하기",
  });

  return true;
}
