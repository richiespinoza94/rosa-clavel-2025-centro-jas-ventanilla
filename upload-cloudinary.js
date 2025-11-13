/**
 * ========================================
 * MÓDULO DE SUBIDA DE FOTOS A CLOUDINARY
 * ========================================
 *
 * Archivo: upload-cloudinary.js
 * Propósito: Gestionar la subida de fotos del evento Rosa y Clavel
 *           a Cloudinary y almacenar metadatos en Google Apps Script
 *
 * Flujo del proceso:
 * 1. Usuario completa formulario con fotos
 * 2. Se validan archivos (cantidad, tamaño, tipo)
 * 3. Se suben imágenes a Cloudinary CDN
 * 4. Se envían metadatos a Google Apps Script para registro
 * 5. Se muestra confirmación al usuario
 *
 * Dependencias:
 * - Cloudinary API (para almacenamiento de imágenes)
 * - Google Apps Script (para recopilación de datos)
 * - Navegador moderno con soporte para Fetch API y FormData
 */

(function () {
  // ===== CONFIGURACIÓN GLOBAL =====

  /**
   * Credenciales y URLs para servicios externos
   * NOTA: UPLOAD_PRESET es público (es normal en Cloudinary)
   */
  const CLOUD_NAME = 'dan8sipgs';
  const UPLOAD_PRESET = 'rosayclavel2025ventanilla';
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMe0ZhMBNFyRMKMerZzT9_JRkP8fJ2ok1b69jLnth2047gnZSzWk82Xskxp__uSRRa_A/exec';

  console.log('🚀 Script cargado correctamente');
  console.log('🔗 URL destino:', SCRIPT_URL);

  // ===== FUNCIONES DE SUBIDA Y ALMACENAMIENTO =====

  /**
   * Sube múltiples archivos a Cloudinary en forma secuencial
   *
   * Proceso:
   * 1. Itera sobre cada archivo
   * 2. Prepara FormData con el archivo y preset de subida
   * 3. Envía a la API de Cloudinary
   * 4. Extrae información relevante de la respuesta
   * 5. Retorna array con URLs y metadatos de imágenes
   *
   * @async
   * @param {FileList} files - Lista de archivos a subir (de input type="file")
   * @returns {Promise<Array>} Array de objetos con datos de imágenes subidas
   * @throws {Error} Si hay error subiendo una imagen o respuesta inválida
   *
   * @example
   * const uploadedImages = await uploadFilesToCloudinary(formFiles);
   * // Retorna:
   * // [
   * //   {
   * //     url: "https://res.cloudinary.com/...",
   * //     public_id: "rosayclavel_...",
   * //     original_filename: "foto.jpg",
   * //     format: "jpg",
   * //     bytes: 125000
   * //   },
   * //   ...
   * // ]
   */
  async function uploadFilesToCloudinary(files) {
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
    const uploaded = [];

    // Procesa cada archivo de forma secuencial (no paralela)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📤 Subiendo imagen ${i + 1}/${files.length}: ${file.name}`);

      // Prepara los datos para enviar a Cloudinary
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', UPLOAD_PRESET);

      // Envía la imagen a Cloudinary
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: fd
      });

      // Valida la respuesta
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Error Cloudinary:', errorText);
        throw new Error(`Error subiendo imagen: ${res.status}`);
      }

      // Extrae la información de la imagen subida
      const data = await res.json();
      console.log('✅ Imagen subida:', data.secure_url);

      // Almacena metadatos de la imagen
      uploaded.push({
        url: data.secure_url,              // URL segura para acceder a la imagen
        public_id: data.public_id,         // ID único en Cloudinary
        original_filename: data.original_filename || file.name, // Nombre original
        format: data.format,               // Formato de archivo (jpg, png, etc)
        bytes: data.bytes                  // Tamaño en bytes
      });
    }
    return uploaded;
  }

  /**
   * Envía metadatos del formulario a Google Apps Script
   *
   * Google Apps Script almacena los datos en una hoja de cálculo para
   * mantener registro de contribuciones fotográficas del evento.
   *
   * Nota sobre CORS:
   * - Utiliza mode: 'no-cors' para evitar errores de política CORS
   * - No podemos leer la respuesta en modo no-cors
   * - Google Apps Script procesa la solicitud aunque no veamos respuesta
   *
   * @async
   * @param {Object} payload - Objeto con datos a enviar
   * @param {string} payload.name - Nombre completo del usuario
   * @param {string} payload.email - Correo electrónico
   * @param {string} payload.category - Categoría de fotos
   * @param {string} payload.message - Mensaje opcional del usuario
   * @param {string} payload.timestamp - Marca de tiempo ISO
   * @param {Array} payload.images - Array de objetos con datos de imágenes
   * @returns {Promise<Object>} Objeto con confirmación de envío
   * @throws {Error} Si hay error en la conexión de red
   */
  async function sendToGoogleScript(payload) {
    console.log('📤 Enviando a Google Apps Script...');
    console.log('📦 Payload:', {
      name: payload.name,
      email: payload.email,
      images: payload.images.length
    });

    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Evita errores de CORS entre dominios
        headers: {
          'Content-Type': 'text/plain', // Evita petición preflight OPTIONS
        },
        body: JSON.stringify(payload)
      });

      console.log('✅ Petición enviada (modo no-cors)');
      // En modo no-cors no podemos leer la respuesta, pero la petición se procesó
      return { success: true, message: 'Datos enviados correctamente' };

    } catch (error) {
      console.error('❌ Error enviando:', error);
      throw error;
    }
  }

  /**
   * Manejador principal del envío del formulario
   *
   * Orquesta el proceso completo:
   * 1. Previene envío estándar del formulario
   * 2. Extrae y valida datos
   * 3. Sube archivos a Cloudinary
   * 4. Envía metadatos a Google Apps Script
   * 5. Muestra confirmación al usuario
   *
   * Validaciones:
   * - Nombre y correo son obligatorios
   * - Se requiere al menos 1 foto
   * - Máximo 5 fotos permitidas
   * - Tamaño máximo 5MB por archivo
   *
   * @async
   * @param {Event} e - Evento de envío del formulario
   */
  async function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('#submitBtn');
    const formMessage = document.getElementById('formMessage');
    const originalBtnText = submitBtn.innerHTML;

    console.log('📝 Formulario enviado');

    /**
     * Muestra un mensaje al usuario
     * @param {string} msg - Texto del mensaje
     * @param {string} type - Tipo de mensaje: 'success' o 'error'
     */
    const showMessage = (msg, type = '') => {
      if (!formMessage) return;
      formMessage.textContent = msg;
      formMessage.className = `form-message ${type}`;
      formMessage.style.display = 'block';
      console.log(`💬 ${type.toUpperCase()}: ${msg}`);
    };

    try {
      const name = (form.querySelector('#name')?.value || '').trim();
      const email = (form.querySelector('#email')?.value || '').trim();
      const photos = form.querySelector('#photos')?.files;
      const category = form.querySelector('#category')?.value || '';
      const message = (form.querySelector('#message')?.value || '').trim();

      console.log('📋 Datos:', { name, email, photos: photos?.length, category });

      // Validaciones
      if (!name || !email) {
        showMessage('Por favor, completa todos los campos obligatorios.', 'error');
        return;
      }
      if (!photos || photos.length === 0) {
        showMessage('Por favor, selecciona al menos una foto.', 'error');
        return;
      }
      if (photos.length > 5) {
        showMessage('Máximo 5 fotos permitidas.', 'error');
        return;
      }

      for (const file of photos) {
        if (file.size > 5 * 1024 * 1024) {
          showMessage(`"${file.name}" es demasiado grande. Máximo 5MB.`, 'error');
          return;
        }
      }

      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo fotos...';
      submitBtn.disabled = true;
      if (formMessage) formMessage.style.display = 'none';

      // PASO 1: Subir a Cloudinary
      console.log('☁️ Subiendo a Cloudinary...');
      const uploadedImages = await uploadFilesToCloudinary(photos);
      console.log('✅ Cloudinary OK:', uploadedImages.length, 'imágenes');

      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando información...';

      // PASO 2: Enviar a Google
      const payload = {
        name,
        email,
        category,
        message,
        timestamp: new Date().toISOString(),
        images: uploadedImages
      };

      await sendToGoogleScript(payload);

      console.log('🎉 ¡PROCESO COMPLETADO!');
      showMessage('¡Éxito! Tus fotos fueron subidas correctamente. Gracias por compartir tus recuerdos.', 'success');
      form.reset();

    } catch (error) {
      console.error('❌ ERROR:', error);
      
      if (error.message.includes('Error subiendo imagen')) {
        showMessage('Error al subir las imágenes. Verifica que sean archivos válidos.', 'error');
      } else if (error.message.includes('Failed to fetch')) {
        showMessage('Error de conexión. Verifica tu internet.', 'error');
      } else {
        showMessage('Error: ' + error.message, 'error');
      }
    } finally {
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
    }
  }

  // ===== INICIALIZACIÓN DEL MÓDULO =====

  /**
   * Espera a que el DOM esté completamente cargado
   * Asegura que el formulario existe antes de asignar manejadores
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForm);
  } else {
    initForm();
  }

  /**
   * Inicializa el formulario de carga de fotos
   *
   * Responsabilidades:
   * 1. Verifica que el formulario exista en el DOM
   * 2. Evita inicializar múltiples veces (flag __cloudinary_initialized)
   * 3. Asigna el manejador de evento 'submit' al formulario
   * 4. Registra el estado en la consola
   *
   * NOTA: Utiliza un flag personalizado en el elemento DOM para evitar
   *       inicializaciones duplicadas (útil si el script se carga múltiples veces)
   */
  function initForm() {
    console.log('🔧 Inicializando formulario...');

    const form = document.getElementById('photoUploadForm');
    if (!form) {
      console.error('❌ Formulario no encontrado');
      return;
    }

    // Previene inicializaciones duplicadas
    if (form.__cloudinary_initialized) {
      console.log('⚠️ Ya inicializado - evitando duplicados');
      return;
    }

    // Marca como inicializado y asigna manejador
    form.__cloudinary_initialized = true;
    form.addEventListener('submit', handleFormSubmit);
    console.log('✅ Formulario listo para recibir fotos');
  }
})();
