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

// ✅ Buscar session_id activo de Yeastar por número de WhatsApp
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
        return session.id;
      }
    }
  } catch (err) {
    console.error(`❌ Excepción buscando session:`, err);
  }
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

// 💬 Flujo conversacional con transferencias
async function getFlowResponse(userId, message, userNo) {
  let state = userState[userId] || "START";
  let response = "";

  const sessionId = await getSessionIdByNumber(userNo);

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
        if (sessionId) {
          try {
            await transferSession(sessionId, COLAS["MENU_ASU_DEFAULT"]);
          } catch (err) {
            console.error("❌ Error al transferir a cola default ASU:", err);
          }
        }
      }
      break;

    case "ASU_POST":
      response = "✅ Solicitud enviada a Post Venta Asunción.";
      userState[userId] = "FIN";
      if (sessionId) {
        try {
          await transferSession(sessionId, COLAS["ASU_POST"]);
        } catch (err) {
          console.error("❌ Error al transferir ASU_POST:", err);
        }
      }
      break;

    case "MENU_CDE":
      if (message === "2") {
        response =
          "Post Venta CDE. Elegí una opción:\n1. Ventas de repuestos\n2. Turno de Servicio\n3. Estado de vehículo";
        userState[userId] = "CDE_POST";
      } else {
        response = "✅ Solicitud enviada. Te derivamos al sector correspondiente.";
        userState[userId] = "FIN";
        if (sessionId) {
          try {
            await transferSession(sessionId, COLAS["MENU_CDE_DEFAULT"]);
          } catch (err) {
            console.error("❌ Error al transferir a cola default CDE:", err);
          }
        }
      }
      break;

    case "CDE_POST":
      response = "✅ Solicitud enviada a Post Venta CDE.";
      userState[userId] = "FIN";
      if (sessionId) {
        try {
          await transferSession(sessionId, COLAS["CDE_POST"]);
        } catch (err) {
          console.error("❌ Error al transferir CDE_POST:", err);
        }
      }
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