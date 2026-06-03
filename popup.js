const i18n = chrome.i18n.getMessage.bind(chrome.i18n);

document.getElementById('label-asunto').textContent = i18n('label_subject');
document.getElementById('label-desde').textContent = i18n('label_desde');
document.getElementById('label-hasta').textContent = i18n('label_hasta');
document.getElementById('asunto').placeholder = i18n('placeholder_subject');
document.getElementById('btn').textContent = i18n('btn_download');

// Valores por defecto: primer día del mes actual hasta hoy
const hoy = new Date();
const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
document.getElementById('hasta').value = hoy.toISOString().slice(0, 10);
document.getElementById('desde').value = primerDiaMes.toISOString().slice(0, 10);

function extraerAdjuntos(partes) {
  let adjuntos = [];
  if (!partes) return adjuntos;
  for (const parte of partes) {
    if (parte.filename && parte.filename.length > 0 && parte.body.attachmentId) {
      adjuntos.push(parte);
    }
    if (parte.parts) {
      adjuntos = adjuntos.concat(extraerAdjuntos(parte.parts));
    }
  }
  return adjuntos;
}

function actualizarProgreso(actual, total, texto) {
  const porcentaje = Math.round((actual / total) * 100);
  document.getElementById('progreso-barra').style.width = porcentaje + '%';
  document.getElementById('progreso-texto').textContent = texto + ' (' + actual + '/' + total + ')';
}

async function contarAdjuntos(token, query, desde, hasta) {
  const fechaDesde = Math.floor(new Date(desde).getTime() / 1000);
  const fechaHasta = Math.floor(new Date(hasta).getTime() / 1000) + 86400; // incluir el día completo
  const q = encodeURIComponent(`subject:"${query}" after:${fechaDesde} before:${fechaHasta}`);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=50`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!data.messages) return { mensajes: [], total: 0 };

  let total = 0;
  const mensajes = [];
  for (const msg of data.messages) {
    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const msgData = await msgRes.json();
    const adjuntos = extraerAdjuntos(msgData.payload.parts);
    if (adjuntos.length > 0) {
      mensajes.push({ id: msg.id, adjuntos });
      total += adjuntos.length;
    }
  }
  return { mensajes, total };
}

async function descargarAdjuntos(token, mensajes, zip, totalGlobal, yaDescargados) {
  let descargados = yaDescargados;
  for (const msg of mensajes) {
    for (const parte of msg.adjuntos) {
      const attRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${parte.body.attachmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const attData = await attRes.json();
      const base64 = attData.data.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      let nombreFinal = parte.filename;
      if (zip.files[nombreFinal]) {
        const ext = nombreFinal.includes('.') ? '.' + nombreFinal.split('.').pop() : '';
        const base = ext ? nombreFinal.slice(0, -ext.length) : nombreFinal;
        let contador = 1;
        while (zip.files[`${base} (${contador})${ext}`]) contador++;
        nombreFinal = `${base} (${contador})${ext}`;
      }
      zip.file(nombreFinal, bytes);
      descargados++;
      actualizarProgreso(descargados, totalGlobal, i18n('status_downloading'));
    }
  }
  return descargados;
}

document.getElementById('btn').addEventListener('click', async () => {
  const estado = document.getElementById('estado');
  const asunto = document.getElementById('asunto').value.trim();
  const desde = document.getElementById('desde').value;
  const hasta = document.getElementById('hasta').value;
  const btn = document.getElementById('btn');
  const progresoContainer = document.getElementById('progreso-container');

  if (!asunto) {
    estado.className = 'error';
    estado.textContent = i18n('status_no_subject');
    return;
  }
  if (!desde || !hasta) {
    estado.className = 'error';
    estado.textContent = i18n('status_no_dates');
    return;
  }
  if (desde > hasta) {
    estado.className = 'error';
    estado.textContent = i18n('status_invalid_dates');
    return;
  }

  estado.className = '';
  estado.textContent = i18n('status_connecting');
  btn.disabled = true;
  progresoContainer.style.display = 'none';
  document.getElementById('progreso-barra').style.width = '0%';

  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(token);
      });
    });

    estado.textContent = i18n('status_searching');
    const { mensajes, total } = await contarAdjuntos(token, asunto, desde, hasta);

    if (total === 0) {
      estado.className = 'error';
      estado.textContent = i18n('status_empty');
      btn.disabled = false;
      return;
    }

    progresoContainer.style.display = 'block';
    actualizarProgreso(0, total, i18n('status_downloading'));

    const zip = new JSZip();
    await descargarAdjuntos(token, mensajes, zip, total, 0);

    actualizarProgreso(total, total, i18n('status_generating'));
    estado.textContent = i18n('status_generating');

    const blob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      const porcentaje = Math.round(metadata.percent);
      document.getElementById('progreso-barra').style.width = porcentaje + '%';
      document.getElementById('progreso-texto').textContent = i18n('status_compressing') + ' ' + porcentaje + '%';
    });

    const url = URL.createObjectURL(blob);
    const fecha = new Date().toISOString().slice(0, 10);
    await chrome.downloads.download({ url, filename: `GmailZip_${fecha}.zip`, saveAs: false });
    URL.revokeObjectURL(url);

    estado.className = 'ok';
    estado.textContent = `✅ ${total} ${i18n('status_done')} GmailZip_${fecha}.zip`;

  } catch (err) {
    estado.className = 'error';
    estado.textContent = 'Error: ' + err.message;
  } finally {
    btn.disabled = false;
  }
});