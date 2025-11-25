# AI Layr Design Guidelines

## Design Approach
**System-Based Approach**: Modern productivity tool inspired by Linear, Figma, and VS Code design patterns
**Rationale**: This is a professional design tool requiring efficiency, clarity, and extended usability for creative workflows

## Core Design Principles
1. **Dark-First Interface**: Reduce eye strain for extended work sessions
2. **Spatial Clarity**: Clear visual zones for tools, canvas, and properties
3. **Immediate Feedback**: Visual states for all interactive elements
4. **Efficiency-Driven**: Minimize clicks, maximize shortcuts and context

---

## Typography System

**Font Stack**: 
- Primary: `Inter` (UI elements, labels, body text)
- Monospace: `JetBrains Mono` (code snippets, technical values)

**Type Scale**:
- **Display**: text-2xl font-semibold (Project titles, hero headers)
- **Heading**: text-lg font-medium (Panel headers, section titles)
- **Body**: text-sm font-normal (Primary content, descriptions)
- **Caption**: text-xs font-normal (Metadata, hints, tooltips)
- **Code**: text-xs font-mono (Technical values, coordinates)

**Weight Hierarchy**: Use font-medium for emphasis, font-semibold for primary actions, font-normal for content

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 8, 12, 16** consistently
- Component padding: p-4
- Section spacing: gap-8, space-y-12
- Tight groupings: gap-2, space-x-4
- Generous breathing room: p-16 (landing areas)

**Grid Structure**:
- Sidebar panels: Fixed 288px width (w-72)
- Toolbar heights: h-14 (56px) for primary, h-12 for secondary
- Canvas: Flexible with scroll containers
- Bottom panels: 240px height when expanded

**Container Strategy**:
- Full-bleed canvas background
- Content max-width: Not applicable (workspace-based)
- Panel insets: 16-24px padding for comfortable density

---

## Component Library

### Navigation & Toolbars
**Top Toolbar**:
- Height: h-14, dark surface (bg-neutral-900)
- Logo/branding: Left-aligned with icon + wordmark
- Primary actions: Center-positioned (Generate, Screen count)
- Utilities: Right-aligned (Export, Settings, User)
- Border bottom: border-b border-white/10

**Tool Palette**:
- Floating toolbar design with backdrop-blur-xl
- Icon buttons: 32x32px touch targets
- Active state: bg-white/10 with accent color indicator
- Grouping: Visual separators (w-px h-6 bg-white/10)

**Side Panel**:
- Collapsible with smooth transitions (300ms ease)
- Header: Sticky with close/minimize controls
- Content: Scrollable with proper padding
- Sections: Separated by subtle dividers

### Canvas & Viewport
**Artboard Design**:
- Infinite canvas: bg-neutral-950 with subtle grid pattern
- Screen frames: Elevated cards with shadow-2xl
- Active screen: ring-2 ring-blue-500 indicator
- Zoom controls: Fixed bottom-right position

**Screen Cards**:
- Background: bg-white (for light content preview)
- Border: 1px solid border-neutral-200
- Shadow: Large soft shadow for depth
- Drag handle: Cursor changes + subtle scale on grab

### Forms & Inputs
**Text Inputs**:
- Height: h-10 standard
- Background: bg-neutral-800 with border-white/10
- Focus: ring-2 ring-blue-500, border-blue-500
- Placeholder: text-neutral-500

**Buttons**:
- Primary: bg-gradient-to-r from-blue-600 to-indigo-600, h-10, px-6, rounded-lg
- Secondary: bg-white/5 border border-white/10, hover:bg-white/10
- Icon-only: w-10 h-10 rounded-lg, center-aligned icons
- States: hover brightness-110, active scale-95

**Select/Dropdowns**:
- Trigger: Matches input styling with chevron-down icon
- Menu: bg-neutral-800 rounded-xl shadow-xl, py-2
- Items: px-4 py-2, hover:bg-white/10
- Active: bg-blue-600 text-white

### Data Display
**Property Panels**:
- Label-value pairs: Flex rows with space-between
- Labels: text-xs text-neutral-400 uppercase tracking-wide
- Values: text-sm text-white font-medium

**Screen Grid** (Project Dashboard):
- 3-column grid on desktop (grid-cols-3 gap-6)
- 2-column on tablet (md:grid-cols-2)
- Cards: bg-neutral-800 rounded-2xl p-6, hover shadow-2xl

**Toast Notifications**:
- Position: Fixed bottom-right with stack
- Style: bg-neutral-800 border-l-4 border-blue-500
- Animation: Slide up + fade, auto-dismiss 4s

### Overlays
**Modals**:
- Backdrop: bg-black/60 backdrop-blur-sm
- Container: bg-neutral-800 rounded-2xl max-w-2xl
- Header: pb-6 border-b border-white/10
- Actions: pt-6 flex justify-end gap-3

**Context Menus**:
- bg-neutral-800 rounded-xl shadow-2xl
- Min-width: 200px, py-2
- Dividers: my-2 border-t border-white/10

---

## Interaction Patterns

**Drawing Tools**:
- Canvas overlay: Positioned absolute, pointer-events when active
- Stroke preview: Real-time path rendering
- Color picker: Inline swatches + custom input
- Size slider: Range input with visual preview circle

**Drag & Drop**:
- Grab cursor on hover (cursor-grab)
- Grabbing state during drag (cursor-grabbing)
- Drop zones: Dashed border indication
- Ghost preview: opacity-50 during drag

**Zoom & Pan**:
- Zoom controls: Button group with percentage display
- Pan mode: Hand cursor (cursor-move)
- Keyboard: Cmd/Ctrl + scroll for zoom
- Bounds: Min 25%, Max 200%

---

## Visual Treatment

**Depth & Elevation**:
- Canvas: Deepest layer (bg-neutral-950)
- Panels: Mid-level (bg-neutral-900)
- Cards: Surface level (bg-neutral-800)
- Overlays: Highest (bg-neutral-800 with shadow-2xl)

**Borders & Dividers**:
- Primary: border-white/10 (subtle separation)
- Focus: border-blue-500 (active states)
- Never use pure black borders

**Shadows**:
- Cards: shadow-lg to shadow-xl
- Floating tools: shadow-2xl with subtle blur
- Modals: shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]

---

## Responsive Behavior

**Breakpoints**:
- Mobile: Collapse sidebar to overlay drawer
- Tablet: Reduce grid columns, stack panels
- Desktop: Full multi-panel layout

**Touch Optimization**:
- Minimum touch target: 44x44px (iOS)
- Increase toolbar icon size on mobile: w-12 h-12
- Drawer navigation instead of fixed sidebar

---

## Accessibility

- Focus indicators: ring-2 ring-offset-2 ring-offset-neutral-900
- Keyboard shortcuts: Display in tooltips
- ARIA labels for icon-only buttons
- Color contrast: WCAG AA minimum (4.5:1 for text)
- Screen reader announcements for generation progress

---

## Special Considerations

**Performance**:
- Virtualize screen grid for 20+ projects
- Debounce drawing canvas updates
- Lazy load iframe content

**State Management**:
- Loading states: Skeleton screens for project grid
- Empty states: Centered with illustration + CTA
- Error states: Inline messages with retry actions

**Brand Consistency**:
- Accent color: Blue-600 (customizable per theme)
- Logo placement: Top-left, max-height 32px
- Tagline: "AI-Powered UI Generation" in footer