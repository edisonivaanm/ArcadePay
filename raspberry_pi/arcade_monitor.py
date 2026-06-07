"""
ArcadePay — Raspberry Pi Monitor Script v3.1
============================================
Flujo "Player-controlled START" (como máquina arcade real):

  PANTALLA DE TÍTULO
  "PULSA START" → apagado/gris

  Jugador presiona START → no pasa nada (no ha pagado)

  Usuario paga en ArcadePay
  Firestore: estado → "ocupada"
  Python detecta → activa puede_jugar

  Scratch hace polling a /estado → detecta puede_jugar = 1
  "PULSA START" → parpadea/se ilumina

  Jugador decide cuándo presionar START → juego inicia

  Game over → Scratch llama GET /gameover
  Python → Firestore: estado → "libre"
  Scratch vuelve a pantalla de título

COMUNICACIÓN Python ↔ Scratch (via Turbowarp Fetch extension):
  Scratch pregunta cada segundo → GET /estado → {"puede_jugar": 0 o 1}
  Scratch avisa fin de juego   → GET /gameover

INSTALACIÓN:
  sudo apt install xdotool -y
  pip3 install firebase-admin
"""

import firebase_admin
from firebase_admin import credentials, firestore
import subprocess
import threading
import sys
import os
import time
import json
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

# ─── CONFIGURACIÓN — EDITA ESTAS VARIABLES ────────────────────────────────────

# Comando para abrir Turbowarp con tu juego en pantalla completa
# --fullscreen hace dos cosas:
#   1. Abre en pantalla completa (sin barras ni menús)
#   2. Ejecuta la bandera verde automáticamente (como modo presentación)
# Reemplaza "tu_juego.sb3" con el nombre real de tu archivo
SCRATCH_LAUNCH_CMD = "/home/pi/TurboWarp-linux-arm64.AppImage --fullscreen /home/pi/arcadepay/tu_juego.sb3"

# Nombre del proceso para verificar si Turbowarp está corriendo
SCRATCH_PROCESS_NAME = "turbowarp"

# ID del documento de la máquina arcade en Firestore
MACHINE_ID = "main"

# Puerto del servidor HTTP local (Python ↔ Scratch)
SERVER_PORT = 8765

# Tiempo máximo de sesión en segundos (fallback si Scratch no notifica game over)
# Ajusta este valor al tiempo que dura tu juego normalmente
SESSION_TIMEOUT_SECS = 300   # 5 minutos

# Ruta al archivo de Service Account de Firebase
SERVICE_ACCOUNT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "serviceAccountKey.json"
)

# ─── ESTADO GLOBAL (compartido entre hilos) ───────────────────────────────────

_lock          = threading.Lock()
_puede_jugar   = False   # True cuando el usuario ha pagado y puede iniciar
_sesion_activa = False   # True cuando el juego está en curso

def set_puede_jugar(valor: bool):
    global _puede_jugar
    with _lock:
        _puede_jugar = valor

def get_puede_jugar() -> bool:
    with _lock:
        return _puede_jugar

def set_sesion_activa(valor: bool):
    global _sesion_activa
    with _lock:
        _sesion_activa = valor

def get_sesion_activa() -> bool:
    with _lock:
        return _sesion_activa

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

def is_scratch_running() -> bool:
    try:
        result = subprocess.run(
            ["pgrep", "-f", SCRATCH_PROCESS_NAME],
            capture_output=True, text=True
        )
        return result.returncode == 0
    except Exception:
        return False

def launch_scratch():
    """Lanza Turbowarp en pantalla completa. La bandera verde se ejecuta sola."""
    log(f"🚀 Iniciando Turbowarp (fullscreen): {SCRATCH_LAUNCH_CMD}")
    try:
        subprocess.Popen(
            SCRATCH_LAUNCH_CMD.split(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(6)   # esperar a que abra y ejecute la bandera verde
        log("🎮 Turbowarp abierto en pantalla completa")
        log("   🏁 Bandera verde ejecutada automáticamente")
        log("   📺 Pantalla de título visible — esperando jugadores...")
    except FileNotFoundError:
        log(f"❌ Comando no encontrado: {SCRATCH_LAUNCH_CMD}")
        log("   Revisa SCRATCH_LAUNCH_CMD en este script")

# ─── FIREBASE ─────────────────────────────────────────────────────────────────

def init_firebase():
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        log(f"❌ No se encontró serviceAccountKey.json en:\n   {SERVICE_ACCOUNT_PATH}")
        log("\nPasos para obtenerlo:")
        log("  1. Firebase Console → ⚙️ Configuración del proyecto")
        log("  2. Pestaña 'Cuentas de servicio'")
        log("  3. Clic en 'Generar nueva clave privada'")
        log("  4. Guardar el JSON como 'serviceAccountKey.json' junto a este script")
        sys.exit(1)

    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    log("✅ Conectado a Firebase Firestore")
    return db

def release_machine(db):
    """Actualiza Firestore a estado libre y desactiva puede_jugar."""
    db.collection("arcade_machine").document(MACHINE_ID).update({
        "estado": "libre",
        "usuario_activo_ref": None,
        "inicio_sesion": None,
        "ultima_actualizacion": firestore.SERVER_TIMESTAMP,
    })
    set_puede_jugar(False)
    log("🟢 Máquina liberada → estado: libre")

# ─── SERVIDOR HTTP (Python ↔ Scratch) ─────────────────────────────────────────
#
# Scratch (Turbowarp Fetch extension) hace polling a estos endpoints:
#
#   GET /estado    → {"puede_jugar": 0}  o  {"puede_jugar": 1}
#                    Scratch usa este valor para mostrar u ocultar el START
#
#   GET /gameover  → Scratch notifica que el juego terminó
#                    Python libera la máquina en Firestore

gameover_event = threading.Event()

class ArcadeHandler(BaseHTTPRequestHandler):

    def do_GET(self):

        # ── /estado — Scratch pregunta si puede jugar ──────────────────────
        if self.path == "/estado":
            valor = 1 if get_puede_jugar() else 0
            body = json.dumps({"puede_jugar": valor}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        # ── /gameover — Scratch notifica fin de juego ───────────────────────
        elif self.path == "/gameover":
            log("📨 Scratch notificó: GAME OVER")
            gameover_event.set()
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"OK")

        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass   # silenciar logs del servidor HTTP

def start_http_server():
    server = HTTPServer(("localhost", SERVER_PORT), ArcadeHandler)
    log(f"🌐 Servidor HTTP escuchando en localhost:{SERVER_PORT}")
    log(f"   GET /estado   → Scratch consulta si puede iniciar")
    log(f"   GET /gameover → Scratch notifica fin de juego")
    server.serve_forever()

# ─── GESTIÓN DE SESIÓN ────────────────────────────────────────────────────────

def confirm_and_run_session(db):
    """
    Gestiona una sesión de juego completa con handshake:
    1. Confirma la reserva (reservado → ocupado) → la app cobra el crédito
    2. Activa puede_jugar → Scratch muestra "PULSA START" iluminado
    3. El JUGADOR decide cuándo presionar START
    4. Espera a que Scratch notifique game over (o timeout)
    5. Libera la máquina en Firestore
    """
    gameover_event.clear()
    set_sesion_activa(True)

    # Paso 1: Confirmar la reserva
    try:
        log("🔄 Confirmando reserva → estado: ocupado")
        db.collection("arcade_machine").document(MACHINE_ID).update({
            "estado": "ocupado",
            "ultima_actualizacion": firestore.SERVER_TIMESTAMP,
        })
        log("✅ Reserva confirmada — la app web cobrará el crédito")
    except Exception as e:
        log(f"❌ Error al confirmar reserva: {e}")
        set_sesion_activa(False)
        return

    # Paso 2: Activar puede_jugar para Scratch
    set_puede_jugar(True)
    log("🎮 puede_jugar = 1 — Scratch mostrará 'PULSA START' iluminado")
    log(f"⏳ Esperando que el jugador inicie y termine (timeout: {SESSION_TIMEOUT_SECS}s)...")

    # Paso 3: Esperar game over o timeout
    notified = gameover_event.wait(timeout=SESSION_TIMEOUT_SECS)

    if notified:
        log("✅ Juego terminado — notificado por Scratch")
    else:
        log(f"⏰ Timeout de sesión ({SESSION_TIMEOUT_SECS}s) — liberando máquina")

    try:
        release_machine(db)
    except Exception as e:
        log(f"❌ Error al liberar máquina: {e}")
    finally:
        set_sesion_activa(False)

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 54)
    print("   ArcadePay — Monitor Always-On v3.1")
    print("=" * 54)

    db = init_firebase()

    # Iniciar servidor HTTP en hilo aparte
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    # Lanzar Turbowarp si no está corriendo
    if not is_scratch_running():
        launch_scratch()
    else:
        log("🎮 Turbowarp ya está corriendo")

    machine_ref = db.collection("arcade_machine").document(MACHINE_ID)

    log("👂 Escuchando Firestore en tiempo real...\n")

    # ── Listener de Firestore ──────────────────────────────────────────────────
    def on_snapshot(doc_snapshot, changes, read_time):
        for doc in doc_snapshot:
            data  = doc.to_dict()
            estado = data.get("estado")
            log(f"📡 Firestore → estado: {estado}")

            if estado == "reservado" and not get_sesion_activa():
                # Lanzar la sesión en un hilo para no bloquear el listener
                t = threading.Thread(target=confirm_and_run_session, args=(db,), daemon=True)
                t.start()

    watcher = machine_ref.on_snapshot(on_snapshot)

    # ── Watchdog: relanza Turbowarp si se cierra accidentalmente ──────────────
    try:
        while True:
            time.sleep(10)
            if not is_scratch_running():
                log("⚠️  Turbowarp se cerró — reiniciando...")
                set_puede_jugar(False)
                launch_scratch()
    except KeyboardInterrupt:
        log("\n⛔ Monitor detenido (Ctrl+C)")
        watcher.unsubscribe()
        sys.exit(0)


if __name__ == "__main__":
    main()
