/**
 * File Upload Component
 *
 * Provides a drag-and-drop file upload interface with:
 * - Drag and drop support
 * - Click to select file
 * - Image preview
 * - Upload progress
 * - Validation (type, size)
 *
 * Usage:
 *   const uploader = new FileUpload({
 *     container: document.getElementById('logo-upload'),
 *     accept: 'image/*',
 *     maxSize: 5 * 1024 * 1024, // 5MB
 *     endpoint: '/api/upload/image.php',
 *     onSuccess: (response) => console.log('Uploaded:', response.url),
 *     onError: (error) => console.error('Upload failed:', error),
 *   });
 */

class FileUpload {
  constructor(options = {}) {
    if (!options.container) {
      throw new Error('FileUpload: container is required');
    }

    this.container = options.container;
    this.options = {
      accept: options.accept || 'image/*',
      maxSize: options.maxSize || 5 * 1024 * 1024, // 5MB default
      endpoint: options.endpoint || '/api/upload/image.php',
      buttonText: options.buttonText || 'Choose File',
      dragText: options.dragText || 'or drag and drop',
      allowedTypes: options.allowedTypes || ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      onSuccess: options.onSuccess || null,
      onError: options.onError || null,
      onProgress: options.onProgress || null,
    };

    this.file = null;
    this.uploading = false;

    this.render();
    this.bindEvents();
  }

  /**
   * Render the upload UI.
   */
  render() {
    this.container.innerHTML = `
      <div class="file-upload" data-file-upload>
        <input type="file" class="file-upload-input" accept="${this.options.accept}" hidden data-file-input />

        <div class="file-upload-dropzone" data-dropzone>
          <div class="file-upload-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <div class="file-upload-text">
            <button type="button" class="btn btn-sm btn-primary" data-file-button>
              ${this.options.buttonText}
            </button>
            <p class="text-muted" style="margin-top: 0.5rem; font-size: var(--text-sm);">
              ${this.options.dragText}
            </p>
            <p class="text-subtle" style="margin-top: 0.25rem; font-size: var(--text-xs);">
              PNG, JPG, GIF, WebP, SVG up to ${this.formatFileSize(this.options.maxSize)}
            </p>
          </div>
        </div>

        <div class="file-upload-preview hidden" data-preview>
          <img class="file-upload-preview-img" data-preview-img alt="Preview" />
          <div class="file-upload-preview-info">
            <div class="file-upload-preview-name" data-preview-name></div>
            <div class="file-upload-preview-size" data-preview-size></div>
          </div>
          <button type="button" class="btn btn-sm btn-ghost" data-remove>Remove</button>
        </div>

        <div class="file-upload-progress hidden" data-progress>
          <div class="progress">
            <div class="progress-bar" data-progress-bar style="width: 0%"></div>
          </div>
          <p class="text-muted" style="margin-top: 0.5rem; font-size: var(--text-sm);">
            Uploading... <span data-progress-text>0%</span>
          </p>
        </div>

        <div class="file-upload-error hidden" data-error>
          <div class="alert alert-error">
            <svg class="alert-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            <div class="alert-content">
              <div class="alert-title">Upload Failed</div>
              <div data-error-message></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();

    // Cache elements
    this.input = this.container.querySelector('[data-file-input]');
    this.dropzone = this.container.querySelector('[data-dropzone]');
    this.button = this.container.querySelector('[data-file-button]');
    this.preview = this.container.querySelector('[data-preview]');
    this.previewImg = this.container.querySelector('[data-preview-img]');
    this.previewName = this.container.querySelector('[data-preview-name]');
    this.previewSize = this.container.querySelector('[data-preview-size]');
    this.removeBtn = this.container.querySelector('[data-remove]');
    this.progressContainer = this.container.querySelector('[data-progress]');
    this.progressBar = this.container.querySelector('[data-progress-bar]');
    this.progressText = this.container.querySelector('[data-progress-text]');
    this.errorContainer = this.container.querySelector('[data-error]');
    this.errorMessage = this.container.querySelector('[data-error-message]');
  }

  /**
   * Add component styles.
   */
  addStyles() {
    if (document.getElementById('file-upload-styles')) return;

    const style = document.createElement('style');
    style.id = 'file-upload-styles';
    style.textContent = `
      .file-upload-dropzone {
        border: 2px dashed var(--neutral-300);
        border-radius: var(--radius-lg);
        padding: var(--space-8);
        text-align: center;
        transition: all var(--transition-fast);
        cursor: pointer;
      }
      .file-upload-dropzone:hover {
        border-color: var(--brand-primary);
        background-color: var(--brand-primary-light);
      }
      .file-upload-dropzone.drag-over {
        border-color: var(--brand-primary);
        background-color: var(--brand-primary-light);
        transform: scale(1.02);
      }
      .file-upload-icon {
        color: var(--neutral-400);
        margin-bottom: var(--space-4);
      }
      .file-upload-icon svg {
        display: inline-block;
      }
      .file-upload-preview {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-4);
        border: 1px solid var(--neutral-200);
        border-radius: var(--radius-lg);
        margin-top: var(--space-4);
      }
      .file-upload-preview-img {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: var(--radius-md);
        border: 1px solid var(--neutral-200);
      }
      .file-upload-preview-info {
        flex: 1;
      }
      .file-upload-preview-name {
        font-weight: var(--font-medium);
        font-size: var(--text-sm);
        color: var(--neutral-900);
      }
      .file-upload-preview-size {
        font-size: var(--text-xs);
        color: var(--neutral-500);
        margin-top: var(--space-1);
      }
      .file-upload-progress {
        margin-top: var(--space-4);
      }
      .file-upload-error {
        margin-top: var(--space-4);
      }
      .hidden {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Bind event handlers.
   */
  bindEvents() {
    // Button click
    this.button.addEventListener('click', () => this.input.click());

    // Dropzone click
    this.dropzone.addEventListener('click', (e) => {
      if (e.target !== this.button) {
        this.input.click();
      }
    });

    // File input change
    this.input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFile(e.target.files[0]);
      }
    });

    // Drag and drop
    this.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzone.classList.add('drag-over');
    });

    this.dropzone.addEventListener('dragleave', () => {
      this.dropzone.classList.remove('drag-over');
    });

    this.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropzone.classList.remove('drag-over');

      if (e.dataTransfer.files.length > 0) {
        this.handleFile(e.dataTransfer.files[0]);
      }
    });

    // Remove button
    this.removeBtn.addEventListener('click', () => this.reset());
  }

  /**
   * Handle file selection.
   */
  handleFile(file) {
    // Validate file type
    if (!this.options.allowedTypes.includes(file.type)) {
      this.showError('Invalid file type. Please upload an image file.');
      return;
    }

    // Validate file size
    if (file.size > this.options.maxSize) {
      this.showError(
        `File size exceeds ${this.formatFileSize(this.options.maxSize)}.`
      );
      return;
    }

    this.file = file;
    this.showPreview();
  }

  /**
   * Show file preview.
   */
  showPreview() {
    if (!this.file) return;

    // Hide dropzone and error
    this.dropzone.classList.add('hidden');
    this.errorContainer.classList.add('hidden');

    // Show preview
    this.preview.classList.remove('hidden');
    this.previewName.textContent = this.file.name;
    this.previewSize.textContent = this.formatFileSize(this.file.size);

    // Show image preview
    if (this.file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewImg.src = e.target.result;
      };
      reader.readAsDataURL(this.file);
    }
  }

  /**
   * Upload the file.
   */
  async upload() {
    if (!this.file || this.uploading) return;

    this.uploading = true;
    this.hideError();

    // Hide preview, show progress
    this.preview.classList.add('hidden');
    this.progressContainer.classList.remove('hidden');

    try {
      const formData = new FormData();
      formData.append('file', this.file);

      const xhr = new XMLHttpRequest();

      // Progress handler
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          this.updateProgress(percent);
        }
      });

      // Complete handler
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.ok) {
              this.handleSuccess(response);
            } else {
              this.handleError(response.error || 'Upload failed');
            }
          } catch (err) {
            this.handleError('Invalid response from server');
          }
        } else {
          try {
            const response = JSON.parse(xhr.responseText);
            this.handleError(response.error || `Upload failed (${xhr.status})`);
          } catch (err) {
            this.handleError(`Upload failed (${xhr.status})`);
          }
        }
      });

      // Error handler
      xhr.addEventListener('error', () => {
        this.handleError('Network error occurred');
      });

      xhr.open('POST', this.options.endpoint);
      xhr.send(formData);
    } catch (error) {
      this.handleError(error.message || 'Upload failed');
    }
  }

  /**
   * Update progress bar.
   */
  updateProgress(percent) {
    this.progressBar.style.width = `${percent}%`;
    this.progressText.textContent = `${percent}%`;

    if (this.options.onProgress) {
      this.options.onProgress(percent);
    }
  }

  /**
   * Handle successful upload.
   */
  handleSuccess(response) {
    this.uploading = false;
    this.progressContainer.classList.add('hidden');
    this.showPreview();

    if (this.options.onSuccess) {
      this.options.onSuccess(response);
    }

    // Show success toast
    if (window.Toast) {
      Toast.success('File uploaded successfully');
    }
  }

  /**
   * Handle upload error.
   */
  handleError(message) {
    this.uploading = false;
    this.progressContainer.classList.add('hidden');
    this.showError(message);

    if (this.options.onError) {
      this.options.onError(message);
    }
  }

  /**
   * Show error message.
   */
  showError(message) {
    this.errorMessage.textContent = message;
    this.errorContainer.classList.remove('hidden');
  }

  /**
   * Hide error message.
   */
  hideError() {
    this.errorContainer.classList.add('hidden');
  }

  /**
   * Reset the uploader.
   */
  reset() {
    this.file = null;
    this.input.value = '';
    this.preview.classList.add('hidden');
    this.progressContainer.classList.add('hidden');
    this.errorContainer.classList.add('hidden');
    this.dropzone.classList.remove('hidden');
    this.previewImg.src = '';
  }

  /**
   * Get the uploaded file URL (call after successful upload).
   */
  getFileUrl() {
    return this.uploadedUrl;
  }

  /**
   * Format file size for display.
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileUpload;
}

// Expose globally
window.FileUpload = FileUpload;
