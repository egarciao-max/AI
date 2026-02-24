import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

interface Env {
  GOOGLE_API_KEY: string;
  RESEND_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  PASSWORD_SALT: string;
  FAMILY_SECRET_CODE: string;
  ADMIN_EMAIL: string;
  ALLOWED_ORIGIN?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  settings?: any;
  limits?: any;
  agent_personality?: any;
}

interface CorsHeaders {
  [key: string]: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Inicializar Supabase
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

    const securityHeaders = {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    };

    const corsHeaders: CorsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
      'Access-Control-Allow-Headers': 'Content-Type, X-Family-Token, X-2FA-Code, X-Device-ID, X-Device-Name, X-Admin-Token',
      'Access-Control-Max-Age': '86400',
    };

    // Manejo de OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, ...securityHeaders }
      });
    }

    const url = new URL(request.url);
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const deviceID = request.headers.get('X-Device-ID') || randomBytes(8).toString('hex');
    const deviceName = request.headers.get('X-Device-Name') || 'Desconocido';

    // ========== RUTAS PÚBLICAS ==========

    // Health check
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Test Supabase
    if (url.pathname === '/api/test-supabase' && request.method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('count')
          .limit(1);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, message: 'Conexión exitosa', data }), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Registro de usuario
    if (url.pathname === '/api/register' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { name, email, password, familyCode } = body;

        if (!name || !email || !password || !familyCode) {
          return new Response(JSON.stringify({ error: 'Todos los campos son requeridos' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!validateEmail(email)) {
          return new Response(JSON.stringify({ error: 'Email inválido' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!validateFamilyCode(familyCode, env)) {
          return new Response(JSON.stringify({ error: 'Código de familia inválido' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!validatePassword(password)) {
          return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas, números y caracteres especiales' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        const passwordHash = hashPassword(password, env.PASSWORD_SALT);

        // Verificar si el email ya existe
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingUser) {
          return new Response(JSON.stringify({ error: 'El email ya está registrado' }), {
            status: 409,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Crear usuario
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([{
            name,
            email,
            password_hash: passwordHash,
            role: 'child',
            status: 'pending',
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          }])
          .select()
          .single();

        if (insertError) throw insertError;

        // Generar código de verificación
        const verificationCode = generateSecureCode(6);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await supabase
          .from('email_verifications')
          .insert([{
            user_id: newUser.id,
            email: email,
            code: verificationCode,
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString()
          }]);

        // Enviar email de verificación
        const verificationHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">¡Bienvenido a Familia AI!</h2>
            <p>Gracias por registrarte. Por favor, verifica tu email usando el siguiente código:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #1f2937; font-size: 32px; letter-spacing: 8px; margin: 0;">${verificationCode}</h1>
            </div>
            <p>Este código expira en 24 horas.</p>
            <p>Si no solicitaste este registro, por favor ignora este email.</p>
          </div>
        `;

        await sendResendEmail(email, 'Verifica tu email - Familia AI', verificationHtml, env);

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Usuario registrado. Por favor verifica tu email.',
          userId: newUser.id 
        }), {
          status: 201,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Verificación de email
    if (url.pathname === '/api/verify-email' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { userId, code } = body;

        if (!userId || !code) {
          return new Response(JSON.stringify({ error: 'ID de usuario y código requeridos' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: verification, error: vError } = await supabase
          .from('email_verifications')
          .select('*')
          .eq('user_id', userId)
          .eq('code', code)
          .single();

        if (vError || !verification) {
          return new Response(JSON.stringify({ error: 'Código de verificación inválido' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (new Date() > new Date(verification.expires_at)) {
          return new Response(JSON.stringify({ error: 'Código de verificación expirado' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Actualizar usuario a activo
        await supabase
          .from('users')
          .update({ 
            status: 'active',
            email_verified: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        // Eliminar registro de verificación
        await supabase
          .from('email_verifications')
          .delete()
          .eq('id', verification.id);

        return new Response(JSON.stringify({ success: true, message: 'Email verificado exitosamente' }), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Reenviar email de verificación
    if (url.pathname === '/api/resend-verification' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { userId } = body;

        if (!userId) {
          return new Response(JSON.stringify({ error: 'ID de usuario requerido' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: user, error: uError } = await supabase
          .from('users')
          .select('id, email, status')
          .eq('id', userId)
          .single();

        if (uError || !user) {
          return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (user.status === 'active') {
          return new Response(JSON.stringify({ error: 'El usuario ya está verificado' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Generar nuevo código
        const verificationCode = generateSecureCode(6);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await supabase
          .from('email_verifications')
          .insert([{
            user_id: user.id,
            email: user.email,
            code: verificationCode,
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString()
          }]);

        const verificationHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Reenvío de Verificación</h2>
            <p>Este es tu nuevo código de verificación:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #1f2937; font-size: 32px; letter-spacing: 8px; margin: 0;">${verificationCode}</h1>
            </div>
            <p>Este código expira en 24 horas.</p>
          </div>
        `;

        await sendResendEmail(user.email, 'Nuevo código de verificación - Familia AI', verificationHtml, env);

        return new Response(JSON.stringify({ success: true, message: 'Nuevo código enviado' }), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Login
    if (url.pathname === '/api/login' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { email, password, familyCode } = body;

        if (!email || !password || !familyCode) {
          return new Response(JSON.stringify({ error: 'Email, contraseña y código de familia requeridos' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!validateFamilyCode(familyCode, env)) {
          return new Response(JSON.stringify({ error: 'Código de familia inválido' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        const passwordHash = hashPassword(password, env.PASSWORD_SALT);

        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .eq('password_hash', passwordHash)
          .single();

        if (error || !user) {
          return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
            status: 401,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (user.status !== 'active') {
          return new Response(JSON.stringify({ error: 'Cuenta no verificada. Por favor verifica tu email.' }), {
            status: 403,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Generar token de sesión
        const sessionToken = generateSecureCode(32);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await supabase
          .from('sessions')
          .insert([{
            user_id: user.id,
            token: sessionToken,
            expires_at: expiresAt.toISOString(),
            device_id: deviceID,
            device_name: deviceName,
            ip_address: clientIP,
            user_agent: userAgent,
            created_at: new Date().toISOString(),
            last_activity: new Date().toISOString()
          }]);

        // Actualizar último login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', user.id);

        return new Response(JSON.stringify({
          success: true,
          message: 'Login exitoso',
          token: sessionToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            settings: user.settings
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ========== RUTAS PROTEGIDAS ==========

    // Validar token
    const token = request.headers.get('X-Family-Token');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token requerido' }), {
        status: 401,
        headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tokenValidation = await validateToken(token, env, supabase);
    if (!tokenValidation.valid) {
      return new Response(JSON.stringify({ error: 'Token inválido o expirado' }), {
        status: 401,
        headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
      });
    }

    const user = tokenValidation.user;

    // Chat
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { message, threadId } = body;

        if (!message) {
          return new Response(JSON.stringify({ error: 'Mensaje requerido' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!checkContentModeration(message)) {
          return new Response(JSON.stringify({ error: 'Contenido no permitido' }), {
            status: 400,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Verificar límites de usuario
        if (!validateUserLimits(user, user.limits)) {
          return new Response(JSON.stringify({ error: 'Límite de mensajes diarios alcanzado' }), {
            status: 429,
            headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Crear o obtener hilo
        let thread;
        if (threadId) {
          const { data: existingThread } = await supabase
            .from('chat_threads')
            .select('*')
            .eq('id', threadId)
            .eq('user_id', user.id)
            .single();
          thread = existingThread;
        }

        if (!thread) {
          const { data: newThread } = await supabase
            .from('chat_threads')
            .insert([{
              user_id: user.id,
              title: message.substring(0, 50),
              created_at: new Date().toISOString()
            }])
            .select()
            .single();
          thread = newThread;
        }

        // Guardar mensaje del usuario
        await supabase
          .from('chat_messages')
          .insert([{
            thread_id: thread.id,
            user_id: user.id,
            content: message,
            role: 'user',
            created_at: new Date().toISOString()
          }]);

        // Detectar estado de ánimo
        const mood = detectMood(message);
        if (mood) {
          await supabase
            .from('user_mood_tracking')
            .insert([{
              user_id: user.id,
              mood_score: mood.score,
              detected_at: new Date().toISOString(),
              confidence: mood.confidence,
              detected_mood: mood.type
            }]);
        }

        // Detectar temas
        const topics = detectTopics(message);
        if (topics && topics.length > 0) {
          for (const topic of topics) {
            await supabase
              .from('topic_evolution')
              .upsert({
                topic: topic,
                mentions: 1,
                last_mentioned: new Date().toISOString(),
                user_id: user.id
              }, { onConflict: 'topic' })
              .select();
          }
        }

        // Llamada a Google Gemini
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${env.GOOGLE_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: message
              }]
            }]
          })
        });

        const geminiData = await geminiResponse.json();
        const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Lo siento, no pude procesar tu mensaje.';

        // Guardar respuesta de IA
        await supabase
          .from('chat_messages')
          .insert([{
            thread_id: thread.id,
            user_id: user.id,
            content: aiResponse,
            role: 'assistant',
            created_at: new Date().toISOString()
          }]);

        // Actualizar contador de mensajes
        updateMessageCount(user);

        return new Response(JSON.stringify({
          success: true,
          response: aiResponse,
          threadId: thread.id
        }), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Obtener hilos de chat
    if (url.pathname === '/api/chat/threads' && request.method === 'GET') {
      try {
        const { data: threads, error } = await supabase
          .from('chat_threads')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify(threads), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Obtener mensajes de un hilo
    if (url.pathname.startsWith('/api/chat/thread/') && request.method === 'GET') {
      try {
        const threadId = url.pathname.split('/').pop();

        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        return new Response(JSON.stringify(messages), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Perfil de usuario
    if (url.pathname === '/api/profile' && request.method === 'GET') {
      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        return new Response(JSON.stringify(profile || { user_id: user.id }), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Actualizar perfil
    if (url.pathname === '/api/profile' && request.method === 'PUT') {
      try {
        const updates = await request.json() as any;

        const { data, error } = await supabase
          .from('user_profiles')
          .upsert({
            ...updates,
            user_id: user.id,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Configuración de usuario
    if (url.pathname === '/api/settings' && request.method === 'GET') {
      try {
        const { data: settings, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        return new Response(JSON.stringify(settings || { user_id: user.id }), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Actualizar configuración
    if (url.pathname === '/api/settings' && request.method === 'PUT') {
      try {
        const updates = await request.json() as any;

        const { data, error } = await supabase
          .from('user_settings')
          .upsert({
            ...updates,
            user_id: user.id,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ========== RUTAS ADMIN ==========

    if (!isAdmin(user)) {
      return new Response(JSON.stringify({ error: 'Acceso denegado' }), {
        status: 403,
        headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Dashboard
    if (url.pathname === '/api/admin/dashboard' && request.method === 'GET') {
      try {
        const dashboard = {
          metrics: {
            total_users: 0,
            active_today: 0,
            total_chats: 0,
            total_messages: 0,
            avg_mood: 0,
            topics_count: 0
          },
          charts: {
            messages_by_day: [],
            topics_distribution: [],
            interests_evolution: [],
            activity_heatmap: [],
            member_engagement: []
          },
          recent_activity: [],
          insights: [],
          generated_at: new Date()
        };

        // Métricas principales
        const { count: totalUsers } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        dashboard.metrics.total_users = totalUsers || 0;

        const today = new Date().toISOString().split('T')[0];
        const { count: activeToday } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today);

        dashboard.metrics.active_today = activeToday || 0;

        const { count: totalChats } = await supabase
          .from('chat_threads')
          .select('*', { count: 'exact', head: true });

        dashboard.metrics.total_chats = totalChats || 0;

        const { count: totalMessages } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true });

        dashboard.metrics.total_messages = totalMessages || 0;

        // Estado de ánimo promedio
        const { data: mood } = await supabase
          .from('user_mood_tracking')
          .select('mood_score')
          .limit(100);

        if (mood && mood.length > 0) {
          const avgMood = mood.reduce((sum, m) => sum + m.mood_score, 0) / mood.length;
          dashboard.metrics.avg_mood = Math.round(avgMood * 10) / 10;
        }

        // Conteo de temas
        const { count: topicsCount } = await supabase
          .from('topic_evolution')
          .select('*', { count: 'exact', head: true });

        dashboard.metrics.topics_count = topicsCount || 0;

        // Gráficos
        // Mensajes por día (últimos 7 días)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: messagesByDay } = await supabase
          .rpc('get_messages_by_day', { days: 7 });

        dashboard.charts.messages_by_day = messagesByDay || [];

        // Distribución de temas
        const { data: topicsDist } = await supabase
          .from('topic_evolution')
          .select('topic, mentions')
          .order('mentions', { ascending: false })
          .limit(10);

        dashboard.charts.topics_distribution = topicsDist || [];

        // Evolución de intereses
        const { data: interests } = await supabase
          .from('topic_evolution')
          .select('topic, mentions, last_mentioned')
          .order('last_mentioned', { ascending: true })
          .limit(20);

        dashboard.charts.interests_evolution = interests || [];

        // Mapa de calor de actividad
        const { data: heatmap } = await supabase
          .from('user_connection_hours')
          .select('hour_of_day, connection_count')
          .order('hour_of_day');

        dashboard.charts.activity_heatmap = heatmap || [];

        // Compromiso de miembros
        const { data: users } = await supabase
          .from('users')
          .select('id, name, email, role, created_at, last_login')
          .eq('status', 'active');

        dashboard.charts.member_engagement = users || [];

        // Actividad reciente
        const { data: recentActivity } = await supabase
          .from('chat_messages')
          .select(`
            id,
            content,
            role,
            created_at,
            user_id,
            thread_id
          `)
          .order('created_at', { ascending: false })
          .limit(20);

        dashboard.recent_activity = recentActivity || [];

        // Insights
        dashboard.insights = [
          {
            type: 'positive',
            title: 'Mayor actividad',
            description: `Hoy se enviaron ${dashboard.metrics.active_today} mensajes`
          },
          {
            type: 'info',
            title: 'Usuarios activos',
            description: `${dashboard.metrics.active_today} usuarios están activos hoy`
          }
        ];

        return new Response(JSON.stringify(dashboard), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Usuarios
    if (url.pathname === '/api/admin/users' && request.method === 'GET') {
      try {
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify(users), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Actualizar usuario
    if (url.pathname.startsWith('/api/admin/user/') && request.method === 'PUT') {
      try {
        const userId = url.pathname.split('/').pop();
        const updates = await request.json() as any;

        const { data, error } = await supabase
          .from('users')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Eliminar usuario
    if (url.pathname.startsWith('/api/admin/user/') && request.method === 'DELETE') {
      try {
        const userId = url.pathname.split('/').pop();

        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Mensajes
    if (url.pathname === '/api/admin/messages' && request.method === 'GET') {
      try {
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select(`
            *,
            users(name, email),
            chat_threads(title)
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        return new Response(JSON.stringify(messages), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Eliminar mensaje
    if (url.pathname.startsWith('/api/admin/message/') && request.method === 'DELETE') {
      try {
        const messageId = url.pathname.split('/').pop();

        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .eq('id', messageId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Temas
    if (url.pathname === '/api/admin/topics' && request.method === 'GET') {
      try {
        const { data: topics, error } = await supabase
          .from('topic_evolution')
          .select('*')
          .order('mentions', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify(topics), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Estado de ánimo
    if (url.pathname === '/api/admin/mood' && request.method === 'GET') {
      try {
        const { data: mood, error } = await supabase
          .from('user_mood_tracking')
          .select('*')
          .order('detected_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        return new Response(JSON.stringify(mood), {
          status: 200,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ========== FUNCIONES AUXILIARES ==========

    // Funciones auxiliares para el dashboard
    async function getMessagesByDayChart(supabase: any, days: number = 7) {
      const { data } = await supabase
        .rpc('get_messages_by_day', { days });
      return data || [];
    }

    async function getInterestsEvolutionChart(supabase: any) {
      const { data } = await supabase
        .from('topic_evolution')
        .select('topic, mentions, last_mentioned')
        .order('last_mentioned', { ascending: true })
        .limit(20);
      return data || [];
    }

    async function getTopicsDistributionChart(supabase: any) {
      const { data } = await supabase
        .from('topic_evolution')
        .select('topic, mentions')
        .order('mentions', { ascending: false })
        .limit(10);
      return data || [];
    }

    async function getInterestsRadarChart(supabase: any) {
      const { data } = await supabase
        .from('topic_evolution')
        .select('topic, mentions')
        .limit(6);
      return data || [];
    }

    async function getActivityHeatmap(supabase: any) {
      const { data } = await supabase
        .from('user_connection_hours')
        .select('hour_of_day, connection_count')
        .order('hour_of_day');
      return data || [];
    }

    async function getFamilyNetworkChart(supabase: any) {
      const { data } = await supabase
        .from('user_connections')
        .select('user_id, connected_users, connection_type')
        .limit(50);
      return data || [];
    }

    async function getFamilyWordCloud(supabase: any) {
      const { data } = await supabase
        .from('common_words')
        .select('word, frequency')
        .order('frequency', { ascending: false })
        .limit(50);
      return data || [];
    }

    async function getFamilyTimeline(supabase: any) {
      const { data } = await supabase
        .from('family_events')
        .select('event_date, event_type, description, participants')
        .order('event_date', { ascending: false })
        .limit(20);
      return data || [];
    }

    async function getMemberCards(supabase: any) {
      const { data } = await supabase
        .from('users')
        .select('id, name, email, role, created_at, last_login')
        .eq('status', 'active')
        .limit(10);
      return data || [];
    }

    async function getWeeklyReport(supabase: any) {
      const { data } = await supabase
        .rpc('get_weekly_report');
      return data || {};
    }

    async function getFamilyAlerts(supabase: any) {
      const { data } = await supabase
        .from('family_alerts')
        .select('alert_type, message, created_at, priority')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    }

    async function getWeeklyFamilyReport(supabase: any) {
      const { data } = await supabase
        .rpc('get_weekly_family_report');
      return data || {};
    }

    async function getMonthlyFamilyReport(supabase: any) {
      const { data } = await supabase
        .rpc('get_monthly_family_report');
      return data || {};
    }

    async function getGenerationalComparative(supabase: any) {
      const { data } = await supabase
        .rpc('get_generational_comparative');
      return data || {};
    }

    function formatMessageIntelligently(message: string): string {
      // Lógica para formatear mensajes inteligentemente
      return message.trim();
    }

    function detectContent(message: string): any {
      // Lógica para detectar contenido
      return {
        type: 'text',
        confidence: 1.0,
        metadata: {}
      };
    }

    async function exportFamilyProfile(supabase: any, familyId: string) {
      const { data } = await supabase
        .from('family_profiles')
        .select('*')
        .eq('family_id', familyId)
        .single();
      return data;
    }

    async function exportVisualizations(supabase: any, familyId: string) {
      const visualizations = {
        messagesByDay: await getMessagesByDayChart(supabase, 30),
        topicsDistribution: await getTopicsDistributionChart(supabase),
        interestsEvolution: await getInterestsEvolutionChart(supabase),
        activityHeatmap: await getActivityHeatmap(supabase)
      };
      return visualizations;
    }

    async function generatePDFReport(supabase: any, familyId: string) {
      // Lógica para generar PDF
      return {
        url: `https://example.com/reports/${familyId}.pdf`,
        filename: `family_report_${familyId}.pdf`
      };
    }

    async function sendResendEmail(to: string, subject: string, html: string, env: Env) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'noreply@familia-ai.com',
          to: [to],
          subject: subject,
          html: html
        })
      });

      if (!response.ok) {
        throw new Error(`Resend API error: ${response.status}`);
      }

      return await response.json();
    }

    // Funciones de validación y utilidad
    function validateEmail(email: string): boolean {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }

    function hashPassword(password: string, salt: string): string {
      return createHash('sha256').update(password + salt).digest('hex');
    }

    function generateSecureCode(length: number = 6): string {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

    function validateDevice(deviceID: string, userAgent: string): boolean {
      // Lógica de validación de dispositivo
      return deviceID && userAgent && deviceID.length > 0 && userAgent.length > 0;
    }

    function checkRateLimit(userIP: string, action: string): boolean {
      // Lógica de control de límite de tasa
      return true; // Simplificado para este ejemplo
    }

    function sanitizeInput(input: string): string {
      return input.replace(/[<>\"'&]/g, '');
    }

    function validateFamilyCode(code: string, env: Env): boolean {
      return code === env.FAMILY_SECRET_CODE;
    }

    function generateJWT(payload: any, secret: string): string {
      // Implementación simplificada de JWT
      const header = { alg: 'HS256', typ: 'JWT' };
      const encodedHeader = btoa(JSON.stringify(header));
      const encodedPayload = btoa(JSON.stringify(payload));
      const signature = createHash('sha256').update(`${encodedHeader}.${encodedPayload}.${secret}`).digest('hex');
      return `${encodedHeader}.${encodedPayload}.${signature}`;
    }

    function verifyJWT(token: string, secret: string): any {
      // Implementación simplificada de verificación JWT
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const signature = createHash('sha256').update(`${parts[0]}.${parts[1]}.${secret}`).digest('hex');
        if (signature !== parts[2]) return null;
        
        const payload = JSON.parse(atob(parts[1]));
        return payload;
      } catch {
        return null;
      }
    }

    function isAdmin(user: any): boolean {
      return user && (user.role === 'admin' || user.email === env.ADMIN_EMAIL);
    }

    function isParent(user: any): boolean {
      return user && (user.role === 'parent' || user.role === 'admin');
    }

    function canAccessUser(currentUser: any, targetUser: any): boolean {
      if (!currentUser || !targetUser) return false;
      if (isAdmin(currentUser)) return true;
      if (isParent(currentUser) && targetUser.role !== 'admin') return true;
      return currentUser.id === targetUser.id;
    }

    function calculateUserStats(user: any): any {
      return {
        messages_today: 0,
        total_messages: 0,
        avg_mood: 0,
        topics_count: 0
      };
    }

    function generateInsights(stats: any): any[] {
      const insights = [];
      
      if (stats.messages_today > 10) {
        insights.push({
          type: 'positive',
          title: 'Alta actividad',
          description: `Hoy se enviaron ${stats.messages_today} mensajes`
        });
      }
      
      return insights;
    }

    function formatUserForResponse(user: any): any {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        last_login: user.last_login
      };
    }

    function validateUserLimits(user: any, limits: any): boolean {
      if (!user || !limits) return false;
      return user.limits.used_today < user.limits.daily_messages;
    }

    function updateMessageCount(user: any): void {
      if (user && user.limits) {
        user.limits.used_today = (user.limits.used_today || 0) + 1;
      }
    }

    function checkContentModeration(message: string): boolean {
      // Lógica simple de moderación de contenido
      const blockedTerms = ['spam', 'inappropriate'];
      return !blockedTerms.some(term => message.toLowerCase().includes(term));
    }

    function logSecurityEvent(event: string, details: any, env: Env): void {
      // Lógica para registrar eventos de seguridad
      console.log(`Security Event: ${event}`, details);
    }

    function generateReportData(supabase: any, familyId: string): any {
      return {
        family_id: familyId,
        generated_at: new Date().toISOString(),
        metrics: {
          total_users: 0,
          active_today: 0,
          total_chats: 0,
          total_messages: 0
        },
        charts: {
          messages_by_day: [],
          topics_distribution: [],
          interests_evolution: [],
          activity_heatmap: [],
          member_engagement: []
        },
        insights: []
      };
    }

    function exportDataToCSV(data: any[]): string {
      if (!data || data.length === 0) return '';
      
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');
      
      return csvContent;
    }

    function validateAPIKey(apiKey: string, env: Env): boolean {
      return apiKey === env.GOOGLE_API_KEY;
    }

    function formatResponse(data: any, success: boolean = true, message?: string): Response {
      const response = {
        success,
        data,
        message: message || (success ? 'Operación exitosa' : 'Error en la operación')
      };
      
      return new Response(JSON.stringify(response), {
        status: success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    function handleError(error: any, env: Env): Response {
      console.error('Error:', error);
      
      // Registrar error de seguridad
      logSecurityEvent('api_error', { error: error.message, stack: error.stack }, env);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
        message: 'Por favor, intente de nuevo más tarde'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    function validateRequest(request: Request, requiredFields: string[]): boolean {
      const url = new URL(request.url);
      const body = request.body ? JSON.parse(request.body.toString()) : {};
      
      for (const field of requiredFields) {
        if (!url.searchParams.get(field) && !body[field]) {
          return false;
        }
      }
      return true;
    }

    function sanitizeResponse(data: any): any {
      if (typeof data !== 'object' || data === null) return data;
      
      const sanitized = { ...data };
      delete sanitized.password_hash;
      delete sanitized.api_key;
      delete sanitized.secret_key;
      
      return sanitized;
    }

    function rateLimitMiddleware(request: Request, env: Env): boolean {
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';
      
      // Implementación simple de rate limiting
      const key = `${clientIP}_${userAgent}`;
      const now = Date.now();
      
      // Aquí normalmente usarías Redis o una base de datos para el rate limiting
      // Por ahora, simplemente retornamos true
      return true;
    }

    function authenticateRequest(request: Request, env: Env): any {
      const token = request.headers.get('X-Family-Token');
      if (!token) return null;
      
      return verifyJWT(token, env.PASSWORD_SALT);
    }

    function authorizeUser(user: any, requiredRole: string): boolean {
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (requiredRole === 'parent' && (user.role === 'parent' || user.role === 'admin')) return true;
      return user.role === requiredRole;
    }

    function validateInput(input: any, schema: any): boolean {
      // Validación simple de esquema
      for (const [key, rules] of Object.entries(schema)) {
        if (rules.required && !input[key]) return false;
        if (input[key] && rules.type === 'string' && typeof input[key] !== 'string') return false;
        if (input[key] && rules.type === 'number' && typeof input[key] !== 'number') return false;
        if (rules.minLength && input[key] && input[key].length < rules.minLength) return false;
      }
      return true;
    }

    function generateErrorResponse(message: string, statusCode: number = 400): Response {
      return new Response(JSON.stringify({
        success: false,
        error: message
      }), {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    function logAPIRequest(request: Request, response: Response, user?: any): void {
      const logData = {
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        userAgent: request.headers.get('User-Agent'),
        ip: request.headers.get('CF-Connecting-IP'),
        user: user ? { id: user.id, email: user.email, role: user.role } : null,
        status: response.status
      };
      
      console.log('API Request:', JSON.stringify(logData));
    }

    function compressResponse(data: any): string {
      // Compresión simple usando JSON.stringify con espaciado mínimo
      return JSON.stringify(data);
    }

    function cacheResponse(key: string, data: any, ttl: number = 300): void {
      // Implementación simple de caché
      // Normalmente usarías Redis o una base de datos
    }

    function getCachedResponse(key: string): any {
      // Obtener respuesta en caché
      return null;
    }

    function validateCORS(request: Request, env: Env): boolean {
      const origin = request.headers.get('Origin');
      if (!origin) return true;
      
      const allowedOrigins = env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN.split(',') : ['*'];
      return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    }

    function setSecurityHeaders(): Record<string, string> {
      return {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
      };
    }

    function validateFileUpload(file: any): boolean {
      if (!file) return false;
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      return allowedTypes.includes(file.type) && file.size <= maxSize;
    }

    function generateFileName(originalName: string): string {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const extension = originalName.split('.').pop();
      return `${timestamp}_${randomString}.${extension}`;
    }

    function encryptData(data: string, key: string): string {
      // Implementación simple de encriptación
      return createHash('sha256').update(data + key).digest('hex');
    }

    function decryptData(encryptedData: string, key: string): string {
      // Implementación simple de desencriptación
      return encryptedData; // Simplificado
    }

    function validatePhoneNumber(phone: string): boolean {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      return phoneRegex.test(phone);
    }

    function formatPhoneNumber(phone: string): string {
      return phone.replace(/\D/g, '').slice(0, 15);
    }

    function generateQRCode(data: string): string {
      // Generación simple de QR Code URL
      return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}`;
    }

    function validateDateRange(startDate: string, endDate: string): boolean {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return start < end && start.getFullYear() > 1900 && end.getFullYear() < 2100;
    }

    function formatDate(date: Date): string {
      return date.toISOString().split('T')[0];
    }

    function parseDate(dateString: string): Date {
      return new Date(dateString);
    }

    function calculateAge(birthDate: string): number {
      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    }

    function validatePassword(password: string): boolean {
      const minLength = 8;
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
      
      return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
    }

    function hashSensitiveData(data: string, salt: string): string {
      return createHash('sha256').update(data + salt).digest('hex');
    }

    function validateURL(url: string): boolean {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }

    function sanitizeURL(url: string): string {
      return url.replace(/[^a-zA-Z0-9:/?&=_.-]/g, '');
    }

    function generateShortURL(originalURL: string): string {
      const hash = createHash('md5').update(originalURL).digest('hex').substring(0, 8);
      return `https://short.ly/${hash}`;
    }

    function validateJSON(jsonString: string): boolean {
      try {
        JSON.parse(jsonString);
        return true;
      } catch {
        return false;
      }
    }

    function deepClone(obj: any): any {
      return JSON.parse(JSON.stringify(obj));
    }

    function mergeObjects(target: any, source: any): any {
      const result = { ...target };
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = mergeObjects(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
      return result;
    }

    function debounce(func: Function, wait: number): Function {
      let timeout: any;
      return function executedFunction(...args: any[]) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    function throttle(func: Function, limit: number): Function {
      let inThrottle: boolean;
      return function executedFunction(...args: any[]) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }

    function sleep(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function retry<T>(fn: () => Promise<T>, retries: number = 3, delay: number = 1000): Promise<T> {
      return fn().catch(async (error) => {
        if (retries > 0) {
          await sleep(delay);
          return retry(fn, retries - 1, delay * 2);
        }
        throw error;
      });
    }

    function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), ms);
        promise.then(resolve, reject).finally(() => clearTimeout(timer));
      });
    }

    function parallel<T>(promises: Promise<T>[], limit: number = 5): Promise<T[]> {
      return new Promise((resolve, reject) => {
        const results: T[] = [];
        let completed = 0;
        let currentIndex = 0;

        function runNext() {
          if (currentIndex >= promises.length && completed === promises.length) {
            resolve(results);
            return;
          }

          while (currentIndex < promises.length && results.length < limit) {
            const index = currentIndex++;
            promises[index]
              .then(result => {
                results[index] = result;
                completed++;
                runNext();
              })
              .catch(reject);
          }
        }

        runNext();
      });
    }

    function series<T>(functions: (() => Promise<T>)[]): Promise<T[]> {
      return functions.reduce(
        (promise, fn) => promise.then(results => 
          fn().then(result => [...results, result])
        ),
        Promise.resolve([] as T[])
      );
    }

    function memoize<T extends (...args: any[]) => any>(fn: T): T {
      const cache = new Map();
      return ((...args: Parameters<T>) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
          return cache.get(key);
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
      }) as T;
    }

    function curry<T extends (...args: any[]) => any>(fn: T): any {
      return function curried(...args: any[]) {
        if (args.length >= fn.length) {
          return fn.apply(this, args);
        } else {
          return (...nextArgs: any[]) => curried(...args, ...nextArgs);
        }
      };
    }

    function compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
      return (arg: T) => fns.reduceRight((acc, fn) => fn(acc), arg);
    }

    function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
      return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
    }

    function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
      const result = {} as Pick<T, K>;
      for (const key of keys) {
        if (key in obj) {
          result[key] = obj[key];
        }
      }
      return result;
    }

    function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
      const result = { ...obj };
      for (const key of keys) {
        delete result[key];
      }
      return result;
    }

    function flatten<T>(arr: any[]): T[] {
      return arr.reduce((flat, item) => {
        return flat.concat(Array.isArray(item) ? flatten(item) : item);
      }, []);
    }

    function chunk<T>(arr: T[], size: number): T[][] {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    }

    function groupBy<T>(arr: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
      return arr.reduce((groups, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        groups[groupKey] = groups[groupKey] || [];
        groups[groupKey].push(item);
        return groups;
      }, {} as Record<string, T[]>);
    }

    function unique<T>(arr: T[]): T[] {
      return [...new Set(arr)];
    }

    function intersection<T>(arr1: T[], arr2: T[]): T[] {
      return arr1.filter(item => arr2.includes(item));
    }

    function difference<T>(arr1: T[], arr2: T[]): T[] {
      return arr1.filter(item => !arr2.includes(item));
    }

    function shuffle<T>(arr: T[]): T[] {
      const result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }

    function sample<T>(arr: T[], n: number): T[] {
      return shuffle(arr).slice(0, Math.min(n, arr.length));
    }

    function range(start: number, end: number): number[] {
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }

    function sum(arr: number[]): number {
      return arr.reduce((acc, num) => acc + num, 0);
    }

    function average(arr: number[]): number {
      return arr.length > 0 ? sum(arr) / arr.length : 0;
    }

    function median(arr: number[]): number {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2 
        : sorted[mid];
    }

    function mode(arr: number[]): number[] {
      const counts = new Map<number, number>();
      let maxCount = 0;
      
      for (const num of arr) {
        const count = (counts.get(num) || 0) + 1;
        counts.set(num, count);
        maxCount = Math.max(maxCount, count);
      }
      
      return Array.from(counts.entries())
        .filter(([_, count]) => count === maxCount)
        .map(([num]) => num);
    }

    function standardDeviation(arr: number[]): number {
      const avg = average(arr);
      const variance = arr.reduce((acc, num) => acc + Math.pow(num - avg, 2), 0) / arr.length;
      return Math.sqrt(variance);
    }

    function factorial(n: number): number {
      if (n <= 1) return 1;
      return n * factorial(n - 1);
    }

    function fibonacci(n: number): number {
      if (n <= 1) return n;
      return fibonacci(n - 1) + fibonacci(n - 2);
    }

    function gcd(a: number, b: number): number {
      return b === 0 ? a : gcd(b, a % b);
    }

    function lcm(a: number, b: number): number {
      return Math.abs(a * b) / gcd(a, b);
    }

    function isPrime(n: number): boolean {
      if (n <= 1) return false;
      for (let i = 2; i * i <= n; i++) {
        if (n % i === 0) return false;
      }
      return true;
    }

    function primeFactors(n: number): number[] {
      const factors: number[] = [];
      let divisor = 2;
      
      while (n >= 2) {
        if (n % divisor === 0) {
          factors.push(divisor);
          n = n / divisor;
        } else {
          divisor++;
        }
      }
      
      return factors;
    }

    function romanToDecimal(roman: string): number {
      const romanNumerals: Record<string, number> = {
        'I': 1, 'V': 5, 'X': 10, 'L': 50,
        'C': 100, 'D': 500, 'M': 1000
      };
      
      let result = 0;
      let prevValue = 0;
      
      for (let i = roman.length - 1; i >= 0; i--) {
        const value = romanNumerals[roman[i]];
        if (value < prevValue) {
          result -= value;
        } else {
          result += value;
        }
        prevValue = value;
      }
      
      return result;
    }

    function decimalToRoman(num: number): string {
      const romanNumerals: [number, string][] = [
        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
      ];
      
      let result = '';
      
      for (const [value, numeral] of romanNumerals) {
        while (num >= value) {
          result += numeral;
          num -= value;
        }
      }
      
      return result;
    }

    function caesarCipher(text: string, shift: number): string {
      return text.replace(/[a-zA-Z]/g, (char) => {
        const code = char.charCodeAt(0);
        const base = code >= 65 && code <= 90 ? 65 : 97;
        return String.fromCharCode(((code - base + shift) % 26) + base);
      });
    }

    function vigenereCipher(text: string, key: string): string {
      let result = '';
      let keyIndex = 0;
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (/[a-zA-Z]/.test(char)) {
          const keyChar = key[keyIndex % key.length];
          const shift = keyChar.charCodeAt(0) - 65;
          result += caesarCipher(char, shift);
          keyIndex++;
        } else {
          result += char;
        }
      }
      
      return result;
    }

    function atbashCipher(text: string): string {
      return text.replace(/[a-zA-Z]/g, (char) => {
        const code = char.charCodeAt(0);
        const base = code >= 65 && code <= 90 ? 65 : 97;
        return String.fromCharCode(base + (25 - (code - base)));
      });
    }

    function base64Encode(str: string): string {
      return btoa(unescape(encodeURIComponent(str)));
    }

    function base64Decode(str: string): string {
      return decodeURIComponent(escape(atob(str)));
    }

    function urlEncode(str: string): string {
      return encodeURIComponent(str);
    }

    function urlDecode(str: string): string {
      return decodeURIComponent(str);
    }

    function htmlEncode(str: string): string {
      return str
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#39;');
    }

    function htmlDecode(str: string): string {
      return str
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/&#39;/g, "'");
    }

    function slugify(str: string): string {
      return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    function camelCase(str: string): string {
      return str
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
    }

    function kebabCase(str: string): string {
      return str
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    function snakeCase(str: string): string {
      return str
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    }

    function pascalCase(str: string): string {
      return camelCase(str).replace(/^[a-z]/, (m) => m.toUpperCase());
    }

    function truncate(str: string, length: number, suffix: string = '...'): string {
      if (str.length <= length) return str;
      return str.substring(0, length - suffix.length) + suffix;
    }

    function capitalize(str: string): string {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function reverse(str: string): string {
      return str.split('').reverse().join('');
    }

    function countWords(str: string): number {
      return str.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    function countCharacters(str: string, includeSpaces: boolean = true): number {
      return includeSpaces ? str.length : str.replace(/\s/g, '').length;
    }

    function countLines(str: string): number {
      return str.split('\n').length;
    }

    function countSentences(str: string): number {
      return str.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
    }

    function countParagraphs(str: string): number {
      return str.split(/\n\s*\n/).filter(paragraph => paragraph.trim().length > 0).length;
    }

    function levenshteinDistance(str1: string, str2: string): number {
      const matrix: number[][] = [];
      
      for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
      }
      
      for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
      }
      
      for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              matrix[i][j - 1] + 1,     // insertion
              matrix[i - 1][j] + 1      // deletion
            );
          }
        }
      }
      
      return matrix[str2.length][str1.length];
    }

    function fuzzySearch(pattern: string, text: string): boolean {
      let patternIndex = 0;
      
      for (let i = 0; i < text.length; i++) {
        if (text[i] === pattern[patternIndex]) {
          patternIndex++;
          if (patternIndex === pattern.length) {
            return true;
          }
        }
      }
      
      return false;
    }

    function binarySearch(arr: number[], target: number): number {
      let left = 0;
      let right = arr.length - 1;
      
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (arr[mid] === target) {
          return mid;
        } else if (arr[mid] < target) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }
      
      return -1;
    }

    function quickSort<T>(arr: T[]): T[] {
      if (arr.length <= 1) return arr;
      
      const pivot = arr[Math.floor(arr.length / 2)];
      const left = arr.filter(x => x < pivot);
      const middle = arr.filter(x => x === pivot);
      const right = arr.filter(x => x > pivot);
      
      return [...quickSort(left), ...middle, ...quickSort(right)];
    }

    function mergeSort<T>(arr: T[]): T[] {
      if (arr.length <= 1) return arr;
      
      const mid = Math.floor(arr.length / 2);
      const left = mergeSort(arr.slice(0, mid));
      const right = mergeSort(arr.slice(mid));
      
      return merge(left, right);
    }

    function merge<T>(left: T[], right: T[]): T[] {
      const result: T[] = [];
      let leftIndex = 0;
      let rightIndex = 0;
      
      while (leftIndex < left.length && rightIndex < right.length) {
        if (left[leftIndex] < right[rightIndex]) {
          result.push(left[leftIndex]);
          leftIndex++;
        } else {
          result.push(right[rightIndex]);
          rightIndex++;
        }
      }
      
      return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
    }

    function bubbleSort<T>(arr: T[]): T[] {
      const result = [...arr];
      const n = result.length;
      
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - i - 1; j++) {
          if (result[j] > result[j + 1]) {
            [result[j], result[j + 1]] = [result[j + 1], result[j]];
          }
        }
      }
      
      return result;
    }

    function insertionSort<T>(arr: T[]): T[] {
      const result = [...arr];
      
      for (let i = 1; i < result.length; i++) {
        const current = result[i];
        let j = i - 1;
        
        while (j >= 0 && result[j] > current) {
          result[j + 1] = result[j];
          j--;
        }
        
        result[j + 1] = current;
      }
      
      return result;
    }

    function selectionSort<T>(arr: T[]): T[] {
      const result = [...arr];
      const n = result.length;
      
      for (let i = 0; i < n - 1; i++) {
        let minIndex = i;
        
        for (let j = i + 1; j < n; j++) {
          if (result[j] < result[minIndex]) {
            minIndex = j;
          }
        }
        
        if (minIndex !== i) {
          [result[i], result[minIndex]] = [result[minIndex], result[i]];
        }
      }
      
      return result;
    }

    function heapSort<T>(arr: T[]): T[] {
      const result = [...arr];
      const n = result.length;
      
      // Build max heap
      for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
        heapify(result, n, i);
      }
      
      // Extract elements from heap
      for (let i = n - 1; i > 0; i--) {
        [result[0], result[i]] = [result[i], result[0]];
        heapify(result, i, 0);
      }
      
      return result;
    }

    function heapify<T>(arr: T[], n: number, i: number): void {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      
      if (left < n && arr[left] > arr[largest]) {
        largest = left;
      }
      
      if (right < n && arr[right] > arr[largest]) {
        largest = right;
      }
      
      if (largest !== i) {
        [arr[i], arr[largest]] = [arr[largest], arr[i]];
        heapify(arr, n, largest);
      }
    }

    function radixSort(arr: number[]): number[] {
      const result = [...arr];
      const max = Math.max(...result);
      let exp = 1;
      
      while (Math.floor(max / exp) > 0) {
        countingSortByDigit(result, exp);
        exp *= 10;
      }
      
      return result;
    }

    function countingSortByDigit(arr: number[], exp: number): void {
      const n = arr.length;
      const output: number[] = new Array(n);
      const count: number[] = new Array(10).fill(0);
      
      for (let i = 0; i < n; i++) {
        count[Math.floor(arr[i] / exp) % 10]++;
      }
      
      for (let i = 1; i < 10; i++) {
        count[i] += count[i - 1];
      }
      
      for (let i = n - 1; i >= 0; i--) {
        output[count[Math.floor(arr[i] / exp) % 10] - 1] = arr[i];
        count[Math.floor(arr[i] / exp) % 10]--;
      }
      
      for (let i = 0; i < n; i++) {
        arr[i] = output[i];
      }
    }

    function bucketSort(arr: number[]): number[] {
      if (arr.length === 0) return arr;
      
      const result = [...arr];
      const min = Math.min(...result);
      const max = Math.max(...result);
      const bucketCount = Math.ceil(Math.sqrt(result.length));
      const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
      
      // Distribute elements into buckets
      for (const num of result) {
        const bucketIndex = Math.floor((num - min) / (max - min + 1) * bucketCount);
        buckets[bucketIndex].push(num);
      }
      
      // Sort individual buckets and concatenate
      let index = 0;
      for (const bucket of buckets) {
        const sortedBucket = quickSort(bucket);
        for (const num of sortedBucket) {
          result[index++] = num;
        }
      }
      
      return result;
    }

    function linearSearch<T>(arr: T[], target: T): number {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === target) {
          return i;
        }
      }
      return -1;
    }

    function depthFirstSearch<T>(graph: Record<string, T[]>, start: string, target: T): T[] | null {
      const visited = new Set<string>();
      const path: T[] = [];
      
      function dfs(node: string): boolean {
        if (visited.has(node)) return false;
        visited.add(node);
        path.push(node as T);
        
        if (node === target) return true;
        
        for (const neighbor of graph[node] || []) {
          if (dfs(neighbor as string)) {
            return true;
          }
        }
        
        path.pop();
        return false;
      }
      
      return dfs(start) ? path : null;
    }

    function breadthFirstSearch<T>(graph: Record<string, T[]>, start: string, target: T): T[] | null {
      const queue: string[] = [start];
      const visited = new Set<string>([start]);
      const parent: Record<string, string> = { [start]: '' };
      
      while (queue.length > 0) {
        const node = queue.shift()!;
        
        if (node === target) {
          const path: T[] = [];
          let current = node;
          while (current) {
            path.unshift(current as T);
            current = parent[current];
          }
          return path;
        }
        
        for (const neighbor of graph[node] || []) {
          if (!visited.has(neighbor as string)) {
            visited.add(neighbor as string);
            parent[neighbor as string] = node;
            queue.push(neighbor as string);
          }
        }
      }
      
      return null;
    }

    function dijkstra<T>(graph: Record<string, Record<string, number>>, start: string, end: string): { distance: number; path: string[] } | null {
      const distances: Record<string, number> = {};
      const previous: Record<string, string> = {};
      const unvisited = new Set<string>();
      
      // Initialize distances
      for (const node in graph) {
        distances[node] = Infinity;
        unvisited.add(node);
      }
      distances[start] = 0;
      
      while (unvisited.size > 0) {
        // Find node with minimum distance
        let current = '';
        let minDistance = Infinity;
        
        for (const node of unvisited) {
          if (distances[node] < minDistance) {
            minDistance = distances[node];
            current = node;
          }
        }
        
        if (minDistance === Infinity) break;
        
        unvisited.delete(current);
        
        if (current === end) break;
        
        // Update distances to neighbors
        for (const neighbor in graph[current]) {
          const distance = distances[current] + graph[current][neighbor];
          if (distance < distances[neighbor]) {
            distances[neighbor] = distance;
            previous[neighbor] = current;
          }
        }
      }
      
      if (distances[end] === Infinity) return null;
      
      // Reconstruct path
      const path: string[] = [];
      let current = end;
      while (current) {
        path.unshift(current);
        current = previous[current];
      }
      
      return { distance: distances[end], path };
    }

    function aStar<T>(graph: Record<string, Record<string, number>>, start: string, end: string, heuristic: (node: string, goal: string) => number): string[] | null {
      const openSet = new Set<string>([start]);
      const closedSet = new Set<string>();
      const gScore: Record<string, number> = { [start]: 0 };
      const fScore: Record<string, number> = { [start]: heuristic(start, end) };
      const cameFrom: Record<string, string> = {};
      
      while (openSet.size > 0) {
        // Find node with minimum fScore
        let current = '';
        let minFScore = Infinity;
        
        for (const node of openSet) {
          if (fScore[node] < minFScore) {
            minFScore = fScore[node];
            current = node;
          }
        }
        
        if (current === end) {
          // Reconstruct path
          const path: string[] = [];
          let temp = end;
          while (temp) {
            path.unshift(temp);
            temp = cameFrom[temp];
          }
          return path;
        }
        
        openSet.delete(current);
        closedSet.add(current);
        
        for (const neighbor in graph[current]) {
          if (closedSet.has(neighbor)) continue;
          
          const tentativeGScore = gScore[current] + graph[current][neighbor];
          
          if (!openSet.has(neighbor)) {
            openSet.add(neighbor);
          } else if (tentativeGScore >= gScore[neighbor]) {
            continue;
          }
          
          cameFrom[neighbor] = current;
          gScore[neighbor] = tentativeGScore;
          fScore[neighbor] = gScore[neighbor] + heuristic(neighbor, end);
        }
      }
      
      return null;
    }

    function kMeans(data: number[][], k: number, maxIterations: number = 100): number[][] {
      // Initialize centroids randomly
      const centroids = data.slice(0, k);
      
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        // Assign points to nearest centroid
        const clusters: number[][] = Array.from({ length: k }, () => []);
        
        for (const point of data) {
          let minDistance = Infinity;
          let closestCentroid = 0;
          
          for (let i = 0; i < k; i++) {
            const distance = euclideanDistance(point, centroids[i]);
            if (distance < minDistance) {
              minDistance = distance;
              closestCentroid = i;
            }
          }
          
          clusters[closestCentroid].push(point);
        }
        
        // Update centroids
        let changed = false;
        for (let i = 0; i < k; i++) {
          const newCentroid = calculateCentroid(clusters[i]);
          if (!arraysEqual(centroids[i], newCentroid)) {
            changed = true;
            centroids[i] = newCentroid;
          }
        }
        
        if (!changed) break;
      }
      
      return centroids;
    }

    function euclideanDistance(point1: number[], point2: number[]): number {
      return Math.sqrt(point1.reduce((sum, val, i) => sum + Math.pow(val - point2[i], 2), 0));
    }

    function calculateCentroid(points: number[][]): number[] {
      if (points.length === 0) return [];
      
      const dimensions = points[0].length;
      const centroid = new Array(dimensions).fill(0);
      
      for (const point of points) {
        for (let i = 0; i < dimensions; i++) {
          centroid[i] += point[i];
        }
      }
      
      return centroid.map(val => val / points.length);
    }

    function arraysEqual(arr1: number[], arr2: number[]): boolean {
      return arr1.length === arr2.length && arr1.every((val, i) => val === arr2[i]);
    }

    function kNearestNeighbors(data: number[][], labels: string[], query: number[], k: number): string {
      const distances = data.map((point, i) => ({
        distance: euclideanDistance(point, query),
        label: labels[i]
      }));
      
      distances.sort((a, b) => a.distance - b.distance);
      
      const kLabels = distances.slice(0, k).map(d => d.label);
      const labelCounts = countOccurrences(kLabels);
      
      return Object.entries(labelCounts).reduce((a, b) => labelCounts[a[0]] > labelCounts[b[0]] ? a[0] : b[0]);
    }

    function countOccurrences(arr: string[]): Record<string, number> {
      return arr.reduce((counts, item) => {
        counts[item] = (counts[item] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
    }

    function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
      const n = x.length;
      const sumX = sum(x);
      const sumY = sum(y);
      const sumXY = sum(x.map((val, i) => val * y[i]));
      const sumXX = sum(x.map(val => val * val));
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      const predictedY = x.map(val => slope * val + intercept);
      const rSquared = calculateRSquared(y, predictedY);
      
      return { slope, intercept, rSquared };
    }

    function calculateRSquared(actual: number[], predicted: number[]): number {
      const meanActual = average(actual);
      const totalSumSquares = sum(actual.map(val => Math.pow(val - meanActual, 2)));
      const residualSumSquares = sum(actual.map((val, i) => Math.pow(val - predicted[i], 2)));
      
      return 1 - (residualSumSquares / totalSumSquares);
    }

    function logisticRegression(x: number[], y: number[], learningRate: number = 0.01, iterations: number = 1000): { weights: number[]; bias: number } {
      const n = x.length;
      let weights = [0, 0]; // [bias, slope]
      
      for (let i = 0; i < iterations; i++) {
        const predictions = x.map(val => sigmoid(weights[0] + weights[1] * val));
        const errors = predictions.map((pred, j) => pred - y[j]);
        
        // Update weights
        weights[0] -= learningRate * sum(errors) / n;
        weights[1] -= learningRate * sum(errors.map((error, j) => error * x[j])) / n;
      }
      
      return { weights: weights.slice(1), bias: weights[0] };
    }

    function sigmoid(x: number): number {
      return 1 / (1 + Math.exp(-x));
    }

    function decisionTree(data: any[], target: string, features: string[]): any {
      // Simplified decision tree implementation
      if (data.length === 0) return null;
      
      const uniqueTargetValues = [...new Set(data.map(row => row[target]))];
      if (uniqueTargetValues.length === 1) {
        return { type: 'leaf', value: uniqueTargetValues[0] };
      }
      
      if (features.length === 0) {
        const counts = countOccurrences(data.map(row => row[target]));
        const majority = Object.entries(counts).reduce((a, b) => counts[a[0]] > counts[b[0]] ? a[0] : b[0]);
        return { type: 'leaf', value: majority };
      }
      
      // Find best feature to split on
      let bestFeature = '';
      let bestGain = -1;
      
      for (const feature of features) {
        const gain = calculateInformationGain(data, target, feature);
        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = feature;
        }
      }
      
      if (bestGain <= 0) {
        const counts = countOccurrences(data.map(row => row[target]));
        const majority = Object.entries(counts).reduce((a, b) => counts[a[0]] > counts[b[0]] ? a[0] : b[0]);
        return { type: 'leaf', value: majority };
      }
      
      const remainingFeatures = features.filter(f => f !== bestFeature);
      const uniqueFeatureValues = [...new Set(data.map(row => row[bestFeature]))];
      
      const tree = {
        type: 'node',
        feature: bestFeature,
        branches: {} as Record<string, any>
      };
      
      for (const value of uniqueFeatureValues) {
        const subset = data.filter(row => row[bestFeature] === value);
        tree.branches[value] = decisionTree(subset, target, remainingFeatures);
      }
      
      return tree;
    }

    function calculateInformationGain(data: any[], target: string, feature: string): number {
      const entropy = calculateEntropy(data.map(row => row[target]));
      
      const uniqueFeatureValues = [...new Set(data.map(row => row[feature]))];
      let weightedEntropy = 0;
      
      for (const value of uniqueFeatureValues) {
        const subset = data.filter(row => row[feature] === value);
        const weight = subset.length / data.length;
        const subsetEntropy = calculateEntropy(subset.map(row => row[target]));
        weightedEntropy += weight * subsetEntropy;
      }
      
      return entropy - weightedEntropy;
    }

    function calculateEntropy(labels: string[]): number {
      const counts = countOccurrences(labels);
      const total = labels.length;
      let entropy = 0;
      
      for (const count of Object.values(counts)) {
        const probability = count / total;
        entropy -= probability * Math.log2(probability);
      }
      
      return entropy;
    }

    function randomForest(data: any[], target: string, features: string[], nTrees: number = 10): any {
      const trees: any[] = [];
      
      for (let i = 0; i < nTrees; i++) {
        // Bootstrap sampling
        const bootstrapSample = [];
        for (let j = 0; j < data.length; j++) {
          const randomIndex = Math.floor(Math.random() * data.length);
          bootstrapSample.push(data[randomIndex]);
        }
        
        // Random feature selection
        const randomFeatures = features.slice().sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.sqrt(features.length)));
        
        const tree = decisionTree(bootstrapSample, target, randomFeatures);
        trees.push(tree);
      }
      
      return trees;
    }

    function neuralNetwork(inputSize: number, hiddenSize: number, outputSize: number): any {
      const weights1 = Array.from({ length: inputSize }, () => 
        Array.from({ length: hiddenSize }, () => Math.random() * 2 - 1)
      );
      const weights2 = Array.from({ length: hiddenSize }, () => 
        Array.from({ length: outputSize }, () => Math.random() * 2 - 1)
      );
      const bias1 = Array.from({ length: hiddenSize }, () => Math.random() * 2 - 1);
      const bias2 = Array.from({ length: outputSize }, () => Math.random() * 2 - 1);
      
      return {
        weights1,
        weights2,
        bias1,
        bias2,
        forward: (input: number[]) => {
          const hidden = input.map((_, i) => 
            sigmoid(input.reduce((sum, val, j) => sum + val * weights1[j][i], 0) + bias1[i])
          );
          
          const output = hidden.map((_, i) => 
            sigmoid(hidden.reduce((sum, val, j) => sum + val * weights2[j][i], 0) + bias2[i])
          );
          
          return output;
        }
      };
    }

    function detectMood(message: string): { score: number; type: string; confidence: number } | null {
      const positiveWords = ['feliz', 'contento', 'alegre', 'bien', 'genial', 'excelente', 'maravilloso'];
      const negativeWords = ['triste', 'enojado', 'mal', 'horrible', 'terrible', 'odio', 'malo'];
      
      const messageLower = message.toLowerCase();
      const positiveCount = positiveWords.filter(word => messageLower.includes(word)).length;
      const negativeCount = negativeWords.filter(word => messageLower.includes(word)).length;
      
      if (positiveCount > negativeCount) {
        return { score: positiveCount / message.split(' ').length, type: 'positive', confidence: 0.8 };
      } else if (negativeCount > positiveCount) {
        return { score: -negativeCount / message.split(' ').length, type: 'negative', confidence: 0.8 };
      }
      
      return null;
    }

    function detectTopics(message: string): string[] {
      const topics: string[] = [];
      const messageLower = message.toLowerCase();
      
      const topicKeywords: Record<string, string[]> = {
        'tecnología': ['computadora', 'programación', 'internet', 'software', 'hardware', 'app', 'aplicación'],
        'educación': ['escuela', 'clase', 'estudio', 'libro', 'profesor', 'tarea', 'examen'],
        'familia': ['papá', 'mamá', 'hermano', 'hermana', 'abuelo', 'abuela', 'familia'],
        'juegos': ['jugar', 'videojuego', 'juego', 'consola', 'juguetes'],
        'deportes': ['fútbol', 'baloncesto', 'tenis', 'deporte', 'entrenamiento', 'equipo']
      };
      
      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some(keyword => messageLower.includes(keyword))) {
          topics.push(topic);
        }
      }
      
      return topics;
    }

    // Ruta por defecto
    return new Response(JSON.stringify({ error: 'Ruta no encontrada' }), {
      status: 404,
      headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
    });
  }
};