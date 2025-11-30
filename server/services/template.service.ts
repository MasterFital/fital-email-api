// Template Service - Manejo de plantillas de email con Handlebars
import Handlebars from "handlebars";
import { db } from "../db";
import { emailTemplates, type EmailTemplate } from "@shared/schema";
import { eq } from "drizzle-orm";

// Caché de plantillas compiladas
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

// Plantillas predefinidas (hardcoded para garantizar disponibilidad)
const defaultTemplates: Record<string, { name: string; description: string; subject: string; html: string; variables: string[] }> = {
  welcome: {
    name: "Bienvenida",
    description: "Email de bienvenida para nuevos usuarios",
    subject: "Bienvenido a {{empresa}}",
    variables: ["nombre", "empresa", "enlace"],
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #2563eb; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">¡Bienvenido a {{empresa}}!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Hola <strong>{{nombre}}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Estamos muy contentos de tenerte con nosotros. Tu cuenta ha sido creada exitosamente.
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; color: #333333; line-height: 1.6;">
                Para comenzar a usar todos nuestros servicios, por favor activa tu cuenta haciendo clic en el siguiente botón:
              </p>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="{{enlace}}" style="display: inline-block; padding: 14px 40px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">
                      Activar mi cuenta
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0; font-size: 14px; color: #666666; line-height: 1.6;">
                Si no creaste esta cuenta, puedes ignorar este correo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © 2024 {{empresa}}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  
  password_reset: {
    name: "Reset Password",
    description: "Email para restablecer contraseña",
    subject: "Restablecer tu contraseña - {{empresa}}",
    variables: ["nombre", "codigo", "expira", "empresa"],
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contraseña</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #dc2626; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Restablecer Contraseña</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Hola <strong>{{nombre}}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa el siguiente código para continuar:
              </p>
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 20px 40px; background-color: #f3f4f6; border-radius: 8px; border: 2px dashed #d1d5db;">
                      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1f2937;">{{codigo}}</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 20px; font-size: 14px; color: #666666; line-height: 1.6; text-align: center;">
                Este código expira en <strong>{{expira}}</strong> minutos.
              </p>
              <p style="margin: 30px 0 0; font-size: 14px; color: #666666; line-height: 1.6;">
                Si no solicitaste restablecer tu contraseña, ignora este correo. Tu cuenta está segura.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © 2024 {{empresa}}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  invoice: {
    name: "Factura",
    description: "Email de factura o recibo de pago",
    subject: "Factura #{{numero}} - {{empresa}}",
    variables: ["nombre", "numero", "monto", "fecha", "concepto", "empresa", "enlace"],
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #059669; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Factura #{{numero}}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Hola <strong>{{nombre}}</strong>,
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; color: #333333; line-height: 1.6;">
                Gracias por tu pago. Aquí tienes el detalle de tu factura:
              </p>
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 15px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">Concepto:</strong>
                  </td>
                  <td style="padding: 15px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    {{concepto}}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">Fecha:</strong>
                  </td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    {{fecha}}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px; background-color: #059669;">
                    <strong style="color: #ffffff; font-size: 18px;">Total:</strong>
                  </td>
                  <td style="padding: 15px; background-color: #059669; text-align: right;">
                    <strong style="color: #ffffff; font-size: 24px;">{{monto}}</strong>
                  </td>
                </tr>
              </table>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="{{enlace}}" style="display: inline-block; padding: 14px 40px; background-color: #059669; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">
                      Descargar Factura PDF
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © 2024 {{empresa}}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },

  notification: {
    name: "Notificación",
    description: "Email de notificación general",
    subject: "{{titulo}} - {{empresa}}",
    variables: ["nombre", "titulo", "mensaje", "enlace", "empresa"],
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notificación</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #7c3aed; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">{{titulo}}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Hola <strong>{{nombre}}</strong>,
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; color: #333333; line-height: 1.8;">
                {{mensaje}}
              </p>
              {{#if enlace}}
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="{{enlace}}" style="display: inline-block; padding: 14px 40px; background-color: #7c3aed; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">
                      Ver más detalles
                    </a>
                  </td>
                </tr>
              </table>
              {{/if}}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © 2024 {{empresa}}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  
  otp: {
    name: "Código OTP",
    description: "Email con código de verificación OTP",
    subject: "Tu código de verificación - {{empresa}}",
    variables: ["nombre", "codigo", "expira", "empresa"],
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificación</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #0891b2; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Código de Verificación</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Hola <strong>{{nombre}}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Tu código de verificación es:
              </p>
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 25px 50px; background-color: #0891b2; border-radius: 12px;">
                      <span style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #ffffff;">{{codigo}}</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 20px; font-size: 14px; color: #666666; line-height: 1.6; text-align: center;">
                Este código expira en <strong>{{expira}}</strong> minutos.
              </p>
              <p style="margin: 30px 0 0; font-size: 14px; color: #666666; line-height: 1.6;">
                Si no solicitaste este código, ignora este correo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © 2024 {{empresa}}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
};

// Obtener plantilla compilada
function getCompiledTemplate(templateId: string): HandlebarsTemplateDelegate | null {
  if (templateCache.has(templateId)) {
    return templateCache.get(templateId)!;
  }

  const template = defaultTemplates[templateId];
  if (!template) {
    return null;
  }

  const compiled = Handlebars.compile(template.html);
  templateCache.set(templateId, compiled);
  return compiled;
}

// Renderizar plantilla con variables
export function renderTemplate(templateId: string, variables: Record<string, any> = {}): { subject: string; html: string } | null {
  const templateDef = defaultTemplates[templateId];
  if (!templateDef) {
    return null;
  }

  const compiled = getCompiledTemplate(templateId);
  if (!compiled) {
    return null;
  }

  const subjectCompiled = Handlebars.compile(templateDef.subject);
  
  return {
    subject: subjectCompiled(variables),
    html: compiled(variables),
  };
}

// Listar todas las plantillas disponibles
export function listTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  variables: string[];
}> {
  return Object.entries(defaultTemplates).map(([id, template]) => ({
    id,
    name: template.name,
    description: template.description,
    variables: template.variables,
  }));
}

// Verificar si una plantilla existe
export function templateExists(templateId: string): boolean {
  return templateId in defaultTemplates;
}

// Obtener variables requeridas de una plantilla
export function getTemplateVariables(templateId: string): string[] | null {
  const template = defaultTemplates[templateId];
  return template ? template.variables : null;
}

// Inicializar templates en la base de datos (para sincronización)
export async function syncTemplatesToDatabase(): Promise<void> {
  try {
    for (const [id, template] of Object.entries(defaultTemplates)) {
      const existing = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
      
      if (existing.length === 0) {
        await db.insert(emailTemplates).values({
          id,
          name: template.name,
          description: template.description,
          subject: template.subject,
          variables: template.variables,
          isActive: true,
        });
      }
    }
  } catch (error) {
    console.error("Error syncing templates to database:", error);
  }
}
