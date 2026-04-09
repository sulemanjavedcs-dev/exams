const authSection = document.getElementById('authSection');
const uploadSection = document.getElementById('uploadSection');
const loginForm = document.getElementById('loginForm');
const logoutButton = document.getElementById('logoutButton');
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('examFile');
const fileName = document.getElementById('fileName');
const status = document.getElementById('status');
const loginStatus = document.getElementById('loginStatus');
const userLabel = document.getElementById('userLabel');
const recentUploads = document.getElementById('recentUploads');
const dropZone = document.getElementById('dropZone');

const setStatus = (message, isError = false) => {
  status.textContent = message;
  status.style.color = isError ? '#b42318' : '#5d6270';
};

const setLoginStatus = (message, isError = false) => {
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? '#b42318' : '#5d6270';
};

const updateFileName = () => {
  const selectedFile = fileInput.files?.[0];
  fileName.textContent = selectedFile ? selectedFile.name : 'No file selected';
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderUploads = (uploads) => {
  if (!uploads.length) {
    recentUploads.innerHTML = '<li class="empty-state">No exams uploaded yet.</li>';
    return;
  }

  recentUploads.innerHTML = uploads
    .map(
      (upload) => `
        <li class="upload-item">
          <div>
            <strong>${escapeHtml(upload.originalName)}</strong>
            <span>${escapeHtml(new Date(upload.uploadedAt).toLocaleString())} • ${escapeHtml(upload.uploadedBy)}</span>
          </div>
          <a href="/api/uploads/${upload.id}/download">Download</a>
        </li>
      `
    )
    .join('');
};

const showAuthenticatedView = async (user) => {
  authSection.hidden = true;
  uploadSection.hidden = false;
  userLabel.textContent = `Signed in as ${user.username}`;
  setStatus('Ready to upload exam files.');
  updateFileName();

  const response = await fetch('/api/uploads');
  if (response.ok) {
    const result = await response.json();
    renderUploads(result.uploads);
  }
};

const showUnauthenticatedView = () => {
  authSection.hidden = false;
  uploadSection.hidden = true;
  userLabel.textContent = '';
  recentUploads.innerHTML = '<li class="empty-state">Sign in to see uploaded exams.</li>';
  setStatus('Sign in to upload exams.');
};

const loadSession = async () => {
  const response = await fetch('/api/session');
  const result = await response.json();

  if (result.authenticated) {
    await showAuthenticatedView(result.user);
    return;
  }

  showUnauthenticatedView();
};

fileInput.addEventListener('change', updateFileName);

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('is-dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('is-dragover');
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragover');

  if (event.dataTransfer.files.length > 0) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(event.dataTransfer.files[0]);
    fileInput.files = dataTransfer.files;
    updateFileName();
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);

  try {
    setLoginStatus('Signing in...');

    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password'),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Login failed.');
    }

    loginForm.reset();
    setLoginStatus('');
    await showAuthenticatedView(result.user);
  } catch (error) {
    setLoginStatus(error.message, true);
  }
});

logoutButton.addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' });
  showUnauthenticatedView();
});

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const selectedFile = fileInput.files?.[0];

  if (!selectedFile) {
    setStatus('Choose an exam file before uploading.', true);
    return;
  }

  const formData = new FormData();
  formData.append('examFile', selectedFile);

  try {
    setStatus('Uploading exam...');

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Upload failed.');
    }

    setStatus(`${result.message} Stored in the database as ${result.file.id}.`);
    uploadForm.reset();
    fileName.textContent = 'No file selected';

    const uploadsResponse = await fetch('/api/uploads');
    if (uploadsResponse.ok) {
      const uploadsResult = await uploadsResponse.json();
      renderUploads(uploadsResult.uploads);
    }
  } catch (error) {
    setStatus(error.message, true);
  }
});

loadSession().catch(() => {
  showUnauthenticatedView();
});