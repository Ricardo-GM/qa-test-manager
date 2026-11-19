document.addEventListener('DOMContentLoaded', () => {
  // App State
  let currentRunId = null;
  let activeRunData = null;
  let activeCasesResults = [];
  let activeRunBugs = [];
  let allBugsData = [];
  let selectedExcelFile = null;

  // --- ELEMENT REFS ---
  const views = {
    runs: document.getElementById('view-runs'),
    executionDetail: document.getElementById('view-execution-detail'),
    library: document.getElementById('view-library'),
    bugs: document.getElementById('view-bugs')
  };

  const navBtns = {
    runs: document.getElementById('btn-tab-runs'),
    library: document.getElementById('btn-tab-library'),
    bugs: document.getElementById('btn-tab-bugs')
  };

  const modals = {
    import: document.getElementById('modal-import'),
    importFeature: document.getElementById('modal-import-feature'),
    importAllure: document.getElementById('modal-import-allure'),
    newRun: document.getElementById('modal-new-run'),
    lightbox: document.getElementById('modal-lightbox'),
    newBug: document.getElementById('modal-new-bug'),
    editRun: document.getElementById('modal-edit-run')
  };

  // --- APPLE HIG PRESENTATION DIALOG HELPER ---
  function showHigDialog({ title, message, type = 'info', confirmText = 'Aceptar', cancelText = 'Cancelar', isDestructive = false }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('modal-hig-alert');
      const titleEl = document.getElementById('hig-alert-title');
      const msgEl = document.getElementById('hig-alert-message');
      const iconEl = document.getElementById('hig-alert-icon');
      const confirmBtn = document.getElementById('hig-btn-confirm');
      const cancelBtn = document.getElementById('hig-btn-cancel');

      titleEl.textContent = title;
      msgEl.textContent = message;

      iconEl.className = 'hig-alert-icon';
      if (isDestructive) {
        iconEl.classList.add('destructive');
        iconEl.innerHTML = '<i data-lucide="trash-2"></i>';
        confirmBtn.className = 'btn btn-destructive';
      } else if (type === 'success') {
        iconEl.classList.add('success');
        iconEl.innerHTML = '<i data-lucide="check-circle"></i>';
        confirmBtn.className = 'btn btn-primary';
      } else {
        iconEl.innerHTML = '<i data-lucide="info"></i>';
        confirmBtn.className = 'btn btn-primary';
      }

      confirmBtn.textContent = confirmText;

      if (cancelText) {
        cancelBtn.style.display = 'inline-flex';
        cancelBtn.textContent = cancelText;
      } else {
        cancelBtn.style.display = 'none';
      }

      lucide.createIcons();
      openModal(modal);

      const onConfirm = () => {
        closeModal(modal);
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        closeModal(modal);
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
      };

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
    });
  }

  function showToast(message, type = 'success', title = null) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;

    let iconName = 'check-circle';
    let iconColor = '#10b981';

    if (type === 'error') {
      iconName = 'x-circle';
      iconColor = '#ef4444';
    } else if (type === 'warning' || type === 'destructive') {
      iconName = 'alert-triangle';
      iconColor = '#f59e0b';
    } else if (type === 'info') {
      iconName = 'info';
      iconColor = '#3b82f6';
    }

    const titleHtml = title ? `<div class="toast-title">${escapeHtml(title)}</div>` : '';
    const msgHtml = `<div class="toast-message">${escapeHtml(message)}</div>`;

    toast.innerHTML = `
      <div class="toast-icon-wrap">
        <i data-lucide="${iconName}" style="color: ${iconColor}; width: 18px; height: 18px;"></i>
      </div>
      <div class="toast-content">
        ${titleHtml}
        ${msgHtml}
      </div>
      <button class="toast-close-btn" title="Cerrar">
        <i data-lucide="x" style="width: 14px; height: 14px;"></i>
      </button>
    `;

    container.appendChild(toast);
    lucide.createIcons({
      attrs: { 'stroke-width': 2 },
      nameAttr: 'data-lucide'
    });

    const closeToast = () => {
      if (toast.classList.contains('toast-hiding')) return;
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    };

    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeToast);

    const duration = (type === 'error' || type === 'warning' || type === 'destructive') ? 5000 : 3500;
    setTimeout(closeToast, duration);
  }

  function showHigAlert(title, message, type = 'info') {
    showToast(message, type, title);
    return Promise.resolve(true);
  }

  function showHigConfirm(title, message, isDestructive = false, confirmText = 'Confirmar') {
    return showHigDialog({ title, message, type: isDestructive ? 'destructive' : 'info', confirmText, cancelText: 'Cancelar', isDestructive });
  }

  window.alert = function(message) {
    showToast(message, 'info');
  };

  // --- HELPER DE ORDENAMIENTO ---
  function sortCases(casesList, field, dir) {
    return [...casesList].sort((a, b) => {
      let comp = 0;
      if (field === 'number') {
        const valA = String(a.case_number || '');
        const valB = String(b.case_number || '');
        const numA = parseInt(valA.replace(/\D/g, ''), 10);
        const numB = parseInt(valB.replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          comp = numA - numB;
        } else {
          comp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        }
      } else if (field === 'status') {
        const statusOrder = { Pass: 1, Fail: 2, Blocked: 3, Desestimado: 4, Untested: 5 };
        const statA = statusOrder[a.status] || 6;
        const statB = statusOrder[b.status] || 6;
        comp = statA - statB;
      } else if (field === 'date') {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        comp = timeA - timeB;
      }
      if (comp === 0) {
        comp = (a.id || 0) - (b.id || 0);
      }
      return dir === 'desc' ? -comp : comp;
    });
  }

  // --- POBLAR DESPLEGABLE DE GRUPOS ---
  async function populateGroupsSelect() {
    const runGroupSelect = document.getElementById('select-run-group');
    const libGroupSelect = document.getElementById('select-filter-library-group');
    try {
      const res = await fetch('/api/test-groups');
      const groups = await res.json();

      if (runGroupSelect) {
        runGroupSelect.innerHTML = '<option value="all">Todos los grupos de casos</option>' + 
          groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)} (${g.total_cases} casos)</option>`).join('');
      }

      if (libGroupSelect) {
        const currentVal = libGroupSelect.value || 'all';
        libGroupSelect.innerHTML = '<option value="all">Todos los grupos</option>' + 
          groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)} (${g.total_cases} casos)</option>`).join('');
        libGroupSelect.value = currentVal;
      }
    } catch (err) {
      console.error('Error cargando grupos:', err);
    }
  }

  // --- NAV ROUTER ---
  function switchView(viewName) {
    Object.keys(views).forEach(key => {
      if (key === viewName) views[key].classList.remove('hidden');
      else views[key].classList.add('hidden');
    });

    Object.keys(navBtns).forEach(key => {
      if (key === viewName) navBtns[key].classList.add('active');
      else if (navBtns[key]) navBtns[key].classList.remove('active');
    });

    if (viewName === 'runs') loadTestRuns();
    if (viewName === 'library') loadLibraryCases();
    if (viewName === 'bugs') loadBugs();
    lucide.createIcons();
  }

  navBtns.runs.addEventListener('click', () => switchView('runs'));
  navBtns.library.addEventListener('click', () => switchView('library'));
  if (navBtns.bugs) navBtns.bugs.addEventListener('click', () => switchView('bugs'));
  document.getElementById('btn-back-to-runs').addEventListener('click', () => switchView('runs'));

  // --- MODAL CONTROLS ---
  function openModal(modalEl) { modalEl.classList.remove('hidden'); lucide.createIcons(); }
  function closeModal(modalEl) { modalEl.classList.add('hidden'); }

  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-backdrop');
      if (modal) closeModal(modal);
    });
  });

  // --- LIGHTBOX GALLERY STATE & LOGIC ---
  let galleryImages = [];
  let galleryIndex = 0;

  const lightboxImgEl = document.getElementById('lightbox-img');
  const lightboxTitleEl = document.getElementById('lightbox-title');
  const lightboxCounterEl = document.getElementById('lightbox-counter');
  const lightboxBtnPrev = document.getElementById('lightbox-btn-prev');
  const lightboxBtnNext = document.getElementById('lightbox-btn-next');

  if (lightboxImgEl) {
    lightboxImgEl.addEventListener('click', () => {
      lightboxImgEl.classList.toggle('zoomed');
    });
  }

  function openLightboxGallery(images, startIndex = 0, title = 'Evidencia de Captura') {
    if (!images || images.length === 0) return;
    galleryImages = images;
    galleryIndex = Math.max(0, Math.min(startIndex, images.length - 1));
    
    if (lightboxTitleEl) lightboxTitleEl.textContent = title;
    updateLightboxDisplay();
    openModal(modals.lightbox);
  }

  function updateLightboxDisplay() {
    if (!galleryImages || galleryImages.length === 0) return;
    const currentImg = galleryImages[galleryIndex];
    const imgSrc = typeof currentImg === 'string' ? currentImg : (currentImg?.path || currentImg?.src || currentImg?.data || currentImg);

    if (lightboxImgEl) {
      lightboxImgEl.src = imgSrc;
      lightboxImgEl.classList.remove('zoomed');
    }

    if (lightboxCounterEl) {
      lightboxCounterEl.textContent = `${galleryIndex + 1} / ${galleryImages.length}`;
    }

    if (galleryImages.length > 1) {
      if (lightboxBtnPrev) lightboxBtnPrev.classList.remove('hidden');
      if (lightboxBtnNext) lightboxBtnNext.classList.remove('hidden');
    } else {
      if (lightboxBtnPrev) lightboxBtnPrev.classList.add('hidden');
      if (lightboxBtnNext) lightboxBtnNext.classList.add('hidden');
    }
  }

  function nextLightboxImage() {
    if (galleryImages.length <= 1) return;
    galleryIndex = (galleryIndex + 1) % galleryImages.length;
    updateLightboxDisplay();
  }

  function prevLightboxImage() {
    if (galleryImages.length <= 1) return;
    galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length;
    updateLightboxDisplay();
  }

  if (lightboxBtnNext) {
    lightboxBtnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      nextLightboxImage();
    });
  }

  if (lightboxBtnPrev) {
    lightboxBtnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      prevLightboxImage();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!modals.lightbox || modals.lightbox.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextLightboxImage();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      prevLightboxImage();
    } else if (e.key === 'Escape') {
      closeModal(modals.lightbox);
    }
  });

  document.getElementById('btn-open-import').addEventListener('click', () => openModal(modals.import));
  document.getElementById('btn-open-new-run').addEventListener('click', async () => {
    await populateGroupsSelect();
    openModal(modals.newRun);
  });

  // --- EDIT RUN NAME/ENVIRONMENT ---
  document.getElementById('btn-edit-run-name').addEventListener('click', () => {
    if (!activeRunData) return;
    document.getElementById('input-edit-run-name').value = activeRunData.name;
    document.getElementById('input-edit-run-env').value = activeRunData.environment;
    openModal(modals.editRun);
  });

  document.getElementById('form-edit-run').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeRunData) return;
    const name = document.getElementById('input-edit-run-name').value;
    const environment = document.getElementById('input-edit-run-env').value;
    try {
      const res = await fetch(`/api/test-runs/${activeRunData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, environment })
      });
      if (res.ok) {
        closeModal(modals.editRun);
        showToast('Jornada de pruebas actualizada correctamente');
        openExecutionDetail(activeRunData.id);
      } else {
        const errorData = await res.json();
        showToast('Error actualizando la ejecución: ' + errorData.error, 'error', 'Error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al actualizar la ejecución.', 'error', 'Error de Conexión');
    }
  });

  // --- EXCEL IMPORT DRAG & DROP ---
  const dropzone = document.getElementById('dropzone-excel');
  const fileInput = document.getElementById('file-input-excel');
  const previewBox = document.getElementById('import-preview');
  const fileNameSpan = document.getElementById('excel-file-name');
  const btnSubmitImport = document.getElementById('btn-submit-import');
  const groupNameInput = document.getElementById('input-group-name');

  dropzone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length > 0) {
      handleSelectedExcel(dt.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectedExcel(e.target.files[0]);
    }
  });

  function handleSelectedExcel(file) {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      showToast('Por favor selecciona un archivo Excel válido (.xlsx o .xls)', 'warning', 'Archivo Inválido');
      return;
    }
    selectedExcelFile = file;
    fileNameSpan.textContent = file.name;
    previewBox.classList.remove('hidden');
    btnSubmitImport.disabled = false;
  }

  btnSubmitImport.addEventListener('click', async () => {
    if (!selectedExcelFile) return;

    const formData = new FormData();
    formData.append('excelFile', selectedExcelFile);
    if (groupNameInput && groupNameInput.value.trim()) {
      formData.append('group_name', groupNameInput.value.trim());
    }

    btnSubmitImport.disabled = true;
    btnSubmitImport.textContent = 'Procesando...';

    try {
      const response = await fetch('/api/test-cases/import', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (response.ok) {
        await showHigAlert('Importación Exitosa', data.message, 'success');
        closeModal(modals.import);
        selectedExcelFile = null;
        if (groupNameInput) groupNameInput.value = '';
        previewBox.classList.add('hidden');
        loadTestRuns();
      } else {
        await showHigAlert('Error de Importación', data.error || 'No se pudo procesar el archivo Excel.');
      }
    } catch (err) {
      console.error(err);
      await showHigAlert('Error de Conexión', 'Ocurrió un problema de red al importar el archivo Excel.');
    } finally {
      btnSubmitImport.disabled = false;
      btnSubmitImport.innerHTML = '<i data-lucide="upload"></i> Procesar E Importar';
      lucide.createIcons();
    }
  });

  // --- FEATURE (.feature) IMPORT LOGIC ---
  let selectedFeatureFiles = [];
  let featureImportMode = 'upload';

  const btnOpenImportFeature = document.getElementById('btn-open-import-feature');
  if (btnOpenImportFeature) {
    btnOpenImportFeature.addEventListener('click', () => {
      openModal(modals.importFeature);
    });
  }

  const tabFeatureUpload = document.getElementById('tab-feature-upload');
  const tabFeaturePaste = document.getElementById('tab-feature-paste');
  const panelFeatureUpload = document.getElementById('panel-feature-upload');
  const panelFeaturePaste = document.getElementById('panel-feature-paste');
  const dropzoneFeature = document.getElementById('dropzone-feature');
  const fileInputFeature = document.getElementById('file-input-feature');
  const featureFilesPreview = document.getElementById('feature-files-preview');
  const btnSubmitImportFeature = document.getElementById('btn-submit-import-feature');
  const inputFeatureGroupName = document.getElementById('input-feature-group-name');
  const inputFeaturePasteGroup = document.getElementById('input-feature-paste-group');
  const textareaFeatureContent = document.getElementById('textarea-feature-content');

  if (tabFeatureUpload && tabFeaturePaste) {
    tabFeatureUpload.addEventListener('click', () => {
      featureImportMode = 'upload';
      tabFeatureUpload.classList.add('active');
      tabFeaturePaste.classList.remove('active');
      panelFeatureUpload.classList.remove('hidden');
      panelFeaturePaste.classList.add('hidden');
      validateFeatureSubmit();
    });

    tabFeaturePaste.addEventListener('click', () => {
      featureImportMode = 'paste';
      tabFeaturePaste.classList.add('active');
      tabFeatureUpload.classList.remove('active');
      panelFeaturePaste.classList.remove('hidden');
      panelFeatureUpload.classList.add('hidden');
      validateFeatureSubmit();
    });
  }

  if (dropzoneFeature && fileInputFeature) {
    dropzoneFeature.addEventListener('click', () => fileInputFeature.click());

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzoneFeature.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzoneFeature.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzoneFeature.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzoneFeature.classList.remove('dragover');
      }, false);
    });

    dropzoneFeature.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt.files && dt.files.length > 0) {
        handleSelectedFeatureFiles(dt.files);
      }
    });

    fileInputFeature.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleSelectedFeatureFiles(e.target.files);
      }
    });
  }

  function handleSelectedFeatureFiles(fileList) {
    const validFiles = Array.from(fileList).filter(f => f.name.match(/\.(feature|txt)$/i));
    if (validFiles.length === 0) {
      showToast('Por favor selecciona archivos válidos con extensión .feature', 'warning', 'Archivo Inválido');
      return;
    }
    selectedFeatureFiles = validFiles;
    renderFeatureFilesPreview();
    validateFeatureSubmit();
  }

  function renderFeatureFilesPreview() {
    if (!featureFilesPreview) return;
    if (selectedFeatureFiles.length === 0) {
      featureFilesPreview.classList.add('hidden');
      featureFilesPreview.innerHTML = '';
      return;
    }

    featureFilesPreview.classList.remove('hidden');
    featureFilesPreview.innerHTML = selectedFeatureFiles.map((f, i) => `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 0.85rem; padding: 4px 6px; background: rgba(0,0,0,0.03); border-radius: 4px;">
        <span><i data-lucide="file-code" style="width: 14px; height: 14px; margin-right: 6px; vertical-align: middle;"></i>${escapeHtml(f.name)} (${(f.size / 1024).toFixed(1)} KB)</span>
        <button type="button" class="btn btn-icon btn-sm btn-remove-feature-file" data-index="${i}" style="border: none; background: transparent; padding: 2px;">
          <i data-lucide="x" style="width: 14px; height: 14px; color: var(--danger);"></i>
        </button>
      </div>
    `).join('');

    featureFilesPreview.querySelectorAll('.btn-remove-feature-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        selectedFeatureFiles.splice(idx, 1);
        renderFeatureFilesPreview();
        validateFeatureSubmit();
      });
    });

    lucide.createIcons();
  }

  if (textareaFeatureContent) {
    textareaFeatureContent.addEventListener('input', validateFeatureSubmit);
  }

  function validateFeatureSubmit() {
    if (!btnSubmitImportFeature) return;
    if (featureImportMode === 'upload') {
      btnSubmitImportFeature.disabled = selectedFeatureFiles.length === 0;
    } else {
      btnSubmitImportFeature.disabled = !textareaFeatureContent.value.trim();
    }
  }

  if (btnSubmitImportFeature) {
    btnSubmitImportFeature.addEventListener('click', async () => {
      btnSubmitImportFeature.disabled = true;
      btnSubmitImportFeature.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Procesando .feature...';

      try {
        let response;
        if (featureImportMode === 'upload') {
          const formData = new FormData();
          selectedFeatureFiles.forEach(f => {
            formData.append('featureFiles', f);
          });
          if (inputFeatureGroupName && inputFeatureGroupName.value.trim()) {
            formData.append('group_name', inputFeatureGroupName.value.trim());
          }
          response = await fetch('/api/test-cases/import-feature', {
            method: 'POST',
            body: formData
          });
        } else {
          const payload = {
            feature_text: textareaFeatureContent.value.trim(),
            group_name: inputFeaturePasteGroup ? inputFeaturePasteGroup.value.trim() : ''
          };
          response = await fetch('/api/test-cases/import-feature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        const data = await response.json();

        if (response.ok) {
          await showHigAlert('Importación BDD Exitosa', data.message, 'success');
          closeModal(modals.importFeature);
          selectedFeatureFiles = [];
          if (textareaFeatureContent) textareaFeatureContent.value = '';
          if (inputFeatureGroupName) inputFeatureGroupName.value = '';
          if (inputFeaturePasteGroup) inputFeaturePasteGroup.value = '';
          renderFeatureFilesPreview();
          await populateGroupsSelect();
          switchView('library');
        } else {
          await showHigAlert('Error de Importación BDD', data.error || 'No se pudieron procesar los casos .feature');
        }
      } catch (err) {
        console.error('Error importando feature:', err);
        await showHigAlert('Error de Conexión', 'Ocurrió un problema de red al importar el archivo .feature.');
      } finally {
        btnSubmitImportFeature.disabled = false;
        btnSubmitImportFeature.innerHTML = '<i data-lucide="upload"></i> Procesar E Importar .feature';
        lucide.createIcons();
      }
    });
  }

  // --- ALLURE REPORT INGESTION LOGIC ---
  let selectedAllureFiles = [];

  const btnOpenImportAllure = document.getElementById('btn-open-import-allure');
  if (btnOpenImportAllure) {
    btnOpenImportAllure.addEventListener('click', () => {
      selectedAllureFiles = [];
      renderAllureFilesPreview();
      validateAllureSubmit();
      openModal(modals.importAllure);
    });
  }

  const dropzoneAllure = document.getElementById('dropzone-allure');
  const fileInputAllure = document.getElementById('file-input-allure');
  const allureFilesPreview = document.getElementById('allure-files-preview');
  const btnSubmitImportAllure = document.getElementById('btn-submit-import-allure');

  if (dropzoneAllure && fileInputAllure) {
    dropzoneAllure.addEventListener('click', () => fileInputAllure.click());

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzoneAllure.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzoneAllure.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzoneAllure.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzoneAllure.classList.remove('dragover');
      }, false);
    });

    dropzoneAllure.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt.files && dt.files.length > 0) {
        handleSelectedAllureFiles(dt.files);
      }
    });

    fileInputAllure.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleSelectedAllureFiles(e.target.files);
      }
    });
  }

  function handleSelectedAllureFiles(fileList) {
    const validFiles = Array.from(fileList).filter(f => f.name.match(/\.json$/i));
    if (validFiles.length === 0) {
      showToast('Por favor selecciona archivos JSON válidos de Allure (*-result.json, suites.json)', 'warning', 'Archivo Inválido');
      return;
    }
    selectedAllureFiles = [...selectedAllureFiles, ...validFiles];
    renderAllureFilesPreview();
    validateAllureSubmit();
  }

  function renderAllureFilesPreview() {
    if (!allureFilesPreview) return;
    if (selectedAllureFiles.length === 0) {
      allureFilesPreview.classList.add('hidden');
      allureFilesPreview.innerHTML = '';
      return;
    }

    allureFilesPreview.classList.remove('hidden');
    allureFilesPreview.innerHTML = `
      <div style="font-weight: 600; font-size: 0.82rem; margin-bottom: 4px;">
        ${selectedAllureFiles.length} archivo(s) JSON seleccionado(s):
      </div>
      ` + selectedAllureFiles.slice(0, 8).map((f) => `
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 0.8rem; padding: 2px 4px; color: var(--text-muted);">
          <span><i data-lucide="file-json" style="width: 13px; height: 13px; margin-right: 4px; vertical-align: middle;"></i>${escapeHtml(f.name)}</span>
        </div>
      `).join('') + (selectedAllureFiles.length > 8 ? `<div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;">...y ${selectedAllureFiles.length - 8} archivo(s) más</div>` : '');

    lucide.createIcons();
  }

  function validateAllureSubmit() {
    if (btnSubmitImportAllure) {
      btnSubmitImportAllure.disabled = selectedAllureFiles.length === 0;
    }
  }

  if (btnSubmitImportAllure) {
    btnSubmitImportAllure.addEventListener('click', async () => {
      if (!currentRunId || selectedAllureFiles.length === 0) return;

      btnSubmitImportAllure.disabled = true;
      btnSubmitImportAllure.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Ingestando Allure...';

      try {
        const formData = new FormData();
        selectedAllureFiles.forEach(f => {
          formData.append('allureFiles', f);
        });

        const res = await fetch(`/api/test-runs/${currentRunId}/import-allure`, {
          method: 'POST',
          body: formData
        });

        const data = await res.json();

        if (res.ok) {
          const summaryMsg = `${data.message}\n` +
            `• Pruebas Allure leídas: ${data.totalAllureFound}\n` +
            `• Casos actualizados: ${data.updatedCount}\n` +
            (data.unmatchedRunCount > 0 ? `• Casos en la corrida sin resultado Allure: ${data.unmatchedRunCount}\n` : '') +
            (data.unmatchedAllureCount > 0 ? `• Tests Allure no coincidentes: ${data.unmatchedAllureCount}` : '');

          await showHigAlert('Resultados Allure Ingestados', summaryMsg, 'success');
          closeModal(modals.importAllure);
          selectedAllureFiles = [];
          renderAllureFilesPreview();
          // Recargar detalle de ejecución para refrescar estados y estadísticas
          openExecutionDetail(currentRunId);
        } else {
          await showHigAlert('Error Ingestando Allure', data.error || 'No se pudieron procesar los resultados.');
        }
      } catch (err) {
        console.error('Error importando Allure:', err);
        await showHigAlert('Error de Conexión', 'Ocurrió un problema al enviar los archivos de Allure.');
      } finally {
        btnSubmitImportAllure.disabled = false;
        btnSubmitImportAllure.innerHTML = '<i data-lucide="check-circle-2"></i> Procesar e Ingestar Resultados';
        lucide.createIcons();
      }
    });
  }

  // --- FORM CREATE NEW TEST RUN ---
  document.getElementById('form-new-run').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('input-run-name').value;
    const environment = document.getElementById('input-run-env').value;
    const group_id = document.getElementById('select-run-group').value;

    try {
      const res = await fetch('/api/test-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, environment, group_id })
      });
      const data = await res.json();

      if (res.ok) {
        closeModal(modals.newRun);
        document.getElementById('form-new-run').reset();
        openExecutionDetail(data.runId);
      } else {
        await showHigAlert('Error de Creación', data.error || 'No se pudo iniciar la jornada de pruebas.');
      }
    } catch (err) {
      console.error(err);
      await showHigAlert('Error de Conexión', 'Ocurrió un error al crear la ejecución.');
    }
  });

  // --- FETCH & RENDER TEST RUNS ---
  async function loadTestRuns() {
    const grid = document.getElementById('runs-grid');
    grid.innerHTML = '<p class="subtext">Cargando ejecuciones de prueba...</p>';

    try {
      const res = await fetch('/api/test-runs');
      const runs = await res.json();

      if (runs.length === 0) {
        grid.innerHTML = `
          <div class="glass-panel text-center" style="grid-column: 1/-1; padding: 40px;">
            <i data-lucide="inbox" style="width: 48px; height: 48px; color: var(--text-dim); margin-bottom: 12px;"></i>
            <h3>No hay ejecuciones registradas</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 6px;">Importa tu archivo Excel y crea tu primera ejecución de pruebas.</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      grid.innerHTML = runs.map(run => {
        const total = run.total_cases || 0;
        const pass = run.passed_cases || 0;
        const fail = run.failed_cases || 0;
        const blocked = run.blocked_cases || 0;
        const desestimado = run.desestimado_cases || 0;

        const passPct = total > 0 ? (pass / total) * 100 : 0;
        const failPct = total > 0 ? (fail / total) * 100 : 0;
        const blockedPct = total > 0 ? (blocked / total) * 100 : 0;
        const desestimadoPct = total > 0 ? (desestimado / total) * 100 : 0;

        return `
          <div class="card-run">
            <div class="card-run-header">
              <h3>${escapeHtml(run.name)}</h3>
              <div class="card-run-badges">
                <span class="badge-env" title="${escapeHtml(run.group_name || 'Todos')}">${escapeHtml(run.group_name || 'Todos')}</span>
                <span class="badge-env">${run.environment || 'QA'}</span>
              </div>
            </div>

            <div class="progress-bar-container">
              <div class="progress-labels">
                <span>Progreso: ${pass + fail + blocked + desestimado}/${total} evaluados</span>
                <span><strong>${Math.round(passPct)}% Pass</strong></span>
              </div>
              <div class="progress-track">
                <div class="progress-fill-pass" style="width: ${passPct}%"></div>
                <div class="progress-fill-fail" style="width: ${failPct}%"></div>
                <div class="progress-fill-blocked" style="width: ${blockedPct}%"></div>
                <div class="progress-fill-desestimado" style="width: ${desestimadoPct}%"></div>
              </div>
            </div>

            <div class="card-run-footer">
              <span class="subtext" style="font-size: 0.75rem;">${new Date(run.created_at).toLocaleDateString()}</span>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-sm btn-delete-run-card" data-id="${run.id}" style="color: #9f2f2d; border-color: #f6c6c7; background: #fdebec;" title="Eliminar ejecución">
                  <i data-lucide="trash-2"></i> Eliminar
                </button>
                <button class="btn btn-secondary btn-sm btn-open-run-detail" data-id="${run.id}">
                  <i data-lucide="play"></i> Abrir Pruebas
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      document.querySelectorAll('.btn-open-run-detail').forEach(btn => {
        btn.addEventListener('click', () => openExecutionDetail(btn.dataset.id));
      });

      document.querySelectorAll('.btn-delete-run-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTestRun(btn.dataset.id);
        });
      });

      lucide.createIcons();
    } catch (err) {
      console.error(err);
      grid.innerHTML = '<p class="subtext">Error al cargar las ejecuciones.</p>';
    }
  }

  // --- OPEN EXECUTION DETAIL ---
  async function openExecutionDetail(runId) {
    currentRunId = runId;
    switchView('executionDetail');

    try {
      const res = await fetch(`/api/test-runs/${runId}`);
      const data = await res.json();

      activeRunData = data.run;
      activeCasesResults = data.results;
      activeRunBugs = data.runBugs || [];

      document.getElementById('exec-title').textContent = activeRunData.name;
      document.getElementById('exec-meta').textContent = `Entorno: ${activeRunData.environment} | Grupo: ${activeRunData.group_name || 'Todos'} | Creado: ${new Date(activeRunData.created_at).toLocaleString()}`;

      renderExecutionCasesList();
      updateExecCounters();
    } catch (err) {
      console.error(err);
      showToast('Error cargando el detalle de la ejecución.', 'error', 'Error de Carga');
    }
  }

  // --- RENDER EXECUTION CASES LIST ---
  function renderExecutionCasesList() {
    const listContainer = document.getElementById('cases-execution-list');
    if (!listContainer) return;

    const searchInput = document.getElementById('input-search-case');
    const searchVal = searchInput ? String(searchInput.value || '').trim().toLowerCase() : '';

    const filterStatusSelect = document.getElementById('select-filter-status');
    const filterStatus = filterStatusSelect ? filterStatusSelect.value : 'ALL';

    const sortFieldSelect = document.getElementById('select-sort-exec-field');
    const sortField = sortFieldSelect ? sortFieldSelect.value || 'number' : 'number';

    const sortDirSelect = document.getElementById('select-sort-exec-dir');
    const sortDir = sortDirSelect ? sortDirSelect.value || 'asc' : 'asc';

    let filtered = (activeCasesResults || []).filter(item => {
      const num = String(item.case_number || '').toLowerCase();
      const title = String(item.title || '').toLowerCase();
      const sum = String(item.summary || '').toLowerCase();

      const matchesSearch = !searchVal || num.includes(searchVal) || title.includes(searchVal) || sum.includes(searchVal);
      const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus;

      return matchesSearch && matchesStatus;
    });

    filtered = sortCases(filtered, sortField, sortDir);

    let generalBugsHtml = '';
    if (activeRunBugs && activeRunBugs.length > 0) {
      generalBugsHtml = `
        <div class="glass-panel" style="margin-bottom: 20px; padding: 16px; border-left: 4px solid #ef4444; background: #fff1f2;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="font-size: 0.95rem; font-weight: 700; color: #991b1b; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="bug"></i> BUGS GENERALES DE LA EJECUCIÓN (${activeRunBugs.length})
            </h3>
            <button class="btn btn-secondary btn-sm btn-open-add-general-bug" style="color: #991b1b; border-color: #fca5a5; background: #ffffff;">
              <i data-lucide="plus"></i> Registrar Bug General
            </button>
          </div>
          <div class="bugs-list-wrap">
            ${activeRunBugs.map(b => `
              <div class="bug-card-mini">
                <div class="bug-card-mini-info">
                  <span class="bug-sev-badge bug-sev-${b.severity}">${b.severity}</span>
                  <span class="bug-title-text">${escapeHtml(b.title)}</span>
                  <span class="bug-assignee-tag"><i data-lucide="user" style="width: 10px; height: 10px; display: inline;"></i> ${escapeHtml(b.assigned_to || 'Sin Asignar')}</span>
                </div>
                ${b.description ? `<p class="subtext" style="width: 100%; font-size: 0.8rem; margin: 4px 0;">${escapeHtml(b.description)}</p>` : ''}
                <div class="bug-card-mini-actions">
                  <select class="bug-status-select" data-bug-id="${b.id}">
                    <option value="Abierto" ${b.status === 'Abierto' ? 'selected' : ''}>Abierto</option>
                    <option value="En Progreso" ${b.status === 'En Progreso' ? 'selected' : ''}>En Progreso</option>
                    <option value="Resuelto" ${b.status === 'Resuelto' ? 'selected' : ''}>Resuelto</option>
                    <option value="Cerrado" ${b.status === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
                  </select>
                  <button class="btn btn-secondary btn-sm btn-copy-bug" data-bug-id="${b.id}" style="padding: 2px 6px;" title="Copiar para Jira">
                    <i data-lucide="copy"></i>
                  </button>
                  <button class="btn btn-secondary btn-sm btn-edit-bug" data-bug-id="${b.id}" style="padding: 2px 6px;" title="Editar Bug">
                    <i data-lucide="edit"></i>
                  </button>
                  <button class="btn btn-secondary btn-sm btn-delete-bug" data-bug-id="${b.id}" style="padding: 2px 6px; color: #ef4444;" title="Eliminar Bug">
                    <i data-lucide="trash-2"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = generalBugsHtml + '<p class="subtext" style="padding: 20px;">No hay casos que coincidan con el filtro.</p>';
      lucide.createIcons();
      return;
    }

    listContainer.innerHTML = generalBugsHtml + filtered.map(item => {
      const evidenceList = Array.isArray(item.evidence_paths)
        ? item.evidence_paths
        : (item.evidence_path ? [item.evidence_path] : []);

      const caseBugs = item.bugs || [];

      return `
        <div class="case-exec-card status-${item.status}" id="case-card-${item.result_id}">
          <div class="case-card-header">
            <div class="case-title-area">
              <span class="case-number-badge">${escapeHtml(item.case_number)}</span>
              <h4>${escapeHtml(item.title)}</h4>
              <span class="priority-tag priority-${item.priority || 'Media'}">${item.priority || 'Media'}</span>
              ${item.group_name ? `<span class="priority-tag" style="background: #f1f1ef; color: #787774; border: 1px solid #e2e2df;">${escapeHtml(item.group_name)}</span>` : ''}
            </div>

            <!-- Status toggle buttons -->
            <div class="status-selector" data-result-id="${item.result_id}">
              <button class="btn-status-toggle ${item.status === 'Pass' ? 'active' : ''}" data-status="Pass">Pass</button>
              <button class="btn-status-toggle ${item.status === 'Fail' ? 'active' : ''}" data-status="Fail">Fail</button>
              <button class="btn-status-toggle ${item.status === 'Blocked' ? 'active' : ''}" data-status="Blocked">Blocked</button>
              <button class="btn-status-toggle ${item.status === 'Desestimado' ? 'active' : ''}" data-status="Desestimado">Desestimado</button>
              <button class="btn-status-toggle ${item.status === 'Untested' ? 'active' : ''}" data-status="Untested">Reset</button>
            </div>
          </div>

          ${item.summary ? `<p class="subtext">${escapeHtml(item.summary)}</p>` : ''}

          <!-- Desglose de Pasos -->
          <div class="steps-container">
            <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 4px; font-weight: 600; text-transform: uppercase;">PASOS DEL CASO DE PRUEBA (${parseCaseSteps(item.gherkin_steps, item.summary).length})</div>
            ${parseCaseSteps(item.gherkin_steps, item.summary).map((stepText, idx) => `
              <div class="step-card">
                <div class="step-card-header">
                  <span class="step-badge">Paso ${idx + 1}</span>
                  <div class="step-content-text">${escapeHtml(stepText)}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Observaciones Generales del Caso -->
          <div class="exec-notes-evidence-row" style="margin-top: 10px;">
            <div class="notes-area">
              <label style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 4px; font-weight: 600; display: block;">NOTAS GENERALES DEL CASO</label>
              <textarea class="input-notes" data-result-id="${item.result_id}" placeholder="Agregar observaciones o notas generales de la ejecución...">${escapeHtml(item.notes || '')}</textarea>
            </div>

            <!-- Evidencias Consolidadas (Subida + Ctrl+V + Galería) -->
            <div class="evidence-area">
              <label style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 4px; font-weight: 600; display: block;">EVIDENCIAS DEL CASO DE PRUEBA (${evidenceList.length})</label>
              
              <div class="paste-dropzone" tabindex="0" data-result-id="${item.result_id}">
                <div class="paste-hint">
                  <i data-lucide="image"></i> Arrastra imágenes, haz clic para buscar o pega con <kbd>Ctrl</kbd> + <kbd>V</kbd>
                </div>
                <label class="btn btn-secondary btn-sm" style="cursor: pointer;" onclick="event.stopPropagation();">
                  <i data-lucide="plus"></i> Subir Archivos
                  <input type="file" class="input-evidence-file" data-result-id="${item.result_id}" accept="image/*" multiple hidden>
                </label>
              </div>

              ${evidenceList.length > 0 ? `
                <div class="evidence-gallery-grid">
                  ${evidenceList.map(evPath => {
                    const normPath = '/' + String(evPath).replace(/\\/g, '/').replace(/^\/+/, '');
                    return `
                      <div class="evidence-thumb-container">
                        <div class="evidence-thumb-wrap btn-view-evidence" data-img="${normPath}">
                          <img src="${normPath}" alt="Evidencia">
                        </div>
                        <button class="btn-delete-evidence" data-result-id="${item.result_id}" data-path="${evPath}" title="Eliminar evidencia">
                          &times;
                        </button>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Sección de Bugs del Caso -->
          <div class="bugs-section">
            <div class="bugs-section-header">
              <span style="font-size: 0.75rem; font-weight: 700; color: #991b1b; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="bug" style="width: 14px; height: 14px;"></i> BUGS ASOCIADOS (${caseBugs.length})
              </span>
              <button class="btn btn-secondary btn-sm btn-open-add-bug" data-run-id="${item.run_id}" data-case-id="${item.case_id}" data-result-id="${item.result_id}" style="color: #991b1b; border-color: #fca5a5; background: #fff1f2;">
                <i data-lucide="plus"></i> Registrar Bug
              </button>
            </div>

            ${caseBugs.length > 0 ? `
              <div class="bugs-list-wrap">
                ${caseBugs.map(b => {
                  const bEvidences = Array.isArray(b.evidence_paths) ? b.evidence_paths : [];
                  return `
                    <div class="bug-card-mini" style="flex-wrap: wrap;">
                      <div class="bug-card-mini-info" style="flex: 1; min-width: 200px;">
                        <span class="bug-sev-badge bug-sev-${b.severity}">${b.severity}</span>
                        <span class="bug-title-text">${escapeHtml(b.title)}</span>
                        <span class="bug-assignee-tag"><i data-lucide="user" style="width: 10px; height: 10px; display: inline;"></i> ${escapeHtml(b.assigned_to || 'Sin Asignar')}</span>
                      </div>
                      ${bEvidences.length > 0 ? `
                        <div class="evidence-gallery-grid" style="margin: 4px 0;">
                          ${bEvidences.map(evPath => {
                            const normPath = '/' + String(evPath).replace(/\\/g, '/').replace(/^\/+/, '');
                            return `
                              <div class="evidence-thumb-container">
                                <div class="evidence-thumb-wrap btn-view-evidence" data-img="${normPath}" style="width: 70px; height: 46px;">
                                  <img src="${normPath}" alt="Evidencia de Bug">
                                </div>
                              </div>
                            `;
                          }).join('')}
                        </div>
                      ` : ''}
                      <div class="bug-card-mini-actions">
                        <select class="bug-status-select" data-bug-id="${b.id}">
                          <option value="Abierto" ${b.status === 'Abierto' ? 'selected' : ''}>Abierto</option>
                          <option value="En Progreso" ${b.status === 'En Progreso' ? 'selected' : ''}>En Progreso</option>
                          <option value="Resuelto" ${b.status === 'Resuelto' ? 'selected' : ''}>Resuelto</option>
                          <option value="Cerrado" ${b.status === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
                        </select>
                        <button class="btn btn-secondary btn-sm btn-copy-bug" data-bug-id="${b.id}" style="padding: 2px 6px;" title="Copiar para Jira">
                          <i data-lucide="copy"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm btn-edit-bug" data-bug-id="${b.id}" style="padding: 2px 6px;" title="Editar Bug">
                          <i data-lucide="edit"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm btn-delete-bug" data-bug-id="${b.id}" style="padding: 2px 6px; color: #ef4444;" title="Eliminar Bug">
                          <i data-lucide="trash-2"></i>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>

        </div>
      `;
    }).join('');

    lucide.createIcons();

    // Attach Event Listeners
    document.querySelectorAll('.btn-status-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const resultId = e.target.closest('.status-selector').dataset.resultId;
        const newStatus = e.target.dataset.status;
        updateCaseStatus(resultId, newStatus);
      });
    });

    document.querySelectorAll('.input-notes').forEach(textarea => {
      textarea.addEventListener('change', (e) => {
        const resultId = e.target.dataset.resultId;
        const notesVal = e.target.value;
        updateCaseNotes(resultId, notesVal);
      });
    });

    // Subida de archivos de evidencia (múltiples)
    document.querySelectorAll('.input-evidence-file').forEach(input => {
      input.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const resultId = e.target.dataset.resultId;
          for (let i = 0; i < e.target.files.length; i++) {
            await uploadEvidenceFile(resultId, e.target.files[i]);
          }
          openExecutionDetail(currentRunId);
        }
      });
    });

    // Click en Paste Dropzone para abrir explorador si no se usa el botón
    document.querySelectorAll('.paste-dropzone').forEach(zone => {
      zone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
          const input = zone.querySelector('.input-evidence-file');
          if (input) input.click();
        }
      });

      // Arrastrar y soltar archivos de imagen directamente sobre la zona de evidencias
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      });
      zone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
      });
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const resultId = zone.dataset.resultId;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          for (let i = 0; i < e.dataTransfer.files.length; i++) {
            const file = e.dataTransfer.files[i];
            if (file.type.startsWith('image/')) {
              await uploadEvidenceFile(resultId, file);
            }
          }
          openExecutionDetail(currentRunId);
        }
      });
    });

    document.querySelectorAll('.btn-delete-evidence').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const resultId = e.currentTarget.dataset.resultId;
        const evidencePath = e.currentTarget.dataset.path;
        await deleteCaseEvidence(resultId, evidencePath);
      });
    });

    document.querySelectorAll('#cases-execution-list .btn-view-evidence').forEach(thumb => {
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        const bugMini = e.currentTarget.closest('.bug-card-mini');
        const galleryGrid = e.currentTarget.closest('.evidence-gallery-grid');
        const caseCard = e.currentTarget.closest('.case-card-redesigned, .case-item, .card-case');
        
        // Priorizar el contenedor más específico: si es una evidencia de un bug en un caso, usar bugMini.
        // Si es evidencia directa del caso de prueba, usar la grilla de evidencias directa.
        const container = bugMini || galleryGrid || caseCard || document;
        let galleryTitle = 'Evidencia de Captura';

        if (bugMini) {
          galleryTitle = bugMini.querySelector('.bug-title-text')?.textContent?.trim() || 'Evidencia de Bug';
        } else if (caseCard) {
          galleryTitle = caseCard.querySelector('.case-title, h4')?.textContent?.trim() || 'Evidencia de Caso';
        }

        const allThumbs = Array.from(container.querySelectorAll('.btn-view-evidence'));
        const images = allThumbs.map(t => t.dataset.img).filter(Boolean);
        const clickedSrc = e.currentTarget.dataset.img;
        const clickedIndex = images.indexOf(clickedSrc);
        openLightboxGallery(images.length ? images : [clickedSrc], Math.max(0, clickedIndex), galleryTitle);
      });
    });

    // Abrir Modal de Registrar Bug desde un caso especifico
    document.querySelectorAll('.btn-open-add-bug').forEach(btn => {
      btn.addEventListener('click', async () => {
        await setupBugModal({ runId: btn.dataset.runId, caseId: btn.dataset.caseId, resultId: btn.dataset.resultId });
      });
    });

    // Abrir Modal de Registrar Bug General desde una ejecucion
    document.querySelectorAll('.btn-open-add-general-bug').forEach(btn => {
      btn.onclick = async () => {
        await setupBugModal({ runId: currentRunId });
      };
    });

    // Cambiar estado de Bug desde selector
    document.querySelectorAll('.bug-status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const bugId = e.target.dataset.bugId;
        const newStatus = e.target.value;
        await updateBugStatus(bugId, newStatus);
      });
    });

    // Editar Bug
    document.querySelectorAll('.btn-edit-bug').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const bugId = e.currentTarget.dataset.bugId;
        const res = await fetch('/api/bugs');
        const bugs = await res.json();
        const bug = bugs.find(b => String(b.id) === String(bugId));
        if (bug) {
          await setupBugModal({ bug });
        }
      });
    });

    // Copiar Bug para Jira
    document.querySelectorAll('.btn-copy-bug').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        await copyBugToClipboard(e.currentTarget.dataset.bugId);
      });
    });

    // Eliminar Bug
    document.querySelectorAll('.btn-delete-bug').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const bugId = e.currentTarget.dataset.bugId;
        await deleteBug(bugId);
      });
    });
  }

  // --- REGISTRO Y DETECCIÓN GLOBAL DE PEGADO (Ctrl+V) DE IMÁGENES ---
  let lastActiveResultId = null;

  document.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.case-exec-card');
    if (card) {
      lastActiveResultId = card.id.replace('case-card-', '');
    }
  });

  document.addEventListener('click', (e) => {
    const card = e.target.closest('.case-exec-card');
    if (card) {
      lastActiveResultId = card.id.replace('case-card-', '');
    }
  });

  document.addEventListener('paste', async (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    // Extraer archivos o elementos de imagen del portapapeles
    const items = clipboardData.items || [];
    const files = clipboardData.files || [];

    const imageFiles = [];

    for (let i = 0; i < files.length; i++) {
      if (files[i].type && files[i].type.startsWith('image/')) {
        imageFiles.push(files[i]);
      }
    }

    if (imageFiles.length === 0) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) imageFiles.push(blob);
        }
      }
    }

    // Si NO hay imágenes en el portapapeles, ignorar para permitir pegado normal de texto
    if (imageFiles.length === 0) return;

    // Verificar si estamos en el modal de bugs
    const modalBug = document.getElementById('modal-new-bug');
    if (modalBug && !modalBug.classList.contains('hidden')) {
      e.preventDefault();
      for (let i = 0; i < imageFiles.length; i++) {
        await uploadGenericEvidenceFile(imageFiles[i]);
      }
      return;
    }

    // Evitar comportamiento por defecto del navegador para imágenes
    e.preventDefault();

    // Determinar el caso de prueba destinatario
    let targetResultId = null;
    const activeEl = document.activeElement;
    const cardFromFocus = activeEl ? activeEl.closest('.case-exec-card') : null;
    const cardFromHover = document.querySelector('.case-exec-card:hover');

    if (cardFromFocus) {
      targetResultId = cardFromFocus.id.replace('case-card-', '');
    } else if (cardFromHover) {
      targetResultId = cardFromHover.id.replace('case-card-', '');
    } else if (lastActiveResultId) {
      targetResultId = lastActiveResultId;
    } else {
      const firstCard = document.querySelector('.case-exec-card');
      if (firstCard) targetResultId = firstCard.id.replace('case-card-', '');
    }

    if (targetResultId) {
      for (let i = 0; i < imageFiles.length; i++) {
        await uploadEvidenceFile(targetResultId, imageFiles[i]);
      }
      openExecutionDetail(currentRunId);
    } else {
      await showHigAlert('Selecciona un Caso', 'Haz clic o coloca el puntero sobre el caso de prueba donde deseas pegar la evidencia.');
    }
  });

  // Update Counters
  function updateExecCounters() {
    const passed = activeCasesResults.filter(c => c.status === 'Pass').length;
    const failed = activeCasesResults.filter(c => c.status === 'Fail').length;
    const blocked = activeCasesResults.filter(c => c.status === 'Blocked').length;
    const desestimado = activeCasesResults.filter(c => c.status === 'Desestimado').length;
    const untested = activeCasesResults.filter(c => c.status === 'Untested' || !c.status).length;

    document.getElementById('stat-pass').textContent = passed;
    document.getElementById('stat-fail').textContent = failed;
    document.getElementById('stat-blocked').textContent = blocked;
    document.getElementById('stat-desestimado').textContent = desestimado;
    document.getElementById('stat-untested').textContent = untested;
  }

  // Update Case Status via API
  async function updateCaseStatus(resultId, status) {
    const item = activeCasesResults.find(c => String(c.result_id) === String(resultId));
    if (item) item.status = status;

    updateExecCounters();
    renderExecutionCasesList();

    try {
      await fetch(`/api/test-execution/${resultId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (err) {
      console.error('Error guardando estado:', err);
    }
  }

  // Update Case Notes via API
  async function updateCaseNotes(resultId, notes) {
    const item = activeCasesResults.find(c => String(c.result_id) === String(resultId));
    if (item) item.notes = notes;

    try {
      await fetch(`/api/test-execution/${resultId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
    } catch (err) {
      console.error('Error guardando notas:', err);
    }
  }

  // Subir archivo de evidencia
  async function uploadEvidenceFile(resultId, file) {
    const formData = new FormData();
    formData.append('evidence', file);

    try {
      const res = await fetch(`/api/test-execution/${resultId}/evidence`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        await showHigAlert('Error', 'No se pudo adjuntar la imagen de evidencia.');
      }
    } catch (err) {
      console.error('Error subiendo evidencia:', err);
      await showHigAlert('Error de Archivo', 'No se pudo subir la imagen.');
    }
  }

  // Subir evidencia generica (Bugs)
  async function uploadGenericEvidenceFile(file) {
    const formData = new FormData();
    formData.append('evidence', file);

    try {
      const res = await fetch('/api/upload-evidence', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        bugTempEvidences.push(data.evidence_path);
        renderBugEvidences();
      } else {
        await showHigAlert('Error', 'No se pudo adjuntar la imagen al bug.');
      }
    } catch (err) {
      console.error('Error subiendo evidencia generica:', err);
      await showHigAlert('Error de Archivo', 'No se pudo subir la imagen.');
    }
  }

  function renderBugEvidences() {
    const container = document.getElementById('bug-evidence-container');
    if (!container) return;
    
    container.innerHTML = '';
    if (bugTempEvidences.length === 0) {
      container.innerHTML = '<span class="subtext">No hay imágenes. (Pega con Ctrl+V)</span>';
      return;
    }
    
    bugTempEvidences.forEach((path, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'evidence-thumbnail';
      thumb.style.backgroundImage = `url('/${path}')`;
      thumb.title = "Haz clic para ver";
      thumb.dataset.img = `/${path}`;
      
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete-evidence-sm';
      delBtn.innerHTML = '<i data-lucide="x"></i>';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        bugTempEvidences.splice(idx, 1);
        renderBugEvidences();
      };
      
      thumb.appendChild(delBtn);
      thumb.onclick = (e) => {
        if (e.target === delBtn || delBtn.contains(e.target)) return;
        const images = bugTempEvidences.map(ev => typeof ev === 'string' ? ev : (ev.path || ev.data)).filter(Boolean);
        const clickedSrc = thumb.dataset.img;
        const clickedIndex = images.indexOf(clickedSrc);
        openLightboxGallery(images.length ? images : [clickedSrc], Math.max(0, clickedIndex), 'Evidencia de Bug');
      };
      
      container.appendChild(thumb);
    });
    lucide.createIcons();
  }

  // Pegar evidencia en Base64 (Ctrl+V)
  async function pasteEvidenceBase64(resultId, base64Image) {
    try {
      const res = await fetch(`/api/test-execution/${resultId}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image })
      });
      if (!res.ok) {
        await showHigAlert('Error', 'No se pudo guardar la imagen pegada.');
      }
    } catch (err) {
      console.error('Error enviando captura pegada:', err);
    }
  }

  // Eliminar Evidencia de Caso
  async function deleteCaseEvidence(resultId, evidencePath) {
    const confirmed = await showHigConfirm(
      '¿Eliminar Evidencia?',
      '¿Deseas eliminar esta captura de pantalla del caso de prueba?',
      true,
      'Eliminar'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/test-execution/${resultId}/evidence`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidencePath })
      });
      if (res.ok) {
        openExecutionDetail(currentRunId);
      } else {
        await showHigAlert('Error', 'No se pudo eliminar la evidencia.');
      }
    } catch (err) {
      console.error('Error eliminando evidencia:', err);
    }
  }

  // --- BUGS MANAGEMENT ---

  function refreshViewAfterBugChange() {
    if (views.bugs && !views.bugs.classList.contains('hidden')) {
      loadBugs();
    } else if (views.executionDetail && !views.executionDetail.classList.contains('hidden') && currentRunId) {
      openExecutionDetail(currentRunId);
    } else {
      loadBugs();
    }
  }

  let bugTempEvidences = [];

  async function setupBugModal(options = {}) {
    const { bug = null, runId = null, caseId = null, resultId = null } = options;
    const form = document.getElementById('form-new-bug');
    form.reset();
    
    if (bug) {
      bugTempEvidences = Array.isArray(bug.evidence_paths) ? [...bug.evidence_paths] : [];
    } else if (resultId) {
      const activeResult = activeCasesResults.find(c => String(c.result_id) === String(resultId));
      if (activeResult && Array.isArray(activeResult.evidence_paths)) {
        bugTempEvidences = [...activeResult.evidence_paths];
      } else {
        bugTempEvidences = [];
      }
    } else {
      bugTempEvidences = [];
    }
    
    renderBugEvidences();

    document.getElementById('bug-edit-id').value = bug ? bug.id : '';
    document.getElementById('bug-result-id').value = bug ? (bug.result_id || '') : (resultId || '');

    const titleEl = document.getElementById('bug-modal-title');
    if (titleEl) {
      titleEl.innerHTML = bug ? '<i data-lucide="bug"></i> Editar Bug' : '<i data-lucide="bug"></i> Registrar Nuevo Bug';
    }

    const runSelect = document.getElementById('select-bug-run-id');

    try {
      const res = await fetch('/api/test-runs');
      const runs = await res.json();

      runSelect.innerHTML = '<option value="">Selecciona una ejecución...</option>' +
        runs.map(r => `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.environment)})</option>`).join('');

      const defaultRunId = (views.executionDetail && !views.executionDetail.classList.contains('hidden')) ? currentRunId : '';
      const targetRunId = bug ? bug.run_id : (runId || defaultRunId || '');
      if (targetRunId) {
        runSelect.value = targetRunId;
      }

      await updateBugModalCases(bug ? bug.case_id : caseId, bug ? bug.result_id : resultId);
    } catch(err) {
      console.error('Error poblando ejecuciones para bug:', err);
    }

    if (bug) {
      document.getElementById('input-bug-title').value = bug.title || '';
      document.getElementById('input-bug-desc').value = bug.description || '';
      document.getElementById('input-bug-reproduction').value = bug.reproduction || '';
      document.getElementById('input-bug-expected').value = bug.expected_result || '';
      document.getElementById('input-bug-assigned').value = bug.assigned_to || '';
      document.getElementById('select-bug-severity').value = bug.severity || 'Media';
      document.getElementById('select-bug-status').value = bug.status || 'Abierto';
    }

    await populateAssigneesDatalist();
    openModal(modals.newBug);
  }

  async function updateBugModalCases(preselectCaseId = null, preselectResultId = null) {
    const runSelect = document.getElementById('select-bug-run-id');
    const caseSelect = document.getElementById('select-bug-case-id');
    const selectedRunId = runSelect.value;

    if (!selectedRunId) {
      caseSelect.innerHTML = '<option value="">Ninguno - Defecto General de la Ejecución</option>';
      caseSelect.value = '';
      return;
    }

    try {
      const res = await fetch(`/api/test-runs/${selectedRunId}`);
      const data = await res.json();
      const results = data.results || [];

      caseSelect.innerHTML = '<option value="">Ninguno - Defecto General de la Ejecución</option>' +
        results.map(r => `<option value="${r.case_id}" data-result-id="${r.result_id}">${escapeHtml(r.case_number)}: ${escapeHtml(r.title)}</option>`).join('');

      if (preselectCaseId) {
        caseSelect.value = preselectCaseId;
      } else {
        caseSelect.value = '';
      }

      if (preselectResultId) {
        document.getElementById('bug-result-id').value = preselectResultId;
      } else {
        const selOpt = caseSelect.options[caseSelect.selectedIndex];
        document.getElementById('bug-result-id').value = (selOpt && selOpt.dataset.resultId) ? selOpt.dataset.resultId : '';
      }
    } catch (err) {
      console.error('Error cargando casos para el bug:', err);
      caseSelect.innerHTML = '<option value="">Ninguno - Defecto General de la Ejecución</option>';
    }
  }

  document.getElementById('select-bug-run-id').addEventListener('change', () => {
    updateBugModalCases();
  });

  document.getElementById('select-bug-case-id').addEventListener('change', (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    if (opt && opt.dataset.resultId) {
      document.getElementById('bug-result-id').value = opt.dataset.resultId;
    } else {
      document.getElementById('bug-result-id').value = '';
    }
  });

  // Submit Form New / Edit Bug
  document.getElementById('form-new-bug').addEventListener('submit', async (e) => {
    e.preventDefault();
    const bugId = document.getElementById('bug-edit-id').value;
    const run_id = document.getElementById('select-bug-run-id').value;
    const case_id = document.getElementById('select-bug-case-id').value || null;
    const result_id = document.getElementById('bug-result-id').value || null;

    const title = document.getElementById('input-bug-title').value;
    const description = document.getElementById('input-bug-desc').value;
    const reproduction = document.getElementById('input-bug-reproduction').value;
    const expected_result = document.getElementById('input-bug-expected').value;
    const assigned_to = document.getElementById('input-bug-assigned').value;
    const severity = document.getElementById('select-bug-severity').value;
    const status = document.getElementById('select-bug-status').value;

    try {
      let res;
      if (bugId) {
        res = await fetch(`/api/bugs/${bugId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ run_id, case_id, result_id, title, description, reproduction, expected_result, assigned_to, severity, status, evidence_paths: bugTempEvidences })
        });
      } else {
        res = await fetch('/api/bugs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ run_id, case_id, result_id, title, description, reproduction, expected_result, assigned_to, severity, status, evidence_paths: bugTempEvidences })
        });
      }

      if (res.ok) {
        closeModal(modals.newBug);
        showToast(bugId ? 'Bug actualizado correctamente' : 'Bug registrado correctamente');
        refreshViewAfterBugChange();
      } else {
        const data = await res.json();
        await showHigAlert('Error', data.error || 'No se pudo registrar el bug.');
      }
    } catch (err) {
      console.error('Error guardando bug:', err);
      await showHigAlert('Error de Conexión', 'Ocurrió un error al guardar el bug.');
    }
  });

  async function updateBugStatus(bugId, status) {
    try {
      const bugRes = await fetch('/api/bugs');
      const bugs = await bugRes.json();
      const bug = bugs.find(b => String(b.id) === String(bugId));
      if (!bug) return;

      await fetch(`/api/bugs/${bugId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bug, status })
      });

      refreshViewAfterBugChange();
    } catch (err) {
      console.error('Error actualizando estado de bug:', err);
    }
  }

  async function getBase64ImageFromUrl(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return url;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Error convirtiendo imagen a Base64:', e);
      return url;
    }
  }

  function parseReproductionSteps(reproductionText) {
    if (!reproductionText || !reproductionText.trim()) return [];
    const rawLines = reproductionText.split(/\r?\n/);
    const steps = [];
    for (let line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Remueve numeración previa o bullets si existen (ej. "1. ", "1) ", "1.- ", "- ", "* ", "• ")
      const cleanStep = trimmed.replace(/^(\d+[\.\)\-]\s*|[\*\-•]\s*)/, '').trim();
      steps.push(cleanStep || trimmed);
    }
    return steps;
  }

  async function copyBugToClipboard(bugId) {
    try {
      const res = await fetch(`/api/bugs`);
      const allBugs = await res.json();
      const bug = allBugs.find(b => String(b.id) === String(bugId));
      if (!bug) {
        await showHigAlert('Error', 'No se pudo encontrar la información del bug.');
        return;
      }

      const bugEvidences = Array.isArray(bug.evidence_paths) ? bug.evidence_paths : [];

      // Convertir imágenes de evidencias a Base64 para que se puedan pegar como imagen real en Jira (igual a click derecho - copiar)
      const base64Evidences = await Promise.all(
        bugEvidences.map(async (evPath) => {
          const normPath = window.location.origin + '/' + String(evPath).replace(/\\/g, '/').replace(/^\/+/, '');
          const b64 = await getBase64ImageFromUrl(normPath);
          return { normPath, b64 };
        })
      );

      const reproSteps = parseReproductionSteps(bug.reproduction);

      // Representación en texto plano (Markdown sutil)
      let text = `Bug #${bug.id}: ${bug.title}\n`;
      text += `Estado: ${bug.status} | Severidad: ${bug.severity}\n`;
      text += `Asignado a: ${bug.assigned_to || 'Sin Asignar'}\n`;
      if (bug.group_name) text += `Historia de Usuario: ${bug.group_name}\n`;
      if (bug.run_name) text += `Ejecución: ${bug.run_name}\n`;
      if (bug.case_number) text += `Caso de Prueba: ${bug.case_number}${bug.case_title ? ' - ' + bug.case_title : ''}\n`;
      text += `\n--- DESCRIPCIÓN ---\n${bug.description || 'Sin descripción'}\n`;
      
      if (bug.reproduction) {
        text += `\n--- PASOS A REPRODUCIR ---\n`;
        if (reproSteps.length > 0) {
          reproSteps.forEach((step, idx) => {
            text += `${idx + 1}. ${step}\n`;
          });
        } else {
          text += `${bug.reproduction}\n`;
        }
      }

      if (bug.expected_result) {
        text += `\n--- RESULTADO ESPERADO ---\n${bug.expected_result}\n`;
      }

      if (bugEvidences.length > 0) {
        text += `\n--- IMÁGENES / EVIDENCIAS ADJUNTAS ---\n`;
        base64Evidences.forEach(item => {
          text += `- ${item.normPath}\n`;
        });
      }

      // Representación en HTML enriquecido (compatible con Jira Rich Text Editor)
      let html = `<h3>Bug #${bug.id}: ${escapeHtml(bug.title)}</h3>`;
      html += `<p><strong>Estado:</strong> ${escapeHtml(bug.status)} | <strong>Severidad:</strong> ${escapeHtml(bug.severity)} | <strong>Asignado a:</strong> ${escapeHtml(bug.assigned_to || 'Sin Asignar')}</p>`;
      if (bug.group_name) html += `<p><strong>Historia de Usuario (HU):</strong> ${escapeHtml(bug.group_name)}</p>`;
      if (bug.run_name) html += `<p><strong>Ejecución:</strong> ${escapeHtml(bug.run_name)}</p>`;
      if (bug.case_number) html += `<p><strong>Caso de Prueba:</strong> ${escapeHtml(bug.case_number)}${bug.case_title ? ' - ' + escapeHtml(bug.case_title) : ''}</p>`;
      
      html += `<h4>Descripción</h4>`;
      html += `<p style="white-space: pre-wrap;">${escapeHtml(bug.description || 'Sin descripción')}</p>`;
      
      if (bug.reproduction) {
        html += `<h4>Pasos a Reproducir</h4>`;
        if (reproSteps.length > 0) {
          html += `<ol>`;
          reproSteps.forEach(step => {
            html += `<li>${escapeHtml(step)}</li>`;
          });
          html += `</ol>`;
        } else {
          html += `<p style="white-space: pre-wrap;">${escapeHtml(bug.reproduction)}</p>`;
        }
      }
      
      if (bug.expected_result) {
        html += `<h4>Resultado Esperado</h4>`;
        html += `<p style="white-space: pre-wrap;">${escapeHtml(bug.expected_result)}</p>`;
      }

      if (base64Evidences.length > 0) {
        html += `<h4>Evidencias Adjuntas</h4><ul>`;
        base64Evidences.forEach(item => {
          html += `<li style="margin-bottom: 10px;"><a href="${item.normPath}" target="_blank">${escapeHtml(item.normPath)}</a><br><img src="${item.b64}" alt="Evidencia" style="max-width: 500px; border: 1px solid #eaeaea; margin-top: 5px; display: block;" /></li>`;
        });
        html += `</ul>`;
      }

      const blobText = new Blob([text], { type: 'text/plain' });
      const blobHtml = new Blob([html], { type: 'text/html' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': blobText,
          'text/html': blobHtml
        })
      ]);

      showToast('¡Copiado al portapapeles para Jira!');
    } catch (err) {
      console.error('Error al copiar el bug:', err);
      await showHigAlert('Error', 'No se pudo copiar el contenido al portapapeles. Asegúrate de otorgar los permisos en el navegador.');
    }
  }

  async function deleteBug(bugId) {
    const confirmed = await showHigConfirm(
      '¿Eliminar Bug?',
      '¿Estás seguro de que deseas eliminar este bug?',
      true,
      'Eliminar Bug'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/bugs/${bugId}`, { method: 'DELETE' });
      if (res.ok) {
        refreshViewAfterBugChange();
      } else {
        await showHigAlert('Error', 'No se pudo eliminar el bug.');
      }
    } catch (err) {
      console.error('Error eliminando bug:', err);
    }
  }

  async function populateAssigneesDatalist() {
    const datalist = document.getElementById('assignees-list');
    if (!datalist) return;
    try {
      const res = await fetch('/api/bugs');
      const bugs = await res.json();
      const assignees = [...new Set(bugs.map(b => b.assigned_to).filter(Boolean))];
      datalist.innerHTML = assignees.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
    } catch(e) {}
  }

  // --- BUGS MODULE VIEW ---
  async function loadBugs() {
    const grid = document.getElementById('bugs-grid');
    if (!grid) return;

    grid.innerHTML = '<p class="subtext">Cargando módulo de bugs...</p>';

    try {
      const [bugsRes, groupsRes, runsRes] = await Promise.all([
        fetch('/api/bugs'),
        fetch('/api/test-groups'),
        fetch('/api/test-runs')
      ]);
      allBugsData = await bugsRes.json();
      const groupsData = await groupsRes.json();
      const runsData = await runsRes.json();

      populateBugsDropdownFilters(allBugsData, groupsData, runsData);
      renderBugsList();
    } catch (err) {
      console.error(err);
      grid.innerHTML = '<p class="subtext">Error al cargar los bugs.</p>';
    }
  }

  function populateBugsDropdownFilters(bugsList, groupsList, runsList) {
    const assigneeSelect = document.getElementById('select-filter-bug-assignee');
    const groupSelect = document.getElementById('select-filter-bug-group');
    const runSelect = document.getElementById('select-filter-bug-run');

    if (assigneeSelect) {
      const currentVal = assigneeSelect.value || 'ALL';
      const assignees = [...new Set(bugsList.map(b => b.assigned_to).filter(Boolean))];
      assigneeSelect.innerHTML = '<option value="ALL">Todas las personas</option>' +
        assignees.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
      assigneeSelect.value = currentVal;
    }

    if (groupSelect) {
      const currentVal = groupSelect.value || 'ALL';
      groupSelect.innerHTML = '<option value="ALL">Todas las Historias</option>' +
        groupsList.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
      groupSelect.value = currentVal;
    }

    if (runSelect) {
      const currentVal = runSelect.value || 'ALL';
      runSelect.innerHTML = '<option value="ALL">Todas las ejecuciones</option>' +
        runsList.map(r => `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.environment)})</option>`).join('');
      runSelect.value = currentVal;
    }
  }

  function renderBugsList() {
    const grid = document.getElementById('bugs-grid');
    if (!grid) return;

    const searchInput = document.getElementById('input-search-bugs');
    const searchVal = searchInput ? String(searchInput.value || '').trim().toLowerCase() : '';

    const groupSelect = document.getElementById('select-filter-bug-group');
    const groupFilter = groupSelect ? groupSelect.value : 'ALL';

    const runSelect = document.getElementById('select-filter-bug-run');
    const runFilter = runSelect ? runSelect.value : 'ALL';

    const assigneeSelect = document.getElementById('select-filter-bug-assignee');
    const assigneeFilter = assigneeSelect ? assigneeSelect.value : 'ALL';

    const statusSelect = document.getElementById('select-filter-bug-status');
    const statusFilter = statusSelect ? statusSelect.value : 'ALL';

    const severitySelect = document.getElementById('select-filter-bug-severity');
    const severityFilter = severitySelect ? severitySelect.value : 'ALL';

    let filtered = allBugsData.filter(b => {
      const title = String(b.title || '').toLowerCase();
      const desc = String(b.description || '').toLowerCase();
      const repro = String(b.reproduction || '').toLowerCase();
      const exp = String(b.expected_result || '').toLowerCase();
      const assignee = String(b.assigned_to || '').toLowerCase();

      const matchesSearch = !searchVal || title.includes(searchVal) || desc.includes(searchVal) || repro.includes(searchVal) || exp.includes(searchVal) || assignee.includes(searchVal);
      const matchesGroup = groupFilter === 'ALL' || String(b.group_id) === String(groupFilter);
      const matchesRun = runFilter === 'ALL' || String(b.run_id) === String(runFilter);
      const matchesAssignee = assigneeFilter === 'ALL' || assignee === assigneeFilter.toLowerCase();
      const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
      const matchesSeverity = severityFilter === 'ALL' || b.severity === severityFilter;

      return matchesSearch && matchesGroup && matchesRun && matchesAssignee && matchesStatus && matchesSeverity;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="glass-panel text-center" style="grid-column: 1/-1; padding: 40px;">
          <i data-lucide="check-circle" style="width: 48px; height: 48px; color: var(--color-pass); margin-bottom: 12px;"></i>
          <h3>No hay bugs coincidentes</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 6px;">No se encontraron defectos registrados con los filtros seleccionados.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    grid.innerHTML = filtered.map(bug => {
      const bugEvidences = Array.isArray(bug.evidence_paths) ? bug.evidence_paths : [];

      return `
        <div class="bug-card-full">
          <div class="bug-card-header">
            <div class="bug-card-title-box">
              <span class="bug-sev-badge bug-sev-${bug.severity}">${bug.severity}</span>
              <h3 class="bug-card-title">#${bug.id} - ${escapeHtml(bug.title)}</h3>
            </div>
            <select class="bug-status-select btn-change-bug-status" data-bug-id="${bug.id}">
              <option value="Abierto" ${bug.status === 'Abierto' ? 'selected' : ''}>Abierto</option>
              <option value="En Progreso" ${bug.status === 'En Progreso' ? 'selected' : ''}>En Progreso</option>
              <option value="Resuelto" ${bug.status === 'Resuelto' ? 'selected' : ''}>Resuelto</option>
              <option value="Cerrado" ${bug.status === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
            </select>
          </div>

          <!-- Campos estructurados del Bug -->
          ${bug.description ? `
            <div class="bug-card-section sec-desc">
              <span class="bug-card-section-label">Descripción</span>
              <p class="bug-card-section-content">${escapeHtml(bug.description)}</p>
            </div>
          ` : ''}

          ${bug.reproduction ? `
            <div class="bug-card-section sec-repro">
              <span class="bug-card-section-label">Pasos de Reproducción</span>
              ${(() => {
                const steps = parseReproductionSteps(bug.reproduction);
                if (steps.length > 0) {
                  return `<ol style="margin: 4px 0 0 18px; padding: 0; font-size: 0.85rem; color: var(--text-secondary);">${steps.map(s => `<li style="margin-bottom: 2px;">${escapeHtml(s)}</li>`).join('')}</ol>`;
                }
                return `<p class="bug-card-section-content">${escapeHtml(bug.reproduction)}</p>`;
              })()}
            </div>
          ` : ''}

          ${bug.expected_result ? `
            <div class="bug-card-section sec-exp">
              <span class="bug-card-section-label">Resultado Esperado</span>
              <p class="bug-card-section-content">${escapeHtml(bug.expected_result)}</p>
            </div>
          ` : ''}

          ${bugEvidences.length > 0 ? `
            <div style="margin-top: 4px;">
              <span style="font-size: 0.7rem; color: var(--text-dim); font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 4px;">EVIDENCIAS ASOCIADAS (${bugEvidences.length})</span>
              <div class="evidence-gallery-grid">
                ${bugEvidences.map(evPath => {
                  const normPath = '/' + String(evPath).replace(/\\/g, '/').replace(/^\/+/, '');
                  return `
                    <div class="evidence-thumb-container">
                      <div class="evidence-thumb-wrap btn-view-evidence" data-img="${normPath}">
                        <img src="${normPath}" alt="Evidencia de Bug">
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <div class="bug-card-footer">
            <div class="bug-card-meta">
              <span class="bug-meta-item">
                <i data-lucide="user" style="width: 14px; height: 14px; display: inline;"></i> ${escapeHtml(bug.assigned_to || 'Sin Asignar')}
              </span>
              <span class="bug-meta-item">HU: <strong>${escapeHtml(bug.group_name || 'Sin HU')}</strong></span>
              <span class="bug-meta-item">Ejecución: <strong>${escapeHtml(bug.run_name || 'Sin Ejecución')}</strong></span>
              <span class="bug-meta-item">Caso: ${escapeHtml(bug.case_number)}${bug.case_title ? ' - ' + escapeHtml(bug.case_title) : ''}</span>
            </div>
            <div class="bug-card-actions">
              <button class="btn btn-secondary btn-sm btn-copy-bug-module" data-bug-id="${bug.id}" style="color: var(--accent-dark); border-color: var(--border-subtle); background: var(--bg-surface-hover);">
                <i data-lucide="copy"></i> Copiar Jira
              </button>
              <button class="btn btn-secondary btn-sm btn-edit-bug-module" data-bug-id="${bug.id}">
                <i data-lucide="edit"></i> Editar
              </button>
              <button class="btn btn-secondary btn-sm btn-delete-bug-module" data-bug-id="${bug.id}" style="color: var(--color-fail); border-color: var(--color-fail-border); background: var(--color-fail-bg);">
                <i data-lucide="trash-2"></i> Eliminar
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();

    document.querySelectorAll('.btn-change-bug-status').forEach(select => {
      select.addEventListener('change', async (e) => {
        await updateBugStatus(e.target.dataset.bugId, e.target.value);
      });
    });

    document.querySelectorAll('.btn-edit-bug-module').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const bugId = e.currentTarget.dataset.bugId;
        const bug = allBugsData.find(b => String(b.id) === String(bugId));
        if (bug) {
          await setupBugModal({ bug });
        }
      });
    });

    document.querySelectorAll('.btn-copy-bug-module').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        await copyBugToClipboard(e.currentTarget.dataset.bugId);
      });
    });

    document.querySelectorAll('.btn-delete-bug-module').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        await deleteBug(e.currentTarget.dataset.bugId);
      });
    });

    document.querySelectorAll('#bugs-grid .btn-view-evidence').forEach(thumb => {
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        const bugCard = e.currentTarget.closest('.bug-card-full, .card-bug, .evidence-gallery-grid');
        const allThumbs = Array.from(bugCard ? bugCard.querySelectorAll('.btn-view-evidence') : [e.currentTarget]);
        const images = allThumbs.map(t => t.dataset.img).filter(Boolean);
        const clickedSrc = e.currentTarget.dataset.img;
        const clickedIndex = images.indexOf(clickedSrc);
        const bugTitle = bugCard ? bugCard.querySelector('.bug-card-title, h3, h4')?.textContent?.trim() : 'Evidencia de Bug';
        openLightboxGallery(images.length ? images : [clickedSrc], Math.max(0, clickedIndex), bugTitle || 'Evidencia de Bug');
      });
    });
  }

  const btnOpenNewBugMod = document.getElementById('btn-open-new-bug-module');
  if (btnOpenNewBugMod) {
    btnOpenNewBugMod.addEventListener('click', async () => {
      await setupBugModal();
    });
  }

  // PDF Report for Bugs
  const btnDownloadBugsPdf = document.getElementById('btn-download-bugs-pdf');
  if (btnDownloadBugsPdf) {
    btnDownloadBugsPdf.addEventListener('click', () => {
      const group_id = document.getElementById('select-filter-bug-group').value;
      const run_id = document.getElementById('select-filter-bug-run').value;
      const assignee = document.getElementById('select-filter-bug-assignee').value;
      const status = document.getElementById('select-filter-bug-status').value;
      const severity = document.getElementById('select-filter-bug-severity').value;

      const queryParams = new URLSearchParams({
        group_id: group_id,
        run_id: run_id,
        assigned_to: assignee,
        status: status,
        severity: severity
      });

      window.open(`/api/bugs/pdf?${queryParams.toString()}`, '_blank');
    });
  }

  // Filter Listeners for Bugs Module
  const inputSearchBugs = document.getElementById('input-search-bugs');
  if (inputSearchBugs) inputSearchBugs.addEventListener('input', renderBugsList);

  const selectFilterBugGroup = document.getElementById('select-filter-bug-group');
  if (selectFilterBugGroup) selectFilterBugGroup.addEventListener('change', renderBugsList);

  const selectFilterBugRun = document.getElementById('select-filter-bug-run');
  if (selectFilterBugRun) selectFilterBugRun.addEventListener('change', renderBugsList);

  const selectFilterBugAssignee = document.getElementById('select-filter-bug-assignee');
  if (selectFilterBugAssignee) selectFilterBugAssignee.addEventListener('change', renderBugsList);

  const selectFilterBugStatus = document.getElementById('select-filter-bug-status');
  if (selectFilterBugStatus) selectFilterBugStatus.addEventListener('change', renderBugsList);

  const selectFilterBugSeverity = document.getElementById('select-filter-bug-severity');
  if (selectFilterBugSeverity) selectFilterBugSeverity.addEventListener('change', renderBugsList);

  // Delete Test Run via API
  async function deleteTestRun(runId) {
    if (!runId) return;
    const confirmed = await showHigConfirm(
      '¿Eliminar Ejecución de Pruebas?',
      'Esta acción eliminará la jornada activa y todos sus resultados evaluados. Esta operación no se puede deshacer.',
      true,
      'Eliminar'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/test-runs/${runId}`, { method: 'DELETE' });
      if (res.ok) {
        currentRunId = null;
        switchView('runs');
      } else {
        const data = await res.json();
        await showHigAlert('Error al Eliminar', data.error || 'No se pudo eliminar la ejecución.');
      }
    } catch (err) {
      console.error('Error al eliminar ejecución:', err);
      await showHigAlert('Error de Conexión', 'Ocurrió un problema de red al intentar eliminar la ejecución.');
    }
  }

  // Delete Test Group via API
  async function deleteTestGroup(groupId, groupName) {
    if (!groupId) return;
    const confirmed = await showHigConfirm(
      '¿Eliminar Grupo de Casos?',
      `¿Estás seguro de que deseas eliminar el grupo "${groupName}" y todos sus casos de prueba asociados?`,
      true,
      'Eliminar Grupo'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/test-groups/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        loadLibraryCases();
      } else {
        const data = await res.json();
        await showHigAlert('Error al Eliminar', data.error || 'No se pudo eliminar el grupo.');
      }
    } catch (err) {
      console.error('Error al eliminar grupo:', err);
      await showHigAlert('Error de Conexión', 'Ocurrió un problema de red al intentar eliminar el grupo.');
    }
  }

  // Delete Run Button in Detail Header
  const btnDeleteRun = document.getElementById('btn-delete-run');
  if (btnDeleteRun) {
    btnDeleteRun.addEventListener('click', () => {
      deleteTestRun(currentRunId);
    });
  }

  // Download PDF Report
  const btnDownloadPdf = document.getElementById('btn-download-pdf');
  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', () => {
      if (!currentRunId) return;
      window.open(`/api/test-runs/${currentRunId}/pdf`, '_blank');
    });
  }

  // Filter Event Listeners for Execution View
  const inputSearchCase = document.getElementById('input-search-case');
  if (inputSearchCase) inputSearchCase.addEventListener('input', renderExecutionCasesList);

  const selectFilterStatus = document.getElementById('select-filter-status');
  if (selectFilterStatus) selectFilterStatus.addEventListener('change', renderExecutionCasesList);

  const selectSortExecField = document.getElementById('select-sort-exec-field');
  if (selectSortExecField) selectSortExecField.addEventListener('change', renderExecutionCasesList);

  const selectSortExecDir = document.getElementById('select-sort-exec-dir');
  if (selectSortExecDir) selectSortExecDir.addEventListener('change', renderExecutionCasesList);

  // Filter & Sort Event Listeners for Library View
  const inputSearchLibrary = document.getElementById('input-search-library');
  if (inputSearchLibrary) inputSearchLibrary.addEventListener('input', loadLibraryCases);

  const selectFilterLibGroup = document.getElementById('select-filter-library-group');
  if (selectFilterLibGroup) selectFilterLibGroup.addEventListener('change', loadLibraryCases);

  const selectSortLibField = document.getElementById('select-sort-library-field');
  if (selectSortLibField) selectSortLibField.addEventListener('change', loadLibraryCases);

  const selectSortLibDir = document.getElementById('select-sort-library-dir');
  if (selectSortLibDir) selectSortLibDir.addEventListener('change', loadLibraryCases);

  // --- FETCH & RENDER LIBRARY BY GROUPS ---
  async function loadLibraryCases() {
    const grid = document.getElementById('library-grid');
    if (!grid) return;

    const searchInput = document.getElementById('input-search-library');
    const searchVal = searchInput ? String(searchInput.value || '').trim().toLowerCase() : '';

    const groupSelect = document.getElementById('select-filter-library-group');
    const groupFilter = groupSelect ? groupSelect.value || 'all' : 'all';

    const sortFieldSelect = document.getElementById('select-sort-library-field');
    const sortField = sortFieldSelect ? sortFieldSelect.value || 'number' : 'number';

    const sortDirSelect = document.getElementById('select-sort-library-dir');
    const sortDir = sortDirSelect ? sortDirSelect.value || 'asc' : 'asc';

    grid.innerHTML = '<p class="subtext">Cargando biblioteca de grupos...</p>';

    try {
      await populateGroupsSelect();

      const [groupsRes, casesRes] = await Promise.all([
        fetch('/api/test-groups'),
        fetch('/api/test-cases')
      ]);

      if (!groupsRes.ok || !casesRes.ok) {
        throw new Error('No se pudo obtener la respuesta del servidor');
      }

      let groups = await groupsRes.json();
      let cases = await casesRes.json();

      if (!Array.isArray(groups)) groups = [];
      if (!Array.isArray(cases)) cases = [];

      if (groups.length === 0 && cases.length === 0) {
        grid.innerHTML = '<p class="subtext" style="padding: 20px;">No hay casos importados aún. Usa el botón "Importar Excel".</p>';
        return;
      }

      // If cases exist but no groups, build default group list
      if (groups.length === 0 && cases.length > 0) {
        groups = [{ id: 1, name: 'Grupo Importado Inicial', created_at: new Date().toISOString() }];
      }

      // Map cases by group
      let displayGroups = groups.map(g => {
        const groupCases = cases.filter(c => Number(c.group_id || 1) === Number(g.id));
        return {
          ...g,
          cases: groupCases
        };
      });

      // Include unmapped cases in a fallback group if any exist
      const mappedCaseIds = new Set(displayGroups.flatMap(g => g.cases.map(c => c.id)));
      const unmappedCases = cases.filter(c => !mappedCaseIds.has(c.id));
      if (unmappedCases.length > 0) {
        displayGroups.push({
          id: 'unmapped',
          name: 'Otros Casos Importados',
          created_at: new Date().toISOString(),
          cases: unmappedCases
        });
      }

      // Filter by group dropdown
      if (groupFilter !== 'all') {
        displayGroups = displayGroups.filter(g => String(g.id) === String(groupFilter));
      }

      // Filter by search query
      if (searchVal) {
        displayGroups = displayGroups.map(g => {
          const nameMatches = String(g.name || '').toLowerCase().includes(searchVal);
          const filteredCases = (g.cases || []).filter(c => {
            const num = String(c.case_number || '').toLowerCase();
            const title = String(c.title || '').toLowerCase();
            const sum = String(c.summary || '').toLowerCase();
            return num.includes(searchVal) || title.includes(searchVal) || sum.includes(searchVal);
          });
          return {
            ...g,
            cases: nameMatches ? g.cases : filteredCases
          };
        }).filter(g => (g.cases && g.cases.length > 0) || String(g.name || '').toLowerCase().includes(searchVal));
      }

      if (displayGroups.length === 0 || displayGroups.every(g => !g.cases || g.cases.length === 0)) {
        grid.innerHTML = '<p class="subtext" style="padding: 20px;">No se encontraron grupos ni casos que coincidan con el filtro.</p>';
        return;
      }

      grid.innerHTML = displayGroups.map(group => {
        const sortedGroupCases = sortCases(group.cases || [], sortField, sortDir);

        return `
          <div class="glass-panel" style="margin-bottom: 24px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 16px;">
              <div>
                <h3 style="font-family: var(--font-serif); font-size: 1.25rem; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                  <i data-lucide="folder" style="width: 18px; height: 18px; color: var(--text-muted);"></i>
                  ${escapeHtml(group.name)}
                </h3>
                <span class="subtext" style="font-size: 0.8rem;">
                  Creado: ${group.created_at ? new Date(group.created_at).toLocaleDateString() : 'N/A'} | ${sortedGroupCases.length} casos de prueba
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge-env">Grupo ID: ${group.id}</span>
                ${group.id !== 'unmapped' ? `
                  <button class="btn btn-secondary btn-sm btn-delete-group" data-id="${group.id}" data-name="${escapeHtml(group.name)}" style="color: #9f2f2d; border-color: #f6c6c7; background: #fdebec;" title="Eliminar grupo y sus casos">
                    <i data-lucide="trash-2"></i> Eliminar Grupo
                  </button>
                ` : ''}
              </div>
            </div>

            <div class="library-group-cases-list">
              ${sortedGroupCases.length === 0 ? '<p class="subtext" style="padding: 8px 0;">Este grupo no contiene casos coincidentes.</p>' : ''}
              ${sortedGroupCases.map(c => `
                <div class="glass-panel-sm" style="margin-bottom: 12px; background: #fdfdfd; border: 1px solid var(--border-subtle);">
                  <div class="case-title-area" style="margin-bottom: 6px;">
                    <span class="case-number-badge">${escapeHtml(c.case_number)}</span>
                    <h4 style="font-size: 0.925rem; font-weight: 600;">${escapeHtml(c.title)}</h4>
                    <span class="priority-tag priority-${c.priority || 'Media'}">${c.priority || 'Media'}</span>
                  </div>
                  ${c.summary ? `<p class="subtext" style="font-size: 0.825rem; margin-bottom: 6px;">${escapeHtml(c.summary)}</p>` : ''}
                  ${c.gherkin_steps ? `
                    <div class="gherkin-container" style="font-size: 0.775rem;">${escapeHtml(formatGherkinSteps(c.gherkin_steps))}</div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');

      lucide.createIcons();

      document.querySelectorAll('.btn-delete-group').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTestGroup(btn.dataset.id, btn.dataset.name);
        });
      });
    } catch (err) {
      console.error('Error cargando biblioteca:', err);
      grid.innerHTML = `<p class="subtext" style="color: #f87171; padding: 20px;">Error al cargar la biblioteca: ${escapeHtml(err.message)}</p>`;
    }
  }

  // Utils
  function parseCaseSteps(gherkinText, summaryText) {
    if (gherkinText && gherkinText.trim()) {
      const lines = gherkinText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
      if (lines.length > 0) return lines;
    }
    if (summaryText && summaryText.trim()) {
      return [summaryText.trim()];
    }
    return ['Ejecución de prueba del caso'];
  }

  function formatGherkinSteps(text) {
    if (!text) return '';
    return String(text)
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n');
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Init App
  switchView('runs');
});
