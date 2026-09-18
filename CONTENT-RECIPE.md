# Receta: de Hardcover a reseña publicada en ivdorado.es

Plantilla repetible para generar entradas de la categoría **Sobre Libros**,
pensada para ejecutarse manualmente o como Routine programada.

## 0. Selección del libro

1. Llamar a `hardcover_get_library` (o la query directa `user_books` con
   `status_id: 3`, `order_by: { last_read_date: desc_nulls_last }`) para
   obtener los libros leídos más recientes.
2. Para cada candidato, comprobar si ya existe post: `wp_get_posts({ search:
   "<título del libro>" })`. Si ya hay un post publicado o borrador con ese
   libro, descartarlo.
3. Elegir el más reciente sin post. Si el usuario pide uno concreto, usar ese.

## 1. Investigación

1. Desde Hardcover: `title`, `contributions[].author.name`, `description`,
   `image.url`, `rating`, `review` (si existe — se usa solo como semilla de
   tono/ideas, nunca se copia literal).
2. Si falta `description` o no hay `review`, buscar en la web (WebSearch):
   sinopsis/argumento del libro, y biografía breve del autor (nacimiento,
   trayectoria, obra destacada, premios). Verificar los datos con al menos
   una fuente antes de darlos por buenos — no inventar cifras, nombres de
   personajes o citas textuales que no se puedan confirmar.
3. Nunca fabricar una cita textual del libro. Si no se tiene el texto
   verificado, se omite el bloque de cita o se deja pendiente para que el
   usuario la añada.

## 2. Estructura del post (Gutenberg, vía `post_content` directo en `wp_create_post`)

Replicar el patrón ya validado en el blog:

1. **Bloque plegable** `<details>` "¿Quién es [autor]?" con:
   - Biografía breve (2 párrafos) dentro de un `wp:media-text` con la foto
     del autor.
2. *(Opcional)* **Cita destacada** (`wp:quote`) — solo si hay una cita
   verificada.
3. **Cuerpo**: 6-8 párrafos (`wp:paragraph`), tono ensayístico/personal en
   primera persona, en español. Debe:
   - Abrir con un gancho temático, no con "Este libro trata de...".
   - Describir la premisa sin destripar la trama.
   - Comentar el estilo/estructura literaria.
   - Reflejar el rating de Hardcover en el tono (si es 5★, entusiasmo sin
     reservas; si es 3★, mezclar lo bueno con una pega concreta; etc.) — la
     `review` de Hardcover, si existe, es la mejor pista de qué pega o qué
     elogio destacar.
   - Cerrar con una reflexión que conecte el libro con algo más amplio.
4. `post_excerpt` = primer párrafo del cuerpo, tal cual.

## 3. Imagen de cabecera — paso manual (decisión 2026-09-18)

Se probó `mwai_image` (AI Engine) a fondo:

- Con el entorno inicial (Anthropic, sin imágenes) fallaba con "Unsupported
  query type".
- Tras configurar un entorno Google/Gemini con API key real, fallaba porque
  `ai_images_default_model` seguía apuntando a un modelo de OpenAI
  (`gpt-image-2`) que ya no existía en la config.
- Corregido eso, dos modelos "gratuitos" distintos de Google
  (`gemini-3.1-flash-image` y `gemini-2.5-flash-image`) devolvieron
  `limit: 0` en el tier gratuito — probablemente una restricción geográfica
  de Google para cuentas UE/EEE en generación de imágenes, no algo
  configurable desde el plugin.

**Decisión**: de momento la imagen de cabecera se queda como paso manual.
El Routine deja el borrador **sin imagen destacada** (o, si se prefiere,
con la portada oficial del libro en alta resolución como placeholder — ver
más abajo), y el usuario añade la imagen final a mano (Canva u otra
herramienta) antes de publicar.

Fallback opcional si se quiere algo de imagen desde el primer momento:
subir la portada oficial del libro en alta resolución (buscar en
PlanetadeLibros/Casa del Libro; **no** usar el thumbnail de Hardcover, que
es de baja calidad) y fijarla con `wp_set_featured_image`, dejando claro en
el resumen que es un placeholder pendiente de sustituir.

Revisar en el futuro si activar facturación en Google Cloud (Imagen 4
Fast, ~$0.02/imagen) para poder automatizar este paso — decisión pendiente,
no bloquea el resto del Routine.

## 4. Categoría y etiquetas

1. Categoría: `Sobre Libros` (term_id 11). Reemplazar (no añadir) para evitar
   que quede también `Uncategorized`.
2. Etiquetas (`post_tag`): autor, título del libro, género (ej.
   "Ciencia-ficción"), "Crítica", y 1-2 más relevantes (premios, corriente
   literaria, etc.). **Siempre comprobar con `wp_get_terms({ taxonomy:
   "post_tag", search: "..." })` antes de crear una etiqueta nueva**, para
   reutilizar las existentes y no duplicar variantes.

## 5. Publicación

- Crear siempre como **`post_status: draft`**. Nunca publicar automáticamente
  sin revisión humana — publicar es una acción explícita que pide el usuario
  aparte.

## 6. Routine

Cadencia: semanal. Cada ejecución:

1. Repetir pasos 0-5 para como mucho 1 libro nuevo (el más reciente sin post).
2. Si no hay libros nuevos sin post, no hacer nada (no crear contenido de
   relleno).
3. Dejar el borrador listo en WordPress, **sin imagen destacada** (paso 3 es
   manual, ver arriba).
4. El aviso de que hay un borrador nuevo lo ve el usuario al revisar el
   panel de WP o el historial de la Routine en Claude Code; no hay
   integración de notificación (email/Slack) configurada todavía.
