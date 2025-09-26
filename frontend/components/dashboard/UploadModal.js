import React from 'react';

export default function UploadModal({ onClose, onUploadClick }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">upload your nft for voting</div>
        <div className="modal-body">
          You are about to upload your NFT(s) for community voting. Please select PNG or SVG files.
        </div>
        <div className="modal-actions">
          <button className="modal-btn secondary" onClick={onClose}>cancel</button>
          <button className="modal-btn primary" onClick={onUploadClick}>upload files</button>
        </div>
      </div>
    </div>
  );
}
