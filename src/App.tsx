/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Image as ImageIcon, 
  History, 
  Plus, 
  Download, 
  Copy, 
  Loader2, 
  Search,
  LayoutGrid,
  ChevronRight,
  User,
  LogOut,
  Send,
  MessageSquare,
  Sparkles,
  Settings,
  BarChart3,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  preferences?: {
    theme: string;
    notifications_enabled: number;
    language: string;
  };
}

interface GeneratedImage {
  id: string;
  prompt: string;
  model: string;
  aspect_ratio: string;
  image_size: string;
  thinking: string;
  image_data: string;
  created_at: string;
  admin_name: string;
}

interface Stats {
  total_images: number;
  today_images: number;
  estimated_cost_usd: string;
}

interface AdminStats {
  users: number;
  threads: number;
  messages: number;
  images: {
    total: number;
    today: number;
    cost: string;
  };
}

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'generate' | 'history' | 'admin'>('chat');
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Chat state
  const [chatThreads, setChatThreads] = useState<any[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Form state
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gemini-3-pro-image-preview');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [imageSize, setImageSize] = useState('1K');
  const [useSearch, setUseSearch] = useState(false);
  const [result, setResult] = useState<{ image: string; thinking: string } | null>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/user/me');
      const data = await res.json();
      setUser(data);
      if (data.role === 'admin') {
        fetchStats();
        fetchHistory();
        fetchThreads();
        fetchAdminStats();
      }
    } catch (err) {
      console.error("Failed to fetch user", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setAdminStats(data);
    } catch (err) {
      console.error("Failed to fetch admin stats", err);
    }
  };

  const fetchThreads = async () => {
    try {
      const res = await fetch('/api/chats');
      const data = await res.json();
      setChatThreads(data);
    } catch (err) {
      console.error("Failed to fetch threads", err);
    }
  };

  const fetchMessages = async (id: string) => {
    try {
      const res = await fetch(`/api/chats/${id}`);
      const data = await res.json();
      setMessages(data);
      setCurrentThreadId(id);
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    setSendingChat(true);
    const userMsg = chatInput;
    setChatInput('');
    
    // Optimistic update
    const tempId = Math.random().toString();
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: userMsg }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, threadId: currentThreadId })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        setMessages(prev => prev.filter(m => m.id !== tempId));
      } else {
        setMessages(prev => [...prev.filter(m => m.id !== tempId), { id: Math.random().toString(), role: 'user', content: userMsg }, { id: Math.random().toString(), role: 'assistant', content: data.response }]);
        if (!currentThreadId) {
          setCurrentThreadId(data.threadId);
          fetchThreads();
        }
      }
    } catch (err) {
      console.error("Chat error", err);
    } finally {
      setSendingChat(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/images/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/admin/images');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model,
          aspectRatio,
          imageSize,
          useGoogleSearch: useSearch
        })
      });
      const data = await res.json();
      if (data.success) {
        setResult({ image: data.image, thinking: data.thinking });
        fetchStats();
        fetchHistory();
      } else {
        alert(data.error || "Generation failed");
      }
    } catch (err) {
      console.error("Generation error", err);
      alert("An error occurred during generation");
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = (base64: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = `familia-ai-${Date.now()}.png`;
    link.click();
  };

  const copyToClipboard = async (base64: string) => {
    try {
      const response = await fetch(base64);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      alert("Copied to clipboard!");
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#10a37f] animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#2f2f2f] border border-white/10 rounded-2xl p-8 text-center shadow-xl">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-white mb-2">Access Denied</h1>
          <p className="text-[#b4b4b4] mb-6">
            Only administrators can access the Familia AI professional panel.
          </p>
          <div className="text-xs text-zinc-500 font-mono">
            Current Role: {user?.role || 'Guest'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#212121] text-[#ececec] font-sans">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="pro-sidebar flex flex-col h-full overflow-hidden"
          >
            <div className="p-3 flex flex-col h-full">
              <button 
                onClick={() => { setCurrentThreadId(null); setMessages([]); setActiveTab('chat'); }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition-colors border border-white/10 mb-4"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">New chat</span>
              </button>

              <nav className="flex-1 overflow-y-auto space-y-1">
                <div className="text-[10px] font-semibold text-zinc-500 uppercase px-3 py-2 tracking-wider">Navigation</div>
                <button 
                  onClick={() => setActiveTab('chat')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'chat' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat Hub</span>
                </button>
                <button 
                  onClick={() => setActiveTab('generate')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'generate' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Art Lab</span>
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'history' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <History className="w-4 h-4" />
                  <span>Gallery</span>
                </button>
                <button 
                  onClick={() => setActiveTab('admin')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'admin' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Admin Panel</span>
                </button>

                {activeTab === 'chat' && chatThreads.length > 0 && (
                  <>
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase px-3 py-2 mt-6 tracking-wider">Recent Chats</div>
                    {chatThreads.map(t => (
                      <button 
                        key={t.id}
                        onClick={() => fetchMessages(t.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left truncate ${currentThreadId === t.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                      >
                        <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-50" />
                        <span className="truncate">{t.title || 'Untitled Chat'}</span>
                      </button>
                    ))}
                  </>
                )}
              </nav>

              <div className="mt-auto pt-4 border-t border-white/10">
                <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-[#10a37f] flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-medium truncate">{user.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{user.email}</div>
                  </div>
                  <Settings className="w-4 h-4 text-zinc-500" />
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <Menu className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="text-sm font-medium">Familia AI <span className="text-zinc-500 font-normal">Oropeza Edition</span></div>
          <div className="w-9" /> {/* Spacer */}
        </header>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div 
                key="chat-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-3xl mx-auto w-full h-full flex flex-col"
              >
                <div className="flex-1 p-4 space-y-8 pb-32">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 pt-20">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-[#10a37f]" />
                      </div>
                      <h2 className="text-3xl font-semibold">How can I help you today?</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                        <button onClick={() => setChatInput("What's the latest news in ai.oropezas.com?")} className="pro-card p-4 text-left text-sm">
                          <div className="font-medium mb-1">Domain Status</div>
                          <div className="text-zinc-500">Check the latest updates for our family domain.</div>
                        </button>
                        <button onClick={() => setChatInput("Generate a family portrait in 4K")} className="pro-card p-4 text-left text-sm">
                          <div className="font-medium mb-1">Create Art</div>
                          <div className="text-zinc-500">Use the Art Lab to generate high-quality images.</div>
                        </button>
                      </div>
                    </div>
                  ) : (
                    messages.map((m, i) => (
                      <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-[#10a37f] flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                            AI
                          </div>
                        )}
                        <div className={m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap markdown-body">
                            {m.content}
                          </div>
                        </div>
                        {m.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-[10px] font-bold uppercase">
                            {user.name.charAt(0)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {sendingChat && (
                    <div className="flex gap-4 justify-start">
                      <div className="w-8 h-8 rounded-full bg-[#10a37f] flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                        AI
                      </div>
                      <div className="chat-bubble-ai">
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#212121] via-[#212121] to-transparent">
                  <div className="max-w-3xl mx-auto relative">
                    <textarea 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())}
                      placeholder="Message Familia AI..."
                      className="w-full pro-input pr-12 min-h-[52px] max-h-40 py-3.5 resize-none overflow-hidden"
                      rows={1}
                      style={{ height: 'auto' }}
                    />
                    <button 
                      onClick={handleSendChat}
                      disabled={sendingChat || !chatInput.trim()}
                      className="absolute right-2 bottom-2 p-2 rounded-lg bg-white text-black disabled:bg-white/10 disabled:text-zinc-500 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <div className="text-[10px] text-center text-zinc-500 mt-2">
                      Familia AI can make mistakes. Check important info.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'generate' && (
              <motion.div 
                key="generate-tab"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="max-w-4xl mx-auto w-full p-6 space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">Art Lab</h2>
                  <div className="flex gap-2">
                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-zinc-400">
                      {stats?.today_images || 0} Generated Today
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-2 block">Model Engine</label>
                        <select value={model} onChange={e => setModel(e.target.value)} className="w-full pro-input text-sm">
                          <option value="gemini-3-pro-image-preview">Nano Banana Pro (4K)</option>
                          <option value="gemini-2.5-flash-image">Nano Banana (Fast)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-zinc-500 mb-2 block">Aspect Ratio</label>
                          <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full pro-input text-sm">
                            <option value="1:1">1:1 Square</option>
                            <option value="16:9">16:9 Wide</option>
                            <option value="9:16">9:16 Vertical</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-500 mb-2 block">Resolution</label>
                          <select value={imageSize} onChange={e => setImageSize(e.target.value)} className="w-full pro-input text-sm">
                            <option value="1K">1K (SD)</option>
                            <option value="2K">2K (HD)</option>
                            <option value="4K">4K (UHD)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                        <input type="checkbox" id="search-gen" checked={useSearch} onChange={e => setUseSearch(e.target.checked)} className="w-4 h-4 accent-[#10a37f]" />
                        <label htmlFor="search-gen" className="text-xs font-medium text-zinc-300 cursor-pointer">Google Search Grounding</label>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-4">
                      <label className="text-xs font-medium text-zinc-500 mb-2 block">Creative Prompt</label>
                      <textarea 
                        value={prompt} 
                        onChange={e => setPrompt(e.target.value)} 
                        className="w-full pro-input h-32 resize-none text-sm" 
                        placeholder="A futuristic family home on ai.oropezas.com..."
                      />
                      <button 
                        onClick={handleGenerate} 
                        disabled={generating || !prompt} 
                        className="w-full pro-btn-primary h-12 flex items-center justify-center gap-2"
                      >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {generating ? 'Generating...' : 'Generate Masterpiece'}
                      </button>
                    </div>

                    {result && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="relative group rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                          <img src={result.image} className="w-full" alt="Generated" />
                          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => downloadImage(result.image)} className="p-2 bg-black/50 backdrop-blur-md rounded-lg hover:bg-black/70 transition-colors">
                              <Download className="w-4 h-4" />
                            </button>
                            <button onClick={() => copyToClipboard(result.image)} className="p-2 bg-black/50 backdrop-blur-md rounded-lg hover:bg-black/70 transition-colors">
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {result.thinking && (
                          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-[10px] font-semibold text-zinc-500 uppercase mb-2">AI Thought Process</div>
                            <p className="text-xs text-zinc-400 italic leading-relaxed">"{result.thinking}"</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history-tab"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-6xl mx-auto w-full p-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-semibold">Generation Gallery</h2>
                  <div className="text-sm text-zinc-500">{history.length} Total Generations</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {history.map(img => (
                    <div key={img.id} className="pro-card overflow-hidden group">
                      <div className="aspect-video relative">
                        <img src={`data:image/png;base64,${img.image_data}`} className="w-full h-full object-cover" alt="History" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button onClick={() => downloadImage(`data:image/png;base64,${img.image_data}`)} className="p-2 bg-white text-black rounded-lg hover:scale-105 transition-transform">
                            <Download className="w-4 h-4" />
                          </button>
                          <button onClick={() => copyToClipboard(`data:image/png;base64,${img.image_data}`)} className="p-2 bg-white text-black rounded-lg hover:scale-105 transition-transform">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-zinc-300 line-clamp-2 mb-3">"{img.prompt}"</p>
                        <div className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
                          <span>{new Date(img.created_at).toLocaleDateString()}</span>
                          <span className="text-[#10a37f]">{img.admin_name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'admin' && (
              <motion.div 
                key="admin-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="max-w-5xl mx-auto w-full p-6 space-y-8"
              >
                <h2 className="text-2xl font-semibold">Admin Dashboard</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="pro-card p-6">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase mb-2">Total Users</div>
                    <div className="text-3xl font-semibold">{adminStats?.users || 0}</div>
                  </div>
                  <div className="pro-card p-6">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase mb-2">Chat Threads</div>
                    <div className="text-3xl font-semibold">{adminStats?.threads || 0}</div>
                  </div>
                  <div className="pro-card p-6">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase mb-2">Total Messages</div>
                    <div className="text-3xl font-semibold">{adminStats?.messages || 0}</div>
                  </div>
                  <div className="pro-card p-6 border-[#10a37f]/30">
                    <div className="text-[10px] font-semibold text-[#10a37f] uppercase mb-2">Total Art</div>
                    <div className="text-3xl font-semibold">{adminStats?.images.total || 0}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="pro-card p-6">
                    <h3 className="text-lg font-medium mb-6">System Health</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                        <div className="text-sm">Gemini API Status</div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs text-emerald-500">Operational</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                        <div className="text-sm">Database Latency</div>
                        <div className="text-xs text-zinc-500">12ms</div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                        <div className="text-sm">Storage Usage</div>
                        <div className="text-xs text-zinc-500">1.2 GB / 10 GB</div>
                      </div>
                    </div>
                  </div>

                  <div className="pro-card p-6">
                    <h3 className="text-lg font-medium mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="pro-btn-secondary text-xs py-3">Clear Cache</button>
                      <button 
                        onClick={async () => {
                          const res = await fetch('/api/admin/test-email', { method: 'POST' });
                          const data = await res.json();
                          if (data.success) alert("Test email sent!");
                          else alert("Error: " + data.error);
                        }}
                        className="pro-btn-secondary text-xs py-3"
                      >
                        Send Test Email
                      </button>
                      <button className="pro-btn-secondary text-xs py-3">Update Config</button>
                      <button className="pro-btn-secondary text-xs py-3 border-red-500/30 text-red-500 hover:bg-red-500/5">Maintenance Mode</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
