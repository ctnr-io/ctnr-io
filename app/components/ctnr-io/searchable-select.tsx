'use dom'

import { Button } from 'app/components/shadcn/ui/button.tsx'
import { ChevronsUpDown } from 'lucide-react'
import { ReactNode, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'app/components/shadcn/ui/command.tsx'
import { Popover, PopoverContent, PopoverTrigger } from 'app/components/shadcn/ui/popover.tsx'

export interface SearchableSelectOption {
  value: string
  label: string
  icon?: ReactNode
  disabled?: boolean
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  buttonClassName?: string
  popoverClassName?: string
  disabled?: boolean
  renderSelectedValue?: (option: SearchableSelectOption | null) => ReactNode
  renderOption?: (option: SearchableSelectOption) => ReactNode
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search options...',
  emptyMessage = 'No option found.',
  className,
  popoverClassName,
  disabled = false,
  renderSelectedValue,
  renderOption,
}: SearchableSelectProps) {
  const selectedOption = options.find((option) => option.value === value) || null

  const defaultRenderSelectedValue = (option: SearchableSelectOption | null) => {
    if (!option) return placeholder
    return (
      <div className='flex items-center gap-2'>
        {option.icon}
        {option.label}
      </div>
    )
  }

  const defaultRenderOption = (option: SearchableSelectOption) => (
    <div className='flex items-center gap-2'>
      {option.icon}
      {option.label}
    </div>
  )

  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          disabled={disabled}
          className={`justify-between text-ellipsis ${className || ''}`}
        >
          {renderSelectedValue ? renderSelectedValue(selectedOption) : defaultRenderSelectedValue(selectedOption)}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`p-0 ${popoverClassName || ''}`}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  disabled={option.disabled}
                  onSelect={() => {
                    setOpen(false)
                    onValueChange(option.value)
                  }}
                >
                  {renderOption ? renderOption(option) : defaultRenderOption(option)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
