# WhatsApp Webhook - VICAR

Sistema de webhook de WhatsApp integrado con Yeastar PBX para el concesionario automotriz VICAR. Este bot conversacional gestiona consultas de clientes en dos sucursales (Asunción y Ciudad del Este) y transfiere automáticamente las sesiones a las colas correspondientes de Yeastar según las selecciones del usuario.

## Características Principales

- **Bot conversacional multi-sucursal** - Menús interactivos para Asunción y Ciudad del Este
- **Integración con WhatsApp Cloud API** - Recepción y envío de mensajes en tiempo real
- **Integración con Yeastar PBX** - Transferencia automática a colas específicas
- **Gestión de estado conversacional** - Seguimiento del progreso de cada usuario
- **Sistema de pickup automático** - Asignación de sesiones antes de transferir
- **Logging comprehensivo** - Sistema completo de debugging y monitoreo
- **Deployment serverless** - Configurado para Vercel

## Arquitectura

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  WhatsApp   │ ◄────► │   Webhook    │ ◄────► │   Yeastar   │
│  Cloud API  │         │   Server     │         │     PBX     │
└─────────────┘         └──────────────┘         └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Estado de    │
                        │ Conversación │
                        │  (memoria)   │
                        └──────────────┘
```

### Flujo de Trabajo

1. **WhatsApp Cloud API** envía mensajes entrantes al endpoint `/webhook` (POST)
2. **Servidor** mantiene el estado de conversación de cada usuario en memoria
3. **Máquina de estados** (`getFlowResponse`) procesa la entrada y genera respuestas
4. En puntos de decisión clave, el servidor:
   - Obtiene el session ID de Yeastar para el número de WhatsApp del usuario
   - Realiza pickup automático si es necesario
   - Transfiere la sesión a la cola apropiada
5. **Respuestas** se envían de vuelta a través de WhatsApp Cloud API

## Requisitos Previos

- Node.js v16 o superior
- Cuenta de WhatsApp Business API
- Acceso a Yeastar PBX con credenciales API
- Cuenta de Vercel (para deployment)

## Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone <repository-url>
   cd whatsapp-webhook
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**

   Crear archivo `.env` en la raíz del proyecto:
   ```env
   VERIFY_TOKEN=tu_token_de_verificacion
   WHATSAPP_TOKEN=tu_token_de_whatsapp_cloud_api
   PHONE_NUMBER_ID=tu_phone_number_id
   YEASTAR_USER=usuario_yeastar
   YEASTAR_PASS=contraseña_yeastar
   ```

4. **Iniciar el servidor:**
   ```bash
   npm start
   ```

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VERIFY_TOKEN` | Token para verificación de webhook de WhatsApp | `mi_token_secreto_123` |
| `WHATSAPP_TOKEN` | Access token de WhatsApp Cloud API | `EAAxxxxxxxxxxxxxxxx` |
| `PHONE_NUMBER_ID` | ID del número de teléfono de WhatsApp Business | `123456789012345` |
| `YEASTAR_USER` | Usuario para autenticación en Yeastar API | `admin` |
| `YEASTAR_PASS` | Contraseña para autenticación en Yeastar API | `password123` |

## Estructura del Proyecto

```
whatsapp-webhook/
├── index.js           # Servidor principal con webhook y lógica
├── package.json       # Dependencias y scripts
├── vercel.json        # Configuración de deployment
├── .env               # Variables de entorno (no incluido en git)
└── readme.md          # Este archivo
```

### Funciones Principales

#### `getAccessToken()`
Obtiene y cachea el token de acceso de Yeastar con renovación automática antes de la expiración.

#### `getSessionIdByNumber(userNo)`
Busca la sesión activa de Yeastar correspondiente a un número de WhatsApp específico.

**Retorna:**
```javascript
{
  id: "session_id_string",
  pickup_member_id: 0
}
```

#### `pickupSession(sessionId, messageToSend)`
Realiza el pickup automático de una sesión enviando un mensaje, lo que activa el modo Auto-Pickup de Yeastar.

#### `transferSession(sessionId, destinationId, fromMemberId)`
Transfiere una sesión a una cola específica de Yeastar.

#### `pickupAndTransfer(sessionData, destinationId, queueName, messageToSend)`
Función auxiliar que combina pickup y transferencia en una sola operación.

#### `sendMessage(to, text)`
Envía mensajes a través de WhatsApp Cloud API.

#### `getFlowResponse(userId, message, userNo)`
Máquina de estados que procesa los mensajes del usuario y genera respuestas apropiadas.

## Flujo Conversacional

### Estados del Bot

```
START
  ↓
SELECCION_SUCURSAL (1: ASU / 2: CDE)
  ↓                    ↓
MENU_ASU            MENU_CDE
  ↓                    ↓
ASU_POST            CDE_POST
  ↓                    ↓
FIN ← ← ← ← ← ← ← ← FIN
```

### Menús Interactivos

#### 1. Selección de Sucursal (`START` → `SELECCION_SUCURSAL`)
```
Opciones:
1. Asunción
2. Ciudad del Este
```

#### 2. Menú Asunción (`MENU_ASU`)
```
Opciones:
1. Ventas Vehículos → Cola 3
2. Post Venta → Submenú
3. Cobranzas → Cola 3
4. Otros → Cola 3
```

#### 3. Menú Ciudad del Este (`MENU_CDE`)
```
Opciones:
1. Ventas Vehículos → Cola 4
2. Post Venta → Submenú
3. Cobranzas → Cola 4
4. Otros → Cola 4
```

#### 4. Submenú Post Venta
```
ASU_POST → Cola 15 (Cobranzas ASU)
CDE_POST → Cola 9 (Repuestos CDE)
```

## Integración con Yeastar

### Mapeo de Colas

El objeto `COLAS` define los IDs de colas de Yeastar:

```javascript
const COLAS = {
  "MENU_ASU_DEFAULT": 3,   // ASU Servicios
  "ASU_POST": 15,          // ASU Cobranzas
  "MENU_CDE_DEFAULT": 4,   // CDE Servicios
  "CDE_POST": 9            // CDE Repuestos
};
```

### Gestión de Tokens

- Los tokens se cachean en memoria
- Renovación automática 10 segundos antes de la expiración
- URL base: `https://vicar.ras.yeastar.com/openapi/v1.0/`

### Búsqueda de Sesiones

**Estrategia:**
- `user_no=128` es constante del sistema que identifica sesiones de WhatsApp
- La API retorna todas las sesiones activas de WhatsApp
- El servidor filtra por `session.to.user_no` para encontrar la sesión del usuario específico

### Proceso de Transferencia

1. Buscar sesión del usuario en Yeastar
2. Verificar si tiene `pickup_member_id`
3. Si no tiene, realizar pickup automático enviando mensaje
4. Transferir sesión a la cola de destino con el `pickup_member_id`

## Endpoints Externos Consultados

Esta sección documenta todos los endpoints de APIs externas que el servidor consulta.

### Yeastar PBX API

Base URL: `https://vicar.ras.yeastar.com/openapi/v1.0/`

---

#### 1. POST `/get_token`

**Descripción:** Obtiene un token de acceso para autenticar solicitudes a la API de Yeastar.

**URL Completa:**
```
https://vicar.ras.yeastar.com/openapi/v1.0/get_token
```

**Método:** `POST`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "username": "YEASTAR_USER",
  "password": "YEASTAR_PASS"
}
```

**Respuesta Exitosa (200):**
```json
{
  "errcode": 0,
  "errmsg": "SUCCESS",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "access_token_expire_time": 1800
}
```

**Respuesta Error:**
```json
{
  "errcode": 10003,
  "errmsg": "Invalid username or password"
}
```

**Usado en:** `getAccessToken()` (index.js:43)

**Notas:**
- Token expira según `access_token_expire_time` (segundos)
- El servidor renueva automáticamente 10 segundos antes de expirar
- Token se cachea en memoria en la variable `accessToken`

---

#### 2. GET `/message_session/list`

**Descripción:** Lista todas las sesiones de mensajería activas filtradas por tipo y usuario.

**URL Completa:**
```
https://vicar.ras.yeastar.com/openapi/v1.0/message_session/list?access_token={token}&user_type={type}&user_no={number}&page={page}&page_size={size}
```

**Método:** `GET`

**Query Parameters:**
| Parámetro | Tipo | Requerido | Descripción | Valor en Código |
|-----------|------|-----------|-------------|-----------------|
| `access_token` | string | Sí | Token de autenticación | Obtenido de `getAccessToken()` |
| `user_type` | integer | Sí | Tipo de usuario | `1` (WhatsApp) |
| `user_no` | string | Sí | Número de usuario del sistema | `128` (constante) |
| `page` | integer | No | Número de página | `1` |
| `page_size` | integer | No | Cantidad de resultados | `20` |

**Respuesta Exitosa (200):**
```json
{
  "errcode": 0,
  "errmsg": "SUCCESS",
  "total_number": 5,
  "list": [
    {
      "id": "1234567890",
      "from": {
        "user_type": 1,
        "user_no": "128"
      },
      "to": {
        "user_type": 2,
        "user_no": "595981234567"
      },
      "pickup_member_id": 0,
      "create_time": 1640000000,
      "status": "active"
    }
  ]
}
```

**Usado en:** `getSessionIdByNumber()` (index.js:90)

**Notas:**
- `user_no=128` es constante que identifica sesiones de WhatsApp en el sistema
- La función filtra `list` buscando coincidencia con `to.user_no` del usuario específico
- Retorna sesión completa con `id` y `pickup_member_id`

---

#### 3. POST `/message/send`

**Descripción:** Envía un mensaje a través de una sesión activa. Usado para activar pickup automático.

**URL Completa:**
```
https://vicar.ras.yeastar.com/openapi/v1.0/message/send?access_token={token}
```

**Método:** `POST`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "session_id": "1234567890",
  "sender_type": 1,
  "sender_no": "128",
  "msg_kind": 0,
  "msg_type": 0,
  "msg_body": "✅ Solicitud enviada. Te derivamos al sector correspondiente."
}
```

**Parámetros del Body:**
| Parámetro | Tipo | Descripción | Valor en Código |
|-----------|------|-------------|-----------------|
| `session_id` | string | ID de la sesión | ID obtenido de `getSessionIdByNumber()` |
| `sender_type` | integer | Tipo de emisor | `1` (sistema) |
| `sender_no` | string | Número del emisor | `"128"` (constante) |
| `msg_kind` | integer | Tipo de mensaje | `0` (texto) |
| `msg_type` | integer | Subtipo | `0` (texto plano) |
| `msg_body` | string | Contenido del mensaje | Mensaje de confirmación |

**Respuesta Exitosa (200):**
```json
{
  "errcode": 0,
  "errmsg": "SUCCESS",
  "data": {
    "msg_id": "msg_123456"
  }
}
```

**Usado en:** `pickupSession()` (index.js:149)

**Notas:**
- Enviar mensaje activa el modo Auto-Pickup en Yeastar
- Después de enviar, espera 300ms para que el sistema procese
- El pickup permite asignar `pickup_member_id` necesario para transferir

---

#### 4. GET `/message_session/get`

**Descripción:** Obtiene los detalles actualizados de una sesión específica.

**URL Completa:**
```
https://vicar.ras.yeastar.com/openapi/v1.0/message_session/get?access_token={token}&id={session_id}
```

**Método:** `GET`

**Query Parameters:**
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `access_token` | string | Sí | Token de autenticación |
| `id` | string | Sí | ID de la sesión a consultar |

**Respuesta Exitosa (200):**
```json
{
  "errcode": 0,
  "errmsg": "SUCCESS",
  "data": {
    "id": "1234567890",
    "from": {
      "user_type": 1,
      "user_no": "128"
    },
    "to": {
      "user_type": 2,
      "user_no": "595981234567"
    },
    "pickup_member_id": 256,
    "queue_id": 3,
    "status": "active"
  }
}
```

**Usado en:** `pickupSession()` (index.js:149)

**Notas:**
- Se consulta después de enviar mensaje para obtener `pickup_member_id` actualizado
- El `pickup_member_id` es necesario para realizar transferencias

---

#### 5. POST `/message_session/transfer`

**Descripción:** Transfiere una sesión de mensajería a otra cola o agente.

**URL Completa:**
```
https://vicar.ras.yeastar.com/openapi/v1.0/message_session/transfer?access_token={token}
```

**Método:** `POST`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "session_id": "1234567890",
  "from_member_id": 256,
  "destination_type": "queue",
  "destination_id": 3
}
```

**Parámetros del Body:**
| Parámetro | Tipo | Descripción | Valor en Código |
|-----------|------|-------------|-----------------|
| `session_id` | string | ID de la sesión a transferir | ID de sesión obtenido |
| `from_member_id` | integer | ID del miembro que transfiere | `pickup_member_id` obtenido |
| `destination_type` | string | Tipo de destino | `"queue"` (cola) |
| `destination_id` | integer | ID de la cola destino | Según mapeo `COLAS` (3, 4, 9, 15) |

**Respuesta Exitosa (200):**
```json
{
  "errcode": 0,
  "errmsg": "SUCCESS"
}
```

**Respuesta Error:**
```json
{
  "errcode": 30001,
  "errmsg": "Invalid session id"
}
```

**Usado en:** `transferSession()` (index.js:195)

**Notas:**
- Requiere `from_member_id` válido (obtenido del pickup)
- IDs de colas definidos en objeto `COLAS`
- Sin `from_member_id` válido, la transferencia falla

---

### WhatsApp Cloud API

Base URL: `https://graph.facebook.com/v20.0/`

---

#### POST `/messages`

**Descripción:** Envía mensajes de WhatsApp a través de la API de WhatsApp Business.

**URL Completa:**
```
https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages
```

**Método:** `POST`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {WHATSAPP_TOKEN}"
}
```

**Request Body:**
```json
{
  "messaging_product": "whatsapp",
  "to": "595981234567",
  "text": {
    "body": "👋 Hola, ¡Bienvenido a VICAR!\nPor favor, elegí la sucursal de tu preferencia:\n1. Asunción\n2. Ciudad del Este"
  }
}
```

**Parámetros del Body:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `messaging_product` | string | Producto de mensajería (siempre `"whatsapp"`) |
| `to` | string | Número de teléfono del destinatario (formato E.164) |
| `text.body` | string | Contenido del mensaje de texto |

**Respuesta Exitosa (200):**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "595981234567",
      "wa_id": "595981234567"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgNNTk1OTgxMjM0NTY3FQIAERgSMEE3RjhDQzM5RjRFNDg3RDYA"
    }
  ]
}
```

**Respuesta Error (400):**
```json
{
  "error": {
    "message": "(#131030) Recipient phone number not in allowed list",
    "type": "OAuthException",
    "code": 131030,
    "fbtrace_id": "ABCD1234"
  }
}
```

**Usado en:** `sendMessage()` (index.js:223)

**Notas:**
- Requiere token de acceso válido en header `Authorization`
- `PHONE_NUMBER_ID` es el ID del número de WhatsApp Business
- Máximo 4096 caracteres por mensaje
- Formato de número debe incluir código de país sin `+`

---

## API Endpoints del Servidor

Estos son los endpoints que expone el servidor webhook.

### GET `/webhook`

Endpoint de verificación para WhatsApp Cloud API.

**Query Parameters:**
- `hub.mode` - Debe ser "subscribe"
- `hub.verify_token` - Debe coincidir con `VERIFY_TOKEN`
- `hub.challenge` - String que debe ser devuelto

**Respuestas:**
- `200` - Verificación exitosa, retorna `challenge`
- `403` - Token incorrecto
- `400` - Parámetros faltantes

### POST `/webhook`

Endpoint para recibir mensajes de WhatsApp.

**Request Body:**
```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "5959xxxxxxxx",
                "type": "text",
                "text": {
                  "body": "Hola"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Respuesta:**
- Siempre retorna `200 OK` (requisito de WhatsApp)
- Procesa mensajes y responde de forma asíncrona

## Sistema de Logging

El servidor incluye logging comprehensivo en todos los puntos críticos:

### Logs de Inicialización
```
🔍 === VERIFICACIÓN DE VARIABLES DE ENTORNO ===
VERIFY_TOKEN: ✅ Configurado
WHATSAPP_TOKEN: ✅ Configurado
...
```

### Logs de Webhook
```
📩 === WEBHOOK POST - MENSAJE RECIBIDO ===
👤 Usuario: 595981234567
💬 Mensaje recibido: Hola
```

### Logs de Flujo Conversacional
```
🤖 === FLUJO CONVERSACIONAL ===
📊 Estado actual: START
📋 SessionData obtenido: ID: xxx, Pickup: 0
```

### Logs de Yeastar
```
🔐 === GET ACCESS TOKEN ===
✅ Token obtenido exitosamente

🔍 === GET SESSION ID BY NUMBER ===
📋 Sesiones disponibles:
  [0] ID: 1234, To: 595981234567, Match: ✅
```

### Logs de Envío
```
📤 === ENVIANDO MENSAJE A WHATSAPP ===
📞 Destinatario: 595981234567
💬 Mensaje: Bienvenido a VICAR...
✅ Mensaje enviado exitosamente
```

## Deployment en Vercel

### Configuración Inicial

1. **Instalar Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login en Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

### Variables de Entorno en Vercel

Configurar en el dashboard de Vercel o vía CLI:

```bash
vercel env add VERIFY_TOKEN
vercel env add WHATSAPP_TOKEN
vercel env add PHONE_NUMBER_ID
vercel env add YEASTAR_USER
vercel env add YEASTAR_PASS
```

### Deployment Automático

Los commits a la rama principal triggers deployment automático si el repositorio está conectado a Vercel.

### Ver Logs

```bash
vercel logs
```

## Configuración de WhatsApp Cloud API

1. Ir a [Facebook Developers](https://developers.facebook.com/)
2. Crear una app de WhatsApp Business
3. Obtener el `PHONE_NUMBER_ID` y `WHATSAPP_TOKEN`
4. Configurar webhook URL: `https://tu-dominio.vercel.app/webhook`
5. Configurar `VERIFY_TOKEN` en los ajustes de webhook
6. Suscribirse a eventos de `messages`

## Troubleshooting

### El bot no responde

**Verificar:**
1. Variables de entorno configuradas correctamente
2. Logs del servidor para identificar el punto de falla
3. Webhook verificado correctamente en WhatsApp
4. Token de WhatsApp válido

**Comandos útiles:**
```bash
# Ver logs en Vercel
vercel logs

# Ver logs localmente
npm start
```

### Error de autenticación con Yeastar

**Síntomas:**
- Error `Yeastar get_token error`

**Solución:**
- Verificar `YEASTAR_USER` y `YEASTAR_PASS`
- Confirmar acceso a la URL de Yeastar

### No se encuentra la sesión

**Síntomas:**
- Log: `❌ No se encontró sessionData`

**Posibles causas:**
- Usuario no tiene sesión activa en Yeastar
- Número de WhatsApp no coincide con formato en Yeastar

**Solución:**
- Verificar que existe una sesión activa para ese usuario
- Revisar el formato del número (con/sin código de país)

### Transferencia falla

**Síntomas:**
- Error en `transferSession`

**Verificar:**
- `pickup_member_id` está configurado correctamente
- ID de cola de destino es válido
- Usuario tiene permisos para transferir

## Estado del Proyecto

### Consideraciones de Producción

1. **Estado en memoria:** El objeto `userState` se reinicia al reiniciar el servidor. Para producción, considerar almacenamiento persistente (Redis, base de datos).

2. **Sin recuperación de errores:** Las transferencias fallidas no notifican al usuario ni reintentan automáticamente.

3. **Escalabilidad:** Vercel serverless puede tener límites de concurrencia dependiendo del plan.

### Mejoras Futuras

- [ ] Almacenamiento persistente del estado conversacional
- [ ] Sistema de reintentos para transferencias fallidas
- [ ] Métricas y analytics de conversaciones
- [ ] Tests automatizados
- [ ] Webhooks para notificaciones de estado
- [ ] Soporte multi-idioma

## Tecnologías Utilizadas

- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **WhatsApp Cloud API** - Integración de mensajería
- **Yeastar PBX** - Sistema de telefonía
- **Vercel** - Platform serverless para deployment
- **dotenv** - Gestión de variables de entorno

## Licencia

Proyecto propietario.

---

**Última actualización:** 2025-10-29
**Versión:** 1.0.0
