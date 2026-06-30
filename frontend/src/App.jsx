import { useState, useRef, useCallback } from 'react';
import { gql } from '@apollo/client/core';
import { useQuery, useMutation } from '@apollo/client/react';
// OCR is handled on the backend; frontend only uploads images and displays results
import './App.css';

// ── GraphQL Queries & Mutations ──────────────────────────────────────────────

const GET_DOCUMENTS = gql`
  query GetDocuments {
    documents {
      id
      name
      documentType
      imageBase64
      extractedData
      createdAt
    }
  }
`;

const SAVE_DOCUMENT = gql`
  mutation SaveDocument(
    $name: String!
    $documentType: String!
    $imageBase64: String!
    $extractedData: String!
  ) {
    saveDocument(
      name: $name
      documentType: $documentType
      imageBase64: $imageBase64
      extractedData: $extractedData
    ) {
      id
      name
      documentType
      createdAt
    }
  }
`;

const DELETE_DOCUMENT = gql`
  mutation DeleteDocument($id: ID!) {
    deleteDocument(id: $id)
  }
`;


function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Helper: get doc type tag class ───────────────────────────────────────────

function docTagClass(docType) {
  const t = (docType || '').toLowerCase();
  if (t.includes('pan')) return 'pan';
  if (t.includes('aadhaar')) return 'aadhaar';
  return 'other';
}

// ═════════════════════════════════════════════════════════════════════════════
// Main App Component
// ═════════════════════════════════════════════════════════════════════════════

function App() {
  // ── State ──────────────────────────────────────────────────────────
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [rawText, setRawText] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [pipelineImages, setPipelineImages] = useState([]);
  const [activeTab, setActiveTab] = useState('extracted');
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState('');

  // ── Refs ───────────────────────────────────────────────────────────
  const fileInputRef = useRef(null);

  // ── GraphQL ────────────────────────────────────────────────────────
  const { data: docsData, refetch: refetchDocs } = useQuery(GET_DOCUMENTS, {
    fetchPolicy: 'cache-and-network',
  });
  const [saveDocument] = useMutation(SAVE_DOCUMENT);
  const [deleteDocument] = useMutation(DELETE_DOCUMENT);

  const documents = docsData?.documents || [];


  // ── File handling ──────────────────────────────────────────────────

  const handleFileSelect = useCallback((selectedFile) => {
    if (!selectedFile) return;
    if (!selectedDocType) {
      alert('Please select the document type before uploading.');
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(selectedFile.type)) {
      alert('Unsupported file type. Please upload JPG, PNG, BMP, TIFF, WebP, or PDF.');
      return;
    }
    setFile(selectedFile);
    setRawText('');
    setExtractedData(null);
    setProgress(0);
    setProgressMessage('');

    // For image types, generate a preview; for PDFs, skip image preview (backend will return previews)
    if (selectedFile.type === 'application/pdf') {
      setImagePreview(null);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    }
  }, [selectedDocType]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setImagePreview(null);
    setRawText('');
    setExtractedData(null);
    setProgress(0);
    setProgressMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Main processing pipeline ───────────────────────────────────────

  const processDocument = useCallback(async () => {
    if (!file) return;

    setProcessing(true);
    setProgress(0);
    setProgressMessage('Preparing upload...');
    setActiveTab('pipeline');
    setRawText('');
    setExtractedData(null);

    try {
      const form = new FormData();
      form.append('image', file, file.name);
      form.append('documentType', selectedDocType);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "http://localhost:4000/api/ocr");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const p = Math.round((e.loaded / e.total) * 60);
            setProgress(p);
            setProgressMessage(`Uploading... ${p}%`);
          }
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const json = JSON.parse(xhr.responseText);
                  if (json.success) {
                  setProgress(95);
                  setProgressMessage('Processing complete. Rendering results...');
                  setRawText(json.text || '');
                  setPipelineImages(json.previews || []);
                  console.log(json.fields);
                  const parsed = {
                    documentType: json.fields.documentType || '',
                    name: json.fields.name || '',
                    sex: json.fields.sex || '',
                    documentNumber: json.fields.documentNumber || '',
                    dob: json.fields.dob || '',
                    nationality: json.fields.nationality || '',
                    // expiryDate: json.fields.expiryDate || '',
                  };
                  console.log('Parsed fields:', parsed);
                  setExtractedData(parsed);
                  // attempt save to GraphQL backend for history, but do not send image bytes
                  try {
                    saveDocument({
                      variables: {
                        name: file.name,
                        documentType: parsed.documentType || selectedDocType,
                        imageBase64: imagePreview || '',
                        extractedData: JSON.stringify(parsed),
                      },
                    }).then(() => refetchDocs()).catch(()=>{});
                  } catch(e) {}

                  setProgress(100);
                  setProgressMessage(`Done - confidence ${(json.confidence||0).toFixed(2)}`);
                  setActiveTab('extracted');
                  resolve();
                } else {
                  reject(new Error(json.error || 'OCR failed'));
                }
              } catch (e) {
                reject(e);
              }
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          }
        };

        xhr.onerror = (e) => reject(new Error('Network error'));
        xhr.send(form);
      });

    } catch (err) {
      console.error('Processing error:', err);
      setProgressMessage(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }, [file, imagePreview, saveDocument, refetchDocs, selectedDocType]);

  // ── View saved document 

  const viewSavedDocument = useCallback((doc) => {
    setSelectedDocId(doc.id);
    try {
      const parsed = JSON.parse(doc.extractedData);
      setExtractedData(parsed);
      setRawText(''); // Raw text not stored separately
      setImagePreview(doc.imageBase64);
      setPipelineImages([]);
      setActiveTab('extracted');
    } catch (e) {
      console.error('Failed to parse saved data:', e);
    }
  }, []);

  const handleDeleteDocument = useCallback(async (id, e) => {
    e.stopPropagation();
    try {
      await deleteDocument({ variables: { id } });
      await refetchDocs();
      if (selectedDocId === id) {
        setSelectedDocId(null);
        setExtractedData(null);
        setRawText('');
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, [deleteDocument, refetchDocs, selectedDocId]);

  // ── JSON utilities ─────────────────────────────────────────────────

  const getJsonString = useCallback(() => {
    if (!extractedData) return '{}';
    // Build a clean output object — only non-empty fields
    const clean = {};
    for (const [key, val] of Object.entries(extractedData)) {
      if (val && val.toString().trim()) {
        clean[key] = val;
      }
    }
    return JSON.stringify(clean, null, 2);
  }, [extractedData]);

  const copyJson = useCallback(() => {
    navigator.clipboard.writeText(getJsonString());
  }, [getJsonString]);

  const downloadJson = useCallback(() => {
    const blob = new Blob([getJsonString()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name || 'extraction'}_data.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getJsonString, file]);



  return (
    <div className="app-container">
      {/* Hidden canvas removed — preprocessing runs on backend */}

      {/* ════════ HISTORY SIDEBAR ════════ */}
      <aside className="history-sidebar">
        <div className="sidebar-header">
          <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
          <h2>History</h2>
        </div>
        <div className="history-list">
          {documents.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <i className="fa-regular fa-folder-open" />
              <p>No documents processed yet. Upload a document to get started.</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className={`history-item animate-fade-in ${selectedDocId === doc.id ? 'active' : ''}`}
                onClick={() => viewSavedDocument(doc)}
              >
                <div className="history-item-header">
                  <span className="doc-name">{doc.name}</span>
                  <span className={`doc-tag ${docTagClass(doc.documentType)}`}>
                    {doc.documentType}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="doc-date">{formatDate(doc.createdAt)}</span>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDeleteDocument(doc.id, e)}
                    title="Delete document"
                  >
                    <i className="fa-regular fa-trash-can" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ════════ MAIN WORKSPACE ════════ */}
      <main className="main-workspace">

        {/* ──────── NAVBAR ──────── */}
        <nav className="app-navbar">
          <div className="nav-logo">
            <h1>
              <i className="fa-solid fa-file-shield" />
              DocuScan OCR
            </h1>
          </div>
        </nav>

        {/* ──────── CONTENT BODY (split) ──────── */}
        <div className="content-body">

          {/* ======== CONTROLS PANEL (left) ======== */}
          <div className="controls-panel">

            {/* Drop Zone */}
            <div
              className={`dropzone ${dragOver ? 'animate-pulse-border' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => {
                if (!selectedDocType) return alert('Please select the document type before uploading.');
                fileInputRef.current?.click();
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/bmp,image/tiff,image/webp,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />
              <i className="fa-solid fa-cloud-arrow-up dropzone-icon" />
              <p>
                Drag & drop your document here<br />
                or <span className="browse-text">browse files</span>
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>
                JPG, PNG, BMP, TIFF, WebP, PDF
              </p>
            </div>

            {/* Document Type Selector */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: '.9rem', color: 'var(--text-muted)', width: 110 }}>Document Type</label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 6 }}
              >
                <option value="">Select document type...</option>
                <option value="Aadhaar">Aadhaar</option>
                <option value="Passport">Passport</option>
                <option value="Visa">Visa</option>
                <option value="eVisa">eVisa</option>
                <option value="Driving Licence">Driving Licence</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Selected File Info */}
            {file && (
              <div className="selected-file-box animate-fade-in">
                <div className="file-info">
                  {file.type === 'application/pdf' ? (
                    <i className="fa-regular fa-file-pdf" style={{ color: '#D9534F', fontSize: '1.3rem' }} />
                  ) : (
                    <i className="fa-regular fa-file-image" style={{ color: 'var(--primary)', fontSize: '1.3rem' }} />
                  )}
                  <span className="file-name">{file.name}</span>
                </div>
                <button className="clear-file-btn" onClick={clearFile} title="Remove file">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            )}

            {/* Preprocessing handled by backend; client shows only upload controls */}

            {/* Extract Button */}
            <button
              className="primary-action-btn"
              disabled={!file || processing || !selectedDocType}
              onClick={processDocument}
            >
              {processing ? (
                <>
                  <i className="fa-solid fa-spinner spin-icon" />
                  Processing...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles" />
                  Extract Data
                </>
              )}
            </button>

            {/* Progress HUD */}
            {(processing || progress === 100) && (
              <div className="progress-hud animate-fade-in">
                <div className="progress-header-row">
                  <span>{progressMessage}</span>
                  <span style={{ color: 'var(--secondary)' }}>{progress}%</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ======== VIEWER PANEL (right) ======== */}
          <div className="viewer-panel">

            {/* Tab Headers */}
            <div className="tab-headers">
              <button
                className={`tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
                onClick={() => setActiveTab('raw')}
              >
                <i className="fa-solid fa-align-left" />
                Raw OCR
              </button>
              <button
                className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
                onClick={() => setActiveTab('pipeline')}
              >
                <i className="fa-solid fa-gears" />
                Pipeline
              </button>
              <button
                className={`tab-btn ${activeTab === 'extracted' ? 'active' : ''}`}
                onClick={() => setActiveTab('extracted')}
              >
                <i className="fa-solid fa-table-list" />
                Extracted Data
              </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">

              {/* Pipeline view removed — OCR runs on backend */}

              {/* ── RAW OCR TAB ── */}
              {/* ── PIPELINE / PREVIEWS TAB ── */}
              {activeTab === 'pipeline' && (
                <div className="animate-fade-in" style={{ height: '100%', overflowY: 'auto' }}>
                  {pipelineImages && pipelineImages.length > 0 ? (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {pipelineImages.map((p, idx) => (
                        <div key={idx} className="glass-panel" style={{ padding: '8px', width: '220px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700 }}>
                            {p.name}
                          </div>
                          <div style={{ width: '100%', height: 'auto' }}>
                            <img src={p.data} alt={p.name} style={{ width: '100%', height: 'auto', display: 'block' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <i className="fa-regular fa-image" />
                      <p>No preprocessing previews available. Run a document to generate them.</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'raw' && (
                <div className="animate-fade-in" style={{ height: '100%' }}>
                  {rawText ? (
                    <div className="raw-text-panel">
                      {rawText}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <i className="fa-solid fa-file-lines" />
                      <p>Raw OCR text will appear here after processing a document.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── EXTRACTED DATA TAB ── */}
              {activeTab === 'extracted' && (
                <div className="extracted-layout animate-fade-in">

                  {extractedData ? (
                    <>
                      {/* Fields grid */}
                      <div className="details-column">
                        <div className="extracted-field-card glass-panel">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <i className="fa-solid fa-id-card" style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>{extractedData.documentType}</span>
                          </div>
                          <div className="fields-grid">
                            {Object.entries(extractedData)
                              .filter(([key]) => key !== 'documentType')
                              .map(([key, val]) => (
                                <div key={key} className="field-box">
                                  <div className="field-label">{formatFieldLabel(key)}</div>
                                  <div className={`field-val ${!val ? 'empty' : ''}`}>
                                    {val || 'Not detected'}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* JSON output card */}
                      <div className="card-preview-column">
                        <div className="json-card glass-panel">
                          <div className="json-header">
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                              <i className="fa-solid fa-code" style={{ marginRight: '8px', color: 'var(--secondary)' }} />
                              JSON Output
                            </span>
                            <div className="json-actions">
                              <button className="action-btn-small" onClick={copyJson} title="Copy JSON">
                                <i className="fa-regular fa-clipboard" />
                                Copy
                              </button>
                              <button className="action-btn-small" onClick={downloadJson} title="Download JSON">
                                <i className="fa-solid fa-download" />
                                Save
                              </button>
                            </div>
                          </div>
                          <pre className="json-pre">{getJsonString()}</pre>
                        </div>

                        {/* Image Preview */}
                        {imagePreview && (
                          <div className="glass-panel" style={{ padding: '16px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                              <i className="fa-regular fa-image" style={{ marginRight: '6px' }} />
                              Source Image
                            </div>
                            <div className="canvas-wrapper">
                              <img src={imagePreview} alt="Source document" />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="empty-state" style={{ width: '100%' }}>
                      <i className="fa-solid fa-magnifying-glass-chart" />
                      <p>Extracted data will appear here. Upload a document and click "Extract Data" to begin.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Helper: Convert camelCase field key to display label ──────────────────────

function formatFieldLabel(key) {
  // Special known labels
  const labels = {
    documentType: 'Document Type',
    name: 'Name',
    sex: 'Sex',
    fatherName: "Father's Name",
    dob: 'Date of Birth',
    gender: 'Gender',
    panNumber: 'PAN Number',
    aadhaarNumber: 'Aadhaar Number',
    voterId: 'Voter ID (EPIC)',
    dlNumber: 'DL Number',
    mobile: 'Mobile',
    email: 'Email',
    address: 'Address',
    bloodGroup: 'Blood Group'  };
  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

export default App;
