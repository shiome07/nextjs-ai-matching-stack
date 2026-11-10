"use client";

import { useAuth } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Match {
  matchId: string
  matchUserId: string
  name: string
  photoObjectKey: string | null
  createdAt: string
}

export default function MatchesPage() {
  const { userId } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMatches = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/matches')
      if (!res.ok) throw new Error('Failed to load matches')
      const data = await res.json()
      setMatches(data.matches || [])
    } catch (e) {
      console.error('Failed to load matches', e)
      setError('Unable to load matches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMatches()
  }, [userId])

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading matches...</div>
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4 text-center">
        <p className="text-red-600">{error}</p>
        <Button onClick={loadMatches} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Your Matches</h1>
      {matches.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600 mb-4">No matches yet. Start discovering!</p>
          <Link href="/discover">
            <Button>Go Discover</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <Link key={match.matchId} href={`/chat/${match.matchId}`}>
              <Card className="p-4 flex items-center gap-4 hover:bg-muted transition-colors cursor-pointer">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarImage src="" alt={match.name} />
                  <AvatarFallback>{match.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold truncate">{match.name}</h2>
                  <Badge variant="secondary" className="text-xs mt-1">
                    Matched {new Date(match.createdAt).toLocaleDateString()}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}