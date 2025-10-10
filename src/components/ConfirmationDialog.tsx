import React from 'react';
import { Button } from './ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

interface ConfirmationDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({ message, onConfirm, onCancel }: ConfirmationDialogProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-2">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 text-sm font-medium">AI</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-gray-900 mb-3">{message}</p>
          <div className="flex space-x-2">
            <Button
              onClick={onConfirm}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Yes
            </Button>
            <Button
              onClick={onCancel}
              size="sm"
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <XCircle className="h-4 w-4 mr-1" />
              No
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}