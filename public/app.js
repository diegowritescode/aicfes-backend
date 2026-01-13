// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// DOM Elements
const generatorForm = document.getElementById('generatorForm');
const generateBtn = document.getElementById('generateBtn');
const loader = document.getElementById('loader');
const errorAlert = document.getElementById('errorAlert');
const errorTitle = document.getElementById('errorTitle');
const errorMessage = document.getElementById('errorMessage');
const itemsContainer = document.getElementById('itemsContainer');
const jsonSection = document.getElementById('jsonSection');
const jsonOutput = document.getElementById('jsonOutput');
const jsonCode = document.getElementById('jsonCode');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const statusBadge = document.getElementById('statusBadge');
const copyToast = document.getElementById('copyToast');

// Form fields
const areaSelect = document.getElementById('area');
const dificultadSelect = document.getElementById('dificultad');
const temaInput = document.getElementById('tema');
const plantilaInput = document.getElementById('plantilla');
const cantidadInput = document.getElementById('cantidad');

// Current response data (para el JSON)
let currentResponse = null;

// Event Listeners
generatorForm.addEventListener('submit', handleGenerateSubmit);
copyJsonBtn.addEventListener('click', copyJsonToClipboard);

// Handle form submit
async function handleGenerateSubmit(e) {
    e.preventDefault();

    // Validar campos obligatorios
    if (!areaSelect.value || !dificultadSelect.value) {
        showError('Validación', 'Por favor selecciona Área y Dificultad');
        return;
    }

    // Preparar datos
    const requestData = {
        area: areaSelect.value,
        dificultad: dificultadSelect.value,
        n: parseInt(cantidadInput.value) || 1,
    };

    if (temaInput.value.trim()) {
        requestData.tema = temaInput.value.trim();
    }

    if (plantilaInput.value.trim()) {
        requestData.plantilla = plantilaInput.value.trim();
    }

    // Mostrar loader y ocultar previos
    showLoader();
    hideError();
    itemsContainer.innerHTML = '';
    jsonSection.classList.add('d-none');

    try {
        // Hacer request
        const response = await fetch(`${API_BASE_URL}/items/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
        });

        // Guardar response para JSON
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error en la solicitud');
        }

        // Guardar respuesta actual
        currentResponse = data;

        // Normalizar para renderizar (si es objeto, convertir a array)
        const itemsToRender = Array.isArray(data) ? data : [data];

        // Renderizar items
        renderItems(itemsToRender);

        // Mostrar JSON
        showJsonOutput(data);

        // Actualizar status badge
        updateStatusBadge('success', 'Ítems generados');

    } catch (error) {
        console.error('Error:', error);
        showError('Error de Generación', error.message);
        updateStatusBadge('error', 'Error');
    } finally {
        hideLoader();
    }
}

// Renderizar items
function renderItems(items) {
    itemsContainer.innerHTML = '';

    items.forEach((item, index) => {
        const cardHTML = createItemCard(item, index + 1, items.length);
        itemsContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
}

// Crear HTML de card para cada item
function createItemCard(item, itemNumber, totalItems) {
    const areaClass = `area-${item.area.toLowerCase()}`;
    const dificultadClass = `badge-${item.dificultad.toLowerCase()}`;

    const opcionesHTML = Object.entries(item.opciones)
        .map(([letra, texto]) => {
            const esCorrecta = item.respuesta_correcta === letra;
            return `
                <div class="opcion ${esCorrecta ? 'opcion-correcta' : ''}">
                    <span class="opcion-letra">${letra}.</span>
                    <span>${texto}</span>
                </div>
            `;
        })
        .join('');

    const tagsHTML = item.tags
        .map(tag => `<span class="tag">#${tag}</span>`)
        .join('');

    const distractoresHTML = Object.entries(item.distractores)
        .map(([letra, tipo]) => {
            const esCorrecta = item.respuesta_correcta === letra;
            const tipoFormatted = tipo.replace(/_/g, ' ').toUpperCase();
            return `
                <div style="margin-bottom: 0.5rem;">
                    <strong>${letra}:</strong> <span class="text-muted">${tipoFormatted}</span>
                </div>
            `;
        })
        .join('');

    return `
        <div class="card item-card ${item.dificultad.toLowerCase()} shadow-sm border-0">
            <div class="card-header bg-light">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="area-badge ${areaClass}">${item.area}</span>
                        <span class="badge-dificultad ${dificultadClass}" style="margin-left: 0.5rem;">
                            ${item.dificultad.toUpperCase()}
                        </span>
                    </div>
                    <span class="badge bg-info">Ítem ${itemNumber}${totalItems > 1 ? ` de ${totalItems}` : ''}</span>
                </div>
            </div>
            
            <div class="card-body">
                ${item.contexto ? `
                    <div class="contexto-box">
                        <strong><i class="fas fa-file-alt"></i> Contexto:</strong>
                        <p class="mb-0 mt-2">${item.contexto}</p>
                    </div>
                ` : ''}

                <div class="pregunta-box">
                    <i class="fas fa-question-circle"></i> ${item.pregunta}
                </div>

                <div class="opciones-section">
                    <strong class="d-block mb-2"><i class="fas fa-list"></i> Opciones:</strong>
                    ${opcionesHTML}
                </div>

                <div class="justificacion-box">
                    <strong><i class="fas fa-lightbulb"></i> Justificación:</strong>
                    <p class="mb-0 mt-2">${item.justificacion}</p>
                </div>

                <div style="margin-top: 1.5rem;">
                    <strong class="d-block mb-2"><i class="fas fa-tags"></i> Clasificación:</strong>
                    <div style="background-color: #f8f9fa; padding: 0.75rem; border-radius: 8px;">
                        ${tagsHTML}
                    </div>
                </div>

                <div style="margin-top: 1.5rem;">
                    <strong class="d-block mb-2"><i class="fas fa-tools"></i> Tipos de Distractores:</strong>
                    <div style="background-color: #f0f6ff; padding: 0.75rem; border-radius: 8px; font-size: 0.9rem;">
                        ${distractoresHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Mostrar output JSON
function showJsonOutput(data) {
    const jsonString = JSON.stringify(data, null, 2);
    jsonCode.textContent = jsonString;
    jsonSection.classList.remove('d-none');
}

// Copiar JSON al portapapeles
function copyJsonToClipboard() {
    const jsonString = JSON.stringify(currentResponse, null, 2);
    
    navigator.clipboard.writeText(jsonString).then(() => {
        // Mostrar toast
        const toast = new bootstrap.Toast(copyToast);
        toast.show();

        // Feedback visual en el botón
        const originalContent = copyJsonBtn.innerHTML;
        copyJsonBtn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
        copyJsonBtn.disabled = true;

        setTimeout(() => {
            copyJsonBtn.innerHTML = originalContent;
            copyJsonBtn.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar:', err);
        showError('Error', 'No se pudo copiar el JSON');
    });
}

// Mostrar loader
function showLoader() {
    loader.classList.remove('d-none');
    generateBtn.disabled = true;
}

// Ocultar loader
function hideLoader() {
    loader.classList.add('d-none');
    generateBtn.disabled = false;
}

// Mostrar error
function showError(title, message) {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    errorAlert.classList.remove('d-none');
    errorAlert.classList.add('show');
}

// Ocultar error
function hideError() {
    errorAlert.classList.add('d-none');
    errorAlert.classList.remove('show');
}

// Actualizar status badge
function updateStatusBadge(type, message) {
    statusBadge.textContent = message;
    
    if (type === 'success') {
        statusBadge.classList.remove('bg-warning', 'bg-danger');
        statusBadge.classList.add('bg-success');
    } else if (type === 'error') {
        statusBadge.classList.remove('bg-success', 'bg-warning');
        statusBadge.classList.add('bg-danger');
    } else {
        statusBadge.classList.remove('bg-success', 'bg-danger');
        statusBadge.classList.add('bg-warning');
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Aplicación cargada');
    console.log(`📡 API Base URL: ${API_BASE_URL}`);
    statusBadge.textContent = 'Listo';
});
