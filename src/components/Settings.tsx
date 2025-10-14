// import React, { useState, useEffect } from 'react'; // Import useEffect
// import { 
//   User, 
//   Moon, 
//   Sun, 
//   Bell, 
//   Shield, 
//   CreditCard, 
//   Download,
//   Upload,
//   Save,
//   Eye,
//   EyeOff
// } from 'lucide-react';
// import { Button } from './ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
// import { Input } from './ui/input';
// import { Label } from './ui/label';
// import { Switch } from './ui/switch';
// import { Textarea } from './ui/textarea';
// import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
// import { Badge } from './ui/badge';
// import { Separator } from './ui/separator';
// import { toast } from 'sonner';
// import type { User as UserType } from '../App';

// type SettingsSection = 'account' | 'workspace' | 'subscription' | 'preferences';

// interface SettingsProps {
//   section: SettingsSection;
//   user: UserType;
//   onUpdateUser: (user: UserType) => void;
//   isDarkMode: boolean;
//   onToggleDarkMode: () => void;
// }

// export function Settings({ 
//   section, 
//   user, 
//   onUpdateUser, 
//   isDarkMode, 
//   onToggleDarkMode 
// }: SettingsProps) {
//   const [editMode, setEditMode] = useState(false);
//   const [formData, setFormData] = useState(user);
//   const [showPassword, setShowPassword] = useState(false);

//   // --- FIX STARTS HERE ---
//   // This effect synchronizes the form state with the user prop.
//   // It runs whenever the 'user' prop changes.
//   useEffect(() => {
//     setFormData(user);
//   }, [user]);
//   // --- FIX ENDS HERE ---

//   const handleSaveProfile = () => {
//     onUpdateUser(formData);
//     setEditMode(false);
//     toast.success('Profile updated successfully');
//   };

//   const getInitials = (firstName: string, lastName:string) => {
//     return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
//   };

//   const renderAccount = () => (
//     <div className="space-y-6">
//       <div className="flex items-center justify-between">
//         <h2 className="text-2xl font-bold">Account Settings</h2>
//         <Button
//           variant={editMode ? "default" : "outline"}
//           onClick={() => editMode ? handleSaveProfile() : setEditMode(true)}
//         >
//           {editMode ? (
//             <>
//               <Save className="w-4 h-4 mr-2" />
//               Save Changes
//             </>
//           ) : (
//             'Edit Profile'
//           )}
//         </Button>
//       </div>

//       <Card>
//         <CardHeader>
//           <CardTitle>Profile Information</CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           {/* Profile Picture */}
//           <div className="flex items-center gap-4">
//             <Avatar className="w-20 h-20">
//               <AvatarImage src={formData.profilePicture} />
//               <AvatarFallback className="text-lg">
//                 {getInitials(formData.firstName, formData.lastName)}
//               </AvatarFallback>
//             </Avatar>
//             {editMode && (
//               <div className="space-y-2">
//                 <Button variant="outline" size="sm">
//                   <Upload className="w-4 h-4 mr-2" />
//                   Upload Photo
//                 </Button>
//                 <p className="text-xs text-muted-foreground">
//                   JPG, PNG up to 2MB
//                 </p>
//               </div>
//             )}
//           </div>

//           {/* Form Fields */}
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             <div>
//               <Label htmlFor="firstName">First Name</Label>
//               <Input
//                 id="firstName"
//                 value={formData.firstName}
//                 onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
//                 disabled={!editMode}
//               />
//             </div>
//             <div>
//               <Label htmlFor="lastName">Last Name</Label>
//               <Input
//                 id="lastName"
//                 value={formData.lastName}
//                 onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
//                 disabled={!editMode}
//               />
//             </div>
//           </div>

//           <div>
//             <Label htmlFor="email">Email</Label>
//             <Input
//               id="email"
//               type="email"
//               value={formData.email}
//               onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
//               disabled={!editMode}
//             />
//           </div>

//           <div>
//             <Label htmlFor="mobile">Mobile</Label>
//             <Input
//               id="mobile"
//               type="tel"
//               value={formData.mobile}
//               onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
//               disabled={!editMode}
//             />
//           </div>

//           <div>
//             <Label htmlFor="dob">Date of Birth</Label>
//             <Input
//               id="dob"
//               type="date"
//               value={formData.dob}
//               onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
//               disabled={!editMode}
//             />
//           </div>
//         </CardContent>
//       </Card>

//       {/* Security */}
//       <Card>
//         <CardHeader>
//           <CardTitle>Security</CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           <div>
//             <Label htmlFor="password">Password</Label>
//             <div className="relative">
//               <Input
//                 id="password"
//                 type={showPassword ? "text" : "password"}
//                 placeholder="••••••••"
//                 disabled={!editMode}
//               />
//               <Button
//                 type="button"
//                 variant="ghost"
//                 size="sm"
//                 className="absolute right-0 top-0 h-full px-3"
//                 onClick={() => setShowPassword(!showPassword)}
//               >
//                 {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
//               </Button>
//             </div>
//           </div>
          
//           <div className="flex items-center justify-between">
//             <div>
//               <Label>Two-Factor Authentication</Label>
//               <p className="text-sm text-muted-foreground">
//                 Add an extra layer of security to your account
//               </p>
//             </div>
//             <Switch defaultChecked={false} />
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   );

//   const renderWorkspace = () => (
//     <div className="space-y-6">
//       <h2 className="text-2xl font-bold">Workspace Settings</h2>
      
//       <Card>
//         <CardHeader>
//           <CardTitle>General</CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           <div>
//             <Label htmlFor="workspaceName">Workspace Name</Label>
//             <Input id="workspaceName" defaultValue="My AI Workspace" />
//           </div>
          
//           <div>
//             <Label htmlFor="workspaceDescription">Description</Label>
//             <Textarea 
//               id="workspaceDescription" 
//               placeholder="Describe your workspace..."
//               defaultValue="AI-powered workspace for productivity and collaboration"
//             />
//           </div>

//           <div className="flex items-center justify-between">
//             <div>
//               <Label>Public Workspace</Label>
//               <p className="text-sm text-muted-foreground">
//                 Allow others to discover and join your workspace
//               </p>
//             </div>
//             <Switch defaultChecked={false} />
//           </div>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardHeader>
//           <CardTitle>Team Management</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="space-y-4">
//             <div className="flex items-center justify-between">
//               <span>Team Members</span>
//               <Badge>6 members</Badge>
//             </div>
//             <Button className="w-full">
//               Invite Team Members
//             </Button>
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   );

//   const renderSubscription = () => (
//     <div className="space-y-6">
//       <h2 className="text-2xl font-bold">Subscription</h2>
      
//       <Card>
//         <CardHeader>
//           <CardTitle>Current Plan</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="space-y-4">
//             <div className="flex items-center justify-between">
//               <div>
//                 <h3 className="font-medium">Free Plan</h3>
//                 <p className="text-sm text-muted-foreground">
//                   Basic features with limited usage
//                 </p>
//               </div>
//               <Badge variant="secondary">Free</Badge>
//             </div>
            
//             <Separator />
            
//             <div className="space-y-2">
//               <div className="flex justify-between text-sm">
//                 <span>AI Chats</span>
//                 <span>48 / 100</span>
//               </div>
//               <div className="flex justify-between text-sm">
//                 <span>Storage</span>
//                 <span>2.3 GB / 5 GB</span>
//               </div>
//               <div className="flex justify-between text-sm">
//                 <span>Team Members</span>
//                 <span>6 / 10</span>
//               </div>
//             </div>
            
//             <Button className="w-full">
//               <CreditCard className="w-4 h-4 mr-2" />
//               Upgrade to Pro
//             </Button>
//           </div>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardHeader>
//           <CardTitle>Billing History</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="text-center py-8 text-muted-foreground">
//             <p>No billing history available</p>
//             <p className="text-sm">You're currently on the free plan</p>
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   );

//   const renderPreferences = () => (
//     <div className="space-y-6">
//       <h2 className="text-2xl font-bold">Preferences</h2>
      
//       <Card>
//         <CardHeader>
//           <CardTitle>Appearance</CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
//               <div>
//                 <Label>Dark Mode</Label>
//                 <p className="text-sm text-muted-foreground">
//                   Switch between light and dark themes
//                 </p>
//               </div>
//             </div>
//             <Switch checked={isDarkMode} onCheckedChange={onToggleDarkMode} />
//           </div>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardHeader>
//           <CardTitle>Notifications</CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <Bell className="w-4 h-4" />
//               <div>
//                 <Label>Push Notifications</Label>
//                 <p className="text-sm text-muted-foreground">
//                   Receive notifications for new messages
//                 </p>
//               </div>
//             </div>
//             <Switch defaultChecked={true} />
//           </div>

//           <div className="flex items-center justify-between">
//             <div>
//               <Label>Email Notifications</Label>
//               <p className="text-sm text-muted-foreground">
//                 Get email updates about your workspace
//               </p>
//             </div>
//             <Switch defaultChecked={false} />
//           </div>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardHeader>
//           <CardTitle>Data & Privacy</CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           <Button variant="outline" className="w-full">
//             <Download className="w-4 h-4 mr-2" />
//             Export Data
//           </Button>
          
//           <Button variant="outline" className="w-full">
//             <Shield className="w-4 h-4 mr-2" />
//             Privacy Settings
//           </Button>
//         </CardContent>
//       </Card>
//     </div>
//   );

//   const renderSection = () => {
//     switch (section) {
//       case 'account':
//         return renderAccount();
//       case 'workspace':
//         return renderWorkspace();
//       case 'subscription':
//         return renderSubscription();
//       case 'preferences':
//         return renderPreferences();
//       default:
//         return renderAccount();
//     }
//   };

//   return (
//     <div className="flex-1 overflow-auto">
//       <div className="p-6 max-w-4xl">
//         {renderSection()}
//       </div>
//     </div>
//   );
// }

import React, { useState, useEffect } from 'react'; // Import useEffect
import { 
  User, 
  Moon, 
  Sun, 
  Bell, 
  Shield, 
  CreditCard, 
  Download,
  Upload,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import type { User as UserType } from '../App';

type SettingsSection = 'account' | 'workspace' | 'subscription' | 'preferences';

interface SettingsProps {
  section: SettingsSection;
  user: UserType;
  onUpdateUser: (user: UserType) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Settings({ 
  section, 
  user, 
  onUpdateUser, 
  isDarkMode, 
  onToggleDarkMode 
}: SettingsProps) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(user);
  const [showPassword, setShowPassword] = useState(false);

  // --- FIX STARTS HERE ---
  // This effect synchronizes the form state with the user prop.
  // It runs whenever the 'user' prop changes.
  useEffect(() => {
    setFormData(user);
  }, [user]);
  // --- FIX ENDS HERE ---

  const handleSaveProfile = () => {
    onUpdateUser(formData);
    setEditMode(false);
    toast.success('Profile updated successfully');
  };

  const getInitials = (firstName: string, lastName:string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const renderAccount = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Account Settings</h2>
        <Button
          variant={editMode ? "default" : "outline"}
          onClick={() => editMode ? handleSaveProfile() : setEditMode(true)}
        >
          {editMode ? (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          ) : (
            'Edit Profile'
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profile Picture */}
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={formData.profilePicture} />
              <AvatarFallback className="text-lg">
                {getInitials(formData.firstName, formData.lastName)}
              </AvatarFallback>
            </Avatar>
            {editMode && (
              <div className="space-y-2">
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG up to 2MB
                </p>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                disabled={!editMode}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                disabled={!editMode}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              disabled={!editMode}
            />
          </div>

          <div>
            <Label htmlFor="mobile">Mobile</Label>
            <Input
              id="mobile"
              type="tel"
              value={formData.mobile}
              onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
              disabled={!editMode}
            />
          </div>

          <div>
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              type="date"
              value={formData.dob}
              onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
              disabled={!editMode}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                disabled={!editMode}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <Switch defaultChecked={false} />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderWorkspace = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Workspace Settings</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="workspaceName">Workspace Name</Label>
            <Input id="workspaceName" defaultValue="My AI Workspace" />
          </div>
          
          <div>
            <Label htmlFor="workspaceDescription">Description</Label>
            <Textarea 
              id="workspaceDescription" 
              placeholder="Describe your workspace..."
              defaultValue="AI-powered workspace for productivity and collaboration"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Public Workspace</Label>
              <p className="text-sm text-muted-foreground">
                Allow others to discover and join your workspace
              </p>
            </div>
            <Switch defaultChecked={false} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Team Members</span>
              <Badge>6 members</Badge>
            </div>
            <Button className="w-full">
              Invite Team Members
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSubscription = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Subscription</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Free Plan</h3>
                <p className="text-sm text-muted-foreground">
                  Basic features with limited usage
                </p>
              </div>
              <Badge variant="secondary">Free</Badge>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>AI Chats</span>
                <span>48 / 100</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Storage</span>
                <span>2.3 GB / 5 GB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Team Members</span>
                <span>6 / 10</span>
              </div>
            </div>
            
            <Button className="w-full">
              <CreditCard className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No billing history available</p>
            <p className="text-sm">You're currently on the free plan</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPreferences = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Preferences</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <div>
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark themes
                </p>
              </div>
            </div>
            <Switch checked={isDarkMode} onCheckedChange={onToggleDarkMode} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <div>
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for new messages
                </p>
              </div>
            </div>
            <Switch defaultChecked={true} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get email updates about your workspace
              </p>
            </div>
            <Switch defaultChecked={false} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          
          <Button variant="outline" className="w-full">
            <Shield className="w-4 h-4 mr-2" />
            Privacy Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderSection = () => {
    switch (section) {
      case 'account':
        return renderAccount();
      case 'workspace':
        return renderWorkspace();
      case 'subscription':
        return renderSubscription();
      case 'preferences':
        return renderPreferences();
      default:
        return renderAccount();
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 max-w-4xl">
        {renderSection()}
      </div>
    </div>
  );
}