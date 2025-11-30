# FITAL Email API Gateway

API Gateway profesional de correo transaccional usando AWS SES. Servicio interno para aplicaciones FITAL.

## Visión General

| Aspecto | Descripción |
|---------|-------------|
| Nombre | FITAL Email API Gateway |
| Propósito | Servicio de correo transaccional vía API REST |
| Backend | AWS SES |
| Autenticación | API Key (x-api-key header) |
| Rate Limiting | 100 emails/minuto por API key |
| Base de Datos | PostgreSQL (logs, API keys, webhooks) |

---

## Configuración AWS SES

### Variables de Entorno Requeridas

```env
# AWS Credentials (IAM User con permisos SES)
AWS_ACCESS_KEY_ID=<tu_access_key_id>
AWS_SECRET_ACCESS_KEY=<tu_secret_access_key>
AWS_REGION=<tu_region>

# SES Configuration
AWS_SES_FROM_EMAIL=<email_verificado_en_ses>
SES_FROM_NAME=<nombre_del_servicio>

# API Security
API_MASTER_KEY=<genera_una_clave_segura_de_64_caracteres>

# Database
DATABASE_URL=<tu_url_de_postgresql>
```

> **IMPORTANTE**: Nunca commits estos valores reales. Usa variables de entorno o secrets del hosting.

### Permisos IAM Requeridos

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:GetSendStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Endpoints de la API

### Base URL
```
https://tu-dominio.com/api/v1
```

---

## 1. POST /api/v1/email/send

Enviar un email simple (texto plano).

### Request
```bash
curl -X POST https://tu-dominio.com/api/v1/email/send \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@ejemplo.com",
    "subject": "Bienvenido a FITAL",
    "body": "Gracias por registrarte.",
    "type": "text"
  }'
```

### Parámetros
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| to | string | Sí | Email del destinatario |
| subject | string | Sí | Asunto del email |
| body | string | Sí | Cuerpo del mensaje |
| type | string | No | "text" (default) o "html" |
| replyTo | string | No | Email para respuestas |
| cc | string[] | No | Emails en copia |
| bcc | string[] | No | Emails en copia oculta |

### Response (200 OK)
```json
{
  "success": true,
  "messageId": "msg_abc123def456",
  "status": "sent",
  "timestamp": "2024-11-30T12:00:00.000Z"
}
```

---

## 2. POST /api/v1/email/send-html

Enviar email con contenido HTML.

### Request
```bash
curl -X POST https://tu-dominio.com/api/v1/email/send-html \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@ejemplo.com",
    "subject": "Tu factura",
    "html": "<h1>Factura #123</h1><p>Total: $500 USD</p>",
    "replyTo": "soporte@fitalmx.com"
  }'
```

### Response (200 OK)
```json
{
  "success": true,
  "messageId": "msg_xyz789abc",
  "status": "sent",
  "timestamp": "2024-11-30T12:00:00.000Z"
}
```

---

## 3. POST /api/v1/email/send-template

Enviar email usando una plantilla predefinida.

### Request
```bash
curl -X POST https://tu-dominio.com/api/v1/email/send-template \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@ejemplo.com",
    "template": "welcome",
    "variables": {
      "nombre": "Juan",
      "empresa": "FITAL",
      "enlace": "https://fital.com/activar/xyz"
    }
  }'
```

### Plantillas Disponibles

| Template ID | Nombre | Variables |
|-------------|--------|-----------|
| welcome | Bienvenida | nombre, empresa, enlace |
| password_reset | Reset Password | nombre, codigo, expira, empresa |
| invoice | Factura | nombre, numero, monto, fecha, concepto, empresa, enlace |
| notification | Notificación | nombre, titulo, mensaje, enlace, empresa |
| otp | Código OTP | nombre, codigo, expira, empresa |

### Response (200 OK)
```json
{
  "success": true,
  "messageId": "msg_template123",
  "status": "sent",
  "template": "welcome",
  "timestamp": "2024-11-30T12:00:00.000Z"
}
```

---

## 4. POST /api/v1/email/send-bulk

Enviar email masivo (hasta 100 destinatarios).

### Request
```bash
curl -X POST https://tu-dominio.com/api/v1/email/send-bulk \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      {"email": "user1@ejemplo.com", "name": "Usuario 1"},
      {"email": "user2@ejemplo.com", "name": "Usuario 2"}
    ],
    "subject": "Actualización importante",
    "template": "notification",
    "variables": {
      "titulo": "Nueva versión",
      "mensaje": "Hemos lanzado una nueva actualización",
      "empresa": "FITAL"
    }
  }'
```

### Response (200 OK)
```json
{
  "success": true,
  "sent": 98,
  "failed": 2,
  "failedEmails": ["invalid@bad.com", "bounce@test.com"],
  "batchId": "batch_xyz789abc",
  "blockedFromBounceList": 0
}
```

---

## 5. POST /api/v1/email/send-attachment

Enviar email con archivos adjuntos (máximo 10MB total).

### Request
```bash
curl -X POST https://tu-dominio.com/api/v1/email/send-attachment \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@ejemplo.com",
    "subject": "Documentos adjuntos",
    "body": "Encuentra tus documentos adjuntos.",
    "attachments": [
      {
        "filename": "factura.pdf",
        "content": "JVBERi0xLjQKJ...(base64)",
        "contentType": "application/pdf"
      }
    ]
  }'
```

### Response (200 OK)
```json
{
  "success": true,
  "messageId": "msg_att456",
  "status": "sent",
  "attachmentCount": 1,
  "timestamp": "2024-11-30T12:00:00.000Z"
}
```

---

## 6. GET /api/v1/email/status/:messageId

Consultar estado de un email enviado.

### Request
```bash
curl -X GET https://tu-dominio.com/api/v1/email/status/msg_abc123 \
  -H "x-api-key: YOUR_API_KEY"
```

### Response (200 OK)
```json
{
  "messageId": "msg_abc123",
  "status": "delivered",
  "to": "cliente@ejemplo.com",
  "subject": "Bienvenido",
  "type": "template",
  "sentAt": "2024-11-30T12:00:00.000Z",
  "deliveredAt": "2024-11-30T12:00:05.000Z",
  "opens": 3,
  "clicks": 1,
  "error": null
}
```

### Estados Posibles
| Status | Descripción |
|--------|-------------|
| queued | En cola para envío |
| sent | Enviado a SES |
| delivered | Entregado al destinatario |
| bounced | Rebotado (email inválido) |
| complained | Marcado como spam |
| failed | Error en envío |

---

## 7. GET /api/v1/email/stats

Obtener estadísticas de uso.

### Request
```bash
curl -X GET "https://tu-dominio.com/api/v1/email/stats?period=30" \
  -H "x-api-key: YOUR_API_KEY"
```

### Response (200 OK)
```json
{
  "period": {
    "days": 30,
    "start": "2024-11-01",
    "end": "2024-11-30"
  },
  "sent": 15420,
  "delivered": 15100,
  "bounced": 120,
  "opened": 8500,
  "clicked": 2100,
  "complained": 5,
  "deliveryRate": "97.9%",
  "openRate": "56.3%",
  "clickRate": "24.7%"
}
```

---

## 8. POST /api/v1/email/validate

Validar una dirección de email antes de enviar.

### Request
```bash
curl -X POST https://tu-dominio.com/api/v1/email/validate \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ejemplo.com"
  }'
```

### Response (200 OK)
```json
{
  "email": "test@ejemplo.com",
  "valid": true,
  "disposable": false,
  "domain": "ejemplo.com",
  "mxRecords": true,
  "inBounceList": false,
  "score": 100,
  "reasons": ["Email válido y verificado"]
}
```

---

## 9. GET /api/v1/templates

Listar todas las plantillas disponibles.

### Request
```bash
curl -X GET https://tu-dominio.com/api/v1/templates \
  -H "x-api-key: YOUR_API_KEY"
```

### Response (200 OK)
```json
{
  "success": true,
  "templates": [
    {
      "id": "welcome",
      "name": "Bienvenida",
      "description": "Email de bienvenida para nuevos usuarios",
      "variables": ["nombre", "empresa", "enlace"]
    },
    {
      "id": "password_reset",
      "name": "Reset Password",
      "description": "Email para restablecer contraseña",
      "variables": ["nombre", "codigo", "expira", "empresa"]
    },
    {
      "id": "invoice",
      "name": "Factura",
      "description": "Email de factura o recibo de pago",
      "variables": ["nombre", "numero", "monto", "fecha", "concepto", "empresa", "enlace"]
    },
    {
      "id": "notification",
      "name": "Notificación",
      "description": "Email de notificación general",
      "variables": ["nombre", "titulo", "mensaje", "enlace", "empresa"]
    },
    {
      "id": "otp",
      "name": "Código OTP",
      "description": "Email con código de verificación OTP",
      "variables": ["nombre", "codigo", "expira", "empresa"]
    }
  ],
  "count": 5
}
```

---

## 10. POST /api/v1/webhooks

Registrar un webhook para recibir eventos.

### Request
```bash
curl -X POST https://tu-dominio.com/api/v1/webhooks \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tu-app.com/webhook/email",
    "events": ["delivered", "bounced", "opened", "clicked", "complained"]
  }'
```

### Response (201 Created)
```json
{
  "success": true,
  "webhook": {
    "id": "wh_abc123",
    "url": "https://tu-app.com/webhook/email",
    "events": ["delivered", "bounced", "opened", "clicked", "complained"],
    "secret": "abc123def456...",
    "createdAt": "2024-11-30T12:00:00.000Z"
  },
  "message": "Guarda el secret, no se mostrará de nuevo"
}
```

---

## Endpoints de Administración

Requieren `x-master-key` header con la clave maestra.

### POST /api/v1/admin/api-keys
Crear nueva API key.

```bash
curl -X POST https://tu-dominio.com/api/v1/admin/api-keys \
  -H "x-master-key: TU_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "App FITAL Principal"}'
```

### GET /api/v1/admin/api-keys
Listar todas las API keys.

```bash
curl -X GET https://tu-dominio.com/api/v1/admin/api-keys \
  -H "x-master-key: TU_MASTER_KEY"
```

### DELETE /api/v1/admin/api-keys/:id
Desactivar una API key.

```bash
curl -X DELETE https://tu-dominio.com/api/v1/admin/api-keys/KEY_ID \
  -H "x-master-key: TU_MASTER_KEY"
```

### GET /api/v1/admin/logs
Ver logs de emails enviados.

```bash
curl -X GET "https://tu-dominio.com/api/v1/admin/logs?limit=100" \
  -H "x-master-key: TU_MASTER_KEY"
```

---

## Códigos de Error

| Código | HTTP | Descripción |
|--------|------|-------------|
| MISSING_API_KEY | 401 | Falta el header x-api-key |
| INVALID_API_KEY | 401 | API key inválida o desactivada |
| IP_NOT_ALLOWED | 403 | IP no autorizada para esta API key |
| VALIDATION_ERROR | 400 | Datos de entrada inválidos |
| EMAIL_BOUNCED | 400 | Email en lista de supresión |
| TEMPLATE_NOT_FOUND | 404 | Plantilla no existe |
| EMAIL_NOT_FOUND | 404 | Email/messageId no encontrado |
| RATE_LIMIT_EXCEEDED | 429 | Límite de requests excedido |
| EMAIL_RATE_LIMIT_EXCEEDED | 429 | Límite de emails excedido |
| SEND_ERROR | 500 | Error al enviar email |
| INTERNAL_ERROR | 500 | Error interno del servidor |

---

## Rate Limiting

| Tipo | Límite | Ventana |
|------|--------|---------|
| Global | 1000 req/min | 1 minuto |
| Por API Key (emails) | 100 emails/min | 1 minuto |
| Lectura | 300 req/min | 1 minuto |

Headers de respuesta:
- `X-RateLimit-Limit`: Límite máximo
- `X-RateLimit-Remaining`: Requests restantes
- `X-RateLimit-Reset`: Timestamp de reset

---

## Límites AWS SES

| Recurso | Límite |
|---------|--------|
| Emails por segundo | 14 (default) |
| Emails por día | 50,000 (production) |
| Tamaño mensaje | 10 MB |
| Destinatarios por mensaje | 50 |
| Adjuntos | 10 MB total |

---

## Deployment a Vercel

1. Clonar repositorio
2. Conectar con Vercel
3. Configurar variables de entorno en dashboard Vercel
4. Deploy automático

### Variables Requeridas en Vercel
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_SES_FROM_EMAIL
SES_FROM_NAME
API_MASTER_KEY
DATABASE_URL
```

---

## Health Check

```bash
curl https://tu-dominio.com/api/v1/health
```

```json
{
  "success": true,
  "status": "healthy",
  "service": "FITAL Email API Gateway",
  "version": "1.0.0",
  "timestamp": "2024-11-30T12:00:00.000Z"
}
```

---

## Soporte

Para soporte interno FITAL, contactar al equipo de desarrollo.
