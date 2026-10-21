#!/bin/bash
# Script de inicio rápido para DeudaCero
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "Iniciando DeudaCero..."
python3 server.py
