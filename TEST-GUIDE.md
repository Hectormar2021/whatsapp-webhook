# 📋 Guía de Pruebas QA - WhatsApp Webhook v3

## Información General

**Documento:** Manual de Pruebas para Bot de WhatsApp VICAR
**Versión:** 3.0
**Fecha:** 2025
**Sistema:** Integración WhatsApp Cloud API + Yeastar PBX

---

## 🎯 Objetivo

Validar que todos los flujos conversacionales del bot de WhatsApp funcionen correctamente y transfieran las conversaciones a las colas de Yeastar apropiadas según las selecciones del usuario.

---

## 📊 Mapeo de Colas Yeastar

### Asunción (ASU)
| Cola | ID | Descripción |
|------|-------|-------------|
| SAC | 15 | Ventas de Vehículos (OKM y Usados) |
| ASU Repuestos | 8 | Post Venta - Ventas de Repuestos |
| ASU Servicios | 3 | Post Venta - Turno Servicio y Estado de Vehículo |
| ASU Cobranzas | 7 | Cobranzas |

### Ciudad del Este (CDE)
| Cola | ID | Descripción |
|------|-------|-------------|
| CDE Vendedores | 13 | Ventas de Vehículos |
| CDE Repuestos | 9 | Post Venta - Ventas de Repuestos |
| CDE Servicios | 4 | Post Venta - Turno Servicio y Estado de Vehículo |
| CDE Cobranzas | 14 | Cobranzas |

---

## 🧪 Casos de Prueba

### ✅ FLUJO 1A: Asunción → Ventas → Vehículos OKM

**Objetivo:** Verificar transferencia a cola SAC (ID: 15) para vehículos nuevos

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `1` | Sucursal Asunción. Selecciona una opción:<br>1. Ventas Vehículos<br>2. Post Venta<br>3. Cobranzas<br>4. Otros |
| 3 | Enviar: `1` | Ventas Vehiculos. Elegí una opción:<br>1. Vehículos OKM<br>2. Vehículos usados |
| 4 | Enviar: `1` | ✅ Solicitud enviada a Ventas Asunción. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 15 (SAC)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 1B: Asunción → Ventas → Vehículos Usados

**Objetivo:** Verificar transferencia a cola SAC (ID: 15) para vehículos usados

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `1` | Sucursal Asunción. Selecciona una opción:<br>1. Ventas Vehículos<br>2. Post Venta<br>3. Cobranzas<br>4. Otros |
| 3 | Enviar: `1` | Ventas Vehiculos. Elegí una opción:<br>1. Vehículos OKM<br>2. Vehículos usados |
| 4 | Enviar: `2` | ✅ Solicitud enviada a Ventas Asunción. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 15 (SAC)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 2A: Asunción → Post Venta → Ventas de Repuestos

**Objetivo:** Verificar transferencia a cola ASU Repuestos (ID: 8)

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `1` | Sucursal Asunción. Selecciona una opción:<br>1. Ventas Vehículos<br>2. Post Venta<br>3. Cobranzas<br>4. Otros |
| 3 | Enviar: `2` | Post Venta Asunción. Elegí una opción:<br>1. Ventas de repuestos<br>2. Turno de Servicio<br>3. Estado de vehículo |
| 4 | Enviar: `1` | ✅ Solicitud enviada a Post Venta Asunción. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 8 (ASU Repuestos)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 2B: Asunción → Post Venta → Turno de Servicio

**Objetivo:** Verificar transferencia a cola ASU Servicios (ID: 3)

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `1` | Sucursal Asunción. Selecciona una opción:<br>1. Ventas Vehículos<br>2. Post Venta<br>3. Cobranzas<br>4. Otros |
| 3 | Enviar: `2` | Post Venta Asunción. Elegí una opción:<br>1. Ventas de repuestos<br>2. Turno de Servicio<br>3. Estado de vehículo |
| 4 | Enviar: `2` | ✅ Solicitud enviada a Post Venta Asunción. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 3 (ASU Servicios)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 2C: Asunción → Post Venta → Estado de Vehículo

**Objetivo:** Verificar transferencia a cola ASU Servicios (ID: 3)

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `1` | Sucursal Asunción. Selecciona una opción:<br>1. Ventas Vehículos<br>2. Post Venta<br>3. Cobranzas<br>4. Otros |
| 3 | Enviar: `2` | Post Venta Asunción. Elegí una opción:<br>1. Ventas de repuestos<br>2. Turno de Servicio<br>3. Estado de vehículo |
| 4 | Enviar: `3` | ✅ Solicitud enviada a Post Venta Asunción. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 3 (ASU Servicios)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 3A: Asunción → Cobranzas

**Objetivo:** Verificar transferencia a cola ASU Cobranzas (ID: 7)

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `1` | Sucursal Asunción. Selecciona una opción:<br>1. Ventas Vehículos<br>2. Post Venta<br>3. Cobranzas<br>4. Otros |
| 3 | Enviar: `3` | ✅ Solicitud enviada a Cobranzas Asunción. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 7 (ASU Cobranzas)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 3B: Asunción → Otros

**Objetivo:** Verificar transferencia a cola ASU Servicios (ID: 3)

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `1` | Sucursal Asunción. Selecciona una opción:<br>1. Ventas Vehículos<br>2. Post Venta<br>3. Cobranzas<br>4. Otros |
| 3 | Enviar: `4` | ✅ Solicitud enviada. Te derivamos al sector correspondiente. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 3 (ASU Servicios)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 4A: CDE → Post Venta → Ventas de Repuestos

**Objetivo:** Verificar transferencia a cola CDE Repuestos (ID: 9)

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `2` | Sucursal Ciudad del Este. Selecciona una opción:<br>1. Ventas de Vehículos<br>2. Post Venta<br>3. Cobranzas |
| 3 | Enviar: `2` | Post Venta CDE. Elegí una opción:<br>1. Ventas de repuestos<br>2. Turno de Servicio<br>3. Estado de vehículo |
| 4 | Enviar: `1` | ✅ Solicitud enviada a Post Venta CDE. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 9 (CDE Repuestos)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 4B: CDE → Post Venta → Turno de Servicio

**Objetivo:** Verificar transferencia a cola CDE Servicios (ID: 4)

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `2` | Sucursal Ciudad del Este. Selecciona una opción:<br>1. Ventas de Vehículos<br>2. Post Venta<br>3. Cobranzas |
| 3 | Enviar: `2` | Post Venta CDE. Elegí una opción:<br>1. Ventas de repuestos<br>2. Turno de Servicio<br>3. Estado de vehículo |
| 4 | Enviar: `2` | ✅ Solicitud enviada a Post Venta CDE. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 4 (CDE Servicios)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 4C: CDE → Post Venta → Estado de Vehículo

**Objetivo:** Verificar transferencia a cola CDE Servicios (ID: 4)

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `2` | Sucursal Ciudad del Este. Selecciona una opción:<br>1. Ventas de Vehículos<br>2. Post Venta<br>3. Cobranzas |
| 3 | Enviar: `2` | Post Venta CDE. Elegí una opción:<br>1. Ventas de repuestos<br>2. Turno de Servicio<br>3. Estado de vehículo |
| 4 | Enviar: `3` | ✅ Solicitud enviada a Post Venta CDE. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 4 (CDE Servicios)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 5: CDE → Ventas de Vehículos

**Objetivo:** Verificar transferencia a cola CDE Vendedores (ID: 13)

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `2` | Sucursal Ciudad del Este. Selecciona una opción:<br>1. Ventas de Vehículos<br>2. Post Venta<br>3. Cobranzas |
| 3 | Enviar: `1` | ✅ Solicitud enviada a Ventas CDE. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 13 (CDE Vendedores)
- [ ] Estado de sesión actualizado correctamente

---

### ✅ FLUJO 6: CDE → Cobranzas

**Objetivo:** Verificar transferencia a cola CDE Cobranzas (ID: 14)

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `2` | Sucursal Ciudad del Este. Selecciona una opción:<br>1. Ventas de Vehículos<br>2. Post Venta<br>3. Cobranzas |
| 3 | Enviar: `3` | ✅ Solicitud enviada a Cobranzas CDE. |

**Verificación Yeastar:**
- [ ] Sesión transferida a cola ID: 14 (CDE Cobranzas)
- [ ] Estado de sesión actualizado correctamente

---

## 🚨 Casos de Prueba - Manejo de Errores

### ✅ ERROR-1: Entrada Inválida en Selección de Sucursal

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `9` | ⚠️ Opción inválida. Escribí 1 o 2. |
| 3 | Enviar: `abc` | ⚠️ Opción inválida. Escribí 1 o 2. |

**Verificación:**
- [ ] Bot permanece en estado SELECCION_SUCURSAL
- [ ] Usuario puede reintentar con opción válida

---

### ✅ ERROR-2: Entrada Inválida en Menú Asunción

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `1` | Sucursal Asunción. Selecciona una opción:<br>1. Ventas Vehículos<br>2. Post Venta<br>3. Cobranzas<br>4. Otros |
| 3 | Enviar: `5` | ⚠️ Opción inválida. Escribí 1, 2, 3 o 4. |
| 4 | Enviar: `0` | ⚠️ Opción inválida. Escribí 1, 2, 3 o 4. |

**Verificación:**
- [ ] Bot permanece en estado MENU_ASU
- [ ] Usuario puede reintentar con opción válida

---

### ✅ ERROR-3: Entrada Inválida en Menú CDE

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `2` | Sucursal Ciudad del Este. Selecciona una opción:<br>1. Ventas de Vehículos<br>2. Post Venta<br>3. Cobranzas |
| 3 | Enviar: `4` | ⚠️ Opción inválida. Escribí 1, 2 o 3. |
| 4 | Enviar: `10` | ⚠️ Opción inválida. Escribí 1, 2 o 3. |

**Verificación:**
- [ ] Bot permanece en estado MENU_CDE
- [ ] Usuario puede reintentar con opción válida

---

### ✅ ERROR-4: Entrada Inválida en Post Venta ASU

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `1` | Sucursal Asunción. Selecciona una opción:<br>1. Ventas Vehículos<br>2. Post Venta<br>3. Cobranzas<br>4. Otros |
| 3 | Enviar: `2` | Post Venta Asunción. Elegí una opción:<br>1. Ventas de repuestos<br>2. Turno de Servicio<br>3. Estado de vehículo |
| 4 | Enviar: `4` | ⚠️ Opción inválida. Escribí 1, 2 o 3. |

**Verificación:**
- [ ] Bot permanece en estado ASU_POST
- [ ] Usuario puede reintentar con opción válida

---

### ✅ ERROR-5: Entrada Inválida en Post Venta CDE

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |
| 2 | Enviar: `2` | Sucursal Ciudad del Este. Selecciona una opción:<br>1. Ventas de Vehículos<br>2. Post Venta<br>3. Cobranzas |
| 3 | Enviar: `2` | Post Venta CDE. Elegí una opción:<br>1. Ventas de repuestos<br>2. Turno de Servicio<br>3. Estado de vehículo |
| 4 | Enviar: `5` | ⚠️ Opción inválida. Escribí 1, 2 o 3. |

**Verificación:**
- [ ] Bot permanece en estado CDE_POST
- [ ] Usuario puede reintentar con opción válida

---

## 🔄 Casos de Prueba - Reinicio de Flujo

### ✅ RESTART-1: Reinicio desde Estado FIN

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1-3 | Completar cualquier flujo hasta el final | ✅ Solicitud enviada... |
| 4 | Usuario en estado FIN | (Estado interno FIN) |
| 5 | Enviar: `Hola` | 👋 Hola, ¡Bienvenido a VICAR!<br>Por favor, elegí la sucursal de tu preferencia:<br>1. Asunción<br>2. Ciudad del Este |

**Verificación:**
- [ ] Bot reinicia desde estado START
- [ ] Puede completar nuevo flujo completo

---

### ✅ RESTART-2: Mensaje de Cierre en Estado FIN

| Paso | Acción del Usuario | Respuesta Esperada del Bot |
|------|-------------------|---------------------------|
| 1-3 | Completar cualquier flujo hasta el final | ✅ Solicitud enviada... |
| 4 | Enviar cualquier mensaje (excepto "Hola") | 🙏 Gracias por comunicarte con VICAR. Si querés empezar de nuevo, escribí *Hola*. |

**Verificación:**
- [ ] Bot responde con mensaje de cierre
- [ ] Estado se reinicia a START
- [ ] Siguiente mensaje "Hola" inicia flujo nuevamente

---

## 📝 Checklist General de Verificación

### Pre-requisitos
- [ ] Servidor webhook está corriendo y accesible
- [ ] Variables de entorno configuradas correctamente
- [ ] Conexión con Yeastar PBX funcional
- [ ] Token de acceso Yeastar válido
- [ ] WhatsApp Business API configurado

### Durante las Pruebas
- [ ] Logs del servidor se muestran correctamente
- [ ] Mensajes de WhatsApp se reciben sin demora
- [ ] Respuestas del bot son inmediatas (< 2 segundos)
- [ ] Sesiones de Yeastar se crean correctamente
- [ ] Transferencias a colas se ejecutan correctamente

### Post-Pruebas
- [ ] Todas las transferencias llegaron a las colas correctas
- [ ] No hay sesiones huérfanas en Yeastar
- [ ] No hay errores en logs del servidor
- [ ] Estado conversacional se maneja correctamente
- [ ] Mensajes de error son claros y útiles

---

## 🐛 Reporte de Bugs

Si encuentras un error, documentar lo siguiente:

1. **ID del Flujo:** (ej: FLUJO-2A)
2. **Pasos para reproducir:** Lista numerada
3. **Resultado esperado:** Lo que debería pasar
4. **Resultado actual:** Lo que realmente pasó
5. **Logs del servidor:** Copiar logs relevantes
6. **Captura de pantalla:** De la conversación de WhatsApp
7. **Estado en Yeastar:** Verificar cola y sesión

---

## 📊 Matriz de Pruebas - Resumen

| ID | Flujo | Sucursal | Servicio | Cola ID | Estado |
|----|-------|----------|----------|---------|--------|
| 1A | Ventas OKM | ASU | Ventas | 15 | ⬜ |
| 1B | Ventas Usados | ASU | Ventas | 15 | ⬜ |
| 2A | Repuestos | ASU | Post Venta | 8 | ⬜ |
| 2B | Turno Servicio | ASU | Post Venta | 3 | ⬜ |
| 2C | Estado Vehículo | ASU | Post Venta | 3 | ⬜ |
| 3A | Cobranzas | ASU | Cobranzas | 7 | ⬜ |
| 3B | Otros | ASU | Otros | 3 | ⬜ |
| 4A | Repuestos | CDE | Post Venta | 9 | ⬜ |
| 4B | Turno Servicio | CDE | Post Venta | 4 | ⬜ |
| 4C | Estado Vehículo | CDE | Post Venta | 4 | ⬜ |
| 5 | Ventas | CDE | Ventas | 13 | ⬜ |
| 6 | Cobranzas | CDE | Cobranzas | 14 | ⬜ |

**Leyenda:**
- ⬜ Pendiente
- ✅ Aprobado
- ❌ Fallido

---

## 📞 Contacto

**Desarrollador:** [Nombre]
**Email:** [Email]
**Fecha de pruebas:** [Fecha]
**Versión probada:** v3.0

---

**Notas adicionales:**
- Realizar pruebas en ambiente de desarrollo primero
- Validar con números de WhatsApp reales
- Documentar cualquier comportamiento inesperado
- Verificar en panel de Yeastar después de cada transferencia
