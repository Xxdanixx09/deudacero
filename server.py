#!/usr/bin/env python3
"""
server.py - Servidor local liviano para DeudaCero
Permite acceder a la aplicación desde la computadora y desde cualquier celular en la misma red Wi-Fi.
No requiere dependencias externas ni 'npm'. Utiliza únicamente la biblioteca estándar de Python 3.
"""

import http.server
import socket
import socketserver
import os
import sys

PORT = 8080

def get_local_ip():
    """Obtiene la dirección IP local de la computadora en la red Wi-Fi"""
    ip = "127.0.0.1"
    try:
        # Intentar conectar momentáneamente a una dirección pública para obtener la interfaz activa
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            # Fallback usando hostname
            host_name = socket.gethostname()
            ip_list = socket.gethostbyname_ex(host_name)[2]
            for candidate in ip_list:
                if not candidate.startswith("127."):
                    ip = candidate
                    break
        except Exception:
            pass
    return ip

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Permitir CORS y deshabilitar caché agresiva para facilitar desarrollo y sincronización
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def main():
    # Asegurar que el servidor se ejecute en el directorio del script
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    local_ip = get_local_ip()

    server_address = ('0.0.0.0', PORT)
    
    # Permitir reusar dirección inmediatamente al reiniciar
    socketserver.TCPServer.allow_reuse_address = True

    try:
        with socketserver.TCPServer(server_address, CustomHandler) as httpd:
            print("=" * 65)
            print("  🚀  SERVIDOR DEUDACERO INICIADO EXITOSAMENTE")
            print("=" * 65)
            print(f"  💻  En tu computadora abre:")
            print(f"      http://localhost:{PORT}")
            print()
            print(f"  📱  En tu Celular / Móvil (conectado al mismo Wi-Fi):")
            print(f"      http://{local_ip}:{PORT}")
            print()
            print("  💡  TIP MÓVIL:")
            print("      Al abrir la dirección en tu teléfono desde Chrome o Safari,")
            print("      pulsa 'Añadir a pantalla de inicio' para instalarla como App.")
            print("=" * 65)
            print("  Presiona Ctrl + C para detener el servidor.")
            print()
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido. ¡Hasta pronto!")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error al iniciar servidor: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
