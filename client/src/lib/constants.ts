import { Sparkles, Layout, MoveVertical, TrendingUp } from 'lucide-react';

// Hero image and background
export const HERO_IMAGE_URL = "https://i.ibb.co/TB7TwKbS/Gemini-Generated-Image_fqobwbfqobwbfqob.png";
export const HERO_BACKGROUND_GRADIENT = "linear-gradient(135deg, #2c3e50, #3498db, #8e44ad)";

// Unsplash image collection
export const UNSPLASH_COLLECTION = [
  { id: 'abs1', url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit-crop", category: "Abstract" },
  { id: 'arch1', url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=400&auto=format&fit-crop", category: "Building" },
  { id: 'tech1', url: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=400&auto=format&fit-crop", category: "Tech" },
  { id: 'nat1', url: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=400&auto=format&fit-crop", category: "Nature" },
  { id: 'ppl1', url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit-crop", category: "People" },
];

// Theme presets
export const PRESET_THEMES = {
  modern: { 
    name: "Obsidian", 
    primary: "bg-blue-600", 
    secondary: "bg-[#09090b]", 
    text: "text-slate-50", 
    textDim: "text-slate-400", 
    accent: "text-blue-400", 
    border: "border-white/10", 
    surface: "bg-white/5", 
    gradient: "from-blue-600 to-indigo-600" 
  },
  emerald: { 
    name: "Forest", 
    primary: "bg-emerald-600", 
    secondary: "bg-[#050a05]", 
    text: "text-stone-50", 
    textDim: "text-stone-400", 
    accent: "text-emerald-400", 
    border: "border-white/10", 
    surface: "bg-white/5", 
    gradient: "from-emerald-600 to-teal-600" 
  },
  rose: { 
    name: "Velvet", 
    primary: "bg-rose-600", 
    secondary: "bg-[#0a0505]", 
    text: "text-neutral-50", 
    textDim: "text-neutral-400", 
    accent: "text-rose-400", 
    border: "border-white/10", 
    surface: "bg-white/5", 
    gradient: "from-rose-600 to-pink-600" 
  },
};

// Component options for manual addition
export const COMPONENT_OPTIONS = [
  { id: 'hero', label: 'Hero', icon: <Sparkles size={12} /> },
  { id: 'grid', label: 'Grid', icon: <Layout size={12} /> },
  { id: 'carousel', label: 'Carousel', icon: <MoveVertical size={12} className="rotate-90" /> },
  { id: 'stats', label: 'Stats', icon: <TrendingUp size={12} /> },
];

// Platform dimensions
export const PLATFORM_DIMENSIONS = {
  mobile: { width: 375, height: 812 },
  desktop: { width: 1440, height: 900 },
  general: { width: 1200, height: 800 },
} as const;
