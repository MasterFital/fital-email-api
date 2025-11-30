// FITAL Email API Gateway - Rutas principales
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateApiKey } from "./middleware/auth.middleware";
import { 
  globalRateLimiter, 
  apiKeyRateLimiter, 
  readRateLimiter 
} from "./middleware/rateLimit.middleware";
import { 
  sendEmail, 
  sendEmailWithAttachments, 
  sendBulkEmails 
} from "./services/ses.service";
import { 
  renderTemplate, 
  listTemplates as getTemplateList, 
  templateExists 
} from "./services/template.service";
import { validateEmail } from "./services/validation.service";
import { 
  sendEmailSchema, 
  sendHtmlEmailSchema, 
  sendTemplateEmailSchema,
  sendBulkEmailSchema,
  sendAttachmentEmailSchema,
  validateEmailSchema,
  registerWebhookSchema,
} from "@shared/schema";
import { randomBytes, createHmac } from "crypto";
import helmet from "helmet";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seguridad HTTP
  app.use(helmet({
    contentSecurityPolicy: false, // Deshabilitado para API JSON
  }));

  // Rate limiting global
  app.use("/api/v1", globalRateLimiter);

  // Health check - sin autenticación
  app.get("/api/v1/health", (req, res) => {
    res.json({
      success: true,
      status: "healthy",
      service: "FITAL Email API Gateway",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================
  // ENDPOINTS DE EMAIL
  // ============================================

  // 1. POST /api/v1/email/send - Enviar email simple
  app.post(
    "/api/v1/email/send",
    authenticateApiKey,
    apiKeyRateLimiter,
    async (req, res) => {
      try {
        const validation = sendEmailSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Datos inválidos",
            code: "VALIDATION_ERROR",
            details: validation.error.errors,
          });
        }

        const { to, subject, body, type, replyTo, cc, bcc } = validation.data;

        // Verificar si el email está en bounce list
        const isBounced = await storage.isEmailBounced(to);
        if (isBounced) {
          return res.status(400).json({
            success: false,
            error: "Email bloqueado",
            code: "EMAIL_BOUNCED",
            message: "Este email está en la lista de supresión por rebotes previos",
          });
        }

        // Enviar email
        const result = await sendEmail({
          to,
          subject,
          body,
          replyTo,
          cc,
          bcc,
        });

        // Registrar en logs
        await storage.createEmailLog({
          messageId: result.messageId,
          apiKeyId: req.apiKey?.id,
          toEmail: to,
          ccEmails: cc || null,
          bccEmails: bcc || null,
          subject,
          emailType: type || "text",
          status: result.success ? "sent" : "failed",
          errorMessage: result.error || null,
        });

        // Incrementar contador
        if (result.success && req.apiKey) {
          await storage.incrementApiKeyEmailCount(req.apiKey.id);
        }

        if (result.success) {
          return res.json({
            success: true,
            messageId: result.messageId,
            status: "sent",
            timestamp: result.timestamp,
          });
        } else {
          return res.status(500).json({
            success: false,
            error: "Error al enviar email",
            code: "SEND_ERROR",
            message: result.error,
          });
        }
      } catch (error: any) {
        console.error("Error en /email/send:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // 2. POST /api/v1/email/send-html - Enviar email con HTML
  app.post(
    "/api/v1/email/send-html",
    authenticateApiKey,
    apiKeyRateLimiter,
    async (req, res) => {
      try {
        const validation = sendHtmlEmailSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Datos inválidos",
            code: "VALIDATION_ERROR",
            details: validation.error.errors,
          });
        }

        const { to, subject, html, replyTo, cc, bcc } = validation.data;

        // Verificar bounce list
        const isBounced = await storage.isEmailBounced(to);
        if (isBounced) {
          return res.status(400).json({
            success: false,
            error: "Email bloqueado",
            code: "EMAIL_BOUNCED",
            message: "Este email está en la lista de supresión",
          });
        }

        const result = await sendEmail({
          to,
          subject,
          html,
          replyTo,
          cc,
          bcc,
        });

        await storage.createEmailLog({
          messageId: result.messageId,
          apiKeyId: req.apiKey?.id,
          toEmail: to,
          ccEmails: cc || null,
          bccEmails: bcc || null,
          subject,
          emailType: "html",
          status: result.success ? "sent" : "failed",
          errorMessage: result.error || null,
        });

        if (result.success && req.apiKey) {
          await storage.incrementApiKeyEmailCount(req.apiKey.id);
        }

        if (result.success) {
          return res.json({
            success: true,
            messageId: result.messageId,
            status: "sent",
            timestamp: result.timestamp,
          });
        } else {
          return res.status(500).json({
            success: false,
            error: "Error al enviar email HTML",
            code: "SEND_ERROR",
            message: result.error,
          });
        }
      } catch (error: any) {
        console.error("Error en /email/send-html:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // 3. POST /api/v1/email/send-template - Enviar email con plantilla
  app.post(
    "/api/v1/email/send-template",
    authenticateApiKey,
    apiKeyRateLimiter,
    async (req, res) => {
      try {
        const validation = sendTemplateEmailSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Datos inválidos",
            code: "VALIDATION_ERROR",
            details: validation.error.errors,
          });
        }

        const { to, template, variables, replyTo, cc, bcc } = validation.data;

        // Verificar que el template existe
        if (!templateExists(template)) {
          return res.status(404).json({
            success: false,
            error: "Plantilla no encontrada",
            code: "TEMPLATE_NOT_FOUND",
            message: `La plantilla '${template}' no existe`,
          });
        }

        // Verificar bounce list
        const isBounced = await storage.isEmailBounced(to);
        if (isBounced) {
          return res.status(400).json({
            success: false,
            error: "Email bloqueado",
            code: "EMAIL_BOUNCED",
            message: "Este email está en la lista de supresión",
          });
        }

        // Renderizar template
        const rendered = renderTemplate(template, variables || {});
        if (!rendered) {
          return res.status(500).json({
            success: false,
            error: "Error al renderizar plantilla",
            code: "TEMPLATE_RENDER_ERROR",
          });
        }

        const result = await sendEmail({
          to,
          subject: rendered.subject,
          html: rendered.html,
          replyTo,
          cc,
          bcc,
        });

        await storage.createEmailLog({
          messageId: result.messageId,
          apiKeyId: req.apiKey?.id,
          toEmail: to,
          ccEmails: cc || null,
          bccEmails: bcc || null,
          subject: rendered.subject,
          emailType: "template",
          templateId: template,
          status: result.success ? "sent" : "failed",
          errorMessage: result.error || null,
        });

        if (result.success && req.apiKey) {
          await storage.incrementApiKeyEmailCount(req.apiKey.id);
        }

        if (result.success) {
          return res.json({
            success: true,
            messageId: result.messageId,
            status: "sent",
            template,
            timestamp: result.timestamp,
          });
        } else {
          return res.status(500).json({
            success: false,
            error: "Error al enviar email con plantilla",
            code: "SEND_ERROR",
            message: result.error,
          });
        }
      } catch (error: any) {
        console.error("Error en /email/send-template:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // 4. POST /api/v1/email/send-bulk - Envío masivo
  app.post(
    "/api/v1/email/send-bulk",
    authenticateApiKey,
    apiKeyRateLimiter,
    async (req, res) => {
      try {
        const validation = sendBulkEmailSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Datos inválidos",
            code: "VALIDATION_ERROR",
            details: validation.error.errors,
          });
        }

        const { recipients, subject, template, html, body, variables } = validation.data;

        let emailContent: string;
        let isHtml = false;
        let finalSubject = subject;

        // Determinar contenido
        if (template) {
          if (!templateExists(template)) {
            return res.status(404).json({
              success: false,
              error: "Plantilla no encontrada",
              code: "TEMPLATE_NOT_FOUND",
            });
          }
          const rendered = renderTemplate(template, variables || {});
          if (!rendered) {
            return res.status(500).json({
              success: false,
              error: "Error al renderizar plantilla",
              code: "TEMPLATE_RENDER_ERROR",
            });
          }
          emailContent = rendered.html;
          finalSubject = rendered.subject;
          isHtml = true;
        } else if (html) {
          emailContent = html;
          isHtml = true;
        } else if (body) {
          emailContent = body;
        } else {
          return res.status(400).json({
            success: false,
            error: "Contenido requerido",
            code: "MISSING_CONTENT",
            message: "Debes proporcionar template, html o body",
          });
        }

        // Filtrar emails bloqueados
        const validRecipients: typeof recipients = [];
        const blockedEmails: string[] = [];
        
        for (const recipient of recipients) {
          const isBounced = await storage.isEmailBounced(recipient.email);
          if (isBounced) {
            blockedEmails.push(recipient.email);
          } else {
            validRecipients.push(recipient);
          }
        }

        if (validRecipients.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Todos los emails están bloqueados",
            code: "ALL_EMAILS_BLOCKED",
            blockedEmails,
          });
        }

        // Enviar emails
        const result = await sendBulkEmails(validRecipients, finalSubject, emailContent, isHtml);

        // Registrar logs
        for (const emailResult of result.results) {
          await storage.createEmailLog({
            messageId: emailResult.messageId || `bulk_${result.batchId}_${emailResult.email}`,
            apiKeyId: req.apiKey?.id,
            toEmail: emailResult.email,
            subject: finalSubject,
            emailType: "bulk",
            templateId: template || null,
            status: emailResult.status === "sent" ? "sent" : "failed",
            errorMessage: emailResult.error || null,
          });
        }

        // Incrementar contador
        if (req.apiKey) {
          for (let i = 0; i < result.sent; i++) {
            await storage.incrementApiKeyEmailCount(req.apiKey.id);
          }
        }

        return res.json({
          success: result.failed === 0,
          sent: result.sent,
          failed: result.failed + blockedEmails.length,
          failedEmails: [...result.failedEmails, ...blockedEmails],
          batchId: result.batchId,
          blockedFromBounceList: blockedEmails.length,
        });
      } catch (error: any) {
        console.error("Error en /email/send-bulk:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // 5. POST /api/v1/email/send-attachment - Email con adjuntos
  app.post(
    "/api/v1/email/send-attachment",
    authenticateApiKey,
    apiKeyRateLimiter,
    async (req, res) => {
      try {
        const validation = sendAttachmentEmailSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Datos inválidos",
            code: "VALIDATION_ERROR",
            details: validation.error.errors,
          });
        }

        const { to, subject, body, html, attachments, replyTo } = validation.data;

        // Validar tamaño total de adjuntos (máx 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        let totalSize = 0;
        for (const att of attachments) {
          const decoded = Buffer.from(att.content, "base64");
          totalSize += decoded.length;
        }
        if (totalSize > maxSize) {
          return res.status(400).json({
            success: false,
            error: "Adjuntos muy grandes",
            code: "ATTACHMENTS_TOO_LARGE",
            message: "El tamaño total de adjuntos no puede exceder 10MB",
            currentSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
            maxSize: "10MB",
          });
        }

        // Verificar bounce list
        const isBounced = await storage.isEmailBounced(to);
        if (isBounced) {
          return res.status(400).json({
            success: false,
            error: "Email bloqueado",
            code: "EMAIL_BOUNCED",
          });
        }

        const result = await sendEmailWithAttachments({
          to,
          subject,
          body,
          html,
          replyTo,
          attachments,
        });

        await storage.createEmailLog({
          messageId: result.messageId,
          apiKeyId: req.apiKey?.id,
          toEmail: to,
          subject,
          emailType: "attachment",
          status: result.success ? "sent" : "failed",
          errorMessage: result.error || null,
        });

        if (result.success && req.apiKey) {
          await storage.incrementApiKeyEmailCount(req.apiKey.id);
        }

        if (result.success) {
          return res.json({
            success: true,
            messageId: result.messageId,
            status: "sent",
            attachmentCount: attachments.length,
            timestamp: result.timestamp,
          });
        } else {
          return res.status(500).json({
            success: false,
            error: "Error al enviar email con adjuntos",
            code: "SEND_ERROR",
            message: result.error,
          });
        }
      } catch (error: any) {
        console.error("Error en /email/send-attachment:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // 6. GET /api/v1/email/status/:messageId - Estado de email
  app.get(
    "/api/v1/email/status/:messageId",
    authenticateApiKey,
    readRateLimiter,
    async (req, res) => {
      try {
        const { messageId } = req.params;

        const log = await storage.getEmailLogByMessageId(messageId);
        if (!log) {
          return res.status(404).json({
            success: false,
            error: "Email no encontrado",
            code: "EMAIL_NOT_FOUND",
            message: `No se encontró un email con ID '${messageId}'`,
          });
        }

        return res.json({
          messageId: log.messageId,
          status: log.status,
          to: log.toEmail,
          subject: log.subject,
          type: log.emailType,
          sentAt: log.sentAt,
          deliveredAt: log.deliveredAt,
          opens: log.opensCount,
          clicks: log.clicksCount,
          error: log.errorMessage,
        });
      } catch (error: any) {
        console.error("Error en /email/status:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // 7. GET /api/v1/email/stats - Estadísticas
  app.get(
    "/api/v1/email/stats",
    authenticateApiKey,
    readRateLimiter,
    async (req, res) => {
      try {
        const periodDays = parseInt(req.query.period as string) || 30;
        
        const stats = await storage.getEmailStats(req.apiKey?.id, periodDays);

        const deliveryRate = stats.sent > 0 
          ? ((stats.delivered / stats.sent) * 100).toFixed(1) + "%" 
          : "0%";
        const openRate = stats.delivered > 0 
          ? ((stats.opened / stats.delivered) * 100).toFixed(1) + "%" 
          : "0%";
        const clickRate = stats.opened > 0 
          ? ((stats.clicked / stats.opened) * 100).toFixed(1) + "%" 
          : "0%";

        const now = new Date();
        const periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - periodDays);

        return res.json({
          period: {
            days: periodDays,
            start: periodStart.toISOString().split("T")[0],
            end: now.toISOString().split("T")[0],
          },
          sent: stats.sent,
          delivered: stats.delivered,
          bounced: stats.bounced,
          opened: stats.opened,
          clicked: stats.clicked,
          complained: stats.complained,
          deliveryRate,
          openRate,
          clickRate,
        });
      } catch (error: any) {
        console.error("Error en /email/stats:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // 8. POST /api/v1/email/validate - Validar email
  app.post(
    "/api/v1/email/validate",
    authenticateApiKey,
    readRateLimiter,
    async (req, res) => {
      try {
        const validation = validateEmailSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Datos inválidos",
            code: "VALIDATION_ERROR",
            details: validation.error.errors,
          });
        }

        const { email } = validation.data;
        const result = await validateEmail(email);

        // También verificar bounce list
        const isBounced = await storage.isEmailBounced(email);

        return res.json({
          email: result.email,
          valid: result.valid && !isBounced,
          disposable: result.disposable,
          domain: result.domain,
          mxRecords: result.mxRecords,
          inBounceList: isBounced,
          score: result.score,
          reasons: isBounced 
            ? [...result.reasons, "Email en lista de supresión"] 
            : result.reasons,
        });
      } catch (error: any) {
        console.error("Error en /email/validate:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // 9. GET /api/v1/templates - Listar plantillas
  app.get(
    "/api/v1/templates",
    authenticateApiKey,
    readRateLimiter,
    async (req, res) => {
      try {
        const templates = getTemplateList();
        return res.json({
          success: true,
          templates,
          count: templates.length,
        });
      } catch (error: any) {
        console.error("Error en /templates:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // 10. POST /api/v1/webhooks - Registrar webhook
  app.post(
    "/api/v1/webhooks",
    authenticateApiKey,
    readRateLimiter,
    async (req, res) => {
      try {
        const validation = registerWebhookSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            success: false,
            error: "Datos inválidos",
            code: "VALIDATION_ERROR",
            details: validation.error.errors,
          });
        }

        const { url, events } = validation.data;

        // Generar secret para firmas HMAC
        const secret = randomBytes(32).toString("hex");

        const webhook = await storage.createWebhook({
          apiKeyId: req.apiKey?.id,
          url,
          secret,
          events,
          isActive: true,
        });

        return res.status(201).json({
          success: true,
          webhook: {
            id: webhook.id,
            url: webhook.url,
            events: webhook.events,
            secret, // Solo se muestra una vez
            createdAt: webhook.createdAt,
          },
          message: "Guarda el secret, no se mostrará de nuevo",
        });
      } catch (error: any) {
        console.error("Error en /webhooks:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // GET /api/v1/webhooks - Listar webhooks
  app.get(
    "/api/v1/webhooks",
    authenticateApiKey,
    readRateLimiter,
    async (req, res) => {
      try {
        const webhooks = await storage.getWebhooksByApiKey(req.apiKey!.id);
        return res.json({
          success: true,
          webhooks: webhooks.map(w => ({
            id: w.id,
            url: w.url,
            events: w.events,
            isActive: w.isActive,
            createdAt: w.createdAt,
            lastTriggeredAt: w.lastTriggeredAt,
            failureCount: w.failureCount,
          })),
        });
      } catch (error: any) {
        console.error("Error en GET /webhooks:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // DELETE /api/v1/webhooks/:id - Desactivar webhook
  app.delete(
    "/api/v1/webhooks/:id",
    authenticateApiKey,
    readRateLimiter,
    async (req, res) => {
      try {
        await storage.deactivateWebhook(req.params.id);
        return res.json({
          success: true,
          message: "Webhook desactivado",
        });
      } catch (error: any) {
        console.error("Error en DELETE /webhooks:", error);
        return res.status(500).json({
          success: false,
          error: "Error interno",
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
    }
  );

  // ============================================
  // ENDPOINTS DE ADMINISTRACIÓN (requieren master key)
  // ============================================

  // POST /api/v1/admin/api-keys - Crear nueva API key
  app.post("/api/v1/admin/api-keys", async (req, res) => {
    try {
      const masterKey = req.headers["x-master-key"] as string;
      const expectedMasterKey = process.env.API_MASTER_KEY;

      if (!expectedMasterKey || masterKey !== expectedMasterKey) {
        return res.status(401).json({
          success: false,
          error: "No autorizado",
          code: "UNAUTHORIZED",
        });
      }

      const { name } = req.body;
      if (!name || typeof name !== "string") {
        return res.status(400).json({
          success: false,
          error: "Nombre requerido",
          code: "NAME_REQUIRED",
        });
      }

      const { apiKey, rawKey } = await storage.createApiKey(name);

      return res.status(201).json({
        success: true,
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          key: rawKey, // Solo se muestra una vez
          keyPrefix: apiKey.keyPrefix,
          createdAt: apiKey.createdAt,
        },
        message: "Guarda el API key, no se mostrará de nuevo",
      });
    } catch (error: any) {
      console.error("Error creando API key:", error);
      return res.status(500).json({
        success: false,
        error: "Error interno",
        code: "INTERNAL_ERROR",
        message: error.message,
      });
    }
  });

  // GET /api/v1/admin/api-keys - Listar API keys
  app.get("/api/v1/admin/api-keys", async (req, res) => {
    try {
      const masterKey = req.headers["x-master-key"] as string;
      const expectedMasterKey = process.env.API_MASTER_KEY;

      if (!expectedMasterKey || masterKey !== expectedMasterKey) {
        return res.status(401).json({
          success: false,
          error: "No autorizado",
          code: "UNAUTHORIZED",
        });
      }

      const keys = await storage.listApiKeys();

      return res.json({
        success: true,
        apiKeys: keys.map(k => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          isActive: k.isActive,
          totalEmailsSent: k.totalEmailsSent,
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt,
        })),
      });
    } catch (error: any) {
      console.error("Error listando API keys:", error);
      return res.status(500).json({
        success: false,
        error: "Error interno",
        code: "INTERNAL_ERROR",
        message: error.message,
      });
    }
  });

  // DELETE /api/v1/admin/api-keys/:id - Desactivar API key
  app.delete("/api/v1/admin/api-keys/:id", async (req, res) => {
    try {
      const masterKey = req.headers["x-master-key"] as string;
      const expectedMasterKey = process.env.API_MASTER_KEY;

      if (!expectedMasterKey || masterKey !== expectedMasterKey) {
        return res.status(401).json({
          success: false,
          error: "No autorizado",
          code: "UNAUTHORIZED",
        });
      }

      await storage.deactivateApiKey(req.params.id);

      return res.json({
        success: true,
        message: "API key desactivada",
      });
    } catch (error: any) {
      console.error("Error desactivando API key:", error);
      return res.status(500).json({
        success: false,
        error: "Error interno",
        code: "INTERNAL_ERROR",
        message: error.message,
      });
    }
  });

  // GET /api/v1/admin/logs - Ver logs de emails
  app.get("/api/v1/admin/logs", async (req, res) => {
    try {
      const masterKey = req.headers["x-master-key"] as string;
      const expectedMasterKey = process.env.API_MASTER_KEY;

      if (!expectedMasterKey || masterKey !== expectedMasterKey) {
        return res.status(401).json({
          success: false,
          error: "No autorizado",
          code: "UNAUTHORIZED",
        });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getEmailLogs(undefined, limit);

      return res.json({
        success: true,
        logs: logs.map(l => ({
          messageId: l.messageId,
          to: l.toEmail,
          subject: l.subject,
          type: l.emailType,
          status: l.status,
          sentAt: l.sentAt,
          error: l.errorMessage,
        })),
        count: logs.length,
      });
    } catch (error: any) {
      console.error("Error obteniendo logs:", error);
      return res.status(500).json({
        success: false,
        error: "Error interno",
        code: "INTERNAL_ERROR",
        message: error.message,
      });
    }
  });

  return httpServer;
}
