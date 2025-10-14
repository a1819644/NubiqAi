import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { User } from '../types';

// Placeholder icons for social logins
const GoogleIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.19,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.19,22C17.6,22 21.54,18.33 21.54,12.31C21.54,11.76 21.45,11.44 21.35,11.1Z"></path></svg>;
const AppleIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M19.3,12.15C19.3,10.45,18.33,9,16.48,9c-1.2,0-2.25.83-2.85,1.35c-.58-.8-1.6-1.35-2.78-1.35c-1.7,0-3.15,1.23-3.15,3.18c0,2.4,1.6,4.3,3.3,4.3c.5,0,1.05-.2,1.6-.55c.55.35,1.1.55,1.65.55c2.1,0,3.15-1.9,3.15-3.53Zm-6.23,5.1c-.6.43-1.28.7-2.03.7c-1.2,0-2.25-.85-2.25-2.33c0-1.25.88-2.2,2.05-2.2c.6,0,1.25.3,1.8.73c-.1.08-.18.15-.25.23c-.68.83-1.1,1.9-1.1,1.9s.85.2,1.78-.93Z"></path></svg>;
const MicrosoftIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#F25022" d="M11.4,11.4H2V2h9.4V11.4z M22,11.4h-9.4V2H22V11.4z M11.4,22H2v-9.4h9.4V22z M22,22h-9.4v-9.4H22V22z"></path></svg>;

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: (user: Omit<User, 'isAuthenticated'>) => void;
  mode: 'signin' | 'signup';
  onModeChange: (mode: 'signin' | 'signup') => void;
}

export function AuthDialog({ open, onOpenChange, onSignIn, mode, onModeChange }: AuthDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd validate this against a backend
    onSignIn({ id: '1', name: 'Email User', email, subscription: 'free' });
    onOpenChange(false);
  };

  const handleEmailSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd register this user
    onSignIn({ id: '2', name, email, subscription: 'free' });
    onOpenChange(false);
  };

  const handleSocialSignIn = (provider: string) => {
    // Placeholder for social sign-in
    onSignIn({ id: `social-${Date.now()}`, name: `${provider} User`, email: `${provider.toLowerCase()}@example.com`, subscription: 'free' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            {mode === 'signin' ? 'Welcome back' : 'Create an account'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {mode === 'signin' ? 'Sign in to continue.' : 'Enter your details to get started.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'signin' ? (
          <form onSubmit={handleEmailSignIn} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email-in">Email</Label>
              <Input id="email-in" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-in">Password</Label>
              <Input id="password-in" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">Sign In</Button>
          </form>
        ) : (
          <form onSubmit={handleEmailSignUp} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name-up">Name</Label>
              <Input id="name-up" placeholder="Your Name" required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-up">Email</Label>
              <Input id="email-up" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-up">Password</Label>
              <Input id="password-up" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">Create Account</Button>
          </form>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" onClick={() => handleSocialSignIn('Google')}>
            <GoogleIcon />
          </Button>
          <Button variant="outline" onClick={() => handleSocialSignIn('Apple')}>
            <AppleIcon />
          </Button>
          <Button variant="outline" onClick={() => handleSocialSignIn('Microsoft')}>
            <MicrosoftIcon />
          </Button>
        </div>

        <div className="mt-4 text-center text-sm">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => onModeChange('signup')}>
                Sign Up
              </Button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => onModeChange('signin')}>
                Sign In
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
