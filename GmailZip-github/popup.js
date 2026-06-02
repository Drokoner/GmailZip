const i18n = chrome.i18n.getMessage.bind(chrome.i18n);

document.getElementById('label-asunto').textContent = i18n('label_subject');
document.getElementById('label-dias').textContent = i18n('label_days');
document.getElementById('asunto').placeholder = i18n('placeholder_subject');
document.getElementById('btn').textContent = i18n('btn_download');

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

async function contarAdjuntos(token, query, dias) {
  const fecha = Math.floor((Date.now() - (dias + 1) * 86400000) / 1000);
  const q = encodeURIComponent(`subject:"${query}" after:${fecha}`);
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
      zip.file(parte.filename, bytes);
      descargados++;
      actualizarProgreso(descargados, totalGlobal, i18n('status_downloading'));
    }
  }
  return descargados;
}

document.getElementById('btn').addEventListener('click', async () => {
  const estado = document.getElementById('estado');
  const asunto = document.getElementById('asunto').value.trim();
  const dias = parseInt(document.getElementById('dias').value);
  const btn = document.getElementById('btn');
  const progresoContainer = document.getElementById('progreso-container');

  if (!asunto) {
    estado.className = 'error';
    estado.textContent = i18n('status_no_subject');
    return;
  }
  if (!dias || dias < 1) {
    estado.className = 'error';
    estado.textContent = i18n('status_no_days');
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
    const { mensajes, total } = await contarAdjuntos(token, asunto, dias);

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

    estado.className = 'ok';
    estado.textContent = `✅ ${total} ${i18n('status_done')} GmailZip_${fecha}.zip`;

  } catch (err) {
    estado.className = 'error';
    estado.textContent = 'Error: ' + err.message;
  } finally {
    btn.disabled = false;
  }
});