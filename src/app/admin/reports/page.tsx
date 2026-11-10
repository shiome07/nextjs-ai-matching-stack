import { useAuth } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Report {
  id: string
  reporter_id: string
  reported_user_id: string
  reason: string
  status: string
  created_at: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

export default function AdminReportsPage() {
  const { isLoaded, userId, isSignedIn } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReports = async () => {
    try {
      const res = await fetch('/api/admin/reports')
      if (res.status === 403) {
        setError('Admin access required.')
        return
      }
      if (!res.ok) throw new Error('Failed to load reports')
      const data = await res.json()
      setReports(data.reports)
    } catch (e) {
      console.error('Load reports failed', e)
      setError('Could not load reports.')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (reportId: string, status: 'reviewed' | 'dismissed') => {
    try {
      await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setReports(prev => prev.filter(r => r.id !== reportId))
    } catch (e) {
      console.error('Update failed', e)
    }
  }

  useEffect(() => {
    if (isLoaded && isSignedIn && userId) loadReports()
  }, [isLoaded, isSignedIn, userId])

  if (!isLoaded) {
    return <div className="max-w-3xl mx-auto p-4">Loading...</div>
  }

  if (!isSignedIn || error) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Admin - Moderation Queue</h1>
        <p className="text-red-600">{error || 'You must be signed in as an admin to view this page.'}</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Reports Queue</h1>
      <Card className="p-4">
        {loading ? (
          <p className="text-gray-500">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="text-gray-500">No pending reports. All clear.</p>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => (
              <div key={r.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    Report #{r.id.slice(0, 8)}
                  </p>
                  <Badge variant="secondary">{r.status}</Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Reported user: {`${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email || '(unknown)'}
                </p>
                <p className="text-sm mt-1">Reason: {r.reason}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Submitted {new Date(r.created_at).toLocaleString()}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => updateStatus(r.id, 'reviewed')}
                    variant="outline"
                  >
                    Mark Reviewed
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => updateStatus(r.id, 'dismissed')}
                    variant="destructive"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}