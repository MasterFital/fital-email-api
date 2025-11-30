# FITAL Email API Gateway - Documentación Completa para IA

## Descripción General

Esta es una API REST para envío de correos electrónicos transaccionales. Utiliza AWS SES como backend de envío. Es un servicio interno diseñado para que múltiples aplicaciones de FITAL puedan enviar emails de manera centralizada.

**Base URL**: `https://tu-dominio.replit.app/api/v1`

**Propósito**: Centralizar el envío de emails transaccionales (confirmaciones, notificaciones, códigos OTP, facturas, etc.) para todas las aplicaciones de FITAL.

---

## Autenticación

Todos los endpoints (excepto `/health`) requieren autenticación mediante API Key.

### Header Requerido
```
x-api-key: tu_api_key_aqui
```

### Ejemplo de Request Autenticado
```bash
curl -X POST https://api.ejemplo.com/api/v1/email/send \
  -H "x-api-key: fital_abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{"to": "user@email.com", "subject": "Hola", "body": "Mensaje"}'
```

### Errores de Autenticación
```json
{
  "success": false,
  "error": "API key requerida",
  "code": "MISSING_API_KEY"
}
```

```json
{
  "success": false,
  "error": "API key inválida",
  "code": "INVALID_API_KEY"
}
```

---

## Límites de Uso (Rate Limiting)

| Tipo | Límite | Ventana |
|------|--------|---------|
| Envío de emails por API key | 100/minuto | 1 minuto |
| Requests globales | 1000/minuto | 1 minuto |
| Endpoints de lectura | 300/minuto | 1 minuto |

### Error de Rate Limit
```json
{
  "success": false,
  "error": "Límite de envíos excedido",
  "code": "EMAIL_RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

---

## Endpoints Disponibles

### 1. POST /api/v1/email/send

**Propósito**: Enviar un email de texto plano simple.

**Cuándo usar**: Para notificaciones simples, confirmaciones básicas, o cualquier comunicación que no requiera formato HTML.

#### Request Body
```json
{
  "to": "destinatario@email.com",
  "subject": "Asunto del email",
  "body": "Contenido del mensaje en texto plano",
  "type": "text",
  "replyTo": "respuestas@tudominio.com",
  "cc": ["copia1@email.com", "copia2@email.com"],
  "bcc": ["copiaoculta@email.com"]
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| to | string | Sí | Email del destinatario |
| subject | string | Sí | Asunto del email (máx 998 caracteres) |
| body | string | Sí | Contenido del mensaje |
| type | string | No | "text" (default) o "html" |
| replyTo | string | No | Email para respuestas |
| cc | array | No | Lista de emails en copia |
| bcc | array | No | Lista de emails en copia oculta |

#### Response Exitoso (200)
```json
{
  "success": true,
  "messageId": "msg_abc123def456",
  "status": "sent",
  "timestamp": "2024-11-30T12:00:00.000Z"
}
```

#### Ejemplo Completo
```bash
curl -X POST https://api.ejemplo.com/api/v1/email/send \
  -H "x-api-key: fital_tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@gmail.com",
    "subject": "Confirmación de registro",
    "body": "Hola! Tu cuenta ha sido creada exitosamente. Bienvenido a FITAL."
  }'
```

---

### 2. POST /api/v1/email/send-html

**Propósito**: Enviar un email con contenido HTML personalizado.

**Cuándo usar**: Para emails con diseño personalizado, imágenes, tablas, o formato especial que no está cubierto por las plantillas predefinidas.

#### Request Body
```json
{
  "to": "destinatario@email.com",
  "subject": "Email con diseño",
  "html": "<h1>Título</h1><p>Contenido con <strong>formato</strong></p>",
  "replyTo": "respuestas@tudominio.com",
  "cc": ["copia@email.com"],
  "bcc": ["oculto@email.com"]
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| to | string | Sí | Email del destinatario |
| subject | string | Sí | Asunto del email |
| html | string | Sí | Contenido HTML del email |
| replyTo | string | No | Email para respuestas |
| cc | array | No | Emails en copia |
| bcc | array | No | Emails en copia oculta |

#### Ejemplo Completo
```bash
curl -X POST https://api.ejemplo.com/api/v1/email/send-html \
  -H "x-api-key: fital_tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@gmail.com",
    "subject": "Tu pedido está en camino",
    "html": "<div style=\"font-family: Arial;\"><h1 style=\"color: #2563eb;\">Pedido Enviado</h1><p>Tu pedido <strong>#12345</strong> está en camino.</p><p>Llegará el <strong>5 de diciembre</strong>.</p></div>"
  }'
```

---

### 3. POST /api/v1/email/send-template

**Propósito**: Enviar un email usando una plantilla prediseñada con variables dinámicas.

**Cuándo usar**: Para emails comunes como bienvenida, reset de contraseña, códigos OTP, facturas, y notificaciones. Las plantillas tienen diseño profesional optimizado para todos los clientes de email.

#### Request Body
```json
{
  "to": "destinatario@email.com",
  "template": "welcome",
  "variables": {
    "nombre": "Juan Pérez",
    "empresa": "FITAL",
    "enlace": "https://fital.com/activar/abc123"
  },
  "replyTo": "soporte@fital.com",
  "cc": ["gerente@empresa.com"],
  "bcc": ["logs@empresa.com"]
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| to | string | Sí | Email del destinatario |
| template | string | Sí | ID de la plantilla a usar |
| variables | object | No | Variables para reemplazar en la plantilla |
| replyTo | string | No | Email para respuestas |
| cc | array | No | Emails en copia |
| bcc | array | No | Emails en copia oculta |

#### Plantillas Disponibles

##### 1. `welcome` - Email de Bienvenida
**Variables**: nombre, empresa, enlace
```json
{
  "template": "welcome",
  "variables": {
    "nombre": "María García",
    "empresa": "FITAL",
    "enlace": "https://fital.com/activar/xyz789"
  }
}
```

##### 2. `password_reset` - Restablecer Contraseña
**Variables**: nombre, codigo, expira, empresa
```json
{
  "template": "password_reset",
  "variables": {
    "nombre": "Juan",
    "codigo": "847291",
    "expira": "15",
    "empresa": "FITAL"
  }
}
```

##### 3. `otp` - Código de Verificación OTP
**Variables**: nombre, codigo, expira, empresa
```json
{
  "template": "otp",
  "variables": {
    "nombre": "Usuario",
    "codigo": "582947",
    "expira": "10",
    "empresa": "FITAL"
  }
}
```

##### 4. `invoice` - Factura/Recibo de Pago
**Variables**: nombre, numero, monto, fecha, concepto, empresa, enlace
```json
{
  "template": "invoice",
  "variables": {
    "nombre": "Carlos López",
    "numero": "FAC-2024-001234",
    "monto": "$1,500.00 MXN",
    "fecha": "30 de noviembre 2024",
    "concepto": "Membresía Premium Anual",
    "empresa": "FITAL",
    "enlace": "https://fital.com/facturas/001234.pdf"
  }
}
```

##### 5. `notification` - Notificación General
**Variables**: nombre, titulo, mensaje, enlace, empresa
```json
{
  "template": "notification",
  "variables": {
    "nombre": "Ana",
    "titulo": "Nueva actualización disponible",
    "mensaje": "Hemos lanzado la versión 2.0 con nuevas funciones increíbles.",
    "enlace": "https://fital.com/novedades",
    "empresa": "FITAL"
  }
}
```

#### Response Exitoso (200)
```json
{
  "success": true,
  "messageId": "msg_template789",
  "status": "sent",
  "template": "welcome",
  "timestamp": "2024-11-30T12:00:00.000Z"
}
```

#### Ejemplo Completo - Enviar Código OTP
```bash
curl -X POST https://api.ejemplo.com/api/v1/email/send-template \
  -H "x-api-key: fital_tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "usuario@gmail.com",
    "template": "otp",
    "variables": {
      "nombre": "Juan",
      "codigo": "847291",
      "expira": "10",
      "empresa": "FITAL"
    }
  }'
```

---

### 4. POST /api/v1/email/send-bulk

**Propósito**: Enviar el mismo email a múltiples destinatarios de forma eficiente.

**Cuándo usar**: Para newsletters, anuncios masivos, actualizaciones a múltiples usuarios, o cualquier comunicación que deba llegar a muchos destinatarios.

**Límite**: Máximo 100 destinatarios por request.

#### Request Body
```json
{
  "recipients": [
    {"email": "user1@email.com", "name": "Usuario 1"},
    {"email": "user2@email.com", "name": "Usuario 2"},
    {"email": "user3@email.com", "name": "Usuario 3"}
  ],
  "subject": "Actualización importante",
  "template": "notification",
  "variables": {
    "titulo": "Nueva versión disponible",
    "mensaje": "Hemos lanzado mejoras importantes",
    "empresa": "FITAL"
  }
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| recipients | array | Sí | Lista de destinatarios (máx 100) |
| recipients[].email | string | Sí | Email del destinatario |
| recipients[].name | string | No | Nombre del destinatario |
| subject | string | Sí | Asunto del email |
| template | string | No* | ID de plantilla |
| html | string | No* | Contenido HTML |
| body | string | No* | Contenido texto plano |
| variables | object | No | Variables globales para template |

*Debe proporcionarse al menos uno: template, html, o body

#### Response Exitoso (200)
```json
{
  "success": true,
  "sent": 98,
  "failed": 2,
  "failedEmails": ["invalido@bad.com", "bloqueado@test.com"],
  "batchId": "batch_xyz789abc",
  "blockedFromBounceList": 1
}
```

#### Ejemplo Completo
```bash
curl -X POST https://api.ejemplo.com/api/v1/email/send-bulk \
  -H "x-api-key: fital_tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      {"email": "cliente1@gmail.com", "name": "Ana"},
      {"email": "cliente2@gmail.com", "name": "Carlos"},
      {"email": "cliente3@gmail.com", "name": "María"}
    ],
    "subject": "Promoción especial de fin de año",
    "body": "Aprovecha 50% de descuento en tu próxima compra. Usa el código FITAL50."
  }'
```

---

### 5. POST /api/v1/email/send-attachment

**Propósito**: Enviar un email con uno o más archivos adjuntos.

**Cuándo usar**: Para enviar facturas PDF, reportes, imágenes, documentos, o cualquier archivo que el usuario necesite recibir.

**Límite**: Máximo 10 adjuntos, 10MB total.

#### Request Body
```json
{
  "to": "cliente@email.com",
  "subject": "Tu factura de noviembre",
  "body": "Adjuntamos tu factura del mes.",
  "html": "<p>Adjuntamos tu factura del mes.</p>",
  "attachments": [
    {
      "filename": "factura-nov-2024.pdf",
      "content": "JVBERi0xLjQKJeLjz9MK...(base64)",
      "contentType": "application/pdf"
    }
  ],
  "replyTo": "facturacion@fital.com"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| to | string | Sí | Email del destinatario |
| subject | string | Sí | Asunto del email |
| body | string | No | Contenido texto plano |
| html | string | No | Contenido HTML |
| attachments | array | Sí | Lista de adjuntos (máx 10) |
| attachments[].filename | string | Sí | Nombre del archivo |
| attachments[].content | string | Sí | Contenido en Base64 |
| attachments[].contentType | string | Sí | Tipo MIME del archivo |
| replyTo | string | No | Email para respuestas |

#### Content Types Comunes
- PDF: `application/pdf`
- Imagen PNG: `image/png`
- Imagen JPEG: `image/jpeg`
- Word: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Excel: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- CSV: `text/csv`
- ZIP: `application/zip`

#### Response Exitoso (200)
```json
{
  "success": true,
  "messageId": "msg_att456xyz",
  "status": "sent",
  "attachmentCount": 1,
  "timestamp": "2024-11-30T12:00:00.000Z"
}
```

#### Ejemplo Completo
```bash
# Primero convertir archivo a base64
FILE_BASE64=$(base64 -i factura.pdf)

curl -X POST https://api.ejemplo.com/api/v1/email/send-attachment \
  -H "x-api-key: fital_tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "cliente@gmail.com",
    "subject": "Factura FAC-2024-001",
    "body": "Estimado cliente, adjuntamos su factura.",
    "attachments": [
      {
        "filename": "factura.pdf",
        "content": "'$FILE_BASE64'",
        "contentType": "application/pdf"
      }
    ]
  }'
```

---

### 6. GET /api/v1/email/status/:messageId

**Propósito**: Consultar el estado de entrega de un email enviado previamente.

**Cuándo usar**: Para verificar si un email fue entregado, rebotó, fue abierto, o si hubo algún error.

#### URL Parameters
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| messageId | string | ID del mensaje retornado al enviar |

#### Response Exitoso (200)
```json
{
  "messageId": "msg_abc123def456",
  "status": "delivered",
  "to": "cliente@gmail.com",
  "subject": "Confirmación de registro",
  "type": "template",
  "sentAt": "2024-11-30T12:00:00.000Z",
  "deliveredAt": "2024-11-30T12:00:05.000Z",
  "opens": 3,
  "clicks": 1,
  "error": null
}
```

#### Estados Posibles
| Status | Descripción |
|--------|-------------|
| queued | En cola esperando ser enviado |
| sent | Enviado a AWS SES exitosamente |
| delivered | Entregado al servidor del destinatario |
| bounced | Rebotado (email inválido o buzón lleno) |
| complained | El destinatario lo marcó como spam |
| failed | Error durante el envío |

#### Ejemplo Completo
```bash
curl -X GET https://api.ejemplo.com/api/v1/email/status/msg_abc123def456 \
  -H "x-api-key: fital_tu_api_key"
```

---

### 7. GET /api/v1/email/stats

**Propósito**: Obtener estadísticas de envío de emails.

**Cuándo usar**: Para dashboards, reportes, monitoreo de deliverability, o análisis de campañas.

#### Query Parameters
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| period | number | 30 | Días hacia atrás para calcular stats |

#### Response Exitoso (200)
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

#### Ejemplo Completo
```bash
# Estadísticas de los últimos 7 días
curl -X GET "https://api.ejemplo.com/api/v1/email/stats?period=7" \
  -H "x-api-key: fital_tu_api_key"

# Estadísticas de los últimos 30 días (default)
curl -X GET "https://api.ejemplo.com/api/v1/email/stats" \
  -H "x-api-key: fital_tu_api_key"
```

---

### 8. POST /api/v1/email/validate

**Propósito**: Validar si una dirección de email es válida antes de enviar.

**Cuándo usar**: Para validar emails antes de registrar usuarios, antes de campañas masivas, o para limpiar listas de contactos.

#### Request Body
```json
{
  "email": "usuario@gmail.com"
}
```

#### Response Exitoso (200)
```json
{
  "email": "usuario@gmail.com",
  "valid": true,
  "disposable": false,
  "domain": "gmail.com",
  "mxRecords": true,
  "inBounceList": false,
  "score": 100,
  "reasons": ["Email válido y verificado"]
}
```

#### Campos de Respuesta
| Campo | Tipo | Descripción |
|-------|------|-------------|
| email | string | Email validado |
| valid | boolean | true si es válido para enviar |
| disposable | boolean | true si es email temporal/desechable |
| domain | string | Dominio del email |
| mxRecords | boolean | true si el dominio tiene registros MX |
| inBounceList | boolean | true si está en lista de supresión |
| score | number | Puntuación de 0-100 |
| reasons | array | Razones de la validación |

#### Ejemplo de Email Inválido
```json
{
  "email": "fake@tempmail.com",
  "valid": false,
  "disposable": true,
  "domain": "tempmail.com",
  "mxRecords": true,
  "inBounceList": false,
  "score": 30,
  "reasons": ["Dominio de email desechable/temporal"]
}
```

#### Ejemplo Completo
```bash
curl -X POST https://api.ejemplo.com/api/v1/email/validate \
  -H "x-api-key: fital_tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{"email": "cliente@empresa.com"}'
```

---

### 9. GET /api/v1/templates

**Propósito**: Listar todas las plantillas de email disponibles con sus variables.

**Cuándo usar**: Para conocer qué plantillas existen y qué variables requieren antes de enviar con `/email/send-template`.

#### Response Exitoso (200)
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

#### Ejemplo Completo
```bash
curl -X GET https://api.ejemplo.com/api/v1/templates \
  -H "x-api-key: fital_tu_api_key"
```

---

### 10. POST /api/v1/webhooks

**Propósito**: Registrar una URL para recibir notificaciones de eventos de email.

**Cuándo usar**: Para recibir callbacks cuando un email es entregado, rebota, es abierto, o cuando hay quejas.

#### Request Body
```json
{
  "url": "https://tu-app.com/webhooks/email",
  "events": ["delivered", "bounced", "opened", "clicked", "complained"]
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| url | string | Sí | URL HTTPS para recibir callbacks |
| events | array | Sí | Eventos a escuchar |

#### Eventos Disponibles
| Evento | Descripción |
|--------|-------------|
| delivered | Email entregado al servidor destino |
| bounced | Email rebotado (permanente o temporal) |
| opened | Email abierto por el destinatario |
| clicked | Link en el email fue clickeado |
| complained | Destinatario marcó como spam |

#### Response Exitoso (201)
```json
{
  "success": true,
  "webhook": {
    "id": "wh_abc123xyz",
    "url": "https://tu-app.com/webhooks/email",
    "events": ["delivered", "bounced", "opened"],
    "secret": "abc123def456ghi789...",
    "createdAt": "2024-11-30T12:00:00.000Z"
  },
  "message": "Guarda el secret, no se mostrará de nuevo"
}
```

**IMPORTANTE**: El `secret` solo se muestra una vez. Úsalo para verificar la firma HMAC de los callbacks.

#### Ejemplo Completo
```bash
curl -X POST https://api.ejemplo.com/api/v1/webhooks \
  -H "x-api-key: fital_tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mi-app.com/api/email-events",
    "events": ["delivered", "bounced", "complained"]
  }'
```

---

### 11. GET /api/v1/webhooks

**Propósito**: Listar todos los webhooks registrados.

#### Response Exitoso (200)
```json
{
  "success": true,
  "webhooks": [
    {
      "id": "wh_abc123",
      "url": "https://mi-app.com/webhooks",
      "events": ["delivered", "bounced"],
      "isActive": true,
      "createdAt": "2024-11-30T12:00:00.000Z",
      "lastTriggeredAt": "2024-11-30T14:30:00.000Z",
      "failureCount": 0
    }
  ]
}
```

---

### 12. DELETE /api/v1/webhooks/:id

**Propósito**: Desactivar un webhook.

#### Response Exitoso (200)
```json
{
  "success": true,
  "message": "Webhook desactivado"
}
```

---

### 13. GET /api/v1/health

**Propósito**: Verificar que el servicio está funcionando.

**Autenticación**: No requiere.

#### Response Exitoso (200)
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

## Endpoints de Administración

Estos endpoints requieren el header `x-master-key` con la clave maestra del sistema.

### POST /api/v1/admin/api-keys

**Propósito**: Crear una nueva API key para una aplicación.

```bash
curl -X POST https://api.ejemplo.com/api/v1/admin/api-keys \
  -H "x-master-key: TU_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "App CRM FITAL"}'
```

#### Response
```json
{
  "success": true,
  "apiKey": {
    "id": "uuid-aqui",
    "name": "App CRM FITAL",
    "key": "fital_abc123def456...",
    "keyPrefix": "fital_abc123",
    "createdAt": "2024-11-30T12:00:00.000Z"
  },
  "message": "Guarda el API key, no se mostrará de nuevo"
}
```

### GET /api/v1/admin/api-keys

**Propósito**: Listar todas las API keys (sin mostrar las keys completas).

### DELETE /api/v1/admin/api-keys/:id

**Propósito**: Desactivar una API key.

### GET /api/v1/admin/logs

**Propósito**: Ver logs de emails enviados.

---

## Códigos de Error Comunes

| Código | HTTP | Descripción | Solución |
|--------|------|-------------|----------|
| MISSING_API_KEY | 401 | Falta x-api-key | Incluir header de autenticación |
| INVALID_API_KEY | 401 | API key inválida | Verificar que la key sea correcta |
| VALIDATION_ERROR | 400 | Datos inválidos | Revisar formato del request |
| EMAIL_BOUNCED | 400 | Email en lista negra | Usar otro email destinatario |
| TEMPLATE_NOT_FOUND | 404 | Plantilla no existe | Consultar /templates |
| EMAIL_NOT_FOUND | 404 | MessageId no existe | Verificar el ID |
| RATE_LIMIT_EXCEEDED | 429 | Límite excedido | Esperar 1 minuto |
| SEND_ERROR | 500 | Error de AWS SES | Reintentar o contactar soporte |

---

## Ejemplos de Integración

### Node.js / JavaScript
```javascript
const API_KEY = 'fital_tu_api_key';
const BASE_URL = 'https://tu-api.replit.app/api/v1';

async function sendWelcomeEmail(userEmail, userName) {
  const response = await fetch(`${BASE_URL}/email/send-template`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: userEmail,
      template: 'welcome',
      variables: {
        nombre: userName,
        empresa: 'FITAL',
        enlace: `https://fital.com/activar/${userEmail}`
      }
    })
  });
  
  return response.json();
}
```

### Python
```python
import requests

API_KEY = 'fital_tu_api_key'
BASE_URL = 'https://tu-api.replit.app/api/v1'

def send_otp_email(email, otp_code):
    response = requests.post(
        f'{BASE_URL}/email/send-template',
        headers={
            'x-api-key': API_KEY,
            'Content-Type': 'application/json'
        },
        json={
            'to': email,
            'template': 'otp',
            'variables': {
                'nombre': 'Usuario',
                'codigo': otp_code,
                'expira': '10',
                'empresa': 'FITAL'
            }
        }
    )
    return response.json()
```

### PHP
```php
<?php
$apiKey = 'fital_tu_api_key';
$baseUrl = 'https://tu-api.replit.app/api/v1';

function sendInvoiceEmail($email, $invoiceData) {
    global $apiKey, $baseUrl;
    
    $data = [
        'to' => $email,
        'template' => 'invoice',
        'variables' => [
            'nombre' => $invoiceData['customerName'],
            'numero' => $invoiceData['invoiceNumber'],
            'monto' => $invoiceData['amount'],
            'fecha' => $invoiceData['date'],
            'concepto' => $invoiceData['concept'],
            'empresa' => 'FITAL',
            'enlace' => $invoiceData['pdfUrl']
        ]
    ];
    
    $ch = curl_init("$baseUrl/email/send-template");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'x-api-key: ' . $apiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}
?>
```

---

## Resumen de Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /email/send | Enviar email texto |
| POST | /email/send-html | Enviar email HTML |
| POST | /email/send-template | Enviar con plantilla |
| POST | /email/send-bulk | Envío masivo (max 100) |
| POST | /email/send-attachment | Email con adjuntos |
| GET | /email/status/:id | Estado de email |
| GET | /email/stats | Estadísticas |
| POST | /email/validate | Validar email |
| GET | /templates | Listar plantillas |
| POST | /webhooks | Registrar webhook |
| GET | /webhooks | Listar webhooks |
| DELETE | /webhooks/:id | Desactivar webhook |
| GET | /health | Health check |

---

## Contacto y Soporte

Este es un servicio interno de FITAL. Para soporte, contactar al equipo de desarrollo.
