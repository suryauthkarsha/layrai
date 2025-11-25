# AI Layr - AI-Powered UI Design Tool

## Overview

AI Layr is a visual UI design and prototyping tool that leverages AI (Google Gemini) to generate production-ready HTML/Tailwind CSS interfaces from natural language prompts. The application provides a canvas-based editor with drawing capabilities, multi-screen support, and export functionality. It's designed as a dark-first productivity tool inspired by modern design applications like Linear, Figma, and VS Code.

**Core Purpose**: Enable designers and developers to rapidly prototype and iterate on UI designs through AI-assisted generation, manual refinement via drawing tools, and seamless export to various formats.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using a client-side routing approach with Wouter

**State Management Strategy**:
- Local state using React hooks (useState, useEffect, useRef, useCallback)
- Project data persistence through localStorage (key: `layr_projects_v3`)
- No global state management library - props drilling pattern for project/screen data flow
- TanStack Query for potential server-side data fetching (configured but minimal usage)

**Component Organization**:
- Page-level components: Home (project gallery), Editor (main workspace), NotFound
- UI components: Shadcn/ui component library with Radix UI primitives
- Custom components: IframeRenderer for preview rendering
- Utility modules: Separated into `/lib` for constants, API calls, and helper functions

**Styling System**:
- Tailwind CSS with custom design tokens
- CSS variables for theming (light/dark mode support)
- "New York" variant of Shadcn/ui
- Custom color system with semantic tokens (background, foreground, primary, secondary, muted, accent, destructive)
- Typography: Inter for UI, JetBrains Mono for code/technical values

### Backend Architecture

**Server Framework**: Express.js with TypeScript

**Architecture Pattern**: Minimal REST API setup with separate dev/prod entry points
- Development mode: Vite middleware integration for HMR
- Production mode: Static file serving from built assets
- Routes registered via centralized `registerRoutes` function
- Storage abstraction layer with in-memory implementation

**Data Flow**:
- Client-side localStorage for project persistence (no database currently active)
- Storage interface defined but using MemStorage implementation
- Prepared for future database integration via Drizzle ORM

**File Structure**:
- `/server/app.ts`: Express app setup and middleware configuration
- `/server/index-dev.ts`: Development server with Vite integration
- `/server/index-prod.ts`: Production server for static assets
- `/server/routes.ts`: API route registration (currently minimal)
- `/server/storage.ts`: Storage abstraction layer

### Data Schema Design

**Project Structure** (Zod-validated):
```typescript
Project {
  id: string
  name: string
  updatedAt: number (timestamp)
  data: {
    screens: Screen[]
  }
}

Screen {
  name: string
  rawHtml: string (generated HTML content)
  type: string (platform type)
  height: number
  x: number (canvas position)
  y: number (canvas position)
}

Drawing {
  color: string
  points: Array<{x, y}>
  strokeWidth: number
  isEraser: boolean
}
```

**Design Rationale**: Schema uses Zod for runtime validation, prepared for Drizzle ORM integration. Screens store complete HTML for iframe rendering. Drawing data supports annotation layer over generated designs.

### Canvas & Editor Features

**Tool Modes** (Bottom Dock):
- Cursor: Standard selection/interaction
- Hand: Panning navigation
- Pen: Freehand drawing with customizable stroke size/color
- Eraser: Visual preview indicator for eraser area with semi-transparent circle
- Text: Add and edit text boxes on the canvas
- Shapes: Add geometric shapes with dropdown menu:
  - Rectangle (Rect)
  - Circle
  - Triangle

**Drawing Controls**:
- Stroke size slider (1-20px range) - appears when pen/eraser/text/shapes active
- Custom color picker for pen strokes
- Undo functionality for drawing operations

**Viewport Management**:
- Zoom controls (0.85 default scale, 0.2-3.0 range)
- Pan/scroll for large canvases
- Draggable screen positioning with visual feedback
- Interaction mode toggles pointer events on iframe
- Grid background (enabled at zoom >= 20%)

**Export Capabilities** (Multi-Format):
- **HTML Export**: 
  - Single screen HTML download
  - All screens combined HTML (new) - wraps all screens in iframe containers
- **PDF Export**: Individual screen to PDF
- **PNG Export**: Full viewport canvas snapshot at 3x scale
- External libraries: html2canvas for rendering, jsPDF for PDF generation

### AI Integration Design

**Provider**: Google Gemini API (gemini-2.0-flash-thinking-exp-01-21 model)

**Generation Flow**:
1. User provides natural language prompt
2. System prompt constructed with screen count, platform target, feature requirements
3. API request with retry logic (3 attempts)
4. Response parsing extracts HTML from markdown code blocks
5. Screen creation with HTML injected into iframe renderer

**Prompt Engineering** (Enhanced for Quality):
- Enforces raw HTML output only (no JSON wrapping)
- Requests Tailwind CSS styling with hover effects and transitions
- **MANDATORY image usage**: Every design must include 1-3 images/visual assets
  - Unsplash URLs with keywords: `https://source.unsplash.com/random/800x600/?keyword`
  - CSS gradients for backgrounds
  - SVG icons and illustrations embedded as `<svg>` tags
  - Never generates empty `<img>` tags
- Mandates full-viewport layout classes (w-full h-full min-h-screen)
- Prohibits JavaScript in generated code
- Includes visual depth with shadows and layering

**Error Handling**: Exponential backoff retry mechanism, progress tracking during generation

### Design System Tokens

**Color Philosophy**: Dark-first interface with semantic color roles
- Background hierarchy: Elevated surfaces use subtle opacity overlays
- Border system: Variable opacity borders (button-outline, card-border)
- Accent colors: Blue primary with emerald/rose theme variants

**Spacing Scale**: Tailwind-based with consistent 2/4/8/12/16 unit increments
- Component padding: 16px (p-4)
- Section gaps: 32px (gap-8)
- Panel dimensions: 288px sidebar width, 56px toolbar height

**Typography Scale**:
- Display: 1.5rem/2xl semibold
- Heading: 1.125rem/lg medium
- Body: 0.875rem/sm normal
- Caption: 0.75rem/xs normal
- Code: 0.75rem/xs monospace

## Recent Updates (Session)

### Authentication System Implementation
- Integrated Replit Auth with PostgreSQL database
- Created user sessions table with `connect-pg-simple`
- Implemented login flow with multiple providers (Google, GitHub, X, Apple, email/password)
- Created Landing page for logged-out users
- Protected home page and editor for authenticated users
- User state managed via TanStack Query (`useAuth` hook)

### Enhanced Editor Tools
- Added **Text Tool**: Icon-based text editing on canvas
- Added **Shapes Tool**: Geometric shape insertion with submenu
  - Rectangle
  - Circle
  - Triangle
- Improved **Eraser Tool**: Visual semi-transparent circle preview showing eraser area
- Fixed SVG layer pointer events for proper tool interaction

### Image Generation Improvements
- Updated Gemini system prompt to mandate image usage
- Enforces minimum 1-3 images per design
- Supports Unsplash random image URLs with keywords
- CSS gradients and SVG icons as alternatives
- Examples provided in prompt for good vs. bad patterns

### Export Enhancements
- Added "All Screens HTML" export option
- Combines all screens into single HTML file with iframe containers
- Maintains responsive design and styling
- Easier multi-screen sharing and deployment

## External Dependencies

### Core Framework Dependencies
- **React 18**: UI framework with hooks-based architecture
- **TypeScript**: Type safety across client and server
- **Vite**: Build tool and dev server with HMR
- **Express**: Backend HTTP server framework
- **Wouter**: Lightweight client-side routing

### UI Component Libraries
- **Radix UI**: Headless component primitives (20+ components including Dialog, Dropdown, Popover, Tabs, Toast)
- **Shadcn/ui**: Pre-built component library built on Radix
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### Database & ORM (Prepared, Not Active)
- **Drizzle ORM**: TypeScript ORM for SQL databases
- **@neondatabase/serverless**: Neon Postgres serverless driver
- **PostgreSQL**: Target database (configured via DATABASE_URL env var)

### AI & Generation
- **@google/genai**: Official Google Gemini API SDK
- **html2canvas**: DOM-to-canvas rendering for exports
- **jsPDF**: PDF generation library (likely used in export-utils)

### Form & Validation
- **Zod**: Schema validation library
- **React Hook Form**: Form state management
- **@hookform/resolvers**: Zod integration for form validation

### Styling & Animation
- **class-variance-authority**: Component variant management
- **clsx**: Conditional className utility
- **tailwind-merge**: Tailwind class deduplication
- **PostCSS**: CSS processing with Autoprefixer

### Development Tools
- **@replit/vite-plugin-runtime-error-modal**: Runtime error overlay
- **@replit/vite-plugin-cartographer**: Code navigation tool
- **tsx**: TypeScript execution for dev server
- **esbuild**: Fast bundler for production builds

### Utility Libraries
- **date-fns**: Date manipulation
- **nanoid**: Unique ID generation
- **TanStack Query**: Async state management (minimal usage)

### Session & Storage (Configured)
- **connect-pg-simple**: PostgreSQL session store
- **express-session**: Session middleware (not currently active)

### Configuration Files
- **drizzle.config.ts**: Database migration configuration pointing to PostgreSQL
- **tailwind.config.ts**: Custom design tokens and color system
- **vite.config.ts**: Build configuration with path aliases (@, @shared, @assets)
- **tsconfig.json**: TypeScript compiler options with path mapping