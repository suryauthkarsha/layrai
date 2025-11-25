import { Wand2, Plus, Trash2 } from 'lucide-react';
import type { Project } from '@shared/schema';
import { HERO_IMAGE_URL, HERO_BACKGROUND_GRADIENT } from '@/lib/constants';

interface HomeProps {
  projects: Project[];
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}

export default function Home({ projects, onCreate, onDelete, onOpen }: HomeProps) {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center font-sans relative">
      
      {/* Static Background Grid */}
      <div 
        className="absolute inset-0 z-0 opacity-20" 
        style={{ 
          backgroundImage: `radial-gradient(rgba(59, 130, 246, 0.05) 1px, transparent 1px)`, 
          backgroundSize: '20px 20px' 
        }}
      ></div>
      
      {/* Fixed Top Nav Bar */}
      <div className="fixed top-0 left-0 right-0 z-20 h-20 flex justify-between items-center px-10 border-b border-white/10 bg-[#0A0A0A]/90 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Wand2 size={24} className="text-blue-500 transform rotate-6" data-testid="icon-logo" />
          <h1 className="text-2xl font-extrabold tracking-tight text-white" data-testid="text-app-title">LAYR AI</h1>
        </div>
        <button 
          onClick={onCreate} 
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/30"
          data-testid="button-new-project"
        >
          <Plus size={14} /> New Project
        </button>
      </div>

      <div className="w-full max-w-6xl pt-20 pb-10 z-10">
        
        {/* Hero Section */}
        <div className="relative text-center mb-20 rounded-2xl bg-[#1A1A1A] shadow-2xl shadow-black/50 backdrop-blur-sm overflow-hidden">
          
          {/* Background Image with Gradient Overlay */}
          <div 
            className="relative w-full h-[500px] overflow-hidden" 
            style={{ 
              backgroundImage: `url('${HERO_IMAGE_URL}'), ${HERO_BACKGROUND_GRADIENT}`,
              backgroundBlendMode: 'overlay',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Dark Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-black/0 to-[#1A1A1A] opacity-90"></div>
          </div>
          
          {/* Content Overlay */}
          <div className="p-10 -mt-20 relative z-10 bg-[#1A1A1A] rounded-b-2xl">
            <h2 className="text-5xl font-extrabold tracking-tighter text-white mb-4 leading-tight" data-testid="text-hero-title">
              AI-Powered UI Generation.
            </h2>
            <p className="text-lg text-neutral-400 max-w-3xl mx-auto mb-6" data-testid="text-hero-subtitle">
              Instantly generate, inspect, and export high-fidelity designs for any platform using clean Tailwind CSS code.
            </p>
            <button 
              onClick={onCreate} 
              className="px-8 py-3 bg-white text-black rounded-full text-md font-bold shadow-xl hover:shadow-blue-500/50 transform hover:scale-[1.02] duration-300 transition-all"
              data-testid="button-hero-cta"
            >
              Start New Creation
            </button>
          </div>
        </div>

        {/* Project List */}
        <h2 className="text-2xl font-bold mb-6 text-neutral-300 border-b border-white/5 pb-2" data-testid="text-projects-heading">
          Your Projects ({projects.length})
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* New Project Card */}
          <button 
            onClick={onCreate} 
            className="aspect-square rounded-xl border border-dashed border-white/20 hover:border-blue-500/50 hover:bg-white/5 flex flex-col items-center justify-center gap-4 transition-all group shadow-md hover:shadow-blue-500/20"
            data-testid="button-create-project-card"
          >
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500/10 group-hover:scale-110 transition-all duration-300">
              <Plus size={28} className="text-blue-400 group-hover:text-blue-300" />
            </div>
            <span className="text-md font-semibold text-blue-400">Start Designing</span>
          </button>
          
          {/* Project Cards */}
          {projects.map(p => (
            <div 
              key={p.id} 
              onClick={() => onOpen(p.id)} 
              className="aspect-square rounded-xl bg-[#1A1A1A] border border-white/5 hover:border-blue-500/50 transition-all duration-200 cursor-pointer relative group overflow-hidden shadow-lg hover:shadow-blue-500/20"
              data-testid={`card-project-${p.id}`}
            >
              {/* Project Preview */}
              <div 
                className="h-2/3 w-full p-3 rounded-t-xl opacity-80 transition-opacity group-hover:opacity-100" 
                style={{ 
                  background: `linear-gradient(to bottom, #1A1A1A 50%, #000000 100%)`,
                  backgroundSize: '100% 100%' 
                }}
              >
                <div className="w-full h-full bg-black/30 rounded-lg flex items-center justify-center text-xs text-neutral-300">
                  {p.name}
                </div>
              </div>
              
              {/* Project Info */}
              <div className="p-4 flex flex-col justify-end h-1/3">
                <h3 className="font-bold text-base truncate text-white" data-testid={`text-project-name-${p.id}`}>{p.name}</h3>
                <p className="text-xs text-neutral-500 mt-0.5" data-testid={`text-project-date-${p.id}`}>
                  Updated: {new Date(p.updatedAt).toLocaleDateString()}
                </p>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} 
                  className="absolute top-4 right-4 p-1 rounded-full text-neutral-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" 
                  title="Delete Project"
                  data-testid={`button-delete-project-${p.id}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
