// import React from 'react';
// import { 
//   BarChart3, 
//   Users, 
//   FolderOpen, 
//   Bot, 
//   FileText, 
//   TrendingUp,
//   Calendar,
//   Clock,
//   Plus,
//   Filter,
//   Search
// } from 'lucide-react';
// import { Button } from './ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
// import { Badge } from './ui/badge';
// import { Input } from './ui/input';
// import { Progress } from './ui/progress';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
// import { 
//   BarChart, 
//   Bar, 
//   XAxis, 
//   YAxis, 
//   CartesianGrid, 
//   Tooltip, 
//   ResponsiveContainer,
//   LineChart,
//   Line,
//   PieChart,
//   Pie,
//   Cell
// } from 'recharts';

// type WorkspaceSection = 'overview' | 'projects' | 'team' | 'ai-tools' | 'files' | 'analytics';

// interface WorkspaceProps {
//   section: WorkspaceSection;
// }

// export function Workspace({ section }: WorkspaceProps) {
//   // Mock data
//   const stats = {
//     totalProjects: 12,
//     activeChats: 48,
//     teamMembers: 6,
//     aiTools: 15,
//     totalFiles: 234,
//     storageUsed: 68
//   };

//   const chartData = [
//     { name: 'Jan', chats: 65, projects: 8 },
//     { name: 'Feb', chats: 59, projects: 12 },
//     { name: 'Mar', chats: 80, projects: 15 },
//     { name: 'Apr', chats: 81, projects: 10 },
//     { name: 'May', chats: 95, projects: 18 },
//     { name: 'Jun', chats: 88, projects: 14 },
//   ];

//   const pieData = [
//     { name: 'Text Analysis', value: 35, color: '#8884d8' },
//     { name: 'Image Processing', value: 25, color: '#82ca9d' },
//     { name: 'Data Generation', value: 20, color: '#ffc658' },
//     { name: 'Code Assistant', value: 20, color: '#ff7c7c' },
//   ];

//   const renderOverview = () => (
//     <div className="space-y-6">
//       <div className="flex items-center justify-between">
//         <h2 className="text-2xl font-bold">Workspace Overview</h2>
//         <Button>
//           <Plus className="w-4 h-4 mr-2" />
//           New Project
//         </Button>
//       </div>

//       {/* Stats Grid */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
//             <FolderOpen className="h-4 w-4 text-muted-foreground" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">{stats.totalProjects}</div>
//             <p className="text-xs text-muted-foreground">
//               +2 from last month
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
//             <Bot className="h-4 w-4 text-muted-foreground" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">{stats.activeChats}</div>
//             <p className="text-xs text-muted-foreground">
//               +12% from last week
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Team Members</CardTitle>
//             <Users className="h-4 w-4 text-muted-foreground" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">{stats.teamMembers}</div>
//             <p className="text-xs text-muted-foreground">
//               2 new this month
//             </p>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Charts */}
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         <Card>
//           <CardHeader>
//             <CardTitle>Activity Overview</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <ResponsiveContainer width="100%" height={300}>
//               <BarChart data={chartData}>
//                 <CartesianGrid strokeDasharray="3 3" />
//                 <XAxis dataKey="name" />
//                 <YAxis />
//                 <Tooltip />
//                 <Bar dataKey="chats" fill="#8884d8" name="Chats" />
//                 <Bar dataKey="projects" fill="#82ca9d" name="Projects" />
//               </BarChart>
//             </ResponsiveContainer>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>AI Tool Usage</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <ResponsiveContainer width="100%" height={300}>
//               <PieChart>
//                 <Pie
//                   data={pieData}
//                   cx="50%"
//                   cy="50%"
//                   outerRadius={80}
//                   dataKey="value"
//                   label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
//                 >
//                   {pieData.map((entry, index) => (
//                     <Cell key={`cell-${index}`} fill={entry.color} />
//                   ))}
//                 </Pie>
//                 <Tooltip />
//               </PieChart>
//             </ResponsiveContainer>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );

//   const renderProjects = () => (
//     <div className="space-y-6">
//       <div className="flex items-center justify-between">
//         <h2 className="text-2xl font-bold">Projects</h2>
//         <Button>
//           <Plus className="w-4 h-4 mr-2" />
//           New Project
//         </Button>
//       </div>

//       <div className="flex gap-4">
//         <div className="relative flex-1">
//           <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//           <Input placeholder="Search projects..." className="pl-10" />
//         </div>
//         <Button variant="outline">
//           <Filter className="w-4 h-4 mr-2" />
//           Filter
//         </Button>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//         {[
//           { name: 'AI Chatbot Development', status: 'Active', progress: 75, members: 3 },
//           { name: 'Data Analysis Pipeline', status: 'In Review', progress: 90, members: 2 },
//           { name: 'Content Generation Tool', status: 'Planning', progress: 25, members: 4 },
//           { name: 'Customer Support Bot', status: 'Active', progress: 60, members: 2 },
//           { name: 'Document Summarizer', status: 'Completed', progress: 100, members: 1 },
//           { name: 'Image Recognition API', status: 'On Hold', progress: 45, members: 3 },
//         ].map((project, index) => (
//           <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
//             <CardHeader>
//               <div className="flex items-center justify-between">
//                 <CardTitle className="text-base">{project.name}</CardTitle>
//                 <Badge variant={
//                   project.status === 'Active' ? 'default' :
//                   project.status === 'Completed' ? 'secondary' :
//                   project.status === 'In Review' ? 'outline' : 'destructive'
//                 }>
//                   {project.status}
//                 </Badge>
//               </div>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-3">
//                 <div>
//                   <div className="flex justify-between text-sm mb-1">
//                     <span>Progress</span>
//                     <span>{project.progress}%</span>
//                   </div>
//                   <Progress value={project.progress} className="h-2" />
//                 </div>
//                 <div className="flex items-center justify-between text-sm text-muted-foreground">
//                   <div className="flex items-center">
//                     <Users className="w-4 h-4 mr-1" />
//                     {project.members} members
//                   </div>
//                   <div className="flex items-center">
//                     <Clock className="w-4 h-4 mr-1" />
//                     2 days ago
//                   </div>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         ))}
//       </div>
//     </div>
//   );

//   const renderSection = () => {
//     switch (section) {
//       case 'overview':
//         return renderOverview();
//       case 'projects':
//         return renderProjects();
//       case 'team':
//         return (
//           <div className="space-y-6">
//             <h2 className="text-2xl font-bold">Team Management</h2>
//             <p className="text-muted-foreground">Team management features coming soon...</p>
//           </div>
//         );
//       case 'ai-tools':
//         return (
//           <div className="space-y-6">
//             <h2 className="text-2xl font-bold">AI Tools</h2>
//             <p className="text-muted-foreground">AI tools dashboard coming soon...</p>
//           </div>
//         );
//       case 'files':
//         return (
//           <div className="space-y-6">
//             <h2 className="text-2xl font-bold">File Management</h2>
//             <p className="text-muted-foreground">File management system coming soon...</p>
//           </div>
//         );
//       case 'analytics':
//         return (
//           <div className="space-y-6">
//             <h2 className="text-2xl font-bold">Analytics</h2>
//             <p className="text-muted-foreground">Advanced analytics coming soon...</p>
//           </div>
//         );
//       default:
//         return renderOverview();
//     }
//   };

//   return (
//     <div className="flex-1 overflow-auto">
//       <div className="p-6">
//         {renderSection()}
//       </div>
//     </div>
//   );
// }

import React from 'react';
import { 
  BarChart3, 
  Users, 
  FolderOpen, 
  Bot, 
  FileText, 
  TrendingUp,
  Calendar,
  Clock,
  Plus,
  Filter,
  Search
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

type WorkspaceSection = 'overview' | 'projects' | 'team' | 'ai-tools' | 'files' | 'analytics';

interface WorkspaceProps {
  section: WorkspaceSection;
}

export function Workspace({ section }: WorkspaceProps) {
  // Mock data
  const stats = {
    totalProjects: 12,
    activeChats: 48,
    teamMembers: 6,
    aiTools: 15,
    totalFiles: 234,
    storageUsed: 68
  };

  const chartData = [
    { name: 'Jan', chats: 65, projects: 8 },
    { name: 'Feb', chats: 59, projects: 12 },
    { name: 'Mar', chats: 80, projects: 15 },
    { name: 'Apr', chats: 81, projects: 10 },
    { name: 'May', chats: 95, projects: 18 },
    { name: 'Jun', chats: 88, projects: 14 },
  ];

  const pieData = [
    { name: 'Text Analysis', value: 35, color: '#8884d8' },
    { name: 'Image Processing', value: 25, color: '#82ca9d' },
    { name: 'Data Generation', value: 20, color: '#ffc658' },
    { name: 'Code Assistant', value: 20, color: '#ff7c7c' },
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Workspace Overview</h2>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeChats}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.teamMembers}</div>
            <p className="text-xs text-muted-foreground">
              2 new this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Activity Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="chats" fill="#8884d8" name="Chats" />
                <Bar dataKey="projects" fill="#82ca9d" name="Projects" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Tool Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderProjects = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Projects</h2>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search projects..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { name: 'AI Chatbot Development', status: 'Active', progress: 75, members: 3 },
          { name: 'Data Analysis Pipeline', status: 'In Review', progress: 90, members: 2 },
          { name: 'Content Generation Tool', status: 'Planning', progress: 25, members: 4 },
          { name: 'Customer Support Bot', status: 'Active', progress: 60, members: 2 },
          { name: 'Document Summarizer', status: 'Completed', progress: 100, members: 1 },
          { name: 'Image Recognition API', status: 'On Hold', progress: 45, members: 3 },
        ].map((project, index) => (
          <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{project.name}</CardTitle>
                <Badge variant={
                  project.status === 'Active' ? 'default' :
                  project.status === 'Completed' ? 'secondary' :
                  project.status === 'In Review' ? 'outline' : 'destructive'
                }>
                  {project.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {project.members} members
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    2 days ago
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return renderOverview();
      case 'projects':
        return renderProjects();
      case 'team':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Team Management</h2>
            <p className="text-muted-foreground">Team management features coming soon...</p>
          </div>
        );
      case 'ai-tools':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">AI Tools</h2>
            <p className="text-muted-foreground">AI tools dashboard coming soon...</p>
          </div>
        );
      case 'files':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">File Management</h2>
            <p className="text-muted-foreground">File management system coming soon...</p>
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Analytics</h2>
            <p className="text-muted-foreground">Advanced analytics coming soon...</p>
          </div>
        );
      default:
        return renderOverview();
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        {renderSection()}
      </div>
    </div>
  );
}