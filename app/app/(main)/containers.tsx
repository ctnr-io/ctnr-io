'use dom'

export default function ContainersScreen() {
  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-background p-4'>
      <h1 className='text-4xl font-bold text-foreground mb-4'>Containers</h1>
      <div className='bg-card p-6 rounded-lg shadow-lg border'>
        <p className='text-card-foreground'>This is a test to see if Tailwind CSS is working properly.</p>
        <button className='mt-4 bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition-opacity'>
          Test Button
        </button>
      </div>
    </div>
  )
}
