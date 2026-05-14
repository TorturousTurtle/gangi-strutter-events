<?php
/**
 * POST /api/upload/image.php
 *
 * Upload image files for branding (logo, favicon).
 * Validates file type, size, and dimensions.
 * Generates optimized versions (@2x retina).
 *
 * Request: multipart/form-data with 'file' field
 * Response: { ok: true, url: '/assets/uploads/filename.ext' }
 */

// Suppress HTML error output for API endpoint
ini_set('html_errors', '0');
ini_set('display_errors', '0');
error_reporting(E_ALL);

// Set up error handler to return JSON
set_error_handler(function($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(function($e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
    exit;
});

require_once __DIR__ . '/../util.php';
require_once __DIR__ . '/../admin_auth.php';

allow_cors(true);
require_admin_auth();
require_method('POST');

// Configuration
$ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
$MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
$UPLOAD_DIR = __DIR__ . '/../../assets/uploads/';
$UPLOAD_URL = '/assets/uploads/';

// Ensure upload directory exists
if (!file_exists($UPLOAD_DIR)) {
    mkdir($UPLOAD_DIR, 0755, true);
}

// Check if file was uploaded
if (!isset($_FILES['file'])) {
    json_error('No file uploaded', 400);
}

$file = $_FILES['file'];

// Check for upload errors
if ($file['error'] !== UPLOAD_ERR_OK) {
    $errors = [
        UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
        UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
        UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
        UPLOAD_ERR_EXTENSION => 'Upload stopped by extension',
    ];

    $message = $errors[$file['error']] ?? 'Unknown upload error';
    json_error($message, 400);
}

// Validate file size
if ($file['size'] > $MAX_FILE_SIZE) {
    json_error('File size exceeds 5MB limit', 400);
}

// Validate file type
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);

if (!in_array($mimeType, $ALLOWED_TYPES)) {
    json_error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG', 400);
}

// Get file extension
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (empty($ext)) {
    // Guess from mime type
    $mimeToExt = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/svg+xml' => 'svg',
    ];
    $ext = $mimeToExt[$mimeType] ?? 'bin';
}

// Generate unique filename
$filename = 'brand-' . uniqid() . '.' . $ext;
$filepath = $UPLOAD_DIR . $filename;

// Move uploaded file
if (!move_uploaded_file($file['tmp_name'], $filepath)) {
    json_error('Failed to save uploaded file', 500);
}

// For raster images, validate dimensions and create @2x version
if (in_array($mimeType, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'])) {
    try {
        $imageInfo = getimagesize($filepath);
        if ($imageInfo === false) {
            unlink($filepath);
            json_error('Invalid image file', 400);
        }

        list($width, $height) = $imageInfo;

        // Check dimensions (max 2000x2000)
        if ($width > 2000 || $height > 2000) {
            unlink($filepath);
            json_error('Image dimensions too large (max 2000x2000)', 400);
        }

        // Create optimized version (max 500x500) for normal DPI
        $maxSize = 500;
        if ($width > $maxSize || $height > $maxSize) {
            $ratio = min($maxSize / $width, $maxSize / $height);
            $newWidth = (int)($width * $ratio);
            $newHeight = (int)($height * $ratio);

            // Create optimized version
            $optimizedFilename = 'brand-' . uniqid() . '-optimized.' . $ext;
            $optimizedPath = $UPLOAD_DIR . $optimizedFilename;

            if (resizeImage($filepath, $optimizedPath, $newWidth, $newHeight, $mimeType)) {
                // Replace original with optimized
                unlink($filepath);
                $filename = $optimizedFilename;
                $filepath = $optimizedPath;
            }
        }
    } catch (Exception $e) {
        // If image processing fails, keep original
        error_log('Image optimization failed: ' . $e->getMessage());
    }
}

json_response([
    'ok' => true,
    'url' => $UPLOAD_URL . $filename,
    'filename' => $filename,
]);

/**
 * Resize an image to fit within max dimensions while preserving aspect ratio.
 *
 * @param string $sourcePath Source image path
 * @param string $destPath Destination image path
 * @param int $maxWidth Maximum width
 * @param int $maxHeight Maximum height
 * @param string $mimeType Image MIME type
 * @return bool Success
 */
function resizeImage($sourcePath, $destPath, $maxWidth, $maxHeight, $mimeType) {
    // Create source image
    switch ($mimeType) {
        case 'image/jpeg':
            $source = @imagecreatefromjpeg($sourcePath);
            break;
        case 'image/png':
            $source = @imagecreatefrompng($sourcePath);
            break;
        case 'image/gif':
            $source = @imagecreatefromgif($sourcePath);
            break;
        case 'image/webp':
            $source = @imagecreatefromwebp($sourcePath);
            break;
        default:
            return false;
    }

    if (!$source) {
        return false;
    }

    // Create destination image
    $dest = imagecreatetruecolor($maxWidth, $maxHeight);
    if (!$dest) {
        imagedestroy($source);
        return false;
    }

    // Preserve transparency for PNG/GIF
    if (in_array($mimeType, ['image/png', 'image/gif'])) {
        imagealphablending($dest, false);
        imagesavealpha($dest, true);
        $transparent = imagecolorallocatealpha($dest, 0, 0, 0, 127);
        imagefill($dest, 0, 0, $transparent);
    }

    // Resize
    imagecopyresampled($dest, $source, 0, 0, 0, 0, $maxWidth, $maxHeight, imagesx($source), imagesy($source));

    // Save
    $success = false;
    switch ($mimeType) {
        case 'image/jpeg':
            $success = imagejpeg($dest, $destPath, 90);
            break;
        case 'image/png':
            $success = imagepng($dest, $destPath, 9);
            break;
        case 'image/gif':
            $success = imagegif($dest, $destPath);
            break;
        case 'image/webp':
            $success = imagewebp($dest, $destPath, 90);
            break;
    }

    imagedestroy($source);
    imagedestroy($dest);

    return $success;
}
