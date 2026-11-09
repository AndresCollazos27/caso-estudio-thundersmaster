# Utilidad del proceso en el caso Tomatera

## Definición y relación con el objetivo de investigación

El objetivo específico 4 de la monografía es evaluar la utilidad del proceso adaptado para construir entendimiento compartido en un equipo que desarrolla un producto de software orientado al contexto agrícola.

En este estudio, **utilidad** significa la contribución de THUNDERS Master a construir entendimiento compartido sobre el problema, el vocabulario y los requisitos críticos. Se evalúa mediante la percepción de los participantes y los resultados observables del ciclo: diferencias de interpretación detectadas y resueltas, acuerdos documentados y evidencias E1–E5, incluida la prueba de traspaso. Una percepción favorable se contrasta con artefactos y registros; por sí sola no demuestra que se logró el entendimiento compartido.

Esto concreta para el caso la utilidad percibida que la monografía toma de Davis y mantiene la triangulación ya prevista en su plan GQM. La claridad de los pasos y la carga de trabajo son dimensiones complementarias; no se usan como sustitutos de utilidad.

## Preguntas e instrumentos

La encuesta conserva las cinco afirmaciones originales de UniReserva y las seis dimensiones de NASA-TLX, con sus escalas y extremos. Añade un bloque de utilidad con cinco afirmaciones de 1 (nada de acuerdo) a 5 (totalmente de acuerdo), en el orden del ciclo:

| Identificador | Afirmación | Evidencia relacionada |
| --- | --- | --- |
| `problema` | El proceso me ayudó a comprender qué problema necesitábamos resolver. | E1: reformulaciones equivalentes del problema. |
| `terminos` | El proceso nos ayudó a acordar el significado de los términos importantes. | E2: términos críticos acordados y comprobados entre perfiles. |
| `diferencias` | El proceso nos ayudó a resolver diferencias de interpretación. | E4: divergencias críticas resueltas, documentadas y confirmadas. |
| `requisitos` | Al finalizar, entendíamos de la misma manera los requisitos críticos. | E3: ejemplos y criterios aceptados; E5: reconstrucción por otra mesa. |
| `general` | En general, el proceso fue útil para que mi mesa llegara a entender lo mismo sobre los requisitos. | La definición de utilidad del caso, en una sola afirmación. |

La pregunta abierta opcional pide un ejemplo de la parte del proceso que más ayudó a alcanzar acuerdos, o indicar si no ayudó. Se conserva también «¿Qué sobró y qué faltó?». El nuevo bloque sirve al objetivo del caso y no se presenta como una escala psicométrica validada.

## Análisis e interpretación

Se describen las distribuciones de respuestas por ítem y se contrastan con las divergencias documentadas, su resolución, las evidencias de cada mesa y el resultado del traspaso. Las preguntas abiertas se incorporan al análisis temático. Las cinco afirmaciones originales se mantienen separadas para conservar su comparación con UniReserva. NASA-TLX informa carga percibida.

La regla de cierre existente exige E1–E5 en «Sí», respaldadas por artefactos. Un «Pendiente» conserva su significado y una divergencia crítica abierta no se convierte en acuerdo por tener responsable. No se introduce un umbral de encuesta, una puntuación global de utilidad ni un porcentaje nuevo de éxito. Las lecturas automáticas orientan la revisión; una E4 en «Sí» por ausencia de divergencias registradas no demuestra por sí sola que se detectaron todas.

La medición individual previa y posterior mantiene las cuatro preguntas abiertas y la codificación independiente por dos autores ya prevista. Se compara por mesa y pregunta la proporción de integrantes en la categoría más frecuente. Una coincidencia de respuestas puede corresponder a una interpretación equivocada compartida: debe revisarse junto con la clave y los artefactos. La triangulación fundamenta la valoración de utilidad en este caso, sin atribuir causalidad ni generalizar a todas las situaciones de uso.

## Protocolo de consulta y escalas

Las nuevas sesiones guardan `protocolo: { version: 2, cartaEnPrevia: true }` en su copia de contenido. Durante la medición previa cada participante puede consultar exclusivamente su carta u hoja de rol. En la posterior responde sin consultarla. Glosario, ficha técnica y respuestas ajenas permanecen ocultos en ambas mediciones. «No lo sé» es una respuesta válida si no dispone de información suficiente; la aplicación no muestra soluciones ni indica qué pregunta debería poder responder cada rol.

Las condiciones de consulta difieren entre fases. El cambio previo/posterior no separa el efecto de esa diferencia del aprendizaje durante la sesión y se interpreta como evidencia complementaria. Las sesiones antiguas, sin este protocolo, conservan la ocultación de ayudas en ambas mediciones; no deben mezclarse sin identificar la versión de contenido.

Las seis barras de NASA-TLX empiezan **sin respuesta**: la barra se ve en el centro, apagada y con el rótulo «Sin responder», y cada una exige un toque o un arrastre antes de pasar al paso siguiente. Al soltar el dedo queda el valor de ese punto, aunque no se haya movido, y el 0 es una respuesta válida. Así cada valor enviado es una marca deliberada, como en la versión en papel; un valor inicial que se envía sin tocarlo no se distinguiría de una respuesta pensada. La versión del protocolo y el contenido viajan en la exportación para identificar el instrumento utilizado, y `medicion.csv` trae la columna `con_carta` («Sí» solo en la previa de la versión 2).

## Integración con la monografía

La monografía actual está en `../../Monografia Latex/main.tex`, fuera de este repositorio. Al integrar este texto deben actualizarse de forma coherente:

1. El apartado «Utilidad y facilidad de uso percibidas»: precisar utilidad en relación con el entendimiento compartido.
2. El plan GQM y el objetivo y preguntas del caso: mantener la triangulación entre encuesta y evidencias, sin añadir umbrales.
3. Las fuentes, instrumentos y análisis del caso y su anexo: incorporar el bloque de utilidad y conservar los instrumentos originales.
4. El protocolo de medición: sustituir la afirmación de que la carta está oculta en ambos momentos por consulta solo previa en la versión 2.
5. Las amenazas a la validez: condiciones de consulta distintas, valores iniciales de NASA-TLX y alcance descriptivo del caso.

El diseño aprobado `../2026-11-02-caso-tomatera-diseno.md` debe reflejar las mismas precisiones. Este documento prepara la integración; no afirma que la monografía externa ya haya sido modificada ni anticipa resultados de una sesión pendiente.
