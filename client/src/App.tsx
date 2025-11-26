import { useState, useEffect } from 'react';
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Project, DBProject } from '@shared/schema';
import Home from "@/pages/Home";
import Editor from "@/pages/Editor";
import Landing from "@/pages/Landing";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Load projects from API when authenticated
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    
    const loadProjects = async () => {
      try {
        setIsLoadingProjects(true);
        const response = await fetch('/api/projects');
        if (response.ok) {
          const dbProjects: DBProject[] = await response.json();
          // Convert DBProject to Project format
          const convertedProjects: Project[] = dbProjects.map(p => ({
            id: p.id,
            name: p.name,
            updatedAt: p.updatedAt ? new Date(p.updatedAt).getTime() : Date.now(),
            data: p.data as any
          }));
          setProjects(convertedProjects);
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    };
    
    loadProjects();
  }, [isAuthenticated, isLoading]);

  const handleCreateProject = async () => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Project ${projects.length + 1}`,
          data: { screens: [] }
        })
      });
      
      if (response.ok) {
        const newDBProject: DBProject = await response.json();
        const newProject: Project = {
          id: newDBProject.id,
          name: newDBProject.name,
          updatedAt: newDBProject.updatedAt ? new Date(newDBProject.updatedAt).getTime() : Date.now(),
          data: newDBProject.data as any
        };
        setProjects(prev => [...prev, newProject]);
        setActiveProjectId(newProject.id);
        setLocation('/editor');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm('Delete this project?')) {
      try {
        const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        if (response.ok) {
          setProjects(prev => prev.filter(p => p.id !== id));
          if (activeProjectId === id) {
            setActiveProjectId(null);
            setLocation('/');
          }
        }
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    setLocation('/editor');
  };

  const handleSaveProject = async (updatedProject: Project) => {
    try {
      const response = await fetch(`/api/projects/${updatedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedProject.data })
      });
      
      if (response.ok) {
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      }
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  const handleBackToHome = () => {
    setActiveProjectId(null);
    setLocation('/');
  };

  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : null;

  if (isLoading || isLoadingProjects) {
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
