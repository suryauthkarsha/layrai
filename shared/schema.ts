import { z } from "zod";
import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, index, jsonb } from "drizzle-orm/pg-core";

// --- Database Tables ---
// Session storage table (IMPORTANT for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (IMPORTANT for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- User Types ---
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

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
