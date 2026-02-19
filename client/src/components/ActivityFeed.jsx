export default function ActivityFeed({ events }) {
  if (!events || events.length === 0) {
    return (
      <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
        Waiting for real-time events...
      </div>
    )
  }

  return (
    <ul className="activity-feed">
      {events.map((event) => (
        <li key={event.id} className="activity-item">
          <div className={`activity-dot activity-dot-${event.dotColor}`} />
          <span className="activity-text">{event.message}</span>
          <span className="activity-time">{event.time}</span>
        </li>
      ))}
    </ul>
  )
}
