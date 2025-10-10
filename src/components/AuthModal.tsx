import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSignUp: (userData: any) => void;
}

export function AuthModal({ open, onClose, onSignUp }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSocialSignUp = async (provider: string) => {
    setIsAuthenticating(true);
    
    // Simulate authentication delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock user data based on provider
    const mockUserData = {
      firstName: "Farah",
      lastName: "Shiba",
      email: provider === "Google" ? "farah@gmail.com" : 
             provider === "Apple" ? "farah@icloud.com" : 
             "farah@example.com",
      mobile: "+1234567890",
      dob: "1990-01-01",
      profilePicture: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + provider,
    };
    
    onSignUp(mockUserData);
    onClose();
    setIsAuthenticating(false);
  };

  const handleEmailSignUp = () => {
    if (!email) return;
    const mockUserData = {
      firstName: "Farah",
      lastName: "Shiba",
      email,
      mobile: "",
      dob: "",
      profilePicture: "",
    };
    onSignUp(mockUserData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] p-0 bg-background">
        <DialogHeader className="sr-only">
          <DialogTitle>Log in or sign up</DialogTitle>
          <DialogDescription>Sign up or log in to continue</DialogDescription>
        </DialogHeader>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-medium mb-2 text-foreground">
              Log in or sign up
            </h2>
            <p className="text-muted-foreground text-sm">
              Welcome to our AI Dashboard Portal. Continue with your account to get smarter responses and upload files, images, and more.
            </p>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            <Button
              variant="outline"
              className="w-full h-12 justify-start gap-3"
              onClick={() => handleSocialSignUp("Google")}
              disabled={isAuthenticating}
            >
              <div className="w-5 h-5">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path
                    fill="#4285F4"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.84 18.47c-.35-.14-.66-.34-.94-.6l-3.57 2.77c1.82 1.68 4.31 2.66 7.28 2.66v-4.4c-1.48 0-2.73-.4-3.71-1.06L10.84 18.47z"
                  />
                  <path
                    fill="#34A853"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              {isAuthenticating ? 'Signing in...' : 'Continue with Google'}
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 justify-start gap-3"
              onClick={() => handleSocialSignUp("Microsoft")}
              disabled={isAuthenticating}
            >
              <div className="w-5 h-5">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#00A4EF" d="M13 1h10v10H13z" />
                  <path fill="#7FBA00" d="M1 13h10v10H1z" />
                  <path fill="#FFB900" d="M13 13h10v10H13z" />
                </svg>
              </div>
              Continue with Microsoft Account
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 justify-start gap-3"
              onClick={() => handleSocialSignUp("Apple")}
              disabled={isAuthenticating}
            >
              <div className="w-5 h-5">
                <svg
                  viewBox="0 0 24 24"
                  className="w-full h-full"
                  fill="currentColor"
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
              </div>
              Continue with Apple
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 justify-start gap-3"
              onClick={() => handleSocialSignUp("Phone")}
              disabled={isAuthenticating}
            >
              <div className="w-5 h-5">
                <svg
                  viewBox="0 0 24 24"
                  className="w-full h-full"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              Continue with phone
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-4 text-muted-foreground">
                OR
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=""
                className="h-12 pt-4 pb-2 border-input rounded-full"
              />
              <label className="absolute left-4 top-1 text-xs text-blue-500 font-medium">
                Email address
              </label>
            </div>

            <Button
              className="w-full h-12 rounded-full bg-black hover:bg-gray-800 text-white"
              onClick={handleEmailSignUp}
              disabled={!email || isAuthenticating}
            >
              {isAuthenticating ? 'Creating account...' : 'Continue'}
            </Button>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            By signing up, you agree to our{" "}
            <a href="#" className="underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline">
              Privacy Policy
            </a>
            .
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}