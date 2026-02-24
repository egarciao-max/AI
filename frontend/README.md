# Familia AI Frontend

Frontend para el proyecto Familia AI, conectado al backend de Cloudflare Workers con funcionalidades completas de chat, autenticación y administración.

## Características

- **Autenticación segura** con código familiar y 2FA
- **Chat en tiempo real** con IA usando Google Gemini
- **Gestión de usuarios** con roles (admin, parent, child)
- **Panel de administración** completo
- **Historial de conversaciones** organizado
- **Diseño responsive** para todos los dispositivos

## Tecnologías

- **Vite** - Entorno de desarrollo rápido
- **Vanilla JavaScript** - Sin frameworks pesados
- **CSS Grid/Flexbox** - Diseño moderno y responsive
- **Fetch API** - Comunicación con el backend

## Configuración

### 1. Instalación de dependencias

```bash
npm install
```

### 2. Configuración del entorno

Copia el archivo `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tu URL del backend:

```env
VITE_API_BASE_URL=https://tu-backend-familia-ai.workers.dev
```

### 3. Variables de entorno

- `VITE_API_BASE_URL`: URL del backend de Familia AI
- `VITE_ENABLE_ADMIN_PANEL`: Habilitar/deshabilitar panel de administración
- `VITE_ENABLE_REGISTRATION`: Habilitar/deshabilitar registro de usuarios
- `VITE_MAX_MESSAGE_LENGTH`: Longitud máxima de mensajes
- `VITE_AUTO_SCROLL`: Auto-desplazamiento en el chat

## Desarrollo

### Iniciar el servidor de desarrollo

```bash
npm run dev
```

El servidor se iniciará en `http://localhost:5173`

### Construir para producción

```bash
npm run build
```

### Previsualizar build de producción

```bash
npm run preview
```

## Estructura del proyecto

```
frontend(not completly front)/
├── src/
│   ├── api.js          # Cliente API para Familia AI Backend
│   ├── app.js          # Lógica principal de la aplicación
│   └── style.css       # Estilos CSS
├── index.html          # Página principal
├── package.json        # Dependencias y scripts
├── vite.config.ts      # Configuración de Vite
├── .env.example        # Ejemplo de variables de entorno
└── README.md          # Documentación
```

## API Endpoints

La aplicación se conecta a los siguientes endpoints del backend:

### Autenticación
- `POST /api/register` - Registro de usuario
- `POST /api/login` - Inicio de sesión
- `POST /api/verify-2fa` - Verificación 2FA

### Chat
- `POST /api/chat` - Enviar mensaje al chat
- `GET /api/chats` - Obtener conversaciones
- `GET /api/chats/:id/messages` - Obtener mensajes de una conversación
- `DELETE /api/chats/:id` - Eliminar conversación

### Perfil
- `GET /api/profile` - Obtener perfil de usuario
- `PUT /api/profile` - Actualizar perfil
- `PUT /api/settings` - Actualizar configuración

### Administración (requiere rol admin/parent)
- `GET /api/admin/users` - Listar usuarios
- `PUT /api/admin/users/:id` - Actualizar rol de usuario
- `GET /api/admin/stats` - Obtener estadísticas
- `GET /api/admin/dashboard` - Dashboard de administración

## Seguridad

- **Validación de código familiar** para todos los accesos
- **2FA** con códigos de un solo uso
- **Validación de dispositivos** por ID y nombre
- **Almacenamiento seguro** de tokens en localStorage
- **Headers de seguridad** configurados

## Personalización

### Estilos
Los estilos están definidos en `src/style.css` usando CSS custom properties (variables) para fácil personalización:

```css
:root {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --success-color: #28a745;
  --danger-color: #dc3545;
  /* ... */
}
```

### Funcionalidades
Puedes habilitar o deshabilitar funcionalidades mediante las variables de entorno:

```env
VITE_ENABLE_ADMIN_PANEL=true
VITE_ENABLE_REGISTRATION=true
```

## Despliegue

### Cloudflare Pages
1. Conecta tu repositorio a Cloudflare Pages
2. Configura las variables de entorno en el dashboard
3. Establece el comando de build: `npm run build`
4. Directorio de build: `dist`

### Netlify
1. Conecta tu repositorio a Netlify
2. Configura las variables de entorno
3. Comando de build: `npm run build`
4. Directorio de publicación: `dist`

### Vercel
1. Importa tu proyecto en Vercel
2. Configura las variables de entorno
3. Comando de build: `npm run build`
4. Directorio de output: `dist`

## Troubleshooting

### CORS Errors
Asegúrate de que el backend tenga configurado correctamente el `ALLOWED_ORIGIN` en las variables de entorno.

### API Connection Issues
Verifica que la URL del backend en `.env` sea correcta y que el backend esté desplegado y funcionando.

### Authentication Issues
- Verifica que el código familiar sea correcto
- Revisa que el email y contraseña sean válidos
- Asegúrate de que el usuario esté aprobado (para cuentas de niños)

## Contribución

1. Haz un fork del proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcion`
3. Haz commit de tus cambios: `git commit -m 'Añade nueva función'`
4. Sube a la rama: `git push origin feature/nueva-funcion`
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## Soporte

Para soporte o preguntas, contacta al administrador del sistema o revisa la documentación del backend en el repositorio correspondiente.