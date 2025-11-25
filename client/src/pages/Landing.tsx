import { Wand2, ArrowRight } from 'lucide-react';
import { HERO_IMAGE_URL } from '@/lib/constants';

export default function Landing() {
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

      <div className="w-full z-10">
        {/* Hero Section with Image */}
        <div className="relative w-full h-[500px] overflow-hidden">
          
          {/* Background Image - No Gradient */}
          <div 
            className="absolute inset-0 w-full h-full" 
            style={{ 
              backgroundImage: `url('${HERO_IMAGE_URL}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          ></div>
          
          {/* Top Dark Gradient Overlay */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black via-black/60 to-transparent z-10"></div>
          
          {/* Bottom Dark Gradient Overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-black via-black/60 to-transparent z-10"></div>

          {/* Logo - Top Left */}
          <div className="absolute top-8 left-10 flex items-center gap-4 z-20">
            <Wand2 size={28} className="text-blue-400 transform rotate-6" data-testid="icon-logo" />
            <h1 className="text-3xl font-extrabold tracking-tight text-white" data-testid="text-app-title">LAYR AI</h1>
          </div>

          {/* Login Button - Top Right */}
          <div className="absolute top-8 right-10 z-20">
            <a 
              href="/api/login" 
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/30"
              data-testid="button-login"
            >
              Sign In
            </a>
          </div>
        </div>

        {/* Content - Below Image */}
        <div className="w-full bg-[#0a0a0a] p-10 text-center border-b border-white/5 -mt-20 pt-20 relative z-20">
          <h2 className="text-5xl font-extrabold tracking-tighter text-white mb-4 leading-tight" data-testid="text-hero-title">
            AI-Powered UI Generation.
          </h2>
          <p className="text-lg text-neutral-400 max-w-3xl mx-auto mb-6" data-testid="text-hero-subtitle">
            Instantly generate, inspect, and export high-fidelity designs for any platform.
          </p>
          <a 
            href="/api/login" 
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-black rounded-full text-md font-bold shadow-xl hover:shadow-blue-500/50 transform hover:scale-[1.02] duration-300 transition-all"
            data-testid="button-hero-cta"
          >
            Get Started <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </div>
  );
}
