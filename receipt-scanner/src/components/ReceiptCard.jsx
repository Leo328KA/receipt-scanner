export default function ReceiptCard({ receipt }) {
  const { merchant, date, total, items = [], status, thumbUrl } = receipt

  return (
    <div className="receipt-card">
      {thumbUrl && <img className="thumb" src={thumbUrl} alt="" />}
      <div className="row">
        <span className="label">Merchant</span>
        <span className="value">{merchant || '—'}</span>
      </div>
      <div className="row">
        <span className="label">Date</span>
        <span className="value">{date || '—'}</span>
      </div>
      {items.slice(0, 4).map((item, i) => (
        <div className="row" key={i}>
          <span className="label">{item.name}</span>
          <span className="value">{formatMoney(item.price)}</span>
        </div>
      ))}
      <div className="row total-row">
        <span>Total</span>
        <span>{formatMoney(total)}</span>
      </div>
      <span className={`status ${status}`}>
        {status === 'pending' && 'SAVING…'}
        {status === 'synced' && 'SAVED TO DRIVE + SHEET'}
        {status === 'error' && 'FAILED — TAP TO RETRY'}
      </span>
    </div>
  )
}

function formatMoney(value) {
  if (value === undefined || value === null || value === '') return '—'
  const n = Number(value)
  return Number.isNaN(n) ? value : `$${n.toFixed(2)}`
}
