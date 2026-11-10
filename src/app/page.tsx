import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs'
import { Suspense } from 'react'

// No 'force-dynamic' here. Next.js 16 handles this via Suspense.

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Welcome to the Dating App</h1>

      {/* Wrap the Clerk components in Suspense to satisfy Cache Components */}
      <Suspense fallback={<div className="h-10"></div>}>
        <Show when="signed-out">
          <div className="flex gap-4">
            <SignInButton mode="redirect">
              <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <button className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg">You are signed in!</p>
            <UserButton />
          </div>
        </Show>
      </Suspense>
    </main>
  )
}