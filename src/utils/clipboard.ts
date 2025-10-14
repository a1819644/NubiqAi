// /**
//  * Copy text to clipboard with fallback support
//  * @param text - Text to copy to clipboard
//  * @returns Promise<boolean> - Returns true if successful, false otherwise
//  */
// export async function copyToClipboard(text: string): Promise<boolean> {
//   if (!text) {
//     console.warn('Empty text provided to copyToClipboard');
//     return false;
//   }

//   if (process.env.NODE_ENV === 'development') {
//     console.log('Attempting to copy:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
//   }

//   // Try modern Clipboard API first
//   if (navigator.clipboard && window.isSecureContext) {
//     try {
//       await navigator.clipboard.writeText(text);
//       if (process.env.NODE_ENV === 'development') {
//         console.log('✅ Modern Clipboard API successful');
//       }
//       return true;
//     } catch (error: any) {
//       if (process.env.NODE_ENV === 'development') {
//         console.log('❌ Modern Clipboard API failed:', error?.name || error?.message || error);
//       }
      
//       // Don't throw, just fall through to fallback
//     }
//   }

//   // Use fallback method
//   if (process.env.NODE_ENV === 'development') {
//     console.log('🔄 Trying fallback execCommand method');
//   }
  
//   const fallbackSuccess = fallbackCopyTextToClipboard(text);
  
//   if (process.env.NODE_ENV === 'development') {
//     console.log(fallbackSuccess ? '✅ Fallback successful' : '❌ Fallback failed');
//   }
  
//   return fallbackSuccess;
// }

// /**
//  * Fallback copy method using document.execCommand
//  * @param text - Text to copy
//  * @returns boolean - Success status
//  */
// function fallbackCopyTextToClipboard(text: string): boolean {
//   try {
//     if (process.env.NODE_ENV === 'development') {
//       console.log('Attempting fallback copy with execCommand');
//     }
    
//     // Check if execCommand is supported
//     if (!document.execCommand) {
//       if (process.env.NODE_ENV === 'development') {
//         console.error('execCommand not supported');
//       }
//       return false;
//     }

//     // Create a textarea element
//     const textArea = document.createElement('textarea');
//     textArea.value = text;
    
//     // Style the textarea to be invisible but still selectable
//     textArea.style.position = 'fixed';
//     textArea.style.top = '0';
//     textArea.style.left = '0';
//     textArea.style.width = '1px';
//     textArea.style.height = '1px';
//     textArea.style.padding = '0';
//     textArea.style.border = 'none';
//     textArea.style.outline = 'none';
//     textArea.style.boxShadow = 'none';
//     textArea.style.background = 'transparent';
//     textArea.style.fontSize = '16px'; // Prevent zoom on iOS
//     textArea.style.color = 'transparent';
//     textArea.style.resize = 'none';
//     textArea.style.overflow = 'hidden';
//     textArea.style.whiteSpace = 'pre';
//     textArea.style.webkitUserSelect = 'text';
//     textArea.style.userSelect = 'text';
//     textArea.setAttribute('readonly', '');
//     textArea.tabIndex = -1;
    
//     // Insert into DOM
//     document.body.appendChild(textArea);
    
//     // Focus and select all text
//     textArea.focus();
//     textArea.select();
    
//     // For mobile devices
//     if (textArea.setSelectionRange) {
//       textArea.setSelectionRange(0, text.length);
//     }
    
//     // Execute copy command
//     let successful = false;
//     try {
//       successful = document.execCommand('copy');
//     } catch (copyError) {
//       if (process.env.NODE_ENV === 'development') {
//         console.error('execCommand copy failed:', copyError);
//       }
//       successful = false;
//     }
    
//     // Clean up
//     document.body.removeChild(textArea);
    
//     return successful;
//   } catch (error) {
//     if (process.env.NODE_ENV === 'development') {
//       console.error('Fallback copy method failed:', error);
//     }
//     return false;
//   }
// }

// /**
// export function isClipboardAvailable(): boolean {
//   return !!(navigator.clipboard || document.execCommand);
// }

/**
 * Copy text to clipboard with fallback support
 * @param text - Text to copy to clipboard
 * @returns Promise<boolean> - Returns true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) {
    console.warn('Empty text provided to copyToClipboard');
    return false;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('Attempting to copy:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  }

  // Try modern Clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Modern Clipboard API successful');
      }
      return true;
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Modern Clipboard API failed:', error?.name || error?.message || error);
      }
      
      // Don't throw, just fall through to fallback
    }
  }

  // Use fallback method
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 Trying fallback execCommand method');
  }
  
  const fallbackSuccess = fallbackCopyTextToClipboard(text);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(fallbackSuccess ? '✅ Fallback successful' : '❌ Fallback failed');
  }
  
  return fallbackSuccess;
}

/**
 * Fallback copy method using document.execCommand
 * @param text - Text to copy
 * @returns boolean - Success status
 */
function fallbackCopyTextToClipboard(text: string): boolean {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('Attempting fallback copy with execCommand');
    }
    
    // Check if execCommand is supported
    if (!document.execCommand) {
      if (process.env.NODE_ENV === 'development') {
        console.error('execCommand not supported');
      }
      return false;
    }

    // Create a textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Style the textarea to be invisible but still selectable
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '1px';
    textArea.style.height = '1px';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.fontSize = '16px'; // Prevent zoom on iOS
    textArea.style.color = 'transparent';
    textArea.style.resize = 'none';
    textArea.style.overflow = 'hidden';
    textArea.style.whiteSpace = 'pre';
    textArea.style.webkitUserSelect = 'text';
    textArea.style.userSelect = 'text';
    textArea.setAttribute('readonly', '');
    textArea.tabIndex = -1;
    
    // Insert into DOM
    document.body.appendChild(textArea);
    
    // Focus and select all text
    textArea.focus();
    textArea.select();
    
    // For mobile devices
    if (textArea.setSelectionRange) {
      textArea.setSelectionRange(0, text.length);
    }
    
    // Execute copy command
    let successful = false;
    try {
      successful = document.execCommand('copy');
    } catch (copyError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('execCommand copy failed:', copyError);
      }
      successful = false;
    }
    
    // Clean up
    document.body.removeChild(textArea);
    
    return successful;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Fallback copy method failed:', error);
    }
    return false;
  }
}

/**
 * Check if clipboard functionality is available
 * @returns boolean - True if clipboard is available
 */
export function isClipboardAvailable(): boolean {
  return !!(navigator.clipboard || document.execCommand);
}