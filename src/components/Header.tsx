import React, { useState } from 'react';
import { Moon, Sun, User, LogIn, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import type { User as UserType } from '../App';

interface HeaderProps {
  user: UserType;
  onSignIn: (userData: Omit<UserType, 'isAuthenticated'>) => void;
  onSignOut: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Header({ user, onSignIn, onSignOut, isDarkMode, onToggleDarkMode }: HeaderProps) {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [signInData, setSignInData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    dob: '',
    profilePicture: '',
  });

  const handleDarkModeToggle = () => {
    console.log('🖱️ Dark mode toggle clicked! Current state:', isDarkMode);
    console.log('🧠 Document classes before:', document.documentElement.className);
    
    onToggleDarkMode();
    
    // Delayed check to see the change
    setTimeout(() => {
      console.log('🧠 Document classes after:', document.documentElement.className);
      toast.success(`Switched to ${!isDarkMode ? 'dark' : 'light'} mode`);
    }, 100);
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInData.firstName || !signInData.email) {
      toast.error('Please fill in required fields');
      return;
    }
    
    onSignIn(signInData);
    setIsSignInOpen(false);
    setSignInData({
      firstName: '',
      lastName: '',
      email: '',
      mobile: '',
      dob: '',
      profilePicture: '',
    });
    toast.success('Successfully signed in!');
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">AI</span>
          </div>
          <h1 className="font-semibold text-lg">Portal</h1>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {/* Dark Mode Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDarkModeToggle}
            title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {/* User Authentication */}
          {user.isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user.profilePicture} />
                <AvatarFallback>
                  {getInitials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">
                {user.firstName}
              </span>
              <Button
                variant="ghost" 
                size="sm"
                onClick={onSignOut}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Sign In</DialogTitle>
                  <DialogDescription>
                    Enter your details to sign in to AI Portal
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={signInData.firstName}
                        onChange={(e) => setSignInData(prev => ({ ...prev, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={signInData.lastName}
                        onChange={(e) => setSignInData(prev => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={signInData.email}
                      onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="mobile">Mobile</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      value={signInData.mobile}
                      onChange={(e) => setSignInData(prev => ({ ...prev, mobile: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={signInData.dob}
                      onChange={(e) => setSignInData(prev => ({ ...prev, dob: e.target.value }))}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Sign In
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </header>
  );
}