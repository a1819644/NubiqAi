import React, { useState } from 'react';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import { Download, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from './components/ui/button';
import { toast } from 'sonner';
import { copyToClipboard } from './utils/clipboard';

interface ImageMessageProps {
  imageUrl: string;
  caption?: string;
}

export function ImageMessage({ imageUrl, caption }: ImageMessageProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'generated-image.jpg';
    link.click();
  };

  const handleOpenInNewTab = () => {
    window.open(imageUrl, '_blank');
  };

  const handleCopy = async () => {
    try {
      const textToCopy = caption || imageUrl;
      const success = await copyToClipboard(textToCopy);
      
      if (success) {
        setIsCopied(true);
        toast.success('Content copied to clipboard');
        
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      } else {
        // Show manual copy option
        navigator.clipboard?.writeText(textToCopy).catch(() => {
          toast.info(`Copy manually: ${textToCopy.substring(0, 50)}${textToCopy.length > 50 ? '...' : ''}`);
        });
      }
    } catch (error) {
      console.error('Copy failed:', error);
      const textToCopy = caption || imageUrl;
      toast.info(`Copy manually: ${textToCopy.substring(0, 50)}${textToCopy.length > 50 ? '...' : ''}`);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-2">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 text-sm font-medium">AI</span>
          </div>
        </div>
        <div className="flex-1">
          {caption && (
            <p className="text-gray-900 mb-3">{caption}</p>
          )}
          <div className="relative group">
            <ImageWithFallback
              src={imageUrl}
              alt="Generated image"
              className="max-w-full h-auto rounded-lg shadow-sm border border-gray-200"
              style={{ maxHeight: '400px', objectFit: 'contain' }}
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex space-x-1">
                <Button
                  onClick={handleCopy}
                  size="sm"
                  variant="secondary"
                  className="bg-white/90 hover:bg-white shadow-sm"
                >
                  {isCopied ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  onClick={handleDownload}
                  size="sm"
                  variant="secondary"
                  className="bg-white/90 hover:bg-white shadow-sm"
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  onClick={handleOpenInNewTab}
                  size="sm"
                  variant="secondary"
                  className="bg-white/90 hover:bg-white shadow-sm"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}