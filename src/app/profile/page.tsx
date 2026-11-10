"use client";
import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// Design token values are injected via CSS variables from globals.css
export default function ProfilePage() {
  const { userId } = useAuth()
  const [bio, setBio] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const initials = userId ? userId.slice(0, 2).toUpperCase() : ''

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Profile Header Card */}
      <Card className="p-6 flex flex-col items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src="" alt="Profile photo" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Your Profile</h1>
          <Badge variant="secondary">Status: Approved</Badge>
        </div>
      </Card>

      {/* Bio Section */}
      <Card className="p-6">
        <Label htmlFor="bio" className="text-sm font-medium mb-2 block">
          Bio
        </Label>
        <Input
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell people about yourself..."
          className="resize-none"
          disabled={!isEditing}
        />
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant="outline"
          >
            {isEditing ? 'Save' : 'Edit'}
          </Button>
          {isEditing && (
            <Button onClick={() => setIsEditing(false)} variant="ghost">
              Cancel
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}