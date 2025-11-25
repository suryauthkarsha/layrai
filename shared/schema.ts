import { z } from "zod";

// --- AI Layr Data Schemas ---

// Drawing stroke schema
export const drawingSchema = z.object({
  color: z.string(),
  points: z.array(z.object({ x: z.number(), y: z.number() })),
  strokeWidth: z.number(),
  isEraser: z.boolean().optional(),
});

// Screen schema
export const screenSchema = z.object({
  name: z.string(),
  rawHtml: z.string(),
  type: z.string(),
  height: z.number(),
  x: z.number().optional().default(0),
  y: z.number().optional().default(0),
});

// Project schema
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  updatedAt: z.number(),
  data: z.object({
    screens: z.array(screenSchema),
  }),
});

// Insert schemas (for creating new items)
export const insertScreenSchema = screenSchema.omit({ x: true, y: true });
export const insertProjectSchema = projectSchema.omit({ id: true });

// TypeScript types
export type Drawing = z.infer<typeof drawingSchema>;
export type Screen = z.infer<typeof screenSchema>;
export type Project = z.infer<typeof projectSchema>;
export type InsertScreen = z.infer<typeof insertScreenSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
