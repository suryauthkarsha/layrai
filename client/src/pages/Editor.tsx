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
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [textBoxes, setTextBoxes] = useState<Array<{ id: string; x: number; y: number; text: string }>>([]);
  const [shapes, setShapes] = useState<Array<{ id: string; type: 'rect' | 'circle' | 'triangle'; x: number; y: number; width: number; height: number; color: string }>>([]);
  const [shapePreview, setShapePreview] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // Redraw overlay canvas
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pen strokes
    drawings.forEach(d => {
      if (d.isEraser) return;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = d.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (d.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(d.points[0].x, d.points[0].y);
      for (let i = 1; i < d.points.length; i++) {
        ctx.lineTo(d.points[i].x, d.points[i].y);
      }
      ctx.stroke();
    });

    // Draw shapes
    shapes.forEach(shape => {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 2;
      
      if (shape.type === 'rect') {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      } else if (shape.type === 'circle') {
        ctx.beginPath();
        ctx.arc(shape.x + shape.width / 2, shape.y + shape.height / 2, Math.min(shape.width, shape.height) / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.type === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(shape.x + shape.width / 2, shape.y);
        ctx.lineTo(shape.x, shape.y + shape.height);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.closePath();
        ctx.stroke();
      }
    });

    // Draw shape preview
    if (isDrawing && toolMode === 'shapes' && shapeStart && shapePreview && shapeMode) {
      const w = Math.abs(shapePreview.x - shapeStart.x);
      const h = Math.abs(shapePreview.y - shapeStart.y);
      const x = Math.min(shapeStart.x, shapePreview.x);
      const y = Math.min(shapeStart.y, shapePreview.y);

      ctx.strokeStyle = customColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.7;

      if (shapeMode === 'rect') {
        ctx.strokeRect(x, y, w, h);
      } else if (shapeMode === 'circle') {
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shapeMode === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }, [drawings, shapes, isDrawing, toolMode, shapeStart, shapePreview, shapeMode, customColor]);

  // Setup canvas size
  useEffect(() => {
    const resizeCanvas = () => {
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = window.innerWidth;
        overlayCanvasRef.current.height = window.innerHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    if (!isDrawingToolActive) return;

    const x = e.clientX;
    const y = e.clientY;

    if (toolMode === 'pen') {
      setIsDrawing(true);
      setDrawings(prev => [...prev, { color: customColor, points: [{ x, y }], strokeWidth: strokeSize, isEraser: false }]);
    } else if (toolMode === 'eraser') {
      setIsDrawing(true);
    } else if (toolMode === 'shapes' && shapeMode) {
      setIsDrawing(true);
      setShapeStart({ x, y });
      setShapePreview({ x, y });
    } else if (toolMode === 'text') {
      setTextBoxes(prev => [...prev, { id: `text-${Date.now()}`, x, y, text: 'Edit text' }]);
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;

    const x = e.clientX;
    const y = e.clientY;

    if (toolMode === 'pen') {
      setDrawings(prev => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        if (last.isEraser) return prev;
        const newPoints = [...last.points, { x, y }];
        return [...prev.slice(0, -1), { ...last, points: newPoints }];
      });
    } else if (toolMode === 'eraser') {
      const radius = strokeSize * 2;
      setDrawings(prev =>
        prev.filter(d => !d.isEraser && !d.points.some(p => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < radius))
      );
    } else if (toolMode === 'shapes' && shapeStart) {
      setShapePreview({ x, y });
    }
  };

  const handleOverlayMouseUp = () => {
    if (isDrawing && toolMode === 'shapes' && shapeStart && shapePreview && shapeMode) {
      const w = Math.abs(shapePreview.x - shapeStart.x);
      const h = Math.abs(shapePreview.y - shapeStart.y);
      
      if (w > 10 && h > 10) {
        const x = Math.min(shapeStart.x, shapePreview.x);
        const y = Math.min(shapeStart.y, shapePreview.y);
        setShapes(prev => [...prev, { id: `shape-${Date.now()}`, type: shapeMode, x, y, width: w, height: h, color: customColor }]);
      }
    }

    setIsDrawing(false);
    setShapeStart(null);
    setShapePreview(null);
  };

  // Mouse Handlers for screen dragging
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
    window.addEventListener('mouseup', () => {
      if (isDraggingScreen) saveStateToHistory(generatedScreens);
      setIsDraggingScreen(false);
    });

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', () => {});
    };
  }, [isDraggingScreen, activeScreenIndex, dragOffset, zoom, generatedScreens]);

  // Center canvas
  useEffect(() => {
    if (canvasRef.current && generatedScreens.length > 0) {
      const el = canvasRef.current;
      const screenWidth = getFrameWidth();
      const screenHeight = getFrameHeight();
      const padding = 500;

      setTimeout(() => {
        const screenPaddedWidth = screenWidth + 16;
        const horizontalScrollTarget = padding - (el.clientWidth / 2) + (screenPaddedWidth / 2);
        const verticalScrollTarget = padding - (el.clientHeight / 2) + (screenHeight / 2) - 100;
        
        el.scrollLeft = horizontalScrollTarget;
        el.scrollTop = Math.max(padding - 200, verticalScrollTarget);
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
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev < 85) {
            return prev + Math.random() * 15;
          }
          return prev;
        });
      }, 300);

      const extractedHtml = await generateUI(prompt, screenCount, platform);
      
      clearInterval(progressInterval);
      setGenerationProgress(90);

      const finalScreens = newScreens.map((screen, idx) => ({
        ...screen,
        name: extractedHtml[idx] ? `Screen ${idx + 1}` : screen.name,
        rawHtml: extractedHtml[idx] || `<div class="w-full h-full flex items-center justify-center bg-red-900/50 text-white/80">ERROR: Could not parse HTML for screen ${idx + 1}</div>`,
      }));

      setGeneratedScreens(finalScreens);
      setGenerationProgress(100);
      
      setTimeout(() => setActivePanel(null), 800);
    } catch (e: any) {
      console.error(e);
      alert(`Generation failed: ${e.message}`);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const deleteComponent = (idx: number) => {
    saveStateToHistory(generatedScreens);
    setGeneratedScreens(prev => prev.filter((_, i) => i !== idx));
    if (activeScreenIndex >= idx && activeScreenIndex > 0) setActiveScreenIndex(activeScreenIndex - 1);
  };

  const handleExport = async (format: 'html' | 'html-all' | 'pdf' | 'png', screenIndex: number | null) => {
    if (format === 'html' && screenIndex !== null) {
      const html = generatedScreens[screenIndex].rawHtml;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      a.download = `screen-${screenIndex}.html`;
      a.click();
    } else if (format === 'html-all') {
      const wrappedHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>All Screens</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { margin: 0; padding: 0; background: #000; }
            .screen-container { display: flex; gap: 2rem; padding: 2rem; flex-wrap: wrap; justify-content: center; }
            .screen-frame { border: 8px solid #1a1a1a; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8); }
            .screen-frame.mobile { width: 375px; border-radius: 50px; }
            .screen-frame.desktop { width: 1200px; }
            iframe { border: none; display: block; }
          </style>
        </head>
        <body>
          <div class="screen-container">
            ${generatedScreens.map((screen, idx) => `
              <div class="screen-frame ${platform}">
                <iframe srcdoc="${screen.rawHtml.replace(/"/g, '&quot;')}" style="width: 100%; height: ${getFrameHeight()}px;"></iframe>
              </div>
            `).join('')}
          </div>
        </body>
        </html>
      `;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([wrappedHtml], { type: 'text/html' }));
      a.download = 'all-screens.html';
      a.click();
    } else if (format === 'pdf' && screenIndex !== null) {
      exportPDF(`screen-${screenIndex}`, generatedScreens[screenIndex].name);
    } else if (format === 'png') {
      captureElement('canvas-root', `screens-${Date.now()}.png`, 3);
    }
  };

  const setSoloToolMode = (tool: typeof toolMode) => {
    setToolMode(tool);
    if (tool !== 'pen' && tool !== 'eraser' && tool !== 'text' && tool !== 'shapes') {
      setShowShapeMenu(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505]">
      {/* Overlay Canvas for Drawing */}
      <canvas
        ref={overlayCanvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          pointerEvents: isDrawingToolActive ? 'auto' : 'none',
          zIndex: 40,
          cursor: toolMode === 'pen' ? 'crosshair' : toolMode === 'eraser' ? 'grab' : toolMode === 'text' ? 'text' : 'pointer'
        }}
        onMouseDown={handleOverlayMouseDown}
        onMouseMove={handleOverlayMouseMove}
        onMouseUp={handleOverlayMouseUp}
        onMouseLeave={handleOverlayMouseUp}
      />

      {/* Sidebar */}
      {activePanel === 'generate' && (
        <div className="w-72 bg-[#1A1A1A] border-r border-white/10 overflow-auto flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-sm font-bold text-white" data-testid="heading-generate">Generate UI</h2>
            <button onClick={() => setActivePanel(null)} className="p-1 hover:bg-white/10 rounded" data-testid="button-close-panel">
              <X size={16} className="text-neutral-400" />
            </button>
          </div>
          <div className="flex-1 p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-2" data-testid="label-prompt">Design Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the UI you want to create..."
                className="w-full h-24 bg-[#252525] border border-white/10 rounded-lg p-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500/50"
                data-testid="input-prompt"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-2" data-testid="label-platform">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as any)} className="w-full bg-[#252525] border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500/50" data-testid="select-platform">
                <option value="mobile">Mobile (375x812)</option>
                <option value="desktop">Desktop (1200x800)</option>
                <option value="general">General (1200x600)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-2" data-testid="label-count">Screens</label>
              <input type="number" min="1" max="5" value={screenCount} onChange={(e) => setScreenCount(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))} className="w-full bg-[#252525] border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500/50" data-testid="input-screen-count" />
            </div>
          </div>
          <div className="p-4 border-t border-white/10 space-y-2">
            <button onClick={handleGenerate} disabled={isGenerating || !prompt} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2" data-testid="button-generate">
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
            <button onClick={() => setActivePanel(null)} className="w-full bg-neutral-800/50 hover:bg-neutral-700/50 text-white text-sm font-semibold py-2 rounded-lg transition-colors" data-testid="button-cancel">Cancel</button>
          </div>
        </div>
      )}

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar - Floating Glass */}
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 backdrop-blur-xl bg-[#1A1A1A]/60 border border-white/10 rounded-2xl shadow-2xl px-6 py-3 flex items-center justify-between gap-6">
          <button onClick={onBack} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors" data-testid="button-back">
            <ArrowLeft size={16} />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="flex items-center gap-3">
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} title="Zoom Out" className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white" data-testid="button-zoom-out">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-medium text-neutral-400 w-12 text-center" data-testid="text-zoom">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} title="Zoom In" className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white" data-testid="button-zoom-in">
              <ZoomIn size={16} />
            </button>
            <div className="h-5 w-px bg-white/10"></div>
            <button onClick={() => setActivePanel('generate')} className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/40 text-blue-400 text-sm font-medium transition-colors flex items-center gap-2" data-testid="button-generate-panel">
              <Sparkles size={14} />
              Generate
            </button>
            <button onClick={() => setExportMenuOpen(!exportMenuOpen)} title="Export" className="p-2 relative hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white" data-testid="button-export">
              <Download size={16} />
              {exportMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-[#1A1A1A]/70 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-50 overflow-hidden">
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
            </button>
            <button onClick={undo} disabled={history.length === 0} className="p-2 hover:bg-white/10 disabled:hover:bg-transparent rounded-lg text-neutral-400 hover:text-white disabled:text-neutral-600" title="Undo" data-testid="button-undo">
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
        
        {/* Spacer for floating top bar */}
        <div className="h-0"></div>

        {/* Canvas Area */}
        <div 
          ref={canvasRef} 
          className={`viewport-container flex-1 relative overflow-auto ${toolMode === 'hand' || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${isGenerating ? 'viewport-generating' : ''}`}
          onMouseDown={(e) => {
            if (toolMode === 'cursor') {
              const screenTarget = (e.target as HTMLElement).closest('.draggable-screen');
              if (screenTarget) {
                const idx = parseInt((screenTarget as HTMLElement).dataset.index || '0', 10);
                handleDragStart(e, idx);
              }
            } else if (toolMode === 'hand' && !isPanning) {
              setIsPanning(true);
              setPanStart({ x: e.clientX, y: e.clientY });
              setScrollStart({ left: canvasRef.current?.scrollLeft || 0, top: canvasRef.current?.scrollTop || 0 });
            }
          }}
          onMouseMove={(e) => {
            if (isPanning && canvasRef.current) {
              canvasRef.current.scrollLeft = scrollStart.left - (e.clientX - panStart.x);
              canvasRef.current.scrollTop = scrollStart.top - (e.clientY - panStart.y);
            }
          }}
          onMouseUp={() => setIsPanning(false)}
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
                  UI Completion: <span className="text-blue-400" data-testid="text-generation-progress">{Math.round(generationProgress)}%</span>
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
              padding: '800px 500px', 
              margin: 'auto', 
              gap: '200px' 
            }}
          >
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
          
          {/* Text boxes */}
          {textBoxes.map(textBox => (
            <div
              key={textBox.id}
              style={{
                position: 'fixed',
                left: textBox.x,
                top: textBox.y,
                zIndex: 35
              }}
              className="bg-white text-black p-2 rounded border border-gray-300 shadow-md"
            >
              <input
                type="text"
                value={textBox.text}
                onChange={(e) => setTextBoxes(prev => 
                  prev.map(tb => tb.id === textBox.id ? { ...tb, text: e.target.value } : tb)
                )}
                className="outline-none bg-transparent border-none w-auto min-w-[100px]"
                autoFocus
              />
            </div>
          ))}
        </div>

        {/* Bottom Toolbar - Floating Glass */}
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 backdrop-blur-xl bg-[#1A1A1A]/60 border border-white/10 rounded-2xl shadow-2xl px-6 py-3 flex items-center justify-center gap-4">
          {/* Navigation Tools */}
          <div className="flex items-center gap-2 bg-[#252525]/60 p-1.5 rounded-lg border border-white/5">
            <button
              onClick={() => setSoloToolMode('cursor')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${toolMode === 'cursor' ? 'bg-blue-600/40 text-blue-300' : 'text-neutral-400 hover:text-white'}`}
              title="Cursor"
              data-testid="button-tool-cursor"
            >
              <MousePointer2 size={16} />
            </button>
            <button
              onClick={() => setSoloToolMode('hand')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${toolMode === 'hand' ? 'bg-blue-600/40 text-blue-300' : 'text-neutral-400 hover:text-white'}`}
              title="Hand / Pan"
              data-testid="button-tool-hand"
            >
              <Hand size={16} />
            </button>
          </div>

          {/* Drawing Tools */}
          <div className="flex items-center gap-2 bg-[#252525]/60 p-1.5 rounded-lg border border-white/5">
            <button
              onClick={() => setSoloToolMode('pen')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${toolMode === 'pen' ? 'bg-blue-600/40 text-blue-300' : 'text-neutral-400 hover:text-white'}`}
              title="Pen"
              data-testid="button-tool-pen"
            >
              <PenTool size={16} />
            </button>
            <button
              onClick={() => setSoloToolMode('eraser')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${toolMode === 'eraser' ? 'bg-blue-600/40 text-blue-300' : 'text-neutral-400 hover:text-white'}`}
              title="Eraser"
              data-testid="button-tool-eraser"
            >
              <Eraser size={16} />
            </button>
            <div className="h-5 w-px bg-white/10"></div>
            <button
              onClick={() => setSoloToolMode('shapes')}
              className={`px-2.5 py-1.5 rounded-lg transition-all relative ${toolMode === 'shapes' ? 'bg-blue-600/40 text-blue-300' : 'text-neutral-400 hover:text-white'}`}
              title="Shapes"
              data-testid="button-tool-shapes"
            >
              <Box size={16} />
              {toolMode === 'shapes' && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#1A1A1A]/70 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl p-2 flex gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShapeMode('rect'); }}
                    className={`p-2 rounded-lg transition-all ${shapeMode === 'rect' ? 'bg-blue-600/50 text-blue-300' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`}
                    title="Rectangle"
                    data-testid="button-shape-rect"
                  >
                    <Square size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShapeMode('circle'); }}
                    className={`p-2 rounded-lg transition-all ${shapeMode === 'circle' ? 'bg-blue-600/50 text-blue-300' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`}
                    title="Circle"
                    data-testid="button-shape-circle"
                  >
                    <Circle size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShapeMode('triangle'); }}
                    className={`p-2 rounded-lg transition-all ${shapeMode === 'triangle' ? 'bg-blue-600/50 text-blue-300' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`}
                    title="Triangle"
                    data-testid="button-shape-triangle"
                  >
                    <Triangle size={14} />
                  </button>
                </div>
              )}
            </button>
            <button
              onClick={() => setSoloToolMode('text')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${toolMode === 'text' ? 'bg-blue-600/40 text-blue-300' : 'text-neutral-400 hover:text-white'}`}
              title="Text"
              data-testid="button-tool-text"
            >
              <Type size={16} />
            </button>
          </div>

          {/* Stroke Settings */}
          <div className="flex items-center gap-3 bg-[#252525]/60 px-4 py-1.5 rounded-lg border border-white/5">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-7 h-7 rounded-md cursor-pointer border border-white/30"
              title="Color"
              data-testid="input-color"
            />
            <div className="h-5 w-px bg-white/10"></div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-400 whitespace-nowrap">Size:</span>
              <input
                type="range"
                min="1"
                max="20"
                value={strokeSize}
                onChange={(e) => setStrokeSize(parseInt(e.target.value))}
                className="w-20"
                title="Stroke Size"
                data-testid="input-stroke-size"
              />
              <span className="text-xs text-neutral-400 w-8 text-right">{strokeSize}px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
