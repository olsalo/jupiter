import { useEffect, useState, type ComponentProps } from "react"

import { TabsPanel } from "~/components/ui/tabs"

export function LazyTabsPanel({ active, children, ...props }: Omit<ComponentProps<typeof TabsPanel>, "keepMounted"> & { active: boolean }) {
  const [visited, setVisited] = useState(active)
  useEffect(() => {
    if (active) setVisited(true)
  }, [active])

  // Keep visited fields mounted so switching tabs preserves unsaved edits
  return <TabsPanel {...props} keepMounted={true}>{active || visited ? children : null}</TabsPanel>
}
