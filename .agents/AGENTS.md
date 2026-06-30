# Reglas del Proyecto Casa Gráfica

- **Sin Emojis en la UI**: No usar nunca emojis (como 🏠, 🛒, 🏭, 💰, 📦, 👤, 📝, ❌, ✅, 🆕, ⛔, 📋, 🔍, 📱). En su lugar, usar íconos de texto simples, íconos SVG en línea o estilos CSS puros (como badges, bordes de colores, o texto explícito).
- **Consistencia de Diseño**: Mantener la estética premium en tonos gris claro para el contenido, blanco para las tarjetas, negro para el menú y rojo para los acentos destacados.
- **Base de Datos Relacional**: Mantener la relación lógica en Firestore entre pedidos y clientes a través de `cliente_id`.

Evita ser tan descriptivo en las páginas o modales o sidebar, no des tanto detalle de las cosas, no es necesario. Por ejmplo:
Título del modal: Agregar producto/Servicio
Subtítulo: Ingresa los datos del producto o servicio para el pedido.
El subtítulo no es necesario, se quita.

Evita usar abrir la URL del localhost en el navegador para ver la pantalla, no es necesario.

No depliegues en hosting sin mi confirmación.
