// upload-cloudinary.js - VERSIÓN FUNCIONAL COMPLETA
(function () {
  const CLOUD_NAME = 'dan8sipgs';
  const UPLOAD_PRESET = 'rosayclavel2025ventanilla';
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxrtN24l9-wpzsYhGd-wUKxKq4WydKuNzS4mTZNGIV6tloFB-AyT4CiVocCBPolqGJePA/exec';

  async function uploadFilesToCloudinary(files) {
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', UPLOAD_PRESET);

      const res = await fetch(uploadUrl, { 
        method: 'POST', 
        body: fd 
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Cloudinary upload failed: ${res.status} - ${errorText}`);
      }
      
      const data = await res.json();
      uploaded.push({
        url: data.secure_url,
        public_id: data.public_id,
        original_filename: data.original_filename,
        format: data.format,
        bytes: data.bytes
      });
    }
    return uploaded;
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('#submitBtn');
    const formMessage = document.getElementById('formMessage');
    const originalBtnText = submitBtn.innerHTML;

    const showMessage = (msg, type = '') => {
      if (!formMessage) return;
      formMessage.textContent = msg;
      formMessage.className = `form-message ${type}`;
      formMessage.style.display = 'block';
    };

    try {
      const name = (form.querySelector('#name')?.value || '').trim();
      const email = (form.querySelector('#email')?.value || '').trim();
      const photos = form.querySelector('#photos')?.files;
      const category = form.querySelector('#category')?.value || '';
      const message = (form.querySelector('#message')?.value || '').trim();

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
          showMessage(`"${file.name}" es demasiado grande. Máximo 5MB por archivo.`, 'error');
          return;
        }
      }

      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
      submitBtn.disabled = true;
      if (formMessage) formMessage.style.display = 'none';

      const uploadedImages = await uploadFilesToCloudinary(photos);

      const payload = {
        name,
        email,
        category,
        message,
        timestamp: new Date().toISOString(),
        images: uploadedImages
      };

      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let result;
      
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        if (responseText.includes('success') && responseText.includes('true')) {
          result = { success: true, message: 'Fotos recibidas correctamente' };
        } else {
          throw new Error('Respuesta del servidor no es JSON válido');
        }
      }

      if (result && result.success === true) {
        const successMsg = result.message || '¡Éxito! Tus fotos fueron subidas correctamente.';
        showMessage(successMsg, 'success');
        form.reset();
      } else {
        const errorMsg = result?.message || result?.error || 'Error al procesar tu envío.';
        showMessage(errorMsg, 'error');
      }

    } catch (error) {
      if (error.message.includes('Cloudinary upload failed')) {
        showMessage('Error al subir las imágenes. Verifica que sean archivos de imagen válidos.', 'error');
      } else if (error.message.includes('Failed to fetch')) {
        showMessage('Error de conexión. Verifica tu internet e inténtalo de nuevo.', 'error');
      } else if (error.message.includes('Respuesta del servidor no es JSON válido')) {
        showMessage('Las fotos se subieron pero hubo un problema de comunicación. Contacta al organizador.', 'error');
      } else {
        showMessage('Error: ' + error.message, 'error');
      }
    } finally {
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('photoUploadForm');
    if (!form) {
      console.error('No se encontró el formulario con ID photoUploadForm');
      return;
    }

    if (form.__cloudinary_initialized) {
      return;
    }

    form.__cloudinary_initialized = true;
    form.addEventListener('submit', handleFormSubmit);
  });
})();
