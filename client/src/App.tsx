import { useState, useEffect } from 'react';
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Project } from '@shared/schema';
import Home from "@/pages/Home";
import Editor from "@/pages/Editor";
import { nanoid } from 'nanoid';

function Router() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  // Load projects from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('layr_projects_v3');
      if (stored) {
        const parsed = JSON.parse(stored);
        setProjects(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Failed to load projects from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('layr_projects_v3', JSON.stringify(projects));
    }
  }, [projects, isLoading]);

  const handleCreateProject = () => {
    const newProject: Project = {
      id: nanoid(),
      name: `Project ${projects.length + 1}`,
      updatedAt: Date.now(),
      data: { screens: [] }
    };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setLocation('/editor');
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('Delete this project?')) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) {
        setActiveProjectId(null);
        setLocation('/');
      }
    }
  };

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    setLocation('/editor');
  };

  const handleSaveProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? { ...updatedProject, updatedAt: Date.now() } : p));
  };

  const handleBackToHome = () => {
    setActiveProjectId(null);
    setLocation('/');
  };

  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050505] text-white">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        <Home 
          projects={projects}
          onCreate={handleCreateProject}
          onDelete={handleDeleteProject}
          onOpen={handleOpenProject}
        />
      </Route>
      <Route path="/editor">
        {activeProject ? (
          <Editor 
            project={activeProject}
            onSave={handleSaveProject}
            onBack={handleBackToHome}
          />
        ) : (
          <div className="flex items-center justify-center h-screen bg-[#050505] text-white flex-col gap-4">
            <p className="text-xl font-semibold">No project selected</p>
            <button 
              onClick={() => setLocation('/')} 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors"
              data-testid="button-return-home"
            >
              Return to Home
            </button>
          </div>
        )}
      </Route>
      <Route>
        <div className="flex items-center justify-center h-screen bg-[#050505] text-white">
          <p>404 - Page Not Found</p>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
