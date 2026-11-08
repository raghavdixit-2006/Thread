// components/features/AddressCard.jsx - one saved address with default/remove actions.
export default function AddressCard({ address, selected, onSelectActions }) {
  const { onUse, onEdit, onRemove, onSetDefault } = onSelectActions || {};
  return (
    <div className={`address-card ${selected ? 'is-selected' : ''}`}>
      <div className="address-head">
        <strong>{address.fullName}{address.label ? ` - ${address.label}` : ''}</strong>
        {address.isDefault && (
          <span className="badge-verified">
            <i className="bi bi-check-circle" aria-hidden="true" /> Default
          </span>
        )}
      </div>
      <p className="address-lines">
        {address.line1}
        {address.line2 ? <><br />{address.line2}</> : null}
        <br />
        {address.city}, {address.state} - {address.pincode}
        <br />
        {address.phone}
      </p>
      <div className="address-actions">
        {onUse && <button type="button" className="btn ghost" onClick={() => onUse(address)}>Deliver here</button>}
        {onEdit && <button type="button" className="text-link" onClick={() => onEdit(address)}>Edit</button>}
        {onSetDefault && !address.isDefault && (
          <button type="button" className="text-link" onClick={() => onSetDefault(address)}>Set default</button>
        )}
        {onRemove && (
          <button type="button" className="remove-btn" onClick={() => onRemove(address)}>
            <i className="bi bi-trash" aria-hidden="true" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}
