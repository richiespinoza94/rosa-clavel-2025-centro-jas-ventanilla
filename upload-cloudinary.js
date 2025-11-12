// upload-cloudinary.js
// Minimal, self-contained Cloudinary uploader + send URLs to Google Apps Script.
// No globals leaked, no changes to DOM structure or styles.

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

      // IMPORTANT: Do not set Content-Type header; browser handles it for FormData
      const res = await fetch(uploadUrl, { method: 'POST', body: fd });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Cloudinary upload failed: ${res.status} ${txt}`);
      }
      const data = await res.json();
      uploaded.push({
        url: data.secure_url || data.url,
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
    const originalBtn = submitBtn ? submitBtn.innerHTML : '';
    const formMessage = document.getElementById('formMessage');

    function show(msg, type) {
      if (!formMessage) return;
      formMessage.textContent = msg;
      formMessage.className = 'form-message ' + (type || ''); 
      formMessage.style.display = 'block';
    }

    try {
      const name = form.querySelector('#name').value.trim();
      const email = form.querySelector('#email').value.trim();
      const photos = form.querySelector('#photos').files;
      if (!name || !email) {
        show('Por favor, completa todos los campos obligatorios.', 'error');
        return;
      }
      if (!photos || photos.length === 0) {
        show('Por favor, selecciona al menos una foto.', 'error');
        return;
      }
      if (photos.length > 5) {
        show('Por favor, selecciona un máximo de 5 fotos.', 'error');
        return;
      }
      for (let f of photos) {
        if (f.size > 5 * 1024 * 1024) {
          show(`El archivo "${f.name}" es demasiado grande. Máximo 5MB por archivo.`, 'error');
          return;
        }
      }

      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        submitBtn.disabled = true;
      }
      if (formMessage) formMessage.style.display = 'none';

      // 1) subir a Cloudinary
      const uploaded = await uploadFilesToCloudinary(photos);

      // 2) enviar metadata + URLs al Apps Script
      const payload = {
        name: name,
        email: email,
        category: form.querySelector('#category')?.value || '',
        message: form.querySelector('#message')?.value.trim() || '',
        timestamp: new Date().toISOString(),
        images: uploaded
      };

      const resp = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await resp.json();
      if (result && result.success) {
        show('¡Gracias! Tus fotos fueron subidas correctamente.', 'success');
        form.reset();
      } else {
        console.error('Apps Script response:', result);
        show('Hubo un error registrando el envío. Intenta de nuevo.', 'error');
      }

    } catch (err) {
      console.error(err);
      show('Error al subir imágenes. Verifica tu conexión e inténtalo de nuevo.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.innerHTML = originalBtn;
        submitBtn.disabled = false;
      }
    }
  }

  // Bind safely after DOM ready; avoid double-binding
  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('photoUploadForm');
    if (form && !form.__cloudinary_bound__) {
      form.addEventListener('submit', handleFormSubmit);
      form.__cloudinary_bound__ = true;
    }
  });
})();
