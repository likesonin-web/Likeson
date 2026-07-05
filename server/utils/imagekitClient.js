// support-module/utils/imagekitClient.js
import ImageKit from 'imagekit';
import dotenv from 'dotenv';
dotenv.config();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

/**
 * uploadAttachment
 * @param {Buffer|string} fileData - Buffer or base64 string
 * @param {string} fileName
 * @param {string} folder - e.g. `/support-tickets/${ticketId}`
 */
export const uploadAttachment = async (fileData, fileName, folder) => {
  const res = await imagekit.upload({
    file: fileData,
    fileName,
    folder,
    useUniqueFileName: true,
  });
  return {
    imagekitFileId: res.fileId,
    url: res.url,
    thumbnailUrl: res.thumbnailUrl || null,
  };
};

export const deleteAttachment = async (imagekitFileId) => {
  try {
    await imagekit.deleteFile(imagekitFileId);
    return true;
  } catch (err) {
    console.error('[imagekit] delete failed:', err.message);
    return false;
  }
};

export default imagekit;