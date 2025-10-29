import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// 🔑 Variables de entorno
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const YEASTAR_USER = process.env.YEASTAR_USER;
const YEASTAR_PASS = process.env.YEASTAR_PASS;

// Log de presencia de variables (no imprimas valores sensibles completos)
console.log("🔔 App inicializada. Presencia de env:", {
  VERIFY_TOKEN: !!VERIFY_TOKEN,
  WHATSAPP_TOKEN: !!WHATSAPP_TOKEN,
  PHONE_NUMBER_ID: !!PHONE_NUMBER_ID,
  YEASTAR_USER: !!YEASTAR_USER,
  YEASTAR_PASS: !!YEASTAR_PASS,
});

// 🗂️ Estado de conversación por usuario (en memoria)
const userState = {};

// 📌 Mapeo de colas fijas (Opción A)
const COLAS = {
  "MENU_ASU_DEFAULT": 3,  // ASU Servicios
  "ASU_POST": 15,           // ASU Cobranzas
  "MENU_CDE_DEFAULT": 4,   // CDE Servicios
  "CDE_POST": 9            // CDE Repuestos
};

// 🔹 Token Yeastar en memoria
let accessToken = "";
let tokenExpire = 0;

// ✅ Obtener token de Yeastar con renovación automática (con logs)
async function getAccessToken() {
  const now = Date.now() / 1000;
  if (!accessToken || now >= tokenExpire) {
    console.log("🔐 Solicitando nuevo access_token a Yeastar...");
    try {
      const res = await fetch("https://vicar.ras.yeastar.com/openapi/v1.0/get_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: YEASTAR_USER,
          password: YEASTAR_PASS
        })
      });
      const data = await res.json();
      console.log("🔐 Respuesta get_token:", JSON.stringify(data));
      if (data.errcode !== 0) {
        console.error("❌ Error en get_token:", data);
        throw new Error(`Yeastar get_token error: ${data.errmsg}`);
      }
      accessToken = data.access_token;
      tokenExpire = now + data.access_token_expire_time - 10;
      console.log("🔐 access_token obtenido, expira en (s):", data.access_token_expire_time);
    } catch (err) {
      console.error("❌ Excepción al pedir token Yeastar:", err);
      throw err;
    }
  } else {
    console.log("🔐 access_token en cache, expira en:", tokenExpire - now, "segundos");
  }
  return accessToken;
}

// ✅ Buscar session_id activo de Yeastar por número de WhatsApp
// Ahora intenta con los user_type permitidos (1 y 9) en vez de usar un 3 fijo.
async function getSessionIdByNumber(userNo) {
  console.log(`🔎 Buscando session para userNo=${userNo}`);
  const token = await getAccessToken();

  const userType = 1;
  
    try {
      const url = `https://vicar.ras.yeastar.com/openapi/v1.0/message_session/list?access_token=${token}&user_type=${userType}&user_no=${128}&page=1&page_size=20`;
      console.log(`🔎 Probando user_type=${userType} -> ${url}`);
      const res = await fetch(url);
      const data = await res.json();
      console.log(`🔎 Respuesta message_session/list (user_type=${userType}):`, JSON.stringify(data));

      if (data.errcode === 0 && Array.isArray(data.list) && data.list.length > 0) {
        // Normalizar números eliminando el símbolo '+' para comparación
        const normalizedUserNo = userNo.replace(/^\+/, '');

        // Filtrar la sesión que corresponde al número de WhatsApp del usuario
        const session = data.list.find(s => {
          const sessionUserNo = s.to?.user_no?.replace(/^\+/, '') || '';
          return sessionUserNo === normalizedUserNo;
        });

        if (session) {
          console.log(`✅ Session encontrada (user_type=${userType}): id=${session.id} para userNo=${userNo}`);
          return session.id;
        } else {
          console.warn(`⚠️ No se encontró sesión para userNo=${userNo} (normalizado: ${normalizedUserNo}) en la lista de ${data.list.length} sesiones`);
        }
      }

      // Si error de parámetro, lo logeamos y seguimos al siguiente tipo
      if (data.errcode && data.errcode !== 0) {
        console.warn(`⚠️ message_session/list returned errcode=${data.errcode} for user_type=${userType}`, data);
      }
    } catch (err) {
      console.error(`❌ Excepción buscando session con user_type=${userType}:`, err);
    }
  console.log("🔎 No se encontró session activa para este número");
  return null;
}

// ✅ Transferir sesión a otra cola (con logs)
async function transferSession(sessionId, destinationId) {
  console.log(`📤 Intentando transferir session ${sessionId} -> queue ${destinationId}`);
  const token = await getAccessToken();
  const body = {
    session_id: sessionId,
    from_member_id: 0,
    destination_type: "queue",
    destination_id: destinationId
  };
  console.log("📤 transferSession body:", JSON.stringify(body));
  try {
    const res = await fetch(`https://vicar.ras.yeastar.com/openapi/v1.0/message_session/transfer?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    console.log("📤 Transfer response:", JSON.stringify(data));
    return data;
  } catch (err) {
    console.error("❌ Excepción en transferSession:", err);
    throw err;
  }
}

// 📤 Envío de mensajes a WhatsApp Cloud API (con logs)
async function sendMessage(to, text) {
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    text: { body: text }
  };
  console.log(`📤 Enviando mensaje a ${to}:`, payload);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("📤 Respuesta de WhatsApp:", JSON.stringify(data));
    return data;
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err);
    throw err;
  }
}

// 💬 Flujo conversacional con transferencias (con logs en cada punto)
async function getFlowResponse(userId, message, userNo) {
  let state = userState[userId] || "START";
  console.log(`💡 getFlowResponse entrada: userId=${userId}, estadoPrevio=${state}, mensaje='${message}', userNo='${userNo}'`);

  let response = "";

  // Obtener session_id de Yeastar para este número
  const sessionId = await getSessionIdByNumber(userNo);
  console.log(`💡 sessionId recuperado: ${sessionId}`);

  switch (state) {
    case "START":
      console.log("▶ Estado START -> enviando menú inicial");
      response =
        "👋 Hola, ¡Bienvenido a VICAR!\nPor favor, elegí la sucursal de tu preferencia:\n1. Asunción\n2. Ciudad del Este";
      userState[userId] = "SELECCION_SUCURSAL";
      console.log(`💡 Nuevo estado para ${userId}: SELECCION_SUCURSAL`);
      break;

    case "SELECCION_SUCURSAL":
      console.log("▶ Estado SELECCION_SUCURSAL -> mensaje recibido:", message);
      if (message === "1") {
        response =
          "Sucursal Asunción. Seleccioná una opción:\n1. Ventas Vehículos\n2. Post Venta\n3. Cobranzas\n4. Otros";
        userState[userId] = "MENU_ASU";
        console.log(`💡 Nuevo estado para ${userId}: MENU_ASU`);
      } else if (message === "2") {
        response =
          "Sucursal Ciudad del Este. Seleccioná una opción:\n1. Ventas Vehículos\n2. Post Venta\n3. Cobranzas\n4. Otros";
        userState[userId] = "MENU_CDE";
        console.log(`💡 Nuevo estado para ${userId}: MENU_CDE`);
      } else {
        response = "⚠️ Opción inválida. Escribí 1 o 2.";
        console.log(`⚠️ Entrada inválida en SELECCION_SUCURSAL: '${message}'`);
      }
      break;

    case "MENU_ASU":
      console.log("▶ Estado MENU_ASU -> mensaje recibido:", message);
      if (message === "2") {
        response =
          "Post Venta Asunción. Elegí una opción:\n1. Ventas de repuestos\n2. Turno de Servicio\n3. Estado de vehículo";
        userState[userId] = "ASU_POST";
        console.log(`💡 Nuevo estado para ${userId}: ASU_POST`);
      } else {
        response = "✅ Solicitud enviada. Te derivamos al sector correspondiente.";
        userState[userId] = "FIN";
        console.log(`💡 Enviando a cola default ASU. state->FIN`);
        if (sessionId) {
          try {
            const transferRes = await transferSession(sessionId, COLAS["MENU_ASU_DEFAULT"]);
            console.log(`📤 Resultado transfer default ASU:`, transferRes);
          } catch (err) {
            console.error("❌ Error al transferir a cola default ASU:", err);
          }
        } else {
          console.warn(`⚠️ No se pudo transferir a cola default ASU: sessionId no encontrado para userId=${userId}`);
        }
      }
      break;

    case "ASU_POST":
      console.log("▶ Estado ASU_POST -> accion directa de transferencia");
      response = "✅ Solicitud enviada a Post Venta Asunción.";
      userState[userId] = "FIN";
      if (sessionId) {
        try {
          const transferRes = await transferSession(sessionId, COLAS["ASU_POST"]);
          console.log(`📤 Resultado transfer ASU_POST:`, transferRes);
        } catch (err) {
          console.error("❌ Error al transferir ASU_POST:", err);
        }
      } else {
        console.warn(`⚠️ No se pudo transferir a ASU_POST: sessionId no encontrado para userId=${userId}`);
      }
      break;

    case "MENU_CDE":
      console.log("▶ Estado MENU_CDE -> mensaje recibido:", message);
      if (message === "2") {
        response =
          "Post Venta CDE. Elegí una opción:\n1. Ventas de repuestos\n2. Turno de Servicio\n3. Estado de vehículo";
        userState[userId] = "CDE_POST";
        console.log(`💡 Nuevo estado para ${userId}: CDE_POST`);
      } else {
        response = "✅ Solicitud enviada. Te derivamos al sector correspondiente.";
        userState[userId] = "FIN";
        console.log(`💡 Enviando a cola default CDE. state->FIN`);
        if (sessionId) {
          try {
            const transferRes = await transferSession(sessionId, COLAS["MENU_CDE_DEFAULT"]);
            console.log(`📤 Resultado transfer default CDE:`, transferRes);
          } catch (err) {
            console.error("❌ Error al transferir a cola default CDE:", err);
          }
        } else {
          console.warn(`⚠️ No se pudo transferir a cola default CDE: sessionId no encontrado para userId=${userId}`);
        }
      }
      break;

    case "CDE_POST":
      console.log("▶ Estado CDE_POST -> accion directa de transferencia");
      response = "✅ Solicitud enviada a Post Venta CDE.";
      userState[userId] = "FIN";
      if (sessionId) {
        try {
          const transferRes = await transferSession(sessionId, COLAS["CDE_POST"]);
          console.log(`📤 Resultado transfer CDE_POST:`, transferRes);
        } catch (err) {
          console.error("❌ Error al transferir CDE_POST:", err);
        }
      } else {
        console.warn(`⚠️ No se pudo transferir a CDE_POST: sessionId no encontrado para userId=${userId}`);
      }
      break;

    case "FIN":
      console.log("▶ Estado FIN -> mensaje de cierre y reset estado");
      response = "🙏 Gracias por comunicarte con VICAR. Si querés empezar de nuevo, escribí *Hola*.";
      userState[userId] = "START";
      console.log(`💡 Estado reseteado para ${userId} -> START`);
      break;

    default:
      console.log("▶ Estado por defecto -> reenviando saludo inicial");
      response = "👋 Hola, ¡Bienvenido a VICAR!\nEscribí 'Hola' para comenzar.";
      userState[userId] = "START";
      break;
  }

  console.log(`💡 Respuesta generada para ${userId}: ${response}`);
  return response;
}

// ✅ Verificación de webhook (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔗 GET /webhook recibida:", { mode, tokenPresent: !!token });

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verificado correctamente");
      res.status(200).send(challenge);
    } else {
      console.log("❌ Webhook verification failed");
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// ✅ Recepción de mensajes (POST)
app.post("/webhook", async (req, res) => {
  console.log("📩 POST /webhook Payload recibido:", JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const messages = changes?.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from;
      const text = msg.text?.body?.trim() || "";

      console.log(`👤 Usuario ${from} escribió: ${text}`);

      const reply = await getFlowResponse(from, text, from);
      console.log(`📩 Respuesta preparada para enviar a ${from}:`, reply);
      const sendRes = await sendMessage(from, reply);
      console.log(`📩 sendMessage result:`, sendRes);
    } else {
      console.log("⚠️ Sin mensajes en el payload (o messages vacío)");
    }
  } catch (err) {
    console.error("❌ Error en /webhook:", err);
  }

  res.sendStatus(200);
});

// ✅ Exportación para Vercel
export default app;