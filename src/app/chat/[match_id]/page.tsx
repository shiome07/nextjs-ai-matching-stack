 'use client'

import { useAuth } from '@clerk/nextjs'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Send, Lock } from 'lucide-react'

interface Message {
  id: string
  senderId: string
  content: string
  timestamp: string
}

export default function ChatPage() {
  const { userId: clerkUserId } = useAuth()
  const params = useParams()
  const match_id = typeof params?.match_id === 'string' ? params.match_id : ''
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [requiresPayment, setRequiresPayment] = useState(false)
  const [gateChecked, setGateChecked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [matchName, setMatchName] = useState('Match')
  const [notice, setNotice] = useState('')

  // Check payment status on mount
  useEffect(() => {
    const checkPayment = async () => {
      if (!clerkUserId || !match_id) return
      try {
        const res = await fetch(`/api/matches/check/${match_id}`)
        const data = await res.json()
        setRequiresPayment(!!data.requiresPayment)
      } catch (e) {
        console.error('Payment check failed', e)
      } finally {
        setGateChecked(true)
      }
    }
    checkPayment()
  }, [match_id, clerkUserId])

  // Poll for new messages once conversation is unlocked
  useEffect(() => {
    if (!clerkUserId || !match_id) return
    const interval = setInterval(async () => {
      if (requiresPayment) return
      try {
        const res = await fetch(`/api/matches/${match_id}`)
        const data = await res.json()
        if (data.match && data.match.name) setMatchName(data.match.name)
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(prev => {
            const newMsgs = data.messages.filter(
              (msg: Message) => !prev.some(p => p.id === msg.id)
            )
            return [...prev, ...newMsgs]
          })
        }
      } catch (e) {
        console.error('Poll failed', e)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [match_id, clerkUserId, requiresPayment])

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !clerkUserId) return
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match_id,
          content: newMessage,
        }),
      })
      if (!res.ok) throw new Error('Send failed')
      setNewMessage('')
      // Optimistically append the sent message
      setMessages(prev => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          senderId: clerkUserId,
          content: newMessage,
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (e) {
      console.error('Send error', e)
      setNotice('Could not send message. Locked or server error.')
    }
  }, [match_id, newMessage, clerkUserId])

  // Stub unlock: in production this would post to a Stripe checkout endpoint.
  // For now, simulate the transaction by hitting the lock endpoint logic.
  const unlockChat = async () => {
    setUnlocking(true)
    try {
      const res = await fetch('/api/matches/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match_id }),
      })
      if (res.ok) {
        setRequiresPayment(false)
        setNotice('Conversation unlocked. Say hello!')
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setNotice(data.error || 'Unlock failed')
      }
    } catch (e) {
      console.error('Unlock error', e)
      setNotice('Unlock failed. Please try again.')
    } finally {
      setUnlocking(false)
    }
  }

  const isOwnMessage = (msg: Message) => msg.senderId === clerkUserId

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      {/* Match header */}
      <Card className="p-4 flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src="" alt={matchName} />
          <AvatarFallback>{matchName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold truncate">{matchName}</h1>
          <Badge variant="secondary" className="text-xs">
            {requiresPayment ? 'Locked' : 'Connected'}
          </Badge>
        </div>
      </Card>

      {/* Messages thread */}
      <Card className="flex flex-col h-[60vh] overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {!gateChecked && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading conversation...
            </div>
          )}
          {gateChecked && messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground">
              No messages yet. Say hello!
            </div>
          )}
          {messages.map((msg: Message) => (
            <div
              key={msg.id}
              className={`flex ${isOwnMessage(msg) ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                  isOwnMessage(msg)
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}
              >
                <p className="break-words">{msg.content}</p>
                <span className="text-xs opacity-70 mt-1 block text-right">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {notice && (
        <p className="text-sm text-center text-primary">{notice}</p>
      )}

      {/* Input area */}
      <Card className="p-3">
        {requiresPayment ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span className="text-sm">This conversation is locked.</span>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              className="flex-1"
            />
            <Button onClick={sendMessage} size="icon" aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}