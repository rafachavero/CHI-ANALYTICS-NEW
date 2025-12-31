# Cómo recuperar tu proyecto después de reiniciar

¡No te preocupes! Todo tu trabajo está guardado en tu disco duro. Si apagas el ordenador, los archivos **NO** se borran.

La carpeta de tu proyecto es:
`C:\Users\rafac\.gemini\antigravity\scratch\CHI-ANALYTICS-PRO`

## Pasos para volver a arrancar:

1.  **Abre tu terminal** (PowerShell o CMD).
2.  **Ve a la carpeta del proyecto** escribiendo este comando y pulsando Enter:
    ```powershell
    cd C:\Users\rafac\.gemini\antigravity\scratch\CHI-ANALYTICS-PRO
    ```
3.  **Inicia el servidor local** (para que la web funcione):
    ```powershell
    npx http-server .
    ```
    *(Si te pide instalar algo, di que sí).*

4.  **Abre tu navegador** y entra en:
    [http://localhost:8080](http://localhost:8080)


## Cómo pedirle a Antigravity que continúe

Si abres un nuevo chat con Antigravity y quieres seguir trabajando aquí, simplemente copia y pega este mensaje:

> "Hola, quiero continuar trabajando en el proyecto que está en: `C:\Users\rafac\.gemini\antigravity\scratch\CHI-ANALYTICS-PRO`. Por favor, revisa el archivo `task.md` para ver qué tareas quedaron pendientes."

