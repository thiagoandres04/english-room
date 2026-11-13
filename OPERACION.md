# Operación de English Room

## Antes de compartir

1. Preparar y revisar el examen. La IA de corrección está desactivada por defecto.
2. Elegir el tiempo para terminar: de 1 a 480 minutos, o dejarlo vacío para no limitarlo.
3. Guardar y compartir el enlace del alumno. El reloj individual comienza al presionar Comenzar.

El inicio, vencimiento y respuestas guardadas de los exámenes con reloj se registran en el servidor. Recargar no reinicia el plazo. Las respuestas se sincronizan al escribir y cada 15 segundos. Mantener la conexión es necesario para confirmar el guardado; al vencer se toman las respuestas confirmadas antes del límite, incluyendo espacios en blanco. La página intenta entregarlas automáticamente; los intentos vencidos con pestaña cerrada se consolidan al consultar los entregados o resultados, o al cerrar el examen. No se permite extender el tiempo cambiando el reloj del dispositivo.

El alumno usa un acceso personal guardado en su navegador. No es una identidad verificada ni un límite de un intento por alumno: un nuevo navegador puede iniciar un intento nuevo. No hay cuentas ni padrón de alumnos en esta versión.

## Cerrar y devolver

En Mis exámenes → Ver resultados se pueden cerrar las entregas. El cierre bloquea nuevos intentos y nuevas entregas, también de alumnos que todavía están trabajando. Se conservan los exámenes ya recibidos.

Guardar la corrección no la publica. Tras cerrar el examen, publicar la devolución de cada entrega. El alumno consulta su enlace personal desde el comprobante; para entregas antiguas o para compartirlo de nuevo, la profesora genera un enlace personal. Generar otro enlace reemplaza el enlace compartido anterior, sin invalidar el acceso original del alumno.

Publicar guarda una copia de la nota, devolución y respuestas. Editar la corrección privada no cambia esa copia hasta presionar Actualizar publicación. Retirar publicación oculta la devolución. Reabrir el examen retira todas sus publicaciones.

## Exportaciones y respaldo

Mis exámenes ofrece CSV compatible con Excel y un respaldo ZIP por cuenta. Los resultados de un examen ofrecen CSV, vista imprimible para guardar como PDF y ZIP de ese examen. Los datos se limitan a la cuenta docente autenticada.

El ZIP incluye english-room.json, LEEME.txt y los audios adjuntos a los exámenes exportados. Incluye ejercicios extraídos, entregas recibidas, correcciones y una copia de las devoluciones publicadas. No incluye cuentas, contraseñas, sesiones, claves de acceso de alumnos, borradores, intentos en curso ni PDF originales (no se almacenan como tales). Conservar los originales por separado. Esta copia docente no sustituye un respaldo administrativo de toda la infraestructura o del código fuente.

Descargar el ZIP después de preparar los exámenes y al finalizar cada período de corrección. Guardarlo en una carpeta privada y una segunda ubicación controlada por el colegio. La descarga es a pedido: no hay un respaldo programado automático.

Para recuperar datos, usar Restaurar respaldo, revisar el resumen y confirmar Restaurar como copias. Se validan el formato y los audios antes de insertar los exámenes y entregas en una transacción. Se crean identificadores nuevos; no se reemplaza ni borra material existente. Las copias quedan cerradas, con IA apagada y devoluciones sin publicar. Los enlaces originales no se restauran. Volver a cargar el mismo respaldo en una cuenta no duplica los exámenes ya importados.

Límites por ZIP: 100 exámenes, 300 entregas, 200 MB de archivo y 16 MB de datos JSON. Si la cuenta supera un límite, exportar por examen. Para guardar PDF de las entregas, abrir la vista imprimible y elegir Guardar como PDF en la impresión del navegador.

## Verificación

`pnpm test` ejecuta pruebas con datos sintéticos de PDF, writing, audio, búsquedas, bancos de palabras y validación de IA simulada. No consume la API. `pnpm check` verifica TypeScript y `pnpm build` compila la aplicación.

Este repositorio público no incluye archivos originales, credenciales ni fixtures privados de las pruebas de integración del colegio. Quedan pendientes la prueba piloto con docentes y alumnos y la validación de los formatos reales de cada institución.
