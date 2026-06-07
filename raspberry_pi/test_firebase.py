"""
ArcadePay — Test completo con Firebase (Windows)
==================================================
Conecta la app web real con Scratch en tu PC.

Flujo (handshake):
  1. Usuario pulsa CONECTAR en la app web
  2. Firestore cambia a "reservado" (sin cobrar crédito)
  3. Este script detecta "reservado" → confirma cambiando a "ocupado"
  4. La app web detecta "ocupado" → cobra el crédito
  5. puede_jugar = 1 → Scratch ilumina el botón JUGAR
  6. Jugador juega y termina → Scratch llama /gameover
  7. Este script actualiza Firestore → "libre"

REQUISITOS:
  pip install firebase-admin

USO:
  python test_firebase.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
import json
import threading
import sys
import os
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

MACHINE_ID = "main"
SERVER_PORT = 8765

# Buscar serviceAccountKey.json en la misma carpeta
SERVICE_ACCOUNT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "serviceAccountKey.json"
)

# ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────

_lock = threading.Lock()
_puede_jugar = False
_sesion_activa = False

def set_puede_jugar(valor):
    global _puede_jugar
    with _lock:
        _puede_jugar = valor

def get_puede_jugar():
    with _lock:
        return _puede_jugar

def set_sesion_activa(valor):
    global _sesion_activa
    with _lock:
        _sesion_activa = valor

def get_sesion_activa():
    with _lock:
        return _sesion_activa

# ─── LOG ──────────────────────────────────────────────────────────────────────

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

# ─── FIREBASE ─────────────────────────────────────────────────────────────────

def init_firebase():
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"\n❌ No se encontró serviceAccountKey.json en:")
        print(f"   {SERVICE_ACCOUNT_PATH}\n")
        print("Para obtenerlo:")
        print("  1. Ve a Firebase Console → ⚙️ Configuración del proyecto")
        print("  2. Pestaña 'Cuentas de servicio'")
        print("  3. Clic en 'Generar nueva clave privada'")
        print(f"  4. Guarda el archivo como 'serviceAccountKey.json' en:")
        print(f"     {os.path.dirname(os.path.abspath(__file__))}")
        sys.exit(1)

    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    log("✅ Conectado a Firebase Firestore")
    return db

def release_machine(db):
    db.collection("arcade_machine").document(MACHINE_ID).update({
        "estado": "libre",
        "usuario_activo_ref": None,
        "inicio_sesion": None,
        "ultima_actualizacion": firestore.SERVER_TIMESTAMP,
    })
    set_puede_jugar(False)
    log("🟢 Máquina liberada → estado: libre")
    log("   En la app web debería aparecer como disponible\n")

# ─── SERVIDOR HTTP (Scratch ↔ Python) ─────────────────────────────────────────

gameover_event = threading.Event()

class ArcadeHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/estado":
            valor = 1 if get_puede_jugar() else 0
            body = json.dumps({"puede_jugar": valor}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

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
        pass

def start_http_server():
    server = HTTPServer(("localhost", SERVER_PORT), ArcadeHandler)
    server.serve_forever()

# ─── SESIÓN DE JUEGO ──────────────────────────────────────────────────────────

SESSION_TIMEOUT = 300  # 5 minutos

def confirm_and_run_session(db):
    """Confirma la reserva y gestiona la sesión."""
    gameover_event.clear()
    set_sesion_activa(True)

    # Paso 1: Confirmar la reserva → cambiar a "ocupado"
    # Esto le dice a la app web que puede cobrar el crédito
    try:
        log("🔄 Confirmando reserva → estado: ocupado")
        db.collection("arcade_machine").document(MACHINE_ID).update({
            "estado": "ocupado",
            "ultima_actualizacion": firestore.SERVER_TIMESTAMP,
        })
        log("✅ Reserva confirmada — la app web cobrará el crédito")
    except Exception as e:
        log(f"❌ Error al confirmar: {e}")
        set_sesion_activa(False)
        return

    # Paso 2: Activar puede_jugar para Scratch
    set_puede_jugar(True)
    log("🎮 puede_jugar = 1 — el botón JUGAR se iluminará")
    log(f"⏳ Esperando fin de juego (timeout: {SESSION_TIMEOUT}s)...\n")

    # Paso 3: Esperar game over o timeout
    notified = gameover_event.wait(timeout=SESSION_TIMEOUT)

    if notified:
        log("✅ Juego terminado — notificado por Scratch")
    else:
        log("⏰ Timeout de sesión — liberando máquina")

    try:
        release_machine(db)
    except Exception as e:
        log(f"❌ Error al liberar: {e}")
    finally:
        set_sesion_activa(False)

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 54)
    print("   ArcadePay — Test Firebase + Scratch (Windows)")
    print("=" * 54)
    print()

    db = init_firebase()

    # Iniciar servidor HTTP
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()
    log(f"🌐 Servidor HTTP en localhost:{SERVER_PORT}")
    log("   GET /estado   → Scratch consulta si puede jugar")
    log("   GET /gameover → Scratch notifica fin de juego\n")

    # Listener de Firestore en tiempo real
    machine_ref = db.collection("arcade_machine").document(MACHINE_ID)

    def on_snapshot(doc_snapshot, changes, read_time):
        for doc in doc_snapshot:
            data = doc.to_dict()
            estado = data.get("estado")
            log(f"📡 Firestore → estado: {estado}")

            if estado == "reservado" and not get_sesion_activa():
                t = threading.Thread(target=confirm_and_run_session, args=(db,), daemon=True)
                t.start()

    log("👂 Escuchando cambios en Firestore...\n")
    log("INSTRUCCIONES:")
    log("  1. Abre tu juego en Turbowarp (bandera verde)")
    log("  2. Abre la app web (npm run dev) y pulsa CONECTAR")
    log("  3. El botón JUGAR en Scratch debería iluminarse")
    log("  4. Juega y al terminar, la máquina se libera sola\n")

    watcher = machine_ref.on_snapshot(on_snapshot)

    try:
        while True:
            input()  # mantener el script corriendo
    except KeyboardInterrupt:
        log("\n⛔ Servidor detenido")
        watcher.unsubscribe()
        sys.exit(0)

if __name__ == "__main__":
    main()
