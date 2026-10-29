import { QRCodeCanvas } from "qrcode.react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "~/components/ui/dialog"
import { toast } from "~/lib/toast"

type QrCodeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  title: string
  description: string
  filename?: string
}

export function QrCodeDialog({ open, onOpenChange, value, title, description, filename = "qr-code" }: QrCodeDialogProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copying, setCopying] = useState(false)

  const getImage = () => new Promise<Blob>((resolve, reject) => {
    const canvas = canvasRef.current
    if (!canvas) return reject(new Error("QR code is unavailable"))
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create QR image")), "image/png")
  })

  const download = async () => {
    try {
      const url = URL.createObjectURL(await getImage())
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${filename}.png`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error(t("qrCode.downloadError"))
    }
  }

  const copy = async () => {
    setCopying(true)
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": getImage() })])
      toast.success(t("qrCode.copied"))
    } catch {
      toast.error(t("qrCode.copyError"))
    } finally {
      setCopying(false)
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogPopup className="sm:max-w-md" forceBackdrop={true}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogPanel className="flex flex-col items-center gap-5">
        <div className="aspect-square w-full max-w-60 overflow-hidden rounded-lg border bg-white">
          {value ? <QRCodeCanvas aria-label={t("qrCode.imageLabel")} bgColor="#ffffff" fgColor="#18181b" level="M" marginSize={4} ref={canvasRef} role="img" size={1024} style={{ width: "100%", height: "auto", display: "block" }} value={value} /> : null}
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button disabled={!value || copying} loading={copying} onClick={() => void copy()} type="button" variant="outline">
          <Icon aria-hidden={true} name="copy" size={16} />{t("qrCode.copy")}
        </Button>
        <Button disabled={!value} onClick={() => void download()} type="button">
          <Icon aria-hidden={true} name="download" size={16} />{t("qrCode.download")}
        </Button>
      </DialogFooter>
    </DialogPopup>
  </Dialog>
}
