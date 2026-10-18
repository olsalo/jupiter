import { useParams } from "react-router"
import { ServiceFormSheet } from "~/components/services/service-form-sheet"

export default function Edit() {
  const { serviceId } = useParams()
  return <ServiceFormSheet serviceId={serviceId} />
}
