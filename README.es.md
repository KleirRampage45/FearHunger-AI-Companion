# Fear & Hunger AI Companion

AI Companion es un par de plugins para **Fear & Hunger v1.4.x** en RPG Maker MV. Añade un compañero configurable que puede conversar con el jugador, actuar en combate, leer contexto real del juego, recordar eventos ligados a la partida guardada y, opcionalmente, tomar acciones autónomas beta en el mapa usando un LLM local.

Versión actual: `0.8.0-beta`

Documentación en inglés: [README.md](README.md)

## Alcance del Repositorio

Este repositorio contiene solo el mod/plugin.

Incluye:

- `plugins/AI_Companion.js` - plugin principal.
- `plugins/FearHungerKB.js` - base de conocimiento curada.
- `assets/faces/` - rostros distribuibles del compañero.
- instaladores para Linux/macOS/Git Bash y Windows.
- documentación, pruebas estáticas y soporte de automatización.

No incluye:

- archivos base del juego.
- datos desencriptados del juego.
- partidas guardadas.
- logs personales de prueba.
- ejemplos privados de plugins.
- assets completos de Fear & Hunger.

## Funciones Principales

- **Compañero configurable**: nombre, apariencia, clase inicial, personalidad, trasfondo, voz/estilo, metas y reglas de comportamiento.
- **Chat dentro del juego**: pulsa `C` para abrir una escena de chat que usa contexto vivo del juego. El chat local puede mostrar frases completas aprobadas por el validador mientras continúa la generación; el texto parcial nunca se guarda.
- **Contexto fundamentado**: los prompts pueden incluir combate, estados del grupo, equipo, inventario, eventos cercanos, diálogo de NPCs, memoria de historia, KB y chunks de RAG.
- **Combate síncrono con IA**: el compañero elige acción, objetivo y extremidad usando el flujo verificado de comandos de RPG Maker. El combate async fue eliminado porque podía exponer turnos manuales del compañero mientras el LLM seguía pensando.
- **Validación de combate**: las decisiones se normalizan contra las extremidades vivas y el estado real del grupo antes de ejecutarse.
- **Memoria ligada al save**: historial de conversación, metas de historia, datos importantes, contacto con NPCs, eventos de comercio y objetos recientes.
- **Percepción del mapa**: escanea eventos para enemigos, NPCs, puertas, contenedores, trampas, peligros, botín e interactuables sin mostrar ids técnicos de RPG Maker en roleplay.
- **Capas de mundo/riesgo**: resumen de recursos, moral, peligro, mapa actual, riesgo de batalla y presión de supervivencia.
- **Autonomía beta**: heartbeat opcional con modelo local para botín, puertas, NPCs, continuación de tareas y desvíos seguros.
- **Botín seguro en segundo plano**: ciertos eventos seguros pueden ejecutarse sin bloquear al jugador, con mensajes gab/toast y globos de iconos de objetos.
- **Guardarraíles de consentimiento**: decisiones riesgosas, compras, cambios de equipo, curación/soporte y eventos sensibles pueden pedir aprobación.
- **Hybrid RAG**: recuperación vectorial opcional sobre chunks curados en `data/rag/` para lore, personajes, finales, ubicaciones y conocimiento general.
- **Visión multimodal local opcional**: las preguntas visuales explícitas pueden usar una captura segura del mapa, combate, inventario, equipo, habilidades o estado. Los perfiles visuales curados y el estado vivo resuelven entidades antes de pasar evidencia adaptada al rol; la visión nunca controla acciones de combate.
- **Localización**: modo español/inglés para UI, etiquetas del escáner, prompts y contexto de chat.
- **Visor Registro IA**: visor dentro del juego con etiquetas claras `[CHAT]`, `[COMBAT]`, `[AUTONOMY]`, `[RAG]`, `[VISION]` y `[ERROR]`.
- **Logs JSONL persistentes**: logs estructurados en `<juego>/ai_companion_logs/` para depuración y análisis de tesis.
- **Telemetría**: FPS, RAM del juego, CPU, latencia local, tokens y tokens por segundo.
- **Modo autopilot de prueba**: harness LLM-only que controla al jugador para experimentos. Sirve para investigación/testing, no como forma normal de jugar.

## Proveedores de IA

| Proveedor | Uso principal | Notas |
| --- | --- | --- |
| Servidor local compatible con OpenAI | autonomía, chat privado, experimentos | LM Studio/Ollama. Recomendado para autonomía. |
| Groq | chat/combate cloud | Respuesta rápida cuando está disponible. |
| OpenRouter | variedad de modelos | Modelos cloud gratis y pagos. |

Endpoint local ejemplo:

```text
http://127.0.0.1:1234/v1/chat/completions
```

Valores locales recomendados:

```text
temperature = 1.0
top_p = 0.95
top_k = 64
```

Si usas Hybrid RAG, también debes correr un modelo de embeddings y configurar `/v1/embeddings`; ver [docs/HYBRID_RAG_SETUP.md](docs/HYBRID_RAG_SETUP.md).

Si usas contexto visual, ejecuta un modelo local compatible con OpenAI y visión. Las llamadas de visión son solo locales y nunca usan Groq/OpenRouter.

## Instalación

Guía completa: [docs/INSTALL.md](docs/INSTALL.md)

Linux/macOS/Git Bash:

```bash
git clone https://github.com/KleirRampage45/FearHunger-AI-Companion.git
cd FearHunger-AI-Companion
chmod +x install.sh
./install.sh
```

Windows:

```bat
install.bat
```

Instalación manual:

1. Copia `plugins/FearHungerKB.js` a `<juego>/www/js/plugins/`.
2. Copia `plugins/AI_Companion.js` a `<juego>/www/js/plugins/`.
3. Copia `assets/faces/*.png` a `<juego>/www/img/faces/`.
4. Añade `FearHungerKB` y `AI_Companion` a `<juego>/www/js/plugins.js`, con `FearHungerKB` primero.

## Configuración

Abre `Compañero IA` desde el menú de título.

Secciones importantes:

- `Personaje`: nombre, apariencia, clase, personalidad, trasfondo, voz/estilo, metas y reglas.
- `Chat / Proveedor`: Groq/OpenRouter/local, modelo, endpoint, sampling, streaming local seguro, contexto visual opcional y modelo local de visión.
- `Autonomía`: heartbeat beta, radio de botín, permisos de puertas/NPCs, regreso por peligro y modelo local.
- `RAG`: endpoint de recuperación, modelo de embeddings, cantidad de chunks, threshold, spoilers e idioma.
- `Debug`: consola debug y telemetría FPS/RAM/CPU.
- `Registro IA`: visor de eventos recientes.

## Controles

| Tecla | Acción |
| --- | --- |
| `C` | Abrir chat desde mapa, combate, inventario, equipo, habilidades o estado |
| `Enter` | Confirmar UI / enviar mensaje |
| `Esc` | Cancelar / cerrar |
| `F5` | Recargar página NW.js/RPG Maker MV |

## Pruebas

Pruebas estáticas recomendadas antes de cada commit que toque plugins:

```bash
node --check plugins/AI_Companion.js
node --check plugins/FearHungerKB.js
node scripts/check_plugin_static.js
git diff --check
```

El checker estático valida sintaxis y marcadores de regresión, incluyendo:

- handler LLM neutral por proveedor.
- localización del escáner.
- inyección de metas de historia.
- overlay de notificaciones no bloqueante.
- soporte de botín en segundo plano.
- telemetría de combate.
- grounding de extremidades destruidas.
- ausencia de opciones falsas, líneas hardcodeadas conocidas y rutas inseguras eliminadas.

Guías:

- [docs/TESTING.md](docs/TESTING.md)
- [test-automation/README.md](test-automation/README.md)

## Logs de Runtime

La copia instalada del juego escribe logs aquí:

```text
<juego>/ai_companion_logs/session_*.jsonl
```

Usa el resumidor antes de abrir logs grandes:

```bash
node scripts/summarize_logs.js --last 25
node scripts/summarize_logs.js --since 120 --last 15 --errors --combat --chat
```

El visor `Registro IA` dentro del juego solo muestra eventos recientes de la sesión actual. No lee JSONL históricos.

## Mapa de Documentación

- [docs/SYSTEMS.md](docs/SYSTEMS.md) - resumen de módulos.
- [docs/INSTALL.md](docs/INSTALL.md) - instalación.
- [docs/TESTING.md](docs/TESTING.md) - pruebas manuales/estáticas/automatizadas.
- [docs/HYBRID_RAG_SETUP.md](docs/HYBRID_RAG_SETUP.md) - configuración de RAG.
- [docs/MAP_EVENT_NAMING.md](docs/MAP_EVENT_NAMING.md) - nombres curados de eventos.
- [docs/HARDCODED_LINES.md](docs/HARDCODED_LINES.md) - política contra habla hardcodeada.
- [docs/CONFIG_MENU_AUDIT.md](docs/CONFIG_MENU_AUDIT.md) - opciones de configuración y efecto real.
- [docs/REPO_HYGIENE.md](docs/REPO_HYGIENE.md) - higiene del repositorio.
- [docs/RELEASE.md](docs/RELEASE.md) - empaquetado.

## Limitaciones Conocidas

- El compañero usa el actor `15` por defecto.
- El combate usa llamadas síncronas por compatibilidad con el flujo de comandos de RPG Maker MV; puede pausar brevemente el juego.
- La autonomía es beta y depende mucho de la calidad del modelo local y del soporte de eventos.
- El botín seguro en segundo plano solo soporta patrones de eventos conocidos.
- Los mapas iniciales tienen nombres de eventos más curados que mapas tardíos.
- Hybrid RAG es conocimiento de fondo, no percepción viva. El estado real del juego siempre debe tener prioridad.
- El modo autopilot es para investigación y QA, no un autoplayer terminado.

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md).

Resumen:

1. Crea ramas desde `develop` para features/fixes.
2. Ejecuta pruebas estáticas antes de commitear.
3. No subas assets del juego, saves, logs, nombres personales de modelos locales ni buglogs privados.
4. Fusiona a `main` solo después de pruebas manuales y estáticas.

## Licencia

MIT License. Ver [LICENSE](LICENSE).

## Créditos

- **Fear & Hunger** por Miro Haverinen.
- Implementación del mod por Asukat con desarrollo asistido por IA.
- KB y RAG curados a partir de conocimiento público/player-facing y resúmenes estilo wiki.
