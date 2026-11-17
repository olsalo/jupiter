import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import Icon from "@/components/ui/icons/icons"
import "./showcase.css"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"
void i18n.use(initReactI18next).init({ lng: "en", resources: { en: { translation: { loading: "Loading", routePlaceholders: { close: "Close" }, table: { pagination: "Pagination", previous: "Previous", next: "Next", morePages: "More pages" } } } }, interpolation: { escapeValue: false } })
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckboxGroup } from "@/components/ui/checkbox-group"
import { Switch } from "@/components/ui/switch"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { RadioGroup, Radio, RadioCard } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { NumberField, NumberFieldGroup, NumberFieldInput, NumberFieldDecrement, NumberFieldIncrement } from "@/components/ui/number-field"
import { OTPField, OTPFieldInput } from "@/components/ui/otp-field"
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "@/components/ui/select"
import { Autocomplete, AutocompleteInput, AutocompletePopup, AutocompleteList, AutocompleteItem, AutocompleteEmpty } from "@/components/ui/autocomplete"
import { Combobox, ComboboxInput, ComboboxPopup, ComboboxList, ComboboxItem, ComboboxEmpty } from "@/components/ui/combobox"
import { Form } from "@/components/ui/form"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Group, GroupSeparator, GroupText } from "@/components/ui/group"
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion"
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs"
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Card, CardHeader, CardTitle, CardDescription, CardPanel, CardFooter } from "@/components/ui/card"
import { Frame, FrameHeader, FrameTitle, FrameDescription, FramePanel, FrameFooter } from "@/components/ui/frame"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Progress, ProgressLabel, ProgressTrack, ProgressIndicator, ProgressValue } from "@/components/ui/progress"
import { Meter, MeterLabel, MeterTrack, MeterIndicator, MeterValue } from "@/components/ui/meter"
import { Separator } from "@/components/ui/separator"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@/components/ui/toolbar"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipPopup } from "@/components/ui/tooltip"
import { Popover, PopoverTrigger, PopoverPopup, PopoverTitle, PopoverDescription } from "@/components/ui/popover"
import { PreviewCard, PreviewCardTrigger, PreviewCardPopup } from "@/components/ui/preview-card"
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "@/components/ui/menu"
import { ContextMenu, ContextMenuTrigger, ContextMenuPopup, ContextMenuItem } from "@/components/ui/context-menu"
import { Dialog, DialogTrigger, DialogPopup, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogTrigger, AlertDialogPopup, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogClose } from "@/components/ui/alert-dialog"
import { Sheet, SheetTrigger, SheetPopup, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet"
import { Drawer, DrawerTrigger, DrawerPopup, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBar } from "@/components/ui/drawer"
import { ToastProvider, toastManager } from "@/components/ui/toast"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command"
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"

const subscriptionPlans = [
  { label: "Starter", value: "starter", description: "For individuals and small projects" },
  { label: "Team", value: "team", description: "For growing teams" },
  { label: "Business", value: "business", description: "For larger organizations" },
  { label: "Enterprise", value: "enterprise", description: "For advanced security and support" },
]
const fruits = ["Apple", "Banana", "Cherry", "Orange"]
function Sample({ name, children }: { name: string; children: React.ReactNode }) {
  return <section id={name.toLowerCase().replaceAll(" ", "-")} className="min-w-0 py-5"><h3 className="mb-4 font-mono text-xs font-semibold tracking-wide text-muted-foreground">{name}</h3><div className="flex min-h-12 flex-wrap items-center gap-3">{children}</div></section>
}
function Showcase() {
 const [dark, setDark] = useState(false)
 const [period, setPeriod] = useState("Day")
 useEffect(() => { document.documentElement.classList.toggle("dark", dark); return () => document.documentElement.classList.remove("dark"); }, [dark])
 return <div className={dark ? "dark" : ""}><div className="min-h-screen bg-background text-foreground"><header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">Developer tools</p><h1 className="text-xl font-semibold tracking-tight">Component showcase</h1></div><button type="button" onClick={() => setDark(!dark)} aria-pressed={dark} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">{dark ? <Icon name="sun" aria-hidden="true" className="size-4" /> : <Icon name="moon" aria-hidden="true" className="size-4" />}{dark ? "Light mode" : "Dark mode"}</button></div></header><main className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><p className="mb-8 max-w-2xl text-sm leading-6 text-muted-foreground">A working gallery of the components in <code className="rounded bg-secondary px-1.5 py-0.5">app/components/ui</code>. Try the controls, open the overlays, and switch themes to inspect their states.</p><TooltipProvider><ToastProvider><div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
 <Sample name="Button"><div className="flex flex-col gap-5">{(["xs", "sm", "default", "lg", "xl"] as const).map(size => <div key={size} className="flex flex-wrap items-center gap-4"><Button size={size}>Primary</Button><Button size={size} variant="outline">Outline</Button><Button size={size} variant="ghost">Ghost</Button></div>)}</div></Sample>
 <Sample name="Icon + Label Buttons"><div className="flex flex-col gap-5">{(["xs", "sm", "default", "lg", "xl"] as const).map(size => <div key={size} className="flex flex-wrap items-center gap-4"><Button size={size}><Icon name="plus" /> Create</Button><Button size={size} variant="outline"><Icon name="search" /> Search</Button><Button size={size} variant="ghost"><Icon name="trash" /> Delete</Button></div>)}</div></Sample>
 <Sample name="Icon Buttons"><div className="flex flex-col gap-5">{(["icon-xs", "icon-sm", "icon", "icon-lg", "icon-xl"] as const).map(size => <div key={size} className="flex items-center gap-4"><Button size={size} aria-label={`Add ${size}`}><Icon name="plus" /></Button><Button size={size} variant="outline" aria-label={`Search ${size}`}><Icon name="search" /></Button><Button size={size} variant="ghost" aria-label={`Delete ${size}`}><Icon name="trash" /></Button></div>)}</div></Sample>
 <Sample name="Badge"><Badge>Default</Badge><Badge variant="secondary">Secondary</Badge><Badge variant="outline">Outline</Badge></Sample>
 <Sample name="Input / Label"><Label htmlFor="demo-name">Name</Label><Input id="demo-name" placeholder="Alex Morgan" /></Sample>
 <Sample name="Textarea"><Textarea aria-label="Notes" placeholder="Write a note…" /></Sample>
 <Sample name="Checkbox / Checkbox Group"><CheckboxGroup defaultValue={["updates"]}><label className="flex items-center gap-2 text-sm"><Checkbox value="updates" /> Product updates</label><label className="flex items-center gap-2 text-sm"><Checkbox value="news" /> Newsletter</label></CheckboxGroup></Sample>
 <Sample name="Switch / Toggle"><label className="flex items-center gap-2 text-sm"><Switch defaultChecked /> Notifications</label><Toggle aria-label="Toggle bold">Bold</Toggle></Sample>
 <Sample name="Toggle Group"><ToggleGroup defaultValue={["bold"]}><ToggleGroupItem value="bold">B</ToggleGroupItem><ToggleGroupItem value="italic">I</ToggleGroupItem><ToggleGroupItem value="underline">U</ToggleGroupItem></ToggleGroup></Sample>
 <Sample name="Radio Group"><RadioGroup defaultValue="standard"><label className="flex items-center gap-2 text-sm"><Radio value="standard" /> Standard</label><label className="flex items-center gap-2 text-sm"><Radio value="pro" /> Pro</label></RadioGroup></Sample>
 <Sample name="Slider"><Slider aria-label="Volume" defaultValue={40} /></Sample>
 <Sample name="Number Field"><NumberField defaultValue={3}><NumberFieldGroup><NumberFieldDecrement /><NumberFieldInput aria-label="Quantity" /><NumberFieldIncrement /></NumberFieldGroup></NumberField></Sample>
 <Sample name="OTP Field"><Label htmlFor="demo-otp">Verification code</Label><OTPField id="demo-otp" length={6}><OTPFieldInput/><OTPFieldInput aria-label="Digit 2"/><OTPFieldInput aria-label="Digit 3"/><OTPFieldInput aria-label="Digit 4"/><OTPFieldInput aria-label="Digit 5"/><OTPFieldInput aria-label="Digit 6"/></OTPField></Sample>
 <Sample name="Radio Cards"><RadioGroup defaultValue="standard" aria-label="Choose a plan" className="w-full"><RadioCard><Radio value="standard" /><span className="flex flex-col"><span className="text-sm font-medium">Standard</span><span className="text-xs text-muted-foreground">For everyday use</span></span></RadioCard><RadioCard><Radio value="pro" /><span className="flex flex-col"><span className="text-sm font-medium">Pro</span><span className="text-xs text-muted-foreground">For more advanced needs</span></span></RadioCard></RadioGroup></Sample>
 <Sample name="Select with Object Values"><Select defaultValue={subscriptionPlans[0]} itemToStringValue={(item) => item.value}><SelectTrigger aria-label="Select subscription plan" className="w-full py-1"><SelectValue>{(item) => item && <span className="flex flex-col"><span className="truncate">{item.label}</span><span className="truncate text-xs text-muted-foreground">{item.description}</span></span>}</SelectValue></SelectTrigger><SelectPopup>{subscriptionPlans.map(item => <SelectItem key={item.value} value={item}><span className="flex flex-col"><span className="truncate">{item.label}</span><span className="truncate text-xs text-muted-foreground">{item.description}</span></span></SelectItem>)}</SelectPopup></Select></Sample>
 <Sample name="Select"><Select defaultValue="apple" items={{ apple: "Apple", banana: "Banana", cherry: "Cherry" }}><SelectTrigger className="w-full"><SelectValue placeholder="Choose a fruit" /></SelectTrigger><SelectPopup><SelectItem value="apple">Apple</SelectItem><SelectItem value="banana">Banana</SelectItem><SelectItem value="cherry">Cherry</SelectItem></SelectPopup></Select></Sample>
 <Sample name="Autocomplete"><Autocomplete items={fruits}><AutocompleteInput placeholder="Search fruits" /><AutocompletePopup><AutocompleteEmpty>No fruit found.</AutocompleteEmpty><AutocompleteList>{(item: string) => <AutocompleteItem key={item} value={item}>{item}</AutocompleteItem>}</AutocompleteList></AutocompletePopup></Autocomplete></Sample>
 <Sample name="Combobox"><Combobox items={fruits}><ComboboxInput aria-label="Search fruits" placeholder="Type to search fruits…" showClear /><ComboboxPopup><ComboboxEmpty>No fruit found.</ComboboxEmpty><ComboboxList>{(item: string) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList></ComboboxPopup></Combobox></Sample>
 <Sample name="Form / Field / Fieldset"><Form noValidate={true} onSubmit={e => e.preventDefault()} className="w-full"><Fieldset><FieldsetLegend>Profile</FieldsetLegend><Field><FieldLabel>Email</FieldLabel><Input type="email" placeholder="alex@example.com"/><FieldDescription>We’ll keep this private.</FieldDescription></Field></Fieldset></Form></Sample>
 <Sample name="Input Group"><InputGroup><InputGroupAddon><InputGroupText>https://</InputGroupText></InputGroupAddon><InputGroupInput aria-label="Website" placeholder="example.com" /></InputGroup></Sample>
 <Sample name="Group"><div className="flex flex-col items-start gap-3"><Group aria-label="Sharing actions"><Button variant="outline">Copy</Button><GroupSeparator /><GroupText>or</GroupText><GroupSeparator /><Button variant="outline">Share</Button></Group><Group orientation="vertical" aria-label="Vertical actions"><Button variant="outline">Copy</Button><GroupSeparator orientation="horizontal" /><Button variant="outline">Share</Button></Group></div></Sample>
 <Sample name="Accordion"><Accordion className="w-full"><AccordionItem value="one"><AccordionTrigger>What is this?</AccordionTrigger><AccordionPanel>A collection of reusable interface components.</AccordionPanel></AccordionItem><AccordionItem value="two"><AccordionTrigger>Can I interact with it?</AccordionTrigger><AccordionPanel>Yes, try opening and editing the examples.</AccordionPanel></AccordionItem></Accordion></Sample>
 <Sample name="Collapsible"><Collapsible><CollapsibleTrigger render={<Button variant="outline" />}>Show details</CollapsibleTrigger><CollapsiblePanel className="pt-3 text-sm">Here are some extra details.</CollapsiblePanel></Collapsible></Sample>
 <Sample name="Tabs"><Tabs defaultValue="overview"><TabsList><TabsTab value="overview">Overview</TabsTab><TabsTab value="activity">Activity</TabsTab></TabsList><TabsPanel value="overview">Your overview appears here.</TabsPanel><TabsPanel value="activity">Recent activity appears here.</TabsPanel></Tabs></Sample>
 <Sample name="Segmented Control"><SegmentedControl>{["Day", "Week", "Month"].map(item => <SegmentedControlItem key={item} aria-pressed={period === item} data-pressed={period === item ? "" : undefined} onClick={() => setPeriod(item)}>{item}</SegmentedControlItem>)}</SegmentedControl></Sample>
 <Sample name="Card"><Card className="w-full"><CardHeader><CardTitle>Project notes</CardTitle><CardDescription>Last updated today</CardDescription></CardHeader><CardPanel>A little space for your next idea.</CardPanel><CardFooter><Button size="sm">Open project</Button></CardFooter></Card></Sample>
 <Sample name="Frame"><Frame className="w-full"><FrameHeader><FrameTitle>Workspace</FrameTitle><FrameDescription>Shared with your team</FrameDescription></FrameHeader><FramePanel>Three projects are active.</FramePanel><FrameFooter>Updated just now</FrameFooter></Frame></Sample>
 <Sample name="Alert"><div className="flex w-full flex-col gap-3"><Alert><AlertTitle>Heads up</AlertTitle><AlertDescription>There is something to review.</AlertDescription></Alert><Alert variant="info"><AlertTitle>Information</AlertTitle><AlertDescription>A new update is available.</AlertDescription></Alert><Alert variant="success"><AlertTitle>Changes saved</AlertTitle><AlertDescription>Your preferences are up to date.</AlertDescription></Alert><Alert variant="warning"><AlertTitle>Storage is almost full</AlertTitle><AlertDescription>Consider removing unused files.</AlertDescription></Alert><Alert variant="error"><AlertTitle>Unable to save</AlertTitle><AlertDescription>Please try again.</AlertDescription></Alert></div></Sample>
 <Sample name="Empty"><Empty><EmptyHeader><EmptyMedia variant="icon"><Icon name="forms" aria-hidden="true" /></EmptyMedia><EmptyTitle>No projects yet</EmptyTitle><EmptyDescription>Create a project to get started.</EmptyDescription></EmptyHeader></Empty></Sample>
 <Sample name="Avatar / Skeleton / Spinner"><Avatar><AvatarFallback>AM</AvatarFallback></Avatar><Skeleton className="h-8 w-28"/><Spinner /></Sample>
 <Sample name="Progress"><Progress value={65} className="w-full"><div className="flex justify-between"><ProgressLabel>Uploading</ProgressLabel><ProgressValue /></div><ProgressTrack><ProgressIndicator /></ProgressTrack></Progress></Sample>
 <Sample name="Meter"><Meter value={72} className="w-full"><div className="flex justify-between"><MeterLabel>Storage</MeterLabel><MeterValue /></div><MeterTrack><MeterIndicator /></MeterTrack></Meter></Sample>
 <Sample name="Separator / Kbd"><span className="text-sm">Keyboard shortcut</span><Separator orientation="vertical" className="h-6"/><KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup></Sample>
 <Sample name="Breadcrumb"><Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator/><BreadcrumbItem><BreadcrumbPage>Projects</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb></Sample>
 <Sample name="Pagination"><Pagination><PaginationContent><PaginationItem><PaginationPrevious href="#pagination"/></PaginationItem><PaginationItem><PaginationLink href="#pagination" isActive>1</PaginationLink></PaginationItem><PaginationItem><PaginationLink href="#pagination">2</PaginationLink></PaginationItem><PaginationItem><PaginationNext href="#pagination"/></PaginationItem></PaginationContent></Pagination></Sample>
 <Sample name="Table"><Table><TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Website</TableCell><TableCell>Active</TableCell></TableRow><TableRow><TableCell>Research</TableCell><TableCell>Draft</TableCell></TableRow></TableBody></Table></Sample>
 <Sample name="Scroll Area"><ScrollArea className="h-28 w-full rounded-lg border p-3">{Array.from({length: 8}, (_, i) => <div key={i} className="py-1 text-sm">Example item {i + 1}</div>)}</ScrollArea></Sample>
 <Sample name="Toolbar"><Toolbar aria-label="Editing actions"><ToolbarButton render={<Button variant="ghost" size="icon" />} aria-label="Copy"><Icon name="copy" /></ToolbarButton><ToolbarButton render={<Button variant="ghost" size="icon" />} aria-label="Edit"><Icon name="edit" /></ToolbarButton><ToolbarSeparator /><ToolbarButton render={<Button variant="ghost" size="icon" />} aria-label="Delete"><Icon name="trash" /></ToolbarButton></Toolbar></Sample>
 <Sample name="Tooltip"><Tooltip><TooltipTrigger render={<Button variant="outline" />}>Hover me</TooltipTrigger><TooltipPopup>A helpful hint</TooltipPopup></Tooltip></Sample>
 <Sample name="Popover"><Popover><PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger><PopoverPopup className="w-64"><PopoverTitle>Quick settings</PopoverTitle><PopoverDescription className="mt-2">Adjust your preferences here</PopoverDescription></PopoverPopup></Popover></Sample>
 <Sample name="Preview Card"><PreviewCard><PreviewCardTrigger render={<a href="#preview-card" className="text-sm underline" />}>Hover to preview</PreviewCardTrigger><PreviewCardPopup className="flex-col gap-1"><strong>Alex Morgan</strong><p className="text-sm text-muted-foreground">Designer and collaborator</p></PreviewCardPopup></PreviewCard></Sample>
 <Sample name="Menu"><Menu><MenuTrigger render={<Button variant="outline" />}>Actions</MenuTrigger><MenuPopup><MenuItem>Edit</MenuItem><MenuItem>Duplicate</MenuItem><MenuItem>Archive</MenuItem></MenuPopup></Menu></Sample>
 <Sample name="Context Menu"><ContextMenu><ContextMenuTrigger className="w-full rounded-lg border border-dashed p-5 text-center text-sm">Right-click here</ContextMenuTrigger><ContextMenuPopup><ContextMenuItem>Copy</ContextMenuItem><ContextMenuItem>Rename</ContextMenuItem></ContextMenuPopup></ContextMenu></Sample>
 <Sample name="Dialog"><Dialog><DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger><DialogPopup><DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update your profile information.</DialogDescription></DialogHeader></DialogPopup></Dialog></Sample>
 <Sample name="Alert Dialog"><AlertDialog><AlertDialogTrigger render={<Button variant="outline" />}>Open confirmation</AlertDialogTrigger><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>Archive this project?</AlertDialogTitle><AlertDialogDescription>You can restore it later.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose><AlertDialogClose render={<Button />}>Archive</AlertDialogClose></AlertDialogFooter></AlertDialogPopup></AlertDialog></Sample>
 <Sample name="Sheet"><Sheet><SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger><SheetPopup><SheetHeader><SheetTitle>Settings</SheetTitle><SheetDescription>Manage your workspace settings.</SheetDescription></SheetHeader><SheetFooter className="mt-auto"><SheetClose render={<Button variant="outline" />}>Cancel</SheetClose><SheetClose render={<Button />}>Save changes</SheetClose></SheetFooter></SheetPopup></Sheet></Sample>
 <Sample name="Sheet / Inset"><Sheet><SheetTrigger render={<Button variant="outline" />}>Open inset sheet</SheetTrigger><SheetPopup variant="inset"><SheetHeader><SheetTitle>Workspace settings</SheetTitle><SheetDescription>Manage your workspace settings in an inset sheet.</SheetDescription></SheetHeader><SheetFooter className="mt-auto"><SheetClose render={<Button variant="outline" />}>Cancel</SheetClose><SheetClose render={<Button />}>Save changes</SheetClose></SheetFooter></SheetPopup></Sheet></Sample>
 <Sample name="Drawer"><Drawer><DrawerTrigger render={<Button variant="outline" />}>Open drawer</DrawerTrigger><DrawerPopup><DrawerBar /><DrawerHeader><DrawerTitle>Details</DrawerTitle><DrawerDescription>More information about this item.</DrawerDescription></DrawerHeader></DrawerPopup></Drawer></Sample>
 <Sample name="Toast"><Button variant="outline" onClick={() => toastManager.add({ title: "Saved successfully", description: "Your changes are ready.", type: "success" })}>Show toast</Button></Sample>
 <Sample name="Calendar"><Calendar mode="single" defaultMonth={new Date(2026, 10)} /></Sample>
 <Sample name="Command"><div className="w-full overflow-hidden rounded-lg border"><Command items={fruits}><CommandInput placeholder="Search commands…" autoFocus={false}/><CommandList>{(item: string) => <CommandItem key={item} value={item}>{item}</CommandItem>}</CommandList></Command></div></Sample>
 <Sample name="Sidebar"><div className="h-48 w-full overflow-hidden rounded-lg border"><SidebarProvider className="min-h-0! h-full"><Sidebar collapsible="none" className="w-full!"><SidebarHeader>Workspace</SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>Projects</SidebarGroupLabel><SidebarMenu><SidebarMenuItem><SidebarMenuButton>Overview</SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton>Settings</SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroup></SidebarContent></Sidebar></SidebarProvider></div></Sample>
 </div></ToastProvider></TooltipProvider></main></div></div>
}
createRoot(document.getElementById("root")!).render(<Showcase />)
