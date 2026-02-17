'use client';

import { useEffect, useRef } from 'react';
import Konva from 'konva';

interface TextEditorProps {
  x: number;
  y: number;
  width: number;
  height: number;
  initialText: string;
  stage: Konva.Stage;
  onSave: (text: string) => void;
  onClose: () => void;
}

export function TextEditor({
  x,
  y,
  width,
  height,
  initialText,
  stage,
  onSave,
  onClose,
}: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Focus and select all text
    textarea.focus();
    textarea.select();

    // Calculate position accounting for stage transform
    const transform = stage.getAbsoluteTransform();
    const pos = transform.point({ x, y });

    // Position textarea
    textarea.style.left = `${pos.x}px`;
    textarea.style.top = `${pos.y}px`;
    textarea.style.width = `${width * stage.scaleX()}px`;
    textarea.style.height = `${height * stage.scaleY()}px`;

    // Handle blur (clicking outside)
    const handleBlur = (): void => {
      onSave(textarea.value);
      onClose();
    };

    // Handle Enter key (save)
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSave(textarea.value);
        onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    // Prevent stage pan/zoom while editing
    const handleWheel = (e: WheelEvent): void => {
      e.stopPropagation();
    };

    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('keydown', handleKeyDown);
    textarea.addEventListener('wheel', handleWheel);

    return () => {
      textarea.removeEventListener('blur', handleBlur);
      textarea.removeEventListener('keydown', handleKeyDown);
      textarea.removeEventListener('wheel', handleWheel);
    };
  }, [x, y, width, height, stage, onSave, onClose]);

  return (
    <textarea
      ref={textareaRef}
      defaultValue={initialText}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        padding: '12px',
        fontSize: '16px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: '#1f2937',
        background: 'transparent',
        border: '2px solid #2563eb',
        borderRadius: '8px',
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        lineHeight: '1.5',
        zIndex: 1000,
      }}
      className="text-editor-overlay"
    />
  );
}
