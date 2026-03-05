import { type ChangeEvent, type ReactElement, useEffect, useRef, useState } from 'react';

interface RejectionReasonModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (comment: string) => void;
  readonly isPending: boolean;
}

export function RejectionReasonModal({
  isOpen,
  onClose,
  onConfirm,
  isPending,
}: RejectionReasonModalProps): ReactElement | null {
  const [comment, setComment] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const headingId = 'rejection-modal-heading';
  const MAX_CHARS = 5000;

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen) {
      setComment('');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const trimmedComment = comment.trim();
  const isCommentValid = trimmedComment.length > 0;

  const handleConfirm = () => {
    if (isCommentValid && !isPending) {
      onConfirm(trimmedComment);
    }
  };

  const handleCommentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setComment(e.target.value);
  };

  return (
    <>
      <div
        className="rejection-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isPending) onClose();
        }}
      >
        <div className="rejection-modal-panel">
          <button
            type="button"
            className="rejection-modal__close"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close rejection modal"
          >
            ×
          </button>

          <h2 id={headingId} className="rejection-modal__heading">
            REJECT CAMPAIGN
          </h2>
          <p className="rejection-modal__subtext">
            Provide written rationale and resubmission guidance for the creator.
          </p>

          <label htmlFor="rejection-comment" className="rejection-modal__label">
            REJECTION RATIONALE
          </label>
          <textarea
            id="rejection-comment"
            ref={textareaRef}
            className="rejection-modal__textarea"
            value={comment}
            onChange={handleCommentChange}
            placeholder="Explain which curation criteria were not met and what the creator should address..."
            rows={6}
            maxLength={MAX_CHARS}
            disabled={isPending}
            aria-required="true"
            aria-describedby="rejection-char-count"
          />
          <p id="rejection-char-count" className="rejection-modal__char-count">
            {comment.length} / {MAX_CHARS} chars
          </p>

          <div className="rejection-modal__footer">
            <button
              type="button"
              className="rejection-modal__btn rejection-modal__btn--cancel"
              onClick={onClose}
              disabled={isPending}
            >
              CANCEL
            </button>
            <button
              type="button"
              className="rejection-modal__btn rejection-modal__btn--confirm"
              onClick={handleConfirm}
              disabled={!isCommentValid || isPending}
              aria-label="Confirm rejection"
            >
              {isPending ? 'REJECTING...' : 'CONFIRM REJECTION'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .rejection-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(6, 10, 20, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 1000;
        }

        .rejection-modal-panel {
          background: var(--color-bg-card, #0B1628);
          border: 1px solid var(--color-border-subtle);
          border-radius: 16px;
          padding: 32px;
          max-width: 540px;
          width: 100%;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .rejection-modal__close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 24px;
          color: var(--color-text-tertiary);
          line-height: 1;
          padding: 4px 8px;
          border-radius: 4px;
          transition: color 0.15s ease;
        }

        .rejection-modal__close:hover:not(:disabled) {
          color: var(--color-text-primary);
        }

        .rejection-modal__close:focus-visible {
          outline: 2px solid var(--color-text-accent);
          outline-offset: 2px;
        }

        .rejection-modal__heading {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-text-primary);
          margin: 0;
          padding-right: 40px;
        }

        .rejection-modal__subtext {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .rejection-modal__label {
          font-family: var(--font-data);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: var(--color-text-secondary);
          display: block;
        }

        .rejection-modal__textarea {
          width: 100%;
          background: var(--color-bg-input);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-input);
          padding: 12px 14px;
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-primary);
          resize: vertical;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }

        .rejection-modal__textarea:focus {
          outline: none;
          border-color: var(--color-border-active);
          box-shadow: 0 0 0 2px rgba(255, 92, 26, 0.15);
        }

        .rejection-modal__textarea:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .rejection-modal__char-count {
          font-family: var(--font-data);
          font-size: 11px;
          color: var(--color-text-tertiary);
          margin: 0;
          text-align: right;
        }

        .rejection-modal__footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
          flex-wrap: wrap;
        }

        .rejection-modal__btn {
          font-family: var(--font-data);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.1em;
          padding: 10px 24px;
          border-radius: var(--radius-button);
          cursor: pointer;
          transition: opacity 0.15s ease;
          border: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .rejection-modal__btn { transition: none; }
        }

        .rejection-modal__btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .rejection-modal__btn:focus-visible {
          outline: 2px solid var(--color-text-accent);
          outline-offset: 2px;
        }

        .rejection-modal__btn--cancel {
          background: transparent;
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-secondary);
        }

        .rejection-modal__btn--cancel:hover:not(:disabled) {
          opacity: 0.8;
        }

        .rejection-modal__btn--confirm {
          background: var(--color-status-error);
          color: #fff;
        }

        .rejection-modal__btn--confirm:hover:not(:disabled) {
          opacity: 0.9;
        }
      `}</style>
    </>
  );
}
