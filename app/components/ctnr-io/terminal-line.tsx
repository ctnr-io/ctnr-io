import { useState } from 'react'
import { Button } from '../shadcn/ui/button.tsx'
import { Copy } from 'lucide-react'
import { cn } from 'lib/shadcn/utils.ts'

export  function TerminalLine({
    className,
    prefix = '$',
    text,
  }: {
    className?: string
    prefix?: string
    text: string
  }) {
    const [copied, setCopied] = useState(false)
    const handleCopy = async () => {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
    return (
      <Button
        type='button'
        variant='ghost'
        onClick={handleCopy}
        className={cn(
          'group flex items-center flex-1 bg-gray-900 border border-slate-700 rounded  transition hover:bg-gray-800 focus:outline-none justify-between',
          'cursor-pointer',
          className,
          copied ? 'ring-2 ring-yellow-500' : '',
        )}
        title={copied ? 'Copied!' : 'Copy'}
        tabIndex={0}
      >
        <span className='font-mono text-sm text-gray-100 select-text flex-1 text-left'>
          <span className='text-gray-500 mr-2'>{prefix}</span>
          {text}
        </span>
        <span className='ml-2 flex items-center'>
          <Copy
            className={cn('h-4 w-4 transition', copied ? 'text-yellow-400' : 'text-gray-400 group-hover:text-white')}
          />
          {copied && <span className='ml-2 text-xs text-yellow-400 font-semibold transition'>Copied</span>}
        </span>
      </Button>
    )
  }
