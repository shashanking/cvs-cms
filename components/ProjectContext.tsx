import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of a Project object with some common properties.
// The `[key: string]: any;` allows for any additional fields dynamically.
export interface Project {
  id: string;            // Unique identifier of the project
  name: string;          // Project name
  description: string;   // Project description
  created_by: string;    // Username or ID of who created the project
  created_at: string;    // ISO date string of creation time
  [key: string]: any;    // Additional dynamic fields possible
}

// Define the Context's type: holds current project and a setter function
interface ProjectContextType {
  project: Project | null;                                 // Current selected project or null if none
  setProject: (project: Project | null) => void;           // Function to update the project state
}

// Create the actual React Context for project with initial undefined value.
// Consumers will get error if used outside a provider.
const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// Props accepted by the ProjectProvider component
interface ProjectProviderProps {
  children: ReactNode;              // React children elements that can use the context
  initialProject?: Project | null; // Initial project to set on provider mount (optional)
}

// The Context Provider component to wrap around parts of the app needing project info
export function ProjectProvider({ children, initialProject }: ProjectProviderProps) {
  // Internal state to keep track of current project.
  // Initialized to given initialProject prop or null by default.
  const [project, setProject] = useState<Project | null>(initialProject || null);

  // Return the Provider component wrapping children, passing the project state and setter via value
  return (
    <ProjectContext.Provider value={{ project, setProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

// Custom hook to allow consuming components to access the project context easily
export function useProject() {
  // Grab the context value
  const context = useContext(ProjectContext);

  // Throw error if used outside ProjectProvider to prevent runtime bugs
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }

  // Return the valid context containing project and setProject function
  return context;
}
