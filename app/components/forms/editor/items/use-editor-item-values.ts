import type { FieldValues, FormApi } from "@rvf/react"
import { useEffect, useRef, type RefObject } from "react"
import { useRegisterFormWorkspacePublishValidation } from "~/components/forms/form-workspace-dialog"

export function useEditorItemValues<Values extends FieldValues>(
  formRef: RefObject<FormApi<Values> | null>,
  onChange: (values: Values) => void,
) {
  const registerPublishValidation = useRegisterFormWorkspacePublishValidation()
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const form = formRef.current
    if (!form) return
    return form.subscribe.value((values) => onChangeRef.current(values))
  }, [formRef])

  useEffect(() => {
    return registerPublishValidation?.(async () => {
      const errors = await formRef.current?.validate()
      return !errors || Object.keys(errors).length === 0
    })
  }, [formRef, registerPublishValidation])

  return () => {
    if (formRef.current) onChangeRef.current(formRef.current.transient.value())
    return Promise.resolve()
  }
}
