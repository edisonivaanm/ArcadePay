"""
ArcadePay — Servidor de prueba para Windows
=============================================
Simula el servidor HTTP de arcade_monitor.py para que puedas
probar la integración de Scratch sin necesitar la Raspberry Pi.

USO:
  1. Abre una terminal y ejecuta: python test_server.py
  2. Abre tu juego en Turbowarp en la misma PC
  3. Escribe "pagar" en la terminal para simular un pago
  4. Observa cómo el botón JUGAR se ilumina en Scratch
  5. Juega y al terminar, el servidor recibe el /gameover
"""

import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

puede_jugar = False

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        global puede_jugar

        if self.path == "/estado":
            valor = 1 if puede_jugar else 0
            body = json.dumps({"puede_jugar": valor}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        elif self.path == "/gameover":
            puede_jugar = False
            print("\n🏁 ¡Scratch notificó GAME OVER!")
            print("   puede_jugar → 0 (máquina liberada)")
            print("\n   Escribe 'pagar' para simular otro pago: ", end="", flush=True)
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"OK")

        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # silenciar logs HTTP

def run_server():
    server = HTTPServer(("localhost", 8765), Handler)
    server.serve_forever()

def main():
    global puede_jugar

    print("=" * 50)
    print("  ArcadePay — Servidor de Prueba")
    print("=" * 50)
    print()
    print("Endpoints activos:")
    print("  GET http://localhost:8765/estado")
    print("  GET http://localhost:8765/gameover")
    print()
    print("Abre tu juego en Turbowarp y prueba.")
    print()

    # Iniciar servidor HTTP en hilo aparte
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    print("✅ Servidor corriendo en localhost:8765\n")

    # Menú interactivo
    while True:
        cmd = input("Escribe 'pagar' para simular un pago (o 'salir'): ").strip().lower()
        if cmd == "pagar":
            puede_jugar = True
            print("✅ ¡Pago simulado! puede_jugar → 1")
            print("   El botón JUGAR en Scratch debería iluminarse...\n")
        elif cmd == "salir":
            print("⛔ Servidor detenido")
            break
        else:
            print(f"   Comando no reconocido: '{cmd}'\n")

if __name__ == "__main__":
    main()
