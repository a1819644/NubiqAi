import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Search, Brain, Plus, Trash2, FileText, MessageSquare, StickyNote } from 'lucide-react';

interface Memory {
  id: string;
  content: string;
  score?: number;
  metadata: {
    timestamp: number;
    type: 'conversation' | 'document' | 'note';
    source?: string;
    userId?: string;
    tags?: string[];
  };
}

interface MemoryStats {
  totalVectors: number;
  indexDimension: number;
}

export const MemoryManager: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryTags, setNewMemoryTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock user ID - in real app, get from auth context
  const userId = 'demo-user-123';

  const loadMemoryStats = async () => {
    try {
      const response = await apiService.getMemoryStats();
      if (response.success) {
        setStats(response.data.stats);
      }
    } catch (err: any) {
      console.error('Failed to load memory stats:', err);
    }
  };

  const searchMemories = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.searchMemories({
        query: searchQuery,
        topK: 10,
        threshold: 0.6,
        userId
      });
      
      if (response.success) {
        setMemories(response.data.results);
      } else {
        setError('Search failed');
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const addMemory = async () => {
    if (!newMemoryContent.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const tags = newMemoryTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      const response = await apiService.storeMemory({
        content: newMemoryContent,
        type: 'note',
        userId,
        tags
      });
      
      if (response.success) {
        setNewMemoryContent('');
        setNewMemoryTags('');
        // Refresh search if there's a query
        if (searchQuery.trim()) {
          await searchMemories();
        }
        await loadMemoryStats();
      } else {
        setError('Failed to store memory');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to store memory');
    } finally {
      setLoading(false);
    }
  };

  const deleteMemory = async (memoryId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.deleteMemory(memoryId);
      if (response.success) {
        setMemories(prev => prev.filter(m => m.id !== memoryId));
        await loadMemoryStats();
      } else {
        setError('Failed to delete memory');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete memory');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'conversation':
        return <MessageSquare className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      case 'note':
      default:
        return <StickyNote className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'conversation':
        return 'bg-blue-100 text-blue-800';
      case 'document':
        return 'bg-green-100 text-green-800';
      case 'note':
      default:
        return 'bg-purple-100 text-purple-800';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    loadMemoryStats();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="w-6 h-6 text-purple-600" />
        <h1 className="text-2xl font-bold">Memory Manager</h1>
      </div>

      {/* Stats Card */}
      {stats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Memory Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Memories</p>
                <p className="text-2xl font-bold">{stats.totalVectors}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Vector Dimensions</p>
                <p className="text-2xl font-bold">{stats.indexDimension}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Memory Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New Memory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter memory content..."
            value={newMemoryContent}
            onChange={(e) => setNewMemoryContent(e.target.value)}
            rows={3}
          />
          <Input
            placeholder="Tags (comma-separated)"
            value={newMemoryTags}
            onChange={(e) => setNewMemoryTags(e.target.value)}
          />
          <Button 
            onClick={addMemory} 
            disabled={loading || !newMemoryContent.trim()}
            className="w-full"
          >
            {loading ? 'Storing...' : 'Store Memory'}
          </Button>
        </CardContent>
      </Card>

      {/* Search Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Memories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search your memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchMemories()}
            />
            <Button 
              onClick={searchMemories} 
              disabled={loading || !searchQuery.trim()}
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {memories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Search Results ({memories.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {memories.map((memory) => (
                <div key={memory.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={`${getTypeColor(memory.metadata.type)} flex items-center gap-1`}
                      >
                        {getTypeIcon(memory.metadata.type)}
                        {memory.metadata.type}
                      </Badge>
                      {memory.score && (
                        <Badge variant="outline">
                          {(memory.score * 100).toFixed(1)}% match
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMemory(memory.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {memory.content}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatTimestamp(memory.metadata.timestamp)}</span>
                    {memory.metadata.tags && memory.metadata.tags.length > 0 && (
                      <div className="flex gap-1">
                        {memory.metadata.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {memory.metadata.source && (
                    <div className="text-xs text-gray-500">
                      Source: {memory.metadata.source}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Tips */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Usage Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• <strong>Conversations:</strong> Automatically stored when chatting with AI</p>
          <p>• <strong>Documents:</strong> Store processed document content for future reference</p>
          <p>• <strong>Notes:</strong> Manual entries for preferences, facts, or reminders</p>
          <p>• <strong>Search:</strong> Use natural language to find relevant memories</p>
          <p>• <strong>Tags:</strong> Organize memories with custom tags for better filtering</p>
        </CardContent>
      </Card>
    </div>
  );
};