import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// API Keys table - para autenticación de clientes internos
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Nombre descriptivo: "FITAL App", "CRM Sistema", etc.
  keyHash: text("key_hash").notNull().unique(), // SHA256 hash del API key
  keyPrefix: varchar("key_prefix", { length: 8 }).notNull(), // Primeros 8 chars para identificación
  allowedIps: text("allowed_ips").array(), // IPs permitidas (null = todas)
  rateLimitOverride: integer("rate_limit_override"), // Override del rate limit por defecto
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  totalEmailsSent: integer("total_emails_sent").default(0).notNull(),
});

// Email Logs table - histórico de emails enviados
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().unique(), // SES MessageId
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id),
  toEmail: text("to_email").notNull(),
  ccEmails: text("cc_emails").array(),
  bccEmails: text("bcc_emails").array(),
  subject: text("subject").notNull(),
  emailType: varchar("email_type", { length: 20 }).notNull(), // text, html, template, bulk, attachment
  templateId: varchar("template_id"),
  status: varchar("status", { length: 20 }).default("queued").notNull(), // queued, sent, delivered, bounced, complained, failed
  sesResponse: jsonb("ses_response"), // Respuesta completa de SES
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  opensCount: integer("opens_count").default(0).notNull(),
  clicksCount: integer("clicks_count").default(0).notNull(),
});

// Webhooks table - para notificaciones de eventos
export const webhooks = pgTable("webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id),
  url: text("url").notNull(),
  secret: text("secret").notNull(), // HMAC secret para firma
  events: text("events").array().notNull(), // delivered, bounced, opened, clicked, complained
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  failureCount: integer("failure_count").default(0).notNull(),
});

// Bounce List table - lista de supresión automática
export const bounceList = pgTable("bounce_list", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  reason: varchar("reason", { length: 20 }).notNull(), // bounce, complaint, unsubscribe
  bounceType: varchar("bounce_type", { length: 20 }), // permanent, transient
  originalMessageId: varchar("original_message_id"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// Email Templates metadata table
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  subject: text("subject").notNull(),
  variables: text("variables").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const apiKeysRelations = relations(apiKeys, ({ many }) => ({
  emailLogs: many(emailLogs),
  webhooks: many(webhooks),
}));

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [emailLogs.apiKeyId],
    references: [apiKeys.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [webhooks.apiKeyId],
    references: [apiKeys.id],
  }),
}));

// Insert Schemas
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  totalEmailsSent: true,
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  sentAt: true,
  deliveredAt: true,
  openedAt: true,
  clickedAt: true,
  opensCount: true,
  clicksCount: true,
});

export const insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  createdAt: true,
  lastTriggeredAt: true,
  failureCount: true,
});

export const insertBounceListSchema = createInsertSchema(bounceList).omit({
  id: true,
  addedAt: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  createdAt: true,
  updatedAt: true,
});

// Types
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;

export type BounceListEntry = typeof bounceList.$inferSelect;
export type InsertBounceListEntry = z.infer<typeof insertBounceListSchema>;

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

// API Request/Response Schemas
export const sendEmailSchema = z.object({
  to: z.string().email("Email inválido"),
  subject: z.string().min(1, "Subject es requerido").max(998, "Subject muy largo"),
  body: z.string().min(1, "Body es requerido"),
  type: z.enum(["text", "html"]).default("text"),
  replyTo: z.string().email().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
});

export const sendHtmlEmailSchema = z.object({
  to: z.string().email("Email inválido"),
  subject: z.string().min(1, "Subject es requerido").max(998, "Subject muy largo"),
  html: z.string().min(1, "HTML es requerido"),
  replyTo: z.string().email().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
});

export const sendTemplateEmailSchema = z.object({
  to: z.string().email("Email inválido"),
  template: z.string().min(1, "Template ID es requerido"),
  variables: z.record(z.string(), z.any()).optional(),
  replyTo: z.string().email().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
});

export const sendBulkEmailSchema = z.object({
  recipients: z.array(z.object({
    email: z.string().email("Email inválido"),
    name: z.string().optional(),
    variables: z.record(z.string(), z.any()).optional(),
  })).min(1, "Al menos un destinatario").max(100, "Máximo 100 destinatarios"),
  subject: z.string().min(1, "Subject es requerido").max(998, "Subject muy largo"),
  template: z.string().optional(),
  html: z.string().optional(),
  body: z.string().optional(),
  variables: z.record(z.string(), z.any()).optional(),
});

export const sendAttachmentEmailSchema = z.object({
  to: z.string().email("Email inválido"),
  subject: z.string().min(1, "Subject es requerido").max(998, "Subject muy largo"),
  body: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string().min(1, "Filename es requerido"),
    content: z.string().min(1, "Content base64 es requerido"),
    contentType: z.string().min(1, "Content type es requerido"),
  })).min(1, "Al menos un adjunto").max(10, "Máximo 10 adjuntos"),
  replyTo: z.string().email().optional(),
});

export const validateEmailSchema = z.object({
  email: z.string().min(1, "Email es requerido"),
});

export const registerWebhookSchema = z.object({
  url: z.string().url("URL inválida").startsWith("https://", "Solo HTTPS permitido"),
  events: z.array(z.enum(["delivered", "bounced", "opened", "clicked", "complained"])).min(1, "Al menos un evento"),
});

export type SendEmailRequest = z.infer<typeof sendEmailSchema>;
export type SendHtmlEmailRequest = z.infer<typeof sendHtmlEmailSchema>;
export type SendTemplateEmailRequest = z.infer<typeof sendTemplateEmailSchema>;
export type SendBulkEmailRequest = z.infer<typeof sendBulkEmailSchema>;
export type SendAttachmentEmailRequest = z.infer<typeof sendAttachmentEmailSchema>;
export type ValidateEmailRequest = z.infer<typeof validateEmailSchema>;
export type RegisterWebhookRequest = z.infer<typeof registerWebhookSchema>;
