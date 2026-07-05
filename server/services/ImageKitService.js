// services/ImageKitService.js
// Thin wrapper around the ImageKit SDK. All ImageKit calls in the module
// MUST go through here — never instantiate the SDK elsewhere.

import ImageKit from 'imagekit';
import { ApiError } from '../utils/apiResponse.js';

const requiredEnv = ['IMAGEKIT_PUBLIC_KEY', 'IMAGEKIT_PRIVATE_KEY', 'IMAGEKIT_URL_ENDPOINT'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    // Fail fast at boot rather than at the first upload attempt.
    console.error(`[ImageKitService] Missing required env var: ${key}`);
  }
}

const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

class ImageKitService {
  /**
   * @param {Buffer} fileBuffer
   * @param {string} originalName
   * @param {string} folder e.g. `/conversations/<conversationId>`
   */
  async upload(fileBuffer, originalName, folder = '/support-module') {
    try {
      const result = await imagekit.upload({
        file: fileBuffer,
        fileName: originalName,
        folder,
        useUniqueFileName: true,
      });
      return {
        fileId: result.fileId,
        fileName: result.name,
        url: result.url,
        thumbnail: result.thumbnailUrl || null,
        width: result.width || null,
        height: result.height || null,
        size: result.size,
      };
    } catch (err) {
      console.error('[ImageKitService] upload failed:', err.message);
      throw new ApiError(502, 'File upload failed. Please try again.');
    }
  }

  async delete(fileId) {
    try {
      await imagekit.deleteFile(fileId);
    } catch (err) {
      // Non-fatal — log and continue; a stray ImageKit file is cheaper than
      // blocking a user-facing delete/edit flow.
      console.error('[ImageKitService] delete failed for fileId', fileId, err.message);
    }
  }

  getAuthenticationParameters() {
    return imagekit.getAuthenticationParameters();
  }
}

export default new ImageKitService();
