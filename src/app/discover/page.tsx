"use client";
import { useAuth } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface Match {
  userId: string
  name: string
  bio: string
  photoUrl: string
  clerkId: string
}

interface MatchResponse {
  success: boolean
  match: Match | null
  message?: string
}

export default function DiscoverPage() {
  const { userId: clerkUserId } = useAuth()
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [swipeStatus, setSwipeStatus] = useState<'like' | 'pass' | ''>('')

  const loadMatch = async () => {
    if (!clerkUserId) return
    setLoading(true)
    try {
      const res = await fetch('/api/matches/daily')
      if (!res.ok) throw new Error('Failed to load match')
      const result: MatchResponse = await res.json()
      if (result.success) {
        setMatch(result.match)
        setMessage(result.message || '')
      } else {
        setMessage(result.message || 'No matches found')
      }
    } catch (e) {
      console.error('Failed to load match', e)
      setMessage('Unable to find a match right now')
    } finally {
      setLoading(false)
    }
  }

  const handleSwipe = async (action: 'like' | 'pass') => {
    if (!match?.userId || !clerkUserId) return
    setSwipeStatus(action)
    try {
      const res = await fetch('/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: match.userId, action }),
      })
      if (!res.ok) throw new Error('Swipe failed')
      const data = await res.json()
      if (action === 'like' && data.mutual) {
        setMessage("It's a match! Redirecting to chat...")
        setTimeout(() => {
          window.location.href = `/chat/${match.userId}`
        }, 1000)
      } else {
        await loadMatch()
      }
    } catch (e) {
      console.error('Swipe failed', e)
      setMessage('Action failed, please try again')
    } finally {
      setSwipeStatus('')
    }
  }

  useEffect(() => {
    loadMatch()
  }, [clerkUserId])

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading match...</div>
  }

  if (!match) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Discover</h1>
        <p className="text-gray-600">{message || 'No compatible matches found'}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Your Daily Match</h1>
      <Card className="p-6 mb-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Avatar className="h-24 w-24 shrink-0">
            <AvatarImage src={match.photoUrl} alt={match.name} />
            <AvatarFallback>{match.userId.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold">{match.name}</h2>
            <p className="text-gray-600 mt-1 line-clamp-2">{match.bio}</p>
            <Badge variant="secondary" className="mt-2 text-xs">
              Age: 25
            </Badge>
          </div>
        </div>
      </Card>
      <div className="flex gap-3 mt-4">
        <Button
          onClick={() => handleSwipe('like')}
          disabled={swipeStatus === 'like'}
          className="flex-1 bg-green-500 text-white py-3 px-4 rounded-full text-lg font-medium hover:bg-green-600 disabled:bg-gray-400"
        >
          Like
        </Button>
        <Button
          onClick={() => handleSwipe('pass')}
          disabled={swipeStatus === 'pass'}
          className="flex-1 bg-red-500 text-white py-3 px-4 rounded-full text-lg font-medium hover:bg-red-600 disabled:bg-gray-400"
        >
          Pass
        </Button>
      </div>
      {message && (
        <p className="mt-4 text-sm text-center text-green-600">{message}</p>
      )}
    </div>
  )
}