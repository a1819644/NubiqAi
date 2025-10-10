import React, { useState } from "react";
import { Moon, Sun, User, LogIn, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { AuthModal } from "./AuthModal";
import type { User as UserType } from "../App";

interface HeaderProps {
  user: UserType;
  onSignIn: (userData: Omit<UserType, "isAuthenticated">) => void;
  onSignOut: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Header({
  user,
  onSignIn,
  onSignOut,
  isDarkMode,
  onToggleDarkMode,
}: HeaderProps) {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [signInData, setSignInData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    dob: "", // dob is date of birth
    profilePicture: "",
  });

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInData.firstName || !signInData.email) {
      toast.error("Please fill in required fields");
      return;
    }

    onSignIn(signInData);
    setIsSignInOpen(false);
    setSignInData({
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      dob: "",
      profilePicture: "",
    });
    toast.success("Successfully signed in!");
  };

  const handleSignUp = (userData: Omit<UserType, "isAuthenticated">) => {
    onSignIn(userData); // Use the same onSignIn logic for simplicity
    setIsSignUpOpen(false);
    toast.success("Successfully signed up!");
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <header className="bg-background border-b border-border h-14 flex items-center justify-between px-6">
      <div className="flex items-center justify-between w-full">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-black rounded-sm flex items-center justify-center">
            <span className="text-white text-xs font-bold">AI</span>
          </div>
          <span className="font-medium text-base">Portal</span>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleDarkMode}
            title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
            className="w-8 h-8"
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
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
              <span className="text-sm font-medium text-gray-900">
                {user.firstName} {user.lastName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900 ml-2"
                onClick={onSignOut}
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <User className="h-4 w-4" />
                      Sign In
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Sign In</DialogTitle>
                      <DialogDescription>
                        Enter your details to sign in to AI Portal.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSignIn} className="space-y-4 mt-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="firstName"
                            className="text-sm font-medium"
                          >
                            First Name *
                          </Label>
                          <Input
                            id="firstName"
                            value={signInData.firstName}
                            onChange={(e) =>
                              setSignInData((prev) => ({
                                ...prev,
                                firstName: e.target.value,
                              }))
                            }
                            required
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="lastName"
                            className="text-sm font-medium"
                          >
                            Last Name
                          </Label>
                          <Input
                            id="lastName"
                            value={signInData.lastName}
                            onChange={(e) =>
                              setSignInData((prev) => ({
                                ...prev,
                                lastName: e.target.value,
                              }))
                            }
                            className="h-10"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium">
                          Email *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={signInData.email}
                          onChange={(e) =>
                            setSignInData((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          required
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mobile" className="text-sm font-medium">
                          Mobile
                        </Label>
                        <Input
                          id="mobile"
                          type="tel"
                          value={signInData.mobile}
                          onChange={(e) =>
                            setSignInData((prev) => ({
                              ...prev,
                              mobile: e.target.value,
                            }))
                          }
                          className="h-10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="dateOfBirth"
                          className="text-sm font-medium"
                        >
                          Date of Birth
                        </Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={signInData.dob}
                          onChange={(e) =>
                            setSignInData((prev) => ({
                              ...prev,
                              dob: e.target.value,
                            }))
                          }
                          className="h-10"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-black text-white hover:bg-gray-800 h-11 mt-6"
                        disabled={!signInData.firstName || !signInData.email}
                      >
                        Sign In
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button
                  size="sm"
                  className="bg-black text-white hover:bg-gray-800"
                  onClick={() => setIsSignUpOpen(true)}
                >
                  Sign up for free
                </Button>
              </div>
              <AuthModal
                open={isSignUpOpen}
                onClose={() => setIsSignUpOpen(false)}
                onSignUp={handleSignUp}
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
