import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";

// 🔹 Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Configuración desde .env
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

app.use(bodyParser.json());

// 🗂️ Estado de conversación de cada usuario
const userState = {};

// 📖 Función para enviar mensajes
async function sendMessage(to, text) {
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body: text },
      }),
    });
    const data = await response.json();
    console.log("📤 Respuesta de WhatsApp:", data);
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err);
  }
}

// 📖 Función para manejar el flow con log de debug
function getFlowResponse(userId, message) {
  let state = userState[userId] || "START";
  console.log(`💡 getFlowResponse: userId=${userId}, estadoPrevio=${state}, mensaje=${message}`);
  
  let response = "";

  switch (state) {
    case "START":
      response =
        "👋 Hola, ¡Bienvenido a VICAR!\nPor favor, elija la sucursal de su preferencia:\n1. Asunción\n2. Ciudad del Este";
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
        response = "⚠️ Opción inválida. Escriba 1 o 2.";
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
      }
      break;

    case "ASU_POST":
      response = "✅ Solicitud enviada a Post Venta Asunción.";
      userState[userId] = "FIN";
      break;

    case "MENU_CDE":
      if (message === "2") {
        response =
          "Post Venta CDE. Elegí una opción:\n1. Ventas de repuestos\n2. Turno de Servicio\n3. Estado de vehículo";
        userState[userId] = "CDE_POST";
      } else {
        response = "✅ Solicitud enviada. Te derivamos al sector correspondiente.";
        userState[userId] = "FIN";
      }
      break;

    case "CDE_POST":
      response = "✅ Solicitud enviada a Post Venta CDE.";
      userState[userId] = "FIN";
      break;

    case "FIN":
      response =
        "🙏 Gracias por comunicarte con VICAR. Si querés empezar de nuevo, escribí *Hola*.";
      userState[userId] = "START";
      break;

    default:
      response =
        "👋 Hola, ¡Bienvenido a VICAR!\nEscribí 'Hola' para comenzar.";
      userState[userId] = "START";
      break;
  }

  console.log(`💡 Respuesta generada: ${response}`);
  return response;
}

// ✅ Ruta para verificación de Meta
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verificado!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// ✅ Ruta para recibir mensajes con debug extra
app.post("/webhook", async (req, res) => {
  console.log("📩 RAW POST BODY:", JSON.stringify(req.body, null, 2));

  try {
    if (!req.body.object) {
      console.log("⚠️ POST recibido pero sin objeto 'object'. Esto puede indicar que el evento no es de mensaje.");
      // Enviar mensaje de prueba a tu número de prueba
      await sendMessage("TU_NUMERO_DE_PRUEBA", "🔔 POST recibido sin mensajes, chequea suscripción a events.");
      return res.sendStatus(200);
    }

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const messages = changes?.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from;
      const text = msg.text?.body?.trim() || "";

      console.log(`👤 Usuario ${from} escribió: ${text}`);

      // 📖 Obtener respuesta del flow
      const reply = getFlowResponse(from, text);

      // 📤 Enviar respuesta
      await sendMessage(from, reply);
    } else {
      console.log("⚠️ No se detectaron mensajes en el payload");
      // Mensaje de prueba para confirmar que sendMessage funciona
      await sendMessage("TU_NUMERO_DE_PRUEBA", "🔔 No se detectaron mensajes, revisa suscripción a 'messages'.");
    }
  } catch (err) {
    console.error("❌ Error en POST /webhook:", err);
  }

  res.sendStatus(200);
});

// 🚀 Servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});