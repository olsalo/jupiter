import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Alert, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"

export function FeatureVideo({ title, src }: { title: string, src: string }) {
  const { t } = useTranslation("marketing")
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loadVideo, setLoadVideo] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const wantsPlayback = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (typeof IntersectionObserver === "undefined") {
      setLoadVideo(true)
      return
    }
    let playTimeout: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (playTimeout) clearTimeout(playTimeout)
      playTimeout = undefined
      if (entry?.isIntersecting) setLoadVideo(true)
      if (entry?.isIntersecting && entry.intersectionRatio >= 0.999) {
        playTimeout = setTimeout(() => {
          wantsPlayback.current = true
          void video.play().catch(() => setIsPlaying(false))
        }, 500)
        return
      }
      wantsPlayback.current = false
      video.pause()
      setIsPlaying(false)
    }, { threshold: [0, 0.999] })
    observer.observe(video)
    return () => {
      if (playTimeout) clearTimeout(playTimeout)
      observer.disconnect()
      wantsPlayback.current = false
      video.pause()
    }
  }, [])

  function playVideo() {
    const video = videoRef.current
    if (!video) return
    wantsPlayback.current = true
    void video.play().catch(() => setIsPlaying(false))
  }

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) playVideo()
    else {
      wantsPlayback.current = false
      video.pause()
    }
  }

  function restart() {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    playVideo()
  }

  return (
    <div className="overflow-hidden rounded-lg md:rounded-xl">
      <div className="relative overflow-hidden rounded-lg md:rounded-xl">
      <video
        aria-label={t("videoLabel", { title })}
        autoPlay={false}
        className="aspect-[16/10] w-full rounded-lg bg-muted object-contain md:rounded-xl"
        controls={false}
        loop={true}
        muted={true}
        onError={() => setFailed(true)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => {
          if (!wantsPlayback.current) videoRef.current?.pause()
          else setIsPlaying(true)
        }}
        playsInline={true}
        preload="metadata"
        ref={videoRef}
        src={loadVideo ? src : undefined}
      >
        {t("videoFallback")} <a href={src}>{t("downloadVideo")}</a>
      </video>
      <button
        aria-label={t(isPlaying ? "pauseVideo" : "playVideo")}
        className="absolute inset-0 rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        disabled={failed}
        onClick={togglePlayback}
        type="button"
      />
      <div aria-label={t("videoControls", { title })} className="absolute right-2 bottom-2 flex items-center gap-0.5 rounded-md bg-background/90 p-0.5 shadow-xs backdrop-blur-sm" role="group">
        <Button aria-label={t(isPlaying ? "pauseVideo" : "playVideo")} className="rounded-sm" disabled={failed} onClick={togglePlayback} size="icon-xs" type="button" variant="ghost">
          <Icon aria-hidden={true} className="size-3.5" name={isPlaying ? "pause" : "play"} />
        </Button>
        <Button aria-label={t("restartVideo")} className="rounded-sm" disabled={failed} onClick={restart} size="icon-xs" type="button" variant="ghost">
          <Icon aria-hidden={true} className="size-3.5" name="restart" />
        </Button>
      </div>
      </div>
      {failed ? <Alert className="mt-2" variant="error"><AlertTitle>{t("videoError")} · <a className="underline" href={src}>{t("downloadVideo")}</a></AlertTitle></Alert> : null}
    </div>
  )
}
