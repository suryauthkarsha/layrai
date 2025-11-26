import { type User, type InsertUser, users, type DBProject, type InsertDBProject, projects } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Storage interface
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: InsertUser): Promise<User>;
  getUserProjects(userId: string): Promise<DBProject[]>;
  getProject(projectId: string, userId: string): Promise<DBProject | undefined>;
  createProject(project: InsertDBProject): Promise<DBProject>;
  updateProject(projectId: string, userId: string, data: any): Promise<DBProject>;
  deleteProject(projectId: string, userId: string): Promise<void>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserProjects(userId: string): Promise<DBProject[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }

  async getProject(projectId: string, userId: string): Promise<DBProject | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    
    if (project && project.userId === userId) {
      return project;
    }
    return undefined;
  }

  async createProject(project: InsertDBProject): Promise<DBProject> {
    const [newProject] = await db
      .insert(projects)
      .values(project)
      .returning();
    return newProject;
  }

  async updateProject(projectId: string, userId: string, data: any): Promise<DBProject> {
    const [updated] = await db
      .update(projects)
      .set({ data, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    
    if (updated && updated.userId === userId) {
      return updated;
    }
    throw new Error("Unauthorized");
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    const [toDelete] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    
    if (!toDelete || toDelete.userId !== userId) {
      throw new Error("Unauthorized");
    }
    
    await db.delete(projects).where(eq(projects.id, projectId));
  }
}

export const storage = new DatabaseStorage();
