import QRCode from 'react-qr-code'

export default function QRTicket({ payload }) {
  if (!payload) return null

  return (
    <div className="ticket-qr">
      <QRCode
        value={JSON.stringify(payload)}
        size={180}
        level="M"
      />
    </div>
  )
}
