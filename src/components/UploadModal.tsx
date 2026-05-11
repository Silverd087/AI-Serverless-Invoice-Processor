import { useState, useRef, useCallback } from "react";
import { uploadData } from "aws-amplify/storage";
import "./UploadModal.css";
import { post } from "aws-amplify/api";
import { signedPost } from "../lib/signedRequest";
import { AuthUser } from "aws-amplify/auth";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/tiff"];
const MAX_SIZE_MB = 25;

interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
  user: AuthUser
}

export default function UploadModal({ onClose, onSuccess, user }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return "Only PDF, PNG, JPEG, and TIFF files are supported.";
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File must be under ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(null);
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      
      const response = await signedPost("/invoices", {
        filename: file.name,
        filetype: file.type,
      }, user);

      if (!response.ok) {
        throw new Error(`Failed to get upload URL: ${response.status}`);
      }

      const { url, s3Key } = await response.json();
      setProgress(30);

      const uploadResponse = await fetch(url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.status}`);
      }

      setProgress(100);
      setDone(true);
      setTimeout(onSuccess, 1800);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Upload failed. Check your S3 bucket configuration and permissions.");
      setUploading(false);
    }
  };

  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !uploading) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onBackdrop}>
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Upload Invoice</h2>
          {!uploading && (
            <button className="modal-close" onClick={onClose}>✕</button>
          )}
        </div>

        {done ? (
          <div className="upload-success">
            <div className="success-icon">✓</div>
            <h3>Invoice submitted!</h3>
            <p>
              Your file has been uploaded and the processing pipeline has been triggered.
              It will appear in the dashboard shortly.
            </p>
          </div>
        ) : (
          <>
            <div
              className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={() => setDragging(false)}
              onClick={() => !file && inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.tiff"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {file ? (
                <div className="file-preview">
                  <div className="file-preview-icon">
                    {file.type === "application/pdf" ? "📄" : "🖼️"}
                  </div>
                  <div className="file-preview-info">
                    <span className="file-preview-name">{file.name}</span>
                    <span className="file-preview-size">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  {!uploading && (
                    <button
                      className="file-remove"
                      onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <div className="drop-zone-inner">
                  <div className="drop-icon">↑</div>
                  <p className="drop-label">
                    Drop your invoice here, or{" "}
                    <span className="drop-link">browse files</span>
                  </p>
                  <p className="drop-hint">PDF, PNG, JPEG, TIFF — max {MAX_SIZE_MB}MB</p>
                </div>
              )}
            </div>

            {uploading && (
              <div className="progress-wrap">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="progress-label">
                  {progress < 100 ? `Uploading… ${progress}%` : "Processing…"}
                </span>
              </div>
            )}

            {error && <div className="upload-error">⚠ {error}</div>}

            <div className="upload-info">
              <span className="upload-info-icon">ℹ</span>
              <p>
                Uploading triggers your Lambda function automatically via S3 event
                notifications. Processing typically completes within 15–30 seconds.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={onClose} disabled={uploading}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? <span className="btn-spinner" /> : <span>↑</span>}
                {uploading ? "Uploading…" : "Upload & Process"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
