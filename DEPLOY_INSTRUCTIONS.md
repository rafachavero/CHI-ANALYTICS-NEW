# Publicar tu Proyecto en GitHub

Como no tengo acceso directo a tu cuenta de GitHub, aquí tienes los pasos para subir tu proyecto y hacerlo público:

## 1. Crear el Repositorio
1. Ve a [github.com/new](https://github.com/new).
2. Ponle un nombre (ej. `chi-analytics-pro`).
3. Asegúrate de que esté **Público** (si quieres compartirlo gratis) o Privado.
4. **NO** marques "Initialize with README", .gitignore o License.
5. Dale a "Create repository".

## 2. Subir el Código
Abre una terminal en esta carpeta y ejecuta:

```powershell
# 1. Asegurar que git está listo
git init
git add .
git commit -m "Versión lista para publicar - Limpieza de datos demo"

# 2. Conectar con GitHub (COPIA EL COMANDO DE TU NAVEGADOR)
# Será algo como:
# git remote add origin https://github.com/TU_USUARIO/chi-analytics-pro.git

# 3. Subir
git push -u origin main
```

## 3. Activar GitHub Pages
1. Ve a **Settings** > **Pages** en tu repositorio.
2. En **Branch**, elige `main` y `/ (root)`.
3. Dale a **Save**.
4. Tu web estará en: `https://TU_USUARIO.github.io/chi-analytics-pro/`
