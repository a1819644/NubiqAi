// Server/services/imageCacheService.ts

interface ImageData {
  description: string;
  imageBase64: string;
  fileName: string;
  mimeType: string;
  createdAt: Date;
  metadata?: {
    width?: number;
    height?: number;
    dominantColors?: string[];
    objects?: string[];
  };
}

const imageCache = new Map<string, ImageData>();

// Simple unique ID generator
const generateImageId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const storeImage = (data: { 
  fileName: string, 
  imageBase64: string, 
  description: string,
  mimeType?: string,
  metadata?: ImageData['metadata']
}): { imageId: string, description: string } => {
  const imageId = generateImageId();
  
  const imageData: ImageData = {
    fileName: data.fileName,
    imageBase64: data.imageBase64,
    description: data.description,
    mimeType: data.mimeType || 'image/png',
    metadata: data.metadata,
    createdAt: new Date(),
  };

  imageCache.set(imageId, imageData);
  console.log(`🖼️ Stored image in cache. ID: ${imageId}, File: ${data.fileName}`);
  
  return { imageId, description: data.description };
};

export const getImage = (imageId: string): ImageData | undefined => {
  return imageCache.get(imageId);
};

export const deleteImage = (imageId: string): boolean => {
  return imageCache.delete(imageId);
};

export const listImages = (): { id: string, fileName: string, description: string, createdAt: Date }[] => {
  const images: { id: string, fileName: string, description: string, createdAt: Date }[] = [];
  imageCache.forEach((data, id) => {
    images.push({
      id,
      fileName: data.fileName,
      description: data.description,
      createdAt: data.createdAt,
    });
  });
  return images.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

// Auto-cleanup: Remove images older than 2 hours
setInterval(() => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  let deletedCount = 0;
  imageCache.forEach((data, id) => {
    if (data.createdAt.getTime() < twoHoursAgo) {
      imageCache.delete(id);
      deletedCount++;
    }
  });
  if (deletedCount > 0) {
    console.log(`🗑️ Auto-cleanup: Removed ${deletedCount} old images from cache`);
  }
}, 30 * 60 * 1000); // Run every 30 minutes
