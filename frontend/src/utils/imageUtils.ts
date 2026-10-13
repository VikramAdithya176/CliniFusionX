/**
 * Compresses an image file on the client side before upload.
 * Reduces resolution to fit within maxWidth/maxHeight and outputs JPEG.
 */
export async function compressImage(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    // Only compress images, skip PDFs or other types
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let { width, height } = img;

        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('Canvas context is null, skipping compression.');
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              console.warn('Blob conversion failed, skipping compression.');
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        console.warn('Image load failed during compression, skipping.');
        resolve(file);
      };
    };
    reader.onerror = () => {
      console.warn('FileReader failed, skipping compression.');
      resolve(file);
    };
  });
}
