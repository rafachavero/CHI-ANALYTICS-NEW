# Guía de Configuración de Firebase

Sigue estos pasos para crear tu propia base de datos gratuita.

## Paso 1: Crear el proyecto
1.  Ve a [console.firebase.google.com](https://console.firebase.google.com/) e inicia sesión con tu cuenta de Google.
2.  Haz clic en **"Crear un proyecto"** (o "Agregar proyecto").
3.  Ponle un nombre (ej: `CHI-Analytics-Pro`).
4.  Desactiva "Google Analytics" (no hace falta para esto) y dale a **"Crear proyecto"**.

## Paso 2: Activar la Base de Datos
1.  En el menú de la izquierda, busca **"Compilación"** > **"Firestore Database"**.
2.  Haz clic en **"Crear base de datos"**.
3.  Elige la ubicación (ej: `eur3` o la que salga por defecto).
4.  **IMPORTANTE:** Cuando te pregunte por las reglas de seguridad, elige **"Comenzar en modo de prueba"**.
    *   *Nota: Esto permitirá que funcione inmediatamente. Más adelante lo aseguraremos.*
5.  Dale a **"Habilitar"**.

## Paso 3: Activar el Login
1.  En el menú de la izquierda, ve a **"Compilación"** > **"Authentication"**.
2.  Haz clic en **"Comenzar"**.
3.  En la pestaña "Sign-in method" (o Proveedores), elige **"Correo electrónico/contraseña"**.
4.  Activa el interruptor de **"Habilitar"** y dale a **"Guardar"**.

## Paso 4: Conseguir las claves
1.  Haz clic en la **rueda dentada** ⚙️ (arriba a la izquierda, al lado de "Descripción general del proyecto") > **Configuración del proyecto**.
2.  Baja hasta el final de la página donde dice "Tus apps".
3.  Haz clic en el icono de web **`</>`**.
4.  Ponle un apodo (ej: `ChiApp`) y dale a **"Registrar app"**.
5.  Te saldrá un código con `const firebaseConfig = { ... }`.

---

### ¡Cofia ese código!
Copia todo el bloque que se parece a esto y pégalo en el chat:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```
