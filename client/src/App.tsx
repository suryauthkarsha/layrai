import { useState, useEffect } from 'react';
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Project } from '@shared/schema';
import Home from "@/pages/Home";
import Editor from "@/pages/Editor";

const STORAGE_KEY = 'layr_projects_v3';

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

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

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
              <div className="flex items-center justify-center h-screen bg-[#050505] text-white">
                <p>No project selected</p>
              </div>
            )}
          </Route>
          <Route>
            <div className="flex items-center justify-center h-screen bg-[#050505] text-white">
              <p>404 - Page Not Found</p>
            </div>
          </Route>
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
