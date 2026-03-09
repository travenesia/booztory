import Link from "next/link"
import { ArrowLeft } from "iconoir-react"

interface PageTopbarProps {
  title: string
}

export function PageTopbar({ title }: PageTopbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-0 h-12 w-full z-50">
      {" "}
      {/* Removed border-b */}
      <div className="flex justify-between items-center h-full px-6 mx-auto">
        <Link href="/" className="flex items-center text-gray-900 hover:text-red-700">
          {" "}
          {/* Updated text color */}
          <ArrowLeft width={24} height={24} />
        </Link>
        <h1 className="text-lg font-medium text-gray-900">{title}</h1> {/* Updated text color */}
        <div className="w-6"></div> {/* Empty div for balanced spacing */}
      </div>
    </header>
  )
}
