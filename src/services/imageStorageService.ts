/**
 * IndexedDB Image Storage Service
 * 
 * Provides fast local caching for generated images using IndexedDB.
 * IndexedDB can store 50MB-1GB+ of data (much larger than localStorage's 5-10MB).
 * 
 * Features:
 * - Store images locally for instant offline access
 * - Automatic cleanup of old images to prevent quota issues
 * - Cache Firebase Storage URLs for faster loading
 * - LRU (Least Recently Used) eviction strategy
 */

interface CachedImage {
  id: string;
  userId: string;
  chatId: string;
  imageData: string; // base64 or blob URL
  firebaseUrl?: string;
  prompt: string;
  timestamp: number;
  lastAccessed: number;
  size: number; // bytes
}

interface StorageStats {
  totalImages: number;
  totalSize: number;
  oldestImage: number;
  newestImage: number;
}

class ImageStorageService {
  private dbName = 'NubiqAI_ImageCache';
  private dbVersion = 1;
  private storeName = 'images';
  private db: IDBDatabase | null = null;
  private maxStorageSize = 50 * 1024 * 1024; // 50MB limit (configurable)
  private maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

  /**
   * Initialize IndexedDB connection
   */
  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('❌ Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized for image caching');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
          
          // Create indexes for efficient querying
          objectStore.createIndex('userId', 'userId', { unique: false });
          objectStore.createIndex('chatId', 'chatId', { unique: false });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          
          console.log('📦 Created IndexedDB object store for images');
        }
      };
    });
  }

  /**
   * Store an image in IndexedDB
   */
  async storeImage(
    id: string,
    userId: string,
    chatId: string,
    imageData: string,
    prompt: string,
    firebaseUrl?: string
  ): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('IndexedDB not initialized');

    const now = Date.now();
    const size = new Blob([imageData]).size;

    // Check if we need to cleanup old images first
    await this.ensureStorageSpace(size);

    const cachedImage: CachedImage = {
      id,
      userId,
      chatId,
      imageData,
      firebaseUrl,
      prompt,
      timestamp: now,
      lastAccessed: now,
      size,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.put(cachedImage);

      request.onsuccess = () => {
        console.log(`💾 Stored image in IndexedDB: ${id} (${(size / 1024).toFixed(1)}KB)`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to store image:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Retrieve an image from IndexedDB
   */
  async getImage(id: string): Promise<CachedImage | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        const image = request.result as CachedImage | undefined;
        
        if (image) {
          // Update last accessed time (LRU tracking)
          image.lastAccessed = Date.now();
          objectStore.put(image);
          console.log(`✅ Retrieved image from IndexedDB: ${id}`);
        }
        
        resolve(image || null);
      };

      request.onerror = () => {
        console.error('❌ Failed to retrieve image:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all images for a specific user
   */
  async getUserImages(userId: string): Promise<CachedImage[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const index = objectStore.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('❌ Failed to get user images:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all images for a specific chat
   */
  async getChatImages(chatId: string): Promise<CachedImage[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const index = objectStore.index('chatId');
      const request = index.getAll(chatId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('❌ Failed to get chat images:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete an image from IndexedDB
   */
  async deleteImage(id: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(id);

      request.onsuccess = () => {
        console.log(`🗑️ Deleted image from IndexedDB: ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to delete image:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete all images for a user
   */
  async deleteUserImages(userId: string): Promise<number> {
    const images = await this.getUserImages(userId);
    
    for (const image of images) {
      await this.deleteImage(image.id);
    }
    
    console.log(`🗑️ Deleted ${images.length} images for user ${userId}`);
    return images.length;
  }

  /**
   * Delete all images for a chat
   */
  async deleteChatImages(chatId: string): Promise<number> {
    const images = await this.getChatImages(chatId);
    
    for (const image of images) {
      await this.deleteImage(image.id);
    }
    
    console.log(`🗑️ Deleted ${images.length} images for chat ${chatId}`);
    return images.length;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    await this.init();
    if (!this.db) {
      return {
        totalImages: 0,
        totalSize: 0,
        oldestImage: 0,
        newestImage: 0,
      };
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const images = request.result as CachedImage[];
        
        const stats: StorageStats = {
          totalImages: images.length,
          totalSize: images.reduce((sum, img) => sum + img.size, 0),
          oldestImage: images.length > 0 ? Math.min(...images.map(img => img.timestamp)) : 0,
          newestImage: images.length > 0 ? Math.max(...images.map(img => img.timestamp)) : 0,
        };

        console.log(`📊 IndexedDB Stats:`, {
          images: stats.totalImages,
          size: `${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`,
          maxSize: `${(this.maxStorageSize / 1024 / 1024).toFixed(0)}MB`,
        });

        resolve(stats);
      };

      request.onerror = () => {
        console.error('❌ Failed to get stats:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Ensure we have enough storage space by cleaning up old images
   * Uses LRU (Least Recently Used) + Age-based eviction
   */
  private async ensureStorageSpace(requiredSize: number): Promise<void> {
    const stats = await this.getStats();
    
    // Check if we need cleanup
    if (stats.totalSize + requiredSize <= this.maxStorageSize) {
      return; // Plenty of space
    }

    console.log('⚠️ Storage quota approaching, cleaning up old images...');

    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = async () => {
        const images = request.result as CachedImage[];
        const now = Date.now();

        // Sort by lastAccessed (oldest first) and timestamp (oldest first)
        images.sort((a, b) => {
          const ageWeight = 0.7;
          const accessWeight = 0.3;
          
          const aScore = (now - a.timestamp) * ageWeight + (now - a.lastAccessed) * accessWeight;
          const bScore = (now - b.timestamp) * ageWeight + (now - b.lastAccessed) * accessWeight;
          
          return bScore - aScore; // Oldest/least accessed first
        });

        let freedSpace = 0;
        let deletedCount = 0;

        // Delete images until we have enough space
        for (const image of images) {
          // Also delete images older than maxAge
          if (now - image.timestamp > this.maxAge || stats.totalSize - freedSpace + requiredSize > this.maxStorageSize) {
            await this.deleteImage(image.id);
            freedSpace += image.size;
            deletedCount++;
            
            if (stats.totalSize - freedSpace + requiredSize <= this.maxStorageSize * 0.8) {
              // Stop when we've freed 20% extra space
              break;
            }
          }
        }

        console.log(`✅ Cleaned up ${deletedCount} images, freed ${(freedSpace / 1024 / 1024).toFixed(2)}MB`);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to ensure storage space:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all cached images (useful for debugging or user logout)
   */
  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('🗑️ Cleared all cached images from IndexedDB');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to clear cache:', request.error);
        reject(request.error);
      };
    });
  }
}

// Export singleton instance
export const imageStorageService = new ImageStorageService();
