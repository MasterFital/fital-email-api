// Database Storage - Almacenamiento persistente con PostgreSQL
import { 
  apiKeys, 
  emailLogs, 
  webhooks, 
  bounceList,
  emailTemplates,
  type ApiKey, 
  type InsertApiKey,
  type EmailLog,
  type InsertEmailLog,
  type Webhook,
  type InsertWebhook,
  type BounceListEntry,
  type InsertBounceListEntry,
  type EmailTemplate,
  type InsertEmailTemplate,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";

// Interface de Storage
export interface IStorage {
  // API Keys
  createApiKey(name: string): Promise<{ apiKey: ApiKey; rawKey: string }>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  validateApiKey(rawKey: string): Promise<ApiKey | undefined>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  incrementApiKeyEmailCount(id: string): Promise<void>;
  listApiKeys(): Promise<ApiKey[]>;
  deactivateApiKey(id: string): Promise<void>;

  // Email Logs
  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  getEmailLogByMessageId(messageId: string): Promise<EmailLog | undefined>;
  updateEmailLogStatus(messageId: string, status: string, additionalData?: Partial<EmailLog>): Promise<void>;
  getEmailLogs(apiKeyId?: string, limit?: number): Promise<EmailLog[]>;
  getEmailStats(apiKeyId?: string, periodDays?: number): Promise<{
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
    complained: number;
  }>;

  // Webhooks
  createWebhook(webhook: InsertWebhook): Promise<Webhook>;
  getWebhooksByApiKey(apiKeyId: string): Promise<Webhook[]>;
  getActiveWebhooks(): Promise<Webhook[]>;
  deactivateWebhook(id: string): Promise<void>;
  updateWebhookLastTriggered(id: string): Promise<void>;
  incrementWebhookFailure(id: string): Promise<void>;

  // Bounce List
  addToBounceList(entry: InsertBounceListEntry): Promise<BounceListEntry>;
  isEmailBounced(email: string): Promise<boolean>;
  removeFromBounceList(email: string): Promise<void>;
  getBounceList(limit?: number): Promise<BounceListEntry[]>;

  // Templates
  createTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  getTemplate(id: string): Promise<EmailTemplate | undefined>;
  listTemplates(): Promise<EmailTemplate[]>;
}

// Hash de API key
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Generar API key
function generateApiKey(): string {
  const prefix = "fital_";
  const randomPart = randomBytes(32).toString("hex");
  return `${prefix}${randomPart}`;
}

// Implementación de Storage con PostgreSQL
export class DatabaseStorage implements IStorage {
  // API Keys
  async createApiKey(name: string): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        name,
        keyHash,
        keyPrefix,
        isActive: true,
      })
      .returning();

    return { apiKey, rawKey };
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return apiKey || undefined;
  }

  async validateApiKey(rawKey: string): Promise<ApiKey | undefined> {
    const keyHash = hashApiKey(rawKey);
    const apiKey = await this.getApiKeyByHash(keyHash);
    
    if (apiKey && apiKey.isActive) {
      await this.updateApiKeyLastUsed(apiKey.id);
      return apiKey;
    }
    
    return undefined;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  async incrementApiKeyEmailCount(id: string): Promise<void> {
    await db.update(apiKeys)
      .set({ totalEmailsSent: sql`${apiKeys.totalEmailsSent} + 1` })
      .where(eq(apiKeys.id, id));
  }

  async listApiKeys(): Promise<ApiKey[]> {
    return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async deactivateApiKey(id: string): Promise<void> {
    await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
  }

  // Email Logs
  async createEmailLog(log: InsertEmailLog): Promise<EmailLog> {
    const [emailLog] = await db.insert(emailLogs).values(log).returning();
    return emailLog;
  }

  async getEmailLogByMessageId(messageId: string): Promise<EmailLog | undefined> {
    const [log] = await db.select().from(emailLogs).where(eq(emailLogs.messageId, messageId));
    return log || undefined;
  }

  async updateEmailLogStatus(messageId: string, status: string, additionalData?: Partial<EmailLog>): Promise<void> {
    const updateData: any = { status, ...additionalData };
    
    if (status === "delivered") {
      updateData.deliveredAt = new Date();
    }
    
    await db.update(emailLogs).set(updateData).where(eq(emailLogs.messageId, messageId));
  }

  async getEmailLogs(apiKeyId?: string, limit: number = 100): Promise<EmailLog[]> {
    if (apiKeyId) {
      return db.select()
        .from(emailLogs)
        .where(eq(emailLogs.apiKeyId, apiKeyId))
        .orderBy(desc(emailLogs.sentAt))
        .limit(limit);
    }
    return db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt)).limit(limit);
  }

  async getEmailStats(apiKeyId?: string, periodDays: number = 30): Promise<{
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
    complained: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    let query;
    if (apiKeyId) {
      query = db.select()
        .from(emailLogs)
        .where(and(
          eq(emailLogs.apiKeyId, apiKeyId),
          gte(emailLogs.sentAt, startDate)
        ));
    } else {
      query = db.select().from(emailLogs).where(gte(emailLogs.sentAt, startDate));
    }

    const logs = await query;

    return {
      sent: logs.length,
      delivered: logs.filter(l => l.status === "delivered" || l.status === "sent").length,
      bounced: logs.filter(l => l.status === "bounced").length,
      opened: logs.filter(l => l.opensCount > 0).length,
      clicked: logs.filter(l => l.clicksCount > 0).length,
      complained: logs.filter(l => l.status === "complained").length,
    };
  }

  // Webhooks
  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const [created] = await db.insert(webhooks).values(webhook).returning();
    return created;
  }

  async getWebhooksByApiKey(apiKeyId: string): Promise<Webhook[]> {
    return db.select().from(webhooks).where(eq(webhooks.apiKeyId, apiKeyId));
  }

  async getActiveWebhooks(): Promise<Webhook[]> {
    return db.select().from(webhooks).where(eq(webhooks.isActive, true));
  }

  async deactivateWebhook(id: string): Promise<void> {
    await db.update(webhooks).set({ isActive: false }).where(eq(webhooks.id, id));
  }

  async updateWebhookLastTriggered(id: string): Promise<void> {
    await db.update(webhooks).set({ lastTriggeredAt: new Date() }).where(eq(webhooks.id, id));
  }

  async incrementWebhookFailure(id: string): Promise<void> {
    await db.update(webhooks)
      .set({ failureCount: sql`${webhooks.failureCount} + 1` })
      .where(eq(webhooks.id, id));
  }

  // Bounce List
  async addToBounceList(entry: InsertBounceListEntry): Promise<BounceListEntry> {
    const [created] = await db.insert(bounceList).values(entry).returning();
    return created;
  }

  async isEmailBounced(email: string): Promise<boolean> {
    const [entry] = await db.select().from(bounceList).where(eq(bounceList.email, email.toLowerCase()));
    return !!entry;
  }

  async removeFromBounceList(email: string): Promise<void> {
    await db.delete(bounceList).where(eq(bounceList.email, email.toLowerCase()));
  }

  async getBounceList(limit: number = 100): Promise<BounceListEntry[]> {
    return db.select().from(bounceList).orderBy(desc(bounceList.addedAt)).limit(limit);
  }

  // Templates
  async createTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [created] = await db.insert(emailTemplates).values(template).returning();
    return created;
  }

  async getTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template || undefined;
  }

  async listTemplates(): Promise<EmailTemplate[]> {
    return db.select().from(emailTemplates).where(eq(emailTemplates.isActive, true));
  }
}

export const storage = new DatabaseStorage();
