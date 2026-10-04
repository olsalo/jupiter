import { Link, data, href } from "react-router"
import { useTranslation } from "react-i18next"

export function loader() {
  return data(null, { status: 404 })
}

export function clientLoader() {
  return null
}

export default function NotFound() {
  const { t } = useTranslation("notFound")

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-gray-950 dark:bg-gray-950 dark:text-white">
      <title>{t("title")}</title>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col justify-center gap-6">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
          {t("eyebrow")}
        </p>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-gray-700 dark:text-gray-200">
            {t("description")}
          </p>
        </div>
        <Link
          className="w-fit rounded-md border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 dark:border-blue-300 dark:bg-blue-300 dark:text-gray-950 dark:hover:bg-blue-200"
          to={href("/")}
        >
          {t("backToHome")}
        </Link>
      </div>
    </main>
  )
}
