import {
  FormProvider,
  useForm,
  type FieldErrors,
  type FieldValues,
  type FormApi,
  type FormOpts,
} from "@rvf/react"
import type { UseMutationResult } from "@tanstack/react-query"
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react"
import { cn } from "~/lib/utils"
import { useHydrated } from "~/lib/use-hydrated"

type MutationError = {
  errors?: FieldErrors
  data?: {
    zodError?: {
      fieldErrors?: Record<string, string[] | undefined>
    } | null
  }
}

export type AppFormState = {
  isDirty: boolean
  isSubmitting: boolean
}

type SubmitFn<FormOutputData, SubmitResponseData> =
  | ((data: FormOutputData) => void | Promise<SubmitResponseData>)
  | UseMutationResult<SubmitResponseData, unknown, FormOutputData>

type AppFormProps<
  SchemaInput extends FieldValues,
  SchemaOutput,
  SubmitResponseData,
  DefaultValues extends FieldValues,
  FormInputData extends FieldValues,
> = Omit<
  FormOpts<SchemaInput, SchemaOutput, SubmitResponseData, DefaultValues, FormInputData>,
  "handleSubmit" | "submitSource"
> & {
  ref?: Ref<FormApi<FormInputData>>
  submitFn: SubmitFn<SchemaOutput, SubmitResponseData>
  customData?: Partial<SchemaOutput>
  className?: string
  onFormStateChange?: (state: AppFormState) => void
  children: ReactNode | ((form: FormApi<FormInputData>) => ReactNode)
}

const defaultValidationBehaviorConfig: FormOpts["validationBehaviorConfig"] = {
  initial: "onSubmit",
  whenSubmitted: "onSubmit",
  whenTouched: "onSubmit",
}

export function AppForm<
  SchemaInput extends FieldValues,
  SchemaOutput extends object,
  SubmitResponseData,
  const DefaultValues extends FieldValues = SchemaInput,
  FormInputData extends FieldValues = DefaultValues,
>({
  ref,
  submitFn,
  customData,
  className,
  onFormStateChange,
  children,
  ...formOptions
}: AppFormProps<
  SchemaInput,
  SchemaOutput,
  SubmitResponseData,
  DefaultValues,
  FormInputData
>): ReactElement {
  const isHydrated = useHydrated()
  const [submitValidationErrors, setSubmitValidationErrors] = useState<FieldErrors>()
  const mutationValidationErrors = useMemo(
    () =>
      typeof submitFn === "function"
        ? undefined
        : getServerValidationErrors(submitFn.error),
    [submitFn],
  )
  const serverValidationErrors =
    formOptions.serverValidationErrors ?? submitValidationErrors ?? mutationValidationErrors

  const options = {
    ...formOptions,
    submitSource: "state",
    disableFocusOnError: formOptions.disableFocusOnError ?? false,
    onBeforeSubmit: async (beforeSubmitApi) => {
      setSubmitValidationErrors(undefined)
      await formOptions.onBeforeSubmit?.(beforeSubmitApi)
    },
    handleSubmit: async (data) => {
      const submitData = customData ? { ...data, ...customData } : data

      try {
        return await (typeof submitFn === "function"
          ? submitFn(submitData)
          : submitFn.mutateAsync(submitData))
      } catch (error) {
        const errors = getServerValidationErrors(error)

        if (errors) {
          setSubmitValidationErrors(errors)
        }

        throw error
      }
    },
    validationBehaviorConfig: formOptions.validationBehaviorConfig ?? defaultValidationBehaviorConfig,
    serverValidationErrors,
  } as FormOpts<SchemaInput, SchemaOutput, SubmitResponseData, DefaultValues, FormInputData>

  const rvfForm = useForm<SchemaInput, SchemaOutput, SubmitResponseData, DefaultValues, FormInputData>(options)
  const form: typeof rvfForm = {
    ...rvfForm,
    getInputProps: (fieldName, props) => {
      const inputProps = rvfForm.getInputProps(fieldName, props)

      return {
        ...inputProps,
        ref: (element: HTMLElement | null) => {
          // RVF writes its initial value when attaching the ref, so adopt early typing first
          if (
            !isHydrated &&
            (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
            !["checkbox", "radio", "file", "hidden", "submit", "reset", "button", "image"].includes(element.type) &&
            element.value !== element.defaultValue
          ) {
            const value = element instanceof HTMLInputElement && element.type === "number"
              ? element.value === "" ? null : element.valueAsNumber
              : element.value
            rvfForm.setValue(fieldName, value as ReturnType<typeof rvfForm.value<typeof fieldName>>)
            rvfForm.setDirty(fieldName, value !== rvfForm.defaultValue(fieldName))
          }

          if (typeof inputProps.ref === "function") {
            return inputProps.ref(element)
          }
          if (inputProps.ref) inputProps.ref.current = element
        },
      }
    },
  }

  useImperativeHandle(ref, () => form)

  useEffect(() => {
    onFormStateChange?.({
      isDirty: form.formState.isDirty,
      isSubmitting: form.formState.isSubmitting,
    })
  }, [
    form.formState.isDirty,
    form.formState.isSubmitting,
    onFormStateChange,
  ])

  return (
    <FormProvider scope={form.scope()}>
      <form {...form.getFormProps()} className={cn("flex flex-col gap-5", className)} method="post" noValidate>
        {typeof children === "function" ? children(form) : children}
      </form>
    </FormProvider>
  )
}

function getServerValidationErrors(error: unknown): FieldErrors | undefined {
  if (!isMutationError(error)) {
    return undefined
  }

  if (error.errors) {
    return error.errors
  }

  const fieldErrors = error.data?.zodError?.fieldErrors

  if (!fieldErrors) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([fieldName, errors]) => [fieldName, errors?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  )
}

function isMutationError(error: unknown): error is MutationError {
  return Boolean(error) && typeof error === "object"
}
