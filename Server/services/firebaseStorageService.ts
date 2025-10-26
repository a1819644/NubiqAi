import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { getStorageBucket, initializeFirebaseAdmin } from './firebaseAdmin';

/**
 * Firebase Storage Service
 * 
 * Manages image uploads to Firebase Cloud Storage with hierarchical structure:
 * users/{userId}/chats/{chatId}/images/{imageId}.png
 * 
 * This ensures:
 * - User data isolation
 * - Easy per-chat image management
 * - Future scalability for other media types
 * - Clean GDPR compliance (delete user folder)
 */

class FirebaseStorageService {
  private bucket: any; // Firebase Storage Bucket
  private initialized: boolean = false;

  constructor() {
    try {
      initializeFirebaseAdmin();
      const storage = getStorageBucket();
      
      if (storage) {
        this.bucket = storage.bucket();
        this.initialized = true;
        console.log('✅ Firebase Storage Service initialized');
        console.log(`📦 Using bucket: ${this.bucket.name}`);
      } else {
        console.warn('⚠️ Firebase Storage Service running without storage (operations will fail gracefully)');
        this.initialized = false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Storage Service:', error);
      this.initialized = false;
    }
  }

  /**
   * Upload an image to Firebase Storage
   * 
   * @param userId - User ID for folder structure
   * @param chatId - Chat ID for folder structure
   * @param imageBase64 - Base64-encoded image data (with or without data URI prefix)
   * @param imagePrompt - Optional prompt used to generate the image (for metadata)
   * @returns Download URL of the uploaded image
   */
  async uploadImage(
    userId: string,
    chatId: string,
    imageBase64: string,
    imagePrompt?: string
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('Firebase Storage Service not initialized');
    }

    try {
      // Generate unique image ID
      const imageId = uuidv4();
      
      // Remove data URI prefix if present (data:image/png;base64,...)
      const base64Data = imageBase64.includes(',') 
        ? imageBase64.split(',')[1] 
        : imageBase64;

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Construct hierarchical path: users/{userId}/chats/{chatId}/images/{imageId}.png
      const filePath = `users/${userId}/chats/${chatId}/images/${imageId}.png`;

      // Create file reference
      const file = this.bucket.file(filePath);

      // Upload with metadata (force simple upload to avoid resumable ECONNRESET)
      const saveOnce = async () => file.save(imageBuffer, {
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: {
            userId: userId,
            chatId: chatId,
            imageId: imageId,
            prompt: imagePrompt || '',
            uploadedAt: new Date().toISOString()
          }
        },
        resumable: false,  // 🔧 Avoid resumable upload instability for small images
        public: false,
        validation: 'md5'
      });

      // Minimal retry on transient network errors
      let attempts = 0;
      const maxAttempts = 3;
      while (true) {
        try {
          attempts++;
          await saveOnce();
          break;
        } catch (err: any) {
          const msg = String(err?.message || err);
          const code = (err?.code || '').toString();
          const retriable = msg.includes('ECONNRESET') || msg.includes('Retry limit exceeded') || code === 'ECONNRESET';
          if (!retriable || attempts >= maxAttempts) throw err;
          const backoff = 300 * attempts; // 300ms, 600ms
          console.warn(`⚠️ Upload transient error (${attempts}/${maxAttempts - 1}). Retrying in ${backoff}ms...`, msg);
          await new Promise(r => setTimeout(r, backoff));
        }
      }

      // Make the file publicly accessible (signed URL with long expiration)
      // Alternative: Use signed URLs for private access
      await file.makePublic();

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${filePath}`;

      console.log(`✅ Image uploaded successfully: ${filePath}`);
      console.log(`📷 Public URL: ${publicUrl}`);

      return publicUrl;

    } catch (error) {
      console.error('❌ Failed to upload image to Firebase Storage:', error);
      throw error;
    }
  }

  /**
   * Upload image with signed URL (private access)
   * 
   * Returns a signed URL that expires after a set time (default: 7 days)
   * Use this for sensitive images that shouldn't be publicly accessible
   * 
   * @param userId - User ID
   * @param chatId - Chat ID
   * @param imageBase64 - Base64 image data
   * @param imagePrompt - Optional prompt
   * @param expirationDays - Days until URL expires (default: 7)
   * @returns Signed URL with expiration
   */
  async uploadImageWithSignedUrl(
    userId: string,
    chatId: string,
    imageBase64: string,
    imagePrompt?: string,
    expirationDays: number = 7
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('Firebase Storage Service not initialized');
    }

    try {
      const imageId = uuidv4();
      const base64Data = imageBase64.includes(',') 
        ? imageBase64.split(',')[1] 
        : imageBase64;
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const filePath = `users/${userId}/chats/${chatId}/images/${imageId}.png`;
      const file = this.bucket.file(filePath);

      // Use simple upload here as well
      await file.save(imageBuffer, {
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: {
            userId: userId,
            chatId: chatId,
            imageId: imageId,
            prompt: imagePrompt || '',
            uploadedAt: new Date().toISOString()
          }
        },
        resumable: false,
        public: false
      });

      // Generate signed URL (expires in X days)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expirationDays);

      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: expirationDate
      });

      console.log(`✅ Image uploaded with signed URL: ${filePath}`);
      console.log(`🔒 Signed URL expires: ${expirationDate.toISOString()}`);

      return signedUrl;

    } catch (error) {
      console.error('❌ Failed to upload image with signed URL:', error);
      throw error;
    }
  }

  /**
   * Delete an image from Firebase Storage
   * 
   * @param userId - User ID
   * @param chatId - Chat ID
   * @param imageId - Image ID (UUID from file path)
   */
  async deleteImage(userId: string, chatId: string, imageId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase Storage Service not initialized');
    }

    try {
      const filePath = `users/${userId}/chats/${chatId}/images/${imageId}.png`;
      await this.bucket.file(filePath).delete();
      console.log(`🗑️ Image deleted: ${filePath}`);
    } catch (error) {
      console.error('❌ Failed to delete image:', error);
      throw error;
    }
  }

  /**
   * Delete all images for a specific chat
   * 
   * @param userId - User ID
   * @param chatId - Chat ID
   */
  async deleteChatImages(userId: string, chatId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase Storage Service not initialized');
    }

    try {
      const prefix = `users/${userId}/chats/${chatId}/images/`;
      const [files] = await this.bucket.getFiles({ prefix });

      if (files.length === 0) {
        console.log(`ℹ️ No images found for chat ${chatId}`);
        return;
      }

      await Promise.all(files.map((file: any) => file.delete()));
      console.log(`🗑️ Deleted ${files.length} images from chat ${chatId}`);
    } catch (error) {
      console.error('❌ Failed to delete chat images:', error);
      throw error;
    }
  }

  /**
   * Delete all images for a specific user (GDPR compliance)
   * 
   * @param userId - User ID
   */
  async deleteUserImages(userId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase Storage Service not initialized');
    }

    try {
      const prefix = `users/${userId}/`;
      const [files] = await this.bucket.getFiles({ prefix });

      if (files.length === 0) {
        console.log(`ℹ️ No images found for user ${userId}`);
        return;
      }

      await Promise.all(files.map((file: any) => file.delete()));
      console.log(`🗑️ Deleted ${files.length} images for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to delete user images:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics for a user
   * 
   * @param userId - User ID
   * @returns Statistics object with file count and total size
   */
  async getUserStorageStats(userId: string): Promise<{ fileCount: number; totalSizeBytes: number; totalSizeMB: number }> {
    if (!this.initialized) {
      throw new Error('Firebase Storage Service not initialized');
    }

    try {
      const prefix = `users/${userId}/`;
      const [files] = await this.bucket.getFiles({ prefix });

      let totalSize = 0;
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        totalSize += parseInt(metadata.size || '0');
      }

      return {
        fileCount: files.length,
        totalSizeBytes: totalSize,
        totalSizeMB: parseFloat((totalSize / (1024 * 1024)).toFixed(2))
      };
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      throw error;
    }
  }

  /**
   * Check if service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const firebaseStorageService = new FirebaseStorageService();
export default firebaseStorageService;
