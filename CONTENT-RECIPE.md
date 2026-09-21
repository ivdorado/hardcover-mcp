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

## 3. Imagen de cabecera — automatizada vía Cloudflare Workers AI (2026-09-21)

`mwai_image` (AI Engine) se descartó tras agotar las vías razonables:
"Unsupported query type" sin entorno de imagen; luego un modelo de OpenAI
obsoleto tras cambiar a Google; luego `limit: 0` en el tier gratuito para
dos modelos distintos de Gemini (restricción geográfica UE/EEE, no
configurable desde el plugin).

**Solución actual**: [cloudflare-image.js](cloudflare-image.js) en la raíz
del repo, que llama directamente a Cloudflare Workers AI (modelo
`@cf/leonardo/lucid-origin`, elegido porque acepta JSON simple —no
multipart como `flux-2-dev`—, soporta `width`/`height` nativos hasta 2500px
para pedir 16:9 real, y con `guidance: 7` responde bien a instrucciones
explícitas de "sin texto/sin logos" sin alucinar letras falsas, a
diferencia de `flux-1-schnell`).

```bash
node cloudflare-image.js "<prompt en inglés>" salida.png 1600 900
```

Requiere `CLOUDFLARE_API_TOKEN` (con permiso **Workers AI: Edit**) y
`CLOUDFLARE_ACCOUNT_ID` en el entorno — están en `.env` (gitignored).

Pasos:

1. Construir un prompt en inglés que:
   - describa un motivo **sugerente** del tema del libro, nunca literal ni
     la portada,
   - pida explícitamente paleta pastel y formato panorámico,
   - incluya salvaguardas anti-texto: "no text, no letters, no words, no
     logos, no branding" (los modelos de imagen tienden a alucinar
     texto/logos en objetos como aviones, coches, edificios — cuanto más
     explícito el prompt, menos ocurre).
2. Ejecutar `cloudflare-image.js` con `width=1600 height=900` (16:9).
3. Revisar la imagen generada (leerla con la herramienta de lectura) antes
   de subirla — si tiene artefactos claros (texto ilegible, anatomía rota,
   etc.), regenerar con el prompt ajustado en vez de subirla tal cual.
4. Subir a WordPress: `wp_upload_request` (o `wp_upload_media` si el
   archivo es pequeño) + `wp_set_featured_image`.

Fallback si Cloudflare falla (cuota, error de red, etc.): subir la portada
oficial del libro en alta resolución (buscar en PlanetadeLibros/Casa del
Libro, no el thumbnail de Hardcover) como placeholder, y avisar en el
resumen de que conviene sustituirla a mano.

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

## 6. Automatización

Implementado como **tarea programada local** de la app de escritorio de
Claude Code (`hardcover-blog-post`, cron `0 9 * * 1`, todos los lunes),
**no** como Routine en la nube (CCR).

Motivo: las Routines en la nube solo pueden conectarse a MCP servers que
sean conectores remotos de claude.ai (OAuth); el servidor `hardcover-mcp`
está registrado en local (`claude mcp add -s local`, proceso stdio en esta
máquina) y por tanto es invisible para una Routine en la nube. Una tarea
programada local, en cambio, se ejecuta como una sesión normal de Claude
Code en este proyecto, así que sí tiene acceso tanto al MCP `hardcover`
como al conector remoto "AI Engine Wordpress".

Limitación a tener en cuenta: la tarea solo se dispara si la app de
escritorio está abierta en ese momento (si está cerrada, se ejecuta al
siguiente arranque) — no es un cron de servidor 24/7.

Cada ejecución:

1. Repite pasos 0-5 para como mucho 1 libro nuevo (el más reciente sin
   post), probando con el siguiente más reciente si el primero ya tiene
   post.
2. Si todos los libros recientes ya tienen post, no hace nada.
3. Deja el borrador listo en WordPress, **con imagen destacada generada
   automáticamente** (ver sección 3).
4. Notifica al usuario al terminar (vía `notifyOnCompletion`); el prompt
   completo vive en
   `C:\Users\ivd\.claude\scheduled-tasks\hardcover-blog-post\SKILL.md`.

Alternativa considerada y descartada por ahora: desplegar `hardcover-mcp`
como servidor HTTP remoto (ej. en Vercel) y registrarlo como conector de
claude.ai, lo que sí permitiría usar una Routine en la nube. Revisar si en
el futuro interesa migrar a eso (más robusto, no depende de tener la app
abierta).
