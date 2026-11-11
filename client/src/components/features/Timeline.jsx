// components/features/Timeline.jsx - order status history (vertical).
import { formatDate, orderStatusLabel } from '../../utils/format.js';

export default function Timeline({ events = [] }) {
  if (!events.length) return null;
  return (
    <ol className="order-timeline">
      {events.map((event, index) => (
        <li key={index} className={`timeline-step ${index === events.length - 1 ? 'is-current' : ''}`}>
          <span className="timeline-dot" aria-hidden="true" />
          <div>
            <p className="timeline-status">{orderStatusLabel(event.status)}</p>
            <p className="timeline-meta">{formatDate(event.at, { withTime: true })}{event.note ? ` - ${event.note}` : ''}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
