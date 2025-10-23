import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

interface TutorialStep {
  title: string;
  description: string;
  icon?: React.ReactNode;
  selector?: string; // CSS selector for the element to highlight
  placement?: 'top' | 'bottom' | 'left' | 'right';
  interactive?: boolean; // If true, clicking the element proceeds
}

const steps: TutorialStep[] = [
  {
    title: 'Welcome to NubiqAI! ✨',
    description: 'Let\'s take a quick tour of the powerful features available to you. Click "Next" to begin.',
    // No selector, will be centered
  },
  {
    title: 'Chat with AI',
    description: 'You can start a conversation by clicking here or simply by typing in the prompt area below.',
    selector: '[data-tour-id="welcome-chat-with-ai"]',
    placement: 'bottom',
    interactive: true,
  },
  {
    title: 'Upload Files',
    description: 'Click here to upload documents (PDF, DOCX) or images for the AI to analyze.',
    selector: '[data-tour-id="welcome-upload-files"]',
    placement: 'bottom',
    interactive: true,
  },
  {
    title: 'Voice Recording',
    description: 'Prefer to speak? Use this to record your voice. The AI will transcribe it for you.',
    selector: '[data-tour-id="welcome-voice-recording"]',
    placement: 'top',
  },
  {
    title: 'Create Images',
    description: 'Or, jump straight into creating images by describing what you want to see.',
    selector: '[data-tour-id="welcome-create-image"]',
    placement: 'top',
  },
  {
    title: 'Start a New Conversation',
    description: 'Click here to start a new chat anytime. Your previous conversations are automatically saved.',
    selector: '[data-tour-id="new-chat-button"]',
    placement: 'right',
  },
  {
    title: 'The Prompt Area',
    description: 'This is where you\'ll type your messages to the AI. Let\'s look at the tools available.',
    selector: '[data-tour-id="prompt-input-area"]',
    placement: 'top',
  },
  {
    title: 'Attach Files',
    description: 'Click the paperclip to attach files like PDFs, documents, or images to your prompt.',
    selector: '[data-tour-id="attach-file-button"]',
    placement: 'top',
  },
  {
    title: 'Toggle Image Mode',
    description: 'Click this icon to switch between text chat and image generation mode.',
    selector: '[data-tour-id="image-icon-button"]',
    placement: 'top',
  },
  {
    title: 'Record Your Voice',
    description: 'Use the microphone to send voice messages instead of typing.',
    selector: '[data-tour-id="voice-record-button"]',
    placement: 'top',
  },
  {
    title: 'Send or Stop',
    description: 'Click the arrow to send your message. If the AI is responding, this button will turn into a square to let you stop the generation.',
    selector: '[data-tour-id="send-button"], [data-tour-id="stop-button"]',
    placement: 'top',
  },
  {
    title: 'You\'re All Set! 🚀',
    description: 'That\'s it! You\'re ready to explore. Start by typing your first message below.',
    // No selector, will be centered
  },
];

interface OnboardingTutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingTutorial({ open, onOpenChange }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange(false); // Close the dialog on the last step
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  const handleElementClick = (e: MouseEvent) => {
    if (step.interactive) {
      e.preventDefault();
      e.stopPropagation();
      handleNext();
    }
  };

  // Find and highlight the target element for the current step
  useLayoutEffect(() => {
    if (step.selector) {
      const element = document.querySelector(step.selector) as HTMLElement | null;
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        setSpotlightStyle({
          width: rect.width + 12,
          height: rect.height + 12,
          top: rect.top - 6,
          left: rect.left - 6,
          borderRadius: parseFloat(getComputedStyle(element).borderRadius) + 6,
          opacity: 1,
          pointerEvents: step.interactive ? 'auto' : 'none',
        });

        if (step.interactive) {
          element.addEventListener('click', handleElementClick);
        }
      } else {
        console.warn(`Tour step "${step.title}" selector not found: ${step.selector}`);
        setTargetRect(null); // Element not found, center the dialog
        setSpotlightStyle({ opacity: 0 });
      }
    } else {
      setTargetRect(null); // No selector, center the dialog
      setSpotlightStyle({ opacity: 0 });
    }

    return () => {
      // Cleanup interactive listener
      if (step.selector && step.interactive) {
        const element = document.querySelector(step.selector) as HTMLElement | null;
        if (element) {
          element.removeEventListener('click', handleElementClick);
        }
      }
    };
  }, [currentStep, step.selector]);

  const isLastStep = currentStep === steps.length - 1;

  // If the dialog is not open, don't render anything
  if (!open) return null;

  // Centered Dialog for steps without a selector
  if (!targetRect) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="text-center items-center pt-4">
            <div className="h-16 w-16 flex items-center justify-center bg-primary/10 rounded-full mb-4">
              {step.icon || <Sparkles className="w-10 h-10 text-primary" />}
            </div>
            <DialogTitle className="text-2xl">{step.title}</DialogTitle>
            <DialogDescription className="text-center px-4">
              {step.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between gap-2 pt-4">
            <Button variant="ghost" onClick={handleSkip}>
              Skip Tutorial
            </Button>
            <Button onClick={handleNext}>
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Positioned Popover for steps with a selector
  const getPositionStyles = (): React.CSSProperties => {
    const offset = 12; // 12px gap
    if (!targetRect) return { opacity: 0 };

    switch (step.placement) {
      case 'bottom':
        return { top: targetRect.bottom + offset, left: targetRect.left, opacity: 1 };
      case 'top':
        return { bottom: window.innerHeight - targetRect.top + offset, left: targetRect.left, opacity: 1 };
      case 'left':
        return { top: targetRect.top, right: window.innerWidth - targetRect.left + offset, opacity: 1 };
      case 'right':
        return { top: targetRect.top, left: targetRect.right + offset, opacity: 1 };
      default:
        return { top: targetRect.bottom + offset, left: targetRect.left, opacity: 1 };
    }
  };

  return (
    <>
      {/* Dark overlay */}
      {/* The overlay is now part of the spotlight's box-shadow, so this div is no longer needed. */}
      {/* <div
        className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-300"
        onClick={handleSkip}
      /> */}
      {/* Spotlight element */}
      <div
        className="fixed z-50 transition-all duration-400 ease-in-out"
        style={spotlightStyle}
        onClick={step.interactive ? (e) => e.stopPropagation() : undefined}
      >
        <div className="w-full h-full rounded-[inherit] animate-pulse-glow" />
      </div>

      {/* Tooltip */}
      <div
        className="fixed z-[51] bg-background/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] p-5 w-80 transition-all duration-400 ease-in-out"
        style={getPositionStyles()}
      >
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-lg text-foreground">{step.title}</h3>
          <span className="text-xs font-medium text-muted-foreground/80">
            {currentStep + 1} / {steps.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-5">{step.description}</p>
        
        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-1.5 mb-5">
          <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div>
        </div>

        <div className="flex justify-between items-center">
          <Button variant="link" size="sm" className="text-muted-foreground" onClick={handleSkip}>Skip</Button>
          <Button size="sm" onClick={handleNext}>
            {isLastStep ? 'Start Exploring' : 'Next'}
            {!isLastStep && <ArrowRight className="ml-1.5 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </>
  );
}