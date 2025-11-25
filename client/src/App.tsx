import { useState, useEffect } from 'react';
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Project } from '@shared/schema';
import Home from "@/pages/Home";
import Editor from "@/pages/Editor";
import Landing from "@/pages/Landing";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = 'layr_projects_v3';

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [location, setLocation] = useLocation();

  // Load projects from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProjects(parsed);
      } catch (e) {
        console.error('Failed to parse projects from localStorage', e);
      }
    }
  }, []);

  // Save projects to localStorage
  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
  }, [projects]);

  const handleCreateProject = () => {
    const newProject: Project = {
      id: `project_${Date.now()}`,
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
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
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
        {isAuthenticated ? (
          <Home 
            projects={projects}
            onCreate={handleCreateProject}
            onDelete={handleDeleteProject}
            onOpen={handleOpenProject}
          />
        ) : (
          <Landing />
        )}
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
