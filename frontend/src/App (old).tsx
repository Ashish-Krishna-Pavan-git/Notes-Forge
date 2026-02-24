import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { 
  FileText, 
  Settings, 
  Download, 
  Sparkles, 
  Type, 
  Code, 
  List, 
  Table, 
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Zap,
  Eye,
  BarChart3,
  Terminal,
  AlignLeft,
  Hash,
  Quote,
  Image as ImageIcon
} from 'lucide-react';

// API base URL
const API_URL = 'http://localhost:8000';

// Types
interface Classification {
  line_number: number;
  original: string;
  type: string;
  content: string;
}

interface AnalysisResult {
  success: boolean;
  lines_analyzed: number;
  classifications: Classification[];
  statistics: Record<string, number>;
}

interface Theme {
  name: string;
  description?: string;
}

// Type badge colors
const typeColors: Record<string, string> = {
  h1: 'bg-orange-500',
  h2: 'bg-orange-400',
  h3: 'bg-blue-600',
  h4: 'bg-blue-500',
  h5: 'bg-blue-400',
  h6: 'bg-blue-300',
  paragraph: 'bg-gray-500',
  theory: 'bg-green-500',
  bullet: 'bg-purple-500',
  numbered: 'bg-purple-400',
  code: 'bg-slate-700',
  command: 'bg-slate-600',
  table: 'bg-teal-500',
  ascii_diagram: 'bg-pink-500',
  quote: 'bg-yellow-500',
  label: 'bg-indigo-500',
  subheading: 'bg-cyan-500',
  filepath: 'bg-amber-500',
  formula: 'bg-rose-500',
  unknown: 'bg-gray-400'
};

const typeIcons: Record<string, React.ReactNode> = {
  h1: <Hash className="w-3 h-3" />,
  h2: <Hash className="w-3 h-3" />,
  h3: <Hash className="w-3 h-3" />,
  h4: <Hash className="w-3 h-3" />,
  h5: <Hash className="w-3 h-3" />,
  h6: <Hash className="w-3 h-3" />,
  paragraph: <AlignLeft className="w-3 h-3" />,
  theory: <FileText className="w-3 h-3" />,
  bullet: <List className="w-3 h-3" />,
  numbered: <List className="w-3 h-3" />,
  code: <Code className="w-3 h-3" />,
  command: <Terminal className="w-3 h-3" />,
  table: <Table className="w-3 h-3" />,
  ascii_diagram: <ImageIcon className="w-3 h-3" />,
  quote: <Quote className="w-3 h-3" />,
  label: <CheckCircle className="w-3 h-3" />,
  subheading: <Type className="w-3 h-3" />,
  filepath: <Terminal className="w-3 h-3" />,
  formula: <Zap className="w-3 h-3" />
};

function App() {
  const [inputText, setInputText] = useState<string>(`NETWORK TOPOLOGIES - Understanding Network Architecture

Network topology refers to the arrangement of different elements (links, nodes, etc.) in a computer network. It defines how devices are connected and how data flows between them.

Key Characteristics:
- Physical layout of network devices
- Logical connection patterns
- Data transmission paths
  - Direct connections
  - Multi-hop routing
    - Optimal path selection

Types of Network Topologies:
1. Bus Topology
All devices connected to a single central cable called the bus.

Advantages:
- Easy to install
- Cost effective for small networks
- Simple cable layout

Disadvantages:
- Single point of failure
- Difficult to troubleshoot
- Limited scalability

Example:
     ┌─────┐     ┌─────┐     ┌─────┐
     │ PC1 │─────│ PC2 │─────│ PC3 │
     └─────┘     └─────┘     └─────┘

2. Star Topology
All devices connected to a central hub or switch.

Commands:
$ ifconfig
$ ping 192.168.1.1
$ netstat -an

Important Note:
Star topology is most commonly used in modern LANs due to its reliability and ease of management.`);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<'docx' | 'pdf'>('docx');
  const [selectedTheme, setSelectedTheme] = useState<string>('professional');
  const [themes, setThemes] = useState<Record<string, Theme>>({});
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'settings'>('editor');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check backend status
  useEffect(() => {
    checkBackendStatus();
    fetchThemes();
  }, []);

  const checkBackendStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/`);
      if (response.data.status === 'online') {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  const fetchThemes = async () => {
    try {
      const response = await axios.get(`${API_URL}/themes`);
      setThemes(response.data);
    } catch (err) {
      console.error('Failed to fetch themes:', err);
    }
  };

  // Debounced analysis
  const analyzeText = useCallback(async (text: string) => {
    if (!text.trim()) {
      setAnalysis(null);
      return;
    }

    if (backendStatus !== 'online') {
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/analyze`, { text });
      setAnalysis(response.data);
      setError(null);
    } catch (err) {
      console.error('Analysis error:', err);
    }
  }, [backendStatus]);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputText) {
        analyzeText(inputText);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputText, analyzeText]);

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text first');
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await axios.post(`${API_URL}/generate`, {
        text: inputText,
        format: outputFormat,
        theme: selectedTheme
      });

      if (response.data.success) {
        // Download the file
        const downloadResponse = await axios.get(`${API_URL}${response.data.download_url}`, {
          responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([downloadResponse.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', response.data.filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setSuccess(`✅ Document generated successfully! Downloaded: ${response.data.filename}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate document');
    } finally {
      setGenerating(false);
    }
  };

  const clearText = () => {
    setInputText('');
    setAnalysis(null);
    textareaRef.current?.focus();
  };

  const loadSample = () => {
    const sample = `DOCUMENT FORMATTING GUIDE - Professional Structure

This guide demonstrates all the formatting capabilities of NotesForge Professional. The system automatically detects and formats various content types.

Main Features:
- Automatic heading detection (H1-H6)
- Code block formatting with syntax highlighting
- Table generation from text
- Bullet points with multi-level nesting
  - Level 2 indentation
    - Level 3 indentation
- ASCII diagram centering

Code Example:
def process_data(input_text):
    """Process and analyze input text"""
    lines = input_text.split('\\n')
    results = []
    for line in lines:
        if line.strip():
            results.append(analyze(line))
    return results

System Commands:
$ git clone https://github.com/user/repo.git
$ npm install
$ python manage.py runserver
$ docker-compose up -d

Data Table:

Name        Role        Experience    Salary
Alice       Developer   5 years       $75,000
Bob         Designer    3 years       $65,000
Charlie     Manager     8 years       $95,000

Network Architecture:

        ┌─────────────┐
        │   Router    │
        └──────┬──────┘
               │
      ┌────────┼────────┐
      │        │        │
 ┌────┴───┐ ┌──┴───┐ ┌──┴───┐
 │ Switch │ │Server│ │  PC  │
 └────────┘ └──────┘ └──────┘

Important Notes:
1. Always backup your data before processing
2. Use proper indentation for nested lists
3. Include blank lines between sections

Formula Example:
E = mc²

File Paths:
/home/user/documents/report.docx
C:\\Users\\Admin\\Desktop\\file.txt

That's the complete guide!`;
    setInputText(sample);
  };

  const getTypeColor = (type: string) => typeColors[type] || 'bg-gray-400';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">NotesForge Professional</h1>
                <p className="text-sm text-white/80">Intelligent Document Formatter</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Backend Status */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                backendStatus === 'online' 
                  ? 'bg-green-500/20 border border-green-400/30' 
                  : backendStatus === 'checking'
                  ? 'bg-yellow-500/20 border border-yellow-400/30'
                  : 'bg-red-500/20 border border-red-400/30'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  backendStatus === 'online' 
                    ? 'bg-green-400 animate-pulse' 
                    : backendStatus === 'checking'
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                }`} />
                <span className="text-xs font-medium">
                  {backendStatus === 'online' ? 'Connected' : backendStatus === 'checking' ? 'Connecting...' : 'Offline'}
                </span>
              </div>

              <button
                onClick={() => setActiveTab('settings')}
                className={`p-2 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'editor', label: 'Editor', icon: Type },
            { id: 'preview', label: 'Live Preview', icon: Eye },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">
              ×
            </button>
          </div>
        )}

        {/* Editor Tab */}
        {activeTab === 'editor' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Area */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-700">Input Text</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={loadSample}
                      className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Load Sample
                    </button>
                    <button
                      onClick={clearText}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your text here... NotesForge will automatically detect headings, code, tables, and more!"
                  className="w-full h-96 p-4 resize-none focus:outline-none font-mono text-sm leading-relaxed"
                  spellCheck={false}
                />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !inputText.trim() || backendStatus !== 'online'}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Generate {outputFormat.toUpperCase()}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Statistics Panel */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-800">Document Statistics</h3>
                </div>

                {analysis ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-blue-600">{analysis.lines_analyzed}</div>
                        <div className="text-xs text-blue-600/70">Lines</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-purple-600">
                          {Object.keys(analysis.statistics).length}
                        </div>
                        <div className="text-xs text-purple-600/70">Types</div>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {Object.entries(analysis.statistics)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${getTypeColor(type)}`} />
                              <span className="text-sm capitalize text-gray-700">{type.replace(/_/g, ' ')}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Start typing to see statistics</p>
                  </div>
                )}
              </div>

              {/* Quick Tips */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
                <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Quick Tips
                </h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• ALL CAPS = H1 heading</li>
                  <li>• "Topic - Subtitle" = H2</li>
                  <li>• 1. Topic: = H3</li>
                  <li>• - Bullet point</li>
                  <li>• $ command = Code block</li>
                  <li>• 3+ spaces = Table column</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-700">Live Preview</span>
              </div>
              {analysis && (
                <span className="text-sm text-gray-500">
                  {analysis.lines_analyzed} lines analyzed
                </span>
              )}
            </div>
            
            {analysis ? (
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-16">#</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-32">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Content</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analysis.classifications.map((item, idx) => (
                      <tr 
                        key={idx} 
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-4 py-2 text-sm text-gray-400">{item.line_number}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium text-white ${getTypeColor(item.type)}`}>
                            {typeIcons[item.type]}
                            {item.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 font-mono truncate max-w-md">
                          {item.content || '(empty)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <Eye className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Enter text in the Editor tab to see live preview</p>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Output Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Output Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Output Format</label>
                  <div className="flex gap-3">
                    {(['docx', 'pdf'] as const).map((format) => (
                      <button
                        key={format}
                        onClick={() => setOutputFormat(format)}
                        className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-all ${
                          outputFormat === format
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                  <select
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.entries(themes).map(([key, theme]) => (
                      <option key={key} value={key}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                  {themes[selectedTheme]?.description && (
                    <p className="mt-1 text-sm text-gray-500">{themes[selectedTheme].description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* API Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-600" />
                Backend Status
              </h3>
              
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  backendStatus === 'online' 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      backendStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className={`font-medium ${
                        backendStatus === 'online' ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {backendStatus === 'online' ? 'Backend Online' : 'Backend Offline'}
                      </p>
                      <p className={`text-sm ${
                        backendStatus === 'online' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {backendStatus === 'online' 
                          ? 'Connected to http://localhost:8000' 
                          : 'Cannot connect to backend server'}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={checkBackendStatus}
                  className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Connection
                </button>

                {backendStatus === 'offline' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>Troubleshooting:</strong>
                    </p>
                    <ol className="text-sm text-amber-700 mt-2 space-y-1 list-decimal list-inside">
                      <li>Make sure Python backend is running</li>
                      <li>Double-click START.bat to start servers</li>
                      <li>Check that port 8000 is not in use</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span>NotesForge Professional v3.0</span>
              <span>•</span>
              <span>FastAPI + React</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Backend: {API_URL}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
+
"""
{
import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Sparkles, FileText, Settings, BookOpen, Download, Moon, Sun, Grid,
  Maximize2, Minimize2, Undo2, Redo2, Search, X, Save, RotateCcw,
  CheckCircle, AlertCircle, Loader2, BarChart3, Eye, Type, Code,
  List, Table, Hash, AlignLeft, Image as Img, Link, Highlighter,
  FileSignature, PaintBucket, Ruler, Layout, Palette, Clock,
  Plus, Trash2, Copy, Check, Bot, Pencil, Keyboard, Upload, Folder,
  Monitor, AlertTriangle, ImagePlus,
} from "lucide-react";

const API = "http://localhost:8000";

interface ClassRow { line_number:number; original:string; type:string; content:string; marker?:string; indent_level?:number }
interface AnalysisResult { success:boolean; total_lines:number; statistics:Record<string,number>; classifications:ClassRow[]; preview:ClassRow[] }
interface ThemeInfo { name:string; description:string; user_created:boolean; builtin:boolean }
interface MarkerError { line:number; column:number; message:string; severity:"error"|"warning" }
interface SavedDraft { id:string; name:string; content:string; savedAt:number }

const TYPE_COLOR:Record<string,string> = {
  h1:"bg-orange-500",h2:"bg-amber-500",h3:"bg-blue-600",h4:"bg-blue-500",
  h5:"bg-indigo-500",h6:"bg-purple-500",paragraph:"bg-gray-500",
  bullet:"bg-purple-600",numbered:"bg-purple-500",code:"bg-slate-700",
  table:"bg-teal-600",quote:"bg-yellow-600",note:"bg-green-600",
  image:"bg-pink-600",link:"bg-sky-600",highlight:"bg-yellow-500",
  footnote:"bg-gray-600",toc:"bg-orange-600",ascii:"bg-rose-600",
};
const TYPE_ICON:Record<string,React.ReactNode> = {
  h1:<Hash className="w-3 h-3"/>,h2:<Hash className="w-3 h-3"/>,
  h3:<Hash className="w-3 h-3"/>,paragraph:<AlignLeft className="w-3 h-3"/>,
  bullet:<List className="w-3 h-3"/>,code:<Code className="w-3 h-3"/>,
  table:<Table className="w-3 h-3"/>,image:<Img className="w-3 h-3"/>,
  link:<Link className="w-3 h-3"/>,highlight:<Highlighter className="w-3 h-3"/>,
  footnote:<FileSignature className="w-3 h-3"/>,toc:<BookOpen className="w-3 h-3"/>,
};
const VALID_MARKERS = [
  "HEADING","H1","SUBHEADING","H2","SUB-SUBHEADING","H3","H4","H5","H6",
  "PARAGRAPH","PARA","BULLET","NUMBERED","CODE","TABLE","QUOTE","NOTE",
  "IMPORTANT","IMAGE","LINK","HIGHLIGHT","FOOTNOTE","TOC","ASCII","DIAGRAM","LABEL"
];
// ── Hardcoded fallback prompt (shown even if backend offline) ──────
const FALLBACK_PROMPT = `You are NotesForge Formatter — an expert at transforming raw notes, images, or unstructured text into perfectly structured NotesForge marker format.

## YOUR TASK
Convert whatever the user provides into clean NotesForge marker syntax. The output is pasted directly into NotesForge to generate a professional Word document.

---

// (prompt truncated for brevity in UI — full prompt editable in app)
`;

const SHORTCUTS = [
  { group:"Editor", items:[
    { keys:["Ctrl","Z"],        desc:"Undo last change" },
    { keys:["Ctrl","Y"],        desc:"Redo (also Ctrl+Shift+Z)" },
    { keys:["Ctrl","F"],        desc:"Open Find & Replace panel" },
    { keys:["Ctrl","S"],        desc:"Generate & download document" },
    { keys:["Ctrl","A"],        desc:"Select all text in editor" },
  ]},
  { group:"Markers (type in editor)", items:[
    { keys:["HEADING:"],        desc:'"Title" — H1 main heading' },
    { keys:["SUBHEADING:"],     desc:'"Name" — H2 section' },
    { keys:["SUB-SUBHEADING:"], desc:'"Name" — H3 sub-section' },
    { keys:["PARAGRAPH:"],      desc:'"Text…" — body paragraph' },
    { keys:["BULLET:"],         desc:'"Point" or "  Indented" (2 spaces)' },
    { keys:["CODE:"],           desc:'"code line" — monospace block' },
    { keys:["TABLE:"],          desc:'"Col1 | Col2" — pipe separated' },
    { keys:["NOTE:"],           desc:'"Warning or tip"' },
    { keys:["QUOTE:"],          desc:'"Quoted text"' },
    { keys:["HIGHLIGHT:"],      desc:'"Text" | "yellow"' },
    { keys:["LINK:"],           desc:'"Label" | "https://url"' },
    { keys:["IMAGE:"],          desc:'"file.png" | "Caption" | "center"' },
    { keys:["FOOTNOTE:"],       desc:'"Source reference"' },
    { keys:["TOC:"],            desc:'Inserts table of contents' },
    { keys:["ASCII:"],          desc:'"─── diagram line ───"' },
  ]},
];

const TEMPLATES = [
  { id:"meeting", name:"Meeting Notes", category:"Business", icon:"📋", content:
`HEADING: "Meeting Notes - [Topic]"
PARAGRAPH: "Date: [Date]  |  Attendees: [Names]  |  Location: [Room]"

SUBHEADING: "Agenda"
BULLET: "[Item 1]"
BULLET: "[Item 2]"
BULLET: "[Item 3]"

SUBHEADING: "Discussion Points"
PARAGRAPH: "[Key points discussed during the meeting]"` },

  // other templates...
];

export default function App() {
  const [text, setText]           = useState("");
  const [history, setHistory]     = useState<string[]>([""]);
  const [hIdx, setHIdx]           = useState(0);
  const [analysis, setAnalysis]   = useState<AnalysisResult|null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [tab, setTab]                   = useState<"editor"|"templates"|"settings"|"prompt"|"shortcuts">("editor");
  const [settingsTab, setSettingsTab]   = useState<"themes"|"fonts"|"colors"|"spacing"|"page">("themes");
  const [dark, setDark]                 = useState(false);
  const [fullscreen, setFullscreen]     = useState(false);
  const [showSearch, setShowSearch]     = useState(false);
  const [searchQ, setSearchQ]           = useState("");
  const [replaceQ, setReplaceQ]         = useState("");

  const [generating, setGenerating]     = useState(false);
  const [format, setFormat]             = useState("docx");
  const [customName, setCustomName]     = useState("");

  const [error, setError]       = useState<string|null>(null);
  const [success, setSuccess]   = useState<string|null>(null);
  const [warn, setWarn]         = useState<string|null>(null);

  const [online, setOnline]     = useState<"checking"|"online"|"offline">("checking");

  const [themes, setThemes]             = useState<Record<string,ThemeInfo>>({});
  const [currentTheme, setCurrentTheme] = useState("professional");
  const [config, setConfig]             = useState<any>({});
  const [dirty, setDirty]               = useState(false);

  const [newThemeKey,  setNewThemeKey]  = useState("");
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeDesc, setNewThemeDesc] = useState("");
  const [savingTheme,  setSavingTheme]  = useState(false);

  const [promptText,    setPromptText]    = useState(FALLBACK_PROMPT);
  const [promptCopied,  setPromptCopied]  = useState(false);
  const [promptEditing, setPromptEditing] = useState(false);
  const [promptSaving,  setPromptSaving]  = useState(false);

  const [savedAt, setSavedAt]       = useState<Date|null>(null);
  const [showFontPreview, setShowFontPreview] = useState(false);
  const [showASCII, setShowASCII] = useState(false);
  // ── NEW: Live Preview ───────────────────────────────────────
  const [showPreview, setShowPreview]   = useState(false);
  const [previewHTML, setPreviewHTML]   = useState("");

  // ── NEW: Marker Errors ─────────────────────────────────────
  const [markerErrors, setMarkerErrors] = useState<MarkerError[]>([]);

  // ── NEW: Drag & Drop ─────────────────────────────────────
  const [isDragging, setIsDragging]     = useState(false);

  // ── NEW: Named Drafts ────────────────────────────────────
  const [showDrafts, setShowDrafts]     = useState(false);
  const [savedDrafts, setSavedDrafts]   = useState<SavedDraft[]>([]);
  const [draftName, setDraftName]       = useState("");

  const taRef         = useRef<HTMLTextAreaElement>(null);
  const analyzeTimer  = useRef<ReturnType<typeof setTimeout>|null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const dropZoneRef   = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const draft = localStorage.getItem("nf_draft");
    if (draft && draft.trim()) { setText(draft); setHistory([draft]); }
    const dm = localStorage.getItem("nf_dark");
    if (dm==="1") setDark(true);
    loadSavedDrafts();
    checkHealth(); loadThemes(); loadConfig();
    loadPrompt();
    const iv = setInterval(checkHealth,30000);
    return ()=>clearInterval(iv);
  },[]);

  useEffect(()=>{
    document.documentElement.classList.toggle("dark",dark);
    localStorage.setItem("nf_dark",dark?"1":"0");
  },[dark]);

  useEffect(()=>{
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(()=>{
      if (text.trim()){ localStorage.setItem("nf_draft",text); setSavedAt(new Date()); }
    },30000);
    return ()=>{ if(autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  },[text]);

  useEffect(()=>{
    if (analyzeTimer.current) clearTimeout(analyzeTimer.current);
    if (!text.trim()){ setAnalysis(null); setMarkerErrors([]); return; }
    analyzeTimer.current = setTimeout(()=>{ doAnalyze(); validateMarkers(); },600);
    return ()=>{ if(analyzeTimer.current) clearTimeout(analyzeTimer.current); };
  },[text]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      const ctrl=e.ctrlKey||e.metaKey;
      if(ctrl&&e.key==="z"&&!e.shiftKey){e.preventDefault();undo();}
      if(ctrl&&(e.key==="y"||(e.key==="z"&&e.shiftKey))){e.preventDefault();redo();}
      if(ctrl&&e.key==="f"){e.preventDefault();setShowSearch(s=>!s);}
      if(ctrl&&e.key==="s"){e.preventDefault();doGenerate();}
    };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[hIdx,history,text]);

  useEffect(()=>{
    if (showPreview && text.trim()) generatePreview();
  },[text, showPreview]);

  useEffect(()=>{
    const handlePaste = async (e: ClipboardEvent) => {
      if (!taRef.current || document.activeElement !== taRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
         e.preventDefault();
         const blob = items[i].getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (evt) => {
           const base64 = evt.target?.result as string;
           const timestamp = Date.now();
           const imageName = `pasted_image_${timestamp}.png`;

           try {
              localStorage.setItem(`nf_image_${timestamp}`, base64);
              const marker = `IMAGE: "${imageName}" | "Pasted image" | "center"`;
              const cursorPos = taRef.current?.selectionStart || text.length;
              const newText = text.slice(0, cursorPos) + "\n" + marker + "\n" + text.slice(cursorPos);
              handleText(newText);
              setSuccess("📸 Image pasted! (Note: Base64 embedded — use real upload for production)");
            } catch (err) {
              setError("Image too large for localStorage. Use smaller images or implement server upload.");
            }
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [text]);

  const pushHistory=(t:string)=>{
    const next=[...history.slice(0,hIdx+1),t].slice(-100);
    setHistory(next); setHIdx(next.length-1);
  };
  const undo=()=>{ if(hIdx>0){setHIdx(hIdx-1);setText(history[hIdx-1]);} };
  const redo=()=>{ if(hIdx<history.length-1){setHIdx(hIdx+1);setText(history[hIdx+1]);} };
  const handleText=(v:string)=>{ setText(v); pushHistory(v); };

  const doSearch=()=>{
    if(!searchQ||!taRef.current) return;
    const i=taRef.current.value.toLowerCase().indexOf(searchQ.toLowerCase());
    if(i!==-1){taRef.current.focus();taRef.current.setSelectionRange(i,i+searchQ.length);}
  };
  const doReplace=()=>{
    if(!searchQ) return;
    handleText(text.replace(new RegExp(searchQ.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi"),replaceQ));
  };

  const words=text.trim()?text.trim().split(/\s+/).length:0;
  const chars=text.length;
  const mins=Math.max(1,Math.ceil(words/200));
  const validateMarkers = () => {
    const errors: MarkerError[] = [];
    const lines = text.split("\n");

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes(":")) return;

      const match = trimmed.match(/^([A-Z][A-Z0-9\-]*):(.*)$/);
      if (!match) return;

      const [, marker, rest] = match;

      if (!VALID_MARKERS.includes(marker)) {
        errors.push({
          line: idx + 1,
          column: 0,
          message: `Unknown marker "${marker}". Did you mean ${VALID_MARKERS.find(m => m.startsWith(marker.slice(0, 3)))}?`,
          severity: "error"
        });
      }

      const content = rest.trim();
      if (content.startsWith('"') && !content.slice(1).includes('"')) {
        errors.push({
          line: idx + 1,
          column: marker.length + 2,
          message: "Unclosed quote — missing closing \"",
          severity: "error"
        });
      }

      if (["IMAGE", "LINK", "HIGHLIGHT"].includes(marker) && !content.includes("|")) {
        errors.push({
          line: idx + 1,
          column: 0,
          message: `${marker} requires pipe-separated format: "text" | "value"`,
          severity: "warning"
        });
      }
    });

    setMarkerErrors(errors);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const textFile = files.find(f =>
      f.type === "text/plain" ||
      f.type === "text/markdown" ||
      f.name.endsWith(".txt") ||
      f.name.endsWith(".md")
    );

    if (!textFile) {
      setWarn("Please drop a .txt or .md file");
      return;
    }

    const content = await textFile.text();
    handleText(content);
    setSuccess(`✅ Loaded: ${textFile.name} (${(textFile.size/1024).toFixed(1)}KB)`);
  };

  const generatePreview = () => {
    const lines = text.split("\n");
    const htmlParts: string[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) { htmlParts.push("<br>"); return; }

      const match = trimmed.match(/^([A-Z][A-Z0-9\-]*):\s*(.*)$/);
      if (!match) { htmlParts.push(`<p class="text-gray-500 text-sm">${trimmed}</p>`); return; }

      const [, marker, rest] = match;
      let content = rest.trim().replace(/^["']|["']$/g, "");

      if (marker === "HEADING" || marker === "H1") {
        htmlParts.push(`<h1 class="text-2xl font-bold text-orange-600 mt-4 mb-2">${content}</h1>`);
      } else if (marker === "SUBHEADING" || marker === "H2") {
        htmlParts.push(`<h2 class="text-xl font-bold text-orange-600 mt-3 mb-2">${content}</h2>`);
      } else if (marker === "SUB-SUBHEADING" || marker === "H3") {
        htmlParts.push(`<h3 class="text-lg font-bold text-blue-700 mt-3 mb-1">${content}</h3>`);
      } else if (marker === "PARAGRAPH" || marker === "PARA") {
        htmlParts.push(`<p class="text-sm leading-relaxed mb-2">${content}</p>`);
      } else if (marker === "BULLET") {
        const indent = (content.length - content.trimStart().length) / 2;
        content = content.trim();
        htmlParts.push(`<div class="text-sm mb-1" style="margin-left:${indent*20+20}px">• ${content}</div>`);
      } else if (marker === "CODE") {
        htmlParts.push(`<pre class="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded font-mono mb-1">${content}</pre>`);
      } else if (marker === "TABLE") {
        const cells = content.split("|").map(c => c.trim());
        htmlParts.push(`<div class="flex gap-2 text-xs border-b pb-1 mb-1">${cells.map(c => `<span class="flex-1 font-medium">${c}</span>`).join("")}</div>`);
      } else if (marker === "QUOTE") {
        htmlParts.push(`<blockquote class="border-l-4 border-yellow-500 pl-3 italic text-sm text-gray-600 dark:text-gray-400 mb-2">"${content}"</blockquote>`);
      } else if (marker === "NOTE" || marker === "IMPORTANT") {
        htmlParts.push(`<div class="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-600 p-2 text-sm mb-2">📝 ${content}</div>`);
      } else if (marker === "HIGHLIGHT") {
        const [text, color] = content.split("|").map(s => s.trim().replace(/^["']|["']$/g, ""));
        htmlParts.push(`<p class="text-sm"><mark class="bg-yellow-200 px-1">${text}</mark></p>`);
      } else if (marker === "TOC") {
        htmlParts.push(`<p class="text-sm text-purple-600 font-semibold mb-2">📑 Table of Contents</p>`);
      } else {
        htmlParts.push(`<p class="text-xs text-gray-400">${marker}: ${content}</p>`);
      }
    });

    setPreviewHTML(htmlParts.join(""));
  };

  const loadSavedDrafts = () => {
    try {
      const stored = localStorage.getItem("nf_saved_drafts");
      if (stored) setSavedDrafts(JSON.parse(stored));
    } catch {}
  };

  const saveDraft = () => {
    if (!draftName.trim()) { setError("Draft name required"); return; }
    const newDraft: SavedDraft = {
      id: Date.now().toString(),
      name: draftName.trim(),
      content: text,
      savedAt: Date.now()
    };
    const updated = [...savedDrafts, newDraft].slice(-10);
    setSavedDrafts(updated);
    localStorage.setItem("nf_saved_drafts", JSON.stringify(updated));
    setDraftName("");
    setSuccess(`✅ Saved draft: ${newDraft.name}`);
  };

  const loadDraft = (draft: SavedDraft) => {
    handleText(draft.content);
    setShowDrafts(false);
    setSuccess(`✅ Loaded: ${draft.name}`);
  };

  const deleteDraft = (id: string) => {
    const updated = savedDrafts.filter(d => d.id !== id);
    setSavedDrafts(updated);
    localStorage.setItem("nf_saved_drafts", JSON.stringify(updated));
    setSuccess("✅ Draft deleted");
  };

  const checkHealth=async()=>{
    try{ await axios.get(`${API}/health`,{timeout:2000}); setOnline("online"); }
    catch{ setOnline("offline"); }
  };
  const loadThemes=async()=>{
    try{ const r=await axios.get(`${API}/api/themes`); if(r.data.success){setThemes(r.data.themes);setCurrentTheme(r.data.current_theme);} }catch{}
  };
  const loadConfig=async()=>{
    try{ const r=await axios.get(`${API}/api/config`); if(r.data.success) setConfig(r.data.config); }catch{}
  };
  const loadPrompt=async()=>{
    try{
      const r=await axios.get(`${API}/api/prompt`);
      if(r.data.success && r.data.prompt && r.data.prompt.trim().length>20)
        setPromptText(r.data.prompt);
    }catch{}
  };
  const doAnalyze=async()=>{
    setAnalyzing(true);
    try{ const r=await axios.post(`${API}/api/analyze`,{text}); if(r.data.success) setAnalysis(r.data); }
    catch{} finally{setAnalyzing(false);}
  };
  const doGenerate=useCallback(async()=>{
    if(!text.trim()||generating) return;
    setGenerating(true);setError(null);setSuccess(null);setWarn(null);
    try{
      const r=await axios.post(`${API}/api/generate`,{text,format,filename:customName||undefined});
      if(r.data.success){
        const a=document.createElement("a");
        a.href=`${API}${r.data.download_url}`;a.download=r.data.filename;a.click();
        setSuccess(`✅ ${r.data.filename} downloaded!`);
        if(r.data.warning) setWarn(r.data.warning);
      }
    }catch(e:any){setError(e?.response?.data?.detail||"Generation failed");}
    finally{setGenerating(false);}
  },[text,format,customName,generating]);

  const applyTheme=async(name:string)=>{
    try{
      const r=await axios.post(`${API}/api/themes/apply`,{theme_name:name});
      if(r.data.success){
        setCurrentTheme(name);
        if(r.data.config) setConfig(r.data.config); else await loadConfig();
        setDirty(false);setSuccess(`✅ Theme applied: ${themes[name]?.name||name}`);
      }
    }catch{setError("Failed to apply theme");}
  };
  const saveSettings=async()=>{
    try{
      for(const s of ["fonts","colors","spacing","page","header","footer"])
        if(config[s]) await axios.post(`${API}/api/config/update`,{path:s,value:config[s]});
      setDirty(false);setSuccess("✅ Settings saved!");
    }catch{setError("Failed to save settings");}
  };
  const saveAsTheme=async()=>{
    if(!newThemeKey.trim()||!newThemeName.trim()){setError("Key and name required");return;}
    setSavingTheme(true);
    try{
      await axios.post(`${API}/api/themes/save`,{key:newThemeKey,name:newThemeName,description:newThemeDesc});
      await loadThemes();setNewThemeKey("");setNewThemeName("");setNewThemeDesc("");
      setSuccess(`✅ Theme "${newThemeName}" saved!`);
    }catch(e:any){setError(e?.response?.data?.detail||"Save failed");}
    finally{setSavingTheme(false);}
  };
  const deleteTheme=async(key:string)=>{
    if(!window.confirm(`Delete "${themes[key]?.name}"?`)) return;
    try{
      await axios.post(`${API}/api/themes/delete`,{key});await loadThemes();
      if(currentTheme===key){setCurrentTheme("professional");await loadConfig();}
      setSuccess("✅ Deleted");
    }catch(e:any){setError(e?.response?.data?.detail||"Delete failed");}
  };
  const savePrompt=async()=>{
    setPromptSaving(true);
    try{
      await axios.post(`${API}/api/prompt`,{prompt:promptText});
      setPromptEditing(false);setSuccess("✅ Prompt saved!");
    }catch{setError("Failed to save prompt");}
    finally{setPromptSaving(false);}
  };
  const copyPrompt=async()=>{
    await navigator.clipboard.writeText(promptText);
    setPromptCopied(true);setTimeout(()=>setPromptCopied(false),2500);
  };
  const cfgLocal=(path:string,value:any)=>{
    const keys=path.split(".");
    const next=JSON.parse(JSON.stringify(config));
    let cur=next;
    for(let i=0;i<keys.length-1;i++){if(!cur[keys[i]])cur[keys[i]]={};cur=cur[keys[i]];}
    cur[keys[keys.length-1]]=value;
    setConfig(next);setDirty(true);
  };

  const card=`rounded-2xl shadow-xl border ${dark?"bg-gray-800 border-gray-700":"bg-white border-gray-200"}`;
  const lbl=`block text-sm font-medium mb-1 ${dark?"text-gray-300":"text-gray-700"}`;
  const inp=`w-full px-3 py-2 rounded-lg border text-sm ${dark?"bg-gray-700 border-gray-600 text-gray-200":"bg-white border-gray-300 text-gray-900"}`;
  const tbtn=(on:boolean)=>`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${on?(dark?"bg-white/20 shadow-inner":"bg-white/30 shadow-inner"):(dark?"bg-white/5 hover:bg-white/10":"bg-white/10 hover:bg-white/20")}`;

  const KBD=({k}:{k:string})=>(
    <kbd className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${dark?"bg-gray-700 border-gray-500 text-gray-200":"bg-gray-100 border-gray-300 text-gray-700"}`}>{k}</kbd>
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 ${dark?"bg-gray-900 text-gray-100":"bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 text-gray-900"}`}>

      <header className={`shadow-2xl ${dark?"bg-gradient-to-r from-gray-900 via-gray-800 to-black":"bg-gradient-to-r from-blue-700 via-purple-700 to-pink-600"} text-white`}>
        <div className="max-w-screen-xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur"><Sparkles className="w-6 h-6"/></div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">NotesForge Professional</h1>
                <p className="text-xs text-white/60">v4.2 · 5 New Features Added</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 bg-white/10`}>
                <span className={`w-1.5 h-1.5 rounded-full ${online==="online"?"bg-green-400 animate-pulse":online==="offline"?"bg-red-400":"bg-yellow-400"}`}/>
                {online==="online"?"Online":online==="offline"?"Offline":"…"}
              </span>
              {savedAt&&<span className="px-2.5 py-1 rounded-lg text-xs bg-white/10 flex items-center gap-1"><Clock className="w-3 h-3"/>Saved</span>}
              {dirty&&<span className="px-2.5 py-1 rounded-lg text-xs bg-yellow-500/30 text-yellow-200"><AlertCircle className="w-3 h-3 inline mr-1"/>Unsaved</span>}
              <button onClick={()=>setDark(!dark)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg" title="Toggle dark mode">
                {dark?<Sun className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}
              </button>
              <button onClick={()=>setFullscreen(!fullscreen)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg">
                {fullscreen?<Minimize2 className="w-4 h-4"/>:<Maximize2 className="w-4 h-4"/>}
              </button>
            </div>
          </div>

          <nav className="flex gap-2 mt-4 flex-wrap">
            {([
              ["editor","Editor",FileText],
              ["templates","Templates",BookOpen],
              ["settings","Settings",Settings],
              ["prompt","AI Prompt",Bot],
              ["shortcuts","Shortcuts",Keyboard],
            ] as const).map(([t,label,Icon])=>(
              <button key={t} onClick={()=>setTab(t as any)} className={tbtn(tab===t)}>
                <Icon className="w-3.5 h-3.5"/>{label}
                {t==="settings"&&dirty&&<span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"/>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {[ [error,"red",AlertCircle,setError], [success,"green",CheckCircle,setSuccess], [warn,"yellow",AlertCircle,setWarn] ].map(([msg,color,Icon,clear]:any)=>msg&&(
          <div key={color} className={`mb-4 p-3 rounded-xl flex items-center gap-3 text-sm border-2 border-${color}-200 bg-${color}-50 dark:bg-${color}-900/20 dark:border-${color}-800 text-${color}-700 dark:text-${color}-300`}>
            <Icon className="w-4 h-4 shrink-0"/><span className="flex-1">{msg}</span>
            <button onClick={()=>clear(null)}><X className="w-4 h-4"/></button>
          </div>
        ))}

        {tab==="editor"&&(
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className={`${card} p-3 flex items-center gap-2 flex-wrap`}>
                <button onClick={undo} disabled={hIdx<=0} title="Undo (Ctrl+Z)" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"><Undo2 className="w-4 h-4"/></button>
                <button onClick={redo} disabled={hIdx>=history.length-1} title="Redo (Ctrl+Y)" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"><Redo2 className="w-4 h-4"/></button>
                <button onClick={()=>setShowSearch(s=>!s)} title="Find & Replace (Ctrl+F)" className={`p-2 rounded-lg ${showSearch?"bg-blue-100 dark:bg-blue-900/40 text-blue-600":"hover:bg-gray-100 dark:hover:bg-gray-700"}`}><Search className="w-4 h-4"/></button>
                <button onClick={()=>setShowPreview(p=>!p)} title="Toggle Live Preview"
                  className={`p-2 rounded-lg ${showPreview?"bg-green-100 dark:bg-green-900/40 text-green-600":"hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
                  <Monitor className="w-4 h-4"/>
                </button>

                <button onClick={()=>setShowDrafts(true)} title="Manage Drafts"
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative">
                  <Folder className="w-4 h-4"/>
                  {savedDrafts.length>0&&<span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">{savedDrafts.length}</span>}
                </button>
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1"/>
                <span className="text-xs text-gray-400">{words} words</span>
                <span className="text-xs text-gray-400">{chars} chars</span>
                <span className="text-xs text-gray-400">{mins} min read</span>
                <div className="flex-1"/>
                <button onClick={()=>handleText(TEMPLATES[0].content)} className="text-xs text-purple-500 hover:underline px-2">Load Sample</button>
                <button onClick={()=>handleText("")} className="text-xs text-red-400 hover:underline px-2">Clear</button>
              </div>

              {markerErrors.length>0&&(
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3"/>{markerErrors.length} error{markerErrors.length>1?"s":""}
                </span>
              )}
              {markerErrors.length>0&&(
                <div className={`${card} p-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-500"/>
                    <span className="font-semibold text-sm">Marker Errors ({markerErrors.length})</span>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {markerErrors.map((err,i)=>(
                      <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${err.severity==="error"?"bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300":"bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300"}`}>
                        <span className="font-bold">Line {err.line}:</span>
                        <span className="flex-1">{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showSearch&&(
                <div className={`${card} p-4`}>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search…" className={inp} onKeyDown={e=>e.key==="Enter"&&doSearch()}/>
                    <input value={replaceQ} onChange={e=>setReplaceQ(e.target.value)} placeholder="Replace with…" className={inp}/>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={doSearch} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Find Next</button>
                    <button onClick={doReplace} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">Replace All</button>
                    <button onClick={()=>setShowSearch(false)} className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4"/></button>
                  </div>
                </div>
              )}

              {showPreview&&(
                <div className={`${card} overflow-hidden`}>
                  <div className={`px-5 py-3 border-b flex items-center justify-between ${dark?"border-gray-700 bg-gray-700/40":"border-gray-100 bg-green-50"}`}>
                    <span className="text-sm font-semibold flex items-center gap-2"><Monitor className="w-4 h-4 text-green-600"/>Live Preview</span>
                    <button onClick={()=>setShowPreview(false)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"><X className="w-4 h-4"/></button>
                  </div>
                  <div className={`p-5 max-h-[400px] overflow-y-auto ${dark?"bg-gray-900":"bg-white"}`} dangerouslySetInnerHTML={{__html:previewHTML}}/>
                </div>
              )}

              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`${card} overflow-hidden relative ${isDragging?"ring-4 ring-blue-500 ring-opacity-50":""}`}>

                {isDragging&&(
                  <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm z-10 flex items-center justify-center border-4 border-dashed border-blue-500">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl text-center">
                      <Upload className="w-16 h-16 mx-auto mb-4 text-blue-600"/>
                      <p className="text-lg font-bold text-blue-600">Drop .txt or .md file here</p>
                      <p className="text-sm text-gray-500 mt-2">File will load into editor</p>
                    </div>
                  </div>
                )}

                {!text.trim()&&(
                  <div className={`px-6 py-4 border-b ${dark?"border-gray-700 bg-gray-900/40":"border-gray-100 bg-blue-50/50"}`}>
                    <p className="text-xs text-gray-400 mt-3 flex items-center gap-2">
                      <ImagePlus className="w-4 h-4"/>
                      Paste images from clipboard • Drop .txt/.md files • Load from drafts
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['HEADING: "Title"','orange'],
                        ['PARAGRAPH: "Text"','gray'],
                        ['BULLET: "Point"','purple'],
                        ['CODE: "code"','slate'],
                        ['TABLE: "A | B"','teal'],
                        ['NOTE: "Info"','green'],
                      ].map(([m,c])=>(
                        <button key={m} onClick={()=>handleText(text+(text?"\n":"")+m)}
                          className={`text-xs font-mono px-2.5 py-1 rounded-lg border bg-white dark:bg-gray-800 hover:bg-${c}-50 dark:hover:bg-${c}-900/20 border-${c}-200 dark:border-${c}-800 text-${c}-700 dark:text-${c}-300 transition-colors`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  ref={taRef} value={text} onChange={e=>handleText(e.target.value)}
                  spellCheck={false}
                  placeholder={"Start typing with markers, or:\n• Drag & drop a .txt/.md file here\n• Paste an image from clipboard (Ctrl+V)\n• Click 'Manage Drafts' to save/load multiple documents\n\nHEADING: \"My Document\"\nPARAGRAPH: \"Introduction...\"\nBULLET: \"First point\""}
                  className={`w-full p-5 font-mono text-sm resize-none focus:outline-none leading-relaxed ${fullscreen?"h-[calc(100vh-260px)]":"h-[440px]"} ${dark?"bg-gray-800 text-gray-100 placeholder-gray-600":"bg-white text-gray-900 placeholder-gray-400"}`}
                />
              </div>

              <div className={`${card} p-4`}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-gray-400 shrink-0"/>
                    <input value={customName} onChange={e=>setCustomName(e.target.value)}
                      placeholder="Filename (optional)" className={`${inp} max-w-[160px]`}/>
                  </div>
                  <select value={format} onChange={e=>setFormat(e.target.value)} className={`${inp} w-auto`}>
                    <option value="docx">Word (.docx)</option>
                    <option value="pdf">PDF (.pdf)</option>
                    <option value="md">Markdown (.md)</option>
                    <option value="html">HTML (.html)</option>
                  </select>
                  <button onClick={doGenerate} disabled={generating||!text.trim()||online!=="online"}
                    className="flex-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-bold py-3 px-5 rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm whitespace-nowrap">
                    {generating?<><Loader2 className="w-4 h-4 animate-spin"/>Generating…</>:<><Sparkles className="w-4 h-4"/>Generate Document<Download className="w-4 h-4"/></>}
                  </button>
                </div>
                {format==="pdf"&&<p className="text-xs mt-2 text-gray-400">PDF needs LibreOffice or docx2pdf on the server — falls back to DOCX if unavailable.</p>}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className={`${card} p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-purple-500"/>
                  <h3 className="font-bold text-sm">Live Statistics</h3>
                </div>
                {analysis?(
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className={`rounded-xl p-3 ${dark?"bg-blue-900/30 border border-blue-800":"bg-blue-50 border border-blue-200"}`}>
                        <div className="text-2xl font-bold text-blue-600">{analysis.total_lines}</div>
                        <div className="text-xs text-blue-500">Lines</div>
                      </div>
                      <div className={`rounded-xl p-3 ${dark?"bg-purple-900/30 border border-purple-800":"bg-purple-50 border border-purple-200"}`}>
                        <div className="text-2xl font-bold text-purple-600">{Object.values(analysis.statistics).reduce((a,b)=>a+b,0)}</div>
                        <div className="text-xs text-purple-500">Elements</div>
                      </div>
                    </div>
                    {Object.entries(analysis.statistics)
                      .filter(([k])=>k!=="empty")
                      .sort(([,a],[,b])=>b-a)
                      .map(([type,count])=>(
                        <div key={type} className={`flex items-center gap-2 p-2 rounded-lg ${dark?"bg-gray-700/50":"bg-gray-50"}`}>
                          <div className={`${TYPE_COLOR[type]||"bg-gray-500"} text-white p-1.5 rounded shrink-0`}>
                            {TYPE_ICON[type]||<Type className="w-3 h-3"/>}
                          </div>
                          <span className="text-xs flex-1 capitalize">{type.replace("_"," ")}</span>
                          <span className="text-sm font-bold">{count}</span>
                        </div>
                      ))}
                  </div>
                ):(
                  <div className="text-center py-10 text-gray-400">
                    <Eye className="w-10 h-10 mx-auto mb-2 opacity-30"/>
                    <p className="text-sm">Start typing to see analysis</p>
                  </div>
                )}
              </div>
              {analysis&&analysis.preview.length>0&&(
                <div className={`${card} p-5`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Eye className="w-5 h-5 text-green-500"/>
                    <h3 className="font-bold text-sm">Element Preview</h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {analysis.preview.filter(r=>r.type!=="empty").slice(0,10).map((row,i)=>(
                      <div key={i} className={`p-2 rounded-lg ${dark?"bg-gray-700/50":"bg-gray-50"}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`${TYPE_COLOR[row.type]||"bg-gray-500"} text-white text-xs px-1.5 py-0.5 rounded font-bold`}>{row.type.toUpperCase()}</span>
                          {(row.indent_level??0)>0&&<span className="text-xs text-gray-400">↳L{row.indent_level}</span>}
                        </div>
                        <p className="text-xs font-mono truncate text-gray-500 dark:text-gray-400">{row.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab==="templates"&&(
          <div className="space-y-6">
            <div className={`${card} overflow-hidden`}>
              <div className={`px-6 py-4 ${dark?"bg-gray-700/50":"bg-gradient-to-r from-purple-50 to-orange-50"}`}>
                <h2 className="text-xl font-bold mb-1">Document Templates</h2>
                <p className={`text-sm ${dark?"text-gray-400":"text-gray-500"}`}>Select a structure, load it into the editor, then fill in your content and generate.</p>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className={`rounded-2xl border-2 border-purple-200 dark:border-purple-700 overflow-hidden`}>
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 flex items-center gap-2 text-white">
                    <BookOpen className="w-5 h-5"/>
                    <span className="font-bold">Templates = Content Structure</span>
                    <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">This tab</span>
                  </div>
                  <div className={`p-4 ${dark?"bg-purple-900/10":"bg-purple-50/50"}`}>
                    <p className={`text-sm leading-relaxed mb-3 ${dark?"text-gray-300":"text-gray-700"}`}>
                      Templates are <strong>pre-written document skeletons</strong>. They define <em>what information goes in</em> and in what order — headings, sections, tables, bullets — all set up and ready to fill in.
                    </p>
                    <div className={`rounded-lg p-3 font-mono text-xs ${dark?"bg-gray-900 text-purple-300":"bg-white text-purple-700"} border border-purple-200 dark:border-purple-800 leading-relaxed`}>
                      <div className="text-gray-400 mb-1"># Example: Meeting template</div>
                      HEADING: "Meeting Notes"<br/>
                      SUBHEADING: "Agenda"<br/>
                      BULLET: "[Item 1]"<br/>
                      TABLE: "Task | Owner | Due"
                    </div>
                    <p className={`text-xs mt-2 ${dark?"text-purple-400":"text-purple-600"}`}>
                      ✓ Choose template → Fill brackets → Generate
                    </p>
                  </div>
                </div>

                <div className={`rounded-2xl border-2 border-orange-200 dark:border-orange-700 overflow-hidden`}>
                  <div className="bg-gradient-to-r from-orange-500 to-yellow-500 px-4 py-3 flex items-center gap-2 text-white">
                    <Palette className="w-5 h-5"/>
                    <span className="font-bold">Themes = Visual Style</span>
                    <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">Settings tab</span>
                  </div>
                  <div className={`p-4 ${dark?"bg-orange-900/10":"bg-orange-50/50"}`}>
                    <p className={`text-sm leading-relaxed mb-3 ${dark?"text-gray-300":"text-gray-700"}`}>
                      Themes control <strong>how the document looks</strong> when exported — fonts, heading colours, table styles, spacing, margins, and borders. The <em>same content</em> looks completely different with different themes.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["Professional","Orange + Times New Roman"],
                        ["Academic","Black + Double spacing"],
                        ["Modern","Blue + Calibri"],
                        ["Tech","Purple + code-friendly"],
                      ].map(([n,d])=>(
                        <div key={n} className={`rounded-lg px-3 py-2 text-xs ${dark?"bg-gray-800 border border-gray-700":"bg-white border border-orange-200"}`}>
                          <div className="font-bold">{n}</div>
                          <div className="text-gray-400">{d}</div>
                        </div>
                      ))}
                    </div>
                    <p className={`text-xs mt-2 ${dark?"text-orange-400":"text-orange-600"}`}>
                      ✓ Settings → Themes → Apply before generating
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {TEMPLATES.map(tpl=>(
                <div key={tpl.id} onClick={()=>{handleText(tpl.content);setTab("editor");setSuccess(`✅ Loaded: ${tpl.name}`);}}
                  className={`${card} p-5 cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 group`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{tpl.icon}</span>
                        <h3 className="font-bold">{tpl.name}</h3>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tpl.category==="Business"?"bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300":tpl.category==="Academic"?"bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300":"bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300"}`}>
                        {tpl.category}
                      </span>
                    </div>
                  </div>
                  <div className={`text-xs font-mono mb-4 p-2.5 rounded-lg leading-relaxed ${dark?"bg-gray-900 text-gray-400":"bg-gray-50 text-gray-500"} overflow-hidden`} style={{maxHeight:"72px"}}>
                    {tpl.content.split("\n").slice(0,4).join("\n")}
                  </div>
                  <button className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-medium group-hover:opacity-90 transition-opacity">
                    Load Template →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="settings"&&(
          <div className="space-y-4">
            <div className={`${card} p-4 flex items-center justify-between`}>
              <div>
                <p className="font-bold">Document Settings</p>
                <p className="text-sm text-gray-500">Theme: <strong className="text-purple-500">{themes[currentTheme]?.name||currentTheme}</strong>{dirty&&<span className="ml-3 text-yellow-500 text-xs">● Unsaved changes</span>}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>applyTheme(currentTheme)} disabled={!dirty}
                  className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm border-2 ${dirty?(dark?"border-gray-500 hover:bg-gray-700":"border-gray-300 hover:bg-gray-50"):"border-transparent opacity-30 cursor-not-allowed"}`}>
                  <RotateCcw className="w-4 h-4"/>Reset
                </button>
                <button onClick={saveSettings} disabled={!dirty}
                  className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm ${dirty?"bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg hover:opacity-90":"bg-gray-200 dark:bg-gray-700 opacity-30 cursor-not-allowed"}`}>
                  <Save className="w-4 h-4"/>Save Settings
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              <div className={`${card} p-3 h-fit`}>
                {(["themes","fonts","colors","spacing","page"] as const).map(st=>(
                  <button key={st} onClick={()=>setSettingsTab(st)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${settingsTab===st?"bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow":(dark?"hover:bg-gray-700":"hover:bg-gray-100")}`}>
                    {st==="themes"&&<Palette className="w-4 h-4"/>}
                    {st==="fonts"&&<Type className="w-4 h-4"/>}
                    {st==="colors"&&<PaintBucket className="w-4 h-4"/>}
                    {st==="spacing"&&<Ruler className="w-4 h-4"/>}
                    {st==="page"&&<Layout className="w-4 h-4"/>}
                    {st.charAt(0).toUpperCase()+st.slice(1)}
                  </button>
                ))}
              </div>

              <div className={`${card} p-6 lg:col-span-3`}>
                {settingsTab==="themes"&&(
                  <div>
                    <h3 className="text-lg font-bold mb-1">Visual Themes</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Controls fonts, colours, spacing — the look of your exported document. Apply then save settings.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                      {Object.entries(themes).map(([key,info])=>(
                        <div key={key} className={`p-4 rounded-xl border-2 transition-all ${currentTheme===key?"border-purple-500 shadow-lg":(dark?"border-gray-600 hover:border-purple-400":"border-gray-200 hover:border-purple-300")} ${dark?"bg-gray-700/50":"bg-gray-50"}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-sm">{info.name}</span>
                            {currentTheme===key&&<CheckCircle className="w-4 h-4 text-purple-500"/>}
                          </div>
                          <p className="text-xs text-gray-400 mb-3 leading-tight min-h-[2rem]">{info.description}</p>
                          <div className="flex gap-1.5">
                            <button onClick={()=>applyTheme(key)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${currentTheme===key?"bg-purple-600 text-white":"bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 hover:bg-purple-200"}`}>
                              {currentTheme===key?"✓ Active":"Apply"}
                            </button>
                            {info.user_created&&<button onClick={()=>deleteTheme(key)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5"/></button>}
                          </div>
                          <p className={`text-xs mt-1.5 text-center ${info.builtin?"text-gray-400":"text-blue-400"}`}>{info.builtin?"Built-in":"Custom"}</p>
                        </div>
                      ))}
                    </div>
                    <div className={`p-5 rounded-xl border-2 border-dashed ${dark?"border-gray-600":"border-purple-200"}`}>
                      <h4 className="font-semibold mb-1 flex items-center gap-2 text-sm"><Plus className="w-4 h-4 text-purple-500"/>Save Current Settings as New Theme</h4>
                      <p className="text-xs text-gray-400 mb-4">Tweak fonts/colours/spacing in other tabs, then save as a reusable theme.</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div><label className={lbl}>Key (slug)</label><input value={newThemeKey} onChange={e=>setNewThemeKey(e.target.value.toLowerCase().replace(/\s+/g,"_"))} placeholder="my_theme" className={inp}/></div>
                        <div><label className={lbl}>Display Name</label><input value={newThemeName} onChange={e=>setNewThemeName(e.target.value)} placeholder="My Theme" className={inp}/></div>
                        <div><label className={lbl}>Description</label><input value={newThemeDesc} onChange={e=>setNewThemeDesc(e.target.value)} placeholder="Optional" className={inp}/></div>
                      </div>
                      <button onClick={saveAsTheme} disabled={savingTheme||!newThemeKey||!newThemeName}
                        className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                        {savingTheme?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}Save as Theme
                      </button>
                    </div>
                  </div>
                )}

                {settingsTab==="fonts"&&(
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">Font Settings</h3>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={showFontPreview} onChange={e=>setShowFontPreview(e.target.checked)} className="w-4 h-4 accent-purple-600"/>
                        Preview fonts
                      </label>
                    </div>
                    <div className="space-y-5">
                      <div>
                        <label className={lbl}>Body Font</label>
                        <select value={config.fonts?.family||""} onChange={e=>cfgLocal("fonts.family",e.target.value)} className={inp}
                          style={showFontPreview?{fontFamily:config.fonts?.family}:{}}>
                          {(config.fonts?.available_fonts||[]).map((f:string)=>(
                            <option key={f} value={f} style={showFontPreview?{fontFamily:f}:{}}>{f}</option>
                          ))}
                          <option value="Trebuchet MS">Trebuchet MS</option>
                        </select>
                        {showFontPreview&&config.fonts?.family&&(
                          <div className={`mt-2 p-3 rounded-lg text-sm ${dark?"bg-gray-700":"bg-gray-50"}`} style={{fontFamily:config.fonts.family}}>
                            The quick brown fox jumps over the lazy dog. <strong>Bold text.</strong> <em>Italic text.</em> 1234567890.
                          </div>
                        )}
                      </div>
                      <div>
                        <label className={lbl}>Code / Monospace Font</label>
                        <select value={config.fonts?.family_code||""} onChange={e=>cfgLocal("fonts.family_code",e.target.value)} className={inp}
                          style={showFontPreview?{fontFamily:config.fonts?.family_code}:{}}>
                          {(config.fonts?.available_code_fonts||[]).map((f:string)=>(
                            <option key={f} value={f} style={showFontPreview?{fontFamily:f}:{}}>{f}</option>
                          ))}
                        </select>
                        {showFontPreview&&config.fonts?.family_code&&(
                          <div className={`mt-2 p-3 rounded-lg text-sm ${dark?"bg-gray-900":"bg-gray-50"}`} style={{fontFamily:config.fonts.family_code}}>
                            def hello_world(): return "Hello, NotesForge!" # 0O1lIi
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3 text-sm">Font Sizes (pt)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[["h1","H1 Heading"],["h2","H2 Heading"],["h3","H3 Heading"],["h4","H4 Heading"],["h5","H5 Heading"],["h6","H6 Heading"],["body","Body Text"],["code","Code Text"]].map(([k,label])=>(
                            <div key={k}>
                              <label className={lbl}>{label}: <strong>{config.fonts?.sizes?.[k]||12}pt</strong></label>
                              <input type="range" min="8" max="32" value={config.fonts?.sizes?.[k]||12}
                                onChange={e=>cfgLocal(`fonts.sizes.${k}`,parseInt(e.target.value))} className="w-full accent-purple-600"/>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab==="colors"&&(
                  <div>
                    <h3 className="text-lg font-bold mb-4">Colour Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        ["h1","H1 Heading Colour"],["h2","H2 Heading Colour"],["h3","H3 Heading Colour"],
                        ["h4","H4 Heading Colour"],["h5","H5 Heading Colour"],["h6","H6 Heading Colour"],
                        ["code_background","Code Background"],["table_header_bg","Table Header Background"],
                        ["table_header_text","Table Header Text"],["table_odd_row","Table Odd Row"],["table_even_row","Table Even Row"],
                      ].map(([k,label])=>(
                        <div key={k}>
                          <label className={lbl}>{label}</label>
                          <div className="flex gap-2 items-center">
                            <input type="color" value={config.colors?.[k]||"#000000"}
                              onChange={e=>cfgLocal(`colors.${k}`,e.target.value)} className="w-10 h-9 rounded-lg cursor-pointer border-0 shrink-0"/>
                            <input type="text" value={config.colors?.[k]||"#000000"}
                              onChange={e=>cfgLocal(`colors.${k}`,e.target.value)} className={`${inp} font-mono`} maxLength={7}/>
                            <div className="w-8 h-8 rounded-lg border shrink-0" style={{background:config.colors?.[k]||"#000"}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {settingsTab==="spacing"&&(
                  <div>
                    <h3 className="text-lg font-bold mb-4">Spacing Settings</h3>
                    <div className="space-y-5">
                      {([
                        ["spacing.line_spacing","Line Spacing (multiplier)",1.0,3.0,0.1],
                        ["spacing.paragraph_spacing_after","Paragraph Space After (pt)",0,24,1],
                        ["spacing.heading_spacing_before","Heading Space Before (pt)",0,36,1],
                        ["spacing.heading_spacing_after","Heading Space After (pt)",0,24,1],
                        ["spacing.bullet_base_indent",'Bullet Base Indent (")',0,1.5,0.05],
                        ["spacing.bullet_indent_per_level",'Bullet Per-Level Indent (")',0.1,1,0.05],
                        ["spacing.code_indent",'Code Block Indent (")',0,1,0.05],
                        ["spacing.quote_indent",'Quote Indent (")',0,1.5,0.05],
                      ] as [string,string,number,number,number][]).map(([path,label,min,max,step])=>{
                        const [s,k]=path.split(".");
                        const val=config[s]?.[k]??min;
                        return(
                          <div key={path}>
                            <label className={lbl}>{label}: <strong className="text-purple-500">{typeof val==="number"?val.toFixed(step<1?2:0):val}</strong></label>
                            <input type="range" min={min} max={max} step={step} value={val}
                              onChange={e=>cfgLocal(path,step<1?parseFloat(e.target.value):parseInt(e.target.value))} className="w-full accent-purple-600"/>
                            <div className={`flex justify-between text-xs mt-0.5 ${dark?"text-gray-600":"text-gray-400"}`}><span>{min}</span><span>{max}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {settingsTab==="page"&&(
                  <div>
                    <h3 className="text-lg font-bold mb-4">Page Setup</h3>
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-3 text-sm border-b pb-2 dark:border-gray-700">Document Header</h4>
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={config.header?.enabled||false} onChange={e=>cfgLocal("header.enabled",e.target.checked)} className="w-4 h-4 accent-purple-600"/>
                            <span className="text-sm">Show header on every page</span>
                          </label>
                          {config.header?.enabled&&(
                            <div className="space-y-3 pl-6">
                              <div><label className={lbl}>Header Text</label><input type="text" value={config.header?.text||""} onChange={e=>cfgLocal("header.text",e.target.value)} className={inp} placeholder="e.g. Company Name · Confidential"/></div>
                              <div>
                                <label className={lbl}>Header Colour</label>
                                <div className="flex gap-2">
                                  <input type="color" value={config.header?.color||"#FF8C00"} onChange={e=>cfgLocal("header.color",e.target.value)} className="w-10 h-9 rounded-lg cursor-pointer border-0"/>
                                  <input type="text" value={config.header?.color||""} onChange={e=>cfgLocal("header.color",e.target.value)} className={`${inp} font-mono`} maxLength={7}/>
                                </div>
                              </div>
                              <div>
                                <label className={lbl}>Header Size: {config.header?.size||11}pt</label>
                                <input type="range" min="8" max="16" value={config.header?.size||11} onChange={e=>cfgLocal("header.size",parseInt(e.target.value))} className="w-full accent-purple-600"/>
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className={lbl}>Title Position</label>
                          <select
                            value={config.header?.position || "left"}
                            onChange={e =>
                              cfgLocal("header.position", e.target.value)
                            }
                            className={inp}
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-sm border-b pb-2 dark:border-gray-700">Footer & Page Numbers</h4>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={config.footer?.enabled||false} onChange={e=>cfgLocal("footer.enabled",e.target.checked)} className="w-4 h-4 accent-purple-600"/><span className="text-sm">Show footer</span></label>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={config.footer?.show_page_numbers||false} onChange={e=>cfgLocal("footer.show_page_numbers",e.target.checked)} className="w-4 h-4 accent-purple-600"/><span className="text-sm">Show "Page X of Y" numbers</span></label>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={config.footer?.separator!==false} onChange={e=>cfgLocal("footer.separator",e.target.checked)} className="w-4 h-4 accent-purple-600"/><span className="text-sm">Separator line above footer</span></label>
                        </div>
                        <div>
                          <label className={lbl}>Page Number Style</label>
                          <select
                            value={config.footer?.page_number_style || "arabic"}
                            onChange={e =>
                              cfgLocal("footer.page_number_style", e.target.value)
                            }
                            className={inp}
                          >
                            <option value="arabic">1, 2, 3</option>
                            <option value="roman">I, II, III</option>
                            <option value="alpha">A, B, C</option>
                          </select>
                        </div>
                        <div className="mt-3">
                          <label className={lbl}>Place Title In</label>
                          <select value={config.titlePlacement||"header"} onChange={e=>cfgLocal("titlePlacement", e.target.value)} className={inp}>
                            <option value="header">Header</option>
                            <option value="footer">Footer</option>
                            <option value="none">None</option>
                          </select>
                        </div>
                        <div className="mt-3">
                          <label className={lbl}>Place Page Numbers In</label>
                          <select value={config.pageNumberPlacement||"footer"} onChange={e=>cfgLocal("pageNumberPlacement", e.target.value)} className={inp}>
                            <option value="header">Header</option>
                            <option value="footer">Footer</option>
                            <option value="none">None</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-sm border-b pb-2 dark:border-gray-700">
                          Watermark
                        </h4>

                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.watermark?.enabled || false}
                              onChange={e => cfgLocal("watermark.enabled", e.target.checked)}
                              className="w-4 h-4 accent-purple-600"
                            />
                            <span className="text-sm">Enable watermark</span>
                          </label>

                          {config.watermark?.enabled && (
                            <div className="pl-6 space-y-3">
                              <div>
                                <label className={lbl}>Watermark Text</label>
                                <input
                                  type="text"
                                  value={config.watermark?.text || ""}
                                  onChange={e => cfgLocal("watermark.text", e.target.value)}
                                  className={inp}
                                  placeholder="CONFIDENTIAL"
                                />
                              </div>

                              <div>
                                <label className={lbl}>
                                  Size: {config.watermark?.size || 48}pt
                                </label>
                                <input
                                  type="range"
                                  min="20"
                                  max="120"
                                  value={config.watermark?.size || 48}
                                  onChange={e =>
                                    cfgLocal("watermark.size", parseInt(e.target.value))
                                  }
                                  className="w-full accent-purple-600"
                                />
                              </div>

                              <div>
                                <label className={lbl}>Color</label>
                                <input
                                  type="color"
                                  value={config.watermark?.color || "#CCCCCC"}
                                  onChange={e => cfgLocal("watermark.color", e.target.value)}
                                  className="w-10 h-9 rounded-lg cursor-pointer border-0"
                                />
                              </div>

                              <div>
                                <label className={lbl}>Use Image as Watermark (optional)</label>
                                <input type="file" accept="image/*" onChange={e=>{
                                  const f = e.target.files?.[0];
                                  if(!f) return;
                                  const reader = new FileReader();
                                  reader.onload = ev=>{
                                    cfgLocal("watermark.image_data", ev.target?.result || "");
                                    setSuccess("Image loaded for watermark (saved to config preview). Save settings to persist.");
                                  };
                                  reader.readAsDataURL(f);
                                }} className={inp}/>
                                {config.watermark?.image_data&&<div className="text-xs mt-2">Image selected — will be embedded as watermark (centered, scaled).</div>}
                                <div className="mt-2">
                                  <label className={lbl}>Image Scale (%)</label>
                                  <input type="range" min="10" max="200" value={config.watermark?.scale||100} onChange={e=>cfgLocal("watermark.scale",parseInt(e.target.value))} className="w-full"/>
                                </div>
                                <div className="mt-2">
                                  <label className={lbl}>Image Placement</label>
                                  <select value={config.watermark?.placement||"center"} onChange={e=>cfgLocal("watermark.placement",e.target.value)} className={inp}>
                                    <option value="center">Center</option>
                                    <option value="top-left">Top Left</option>
                                    <option value="top-right">Top Right</option>
                                    <option value="bottom-left">Bottom Left</option>
                                    <option value="bottom-right">Bottom Right</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-sm border-b pb-2 dark:border-gray-700">Page Margins (inches)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {(["top","bottom","left","right"] as const).map(side=>(
                            <div key={side}>
                              <label className={lbl}>{side.charAt(0).toUpperCase()+side.slice(1)}: <strong>{config.page?.margins?.[side]||1.0}"</strong></label>
                              <input type="range" min="0.5" max="2.5" step="0.1" value={config.page?.margins?.[side]||1.0}
                                onChange={e=>cfgLocal(`page.margins.${side}`,parseFloat(e.target.value))} className="w-full accent-purple-600"/>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-sm border-b pb-2 dark:border-gray-700">Page Border</h4>
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={config.page?.border?.enabled||false} onChange={e=>cfgLocal("page.border.enabled",e.target.checked)} className="w-4 h-4 accent-purple-600"/><span className="text-sm">Enable page border</span></label>
                          {config.page?.border?.enabled&&(
                            <div className="pl-6 space-y-3">
                              <div>
                                <label className={lbl}>Border Style</label>
                                <select value={config.page?.border?.style||"single"} onChange={e=>cfgLocal("page.border.style",e.target.value)} className={inp}>
                                  <option value="single">Single (thin)</option>
                                  <option value="double">Double</option>
                                  <option value="thick">Thick</option>
                                  <option value="dashed">Dashed</option>
                                  <option value="dotted">Dotted</option>
                                </select>
                              </div>
                              <div>
                                <label className={lbl}>Border Width: <strong>{config.page?.border?.width||4}pt</strong> {(config.page?.border?.width||4)<=6?"(thin)":(config.page?.border?.width||4)<=16?"(medium)":"(thick)"}</label>
                                <input type="range" min="1" max="36" step="1" value={config.page?.border?.width||4}
                                  onChange={e=>cfgLocal("page.border.width",parseInt(e.target.value))} className="w-full accent-purple-600"/>
                                <div className={`flex justify-between text-xs mt-0.5 ${dark?"text-gray-600":"text-gray-400"}`}><span>1 (hairline)</span><span>36 (thick)</span></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab==="prompt"&&(
          <div className="space-y-5">
            <div className={`${card} overflow-hidden`}>
              <div className={`px-6 py-4 ${dark?"bg-gray-700/50":"bg-gradient-to-r from-purple-50 to-blue-50"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2"><Bot className="w-6 h-6 text-purple-500"/>AI Formatting Prompt</h2>
                    <p className="text-sm text-gray-500 mt-1">Copy this into ChatGPT or Claude with your raw notes. The AI returns marker-formatted text ready to paste and generate.</p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button onClick={copyPrompt}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:opacity-90 text-sm shadow-lg">
                      {promptCopied?<><Check className="w-4 h-4"/>Copied!</>:<><Copy className="w-4 h-4"/>Copy Prompt</>}
                    </button>
                    {!promptEditing
                      ?<button onClick={()=>setPromptEditing(true)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm border-2 ${dark?"border-gray-600 hover:bg-gray-700":"border-gray-300 hover:bg-gray-50"}`}><Pencil className="w-4 h-4"/>Edit</button>
                      :<>
                        <button onClick={savePrompt} disabled={promptSaving} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm">
                          {promptSaving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}Save
                        </button>
                        <button onClick={()=>{setPromptEditing(false);loadPrompt();}} className={`px-3 py-2.5 rounded-xl border-2 ${dark?"border-gray-600 hover:bg-gray-700":"border-gray-300 hover:bg-gray-50"}`}><X className="w-4 h-4"/></button>
                      </>
                    }
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className={`flex gap-4 mb-5 p-4 rounded-xl ${dark?"bg-blue-900/20 border border-blue-800":"bg-blue-50 border border-blue-200"}`}>
                  <div className="shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">?</div>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-600 dark:text-blue-400 text-sm mb-2">How to use this prompt</p>
                    <div className={`grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs ${dark?"text-blue-300":"text-blue-700"}`}>
                      {[
                        ["1","Copy","Click 'Copy Prompt' above"],
                        ["2","Open","Open ChatGPT or Claude in a new tab"],
                        ["3","Paste","Paste the prompt, then add your notes or image"],
                        ["4","Get","AI returns text in NotesForge marker format"],
                        ["5","Generate","Paste output into Editor → Generate"],
                      ].map(([n,title,desc])=>(
                        <div key={n} className={`p-2.5 rounded-lg ${dark?"bg-blue-900/30":"bg-white"} text-center`}>
                          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs mx-auto mb-1">{n}</div>
                          <div className="font-bold mb-0.5">{title}</div>
                          <div className="text-gray-500 dark:text-gray-400">{desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {promptEditing?(
                  <textarea value={promptText} onChange={e=>setPromptText(e.target.value)}
                    className={`w-full h-[520px] p-4 font-mono text-sm rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 ${dark?"bg-gray-900 border-gray-600 text-gray-200":"bg-gray-50 border-gray-300 text-gray-900"}`}/>
                ):(
                  <div className={`relative rounded-xl border ${dark?"bg-gray-900 border-gray-700":"bg-gray-50 border-gray-200"}`}>
                    <button onClick={copyPrompt} className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium shadow">
                      {promptCopied?<><Check className="w-3 h-3"/>Copied!</>:<><Copy className="w-3 h-3"/>Copy</>}
                    </button>
                    <pre className={`p-5 text-sm leading-relaxed whitespace-pre-wrap max-h-[520px] overflow-y-auto font-mono select-all ${dark?"text-gray-300":"text-gray-800"}`}>{promptText}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab==="shortcuts"&&(
          <div className="space-y-5">
            <div className={`${card} overflow-hidden`}>
              <div className={`px-6 py-4 ${dark?"bg-gray-700/50":"bg-gradient-to-r from-slate-50 to-blue-50"}`}>
                <h2 className="text-xl font-bold flex items-center gap-2"><Keyboard className="w-6 h-6 text-blue-500"/>Keyboard Shortcuts & Marker Reference</h2>
                <p className="text-sm text-gray-500 mt-1">Complete reference for all shortcuts and every marker command.</p>
              </div>
              <div className="p-6 space-y-6">
                {SHORTCUTS.map(group=>(
                  <div key={group.group}>
                    <h3 className={`font-bold text-sm mb-3 pb-2 border-b flex items-center gap-2 ${dark?"border-gray-700 text-gray-200":"border-gray-200 text-gray-900"}`}>
                      {group.group==="Editor"?<Keyboard className="w-4 h-4 text-blue-500"/>:<Code className="w-4 h-4 text-purple-500"/>}
                      {group.group}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {group.items.map((item,i)=>(
                        <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${dark?"bg-gray-700/50 hover:bg-gray-700":"bg-gray-50 hover:bg-gray-100"} transition-colors`}>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.keys.map((k,ki)=>(
                              <React.Fragment key={ki}>
                                <KBD k={k}/>
                                {ki<item.keys.length-1&&<span className="text-gray-400 text-xs">+</span>}
                              </React.Fragment>
                            ))}
                          </div>
                          <span className={`text-sm ${dark?"text-gray-300":"text-gray-700"}`}>{item.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <h3 className={`font-bold text-sm mb-3 pb-2 border-b flex items-center gap-2 ${dark?"border-gray-700":"border-gray-200"}`}>
                    <Highlighter className="w-4 h-4 text-yellow-500"/>HIGHLIGHT Colours
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["yellow","#FFFF00"],["green","#92D050"],["cyan","#00FFFF"],
                      ["blue","#BDD7EE"],["red","#FF0000"],["magenta","#FF00FF"],
                      ["darkBlue","#0070C0"],["darkGreen","#375623"],["darkRed","#C00000"],
                      ["lightGray","#D9D9D9"],["darkGray","#808080"],
                    ].map(([name,hex])=>(
                      <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium"
                        style={{background:hex,color:["darkBlue","darkGreen","darkRed","darkGray"].includes(name)?"white":"#111",borderColor:hex}}>
                        {name}
                      </div>
                    ))}
                  </div>
                  <p className={`text-xs mt-2 ${dark?"text-gray-500":"text-gray-400"}`}>Usage: <code className="font-mono">HIGHLIGHT: "Your text here" | "yellow"</code></p>
                </div>

                <div className={`p-4 rounded-xl ${dark?"bg-green-900/20 border border-green-800":"bg-green-50 border border-green-200"}`}>
                  <h3 className="font-bold text-green-600 dark:text-green-400 text-sm mb-3">💡 Pro Tips</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      ["Bullet indent","Use 2 spaces inside quotes: BULLET: \"  Indented item\""],
                      ["Multi-line code","Use one CODE: per line — they stack into a code block"],
                      ["Table rows","First TABLE row = header (styled differently automatically)"],
                      ["TOC position","Put TOC: at the very start, after the main HEADING"],
                      ["Auto-save","Your draft saves to browser every 30 seconds automatically"],
                      ["Custom filename","Type in the filename field before generating — no extension needed"],
                      ["Theme workflow","Apply theme → Adjust in Settings → Save Settings → Generate"],
                      ["AI workflow","Copy AI Prompt → paste in ChatGPT with notes → copy output → paste here"],
                    ].map(([title,tip])=>(
                      <div key={title} className={`p-2.5 rounded-lg ${dark?"bg-gray-800":"bg-white"}`}>
                        <div className="font-semibold text-xs text-green-600 dark:text-green-400 mb-0.5">{title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{tip}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showDrafts&&(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={()=>setShowDrafts(false)}>
          <div className={`${card} max-w-2xl w-full max-h-[80vh] overflow-hidden`} onClick={e=>e.stopPropagation()}>
            <div className={`px-6 py-4 border-b ${dark?"border-gray-700 bg-gray-700/50":"border-gray-100 bg-gray-50"} flex items-center justify-between`}>
              <h2 className="text-lg font-bold flex items-center gap-2"><Folder className="w-5 h-5 text-purple-500"/>Saved Drafts ({savedDrafts.length}/10)</h2>
              <button onClick={()=>setShowDrafts(false)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-xl border-2 border-dashed ${dark?"border-gray-600":"border-purple-200"}`}>
                <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4"/>Save Current Document</p>
                <div className="flex gap-2">
                  <input value={draftName} onChange={e=>setDraftName(e.target.value)}
                    placeholder="Draft name..." className={inp} onKeyDown={e=>e.key==="Enter"&&saveDraft()}/>
                  <button onClick={saveDraft} disabled={!draftName.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap">
                    <Save className="w-4 h-4 inline mr-1"/>Save
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {savedDrafts.length===0?(
                  <div className="text-center py-10 text-gray-400">
                    <Folder className="w-12 h-12 mx-auto mb-3 opacity-30"/>
                    <p className="text-sm">No saved drafts yet</p>
                    <p className="text-xs mt-1">Save your current document above to create one</p>
                  </div>
                ):(
                  savedDrafts.slice().reverse().map(draft=>(
                    <div key={draft.id} className={`p-4 rounded-lg border ${dark?"bg-gray-700/50 border-gray-600 hover:bg-gray-700":"bg-gray-50 border-gray-200 hover:bg-gray-100"} transition-colors`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm">{draft.name}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Saved {new Date(draft.savedAt).toLocaleString()} • {draft.content.split("\n").length} lines
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          <button onClick={()=>loadDraft(draft)}
                            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white" title="Load">
                            <Upload className="w-4 h-4"/>
                          </button>
                          <button onClick={()=>deleteDraft(draft.id)}
                            className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600" title="Delete">
                            <Trash2 className="w-4 h-4"/>
                          </button>
                        </div>
                      </div>
                      <div className={`text-xs font-mono p-2 rounded ${dark?"bg-gray-800":"bg-white"} overflow-hidden`} style={{maxHeight:"60px"}}>
                        {draft.content.split("\n").slice(0,3).join("\n")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showASCII&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={()=>setShowASCII(false)}>
          <div className={`${card} max-w-3xl w-full max-h-[80vh] overflow-auto`} onClick={e=>e.stopPropagation()}>
            <div className={`px-6 py-4 border-b ${dark?"border-gray-700":"border-gray-200"} flex items-center justify-between`}>
              <h2 className="text-lg font-bold">ASCII Character Helper</h2>
              <button onClick={()=>setShowASCII(false)}><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-3 text-sm">Box Characters (click to copy)</h3>
                <div className="grid grid-cols-12 gap-2">
                  {['┌','┐','└','┘','│','─','├','┤','┬','┴','┼','═','║','╔','╗','╚','╝'].map(char=>(
                    <button key={char} onClick={()=>{navigator.clipboard.writeText(char);setSuccess(`Copied: ${char}`)}}
                      className={`p-3 rounded-lg font-mono text-xl ${dark?"bg-gray-700 hover:bg-gray-600":"bg-gray-100 hover:bg-gray-200"}`}>
                      {char}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-sm">Arrows & Symbols</h3>
                <div className="grid grid-cols-12 gap-2">
                  {['→','←','↑','↓','●','○','■','□','▲','▼','◆','★','☆','✓','✗'].map(char=>(
                    <button key={char} onClick={()=>{navigator.clipboard.writeText(char);setSuccess(`Copied: ${char}`)}}
                      className={`p-3 rounded-lg font-mono text-xl ${dark?"bg-gray-700 hover:bg-gray-600":"bg-gray-100 hover:bg-gray-200"}`}>
                      {char}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-sm">Quick Templates</h3>
                <button onClick={()=>{
                  const template = `ASCII: "┌─────────┐"\nASCII: "│  Start  │"\nASCII: "└────┬────┘"\nASCII: "     │"\nASCII: "     ▼"\nASCII: "┌─────────┐"\nASCII: "│   End   │"\nASCII: "└─────────┘"`;
                  const cursor = taRef.current?.selectionStart || text.length;
                  handleText(text.slice(0,cursor) + "\n" + template + "\n" + text.slice(cursor));
                  setShowASCII(false);
                  setSuccess("✅ Inserted flowchart template");
                }} className={`w-full text-left p-3 rounded-lg border ${dark?"border-gray-600 hover:border-blue-500":"border-gray-200 hover:border-blue-400"}`}>
                  <div className="font-semibold text-sm">Simple Flowchart</div>
                  <pre className="text-xs mt-1 text-gray-500">┌─────┐\n│Start│\n└──┬──┘...</pre>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className={`mt-10 py-3 text-center border-t text-xs ${dark?"border-gray-800 text-gray-600":"border-gray-200 text-gray-400"}`}>
        NotesForge Professional v4.2 · {words} words · {mins} min read · Theme: {themes[currentTheme]?.name||currentTheme} · NEW: Drag-drop files · Live preview · Error detection · Image paste · Named drafts
      </footer>
    </div>
  );
}}"""