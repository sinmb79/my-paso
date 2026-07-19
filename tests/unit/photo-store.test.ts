import {
  clearJournalPhotos,
  deleteJournalPhoto,
  getJournalPhotoUrl,
  readJournalPhotoData,
  restoreJournalPhotoData,
  saveJournalPhoto,
} from "@/lib/media/photo-store";

describe("journal photo store", () => {
  beforeEach(async () => {
    await clearJournalPhotos();
  });

  it("stores and retrieves web photos outside SQLite", async () => {
    const dataUrl = "data:image/jpeg;base64,cGFzby1waG90bw==";

    const photo = await saveJournalPhoto(dataUrl);

    expect(photo.id).toMatch(/^photo-.*\.jpg$/);
    await expect(getJournalPhotoUrl(photo.id)).resolves.toBe(dataUrl);

    await deleteJournalPhoto(photo.id);
    await expect(getJournalPhotoUrl(photo.id)).resolves.toBeNull();
  });

  it("rejects non-image data URLs", async () => {
    await expect(
      saveJournalPhoto("data:text/plain;base64,aGVsbG8="),
    ).rejects.toThrow("image data URL");
  });

  it("exports and restores a photo with its stable id", async () => {
    const dataUrl = "data:image/png;base64,cGFzby1wbmc=";
    const photo = await saveJournalPhoto(dataUrl);

    await expect(readJournalPhotoData(photo.id)).resolves.toBe(dataUrl);
    await deleteJournalPhoto(photo.id);
    await restoreJournalPhotoData(photo.id, dataUrl);

    await expect(getJournalPhotoUrl(photo.id)).resolves.toBe(dataUrl);
  });
});
