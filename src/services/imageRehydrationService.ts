/**
 * Image Rehydration Service
 * Downloads Firebase Storage images back into IndexedDB when loading chat history
 * This ensures images are available offline after sign-in
 */

import { imageStorageService } from './imageStorageService';

export class ImageRehydrationService {
  private rehydrationQueue: Set<string> = new Set();
  private isProcessing = false;

  /**
   * Check if a URL is a Firebase Storage URL
   */
  private isFirebaseStorageUrl(url: string): boolean {
    return url.startsWith('https://firebasestorage.googleapis.com/') || 
           url.includes('.firebasestorage.app');
  }

  /**
   * Check if a URL is a base64 data URL (already local)
   */
  private isBase64Url(url: string): boolean {
    return url.startsWith('data:image/');
  }

  /**
   * Download a Firebase Storage image and cache it in IndexedDB
   */
  private async downloadAndCache(firebaseUrl: string, imageId: string, userId: string, chatId: string): Promise<string> {
    try {
      console.log(`📥 Downloading image from Firebase: ${imageId}`);
      
      // Check if already in IndexedDB
      const cached = await imageStorageService.getImage(imageId);
      if (cached) {
        console.log(`✅ Image ${imageId} already in cache`);
        return cached.imageData;
      }

      // Download from Firebase Storage
      const response = await fetch(firebaseUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Convert blob to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Store in IndexedDB
      await imageStorageService.storeImage(
        imageId,
        userId,
        chatId,
        base64,
        'Rehydrated from Firebase', // prompt
        firebaseUrl // original Firebase URL
      );
      console.log(`✅ Downloaded and cached image: ${imageId}`);

      return base64;
    } catch (error) {
      console.error(`❌ Failed to download image ${imageId}:`, error);
      // Return original URL as fallback
      return firebaseUrl;
    }
  }

  /**
   * Extract image ID from Firebase Storage URL
   * URL format: https://firebasestorage.googleapis.com/v0/b/project.../users/userId/chats/chatId/images/imageId.png
   */
  private extractImageIdFromUrl(url: string): string | null {
    try {
      // Try to extract from path
      const match = url.match(/images\/([^?]+)/);
      if (match) {
        return match[1].replace('.png', '').replace('.jpg', '').replace('.jpeg', '');
      }

      // Fallback: use URL hash
      const hash = url.split('/').pop()?.split('?')[0] || url;
      return hash;
    } catch {
      return null;
    }
  }

  /**
   * Rehydrate images in a single message
   */
  async rehydrateMessageImages(message: any, userId: string, chatId: string): Promise<any> {
    if (!message.attachments || message.attachments.length === 0) {
      return message;
    }

    const rehydratedAttachments = await Promise.all(
      message.attachments.map(async (attachment: any) => {
        const url = typeof attachment === 'string' ? attachment : attachment?.url;
        
        if (!url) return attachment;

        // Skip if already base64 or already rehydrated
        if (this.isBase64Url(url)) {
          return attachment;
        }

        // If it's a Firebase URL, download and cache it
        if (this.isFirebaseStorageUrl(url)) {
          const imageId = this.extractImageIdFromUrl(url);
          if (!imageId) {
            console.warn('⚠️ Could not extract image ID from URL:', url);
            return attachment;
          }

          // Add to queue for background processing
          this.rehydrationQueue.add(`${imageId}:${url}:${userId}:${chatId}`);

          // Try to get from cache immediately (non-blocking)
          try {
            const cached = await imageStorageService.getImage(imageId);
            if (cached) {
              return typeof attachment === 'string' ? cached.imageData : { ...attachment, url: cached.imageData };
            }
          } catch {
            // Cache miss, will be downloaded in background
          }
        }

        return attachment;
      })
    );

    return {
      ...message,
      attachments: rehydratedAttachments
    };
  }

  /**
   * Rehydrate images in an entire chat history
   */
  async rehydrateChat(chat: any, userId: string): Promise<any> {
    const rehydratedMessages = await Promise.all(
      chat.messages.map((msg: any) => this.rehydrateMessageImages(msg, userId, chat.id))
    );

    return {
      ...chat,
      messages: rehydratedMessages
    };
  }

  /**
   * Rehydrate images in multiple chats
   */
  async rehydrateChats(chats: any[], userId: string): Promise<any[]> {
    console.log(`🔄 Starting image rehydration for ${chats.length} chats...`);
    
    const rehydratedChats = await Promise.all(
      chats.map(chat => this.rehydrateChat(chat, userId))
    );

    // Start background processing of queued images
    this.processQueue();

    return rehydratedChats;
  }

  /**
   * Process the rehydration queue in the background
   */
  private async processQueue() {
    if (this.isProcessing || this.rehydrationQueue.size === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Processing ${this.rehydrationQueue.size} images in background...`);

    const queue = Array.from(this.rehydrationQueue);
    this.rehydrationQueue.clear();

    // Process in batches of 3 to avoid overwhelming the network
    const BATCH_SIZE = 3;
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      const batch = queue.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (item) => {
          const [imageId, url, userId, chatId] = item.split(':');
          try {
            await this.downloadAndCache(url, imageId, userId, chatId);
          } catch (error) {
            console.error(`Failed to rehydrate ${imageId}:`, error);
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < queue.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Finished processing ${queue.length} images`);
    this.isProcessing = false;

    // If more items were added during processing, process them
    if (this.rehydrationQueue.size > 0) {
      setTimeout(() => this.processQueue(), 500);
    }
  }

  /**
   * Force immediate download of a specific image (for visible images)
   */
  async rehydrateImageNow(url: string, userId: string, chatId: string): Promise<string> {
    if (!this.isFirebaseStorageUrl(url)) {
      return url;
    }

    const imageId = this.extractImageIdFromUrl(url);
    if (!imageId) {
      return url;
    }

    return await this.downloadAndCache(url, imageId, userId, chatId);
  }

  /**
   * Clear the rehydration queue (useful when user signs out)
   */
  clearQueue() {
    this.rehydrationQueue.clear();
    this.isProcessing = false;
  }
}

export const imageRehydrationService = new ImageRehydrationService();
