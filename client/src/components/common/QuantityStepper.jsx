// components/common/QuantityStepper.jsx - +/- control clamped by server stock caps.
export default function QuantityStepper({ value, min = 1, max = 10, disabled = false, onChange }) {
  return (
    <div className={`qty-stepper ${disabled ? 'is-disabled' : ''}`} role="group" aria-label="Quantity">
      <button
        type="button"
        className="qty-btn"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <i className="bi bi-dash" aria-hidden="true" />
      </button>
      <span className="qty-value" aria-live="polite">{value}</span>
      <button
        type="button"
        className="qty-btn"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <i className="bi bi-plus" aria-hidden="true" />
      </button>
    </div>
  );
}
