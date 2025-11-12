// upload-cloudinary.js - VERSIÓN FINAL CON URL CORRECTA
(function () {
  const CLOUD_NAME = 'dan8sipgs';
  const UPLOAD_PRESET = 'rosayclavel2025ventanilla';
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMe0ZhMBNFyRMKMerZzT9_JRkP8fJ2ok1b69jLnth2047gnZSzWk82Xskxp__uSRRa_A/exec';

  console.log('🚀 Script cargado correctamente');
  console.log('🔗 URL destino:', SCRIPT_URL);

  async function uploadFilesToCloudinary(files) {
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📤 Subiendo imagen ${i + 1}/${files.length}: ${file.name}`);
      
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', UPLOAD_PRESET);

      const res = await fetch(uploadUrl, { 
        method: 'POST', 
        body: fd 
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Error Cloudinary:', errorText);
        throw new Error(`Error subiendo imagen: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('✅ Imagen subida:', data.secure_url);
      
      uploaded.push({
        url: data.secure_url,
        public_id: data.public_id,
        original_filename: data.original_filename || file.name,
        format: data.format,
        bytes: data.bytes
      });
    }
    return uploaded;
  }

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
        mode: 'no-cors', // Evita error CORS
        headers: {
          'Content-Type': 'text/plain', // Cambiar a text/plain para evitar preflight
        },
        body: JSON.stringify(payload)
      });

      console.log('✅ Petición enviada (modo no-cors)');
      // En modo no-cors no podemos leer la respuesta, pero si llegó aquí, se envió
      return { success: true, message: 'Datos enviados correctamente' };
      
    } catch (error) {
      console.error('❌ Error enviando:', error);
      throw error;
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('#submitBtn');
    const formMessage = document.getElementById('formMessage');
    const originalBtnText = submitBtn.innerHTML;

    console.log('📝 Formulario enviado');

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

  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForm);
  } else {
    initForm();
  }

  function initForm() {
    console.log('🔧 Inicializando formulario...');
    
    const form = document.getElementById('photoUploadForm');
    if (!form) {
      console.error('❌ Formulario no encontrado');
      return;
    }

    if (form.__cloudinary_initialized) {
      console.log('⚠️ Ya inicializado');
      return;
    }

    form.__cloudinary_initialized = true;
    form.addEventListener('submit', handleFormSubmit);
    console.log('✅ Formulario listo');
  }
})();
