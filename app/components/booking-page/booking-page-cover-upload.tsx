import { useEffect, useRef, useState, type ReactNode, type Ref } from "react"
import { useTranslation } from "react-i18next"
import Icon from "~/components/icons"
import FormLabel from "~/components/forms/form-label"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { imageUploadAccept, isValidImageFile, landscapeImageRequiredError, readImageBase64, type UploadedImage } from "~/lib/storage/image-upload"
import { useImagePreview } from "~/lib/storage/use-image-preview"
import { cn } from "~/lib/utils"
import { toast } from "~/lib/toast"

const coverButtonClassName = "size-9 border-white/20 bg-black/55 text-white shadow-sm shadow-black/20 backdrop-blur-md transition-colors hover:bg-black/70 active:bg-black/70 data-pressed:bg-black/70 focus-visible:ring-white focus-visible:ring-offset-black/50 sm:size-9 *:data-[slot=button-loading-indicator]:text-white"

export function BookingPageCoverUpload({ value, imageUrl, label, description, error, enabled = true, disabled = false, onChange, onBlur, inputRef, upload, onUploadingChange, previewClassName, cover = false, previewFooter }: {
  value: string | null
  imageUrl: string | null
  label: string
  description?: ReactNode
  error?: string | null
  enabled?: boolean
  disabled?: boolean
  onChange: (key: string | null) => void | Promise<void>
  onBlur?: () => void
  inputRef?: Ref<HTMLInputElement>
  upload: (base64: string) => Promise<UploadedImage>
  onUploadingChange?: (uploading: boolean) => void
  cover?: boolean
  previewFooter?: ReactNode
  previewClassName?: string
}) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const dragDepth = useRef(0)
  const pendingRef = useRef(false)
  const [preview, setPreview] = useState<UploadedImage | null>(null)
  const [pending, setPending] = useState<"upload" | "remove" | null>(null)
  const [dragging, setDragging] = useState(false)
  const uploading = pending !== null
  const blocked = disabled || uploading || !enabled
  const key = value
  const { url, loading: imageLoading } = useImagePreview(key, preview?.key === key ? preview.url : imageUrl, preview)

  useEffect(() => {
    if (pending !== "upload" || !preview || key !== preview.key || url !== preview.url) return
    pendingRef.current = false
    setPending(null)
    onUploadingChange?.(false)
  }, [pending, preview, key, url, onUploadingChange])

  const uploadFile = async (file: File) => {
    if (blocked || pendingRef.current) return
    if (!isValidImageFile(file)) {
      toast.error(t("imageUpload.invalid"))
      return
    }
    pendingRef.current = true
    setPreview(null)
    setPending("upload")
    onUploadingChange?.(true)
    let saved = false
    try {
      const result = await upload(await readImageBase64(file))
      const image = new Image()
      image.src = result.url
      await image.decode()
      await onChange(result.key)
      saved = true
      setPreview(result)
    } catch (error) {
      if ((error as { data?: { code?: string } }).data?.code === "BAD_REQUEST") toast.error(t((error as { message?: string }).message === landscapeImageRequiredError ? "imageUpload.landscapeRequired" : "imageUpload.invalid"))
      else toast.error(t("imageUpload.error"))
    } finally {
      if (!saved) {
        pendingRef.current = false
        setPending(null)
        onUploadingChange?.(false)
      }
    }
  }

  const removeButton = key ? <Button
    aria-label={t("imageUpload.remove")}
    className={cover ? coverButtonClassName : undefined}
    title={t("imageUpload.remove")}
    disabled={disabled || uploading}
    loading={pending === "remove"}
    onClick={async () => {
      if (disabled || pendingRef.current) return
      pendingRef.current = true
      setPending("remove")
      onUploadingChange?.(true)
      try {
        await onChange(null)
        setPreview(null)
      } catch {
        toast.error(t("imageUpload.removeError"))
      } finally {
        pendingRef.current = false
        setPending(null)
        onUploadingChange?.(false)
      }
    }}
    size={cover ? "icon" : "default"}
    type="button"
    variant={cover ? "ghost" : "outline"}
  >{cover ? <Icon aria-hidden={true} name="trash" /> : t("imageUpload.remove")}</Button> : null

  return <FormLabel label={label} description={cover ? undefined : description} error={error} errorPlacement="below" labelGroupClassName={cover ? "sr-only" : undefined}>
    {cover ? <div
      aria-busy={imageLoading || pending === "upload"}
      className="relative aspect-video max-h-64 w-full rounded-xl bg-muted/50 bg-cover bg-center bg-no-repeat"
      data-dragging={dragging && !blocked}
      style={url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        if (blocked || pendingRef.current) return
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        event.dataTransfer.dropEffect = blocked || pendingRef.current ? "none" : "copy"
      }}
      onDragLeave={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        event.stopPropagation()
        dragDepth.current = 0
        setDragging(false)
        if (blocked || pendingRef.current) return
        const files = event.dataTransfer.files
        if (files.length > 1) {
          toast.error(t("imageUpload.singleImage"))
          return
        }
        if (files[0]) void uploadFile(files[0])
      }}
    >
      {key ? <div className="absolute top-3 right-3 flex flex-col items-center gap-2">
        <Button
          aria-label={t("imageUpload.changeCover")}
          aria-invalid={Boolean(error)}
          className={coverButtonClassName}
          disabled={disabled || uploading || !enabled}
          loading={pending === "upload"}
          onClick={() => fileRef.current?.click()}
          size="icon"
          title={t("imageUpload.changeCover")}
          type="button"
          variant="ghost"
        >
          <Icon aria-hidden={true} name="edit" />
        </Button>
        {removeButton}
      </div> : <Button
        aria-label={t("imageUpload.addCover")}
        aria-invalid={Boolean(error)}
        className="h-full w-full rounded-xl border-0 bg-transparent p-0 hover:bg-muted/30 active:bg-muted/30 data-pressed:bg-muted/30 [:active,[data-pressed]]:bg-muted/30 sm:h-full"
        disabled={disabled || uploading || !enabled}
        aria-busy={pending === "upload"}
        onClick={() => fileRef.current?.click()}
        type="button"
        variant="secondary"
      >
        <span className="mx-4 flex flex-col items-center gap-1.5 px-3 py-2 text-muted-foreground">
          <span aria-live="polite" className="inline-flex items-center gap-2 text-sm">
            {pending === "upload" ? <Spinner className="size-4" /> : <Icon aria-hidden={true} name="photo" size={18} />}
            {t(pending === "upload" ? "imageUpload.uploading" : "imageUpload.addCover")}
          </span>
          {description ? <span className="text-center text-xs leading-5 font-normal whitespace-normal">{description}</span> : null}
          <span className="hidden text-xs font-normal sm:inline">{t("imageUpload.dragHint")}</span>
        </span>
      </Button>}
      {imageLoading ? <Spinner className="pointer-events-none absolute top-1/2 left-1/2 size-5 -translate-1/2 text-muted-foreground" /> : null}
      {dragging && !blocked ? <div aria-hidden={true} className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-primary bg-background/90 p-4 text-center text-sm font-medium text-primary backdrop-blur-sm">
        <Icon aria-hidden={true} name="photo" size={24} />
        {t("imageUpload.dropCover")}
      </div> : null}
    </div> : url ? <div className="overflow-hidden rounded-xl border"><img alt="" className={cn("aspect-video w-full object-cover", previewClassName)} src={url} /></div> : null}
    <div className={cn("flex w-full gap-3", cover ? "items-start justify-between" : "items-center")}>
      {previewFooter}
      <Input
        accept={imageUploadAccept}
        aria-label={label}
        aria-invalid={Boolean(error)}
        disabled={disabled || uploading || !enabled}
        className={cover ? "hidden" : undefined}
        tabIndex={cover ? -1 : undefined}
        nativeInput={true}
        type="file"
        ref={(element) => {
          fileRef.current = element
          if (typeof inputRef === "function") inputRef(element)
          else if (inputRef) inputRef.current = element
        }}
        onBlur={onBlur}
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          await uploadFile(file)
        }}
      />
      {!cover ? removeButton : null}
    </div>
    {!cover && pending === "upload" ? <p aria-live="polite" className="text-sm text-muted-foreground">{t("imageUpload.uploading")}</p> : null}
    {!enabled ? <Alert variant="info"><AlertDescription>{t("imageUpload.storageMissing")}</AlertDescription></Alert> : null}
  </FormLabel>
}
