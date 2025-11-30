// AWS SES Service - Servicio principal para envío de emails
import { 
  SESClient, 
  SendEmailCommand, 
  SendRawEmailCommand,
  GetSendStatisticsCommand,
  type SendEmailCommandInput,
  type SendRawEmailCommandInput
} from "@aws-sdk/client-ses";
import { createTransport, type Transporter } from "nodemailer";
import type SESTransport from "nodemailer/lib/ses-transport";
import { randomUUID } from "crypto";

// Configuración del cliente SES
const sesClient = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_API_KEY || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Nodemailer transport para emails con adjuntos
let nodemailerTransport: Transporter<SESTransport.SentMessageInfo> | null = null;

function getNodemailerTransport(): Transporter<SESTransport.SentMessageInfo> {
  if (!nodemailerTransport) {
    nodemailerTransport = createTransport({
      SES: { ses: sesClient, aws: { SendRawEmailCommand } },
    });
  }
  return nodemailerTransport;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  body?: string;
  html?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface SendAttachmentEmailParams extends SendEmailParams {
  attachments: Array<{
    filename: string;
    content: string; // base64
    contentType: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId: string;
  status: "sent" | "failed";
  error?: string;
  timestamp: string;
}

export interface BulkEmailResult {
  success: boolean;
  sent: number;
  failed: number;
  failedEmails: string[];
  batchId: string;
  results: Array<{
    email: string;
    messageId?: string;
    status: "sent" | "failed";
    error?: string;
  }>;
}

// Generar un Message ID interno para tracking
function generateMessageId(): string {
  return `msg_${randomUUID().replace(/-/g, "").substring(0, 12)}`;
}

// Enviar email simple (texto o HTML)
export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const fromEmail = process.env.AWS_SES_FROM_EMAIL || "noreply@example.com";
  const fromName = process.env.SES_FROM_NAME;
  
  const toAddresses = Array.isArray(params.to) ? params.to : [params.to];
  
  // Usar formato con nombre solo si está definido, de lo contrario solo el email
  const source = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  
  try {
    const input: SendEmailCommandInput = {
      Source: source,
      Destination: {
        ToAddresses: toAddresses,
        CcAddresses: params.cc || [],
        BccAddresses: params.bcc || [],
      },
      Message: {
        Subject: {
          Data: params.subject,
          Charset: "UTF-8",
        },
        Body: params.html 
          ? {
              Html: {
                Data: params.html,
                Charset: "UTF-8",
              },
              Text: params.body ? {
                Data: params.body,
                Charset: "UTF-8",
              } : undefined,
            }
          : {
              Text: {
                Data: params.body || "",
                Charset: "UTF-8",
              },
            },
      },
      ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
    };

    const command = new SendEmailCommand(input);
    const response = await sesClient.send(command);
    
    const internalMessageId = generateMessageId();
    
    return {
      success: true,
      messageId: internalMessageId,
      status: "sent",
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("SES Send Error:", error);
    return {
      success: false,
      messageId: generateMessageId(),
      status: "failed",
      error: error.message || "Error al enviar email",
      timestamp: new Date().toISOString(),
    };
  }
}

// Enviar email con adjuntos usando Nodemailer
export async function sendEmailWithAttachments(params: SendAttachmentEmailParams): Promise<EmailResult> {
  const fromEmail = process.env.AWS_SES_FROM_EMAIL || "noreply@example.com";
  const fromName = process.env.SES_FROM_NAME || "FITAL Email Service";
  
  try {
    const transport = getNodemailerTransport();
    
    const attachments = params.attachments.map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.content, "base64"),
      contentType: att.contentType,
    }));

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
      cc: params.cc?.join(", "),
      bcc: params.bcc?.join(", "),
      replyTo: params.replyTo,
      subject: params.subject,
      text: params.body,
      html: params.html,
      attachments,
    };

    const result = await transport.sendMail(mailOptions);
    const internalMessageId = generateMessageId();
    
    return {
      success: true,
      messageId: internalMessageId,
      status: "sent",
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("SES Attachment Send Error:", error);
    return {
      success: false,
      messageId: generateMessageId(),
      status: "failed",
      error: error.message || "Error al enviar email con adjuntos",
      timestamp: new Date().toISOString(),
    };
  }
}

// Enviar emails en bulk
export async function sendBulkEmails(
  recipients: Array<{ email: string; name?: string; variables?: Record<string, any> }>,
  subject: string,
  bodyOrHtml: string,
  isHtml: boolean = false
): Promise<BulkEmailResult> {
  const batchId = `batch_${randomUUID().replace(/-/g, "").substring(0, 12)}`;
  const results: BulkEmailResult["results"] = [];
  let sent = 0;
  let failed = 0;
  const failedEmails: string[] = [];

  // Procesar en paralelo con límite de concurrencia
  const concurrencyLimit = 10;
  const chunks: typeof recipients[] = [];
  
  for (let i = 0; i < recipients.length; i += concurrencyLimit) {
    chunks.push(recipients.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (recipient) => {
      try {
        const result = await sendEmail({
          to: recipient.email,
          subject,
          ...(isHtml ? { html: bodyOrHtml } : { body: bodyOrHtml }),
        });

        if (result.success) {
          sent++;
          results.push({
            email: recipient.email,
            messageId: result.messageId,
            status: "sent",
          });
        } else {
          failed++;
          failedEmails.push(recipient.email);
          results.push({
            email: recipient.email,
            status: "failed",
            error: result.error,
          });
        }
      } catch (error: any) {
        failed++;
        failedEmails.push(recipient.email);
        results.push({
          email: recipient.email,
          status: "failed",
          error: error.message,
        });
      }
    });

    await Promise.all(promises);
  }

  return {
    success: failed === 0,
    sent,
    failed,
    failedEmails,
    batchId,
    results,
  };
}

// Obtener estadísticas de SES
export async function getSendStatistics(): Promise<any> {
  try {
    const command = new GetSendStatisticsCommand({});
    const response = await sesClient.send(command);
    return response.SendDataPoints || [];
  } catch (error: any) {
    console.error("Error getting SES statistics:", error);
    return [];
  }
}

export { sesClient };
