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

## Eliminar exámenes antiguos

En Mis exámenes se puede buscar por título, filtrar por año de creación y elegir Eliminar en cada examen propio. La confirmación consulta el número actual de entregas, correcciones y devoluciones publicadas, y advierte si hay intentos en curso.

Solo se permite eliminar exámenes cerrados. Si siguen abiertos, el diálogo ofrece Cerrar entregas y revisar. Antes de confirmar se puede descargar un respaldo ZIP. Hay que escribir ELIMINAR y confirmar expresamente la eliminación definitiva.

Se eliminan en una transacción el examen, sus entregas, correcciones, publicaciones, accesos personales e intentos guardados. Los enlaces anteriores dejan de funcionar. Se comprueban la propiedad del docente y la cantidad de entregas mostrada; si cambió, se pide actualizar la confirmación. Los archivos de audio se conservan para no afectar otros exámenes o borradores que los reutilicen. No hay papelera: para recuperar datos hace falta un respaldo previo.

## Exportaciones y respaldo

Mis exámenes ofrece CSV compatible con Excel y un respaldo ZIP por cuenta. Los resultados de un examen ofrecen CSV, vista imprimible para guardar como PDF y ZIP de ese examen. Los datos se limitan a la cuenta docente autenticada.

El ZIP incluye english-room.json, LEEME.txt y los audios adjuntos a los exámenes exportados. Incluye ejercicios extraídos, entregas recibidas, correcciones y una copia de las devoluciones publicadas. No incluye cuentas, contraseñas, sesiones, claves de acceso de alumnos, borradores, intentos en curso ni PDF originales (no se almacenan como tales). Conservar los originales por separado. Esta copia docente no sustituye un respaldo administrativo de toda la infraestructura o del código fuente.

Descargar el ZIP después de preparar los exámenes y al finalizar cada período de corrección. Guardarlo en una carpeta privada y una segunda ubicación controlada por el colegio. La descarga es a pedido: no hay un respaldo programado automático.

Para recuperar datos, usar Restaurar respaldo, revisar el resumen y confirmar Restaurar como copias. Se validan el formato y los audios antes de insertar los exámenes y entregas en una transacción. Se crean identificadores nuevos; no se reemplaza ni borra material existente. Las copias quedan cerradas, con IA apagada y devoluciones sin publicar. Los enlaces originales no se restauran. Volver a cargar el mismo respaldo en una cuenta no duplica los exámenes ya importados.

Límites por ZIP: 100 exámenes, 300 entregas, 200 MB de archivo y 16 MB de datos JSON. Si la cuenta supera un límite, exportar por examen. Para guardar PDF de las entregas, abrir la vista imprimible y elegir Guardar como PDF en la impresión del navegador.

## Verificación

scripts/check-release-backup-timing.mjs ejecuta pruebas locales con cuentas ficticias: privacidad por cuenta, apertura/cierre, publicaciones con copia estable y enlaces revocables, CSV que neutraliza fórmulas, HTML escapado, ZIP con audio, restauración sin reemplazo, tiempo individual persistente y vencimiento real con respuestas parciales. No llama a la IA ni usa la base de producción.

## Encabezados de los PDF

Al subir un PDF, se quita automáticamente el bloque inicial de datos del alumno (nombre, curso/grupo, fecha y nota), junto con el título de portada que lo acompaña. La detección requiere varios campos y se detiene al comenzar los ejercicios; conserva los puntajes de cada actividad. Funciona localmente sin IA. Revisá el texto y la vista del alumno antes de compartir. El PDF original se conserva como referencia visual y no se modifica. Los exámenes ya guardados mantienen su contenido; para aplicar esta limpieza a uno anterior, volvé a cargar el PDF y guardá una nueva versión.

## Presentación de consignas y números

Las vistas de Texto para marcar y del alumno destacan las consignas detectadas y los títulos de sección con espacio antes y después. Los ítems numerados sin separador muestran `1)`, `2)`, etc.; se respeta la puntuación existente. Es un cambio visual que también se aplica a los exámenes guardados: el texto, los identificadores de respuestas y las posiciones de los recortes se conservan. El PDF original y el editor de texto sin formato siguen mostrando la fuente. No consume IA. Revisá el formato de consignas inusuales en la vista previa.

## Guía para profesores

La ayuda está en `/ayuda` y se abre desde “Ayuda para profesores” en el menú docente o en el acceso. Se abre en otra pestaña para conservar la sesión de trabajo y el borrador. Es pública para que también puedan consultarla quienes todavía no activaron su invitación. Incluye seis pasos, nueve capturas con datos ficticios, imágenes ampliables y preguntas frecuentes. No usa IA ni muestra datos reales. Las capturas están en `public/guide/`; al cambiar las pantallas, actualizá las capturas y las instrucciones correspondientes.

## Audios por ejercicio

Cada audio permite elegir una o varias consignas desde “Asignar a ejercicios”. La vista del alumno y la vista previa ubican el reproductor antes de cada consigna seleccionada. Sin asignación, el audio permanece al inicio, como en los exámenes anteriores. Para un examen guardado: Mis exámenes → Ver resultados → Listening del examen → Asignar a ejercicios → Guardar audios. Se mantiene el mismo enlace. Si no se reconocen consignas, se ofrecen ubicaciones junto a las respuestas.

Las asignaciones usan identificadores de consigna, independientes de los recortes y de las soluciones docentes. Se validan al guardar y se conservan en el ZIP y la restauración. Si se modifica una consigna asignada, hay que volver a elegirla o dejar el audio al inicio. Esto no utiliza IA.

## Reconocimiento de opciones en varios renglones

El detector agrupa el enunciado y las opciones A/B/C aunque ocupen varios renglones, manteniendo las continuaciones como parte de su opción. Respeta los límites de pregunta, los títulos de sección y los puntajes. También admite continuaciones de una frase incompleta al pasar de página. No necesita IA.

Para un borrador cargado antes de la mejora, volvé a ejecutar “Reconocer ejercicios”. Se conservan los identificadores, las selecciones docentes que siguen siendo válidas y los recortes manuales. Las opciones que antes estaban incompletas se reemplazan por su texto completo. Revisá la solución de cada selección antes de compartir. Esta operación prepara el borrador; no modifica entregas ni exámenes publicados.
