import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Wand2, Download, RefreshCw, ZoomIn, ZoomOut,
  ArrowRight, Sparkles, X, Check,
  Plus,
  Trash2, MoveVertical, LayoutTemplate, FileCode, FileImage, FileText, ChevronDown,
  Camera, PenTool, Hand, RotateCcw, ArrowLeft, Eraser, MinusCircle, PlusCircle,
  Loader2, MousePointer2, Layers, Box, Image as ImageIcon, PanelLeftClose,
  Type, Square, Circle, Triangle
} from 'lucide-react';
import type { Project, Screen, Drawing } from '@shared/schema';
import { IframeRenderer } from '@/components/IframeRenderer';
import { PLATFORM_DIMENSIONS } from '@/lib/constants';
import { exportPDF, captureElement } from '@/lib/export-utils';
import { generateUI } from '@/lib/gemini';

interface EditorProps {
  project: Project;
  onSave: (project: Project) => void;
  onBack: () => void;
}

export default function Editor({ project, onSave, onBack }: EditorProps) {
  const [prompt, setPrompt] = useState('');
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'mobile' | 'desktop' | 'general'>('mobile');
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [generatedScreens, setGeneratedScreens] = useState<Screen[]>(project.data.screens || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [toolMode, setToolMode] = useState<'cursor' | 'hand' | 'pen' | 'eraser' | 'text' | 'shapes'>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeSize, setStrokeSize] = useState(4);
  const [shapeMode, setShapeMode] = useState<'rect' | 'circle' | 'triangle' | null>(null);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [customColor, setCustomColor] = useState('#3b82f6');
  const [screenCount, setScreenCount] = useState(1);
  const [isDraggingScreen, setIsDraggingScreen] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  const sidebarIsOpened = !!activePanel;
  const isDrawingToolActive = toolMode === 'pen' || toolMode === 'eraser' || toolMode === 'text' || toolMode === 'shapes';
  const isInteracting = isPanning || isDrawingToolActive || isDraggingScreen;

  const fixedUILeft = sidebarIsOpened ? `calc(50% + 144px)` : '50%';
  const fixedUIStyle: React.CSSProperties = {
    position: 'fixed',
    left: fixedUILeft,
    transform: 'translateX(-50%)',
    transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 100
  };

  const getFixedScreenHeight = useCallback(() => PLATFORM_DIMENSIONS[platform].height, [platform]);
  const getFrameHeight = () => getFixedScreenHeight();
  const getFrameWidth = () => PLATFORM_DIMENSIONS[platform].width;

  // Undo Logic
  const saveStateToHistory = (newState: Screen[]) => {
    if (generatedScreens) {
      setHistory(prev => [...prev.slice(-19), JSON.stringify(generatedScreens)]);
    }
    setGeneratedScreens(newState);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previousState = JSON.parse(history[history.length - 1]);
    setHistory(prev => prev.slice(0, -1));
    setGeneratedScreens(previousState);
  };

  // Mouse Handlers
  const handleDragStart = useCallback((e: React.MouseEvent, screenIndex: number) => {
    if (toolMode !== 'cursor' || isPanning) return;
    e.preventDefault();
    setIsDraggingScreen(true);
    setActiveScreenIndex(screenIndex);

    const screenElement = e.currentTarget as HTMLElement;
    const rect = screenElement.getBoundingClientRect();
    
    const offsetX = (e.clientX - rect.left) / zoom;
    const offsetY = (e.clientY - rect.top) / zoom;
    
    setDragOffset({ x: offsetX, y: offsetY });
  }, [toolMode, isPanning, zoom]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDrawing && (toolMode === 'pen' || toolMode === 'eraser')) {
      const canvasContainer = canvasRef.current;
      if (!canvasContainer) return;
      
      const rect = canvasContainer.getBoundingClientRect();
      const scrollLeft = canvasContainer.scrollLeft;
      const scrollTop = canvasContainer.scrollTop;
      
      // Account for canvas container position and scroll
      const x = (e.clientX - rect.left + scrollLeft) / zoom;
      const y = (e.clientY - rect.top + scrollTop) / zoom;
      
      setDrawings(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const updated = { ...last, points: [...last.points, { x, y }] };
        return [...prev.slice(0, -1), updated];
      });
      return;
    }
    if (isPanning && canvasRef.current) {
      canvasRef.current.scrollLeft = scrollStart.left - (e.clientX - panStart.x);
      canvasRef.current.scrollTop = scrollStart.top - (e.clientY - panStart.y);
    }
  };

  const handleMouseUp = () => {
    if (isDraggingScreen) {
      saveStateToHistory(generatedScreens);
    }
    setIsPanning(false);
    setIsDrawing(false);
    setIsDraggingScreen(false);
    if (toolMode === 'pen' || toolMode === 'eraser' || toolMode === 'text' || toolMode === 'shapes') setToolMode('cursor');
  };

  // Save to parent
  useEffect(() => {
    onSave({
      ...project,
      updatedAt: Date.now(),
      data: { screens: generatedScreens }
    });
  }, [generatedScreens]);

  // Dragging Effect
  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDraggingScreen || !canvasRef.current) return;
      
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const newX = (e.clientX - canvasRect.left) / zoom + canvasRef.current.scrollLeft / zoom - dragOffset.x;
      const newY = (e.clientY - canvasRect.top) / zoom + canvasRef.current.scrollTop / zoom - dragOffset.y;
      
      setGeneratedScreens(prevScreens => {
        const newScreens = [...prevScreens];
        const screenToUpdate = newScreens[activeScreenIndex];
        if (screenToUpdate) {
          screenToUpdate.x = newX;
          screenToUpdate.y = newY;
        }
        return newScreens;
      });
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingScreen, activeScreenIndex, dragOffset, zoom]);

  // Center canvas
  useEffect(() => {
    if (canvasRef.current && generatedScreens.length > 0) {
      const el = canvasRef.current;
      const screenWidth = getFrameWidth();
      const screenHeight = getFrameHeight();
      const padding = 500;

      setTimeout(() => {
        const horizontalScrollTarget = padding - (el.clientWidth / 2) + (screenWidth / 2);
        el.scrollTop = padding - (el.clientHeight / 2) + (screenHeight / 2);
        el.scrollLeft = horizontalScrollTarget;
      }, 50);
    }
  }, [generatedScreens.length]);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setGenerationProgress(10);

    const skeletonHeight = getFixedScreenHeight();
    const skeletonHtml = `<div class="w-full h-full bg-neutral-950 flex flex-col items-center justify-center text-neutral-600 font-mono animate-pulse p-8"><div class="w-16 h-16 bg-neutral-800 rounded-full mb-6"></div><div class="w-3/4 h-4 bg-neutral-800 rounded mb-3"></div><div class="w-1/2 h-4 bg-neutral-800 rounded"></div></div>`;
    
    const newScreenPosition = generatedScreens.length > 0
      ? { x: (generatedScreens[0].x || 0) + getFrameWidth() + 100, y: generatedScreens[0].y || 0 }
      : { x: 0, y: 0 };

    const newScreens: Screen[] = Array.from({ length: screenCount }).map((_, i) => ({
      name: `Screen ${i + 1}`,
      rawHtml: skeletonHtml,
      type: 'html',
      height: skeletonHeight,
      x: newScreenPosition.x + i * (getFrameWidth() + 50),
      y: newScreenPosition.y
    }));

    if (generatedScreens.length > 0) saveStateToHistory(generatedScreens);
    setGeneratedScreens(newScreens);
    setActiveScreenIndex(0);

    try {
      const extractedHtml = await generateUI(prompt, screenCount, platform);
      
      setGenerationProgress(70);

      const finalScreens = newScreens.map((screen, idx) => ({
        ...screen,
        name: extractedHtml[idx] ? `Screen ${idx + 1}` : screen.name,
        rawHtml: extractedHtml[idx] || `<div class="w-full h-full flex items-center justify-center bg-red-900/50 text-white/80">ERROR: Could not parse HTML for screen ${idx + 1}</div>`,
      }));

      setGeneratedScreens(finalScreens);
      setGenerationProgress(100);
      setActivePanel(null);
    } catch (e: any) {
      console.error(e);
      alert(`Generation failed: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const addScreen = () => {
    const h = getFixedScreenHeight();
    const lastScreen = generatedScreens[generatedScreens.length - 1] || { x: 0, y: 0 };
    const offsetX = (lastScreen.x || 0) + getFrameWidth() + 50;
    const offsetY = lastScreen.y || 0;

    const newS: Screen = { 
      name: `Screen ${generatedScreens.length + 1}`, 
      rawHtml: '<div class="w-full h-full bg-black text-white flex items-center justify-center">New Screen</div>', 
      type: 'html', 
      height: h, 
      x: offsetX, 
      y: offsetY 
    };
    const next = [...generatedScreens, newS];
    saveStateToHistory(next);
    setActiveScreenIndex(generatedScreens.length);
  };

  const deleteComponent = (idx: number) => {
    if (!generatedScreens) return;
    const next = [...generatedScreens];
    next.splice(idx, 1);
    saveStateToHistory(next);
    if (activeScreenIndex >= next.length) setActiveScreenIndex(Math.max(0, next.length - 1));
  };

  const handleExport = (type: string, idx: number | null) => {
    setExportMenuOpen(false);
    if (!generatedScreens) return;
    
    if (type === 'html' && idx !== null) {
      const s = generatedScreens[idx];
      const blob = new Blob([s.rawHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${s.name}.html`;
      a.click();
    } else if (type === 'html-all') {
      // Export all screens as combined HTML
      let combinedHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>All Screens</title><style>body{margin:0;padding:20px;background:#050505;display:flex;flex-wrap:wrap;gap:20px;}.screen{border:2px solid #333;background:#1a1a1a;}iframe{width:100%;height:100%;border:none;}</style></head><body>';
      generatedScreens.forEach((screen, i) => {
        combinedHtml += `<div class="screen" style="width:${getFrameWidth()}px;height:${getFrameHeight()}px;"><iframe srcdoc="${screen.rawHtml.replace(/"/g, '&quot;')}"></iframe></div>`;
      });
      combinedHtml += '</body></html>';
      const blob = new Blob([combinedHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `layr_all_screens.html`;
      a.click();
    } else if (type === 'png') {
      // Capture all visible screens
      captureElement(null, 3, true).then(c => {
        if (c) {
          const a = document.createElement('a');
          a.href = c.toDataURL();
          a.download = `layr_export.png`;
          a.click();
        }
      });
    } else if (type === 'pdf' && idx !== null) {
      exportPDF(`screen-${idx}`, generatedScreens[idx].name);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Ignore clicks on buttons, inputs, or other UI elements
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    
    const drawingColor = toolMode === 'eraser' ? 'transparent' : customColor;
    
    if (toolMode === 'pen' || toolMode === 'eraser') {
      setIsDrawing(true);
      
      const canvasContainer = canvasRef.current;
      if (!canvasContainer) return;
      
      const rect = canvasContainer.getBoundingClientRect();
      const scrollLeft = canvasContainer.scrollLeft;
      const scrollTop = canvasContainer.scrollTop;
      
      // Account for canvas container position and scroll
      const x = (e.clientX - rect.left + scrollLeft) / zoom;
      const y = (e.clientY - rect.top + scrollTop) / zoom;
      
      setDrawings(p => [...p, { 
        color: drawingColor, 
        points: [{ x, y }], 
        strokeWidth: strokeSize, 
        isEraser: toolMode === 'eraser' 
      }]);
      return;
    }

    const screenTarget = (e.target as HTMLElement).closest('.draggable-screen');
    if (screenTarget && toolMode === 'cursor') {
      const screenIndex = parseInt((screenTarget as HTMLElement).dataset.index || '0', 10);
      handleDragStart(e, screenIndex);
      return;
    }
    
    if ((toolMode === 'hand' || e.button === 1) && canvasRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setScrollStart({ left: canvasRef.current.scrollLeft, top: canvasRef.current.scrollTop });
    }
  };

  const setSoloToolMode = (tool: typeof toolMode) => {
    setToolMode(tool);
    if (tool !== 'pen' && tool !== 'eraser' && tool !== 'text' && tool !== 'shapes') {
      setStrokeSize(4);
    }
  };

  const togglePanel = (p: string) => setActivePanel(p === activePanel ? null : p);

  const renderPanelContent = () => {
    if (activePanel === 'ai') {
      return (
        <>
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Prompt</label>
            <textarea 
              value={prompt} 
              onChange={e => setPrompt(e.target.value)} 
              placeholder="Describe the UI (e.g., 'Dark mode music player with album art')..." 
              className="w-full h-32 bg-[#222] border border-white/10 rounded-lg p-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none text-white"
              data-testid="input-prompt"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Device</label>
            <div className="flex gap-2 p-1 bg-[#222] rounded-lg">
              {(['mobile', 'desktop'] as const).map(p => (
                <button 
                  key={p} 
                  onClick={() => setPlatform(p)} 
                  className={`flex-1 py-2 rounded text-xs font-medium transition-all ${platform === p ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'}`}
                  data-testid={`button-platform-${p}`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-3 border-t border-white/10">
            <div className="flex justify-between">
              <label className="text-[10px] font-bold text-neutral-500 uppercase">Screens to Generate</label>
              <span className="text-xs text-blue-400 font-mono" data-testid="text-screen-count">{screenCount}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="5" 
              value={screenCount} 
              onChange={e => setScreenCount(Number(e.target.value))} 
              className="w-full accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none"
              data-testid="input-screen-count"
            />
          </div>
          <button 
            onClick={handleGenerate} 
            disabled={isGenerating || !prompt} 
            className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 mt-6 transition-all ${isGenerating ? 'bg-blue-900/50 text-blue-200' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}
            data-testid="button-generate"
          >
            {isGenerating ? <RefreshCw className="animate-spin w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
            {isGenerating ? 'Generating...' : 'Generate UI'}
          </button>
        </>
      );
    }
    return <div className="text-neutral-500 text-sm text-center mt-10">Select a tool</div>;
  };

  return (
    <div className="flex h-screen w-full bg-[#050505] text-neutral-200 font-sans overflow-hidden selection:bg-blue-500/30">
      <style>{`
        @keyframes subtle-pulse { 0%, 100% { box-shadow: 0 0 100px 50px rgba(59, 130, 246, 0.05); } 50% { box-shadow: 0 0 150px 80px rgba(59, 130, 246, 0.15); } }
        @keyframes blue-glow { 0%, 100% { box-shadow: inset 0 0 30px rgba(59, 130, 246, 0.2), 0 0 60px rgba(59, 130, 246, 0.3); } 50% { box-shadow: inset 0 0 50px rgba(59, 130, 246, 0.4), 0 0 100px rgba(59, 130, 246, 0.5); } }
        #drawing-layer { 
          mix-blend-mode: normal;
          pointer-events: auto;
        }
        .canvas-drawing { mix-blend-mode: normal; }
        .viewport-generating {
          animation: blue-glow 2s ease-in-out infinite;
          border: 2px solid rgba(59, 130, 246, 0.6);
        }
      `}</style>

      {/* Sidebar */}
      <div className={`absolute top-0 left-0 h-full w-72 bg-[#0A0A0A]/95 border-r border-white/10 backdrop-blur-md z-[80] transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${sidebarIsOpened ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-sm font-bold tracking-wide text-white flex items-center gap-2">
            <Wand2 size={16} className="text-blue-500" /> GENERATOR
          </h2>
          <button onClick={() => setActivePanel(null)} className="text-neutral-500 hover:text-white" data-testid="button-close-sidebar">
            <PanelLeftClose size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">{renderPanelContent()}</div>
      </div>

      {/* Main Workspace */}
      <div 
        className="flex flex-col flex-1 h-full relative transition-all duration-300" 
        style={{ marginLeft: sidebarIsOpened ? '288px' : '0px' }} 
        onMouseUp={handleMouseUp} 
        onMouseMove={handleMouseMove}
      >
        {/* Top Bar */}
        <div 
          className="absolute top-6 z-[70] flex items-center gap-1 p-1.5 rounded-xl bg-[#1A1A1A]/70 border border-white/20 shadow-2xl backdrop-blur-xl no-print transition-all duration-300" 
          style={fixedUIStyle}
        >
          <button onClick={onBack} className="p-2 hover:bg-white/20 rounded text-neutral-400 hover:text-white" title="Back" data-testid="button-back">
            <ArrowLeft size={14} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-2"></div>
          <button onClick={() => setSoloToolMode('cursor')} className={`p-2 hover:bg-white/20 rounded ${toolMode === 'cursor' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'}`} title="Select" data-testid="button-tool-cursor">
            <MousePointer2 size={14} />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-2 hover:bg-white/20 rounded text-neutral-400 hover:text-white" data-testid="button-zoom-out">
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] font-mono w-8 text-center text-neutral-400" data-testid="text-zoom-level">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-2 hover:bg-white/20 rounded text-neutral-400 hover:text-white" data-testid="button-zoom-in">
            <ZoomIn size={14} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-2"></div>
          <button onClick={() => togglePanel('ai')} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-all" data-testid="button-open-ai-panel">
            <Sparkles size={14} /> Generate
          </button>
          <div className="w-px h-4 bg-white/10 mx-2"></div>
          <div className="relative">
            <button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="flex items-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold border border-white/10 transition-colors text-white" data-testid="button-export-menu">
              <Download size={14} /> Export <ChevronDown size={10} />
            </button>
            {exportMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-[#1A1A1A]/90 border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden backdrop-blur-md">
                <button onClick={() => handleExport('html', activeScreenIndex)} className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-left hover:bg-white/10 text-white" data-testid="button-export-html">
                  <FileCode size={14} className="text-blue-400" /> This Screen HTML
                </button>
                <button onClick={() => handleExport('html-all', null)} className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-left hover:bg-white/10 text-white" data-testid="button-export-html-all">
                  <FileCode size={14} className="text-cyan-400" /> All Screens HTML
                </button>
                <button onClick={() => handleExport('pdf', activeScreenIndex)} className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-left hover:bg-white/10 text-white" data-testid="button-export-pdf">
                  <FileText size={14} className="text-red-400" /> Print PDF
                </button>
                <button onClick={() => handleExport('png', null)} className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-left hover:bg-white/10 text-white" data-testid="button-export-png">
                  <FileImage size={14} className="text-purple-400" /> Save Image
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div 
          ref={canvasRef} 
          className={`viewport-container flex-1 relative overflow-auto ${toolMode === 'hand' || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${isGenerating ? 'viewport-generating' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onWheel={(e) => { 
            if (e.ctrlKey || e.metaKey) { 
              e.preventDefault(); 
              setZoom(z => Math.min(Math.max(0.2, z - e.deltaY * 0.005), 3)); 
            } 
          }}
          style={{
            backgroundColor: '#050505',
            backgroundImage: zoom >= 0.20 ? `radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)` : 'none',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundRepeat: 'repeat',
            backgroundAttachment: 'local',
          }}
        >
          {/* Generation Progress */}
          {isGenerating && (
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[45] transition-all duration-300" style={fixedUIStyle}>
              <div className="absolute inset-0 m-[-150px] animate-[subtle-pulse_2s_ease-in-out_infinite] mix-blend-screen z-[20] rounded-full bg-blue-600/10 blur-[100px]"></div>
              <div className="relative p-6 rounded-xl bg-[#1A1A1A]/95 border border-blue-500/50 backdrop-blur-lg shadow-2xl shadow-blue-900/50 z-[40] flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-blue-400" size={24} />
                <p className="text-lg font-bold text-white tracking-wider">
                  UI Completion: <span className="text-blue-400" data-testid="text-generation-progress">{generationProgress}%</span>
                </p>
              </div>
            </div>
          )}
          
          <div 
            id="canvas-root" 
            className="flex gap-20 transition-transform duration-200 ease-out relative" 
            style={{ 
              transform: `scale(${zoom})`, 
              minWidth: 'fit-content', 
              minHeight: 'fit-content', 
              padding: '500px', 
              paddingTop: '200px', 
              margin: 'auto', 
              gap: '200px' 
            }}
          >
            <svg id="drawing-layer" className="canvas-drawing absolute inset-0 w-full h-full overflow-visible z-40" style={{ minWidth: '100%', minHeight: '100%', pointerEvents: isDrawingToolActive ? 'auto' : 'none' }}>
              {drawings.map((d, i) => 
                d.isEraser ? (
                  <circle 
                    key={i}
                    cx={d.points[d.points.length - 1]?.x || 0}
                    cy={d.points[d.points.length - 1]?.y || 0}
                    r={d.strokeWidth / 2}
                    fill="rgba(255, 255, 255, 0.1)"
                    stroke="rgba(255, 255, 255, 0.2)"
                    strokeWidth="1"
                    opacity={0.5}
                  />
                ) : (
                  <path 
                    key={i} 
                    d={`M ${d.points.map(p => `${p.x} ${p.y}`).join(' L ')}`} 
                    stroke={d.color} 
                    strokeWidth={d.strokeWidth} 
                    fill="none" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    style={{ 
                      mixBlendMode: 'normal',
                      opacity: 0.9,
                      stroke: d.color
                    }} 
                  />
                )
              )}
            </svg>
            
            {/* Initial placeholder */}
            {generatedScreens.length === 0 && !isGenerating && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shadow-2xl shadow-blue-500/20 animate-pulse">
                  <Wand2 size={36} className="text-blue-400" />
                </div>
                <p className="mt-4 text-neutral-400 text-sm" data-testid="text-placeholder">Start Architecting</p>
              </div>
            )}

            {/* Screen Frames */}
            {generatedScreens?.map((screen, idx) => (
              <div 
                key={idx} 
                id={`screen-${idx}`} 
                data-index={idx}
                onClick={() => setActiveScreenIndex(idx)} 
                onMouseDown={toolMode === 'cursor' ? (e) => handleDragStart(e, idx) : undefined}
                className={`draggable-screen absolute group ${idx === activeScreenIndex ? 'ring-4 ring-blue-500/50 z-10' : 'hover:scale-[1.01]'} ${toolMode === 'cursor' ? 'cursor-grab' : ''}`}
                style={{
                  transform: `translate(${(screen.x || 0) + 500}px, ${(screen.y || 0) + 500}px) scale(${zoom})${idx === activeScreenIndex ? ' scale(1.02)' : ''}`,
                  transformOrigin: 'top left',
                  zIndex: activeScreenIndex === idx && isDraggingScreen ? 60 : activeScreenIndex === idx ? 10 : 5,
                  transition: isDraggingScreen ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                data-testid={`screen-${idx}`}
              >
                <div className="absolute -top-14 left-0 right-0 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity px-1">
                  <span className="text-sm font-bold text-neutral-500 bg-black/50 px-3 py-1 rounded-full" data-testid={`text-screen-name-${idx}`}>{screen.name}</span>
                  <div className="flex gap-1 bg-[#1A1A1A] p-1 rounded-lg border border-white/10 shadow-lg">
                    <button onClick={(e) => { e.stopPropagation(); deleteComponent(idx); }} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded text-neutral-400" title="Delete" data-testid={`button-delete-screen-${idx}`}>
                      <Trash2 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleExport('png', idx); }} className="p-2 hover:bg-white/10 rounded text-neutral-400 hover:text-white" title="Save" data-testid={`button-export-screen-${idx}`}>
                      <Camera size={14} />
                    </button>
                  </div>
                </div>
                <div 
                  className={`bg-black shadow-2xl overflow-hidden relative border-[8px] border-[#1a1a1a] ring-1 ring-white/10 ${platform === 'mobile' ? 'w-[375px] rounded-[50px]' : 'w-[1200px] rounded-xl'}`} 
                  style={{ height: getFrameHeight() + 'px' }}
                >
                  {platform === 'mobile' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#1a1a1a] rounded-b-xl z-20 pointer-events-none"></div>}
                  <IframeRenderer htmlContent={screen.rawHtml} isInteracting={isInteracting} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drawing Layer Overlay */}
        <div 
          id="drawing-layer-overlay" 
          className={`absolute inset-0 z-50 ${isDrawingToolActive ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            cursor: toolMode === 'text' ? 'text' : toolMode === 'shapes' ? 'crosshair' : 'auto'
          }}
        />

        {/* Bottom Dock */}
        <div className="absolute bottom-8 z-[100] p-2 rounded-2xl bg-[#1A1A1A]/70 border border-white/20 shadow-2xl backdrop-blur-xl flex items-center gap-2 transition-all no-print" style={fixedUIStyle}>
          <div className="flex gap-1">
            <button onClick={() => setSoloToolMode('cursor')} className={`p-2.5 rounded-xl ${toolMode === 'cursor' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/20'}`} title="Select" data-testid="button-dock-cursor">
              <MousePointer2 size={18} />
            </button>
            <button onClick={() => setSoloToolMode('hand')} className={`p-2.5 rounded-xl ${toolMode === 'hand' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/20'}`} title="Pan" data-testid="button-dock-hand">
              <Hand size={18} />
            </button>
          </div>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <div className="flex gap-1">
            <button onClick={addScreen} className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/20" title="Add Frame" data-testid="button-add-screen">
              <LayoutTemplate size={18} />
            </button>
            <button onClick={() => setSoloToolMode('pen')} className={`p-2.5 rounded-xl ${toolMode === 'pen' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/20'}`} title="Pen" data-testid="button-tool-pen">
              <PenTool size={18} />
            </button>
            <button onClick={() => setSoloToolMode('eraser')} className={`p-2.5 rounded-xl ${toolMode === 'eraser' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/20'}`} title="Eraser" data-testid="button-tool-eraser">
              <Eraser size={18} />
            </button>
            <button onClick={() => setSoloToolMode('text')} className={`p-2.5 rounded-xl ${toolMode === 'text' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/20'}`} title="Text" data-testid="button-tool-text">
              <Type size={18} />
            </button>
            <div className="relative">
              <button onClick={() => setShowShapeMenu(!showShapeMenu)} className={`p-2.5 rounded-xl ${toolMode === 'shapes' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/20'}`} title="Shapes" data-testid="button-tool-shapes">
                <Box size={18} />
              </button>
              {showShapeMenu && (
                <div className="absolute bottom-full mb-2 left-0 flex gap-1 bg-[#1A1A1A] p-2 rounded-lg border border-white/10">
                  <button onClick={() => { setToolMode('shapes'); setShapeMode('rect'); setShowShapeMenu(false); }} className="p-2 rounded hover:bg-white/20" title="Rectangle" data-testid="button-shape-rect">
                    <Square size={14} />
                  </button>
                  <button onClick={() => { setToolMode('shapes'); setShapeMode('circle'); setShowShapeMenu(false); }} className="p-2 rounded hover:bg-white/20" title="Circle" data-testid="button-shape-circle">
                    <Circle size={14} />
                  </button>
                  <button onClick={() => { setToolMode('shapes'); setShapeMode('triangle'); setShowShapeMenu(false); }} className="p-2 rounded hover:bg-white/20" title="Triangle" data-testid="button-shape-triangle">
                    <Triangle size={14} />
                  </button>
                </div>
              )}
            </div>
            {isDrawingToolActive && (
              <div className="flex items-center gap-2 bg-[#1A1A1A] p-2 rounded-xl border border-white/10">
                <MinusCircle size={14} className="text-neutral-400" />
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  value={strokeSize} 
                  onChange={e => setStrokeSize(Number(e.target.value))} 
                  className="w-16 h-1 accent-blue-500 rounded-lg appearance-none"
                  data-testid="input-stroke-size"
                />
                <PlusCircle size={14} className="text-neutral-400" />
              </div>
            )}
            <button onClick={undo} disabled={history.length === 0} className={`p-2.5 rounded-xl ${history.length === 0 ? 'text-neutral-700' : 'text-neutral-400 hover:text-white hover:bg-white/20'}`} title="Undo" data-testid="button-undo">
              <RotateCcw size={18} />
            </button>
          </div>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <div className="flex gap-1 items-center">
            <button onClick={() => togglePanel('ai')} className={`p-2.5 rounded-xl ${activePanel === 'ai' ? 'text-purple-400 bg-purple-500/20' : 'text-neutral-400 hover:text-white'}`} title="AI Generator" data-testid="button-dock-ai">
              <Sparkles size={18} />
            </button>
            <div className="relative w-8 h-8 flex items-center justify-center">
              <input 
                type="color" 
                value={customColor} 
                onChange={e => setCustomColor(e.target.value)} 
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                data-testid="input-color-picker"
              />
              <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: customColor }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
