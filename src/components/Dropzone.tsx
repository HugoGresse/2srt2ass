import { useEffect, useState } from 'preact/hooks';

interface DropzoneProps {
  onFiles: (files: File[]) => void;
}

/**
 * Fullscreen drag-and-drop layer: any file dragged anywhere over the page
 * raises the overlay; dropping hands the files to the app.
 */
export function Dropzone({ onFiles }: DropzoneProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let depth = 0;

    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) onFiles(files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [onFiles]);

  if (!active) return null;

  return (
    <div class="drop-overlay" role="presentation">
      <div class="drop-overlay-card">
        <span class="drop-overlay-icon" aria-hidden="true">💬</span>
        <p class="drop-overlay-title">Drop your subtitles</p>
        <p class="drop-overlay-sub">
          One file fills the bottom track, a second fills the top
        </p>
      </div>
    </div>
  );
}
