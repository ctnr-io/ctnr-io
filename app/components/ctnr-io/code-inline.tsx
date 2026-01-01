import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from 'app/components/shadcn/ui/tooltip.tsx'
import { cn } from 'lib/shadcn/utils.ts'

export interface CodeInlineProps {
  className?: string
  text: string
  prefix?: React.ReactNode
  showIcon?: boolean
}

export function CodeInline({
  className,
  text,
  showIcon = true,
  prefix,
}: CodeInlineProps) {
    const [copied, setCopied] = useState(false)
    const handleCopy = async () => {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
  return (
    <span className="">
      {prefix && <span className='text-muted-foreground'>{prefix}</span>}
      <Tooltip open={copied}>
        <TooltipTrigger asChild>
          <button
            type='button'
            onClick={handleCopy}
            className={cn(
              'inline-flex items-center gap-2 font-mono',
              'px-1 mx-1 rounded border',
              'cursor-pointer',
               'bg-muted/50 border-transparent my-0.5 hover:border-muted hover:bg-muted/10',
              className,
              copied ? '' : '',
            )}
            aria-pressed={copied}
            aria-label={copied ? `Copied ${text}` : `Copy ${text}`}
          >
            <span>{text}</span>
            {showIcon && (
              <Copy
                className={cn('h-4 w-4 transition text-muted-foreground/40')}
                aria-hidden='true'
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {copied ? 'Copied!' : 'Copy'}
        </TooltipContent>
      </Tooltip>
    </span>
  )
}
