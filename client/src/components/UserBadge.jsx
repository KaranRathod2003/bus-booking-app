import { User } from 'lucide-react'

export default function UserBadge({ userId }) {
  return (
    <span className="user-badge">
      <span className="user-badge-icon"><User size={12} /></span>
      {userId}
    </span>
  )
}
