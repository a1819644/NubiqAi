import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';

// Google icon for sign-in button
const GoogleIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.19,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.19,22C17.6,22 21.54,18.33 21.54,12.31C21.54,11.76 21.45,11.44 21.35,11.1Z"></path></svg>;

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: () => void;
}

export function AuthDialog({ open, onOpenChange, onSignIn }: AuthDialogProps) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            Welcome to NubiqAi
          </DialogTitle>
          <DialogDescription className="text-center">
            Sign in with your Google account to continue
          </DialogDescription>
        </DialogHeader>

        <div className="pt-4">
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2" 
            onClick={onSignIn}
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
