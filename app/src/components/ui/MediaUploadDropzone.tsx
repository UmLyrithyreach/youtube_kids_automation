import { useState, useRef } from "react"
import { UploadCloud, X } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"

interface Props {
  onFileSelect: (file: File) => void
  onClear?: () => void
  currentPreviewUrl?: string | null
  className?: string
  accept?: string
  label?: string
  sublabel?: string
}

export function MediaUploadDropzone({
  onFileSelect,
  onClear,
  currentPreviewUrl,
  className,
  accept = "image/*",
  label = "Drop mascot or reference image here",
  sublabel = "PNG, JPG, or WebP (up to 10MB)",
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "group relative flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 transition-all duration-300",
        isDragOver
          ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
          : "border-border/80 hover:border-indigo-400 bg-muted/20 hover:bg-muted/40",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {currentPreviewUrl ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative flex items-center justify-center size-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative max-h-36 max-w-full overflow-hidden rounded-xl border border-border shadow-md">
              <img
                src={currentPreviewUrl}
                alt="Preview"
                className="max-h-32 object-contain"
              />
              {onClear && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClear()
                  }}
                  className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black transition-transform active:scale-90"
                  aria-label="Remove image"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center text-center gap-1.5"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
              <UploadCloud className="size-5" />
            </div>
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground">{sublabel}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
