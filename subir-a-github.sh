#!/bin/bash
# Script para publicar DeudaCero en GitHub Pages gratis
echo "=========================================================="
echo "  🚀 PUBLICAR DEUDACERO EN GITHUB PAGES (GRATIS Y 24/7)"
echo "=========================================================="
echo ""
echo "Paso 1: Ve a https://github.com/new y crea un repositorio nuevo llamado 'deudacero'"
echo "        (Déjalo público y no agregues README ni .gitignore)"
echo ""
read -p "¿Ya creaste el repositorio en GitHub? (s/n): " confirm

if [[ "$confirm" == "s" || "$confirm" == "S" ]]; then
    read -p "Ingresa tu usuario de GitHub [por defecto: Xxdanixx09]: " gh_user
    gh_user=${gh_user:-Xxdanixx09}
    
    read -p "Ingresa el nombre del repositorio [por defecto: deudacero]: " gh_repo
    gh_repo=${gh_repo:-deudacero}

    git remote remove origin 2>/dev/null
    git remote add origin "https://github.com/${gh_user}/${gh_repo}.git"

    echo ""
    echo "Subiendo archivos a GitHub..."
    git push -u origin main

    echo ""
    echo "=========================================================="
    echo "  🎉 ¡PROYECTO SUBIDO CON ÉXITO!"
    echo "=========================================================="
    echo ""
    echo "Último paso para activar el enlace público:"
    echo "1. Entra a tu repositorio en GitHub: https://github.com/${gh_user}/${gh_repo}/settings/pages"
    echo "2. En 'Build and deployment' > 'Branch': selecciona 'main' y la carpeta '/ (root)'"
    echo "3. Haz clic en 'Save'"
    echo ""
    echo "En 1 minuto tu app estará disponible en:"
    echo "👉 https://${gh_user}.github.io/${gh_repo}/"
    echo ""
    echo "Ábrela desde tu celular Android y toca 'Instalar aplicación' para tenerla como app nativa sin necesidad de tu PC."
    echo "=========================================================="
else
    echo "Operación cancelada. Crea primero el repositorio en https://github.com/new y vuelve a ejecutar este script."
fi
