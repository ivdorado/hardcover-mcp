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

**Cuota gratuita**: 10.000 "neurons"/día en el plan free de Workers AI.
Sobra de sobra para 1 imagen/semana, pero se agota rápido si se prueban
muchas variaciones seguidas en una sesión (error `code: 4006`,
"you have used up your daily free allocation"). Si ocurre durante
desarrollo/pruebas, esperar al reset diario o usar el fallback de portada.

### Fórmula del prompt (2026-09-21): motivo variable + andamiaje fijo de calidad

Un primer intento (un avión suelto sobre fondo liso) quedó "desangelado".
La lección: **la calidad/riqueza visual del resultado no debe depender del
libro** — solo el motivo cambia de un post a otro; el nivel de detalle,
atmósfera y profundidad debe ser siempre el mismo listón alto. Por eso el
prompt se construye en dos partes que **siempre** van juntas:

**1. Motivo variable** (cambia en cada post): 2-3 frases que describan una
escena **sugerente** del tema/atmósfera central del libro — nunca literal,
nunca la portada, nunca texto del libro. Ejemplos:
- Duplicación/identidad (*La anomalía*): dos aviones idénticos cruzándose,
  uno sólido y otro fantasma.
- Un libro sobre el paso del tiempo: un reloj de arena disolviéndose en
  partículas que se convierten en pájaros.
- Un libro sobre una guerra/conflicto histórico: un campo en calma con
  siluetas de pájaros formando una V, sin ninguna imaginería bélica gráfica.

**2. Andamiaje fijo de calidad** (se añade siempre, palabra por palabra o
muy similar, detrás del motivo variable):

```
Rich atmospheric scene with strong visual depth and layered detail —
foreground, midground and background elements, not a flat empty
background. Dramatic natural lighting (soft glow, gentle haze, subtle
gradient shifts across the frame). Soft pastel-leaning color palette.
Painterly editorial-illustration richness with fine texture, like a
literary magazine cover, not a bare vector icon on a plain backdrop.
No text, no letters, no words, no numbers, no logos, no branding, no
signage of any kind anywhere in the image — leave any human-made object
completely unmarked and plain.
```

Pasos:

1. Escribir el motivo variable para el libro en cuestión.
2. Concatenarlo con el andamiaje fijo de arriba (motivo primero, andamiaje
   después) para formar el prompt final en inglés.
3. Ejecutar `cloudflare-image.js` con `width=1600 height=900` (16:9).
4. Revisar la imagen generada (leerla con la herramienta de lectura) antes
   de subirla. Fallos conocidos y qué hacer:
   - **Texto/logo falso alucinado** (ocurre sobre todo en aviones, coches,
     edificios, ropa): regenerar una vez reforzando aún más la instrucción
     anti-texto en el motivo variable (ej. "completely blank fuselage,
     no visible markings of any kind").
   - **Artefacto de costura/banda vertical u horizontal** en el cielo o
     fondo: regenerar (a veces basta cambiar ligeramente la redacción del
     motivo para que el modelo re-muestree la composición).
   - Si tras 2 intentos sigue habiendo artefactos claros, usar el mejor de
     los dos en vez de seguir gastando llamadas.
5. Subir a WordPress: `wp_upload_request` (o `wp_upload_media` si el
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
