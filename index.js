import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const YEASTAR_USER = process.env.YEASTAR_USER;
const YEASTAR_PASS = process.env.YEASTAR_PASS;
const CONVERSATION_TTL_MS = process.env.CONVERSATION_TTL_MS;

// 🗂️ Estado de conversación por usuario (en memoria)
const userState = {};

// 🗂️ Tracking de cola asignada por usuario (para detectar transferencias)
const userQueue = {};

// 📌 Mapeo de colas fijas (v3)
const COLAS = {
  // Asunción
  "SAC": 15,                    // ASU Ventas (Vehículos nuevos y usados)
  "ASU_REPUESTOS": 8,           // ASU Post Venta - Repuestos
  "ASU_SERVICIOS": 3,           // ASU Post Venta - Servicios y Estado
  "ASU_COBRANZAS": 7,           // ASU Cobranzas

  // Ciudad del Este
  "CDE_VENDEDORES": 13,         // CDE Ventas
  "CDE_REPUESTOS": 9,           // CDE Post Venta - Repuestos
  "CDE_SERVICIOS": 4,           // CDE Post Venta - Servicios y Estado
  "CDE_COBRANZAS": 14           // CDE Cobranzas
};

// 🔹 Token Yeastar en memoria
let accessToken = "";
let tokenExpire = 0;

// ⏱️ Verificar si una conversación ha expirado (24 horas de inactividad)
function isConversationExpired(userId) {
  console.log("\n⏱️ === VERIFICAR EXPIRACIÓN DE CONVERSACIÓN ===");
  console.log("👤 UserId:", userId);

  // Verificar si existe userState y si es un objeto con lastActivity
  if (!userState[userId] || typeof userState[userId] !== 'object' || !userState[userId].lastActivity) {
    console.log("❌ No hay registro de actividad previa → Conversación nueva");
    console.log("===============================================\n");
    return false;
  }

  const now = Date.now();
  const lastActivity = userState[userId].lastActivity;
  const timeSinceLastActivity = now - lastActivity;
  const timeRemaining = CONVERSATION_TTL_MS - timeSinceLastActivity;

  console.log("📅 Última actividad:", new Date(lastActivity).toISOString());
  console.log("⏰ Tiempo transcurrido:", Math.floor(timeSinceLastActivity / 1000 / 60), "minutos");
  console.log("⏳ Tiempo restante:", Math.floor(timeRemaining / 1000 / 60), "minutos");

  if (timeSinceLastActivity >= CONVERSATION_TTL_MS) {
    console.log("🔴 CONVERSACIÓN EXPIRADA → Reiniciando flujo");
    console.log("===============================================\n");
    return true;
  }

  console.log("✅ Conversación activa → Continuar flujo normal");
  console.log("===============================================\n");
  return false;
}

// ⏱️ Actualizar timer de conversación (resetear 24h)
function updateConversationTimer(userId) {
  console.log("\n⏱️ === ACTUALIZAR TIMER DE CONVERSACIÓN ===");
  console.log("👤 UserId:", userId);

  const now = Date.now();
  const expirationTime = now + CONVERSATION_TTL_MS;

  // Inicializar userState si no existe o si es un string (migración de estructura antigua)
  if (!userState[userId] || typeof userState[userId] !== 'object') {
    userState[userId] = { state: "START" };
  }

  userState[userId].lastActivity = now;

  console.log("🔄 Timer reseteado a 24 horas");
  console.log("📅 Timestamp actual:", new Date(now).toISOString());
  console.log("⏰ Expira el:", new Date(expirationTime).toISOString());
  console.log("===========================================\n");
}

// ✅ Obtener token de Yeastar con renovación automática
async function getAccessToken() {
  console.log("\n🔐 === GET ACCESS TOKEN ===");
  const now = Date.now() / 1000;
  const timeToExpire = tokenExpire - now;

  console.log("⏰ Tiempo hasta expiración:", timeToExpire > 0 ? `${Math.round(timeToExpire)}s` : "Token expirado o no existe");

  if (!accessToken || now >= tokenExpire) {
    console.log("🔄 Solicitando nuevo token a Yeastar...");
    try {
      const res = await fetch("https://vicar.ras.yeastar.com/openapi/v1.0/get_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: YEASTAR_USER,
          password: YEASTAR_PASS
        })
      });

      console.log("📡 Response status:", res.status, res.statusText);

      const data = await res.json();
      console.log("📥 Response data:", JSON.stringify(data));

      if (data.errcode !== 0) {
        throw new Error(`Yeastar get_token error: ${data.errmsg}`);
      }

      accessToken = data.access_token;
      tokenExpire = now + data.access_token_expire_time - 10;

      console.log("✅ Token obtenido exitosamente");
      console.log("⏰ Expira en:", data.access_token_expire_time, "segundos");
    } catch (err) {
      console.error("❌ Excepción al pedir token Yeastar:", err);
      console.error("❌ Stack:", err.stack);
      throw err;
    }
  } else {
    console.log("✅ Usando token en caché");
  }

  console.log("==============================\n");
  return accessToken;
}

// ✅ Buscar session activo de Yeastar por número de WhatsApp (retorna objeto completo)
async function getSessionIdByNumber(userNo) {
  console.log("\n🔍 === GET SESSION ID BY NUMBER ===");
  console.log("📞 Buscando sesión para número:", userNo);

  const token = await getAccessToken();
  const userType = 1;

  try {
    const url = `https://vicar.ras.yeastar.com/openapi/v1.0/message_session/list?access_token=${token}&user_type=${userType}&user_no=${128}&page=1&page_size=20`;
    console.log("🌐 URL de consulta:", url.replace(token, "***TOKEN***"));

    const res = await fetch(url);
    console.log("📡 Response status:", res.status, res.statusText);

    const data = await res.json();
    console.log("📥 Response errcode:", data.errcode);
    console.log("📥 Total de sesiones en lista:", data.list ? data.list.length : 0);

    if (data.errcode === 0 && Array.isArray(data.list) && data.list.length > 0) {
      const normalizedUserNo = userNo.replace(/^\+/, '');
      console.log("🔄 Número normalizado para búsqueda:", normalizedUserNo);

      console.log("📋 Sesiones disponibles:");
      data.list.forEach((s, index) => {
        const sessionUserNo = s.to?.user_no?.replace(/^\+/, '') || '';
        console.log(`  [${index}] ID: ${s.id}, To: ${sessionUserNo}, Pickup: ${s.pickup_member_id || 0}, Match: ${sessionUserNo === normalizedUserNo ? '✅' : '❌'}`);
      });

      const session = data.list.find(s => {
        const sessionUserNo = s.to?.user_no?.replace(/^\+/, '') || '';
        return sessionUserNo === normalizedUserNo;
      });

      if (session) {
        console.log("✅ Sesión encontrada!");
        console.log("   ID:", session.id);
        console.log("   Pickup Member ID:", session.pickup_member_id || 0);
        console.log("   Queue ID:", session.queue_id || 'N/A');
        console.log("   Is Close:", session.is_close || 0);
        console.log("=====================================\n");
        return {
          id: session.id,
          pickup_member_id: session.pickup_member_id || 0,
          queue_id: session.queue_id || null,
          is_close: session.is_close || 0
        };
      } else {
        console.log("❌ No se encontró sesión que coincida con el número");
      }
    } else {
      console.log("⚠️ No hay sesiones disponibles o error en respuesta");
      console.log("📋 Data completo:", JSON.stringify(data));
    }
  } catch (err) {
    console.error(`❌ Excepción buscando session:`, err);
    console.error(`❌ Stack:`, err.stack);
  }

  console.log("=====================================\n");
  return null;
}

// ✅ Hacer pickup de sesión enviando mensaje (activa auto-pickup en Yeastar)
async function pickupSession(sessionId, messageToSend) {
  console.log(`🎯 Intentando pickup de session ${sessionId}`);
  const token = await getAccessToken();

  try {
    // Enviar mensaje a través de Yeastar para activar auto-pickup
    const messageBody = {
      session_id: sessionId,
      sender_type: 1,
      sender_no: "128",
      msg_kind: 0,
      msg_type: 0,
      msg_body: messageToSend
    };

    console.log(`🎯 Enviando mensaje vía Yeastar para activar auto-pickup: "${messageToSend}"`);
    const sendRes = await fetch(`https://vicar.ras.yeastar.com/openapi/v1.0/message/send?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageBody)
    });
    const sendData = await sendRes.json();
    console.log(`🎯 Respuesta message/send:`, JSON.stringify(sendData));

    // Esperar para que el sistema procese el auto-pickup
    await new Promise(resolve => setTimeout(resolve, 300));

    // Consultar la sesión actualizada para obtener el pickup_member_id
    console.log(`🎯 Consultando session actualizada...`);
    const getRes = await fetch(`https://vicar.ras.yeastar.com/openapi/v1.0/message_session/get?access_token=${token}&id=${sessionId}`);
    const getData = await getRes.json();
    console.log(`🎯 Respuesta message_session/get:`, JSON.stringify(getData));

    if (getData.errcode === 0 && getData.data) {
      const pickupMemberId = getData.data.pickup_member_id || 0;
      console.log(`🎯 Pickup exitoso, pickup_member_id: ${pickupMemberId}`);
      return pickupMemberId;
    }

    console.log(`⚠️ No se pudo obtener pickup_member_id actualizado`);
    return 0;
  } catch (err) {
    console.error(`❌ Excepción en pickupSession:`, err);
    return 0;
  }
}

// ✅ Transferir sesión a otra cola
async function transferSession(sessionId, destinationId, fromMemberId) {
  console.log(`📤 ANTES DE TRANSFERIR - session: ${sessionId}, destino: ${destinationId}, from_member_id: ${fromMemberId}`);
  const token = await getAccessToken();
  const body = {
    session_id: sessionId,
    from_member_id: fromMemberId,
    destination_type: "queue",
    destination_id: destinationId
  };
  console.log("📤 DURANTE TRANSFERENCIA - body:", JSON.stringify(body));
  try {
    const res = await fetch(`https://vicar.ras.yeastar.com/openapi/v1.0/message_session/transfer?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    console.log("📤 DESPUÉS DE TRANSFERIR - response:", JSON.stringify(data));
    return data;
  } catch (err) {
    console.error("❌ Excepción en transferSession:", err);
    throw err;
  }
}

// 📤 Envío de mensajes a WhatsApp Cloud API
async function sendMessage(to, text) {
  console.log("\n📤 === ENVIANDO MENSAJE A WHATSAPP ===");
  console.log("📞 Destinatario:", to);
  console.log("💬 Mensaje:", text);

  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  console.log("🌐 URL:", url);

  const payload = {
    messaging_product: "whatsapp",
    to,
    text: { body: text }
  };
  console.log("📦 Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("📡 Response status:", response.status, response.statusText);

    const data = await response.json();
    console.log("📥 Response data:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("✅ Mensaje enviado exitosamente");
    } else {
      console.error("❌ Error en respuesta de WhatsApp:", data);
    }

    console.log("======================================\n");
    return data;
  } catch (err) {
    console.error("❌ Excepción al enviar mensaje:", err);
    console.error("❌ Stack:", err.stack);
    console.log("======================================\n");
    throw err;
  }
}

// 💬 Función auxiliar para hacer pickup y transferencia
async function pickupAndTransfer(sessionData, destinationId, queueName, messageToSend, userId) {
  if (!sessionData) {
    console.error(`❌ No se encontró sessionData para transferir a ${queueName}`);
    return;
  }

  try {
    let pickupMemberId = sessionData.pickup_member_id;

    // Si no hay pickup_member_id, hacer el pickup primero enviando el mensaje vía Yeastar
    if (pickupMemberId === 0) {
      console.log(`🎯 Session ${sessionData.id} no tiene pickup, haciendo pickup automático...`);
      pickupMemberId = await pickupSession(sessionData.id, messageToSend);
    } else {
      console.log(`✓ Session ${sessionData.id} ya tiene pickup_member_id: ${pickupMemberId}`);
    }

    // Transferir con el pickup_member_id obtenido
    await transferSession(sessionData.id, destinationId, pickupMemberId);

    // 🗂️ Guardar tracking de cola para detectar futuras transferencias
    console.log(`🗂️ Guardando tracking: Usuario ${userId} → Cola ${destinationId} (${queueName})`);
    userQueue[userId] = destinationId;
  } catch (err) {
    console.error(`❌ Error al transferir a ${queueName}:`, err);
  }
}

// 💬 Flujo conversacional con transferencias
async function getFlowResponse(userId, message, userNo) {
  console.log("\n🤖 === FLUJO CONVERSACIONAL ===");
  console.log("👤 UserId:", userId);
  console.log("💬 Mensaje:", message);
  console.log("📞 UserNo:", userNo);

  // ⏱️ REGLA DE NEGOCIO #1: VERIFICAR TIMER PRIMERO (tiene prioridad absoluta)
  const conversationExpired = isConversationExpired(userId);

  if (conversationExpired) {
    console.log("🔴 TIMER EXPIRADO (24h) → BOT REACTIVADO AUTOMÁTICAMENTE");
    console.log("   Asumiendo nueva conversación - la anterior finalizó");
    console.log("   Reseteando estado a START");
    userState[userId] = { state: "START", lastActivity: Date.now() };
    delete userQueue[userId];
    console.log("====================================\n");
  }

  // Obtener estado - manejar tanto estructura antigua (string) como nueva (objeto)
  let state;
  if (!userState[userId]) {
    state = "START";
    userState[userId] = { state: "START", lastActivity: Date.now() };
  } else if (typeof userState[userId] === 'string') {
    // Migración: convertir string antiguo a objeto nuevo
    state = userState[userId];
    userState[userId] = { state: state, lastActivity: Date.now() };
  } else {
    state = userState[userId].state || "START";
  }

  console.log("📊 Estado actual:", state);
  console.log("⏱️ Timer expirado:", conversationExpired ? "SÍ" : "NO");

  let response = "";

  // ⏱️ REGLA DE NEGOCIO #2: Si estado = FIN Y timer NO expirado → Bot SILENCIADO
  // (El agente está atendiendo y no han pasado 24h)
  if (state === "FIN" && !conversationExpired) {
    console.log("🔇 REGLA DE NEGOCIO: Estado FIN + Timer activo → Bot SILENCIADO");
    console.log("   El bot se transfirió a agente y no han pasado 24h");
    console.log("   Bot permanece silenciado hasta que expire el timer");
    console.log("====================================\n");
    return ""; // Bot silenciado - agente está atendiendo
  }

  // Si llegamos aquí: Timer expirado O estado != FIN → Bot debe estar ACTIVO
  console.log("✅ BOT ACTIVO - Procesando mensaje del usuario");

  console.log("🔍 Buscando sessionData en Yeastar para:", userNo);
  const sessionData = await getSessionIdByNumber(userNo);
  console.log("📋 SessionData obtenido:", sessionData ? `ID: ${sessionData.id}, Pickup: ${sessionData.pickup_member_id}, Queue: ${sessionData.queue_id}` : "❌ No encontrado");

  if (sessionData && sessionData.is_close === 1) {
    delete userQueue[userId];
  }

  switch (state) {
    case "START":
      response =
        "👋 Hola, ¡Bienvenido a VICAR!\nPor favor, elegí la sucursal de tu preferencia:\n1. Asunción\n2. Ciudad del Este";
      userState[userId].state = "SELECCION_SUCURSAL";
      break;

    case "SELECCION_SUCURSAL":
      if (message === "1") {
        response =
          "Sucursal Asunción. Selecciona una opción:\n1. Ventas Vehículos\n2. Post Venta\n3. Cobranzas\n4. Otros";
        userState[userId].state = "MENU_ASU";
      } else if (message === "2") {
        response =
          "Sucursal Ciudad del Este. Selecciona una opción:\n1. Ventas de Vehículos\n2. Post Venta\n3. Cobranzas";
        userState[userId].state = "MENU_CDE";
      } else {
        response = "⚠️ Opción inválida. Escribí 1 o 2.";
      }
      break;

    case "MENU_ASU":
      if (message === "1") {
        response =
          "Ventas Vehiculos. Elegí una opción:\n1. Vehículos OKM\n2. Vehículos usados";
        userState[userId].state = "ASU_VENTAS";
      } else if (message === "2") {
        response =
          "Post Venta Asunción. Elegí una opción:\n1. Ventas de repuestos\n2. Turno de Servicio\n3. Estado de vehículo";
        userState[userId].state = "ASU_POST";
      } else if (message === "3") {
        userState[userId].state = "FIN";
        await pickupAndTransfer(sessionData, COLAS["ASU_COBRANZAS"], "ASU_COBRANZAS", "✅ Solicitud enviada a Cobranzas Asunción.", userId);
        response = ""; // Mensaje ya enviado por Yeastar
      } else if (message === "4") {
        userState[userId].state = "FIN";
        await pickupAndTransfer(sessionData, COLAS["ASU_SERVICIOS"], "ASU_SERVICIOS", "✅ Solicitud enviada. Te derivamos al sector correspondiente.", userId);
        response = ""; // Mensaje ya enviado por Yeastar
      } else {
        response = "⚠️ Opción inválida. Escribí 1, 2, 3 o 4.";
      }
      break;

    case "ASU_VENTAS":
      userState[userId].state = "FIN";
      await pickupAndTransfer(sessionData, COLAS["SAC"], "SAC", "✅ Solicitud enviada a Ventas Asunción.", userId);
      response = ""; // Mensaje ya enviado por Yeastar
      break;

    case "ASU_POST":
      if (message === "1") {
        userState[userId].state = "FIN";
        await pickupAndTransfer(sessionData, COLAS["ASU_REPUESTOS"], "ASU_REPUESTOS", "✅ Solicitud enviada a Post Venta Asunción.", userId);
        response = ""; // Mensaje ya enviado por Yeastar
      } else if (message === "2" || message === "3") {
        userState[userId].state = "FIN";
        await pickupAndTransfer(sessionData, COLAS["ASU_SERVICIOS"], "ASU_SERVICIOS", "✅ Solicitud enviada a Post Venta Asunción.", userId);
        response = ""; // Mensaje ya enviado por Yeastar
      } else {
        response = "⚠️ Opción inválida. Escribí 1, 2 o 3.";
      }
      break;

    case "MENU_CDE":
      if (message === "1") {
        userState[userId].state = "FIN";
        await pickupAndTransfer(sessionData, COLAS["CDE_VENDEDORES"], "CDE_VENDEDORES", "✅ Solicitud enviada a Ventas CDE.", userId);
        response = ""; // Mensaje ya enviado por Yeastar
      } else if (message === "2") {
        response =
          "Post Venta CDE. Elegí una opción:\n1. Ventas de repuestos\n2. Turno de Servicio\n3. Estado de vehículo";
        userState[userId].state = "CDE_POST";
      } else if (message === "3") {
        userState[userId].state = "FIN";
        await pickupAndTransfer(sessionData, COLAS["CDE_COBRANZAS"], "CDE_COBRANZAS", "✅ Solicitud enviada a Cobranzas CDE.", userId);
        response = ""; // Mensaje ya enviado por Yeastar
      } else {
        response = "⚠️ Opción inválida. Escribí 1, 2 o 3.";
      }
      break;

    case "CDE_POST":
      if (message === "1") {
        userState[userId].state = "FIN";
        await pickupAndTransfer(sessionData, COLAS["CDE_REPUESTOS"], "CDE_REPUESTOS", "✅ Solicitud enviada a Post Venta CDE.", userId);
        response = ""; // Mensaje ya enviado por Yeastar
      } else if (message === "2" || message === "3") {
        userState[userId].state = "FIN";
        await pickupAndTransfer(sessionData, COLAS["CDE_SERVICIOS"], "CDE_SERVICIOS", "✅ Solicitud enviada a Post Venta CDE.", userId);
        response = ""; // Mensaje ya enviado por Yeastar
      } else {
        response = "⚠️ Opción inválida. Escribí 1, 2 o 3.";
      }
      break;

    case "FIN":
      // NOTA: Este caso solo se ejecuta si el timer EXPIRÓ (24h)
      // Si timer NO expiró, ya se retornó "" en línea 491-496
      // Si llegamos aquí = timer expiró → reiniciar flujo
      console.log("🔄 Case FIN con timer expirado - Reiniciando flujo del bot");
      response =
        "👋 Hola, ¡Bienvenido a VICAR!\nPor favor, elegí la sucursal de tu preferencia:\n1. Asunción\n2. Ciudad del Este";
      userState[userId].state = "SELECCION_SUCURSAL";
      break;

    default:
      response = "👋 Hola, ¡Bienvenido a VICAR!\nEscribí 'Hola' para comenzar.";
      userState[userId].state = "START";
      break;
  }

  console.log("📊 Nuevo estado:", userState[userId].state);
  console.log("💬 Respuesta a enviar:", response);
  console.log("====================================\n");

  return response;
}

// ✅ Verificación de webhook (GET)
app.get("/webhook", (req, res) => {
  console.log("\n🔔 === WEBHOOK GET - VERIFICACIÓN ===");
  console.log("📥 Query params:", JSON.stringify(req.query));

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Mode:", mode);
  console.log("Token recibido:", token);
  console.log("Token esperado:", VERIFY_TOKEN);
  console.log("Challenge:", challenge);

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Verificación exitosa - enviando challenge");
      res.status(200).send(challenge);
    } else {
      console.log("❌ Token incorrecto - enviando 403");
      res.sendStatus(403);
    }
  } else {
    console.log("❌ Faltan parámetros - enviando 400");
    res.sendStatus(400);
  }
  console.log("=====================================\n");
});

// ✅ Recepción de mensajes (POST)
app.post("/webhook", async (req, res) => {
  console.log("\n📩 === WEBHOOK POST - MENSAJE RECIBIDO ===");
  console.log("📥 Body completo:", JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    console.log("📦 Entry:", entry ? "✅ Presente" : "❌ No encontrado");

    const changes = entry?.changes?.[0]?.value;
    console.log("📦 Changes:", changes ? "✅ Presente" : "❌ No encontrado");

    const messages = changes?.messages;
    console.log("📦 Messages array:", messages ? `✅ ${messages.length} mensaje(s)` : "❌ No encontrado");

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from;
      const text = msg.text?.body?.trim() || "";

      console.log("👤 Usuario:", from);
      console.log("💬 Mensaje recibido:", text);
      console.log("📋 Tipo de mensaje:", msg.type);

      if (!text) {
        console.log("⚠️ Mensaje vacío o sin texto - ignorando");
        res.sendStatus(200);
        return;
      }

      // ⏱️ VERIFICAR EXPIRACIÓN DE CONVERSACIÓN (24 horas)
      if (isConversationExpired(from)) {
        console.log("🔄 Conversación expirada → Reseteando estado a START");
        userState[from] = { state: "START", lastActivity: Date.now() };
        delete userQueue[from];
      }

      // ⏱️ ACTUALIZAR TIMER DE CONVERSACIÓN (resetear 24h)
      updateConversationTimer(from);

      console.log("🔄 Procesando flujo conversacional...");
      const reply = await getFlowResponse(from, text, from);

      console.log("📤 Respuesta generada:", reply);

      if (reply) {
        console.log("📨 Enviando respuesta a WhatsApp...");
        const sendResult = await sendMessage(from, reply);
        console.log("✅ Mensaje enviado exitosamente");
      } else {
        console.log("⚠️ No se generó respuesta para enviar");
      }
    } else {
      console.log("⚠️ No hay mensajes en el webhook - podría ser un status update");

      const statuses = changes?.statuses;

      if (statuses && statuses.length > 0) {
        const st = statuses[0];

        console.log("📋 Status recibido:", JSON.stringify(st, null, 2));
        console.log("JSON ST: ", JSON.stringify(st, null, 2))

        if (st.conversation && st.conversation.expiration_timestamp) {
          const exp = st.conversation.expiration_timestamp;
          const convId = st.conversation.id;
          const user = st.recipient_id;

          console.log("🔥 EXPIRATION DETECTADO");
          console.log("🆔 conversation.id:", convId);
          console.log("⏳ expiration_timestamp:", exp, "→", new Date(exp * 1000).toISOString());

          userState[user] = userState[user] || {};
          userState[user].expiration = exp;

          console.log("💾 expiration guardado en memoria para:", user);
        }
      } else {
        console.log("⚠️ Status no contiene 'conversation'. No hay expiration_timestamp.");
        console.log("ℹ️ Status.type:", st.status);
        console.log("⚠️ No hay statuses en el webhook");
      }
    }
  } catch (err) {
    console.error("❌ ERROR CRÍTICO en /webhook:", err);
    console.error("❌ Stack trace:", err.stack);
  }

  console.log("✅ Respondiendo 200 OK a WhatsApp");
  console.log("=========================================\n");
  res.sendStatus(200);
});

// ✅ Exportación para Vercel
export default app;
