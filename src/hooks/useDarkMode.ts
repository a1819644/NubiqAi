import { useState, useLayoutEffect } from 'react';

export function useDarkMode() {
  // Initialize state from localStorage or DOM
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('darkMode');
      return stored ? JSON.parse(stored) : document.documentElement.classList.contains('dark');
    }
    return false;
  });

  // Apply theme changes to DOM
  useLayoutEffect(() => {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    
    // Apply correct class
    root.classList.add(isDarkMode ? 'dark' : 'light');
    
    // Set color scheme for native elements
    root.style.colorScheme = isDarkMode ? 'dark' : 'light';
    
    // Update localStorage
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return {
    isDarkMode,
    toggleDarkMode,
    setLightMode: () => setIsDarkMode(false),
    setDarkMode: () => setIsDarkMode(true),
  };
}