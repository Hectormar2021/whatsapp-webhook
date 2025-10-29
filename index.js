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

// Variables de entorno cargadas

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

// ✅ Obtener token de Yeastar con renovación automática
async function getAccessToken() {
  const now = Date.now() / 1000;
  if (!accessToken || now >= tokenExpire) {
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
      if (data.errcode !== 0) {
        throw new Error(`Yeastar get_token error: ${data.errmsg}`);
      }
      accessToken = data.access_token;
      tokenExpire = now + data.access_token_expire_time - 10;
    } catch (err) {
      console.error("❌ Excepción al pedir token Yeastar:", err);
      throw err;
    }
  }
  return accessToken;
}

// ✅ Buscar session activo de Yeastar por número de WhatsApp (retorna objeto completo)
async function getSessionIdByNumber(userNo) {
  const token = await getAccessToken();
  const userType = 1;

  try {
    const url = `https://vicar.ras.yeastar.com/openapi/v1.0/message_session/list?access_token=${token}&user_type=${userType}&user_no=${128}&page=1&page_size=20`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.errcode === 0 && Array.isArray(data.list) && data.list.length > 0) {
      const normalizedUserNo = userNo.replace(/^\+/, '');
      const session = data.list.find(s => {
        const sessionUserNo = s.to?.user_no?.replace(/^\+/, '') || '';
        return sessionUserNo === normalizedUserNo;
      });

      if (session) {
        return {
          id: session.id,
          pickup_member_id: session.pickup_member_id || 0
        };
      }
    }
  } catch (err) {
    console.error(`❌ Excepción buscando session:`, err);
  }
  return null;
}

// ✅ Hacer pickup de sesión enviando mensaje (activa pickup implícito en modo Auto-Pickup)
async function pickupSession(sessionId) {
  console.log(`🎯 Intentando pickup de session ${sessionId}`);
  const token = await getAccessToken();

  try {
    // Enviar mensaje de confirmación para activar el pickup
    const messageBody = {
      session_id: sessionId,
      sender_type: 1,
      sender_no: "128",
      msg_kind: 0,
      msg_type: 0,
      msg_body: ""
    };

    console.log(`🎯 Enviando mensaje para activar pickup...`);
    const sendRes = await fetch(`https://vicar.ras.yeastar.com/openapi/v1.0/message/send?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageBody)
    });
    const sendData = await sendRes.json();
    console.log(`🎯 Respuesta message/send:`, JSON.stringify(sendData));

    // Esperar para que el sistema procese el pickup
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
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    text: { body: text }
  };
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
    return data;
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err);
    throw err;
  }
}

// 💬 Función auxiliar para hacer pickup y transferencia
async function pickupAndTransfer(sessionData, destinationId, queueName) {
  if (!sessionData) {
    console.error(`❌ No se encontró sessionData para transferir a ${queueName}`);
    return;
  }

  try {
    let pickupMemberId = sessionData.pickup_member_id;

    // Si no hay pickup_member_id, hacer el pickup primero
    if (pickupMemberId === 0) {
      console.log(`🎯 Session ${sessionData.id} no tiene pickup, haciendo pickup automático...`);
      pickupMemberId = await pickupSession(sessionData.id);
    } else {
      console.log(`✓ Session ${sessionData.id} ya tiene pickup_member_id: ${pickupMemberId}`);
    }

    // Transferir con el pickup_member_id obtenido
    await transferSession(sessionData.id, destinationId, pickupMemberId);
  } catch (err) {
    console.error(`❌ Error al transferir a ${queueName}:`, err);
  }
}

// 💬 Flujo conversacional con transferencias
async function getFlowResponse(userId, message, userNo) {
  let state = userState[userId] || "START";
  let response = "";

  const sessionData = await getSessionIdByNumber(userNo);

  switch (state) {
    case "START":
      response =
        "👋 Hola, ¡Bienvenido a VICAR!\nPor favor, elegí la sucursal de tu preferencia:\n1. Asunción\n2. Ciudad del Este";
      userState[userId] = "SELECCION_SUCURSAL";
      break;

    case "SELECCION_SUCURSAL":
      if (message === "1") {
        response =
          "Sucursal Asunción. Seleccioná una opción:\n1. Ventas Vehículos\n2. Post Venta\n3. Cobranzas\n4. Otros";
        userState[userId] = "MENU_ASU";
      } else if (message === "2") {
        response =
          "Sucursal Ciudad del Este. Seleccioná una opción:\n1. Ventas Vehículos\n2. Post Venta\n3. Cobranzas\n4. Otros";
        userState[userId] = "MENU_CDE";
      } else {
        response = "⚠️ Opción inválida. Escribí 1 o 2.";
      }
      break;

    case "MENU_ASU":
      if (message === "2") {
        response =
          "Post Venta Asunción. Elegí una opción:\n1. Ventas de repuestos\n2. Turno de Servicio\n3. Estado de vehículo";
        userState[userId] = "ASU_POST";
      } else {
        response = "✅ Solicitud enviada. Te derivamos al sector correspondiente.";
        userState[userId] = "FIN";
        await pickupAndTransfer(sessionData, COLAS["MENU_ASU_DEFAULT"], "MENU_ASU_DEFAULT");
      }
      break;

    case "ASU_POST":
      response = "✅ Solicitud enviada a Post Venta Asunción.";
      userState[userId] = "FIN";
      await pickupAndTransfer(sessionData, COLAS["ASU_POST"], "ASU_POST");
      break;

    case "MENU_CDE":
      if (message === "2") {
        response =
          "Post Venta CDE. Elegí una opción:\n1. Ventas de repuestos\n2. Turno de Servicio\n3. Estado de vehículo";
        userState[userId] = "CDE_POST";
      } else {
        response = "✅ Solicitud enviada. Te derivamos al sector correspondiente.";
        userState[userId] = "FIN";
        await pickupAndTransfer(sessionData, COLAS["MENU_CDE_DEFAULT"], "MENU_CDE_DEFAULT");
      }
      break;

    case "CDE_POST":
      response = "✅ Solicitud enviada a Post Venta CDE.";
      userState[userId] = "FIN";
      await pickupAndTransfer(sessionData, COLAS["CDE_POST"], "CDE_POST");
      break;

    case "FIN":
      response = "🙏 Gracias por comunicarte con VICAR. Si querés empezar de nuevo, escribí *Hola*.";
      userState[userId] = "START";
      break;

    default:
      response = "👋 Hola, ¡Bienvenido a VICAR!\nEscribí 'Hola' para comenzar.";
      userState[userId] = "START";
      break;
  }

  return response;
}

// ✅ Verificación de webhook (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// ✅ Recepción de mensajes (POST)
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const messages = changes?.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from;
      const text = msg.text?.body?.trim() || "";

      const reply = await getFlowResponse(from, text, from);
      await sendMessage(from, reply);
    }
  } catch (err) {
    console.error("❌ Error en /webhook:", err);
  }

  res.sendStatus(200);
});

// ✅ Exportación para Vercel
export default app;