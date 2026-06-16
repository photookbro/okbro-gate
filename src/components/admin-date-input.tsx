'use client'

import { formatDateInputValue, isCompleteIsoDate } from '@/lib/date-input'

type AdminDateInputProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  required?: boolean
}

export function AdminDateInput({ value, onChange, className, required }: AdminDateInputProps) {
  const invalid = value.length > 0 && !isCompleteIsoDate(value)

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        required={required}
        value={value}
        onChange={e => onChange(formatDateInputValue(e.target.value))}
        className={className}
        placeholder="20250608"
        maxLength={10}
        aria-invalid={invalid || undefined}
      />
      {invalid && (
        <p className="mt-1 text-xs text-[var(--danger)]">올바른 날짜를 입력해주세요 (예: 20250608)</p>
      )}
    </>
  )
}
